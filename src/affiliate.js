// Amazon Associates affiliate config.
// ------------------------------------
// To go live: (1) set AMAZON_TAG to your real Associates tag, (2) paste the two
// amazon.in product URLs below, (3) flip AFFILIATE_ENABLED to true. That's it —
// the contextual "Get it on Amazon" links and the footer "Our appliances"
// section will appear automatically.

export const AFFILIATE_ENABLED = false // ← flip to true once tag + URLs are set

export const AMAZON_TAG = 'foodiee-21' // ← replace with your real Associates tag

// Base amazon.in product pages (without the tag — it's appended automatically).
const PRODUCTS = {
  airfryer: {
    name: 'Philips Airfryer',
    url: 'https://www.amazon.in/dp/REPLACE_WITH_AIRFRYER_ASIN',
  },
  steamer: {
    name: 'Wipro Multi Cooker',
    url: 'https://www.amazon.in/dp/REPLACE_WITH_STEAMER_ASIN',
  },
}

export const DISCLOSURE =
  'As an Amazon Associate, Foodiee earns from qualifying purchases.'

// Build a tagged affiliate URL for an appliance ('airfryer' | 'steamer').
export function buyUrl(appliance) {
  const p = PRODUCTS[appliance]
  if (!p) return null
  const sep = p.url.includes('?') ? '&' : '?'
  return `${p.url}${sep}tag=${AMAZON_TAG}`
}

export function productName(appliance) {
  return PRODUCTS[appliance]?.name
}
