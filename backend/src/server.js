// Foodiee ordering backend (SCAFFOLD).
// Flow: browser -> /auth/swiggy/start -> Swiggy login -> /auth/swiggy/callback
//       -> token stored per browser -> /api/* proxies to the Instamart MCP.
// Orders are NEVER placed without an explicit { confirm: true } from the client.
import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import { makePkce, randomState, authorizeUrl, exchangeCode } from './oauth.js'
import { tokenStore, pendingAuth } from './store.js'
import { instamart } from './mcp.js'

const {
  PORT = 8787,
  REDIRECT_URI = 'http://localhost:8787/auth/swiggy/callback',
  SWIGGY_CLIENT_ID = '',
  APP_ORIGIN = 'http://localhost:5173',
} = process.env

const app = express()
app.use(express.json())
app.use(cookieParser())

// CORS for the frontend (credentials so the uid cookie is sent).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', APP_ORIGIN)
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Give every browser a stable id (scaffold; production should use signed/secure sessions).
function uid(req, res) {
  let id = req.cookies?.foodiee_uid
  if (!id) {
    id = crypto.randomUUID()
    res.cookie('foodiee_uid', id, { httpOnly: true, sameSite: 'lax', maxAge: 6 * 86400e3 })
  }
  return id
}

function requireToken(req, res) {
  const t = tokenStore.load(uid(req, res))
  if (!t) {
    res.status(401).json({ error: 'not_connected' })
    return null
  }
  return t.accessToken
}

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(502).json({ error: e.message }))

// ---- OAuth ----
app.get('/auth/swiggy/start', (req, res) => {
  if (!SWIGGY_CLIENT_ID) return res.status(500).send('Set SWIGGY_CLIENT_ID (run `npm run register`).')
  const id = uid(req, res)
  const { verifier, challenge } = makePkce()
  const state = randomState()
  pendingAuth.put(state, { verifier, uid: id })
  res.redirect(authorizeUrl({ clientId: SWIGGY_CLIENT_ID, redirectUri: REDIRECT_URI, challenge, state }))
})

app.get('/auth/swiggy/callback', wrap(async (req, res) => {
  const { code, state, error } = req.query
  if (error) return res.redirect(`${APP_ORIGIN}/?swiggy=error`)
  const pending = pendingAuth.take(String(state))
  if (!code || !pending) return res.redirect(`${APP_ORIGIN}/?swiggy=expired`)
  const token = await exchangeCode({
    clientId: SWIGGY_CLIENT_ID,
    code: String(code),
    verifier: pending.verifier,
    redirectUri: REDIRECT_URI,
  })
  tokenStore.save(pending.uid, token)
  res.redirect(`${APP_ORIGIN}/?swiggy=connected`)
}))

app.post('/auth/swiggy/disconnect', (req, res) => {
  tokenStore.remove(uid(req, res))
  res.json({ ok: true })
})

app.get('/api/status', (req, res) => res.json({ connected: tokenStore.isConnected(uid(req, res)) }))

// ---- Instamart proxy (per-user, via MCP) ----
app.get('/api/addresses', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (token) res.json(await instamart.getAddresses(token))
}))

app.get('/api/search', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (token) res.json(await instamart.searchProducts(token, { addressId: req.query.addressId, query: req.query.q }))
}))

app.get('/api/cart', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (token) res.json(await instamart.getCart(token))
}))

app.post('/api/cart', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (token) res.json(await instamart.updateCart(token, req.body))
}))

app.post('/api/cart/clear', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (token) res.json(await instamart.clearCart(token))
}))

// Turn an ingredient line into a search query (drop quantities/units/notes).
function toQuery(text) {
  return String(text)
    .split(',')[0]
    .replace(/\([^)]*\)/g, '')
    .replace(/^[\d.\/¼½¾\s-]+/, '')
    .replace(/\b(g|kg|ml|l|tbsp|tsp|cups?|cloves?|large|small|thick|slices?|pieces?|x|each|to serve|of)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstInStock(searchResult) {
  for (const p of searchResult?.products || []) {
    const v = (p.variations || []).find((x) => x.isInStockAndAvailable)
    if (v) return { spinId: v.spinId, name: p.displayName, qty: v.quantityDescription, price: v.price?.offerPrice }
  }
  return null
}

// Build a cart from a list of ingredient strings: search each, add the top match.
app.post('/api/build-cart', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (!token) return
  const { addressId, items = [] } = req.body
  if (!addressId) return res.status(400).json({ error: 'addressId required' })
  const picked = []
  const skipped = []
  for (const text of items.slice(0, 15)) {
    const query = toQuery(text)
    if (query.length < 2) { skipped.push(text); continue }
    try {
      const match = firstInStock(await instamart.searchProducts(token, { addressId, query }))
      if (match) picked.push({ ...match, from: text })
      else skipped.push(text)
    } catch {
      skipped.push(text)
    }
  }
  if (picked.length) {
    await instamart.updateCart(token, {
      selectedAddressId: addressId,
      items: picked.map((p) => ({ spinId: p.spinId, quantity: 1 })),
    })
  }
  const cart = await instamart.getCart(token)
  res.json({ picked, skipped, cart })
}))

// Order placement — requires explicit confirmation. COD only.
app.post('/api/order', wrap(async (req, res) => {
  const token = requireToken(req, res)
  if (!token) return
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'confirmation_required' })
  res.json(await instamart.placeOrder(token, req.body.order || {}))
}))

app.listen(PORT, () => console.log(`Foodiee backend on :${PORT} (redirect ${REDIRECT_URI})`))
