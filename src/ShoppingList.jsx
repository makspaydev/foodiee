import { useEffect, useState } from 'react'

export default function ShoppingList({
  items,
  listCount,
  checked,
  onToggle,
  onClearChecks,
  onClearList,
  onClose,
}) {
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

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

  // Build a paste-ready instruction for Claude + the Swiggy Instamart MCP connector.
  // Foodiee only prepares the text — you review and place the order yourself in Claude.
  const sendToInstamart = async () => {
    const lines = remaining.map((i) => `• ${i.text}`).join('\n')
    const prompt =
      'Using the Swiggy Instamart connector, add these items to my cart. ' +
      'Pick the closest matching product for each, then show me the full cart ' +
      'with quantities and total and WAIT for my confirmation before checkout (COD).\n\n' +
      `Shopping list:\n${lines}`
    try {
      await navigator.clipboard.writeText(prompt)
      setSent(true)
      setTimeout(() => setSent(false), 2200)
    } catch {
      setSent(false)
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
              <button className="btn btn-instamart" onClick={sendToInstamart} disabled={remaining.length === 0}>
                {sent ? '✓ Copied — paste into Claude' : '🛒 Send to Instamart'}
              </button>
              <button className="btn btn-ghost" onClick={copyList}>
                {copied ? '✓ Copied!' : '📋 Copy list'}
              </button>
              {checkedCount > 0 && (
                <button className="link-btn" onClick={onClearChecks}>
                  Uncheck all
                </button>
              )}
              <button className="link-btn link-danger" onClick={clearList}>
                🗑 Clear list
              </button>
            </div>
            <p className="list-hint">
              “Send to Instamart” copies a ready-to-paste instruction. Paste it into Claude
              with the <strong>Swiggy Instamart</strong> connector enabled — it builds the cart
              and waits for you to confirm before ordering. Foodiee never places orders itself.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
