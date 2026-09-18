// Signed login session carried in an HttpOnly cookie.
//
// Why: /api/tableau-jwt mints a Tableau token for a username. That username
// must come from a login the *server* has verified, not from the request body,
// otherwise anyone who can reach the endpoint can obtain a token for any user.
//
// The cookie is an HMAC-SHA256 signed payload { email, exp }. Signing requires
// the SESSION_SECRET environment variable. Until that variable is configured
// in Vercel, isSessionEnabled() is false and callers fall back to the legacy
// behaviour (with a server-side warning) so the app keeps working.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'tdash_session'
const SESSION_TTL_SECONDS = 12 * 60 * 60

function secret() {
  return (process.env.SESSION_SECRET || '').trim()
}

export function isSessionEnabled() {
  return secret().length >= 16
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

function sign(payloadB64) {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

export function createSessionToken(email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payloadB64 = b64url(JSON.stringify({ email, exp }))
  return `${payloadB64}.${sign(payloadB64)}`
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payloadB64)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    if (!payload?.email || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return { email: String(payload.email).trim().toLowerCase(), exp: payload.exp }
  } catch {
    return null
  }
}

export function readSessionCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function sessionCookieHeader(token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/** Returns the verified session { email, exp } or null. */
export function getSession(req) {
  if (!isSessionEnabled()) return null
  return verifySessionToken(readSessionCookie(req))
}
