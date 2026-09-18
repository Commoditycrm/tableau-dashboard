import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { sql } from '@vercel/postgres'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const {
  TABLEAU_CONNECTED_APP_CLIENT_ID,
  TABLEAU_CONNECTED_APP_SECRET_ID,
  TABLEAU_CONNECTED_APP_SECRET_VALUE,
  PORT = 3001,
} = process.env

// Fixed server-side; mirrors api/tableau-jwt.js. Clients cannot widen scopes.
const SCOPES = ['tableau:views:embed', 'tableau:insights:embed']
const TOKEN_TTL_SECONDS = 9 * 60

// Only this account may edit the dashboard URL (see api/dashboard-url.js).
// Set via the ADMIN_EMAIL env var; if unset, no one is treated as admin.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

function isValidDashboardUrl(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    if (!/^https?:$/.test(url.protocol)) return false
    return /\/views\//.test(trimmed)
  } catch {
    return false
  }
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.post('/api/login', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' })
  }
  try {
    const { rows } = await sql`
      SELECT email, password_hash FROM users WHERE email = ${email} LIMIT 1
    `
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL
    res.json({ ok: true, email: user.email, isAdmin })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/dashboard-url', async (_req, res) => {
  try {
    const { rows } = await sql`
      SELECT value FROM app_settings WHERE key = 'dashboard_url' LIMIT 1
    `
    res.json({ url: rows[0]?.value || '' })
  } catch (err) {
    console.error('dashboard-url read error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/dashboard-url', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  const url = (req.body?.url || '').trim()

  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' })
  }
  if (!isValidDashboardUrl(url)) {
    return res.status(400).json({ error: 'invalid_dashboard_url' })
  }

  try {
    const { rows } = await sql`
      SELECT email, password_hash FROM users WHERE email = ${email} LIMIT 1
    `
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    if (user.email.trim().toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'not_authorized' })
    }

    await sql`
      INSERT INTO app_settings (key, value, updated_at, updated_by)
      VALUES ('dashboard_url', ${url}, NOW(), ${user.email})
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at,
                    updated_by = EXCLUDED.updated_by
    `
    res.json({ ok: true, url })
  } catch (err) {
    console.error('dashboard-url write error', err)
    res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/tableau-jwt', (req, res) => {
  if (
    !TABLEAU_CONNECTED_APP_CLIENT_ID ||
    !TABLEAU_CONNECTED_APP_SECRET_ID ||
    !TABLEAU_CONNECTED_APP_SECRET_VALUE
  ) {
    return res.status(500).json({ error: 'tableau_connected_app_not_configured' })
  }

  const username = req.body?.username
  if (!username) {
    return res.status(400).json({ error: 'username_required' })
  }

  const scopes = SCOPES

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expSeconds = nowSeconds + TOKEN_TTL_SECONDS

  const token = jwt.sign(
    {
      iss: TABLEAU_CONNECTED_APP_CLIENT_ID,
      aud: 'tableau',
      sub: username,
      scp: scopes,
      jti: randomUUID(),
      exp: expSeconds,
    },
    TABLEAU_CONNECTED_APP_SECRET_VALUE,
    {
      algorithm: 'HS256',
      header: {
        kid: TABLEAU_CONNECTED_APP_SECRET_ID,
        iss: TABLEAU_CONNECTED_APP_CLIENT_ID,
      },
    },
  )

  res.json({
    jwt: token,
    expiresAt: new Date(expSeconds * 1000).toISOString(),
  })
})

app.listen(PORT, () => {
  console.log(`tableau-jwt server listening on http://localhost:${PORT}`)
})
