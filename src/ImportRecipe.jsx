import { useEffect, useRef, useState } from 'react'
import { track } from './analytics.js'
import { ORDERING_ENABLED, importReel, importScreenshots, recipeFromDish } from './backend.js'

// Matches an Instagram reel / post / tv link inside arbitrary shared text.
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[\w-]+\/?/i

export function extractInstagramUrl(text = '') {
  const m = String(text).match(IG_RE)
  return m ? m[0] : ''
}

function friendlyError(code) {
  switch (code) {
    case 'caption_unavailable':
      return "Couldn't read that reel — Instagram hides it from links. Paste the caption or upload a screenshot instead."
    case 'not_a_recipe':
    case 'not_food':
      return "Couldn't find a recipe in that. Try a screenshot showing the ingredients."
    case 'no_images':
      return 'Please add at least one screenshot.'
    case 'gemini_not_configured':
      return "Recipe import isn't available right now. Please try again later."
    default:
      return "Hmm, that didn't work. Please try again in a moment."
  }
}

// Downscale + JPEG-compress a screenshot in the browser so uploads stay small
// and fast (a 3 MB PNG → ~200–400 KB JPEG) without losing on-screen text.
async function fileToCompressed(file, maxDim = 1280, quality = 0.85) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl: out, data: out.split(',')[1], mimeType: 'image/jpeg' }
}

const METHODS = [
  { key: 'screenshot', label: '📸 Screenshot' },
  { key: 'caption', label: '📝 Caption' },
  { key: 'link', label: '🔗 Link' },
]

export default function ImportRecipe({ initialUrl = '', fromShare = false, onImported, onClose }) {
  const [method, setMethod] = useState(initialUrl ? 'link' : 'screenshot')
  const [value, setValue] = useState(initialUrl) // link
  const [caption, setCaption] = useState('') // caption
  const [shots, setShots] = useState([]) // [{dataUrl, data, mimeType}]
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [recognized, setRecognized] = useState(null) // dish recognized, no ingredients
  const fileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const igUrl = extractInstagramUrl(value)
  const switchMethod = (m) => {
    setMethod(m)
    setError('')
    setNote('')
  }

  // No backend → keep the lightweight "saved, coming soon" path.
  const comingSoon = () => {
    setSaved(true)
    return true
  }

  const handleResult = (recipe, via) => {
    if (recipe.hasIngredients === false || !recipe.ingredients?.length) {
      // Dish recognized but no ingredient list visible → offer a standard recipe.
      if (recipe.isRecipe && recipe.title) {
        setRecognized(recipe)
        track('reel_dish_recognized', { title: recipe.title, via })
        return
      }
      setError("Couldn't find a recipe in that. Try a frame showing the ingredients.")
      return
    }
    track('reel_import_succeeded', { recipe_id: recipe.id, via })
    onImported(recipe)
  }

  // ---- Screenshot method ----
  const addFiles = async (fileList) => {
    setError('')
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, 5 - shots.length)
    if (!files.length) return
    try {
      const compressed = await Promise.all(files.map((f) => fileToCompressed(f)))
      setShots((prev) => [...prev, ...compressed].slice(0, 5))
    } catch {
      setError("Couldn't read that image. Try a PNG or JPG screenshot.")
    }
  }

  const submitScreenshots = async () => {
    if (!shots.length) return setError('Add at least one screenshot.')
    track('reel_import_submitted', { source: 'screenshot', count: shots.length })
    if (!ORDERING_ENABLED || !onImported) return comingSoon()
    setBusy('shot')
    setError('')
    try {
      const { recipe } = await importScreenshots(shots.map((s) => ({ data: s.data, mimeType: s.mimeType })))
      handleResult(recipe, 'screenshot')
    } catch (err) {
      track('reel_import_failed', { reason: err.message, via: 'screenshot' })
      setError(friendlyError(err.message))
    } finally {
      setBusy('')
    }
  }

  // ---- Caption method ----
  const submitCaption = async () => {
    const text = caption.trim()
    if (text.length < 15) return setError('Paste a bit more of the caption (ingredients & steps).')
    track('reel_import_submitted', { source: 'caption' })
    if (!ORDERING_ENABLED || !onImported) return comingSoon()
    setBusy('caption')
    setError('')
    try {
      const { recipe } = await importReel(igUrl || '', text)
      handleResult(recipe, 'caption')
    } catch (err) {
      track('reel_import_failed', { reason: err.message, via: 'caption' })
      setError(friendlyError(err.message))
    } finally {
      setBusy('')
    }
  }

  // ---- Link method ----
  const submitLink = async () => {
    const url = extractInstagramUrl(value)
    if (!url) return setError("That doesn't look like an Instagram link. Paste an instagram.com/reel/… link.")
    track('reel_import_submitted', { source: fromShare ? 'share' : 'paste' })
    if (!ORDERING_ENABLED || !onImported) return comingSoon()
    setBusy('link')
    setError('')
    try {
      const { recipe } = await importReel(url)
      handleResult(recipe, 'link')
    } catch (err) {
      track('reel_import_failed', { reason: err.message, via: 'link' })
      if (err.message === 'caption_unavailable') {
        // Funnel into the methods that actually work.
        setNote("Instagram wouldn't share this reel's text. Paste the caption, or snap a screenshot 👇")
        switchMethod('caption')
      } else {
        setError(friendlyError(err.message))
      }
    } finally {
      setBusy('')
    }
  }

  // ---- Dish recognition → standard recipe ----
  const generateFromDish = async () => {
    setBusy('dish')
    setError('')
    try {
      const { recipe } = await recipeFromDish(recognized.title)
      track('reel_dish_generated', { title: recognized.title })
      onImported(recipe)
    } catch (err) {
      setError(friendlyError(err.message))
    } finally {
      setBusy('')
    }
  }

  const anyBusy = !!busy

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal import-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Import a recipe from a reel"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {saved ? (
          <div className="import-body import-done">
            <span className="import-emoji">🎬→🍳</span>
            <h2 className="import-title">Saved!</h2>
            <p className="import-sub">
              Turning reels into recipes + a one-tap <strong>Swiggy Instamart</strong> list is{' '}
              <span className="badge-soon">Coming soon</span>. You're on the early list. 🎉
            </p>
            <button className="btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : recognized ? (
          <div className="import-body import-recognized">
            <span className="import-emoji">{recognized.emoji || '🍽'}</span>
            <h2 className="import-title">We recognised {recognized.title}!</h2>
            <p className="import-sub">
              {recognized.note ||
                'Only the finished dish was visible — no ingredient list in those frames.'}{' '}
              Want a <strong>standard {recognized.title}</strong> recipe &amp; shopping list?
            </p>
            {error && <p className="import-error">⚠️ {error}</p>}
            <button
              className="btn btn-instamart"
              onClick={generateFromDish}
              disabled={anyBusy}
            >
              {busy === 'dish' ? '🍳 Building the recipe…' : `✨ Generate ${recognized.title} recipe`}
            </button>
            <button
              className="link-btn"
              onClick={() => {
                setRecognized(null)
                setShots([])
                switchMethod('screenshot')
              }}
            >
              ← Upload a screenshot that shows the ingredients
            </button>
          </div>
        ) : (
          <div className="import-body">
            <span className="import-emoji">🎬→🍳</span>
            <h2 className="import-title">Import a recipe from a reel</h2>
            <p className="import-sub">
              Found a tasty recipe reel? Bring it into Foodiee — and get a one-tap Instamart list.
            </p>

            <div className="import-tabs" role="tablist">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={method === m.key}
                  className={`import-tab${method === m.key ? ' is-active' : ''}`}
                  onClick={() => switchMethod(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {note && <p className="import-shared">{note}</p>}

            {method === 'screenshot' && (
              <div className="import-pane">
                <p className="import-hint">
                  Snap the frame(s) that show the <strong>ingredients</strong> (or just the dish) and
                  upload them. We read the on-screen text.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />
                {shots.length > 0 && (
                  <div className="shot-grid">
                    {shots.map((s, i) => (
                      <div key={i} className="shot-thumb">
                        <img src={s.dataUrl} alt={`screenshot ${i + 1}`} />
                        <button
                          className="shot-remove"
                          onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="import-drop" onClick={() => fileRef.current?.click()}>
                  {shots.length ? '＋ Add another screenshot' : '📸 Choose screenshots'}
                </button>
                {error && <p className="import-error">⚠️ {error}</p>}
                <button
                  className="btn btn-instamart"
                  onClick={submitScreenshots}
                  disabled={!shots.length || anyBusy}
                >
                  {busy === 'shot' ? '🍳 Reading your screenshots…' : '✨ Build recipe from screenshots'}
                </button>
              </div>
            )}

            {method === 'caption' && (
              <div className="import-pane">
                <p className="import-hint">
                  For reels where the recipe is written in the caption — paste it all (ingredients &amp;
                  steps).
                </p>
                <textarea
                  className="import-input import-caption"
                  placeholder="Paste the reel's caption here…"
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value)
                    setError('')
                  }}
                  rows={6}
                />
                {error && <p className="import-error">⚠️ {error}</p>}
                <button
                  className="btn btn-instamart"
                  onClick={submitCaption}
                  disabled={caption.trim().length < 15 || anyBusy}
                >
                  {busy === 'caption' ? '🍳 Cooking up your recipe…' : '✨ Create recipe from caption'}
                </button>
              </div>
            )}

            {method === 'link' && (
              <div className="import-pane">
                <p className="import-hint">
                  Paste a reel link. Heads up: Instagram often hides the text from links — if so, we'll
                  switch you to Screenshot or Caption.
                </p>
                <input
                  className="import-input"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.instagram.com/reel/…"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    setError('')
                  }}
                />
                {error && <p className="import-error">⚠️ {error}</p>}
                <button
                  className="btn btn-instamart"
                  onClick={submitLink}
                  disabled={!igUrl || anyBusy}
                >
                  {busy === 'link' ? '🍳 Reading the reel…' : '✨ Turn this reel into a recipe'}
                </button>
              </div>
            )}

            <details className="import-help">
              <summary>📱 On your phone?</summary>
              <div className="import-help-body">
                <p>
                  <strong>Screenshot</strong> the reel frames with the recipe, then upload them here —
                  works on any phone.
                </p>
                <p>
                  <strong>Android:</strong> you can also share a reel link straight to Foodiee from
                  Instagram.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
