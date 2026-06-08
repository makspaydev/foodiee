// OAuth 2.1 + PKCE against Swiggy MCP.
// Endpoints (Builders docs):
//   authorize: {SWIGGY_AUTH_BASE}/auth/authorize
//   token:     {SWIGGY_AUTH_BASE}/auth/token
//   register:  {SWIGGY_AUTH_BASE}/auth/register   (Dynamic Client Registration, RFC 7591)
// Tokens are valid ~5 days; refresh tokens are NOT issued in v1 — re-run the flow on expiry.
import crypto from 'node:crypto'

const AUTH_BASE = process.env.SWIGGY_AUTH_BASE || 'https://mcp.swiggy.com'
const SCOPE = 'mcp:tools mcp:resources mcp:prompts'

// Generate a PKCE verifier/challenge pair.
export function makePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function randomState() {
  return crypto.randomBytes(16).toString('base64url')
}

// Build the URL we redirect the user to so they log in on Swiggy's own page.
export function authorizeUrl({ clientId, redirectUri, challenge, state }) {
  const u = new URL('/auth/authorize', AUTH_BASE)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('scope', SCOPE)
  u.searchParams.set('state', state)
  return u.toString()
}

// Exchange the authorization code (valid ~120s) for an access token.
export async function exchangeCode({ clientId, code, verifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_id: clientId,
  })
  const res = await fetch(new URL('/auth/token', AUTH_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`token exchange failed: ${data.error_description || data.error || res.status}`)
  // { access_token, token_type: 'Bearer', expires_in, scope }
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 432000) * 1000,
    scope: data.scope,
  }
}

// Dynamic Client Registration — get a client_id for this app (run once).
export async function registerClient({ redirectUri }) {
  const res = await fetch(new URL('/auth/register', AUTH_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Foodiee',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // public client (PKCE)
      scope: SCOPE,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`registration failed: ${data.error_description || data.error || res.status}`)
  return data // { client_id, ... }
}
