// Lightweight GA4 event helper. No-ops safely if gtag isn't loaded
// (e.g. local dev, or if an ad-blocker blocks Google Analytics).
export function track(name, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params)
    }
  } catch {
    /* never let analytics break the app */
  }
}
