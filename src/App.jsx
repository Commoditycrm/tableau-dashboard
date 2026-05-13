import { useEffect, useMemo, useRef } from 'react'
import './App.css'

const TABLEAU_EMBED_SCRIPT =
  'https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js'

function toEmbeddableTableauUrl(rawUrl) {
  if (!rawUrl) return ''

  try {
    const url = new URL(rawUrl)
    const hash = url.hash.replace(/^#/, '')

    // Converts links like:
    // https://us-east-1.online.tableau.com/#/site/mySite/views/Workbook/View
    // into:
    // https://us-east-1.online.tableau.com/t/mySite/views/Workbook/View?:showVizHome=no
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

function App() {
  const vizContainerRef = useRef(null)
  const dashboardUrl = import.meta.env.VITE_TABLEAU_DASHBOARD_URL?.trim()
  const embeddableUrl = useMemo(
    () => toEmbeddableTableauUrl(dashboardUrl),
    [dashboardUrl],
  )

  useEffect(() => {
    if (!embeddableUrl || !vizContainerRef.current) return

    const mountViz = () => {
      if (!vizContainerRef.current) return
      vizContainerRef.current.innerHTML = ''

      const vizEl = document.createElement('tableau-viz')
      vizEl.setAttribute('src', embeddableUrl)
      vizEl.setAttribute('toolbar', 'hidden')
      vizEl.setAttribute('hide-tabs', '')
      vizEl.setAttribute('hide-edit-button', '')
      vizEl.setAttribute('hide-edit-in-desktop-button', '')
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
  }, [embeddableUrl])

  return (
    <main className="app">
      {embeddableUrl ? (
        <div className="tableau-wrapper" ref={vizContainerRef} />
      ) : (
        <p className="missing-url">
          Set <code>VITE_TABLEAU_DASHBOARD_URL</code> in a <code>.env</code> file
          to embed your Tableau dashboard.
        </p>
      )}
    </main>
  )
}

export default App
