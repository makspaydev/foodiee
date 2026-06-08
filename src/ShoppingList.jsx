import { useEffect, useState } from 'react'
import { ORDERING_ENABLED } from './backend.js'
import InstamartOrder from './InstamartOrder.jsx'

export default function ShoppingList({
  items,
  listCount,
  checked,
  onToggle,
  onCheckAll,
  onClearChecks,
  onClearList,
  onClose,
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const remaining = items.filter((i) => !checked.has(i.key))
  // Only count checks against items currently on the list, so "Uncheck all"
  // never appears because of stale keys left over from removed recipes.
  const checkedCount = items.length - remaining.length

  const clearList = () => {
    if (
      window.confirm(
        'Clear your whole shopping list? This removes every recipe from the list.',
      )
    ) {
      onClearList()
    }
  }

  const copyList = async () => {
    // Copy the still-needed items as a plain bullet list.
    const text = remaining.map((i) => `• ${i.text}`).join('\n')
    try {
      await navigator.clipboard.writeText(text || 'Shopping list is empty')
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal list-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping list"
      >
        <div className="list-head">
          <div>
            <h2 className="list-title">🛒 Shopping List</h2>
            <p className="list-sub">
              {listCount === 0
                ? 'Nothing on your list yet'
                : `Combined from ${listCount} ${listCount === 1 ? 'recipe' : 'recipes'} · ${remaining.length} to buy`}
            </p>
          </div>
          <button className="modal-close list-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="list-empty">
            <span className="empty-emoji">🧺</span>
            <h3>Your list is empty</h3>
            <p>Open a recipe and tap <strong>🛒 Add ingredients to shopping list</strong> (or the cart icon on a recipe card) — its ingredients show up here automatically.</p>
          </div>
        ) : (
          <>
            <ul className="shopping-items">
              {items.map((item) => {
                const isChecked = checked.has(item.key)
                return (
                  <li key={item.key} className={isChecked ? 'is-checked' : ''}>
                    <label className="shopping-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle(item.key)}
                      />
                      <span className="shopping-text">{item.text}</span>
                      {item.count > 1 && (
                        <span className="shopping-count" title={`Used in ${item.count} recipes`}>
                          ×{item.count}
                        </span>
                      )}
                      <span className="shopping-source">{item.sources.join(', ')}</span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="list-actions">
              <button className="btn" onClick={copyList}>
                {copied ? '✓ Copied!' : '📋 Copy list'}
              </button>
              {!ORDERING_ENABLED && (
                <span className="instamart-soon" title="Order directly from Instamart — coming soon">
                  🛒 Order via Instamart
                  <span className="badge-soon">Coming soon</span>
                </span>
              )}
              {remaining.length > 0 && (
                <button
                  className="link-btn"
                  onClick={onCheckAll}
                  title="Tick off every item (mark all as already have)"
                >
                  Select all
                </button>
              )}
              {checkedCount > 0 && (
                <button
                  className="link-btn"
                  onClick={onClearChecks}
                  title="Untick every item (buy all)"
                >
                  Deselect all
                </button>
              )}
              <button className="link-btn link-danger" onClick={clearList}>
                🗑 Clear list
              </button>
            </div>
            {ORDERING_ENABLED ? (
              <InstamartOrder items={remaining.map((i) => i.text)} />
            ) : (
              <p className="list-hint">
                📋 <strong>Copy list</strong> to shop your usual way. One-tap ordering straight
                from <strong>Swiggy Instamart</strong> is on the way — coming soon.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
