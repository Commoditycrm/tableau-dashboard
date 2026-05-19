import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import 'dotenv/config'

const {
  TABLEAU_CONNECTED_APP_CLIENT_ID,
  TABLEAU_CONNECTED_APP_SECRET_ID,
  TABLEAU_CONNECTED_APP_SECRET_VALUE,
  PORT = 3001,
} = process.env

const DEFAULT_SCOPES = ['tableau:views:embed', 'tableau:views:embed_authoring']
const TOKEN_TTL_SECONDS = 9 * 60

const app = express()
app.use(cors())
app.use(express.json())

app.get('/healthz', (_req, res) => res.json({ ok: true }))

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

  const scopes = Array.isArray(req.body?.scopes) && req.body.scopes.length > 0
    ? req.body.scopes
    : DEFAULT_SCOPES

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
