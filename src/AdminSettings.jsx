import { useEffect, useRef, useState } from 'react'
import { fetchDashboardConfig, saveDashboardConfig } from './tableauAuth'
import './AdminSettings.css'

function AdminSettings({ email, onClose, onSaved }) {
  const [url, setUrl] = useState('')
  // One Tableau Pulse metric URL per line.
  const [pulseText, setPulseText] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const closeTimerRef = useRef(null)

  // Cancel a pending auto-close if the modal unmounts first.
  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  useEffect(() => {
    let cancelled = false
    fetchDashboardConfig()
      .then((current) => {
        if (cancelled) return
        setUrl(current.url)
        setPulseText(current.pulseUrls.join('\n'))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the current URL.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Close on Escape (but never mid-save).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Please paste the Tableau dashboard URL.')
      return
    }
    if (!password) {
      setError('Please enter your password to confirm the change.')
      return
    }

    setSaving(true)
    try {
      const pulseUrls = pulseText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      const saved = await saveDashboardConfig({
        email,
        password,
        url: trimmedUrl,
        pulseUrls,
      })
      setUrl(saved.url)
      setPulseText(saved.pulseUrls.join('\n'))
      setPassword('')
      setSaved(true)
      // Push the new config to the live Dashboard so it re-embeds without a refresh.
      if (onSaved) onSaved(saved)
      // Let the success confirmation show briefly, then close automatically.
      closeTimerRef.current = setTimeout(() => onClose(), 900)
    } catch (err) {
      setError(err.message || 'Could not save the dashboard URL.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="admin-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
      >
        <div className="admin-modal-head">
          <span className="admin-head-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          <div className="admin-head-text">
            <h2 id="admin-title">Dashboard settings</h2>
            <p className="admin-head-sub">Change the embedded Tableau dashboard</p>
          </div>
          <button
            type="button"
            className="admin-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="admin-body" onSubmit={handleSave}>
          <div className="admin-field">
            <label htmlFor="admin-url" className="admin-label">
              Tableau dashboard URL
            </label>
            {loading ? (
              <div className="admin-loading">
                <span className="admin-spinner" aria-hidden="true" />
                Loading current URL…
              </div>
            ) : (
              <textarea
                id="admin-url"
                className="admin-input admin-input-mono"
                rows={3}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setSaved(false)
                }}
                disabled={saving}
                spellCheck={false}
                placeholder="https://…/#/site/…/views/Workbook/Dashboard"
              />
            )}
            <span className="admin-help">
              Paste the full view URL copied from Tableau.
            </span>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-pulse" className="admin-label">
              Tableau Pulse metrics (optional)
            </label>
            <textarea
              id="admin-pulse"
              className="admin-input admin-input-mono"
              rows={4}
              value={pulseText}
              onChange={(e) => {
                setPulseText(e.target.value)
                setSaved(false)
              }}
              disabled={loading || saving}
              spellCheck={false}
              placeholder={'https://…/pulse/site/…/metrics/…\nOne metric URL per line'}
            />
            <span className="admin-help">
              Each metric is shown as a Pulse card beneath the dashboard. Leave
              empty to show the dashboard only.
            </span>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-pass" className="admin-label">
              Confirm your password
            </label>
            <input
              id="admin-pass"
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || saving}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <div className="admin-callout">
            <svg
              className="admin-callout-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Changes apply instantly. Users see the new dashboard
              on their next load.
            </span>
          </div>

          {error && (
            <p className="admin-note admin-note-error" role="alert">
              <span className="admin-note-dot" aria-hidden="true" />
              {error}
            </p>
          )}
          {saved && (
            <p className="admin-note admin-note-success" role="status">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved — the dashboard settings are updated.
            </p>
          )}

          <div className="admin-actions">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={loading || saving}
            >
              {saving ? (
                <>
                  <span className="admin-spinner admin-spinner-light" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminSettings
