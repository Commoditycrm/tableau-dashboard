import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
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

    return res.status(200).json({ ok: true, email: user.email })
  } catch (err) {
    console.error('login error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
