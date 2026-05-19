import { useEffect, useState } from 'react'
import './App.css'
import Login from './Login'
import Dashboard from './Dashboard'

const STORAGE_KEY = 'tableau-user-email'

function App() {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null
    const email = window.localStorage.getItem(STORAGE_KEY)
    return email ? { email } : null
  })

  useEffect(() => {
    if (user?.email) {
      window.localStorage.setItem(STORAGE_KEY, user.email)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header-email">{user.email}</span>
        <button
          type="button"
          className="app-header-logout"
          onClick={() => setUser(null)}
        >
          Log out
        </button>
      </header>
      <main className="app-main">
        <Dashboard email={user.email} onSessionLost={() => setUser(null)} />
      </main>
    </div>
  )
}

export default App
