import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { applyCors } from './_lib/cors.js'

// Only this account may edit the dashboard settings. Set via the ADMIN_EMAIL
// env var. If unset, no one is treated as admin (fail closed).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

// app_settings keys
const KEY_DASHBOARD_URL = 'dashboard_url'
const KEY_PULSE_URLS = 'pulse_metric_urls' // newline-separated list

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

// Tableau Pulse metric URL, e.g.
// https://us-east-1.online.tableau.com/pulse/site/<site>/metrics/<metricId>
function isValidPulseUrl(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return false
    return /^\/pulse\/site\/[^/]+\/metrics\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

/** Accepts an array or a newline-separated string; returns a clean array. */
function normalizePulseUrls(input) {
  const list = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : []
  return list.map((s) => String(s).trim()).filter(Boolean)
}

async function readSetting(key) {
  const { rows } = await sql`
    SELECT value FROM app_settings WHERE key = ${key} LIMIT 1
  `
  return rows[0]?.value || ''
}

async function writeSetting(key, value, updatedBy) {
  await sql`
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (${key}, ${value}, NOW(), ${updatedBy})
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value,
                  updated_at = EXCLUDED.updated_at,
                  updated_by = EXCLUDED.updated_by
  `
}

async function readConfig() {
  const [url, pulseRaw] = await Promise.all([
    readSetting(KEY_DASHBOARD_URL),
    readSetting(KEY_PULSE_URLS),
  ])
  return { url, pulseUrls: normalizePulseUrls(pulseRaw) }
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readConfig())
    }

    if (req.method === 'POST') {
      const email = (req.body?.email || '').trim().toLowerCase()
      const password = req.body?.password || ''
      const url = (req.body?.url || '').trim()
      const hasPulse = req.body?.pulseUrls !== undefined
      const pulseUrls = normalizePulseUrls(req.body?.pulseUrls)

      if (!email || !password) {
        return res.status(400).json({ error: 'email_and_password_required' })
      }
      if (!isValidDashboardUrl(url)) {
        return res.status(400).json({ error: 'invalid_dashboard_url' })
      }
      if (hasPulse && !pulseUrls.every(isValidPulseUrl)) {
        return res.status(400).json({ error: 'invalid_pulse_url' })
      }

      // Re-authenticate on every write.
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

      await writeSetting(KEY_DASHBOARD_URL, url, user.email)
      if (hasPulse) {
        await writeSetting(KEY_PULSE_URLS, pulseUrls.join('\n'), user.email)
      }

      return res.status(200).json({ ok: true, ...(await readConfig()) })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err) {
    console.error('dashboard-url error', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
