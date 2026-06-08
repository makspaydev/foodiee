import { useEffect, useMemo, useState } from 'react'
import { PANTRY } from './pantryData.js'
import { matchAll } from './pantryMatch.js'

// "My Pantry" — tick what you have, see what you can (almost) cook. The recipe
// suggestions update live as you select; tapping one opens it (gap → Instamart).
export default function Pantry({
  pantry,
  recipes,
  onToggleItem,
  onToggleCategory,
  onClear,
  onOpenRecipe,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Categories with their items filtered by the search query (empty cats drop out).
  const visibleCats = useMemo(
    () =>
      Object.entries(PANTRY)
        .map(([cat, items]) => [cat, q ? items.filter((i) => i.includes(q)) : items])
        .filter(([, items]) => items.length > 0),
    [q],
  )

  const matches = useMemo(() => matchAll(recipes, pantry), [recipes, pantry])
  const cookable = matches.filter((m) => m.missingCount === 0)
  const almost = matches.filter((m) => m.missingCount > 0 && m.missingCount <= 2)
  // Only preview recipes the pantry actually overlaps with, closest first.
  const preview = matches.filter((m) => m.haveCount > 0).slice(0, 8)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal pantry-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="My Pantry"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="pantry-body">
          <h2 className="pantry-title">🥫 My Pantry</h2>
          <p className="pantry-sub">
            Tick what you already have — Foodiee suggests recipes you can (almost) make, and you
            order just the missing bits from Instamart.
          </p>

          <div className="pantry-search-bar">
            <div className="pantry-search">
              <span className="search-icon">🔎</span>
              <input
                type="search"
                placeholder="Search ingredients…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search pantry ingredients"
              />
            </div>
          </div>

          {visibleCats.length === 0 ? (
            <p className="pantry-hint">No ingredients match “{query}”.</p>
          ) : (
            visibleCats.map(([cat, items]) => {
              const selected = items.filter((i) => pantry.has(i)).length
              const allSelected = selected === items.length
              return (
                <section key={cat} className="pantry-cat">
                  <div className="pantry-cat-head">
                    <h3>
                      {cat} <span className="pantry-cat-count">{selected}/{items.length}</span>
                    </h3>
                    <button className="link-btn" onClick={() => onToggleCategory(items)}>
                      {allSelected ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <div className="pantry-chips">
                    {items.map((i) => (
                      <button
                        key={i}
                        className={`pantry-chip${pantry.has(i) ? ' on' : ''}`}
                        onClick={() => onToggleItem(i)}
                        type="button"
                        aria-pressed={pantry.has(i)}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </div>

        <div className="pantry-foot">
          {pantry.size === 0 ? (
            <p className="pantry-hint">Tick a few items above to see what you can cook 👆</p>
          ) : (
            <>
              <p className="pantry-summary">
                <strong>{cookable.length}</strong> ready to cook ·{' '}
                <strong>{almost.length}</strong> need ≤2 items
              </p>
              <div className="pantry-matches">
                {preview.map((m) => (
                  <button
                    key={m.recipe.id}
                    className="pantry-match"
                    onClick={() => onOpenRecipe(m.recipe)}
                    type="button"
                  >
                    <span className="pantry-match-emoji">{m.recipe.emoji}</span>
                    <span className="pantry-match-info">
                      <strong>{m.recipe.title}</strong>
                      <small>
                        have {m.haveCount}/{m.total}
                        {m.missingCount > 0 && ` · need ${m.missing.map((t) => t.canon).join(', ')}`}
                      </small>
                    </span>
                    {m.missingCount === 0 ? (
                      <span className="pantry-badge ok">cook now</span>
                    ) : (
                      <span className="pantry-badge">−{m.missingCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {pantry.size > 0 && (
            <button className="link-btn pantry-clear" onClick={onClear}>
              Clear pantry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
