import { applyCors } from './_lib/cors.js'
import { clearSessionCookieHeader } from './_lib/session.js'

export default function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  res.setHeader('Set-Cookie', clearSessionCookieHeader())
  return res.status(200).json({ ok: true })
}
