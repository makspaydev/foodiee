import { useEffect, useRef, useState } from 'react'
import { track } from './analytics.js'
import { ORDERING_ENABLED, importReel } from './backend.js'

// Map backend error codes to friendly, actionable copy.
function friendlyError(code) {
  switch (code) {
    case 'caption_unavailable':
      return "Couldn't read that reel — it may be private or have no caption. Try a public recipe reel."
    case 'not_a_recipe':
      return "That reel doesn't look like a cooking recipe. Try one that lists ingredients and steps."
    case 'gemini_not_configured':
    case 'not_connected':
      return 'Recipe import isn\'t available right now. Please try again later.'
    default:
      return "Hmm, that didn't work. Please try again in a moment."
  }
}

// Matches an Instagram reel / post / tv / reels link anywhere inside arbitrary
// shared text (Instagram often shares a caption + link blob, not a bare URL).
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[\w-]+\/?/i

// Pull the first Instagram URL out of arbitrary shared text. Exported so the
// share-target handler in App can reuse the exact same extraction.
export function extractInstagramUrl(text = '') {
  const m = String(text).match(IG_RE)
  return m ? m[0] : ''
}

// Entry-point screen for the "share a reel → Foodiee recipe" feature.
// Part 1 (this): capture the link (via Android share target or manual paste)
// and confirm it. Turning the reel into a recipe + Instamart cart is Part 2.
export default function ImportRecipe({ initialUrl = '', fromShare = false, onImported, onClose }) {
  const [value, setValue] = useState(initialUrl)
  const [caption, setCaption] = useState('')
  const [showCaption, setShowCaption] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Focus the input on open unless we already captured a shared link.
    if (!initialUrl) inputRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, initialUrl])

  const igUrl = extractInstagramUrl(value)

  const submit = async (e) => {
    e?.preventDefault()
    const url = extractInstagramUrl(value)
    if (!url) {
      setError(
        "That doesn't look like an Instagram reel link. Paste something like instagram.com/reel/…",
      )
      return
    }
    setError('')
    track('reel_import_submitted', { source: fromShare ? 'share' : 'paste' })

    // No backend configured → keep the lightweight "saved, coming soon" path.
    if (!ORDERING_ENABLED || !onImported) {
      setSaved(true)
      return
    }

    // If we're in caption-paste mode, require a usable caption.
    const pastedCaption = showCaption ? caption.trim() : ''
    if (showCaption && pastedCaption.length < 15) {
      setError('Please paste a bit more of the caption (the ingredients & steps).')
      return
    }

    // Backend available → actually extract the recipe via Gemini.
    setBusy(true)
    try {
      const { recipe } = await importReel(url, pastedCaption || undefined)
      track('reel_import_succeeded', {
        recipe_id: recipe.id,
        via: pastedCaption ? 'caption' : 'link',
      })
      onImported(recipe) // App registers the recipe and opens it for review
    } catch (err) {
      track('reel_import_failed', { reason: err.message })
      // If the link couldn't be read, offer the manual caption fallback.
      if (err.message === 'caption_unavailable' && !showCaption) {
        setShowCaption(true)
        setError(
          "Couldn't read that reel automatically (Instagram may be hiding it). Paste the reel's caption below and I'll do the rest.",
        )
      } else {
        setError(friendlyError(err.message))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal import-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Import a recipe from Instagram"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {saved ? (
          <div className="import-body import-done">
            <span className="import-emoji">🎬→🍳</span>
            <h2 className="import-title">Reel saved!</h2>
            <p className="import-sub">
              Got it — Foodiee has your reel. Auto-magically turning reels into a full recipe
              and a one-tap <strong>Swiggy Instamart</strong> shopping list is{' '}
              <span className="badge-soon">Coming soon</span>. You're on the early list. 🎉
            </p>
            {igUrl && (
              <a
                className="import-reel-link"
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ View the reel
              </a>
            )}
            <button className="btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="import-body">
            <span className="import-emoji">🎬→🍳</span>
            <h2 className="import-title">Import a recipe from a reel</h2>
            <p className="import-sub">
              Spotted a tasty recipe reel on Instagram? Drop the link here and Foodiee will
              turn it into a recipe — with a one-tap Instamart shopping list.
            </p>

            {fromShare && igUrl && (
              <p className="import-shared">📥 Shared from Instagram — link captured below.</p>
            )}

            <form onSubmit={submit} className="import-form">
              <input
                ref={inputRef}
                className="import-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.instagram.com/reel/…"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setError('')
                }}
              />
              {showCaption && (
                <textarea
                  className="import-input import-caption"
                  placeholder="Paste the reel's caption here — the ingredients and steps…"
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value)
                    setError('')
                  }}
                  rows={5}
                />
              )}
              {error && <p className="import-error">⚠️ {error}</p>}
              <button
                className="btn btn-instamart"
                type="submit"
                disabled={!igUrl || busy || (showCaption && caption.trim().length < 15)}
              >
                {busy
                  ? '🍳 Cooking up your recipe…'
                  : showCaption
                    ? '✨ Create recipe from caption'
                    : '✨ Turn this reel into a recipe'}
              </button>
            </form>

            <details className="import-help">
              <summary>📱 On your phone? Share straight to Foodiee</summary>
              <div className="import-help-body">
                <p>
                  <strong>Android:</strong> install Foodiee to your home screen, then in
                  Instagram tap <strong>Share → Foodiee</strong>. The link lands here
                  automatically.
                </p>
                <p>
                  <strong>iPhone:</strong> in Instagram tap <strong>Share → Copy link</strong>,
                  come back to Foodiee and paste it above. (iOS doesn't yet let apps appear in
                  Instagram's share sheet.)
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
