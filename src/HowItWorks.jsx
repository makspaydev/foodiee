import { useEffect } from 'react'

export default function HowItWorks({ onClose }) {
  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal hiw-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How Foodiee works"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="hiw-body">
          <h2 className="hiw-title">👋 How Foodiee works</h2>
          <p className="hiw-sub">From a recipe to groceries at your door.</p>

          <section className="hiw-section">
            <h3>🛒 Build your shopping list</h3>
            <ol className="hiw-steps">
              <li>
                <strong>Add a recipe.</strong> Tap the <strong>🛒 cart icon</strong> on
                any recipe card, or the <em>“Add ingredients to shopping list”</em>{' '}
                button inside a recipe. (The 🛒 cart is separate from the ❤️ favourite —
                cart = “shopping for it”, heart = “save it”.)
              </li>
              <li>
                <strong>Build a batch.</strong> Add everything you plan to cook — all the
                ingredients combine into one de-duplicated list.
              </li>
              <li>
                <strong>Review.</strong> Open <strong>🛒 List</strong> and tick off any
                pantry staples you already have.
              </li>
            </ol>
          </section>

          <section className="hiw-section">
            <h3>
              🚚 Order the groceries <span className="badge-soon">Coming soon</span>
            </h3>
            <p className="hiw-soon-text">
              One-tap ordering straight from <strong>Swiggy Instamart</strong> is on the way —
              you'll connect your own Swiggy account and check out without leaving Foodiee.
              For now, tap <strong>📋 Copy list</strong> in your shopping list and shop your
              usual way.
            </p>
          </section>

          <p className="hiw-note">
            🔒 Foodiee never places orders for you — when Instamart ordering arrives, you'll
            review the cart and confirm every order yourself.
          </p>
        </div>
      </div>
    </div>
  )
}
