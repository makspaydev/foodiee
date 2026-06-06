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
            <h3>🚚 Order the groceries</h3>
            <ol className="hiw-steps hiw-steps-cont">
              <li>
                <strong>Send to Instamart → paste into Claude.</strong> Tap the button to
                copy a ready-to-paste instruction, then paste it into a Claude chat that
                has the <strong>Swiggy Instamart</strong> connector enabled.
              </li>
              <li>
                <strong>Confirm.</strong> Claude searches Instamart, builds the cart, shows
                the bill, and <strong>waits for your “yes”</strong> before placing a
                Cash-on-Delivery order.
              </li>
            </ol>

            <p className="hiw-why">
              Why the hand-off? Swiggy only lets approved apps like Claude place orders, so
              Foodiee prepares the list and Claude does the ordering — with your confirmation.
            </p>
          </section>

          <p className="hiw-note">
            🔒 Foodiee never places orders itself — it only prepares the list. 💡 Tip: batch
            a few recipes together so the delivery fee is spread across a fuller basket.
          </p>
        </div>
      </div>
    </div>
  )
}
