import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { applyCors } from './_lib/cors.js'
import {
  createSessionToken,
  isSessionEnabled,
  sessionCookieHeader,
} from './_lib/session.js'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const email = (req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password || ''
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' })
  }

  try {
    const { rows } = await sql`
      SELECT email, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const normalizedEmail = user.email.trim().toLowerCase()
    const isAdmin = normalizedEmail === ADMIN_EMAIL

    // Establish the server-side session that /api/tableau-jwt trusts.
    if (isSessionEnabled()) {
      res.setHeader('Set-Cookie', sessionCookieHeader(createSessionToken(normalizedEmail)))
    }

    return res.status(200).json({ ok: true, email: user.email, isAdmin })
  } catch (err) {
    console.error('login error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
