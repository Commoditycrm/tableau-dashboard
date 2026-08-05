import { useEffect, useState } from 'react'
import { fetchDashboardUrl, saveDashboardUrl } from './tableauAuth'
import './AdminSettings.css'

function AdminSettings({ email, onClose, onSaved }) {
  const [url, setUrl] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDashboardUrl()
      .then((current) => {
        if (!cancelled) setUrl(current)
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
      const savedUrl = await saveDashboardUrl({ email, password, url: trimmedUrl })
      setUrl(savedUrl)
      setPassword('')
      setSaved(true)
      // Push the new URL to the live Dashboard so it re-embeds without a refresh.
      if (onSaved) onSaved(savedUrl)
    } catch (err) {
      setError(err.message || 'Could not save the dashboard URL.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <h2>Dashboard settings</h2>
          <button
            type="button"
            className="admin-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="admin-body" onSubmit={handleSave}>
          <label className="admin-field">
            <span>Tableau dashboard URL</span>
            {loading ? (
              <div className="admin-loading">
                <span className="admin-spinner" aria-hidden="true" />
                Loading current URL…
              </div>
            ) : (
              <textarea
                rows={3}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setSaved(false)
                }}
                disabled={saving}
                placeholder="https://…/#/site/…/views/Workbook/Dashboard"
              />
            )}
          </label>

          <label className="admin-field">
            <span>Confirm your password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || saving}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <p className="admin-hint">
            Changes take effect immediately — users see the new dashboard the next
            time they log in or reload. No redeploy needed.
          </p>

          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="admin-success" role="status">
              Saved. The dashboard URL is updated.
            </p>
          )}

          <div className="admin-actions">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={loading || saving}
            >
              {saving ? 'Saving…' : 'Save URL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminSettings
