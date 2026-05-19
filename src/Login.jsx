import { useState } from 'react'
import smlLogo from './assets/sml-logo.svg'
import {
  fetchTableauJwt,
  toEmbeddableTableauUrl,
  validateTableauAccess,
} from './tableauAuth'
import './Login.css'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter your username.')
      return
    }

    const jwtEndpoint = import.meta.env.VITE_TABLEAU_JWT_ENDPOINT?.trim()
    const dashboardUrl = import.meta.env.VITE_TABLEAU_DASHBOARD_URL?.trim()
    const embeddableUrl = toEmbeddableTableauUrl(dashboardUrl)

    if (!jwtEndpoint) {
      setError('Login is not configured. Please contact your administrator.')
      return
    }
    if (!embeddableUrl) {
      setError('Dashboard is not configured. Please contact your administrator.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const jwt = await fetchTableauJwt(jwtEndpoint, trimmed)
      await validateTableauAccess(embeddableUrl, jwt)
      onLogin({ email: trimmed })
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
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}

export default Login
