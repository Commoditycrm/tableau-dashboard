// Shared CORS handling for the API routes.
//
// The browser app is served from the same origin as these functions, so a
// same-origin fetch never needs CORS headers at all. We only echo an
// Access-Control-Allow-Origin for origins we trust (this deployment, any
// Vercel preview of this project, and local development) — never "*".

function isAllowedOrigin(origin, host) {
  if (!origin) return false
  try {
    const url = new URL(origin)
    if (host && url.host === host) return true
    if (url.hostname.endsWith('.vercel.app')) return true
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

/**
 * Apply CORS headers. Returns true when the request was a preflight that has
 * been fully answered (caller should return immediately).
 */
export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers.origin
  const host = req.headers.host
  if (isAllowedOrigin(origin, host)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
