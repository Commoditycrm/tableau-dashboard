import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Login from './Login'
import Dashboard from './Dashboard'
import AdminSettings from './AdminSettings'
import { fetchDashboardConfig, logoutSession } from './tableauAuth'

const STORAGE_KEY = 'tableau-user-email'
const ADMIN_STORAGE_KEY = 'tableau-user-is-admin'

function App() {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null
    const email = window.localStorage.getItem(STORAGE_KEY)
    if (!email) return null
    return {
      email,
      isAdmin: window.localStorage.getItem(ADMIN_STORAGE_KEY) === 'true',
    }
  })
  const [showSettings, setShowSettings] = useState(false)
  // Single source of truth for the dashboard URL: null = loading, '' = not
  // configured, otherwise the URL. Kept here so an admin save can update the
  // live Dashboard without a page refresh.
  const [dashboardUrl, setDashboardUrl] = useState(null)
  // Tableau Pulse metric URLs shown beneath the dashboard (admin-managed).
  const [pulseUrls, setPulseUrls] = useState([])

  // Stable reference so opening the settings modal (an App re-render) does not
  // re-run Dashboard's JWT effect and reload the Tableau viz.
  const handleSessionLost = useCallback(() => setUser(null), [])

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetchDashboardConfig()
      .then((config) => {
        if (cancelled) return
        setDashboardUrl(config.url)
        setPulseUrls(config.pulseUrls)
      })
      .catch(() => {
        if (!cancelled) setDashboardUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [user?.email])

  useEffect(() => {
    if (user?.email) {
      window.localStorage.setItem(STORAGE_KEY, user.email)
      window.localStorage.setItem(ADMIN_STORAGE_KEY, user.isAdmin ? 'true' : 'false')
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(ADMIN_STORAGE_KEY)
    }
  }, [user])

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header-email">{user.email}</span>
        {user.isAdmin && (
          <button
            type="button"
            className="app-header-settings"
            onClick={() => setShowSettings(true)}
          >
            Dashboard settings
          </button>
        )}
        <button
          type="button"
          className="app-header-logout"
          onClick={() => {
            logoutSession()
            setUser(null)
          }}
        >
          Log out
        </button>
      </header>
      <main className="app-main">
        <Dashboard
          email={user.email}
          dashboardUrl={dashboardUrl}
          pulseUrls={pulseUrls}
          onSessionLost={handleSessionLost}
        />
      </main>
      {user.isAdmin && showSettings && (
        <AdminSettings
          email={user.email}
          onClose={() => setShowSettings(false)}
          onSaved={(config) => {
            setDashboardUrl(config.url)
            setPulseUrls(config.pulseUrls)
          }}
        />
      )}
    </div>
  )
}

export default App
