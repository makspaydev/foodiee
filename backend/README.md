# Foodiee ordering backend (scaffold)

A small backend that lets a Foodiee user **connect their own Swiggy account** and order
recipe ingredients from **Instamart**, via Swiggy's MCP. Built for the Swiggy Builders Club.

> **Status:** scaffold for prototyping ahead of Builders Club onboarding. The OAuth + MCP
> wiring is real and works on `localhost` (per Swiggy's docs: *"No access needed until prod —
> wire Swiggy MCP into your agent on localhost, build the flow end-to-end."*). Production
> needs the approved `client_id`, a whitelisted **static egress IP**, and a real token store.

## How it works

```
Browser → GET /auth/swiggy/start
        → Swiggy login (mcp.swiggy.com/auth/authorize — user enters phone+OTP on Swiggy)
        → GET /auth/swiggy/callback  (exchange code → access token, stored encrypted per user)
Frontend → GET  /api/addresses, /api/search, /api/cart
         → POST /api/cart        (build the cart)
         → POST /api/order {confirm:true}   (place COD order — only with explicit confirm)
```

- **OAuth 2.1 + PKCE**, tokens valid ~5 days, no refresh (re-auth on expiry).
- The backend **never sees the user's password/OTP** — Swiggy's consent page handles auth.
- Tokens are **encrypted at rest** (AES-256-GCM) and deletable via `/auth/swiggy/disconnect`.
- Orders require an explicit `{ confirm: true }` — nothing is placed automatically.

## Run locally

```bash
cd backend
cp .env.example .env          # then fill TOKEN_ENCRYPTION_KEY (openssl rand -hex 32)
npm install
npm run register              # Dynamic Client Registration → prints SWIGGY_CLIENT_ID
# paste SWIGGY_CLIENT_ID into .env
npm run dev                   # starts on :8787
```

Then point the frontend's "Connect Swiggy" button at `http://localhost:8787/auth/swiggy/start`.

## Files

| File | Purpose |
|---|---|
| `src/server.js` | Express app: OAuth routes + `/api/*` Instamart proxy |
| `src/oauth.js` | PKCE, authorize URL, code→token exchange, DCR |
| `src/mcp.js` | MCP (streamable HTTP) client + Instamart tool wrappers |
| `src/store.js` | Per-user encrypted token store (in-memory; swap for a DB in prod) |
| `src/register-client.js` | One-time DCR to obtain the `client_id` |

## Before production (onboarding checklist)

- [ ] Use the **approved** `client_id`; register the prod redirect URI
      (`https://api.foodiee.live/auth/swiggy/callback`).
- [ ] Deploy on a host with a **static egress IP** (Swiggy whitelists it). Options: a small
      cloud VM, Fly.io with a dedicated IP, or a NAT gateway. Share the IP at onboarding.
- [ ] Replace the in-memory `tokenStore` with an **encrypted database** (Postgres/KV).
- [ ] Harden sessions (signed, `secure`, proper auth) — the `foodiee_uid` cookie is a scaffold.
- [ ] Confirm the exact **order/checkout tool name + params** against
      `/builders/docs/reference/` before enabling real orders.
- [ ] Record the **video demo** Swiggy requests for prod access.

The static frontend (GitHub Pages) is unaffected by this backend — it lives in `backend/`
and deploys separately.
