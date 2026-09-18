import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { applyCors } from './_lib/cors.js'
import { getSession, isSessionEnabled } from './_lib/session.js'

// Scopes are fixed server-side. The client can never widen them.
//   tableau:views:embed    — embed dashboards / views
//   tableau:insights:embed — embed Tableau Pulse metrics
// tableau:views:embed_authoring was removed: nothing in the app uses web
// authoring, and it would let an embedded user open Tableau's editor.
const SCOPES = ['tableau:views:embed', 'tableau:insights:embed']
const TOKEN_TTL_SECONDS = 9 * 60

export default function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const {
    TABLEAU_CONNECTED_APP_CLIENT_ID,
    TABLEAU_CONNECTED_APP_SECRET_ID,
    TABLEAU_CONNECTED_APP_SECRET_VALUE,
  } = process.env

  if (
    !TABLEAU_CONNECTED_APP_CLIENT_ID ||
    !TABLEAU_CONNECTED_APP_SECRET_ID ||
    !TABLEAU_CONNECTED_APP_SECRET_VALUE
  ) {
    return res
      .status(500)
      .json({ error: 'tableau_connected_app_not_configured' })
  }

  // Identity comes from the server-verified login session, never from the
  // request body. Legacy fallback (body username) stays only until
  // SESSION_SECRET is configured, and is logged so it is visible.
  let username
  if (isSessionEnabled()) {
    const session = getSession(req)
    if (!session) {
      return res.status(401).json({ error: 'not_signed_in' })
    }
    username = session.email
  } else {
    console.warn(
      '[tableau-jwt] SESSION_SECRET not set — trusting username from request body (legacy mode)',
    )
    username = (req.body?.username || '').trim()
    if (!username) {
      return res.status(400).json({ error: 'username_required' })
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expSeconds = nowSeconds + TOKEN_TTL_SECONDS

  const token = jwt.sign(
    {
      iss: TABLEAU_CONNECTED_APP_CLIENT_ID,
      aud: 'tableau',
      sub: username,
      scp: SCOPES,
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

  res.status(200).json({
    jwt: token,
    expiresAt: new Date(expSeconds * 1000).toISOString(),
  })
}
