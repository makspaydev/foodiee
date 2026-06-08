// Talks to the Foodiee ordering backend. Enabled only when VITE_BACKEND_URL is set
// (local dev / demo). In production builds it's unset, so the ordering UI stays
// "coming soon" and the deployed site is unaffected.
const RAW = import.meta.env.VITE_BACKEND_URL || ''
export const ORDERING_ENABLED = !!RAW
const BASE = RAW.replace(/\/$/, '')

export const connectUrl = () => `${BASE}/auth/swiggy/start`

export async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
