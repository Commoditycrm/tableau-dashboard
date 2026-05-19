import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TABLEAU_EMBED_SCRIPT,
  decodeJwtExpMs,
  fetchTableauJwt,
  toEmbeddableTableauUrl,
} from './tableauAuth'

const REFRESH_LEAD_SECONDS = 30
const FALLBACK_TTL_SECONDS = 9 * 60

function Dashboard({ email, onSessionLost }) {
  const vizContainerRef = useRef(null)
  const dashboardUrl = import.meta.env.VITE_TABLEAU_DASHBOARD_URL?.trim()
  const jwtEndpoint = import.meta.env.VITE_TABLEAU_JWT_ENDPOINT?.trim()
  const embeddableUrl = useMemo(
    () => toEmbeddableTableauUrl(dashboardUrl),
    [dashboardUrl],
  )

  const [jwt, setJwt] = useState(null)

  useEffect(() => {
    if (!jwtEndpoint || !email) return

    let cancelled = false
    let timerId = null

    const load = async () => {
      try {
        const token = await fetchTableauJwt(jwtEndpoint, email)
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
  }, [jwtEndpoint, email, onSessionLost])

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

    const existingScript = document.querySelector(
      `script[src="${TABLEAU_EMBED_SCRIPT}"]`,
    )
    if (existingScript) {
      mountViz()
      return
    }

    const script = document.createElement('script')
    script.src = TABLEAU_EMBED_SCRIPT
    script.type = 'module'
    script.onload = mountViz
    document.head.appendChild(script)
  }, [embeddableUrl, jwt])

  if (!jwt) {
    return <p className="missing-url">Loading dashboard…</p>
  }

  return <div className="tableau-wrapper" ref={vizContainerRef} />
}

export default Dashboard
