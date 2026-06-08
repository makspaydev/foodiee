import { useEffect, useState } from 'react'
import { api, connectUrl } from './backend.js'
import { track } from './analytics.js'

// Real Instamart ordering panel (shown only when the backend is configured).
// Connect → pick address → build cart from the list → review → confirm (COD).
export default function InstamartOrder({ items }) {
  const [status, setStatus] = useState('loading') // loading | connected | disconnected
  const [addresses, setAddresses] = useState([])
  const [addressId, setAddressId] = useState('')
  const [cart, setCart] = useState(null)
  const [skipped, setSkipped] = useState([])
  const [busy, setBusy] = useState('')
  const [placed, setPlaced] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/status')
      .then((s) => setStatus(s.connected ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'))
  }, [])

  // Load addresses once connected.
  useEffect(() => {
    if (status !== 'connected') return
    api('/api/addresses')
      .then((d) => {
        const list = d.addresses || []
        setAddresses(list)
        if (list[0]) setAddressId(list[0].id)
      })
      .catch((e) => setError(String(e.message)))
  }, [status])

  const buildCart = async () => {
    setError('')
    setBusy('build')
    try {
      const r = await api('/api/build-cart', {
        method: 'POST',
        body: JSON.stringify({ addressId, items }),
      })
      setCart(r.cart)
      setSkipped(r.skipped || [])
      track('instamart_cart_built', { items: (r.picked || []).length })
    } catch (e) {
      setError(String(e.message))
    } finally {
      setBusy('')
    }
  }

  const placeOrder = async () => {
    if (!window.confirm('Place this Cash-on-Delivery order on Swiggy Instamart? Orders cannot be cancelled.')) return
    setError('')
    setBusy('order')
    try {
      const r = await api('/api/order', { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setPlaced(r)
      track('instamart_order_placed', {})
    } catch (e) {
      setError(String(e.message))
    } finally {
      setBusy('')
    }
  }

  const disconnect = async () => {
    await api('/auth/swiggy/disconnect', { method: 'POST' }).catch(() => {})
    setStatus('disconnected')
    setCart(null)
  }

  if (status === 'loading') return <p className="im-note">Checking Instamart…</p>

  if (status === 'disconnected') {
    return (
      <div className="im-panel">
        <button className="btn btn-instamart" onClick={() => (window.location.href = connectUrl())}>
          🛒 Order on Instamart — Connect Swiggy
        </button>
        <p className="im-note">
          You'll sign in on Swiggy's own page. Foodiee never sees your password or OTP.
        </p>
      </div>
    )
  }

  const total = cart?.billBreakdown?.toPay?.value || cart?.cartTotalAmount
  const cartItems = cart?.items || []

  return (
    <div className="im-panel">
      {placed ? (
        <p className="im-success">✅ Order placed on Instamart! Check the Swiggy app for tracking.</p>
      ) : (
        <>
          <div className="im-row">
            <label className="im-label">Deliver to</label>
            <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className="im-select">
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.addressTag || a.addressCategory || 'Address'} — {(a.addressLine || '').slice(0, 40)}…
                </option>
              ))}
            </select>
          </div>

          {!cart ? (
            <button className="btn btn-instamart" onClick={buildCart} disabled={busy === 'build' || !addressId}>
              {busy === 'build' ? 'Building your cart…' : '🛒 Build my Instamart cart'}
            </button>
          ) : (
            <div className="im-cart">
              <ul className="im-cart-items">
                {cartItems.map((it, i) => (
                  <li key={i}>
                    <span>{it.itemName}</span>
                    <span>₹{it.discountedFinalPrice ?? it.mrp}</span>
                  </li>
                ))}
              </ul>
              <div className="im-total">
                <strong>To pay (COD)</strong>
                <strong>{total}</strong>
              </div>
              {skipped.length > 0 && (
                <p className="im-note">Skipped (likely pantry/equipment): {skipped.join(', ')}</p>
              )}
              <button className="btn btn-instamart" onClick={placeOrder} disabled={busy === 'order'}>
                {busy === 'order' ? 'Placing…' : '✅ Place order (COD)'}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="im-error">⚠️ {error}</p>}
      <button className="link-btn im-disconnect" onClick={disconnect}>
        Disconnect Swiggy
      </button>
    </div>
  )
}
