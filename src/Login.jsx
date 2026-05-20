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
  const [showPassword, setShowPassword] = useState(false)
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
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <img src={smlLogo} alt="SMART Logistics" className="login-card-logo" />

          <label className="login-field">
            <span>Username</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={loading}
              placeholder="you@company.com"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.74 19.74 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.62 19.62 0 0 1-3.17 4.19" />
                    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="login-error" role="alert">
              <span className="login-error-dot" aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>

          <p className="login-footnote">
            Trouble signing in? Contact your administrator.
          </p>
        </form>
      </section>
    </main>
  )
}

export default Login
