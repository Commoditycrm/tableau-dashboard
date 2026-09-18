export const TABLEAU_EMBED_SCRIPT =
  'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js'

export function toEmbeddableTableauUrl(rawUrl) {
  if (!rawUrl) return ''

  try {
    const url = new URL(rawUrl)
    const hash = url.hash.replace(/^#/, '')

    const match = hash.match(/^\/?site\/([^/]+)\/views\/([^/]+)\/([^/?#]+)/)
    if (match) {
      const [, site, workbook, view] = match
      return `${url.origin}/t/${site}/views/${workbook}/${view}?:showVizHome=no`
    }

    return rawUrl
  } catch {
    return rawUrl
  }
}

export function decodeJwtExpMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export async function verifyCredentials(email, password) {
  let res
  try {
    res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Cannot reach the authentication server. Please try again.')
  }
  if (res.status === 401) {
    throw new Error('Invalid username or password.')
  }
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}). Please try again later.`)
  }
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * Dashboard configuration: the embedded view URL and the list of Tableau
 * Pulse metric URLs shown beneath it. Both are admin-managed in app_settings.
 */
export async function fetchDashboardConfig() {
  let res
  try {
    res = await fetch('/api/dashboard-url', {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new Error('Cannot reach the dashboard service. Please try again.')
  }
  if (!res.ok) {
    throw new Error(`Could not load the dashboard configuration (${res.status}).`)
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Dashboard service returned an invalid response.')
  }
  return {
    url: (data?.url || '').trim(),
    pulseUrls: Array.isArray(data?.pulseUrls)
      ? data.pulseUrls.map((u) => String(u).trim()).filter(Boolean)
      : [],
  }
}

export async function fetchDashboardUrl() {
  const { url } = await fetchDashboardConfig()
  return url
}

export async function saveDashboardConfig({ email, password, url, pulseUrls }) {
  let res
  try {
    res = await fetch('/api/dashboard-url', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, url, pulseUrls }),
    })
  } catch {
    throw new Error('Cannot reach the dashboard service. Please try again.')
  }
  if (res.status === 400) {
    let code = ''
    try {
      code = (await res.json())?.error || ''
    } catch {
      /* ignore */
    }
    if (code === 'invalid_pulse_url') {
      throw new Error(
        'One of the Pulse metric URLs does not look right. Each line must be a Tableau Pulse metric link (…/pulse/site/…/metrics/…).',
      )
    }
    throw new Error('That does not look like a valid Tableau dashboard URL.')
  }
  if (res.status === 401) {
    throw new Error('Your password was incorrect.')
  }
  if (res.status === 403) {
    throw new Error('This account is not allowed to change the dashboard settings.')
  }
  if (!res.ok) {
    throw new Error(`Could not save the dashboard settings (${res.status}).`)
  }
  const data = await res.json()
  return {
    url: (data?.url || '').trim(),
    pulseUrls: Array.isArray(data?.pulseUrls) ? data.pulseUrls : [],
  }
}

export async function saveDashboardUrl({ email, password, url }) {
  const saved = await saveDashboardConfig({ email, password, url })
  return saved.url
}

/** Ends the server-side login session (clears the session cookie). */
export async function logoutSession() {
  try {
    await fetch('/api/logout', { method: 'POST' })
  } catch {
    /* best effort */
  }
}

export async function fetchTableauJwt(endpoint, username) {
  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }), // ignored by the server once SESSION_SECRET is set
    })
  } catch {
    throw new Error('Cannot reach the authentication server. Please try again.')
  }

  if (!res.ok) {
    throw new Error(
      `Authentication service error (${res.status}). Please try again later.`,
    )
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Authentication server returned an invalid response.')
  }

  const token = data?.jwt || data?.token
  if (!token) throw new Error('Authentication server did not return a token.')
  return token
}

async function loadTableauScript() {
  if (!document.querySelector(`script[src="${TABLEAU_EMBED_SCRIPT}"]`)) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = TABLEAU_EMBED_SCRIPT
      script.type = 'module'
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('Failed to load Tableau embedding script'))
      document.head.appendChild(script)
    })
  }
  await customElements.whenDefined('tableau-viz')
}

function friendlyVizError(detail) {
  const raw = detail?.message || detail?.errorMessage || ''
  if (/16\b|unauthor|not found|invalid credentials/i.test(raw)) {
    return 'This username does not have access to the Tableau dashboard. Please check and try again.'
  }
  if (/100\d\d/.test(raw) || /invalid.*jwt|expired.*jwt/i.test(raw)) {
    return 'Authentication with Tableau failed. Please contact your administrator.'
  }
  return raw || 'Unable to load the Tableau dashboard. Please try again.'
}

export async function validateTableauAccess(embeddableUrl, jwt, timeoutMs = 20_000) {
  await loadTableauScript()

  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.width = '800px'
    container.style.height = '600px'
    container.style.opacity = '0'
    container.style.pointerEvents = 'none'
    container.style.zIndex = '-1'
    container.setAttribute('aria-hidden', 'true')
    document.body.appendChild(container)

    const vizEl = document.createElement('tableau-viz')
    vizEl.setAttribute('src', embeddableUrl)
    vizEl.setAttribute('token', jwt)
    vizEl.setAttribute('toolbar', 'hidden')
    vizEl.setAttribute('hide-tabs', '')
    vizEl.style.width = '100%'
    vizEl.style.height = '100%'

    let done = false
    const cleanup = () => {
      try {
        document.body.removeChild(container)
      } catch {
        /* already removed */
      }
    }
    const finish = (fn, payload) => {
      if (done) return
      done = true
      clearTimeout(timer)
      cleanup()
      fn(payload)
    }

    const timer = setTimeout(() => {
      console.warn('[tableauAuth] validation timed out — proceeding optimistically')
      finish(resolve)
    }, timeoutMs)

    const onSuccess = (eventName) => () => {
      console.log(`[tableauAuth] viz ${eventName} — validation passed`)
      finish(resolve)
    }
    const onError = (eventName) => (e) => {
      console.warn(`[tableauAuth] viz ${eventName}`, e?.detail)
      finish(reject, new Error(friendlyVizError(e?.detail)))
    }

    vizEl.addEventListener('firstinteractive', onSuccess('firstinteractive'))
    vizEl.addEventListener('firstvizsizeknown', onSuccess('firstvizsizeknown'))
    vizEl.addEventListener('vizloaderror', onError('vizloaderror'))
    vizEl.addEventListener('vizerror', onError('vizerror'))

    container.appendChild(vizEl)
  })
}
