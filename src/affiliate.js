// Amazon Associates affiliate config.
// ------------------------------------
// To go live: (1) set AMAZON_TAG to your real Associates tag, (2) paste the two
// amazon.in product URLs below, (3) flip AFFILIATE_ENABLED to true. That's it —
// the contextual "Get it on Amazon" links and the footer "Our appliances"
// section will appear automatically.

export const AFFILIATE_ENABLED = true

export const AMAZON_TAG = 'foodiee03-21'

// Base amazon.in product pages (without the tag — it's appended automatically).
const PRODUCTS = {
  airfryer: {
    // Philips Airfryer 4.1L RapidAir, dial control (HD9200/90)
    name: 'Philips Airfryer',
    url: 'https://www.amazon.in/dp/B09CTWFV5W',
  },
  steamer: {
    // Wipro Elato BE201 4-in-1 Multicooker / Egg Boiler
    name: 'Wipro Multi Cooker',
    url: 'https://www.amazon.in/dp/B0DD4DJ852',
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
