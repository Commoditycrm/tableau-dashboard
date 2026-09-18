import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TABLEAU_EMBED_SCRIPT,
  decodeJwtExpMs,
  fetchTableauJwt,
  toEmbeddableTableauUrl,
} from './tableauAuth'

const REFRESH_LEAD_SECONDS = 30
const FALLBACK_TTL_SECONDS = 9 * 60
const PULSE_HEIGHT_PX = 900

function loadEmbedScript(onReady) {
  const existing = document.querySelector(`script[src="${TABLEAU_EMBED_SCRIPT}"]`)
  if (existing) {
    onReady()
    return
  }
  const script = document.createElement('script')
  script.src = TABLEAU_EMBED_SCRIPT
  script.type = 'module'
  script.onload = onReady
  document.head.appendChild(script)
}

/**
 * Embeds the customer's Tableau dashboard and, beneath it, any Tableau Pulse
 * metrics configured by the admin. Both use the same short-lived JWT, which is
 * refreshed shortly before expiry.
 */
function Dashboard({ email, dashboardUrl, pulseUrls = [], onSessionLost }) {
  const vizContainerRef = useRef(null)
  const pulseContainerRef = useRef(null)
  const embeddableUrl = useMemo(
    () => toEmbeddableTableauUrl(dashboardUrl),
    [dashboardUrl],
  )
  // Stable key so the Pulse effect only re-runs when the list actually changes.
  const pulseKey = useMemo(() => pulseUrls.join('\n'), [pulseUrls])

  const [jwt, setJwt] = useState(null)
  const hasPulse = pulseUrls.length > 0

  useEffect(() => {
    if (!email) return

    let cancelled = false
    let timerId = null

    const load = async () => {
      try {
        const token = await fetchTableauJwt('/api/tableau-jwt', email)
        if (cancelled) return
        setJwt(token)

        const expMs = decodeJwtExpMs(token)
        const refreshInMs = expMs
          ? Math.max(expMs - Date.now() - REFRESH_LEAD_SECONDS * 1000, 5_000)
          : (FALLBACK_TTL_SECONDS - REFRESH_LEAD_SECONDS) * 1000
        timerId = setTimeout(load, refreshInMs)
      } catch {
        if (cancelled) return
        if (onSessionLost) onSessionLost()
      }
    }

    load()

    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
    }
  }, [email, onSessionLost])

  // Dashboard (tableau-viz)
  useEffect(() => {
    if (!embeddableUrl || !vizContainerRef.current || !jwt) return

    const mountViz = () => {
      if (!vizContainerRef.current) return
      vizContainerRef.current.innerHTML = ''

      const rect = vizContainerRef.current.getBoundingClientRect()
      const vizEl = document.createElement('tableau-viz')
      vizEl.setAttribute('src', embeddableUrl)
      vizEl.setAttribute('token', jwt)
      vizEl.setAttribute('toolbar', 'hidden')
      vizEl.setAttribute('hide-tabs', '')
      vizEl.setAttribute('hide-edit-button', '')
      vizEl.setAttribute('hide-edit-in-desktop-button', '')
      vizEl.setAttribute('device', 'desktop')
      vizEl.setAttribute('width', `${Math.round(rect.width)}px`)
      vizEl.setAttribute('height', `${Math.round(rect.height)}px`)
      vizEl.style.width = '100%'
      vizEl.style.height = '100%'
      vizContainerRef.current.appendChild(vizEl)
    }

    loadEmbedScript(mountViz)
    // hasPulse changes the wrapper's height (single vs stacked layout); the viz
    // is sized from the wrapper at mount, so re-mount when the layout flips.
  }, [embeddableUrl, jwt, hasPulse])

  // Pulse metrics (tableau-pulse), one element per configured metric URL.
  // Requires the JWT to carry the tableau:insights:embed scope.
  useEffect(() => {
    if (!pulseContainerRef.current || !jwt) return
    const urls = pulseKey ? pulseKey.split('\n') : []

    const mountPulse = () => {
      const container = pulseContainerRef.current
      if (!container) return
      container.innerHTML = ''
      for (const url of urls) {
        const card = document.createElement('div')
        card.className = 'pulse-card'
        const pulseEl = document.createElement('tableau-pulse')
        pulseEl.setAttribute('src', url)
        pulseEl.setAttribute('token', jwt)
        pulseEl.setAttribute('width', '100%')
        pulseEl.setAttribute('height', `${PULSE_HEIGHT_PX}px`)
        pulseEl.addEventListener('pulseerror', (e) => {
          console.warn('[pulse] error for', url, e?.detail)
          card.classList.add('pulse-card-error')
        })
        card.appendChild(pulseEl)
        container.appendChild(card)
      }
    }

    if (urls.length === 0) {
      pulseContainerRef.current.innerHTML = ''
      return
    }
    loadEmbedScript(mountPulse)
  }, [pulseKey, jwt])

  if (dashboardUrl === '') {
    return (
      <p className="missing-url">
        Dashboard is not configured. Please contact your administrator.
      </p>
    )
  }

  if (dashboardUrl === null || !jwt) {
    return <p className="missing-url">Loading dashboard…</p>
  }

  return (
    <div className={hasPulse ? 'dashboard-stack' : 'dashboard-single'}>
      <div className="tableau-wrapper" ref={vizContainerRef} />
      <div
        className="pulse-section"
        ref={pulseContainerRef}
        hidden={!hasPulse}
        aria-label="Insights"
      />
    </div>
  )
}

export default Dashboard
