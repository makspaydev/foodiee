// Amazon Associates affiliate config.
// ------------------------------------
// To go live: (1) set AMAZON_TAG to your real Associates tag, (2) paste the two
// amazon.in product URLs below, (3) flip AFFILIATE_ENABLED to true. That's it —
// the contextual "Get it on Amazon" links and the footer "Our appliances"
// section will appear automatically.

export const AFFILIATE_ENABLED = true

export const AMAZON_TAG = 'foodiee03-21'

// Base amazon.in product pages (without the tag — it's appended automatically).
// Each appliance points at a specific, popular, highly-rated amazon.in product.
// Tip: prices/availability drift over time — sanity-check the live links now and
// then, and swap the ASIN if a unit goes out of stock.
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
  mixer: {
    // Philips HL7756/00 750W, 3 stainless jars — 33k+ ratings, category bestseller
    name: 'Philips HL7756 Mixer-Grinder',
    url: 'https://www.amazon.in/dp/B01GZSQJPA',
  },
  oven: {
    // Bajaj Majesty 1603 16L OTG — ~14k ratings, the default home OTG
    name: 'Bajaj Majesty 1603 OTG',
    url: 'https://www.amazon.in/dp/B009P2KQXK',
  },
  cooktop: {
    // Prestige PIC 6.1 V3 2200W induction — 11k+ ratings
    name: 'Prestige PIC 6.1 Induction Cooktop',
    url: 'https://www.amazon.in/dp/B07L12RZXL',
  },
  pressurecooker: {
    // Prestige 3L Deluxe Alpha Svachh stainless, induction-compatible, ISI
    name: 'Prestige Svachh Pressure Cooker',
    url: 'https://www.amazon.in/dp/B0843YL5RH',
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
