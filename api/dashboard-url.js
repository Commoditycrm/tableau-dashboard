import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'

// Only this account may edit the dashboard URL. Configurable via env,
// defaults to the designated admin.
const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'kacey@smartlogisticsinc.com'
)
  .trim()
  .toLowerCase()

function isValidDashboardUrl(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    if (!/^https?:$/.test(url.protocol)) return false
    // Tableau view URLs always contain "/views/" (hash- or path-style).
    return /\/views\//.test(trimmed)
  } catch {
    return false
  }
}

async function readDashboardUrl() {
  const { rows } = await sql`
    SELECT value FROM app_settings WHERE key = 'dashboard_url' LIMIT 1
  `
  return rows[0]?.value || ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const url = await readDashboardUrl()
      return res.status(200).json({ url })
    }

    if (req.method === 'POST') {
      const email = (req.body?.email || '').trim().toLowerCase()
      const password = req.body?.password || ''
      const url = (req.body?.url || '').trim()

      if (!email || !password) {
        return res.status(400).json({ error: 'email_and_password_required' })
      }
      if (!isValidDashboardUrl(url)) {
        return res.status(400).json({ error: 'invalid_dashboard_url' })
      }

      // Re-authenticate on every write — there is no session token to trust.
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
      return res.status(200).json({ ok: true, url })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err) {
    console.error('dashboard-url error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
