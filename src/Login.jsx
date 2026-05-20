import { useState } from 'react'
import smlLogo from './assets/sml-logo.svg'
import {
  fetchTableauJwt,
  toEmbeddableTableauUrl,
  validateTableauAccess,
  verifyCredentials,
} from './tableauAuth'
import './Login.css'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please enter your username and password.')
      return
    }

    const dashboardUrl = import.meta.env.VITE_TABLEAU_DASHBOARD_URL?.trim()
    const embeddableUrl = toEmbeddableTableauUrl(dashboardUrl)

    if (!embeddableUrl) {
      setError('Dashboard is not configured. Please contact your administrator.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await verifyCredentials(trimmedEmail, password)
      const jwt = await fetchTableauJwt('/api/tableau-jwt', trimmedEmail)
      await validateTableauAccess(embeddableUrl, jwt)
      onLogin({ email: trimmedEmail })
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={smlLogo} alt="SML" className="login-logo" />
        <label>
          <span>Username</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            disabled={loading}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}

export default Login
