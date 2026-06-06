# Swiggy Builders Club — Access Application (Foodiee)

> Submit at https://swiggy.com/builders/access/ and/or email to **builders@swiggy.in**.
> Replace every **[bracketed]** field before sending.

---

## 1. Applicant

- **Name:** [Your full name]
- **Email:** [Your email]
- **Phone (Swiggy account):** [Your Swiggy-registered number]
- **Location:** Hyderabad, India
- **Type:** Individual developer building a small, non-commercial community app
- **Swiggy One member:** [Yes / No]

## 2. Project

**Name:** Foodiee
**Live app:** https://foodiee.live
**Source:** https://github.com/makspaydev/foodiee

**One-liner:** A recipe app for home cooks that turns the dishes you choose into a
single, de-duplicated grocery list — and lets you order those groceries from Swiggy
Instamart in a couple of taps.

**What it does today:** Foodiee is a recipe browser built around two common home
appliances (an air fryer and a steamer). Users pick recipes, and the app combines their
ingredients into one shopping list. Today, ordering is a manual hand-off (the user pastes
the list into an MCP client). We would like to make ordering native and seamless via the
Builders Club.

## 3. Use case for MCP / Instamart access

We want approved access so each user can **connect their own Swiggy account** to Foodiee
and place a **Swiggy Instamart** order for their recipe ingredients, with explicit
confirmation, without leaving the app.

Intended flow per user:
1. User builds a shopping list from recipes in Foodiee.
2. User taps **Connect Swiggy** → redirected to Swiggy's OAuth consent
   (`mcp.swiggy.com/auth/authorize`) where **they** authenticate (phone + OTP on Swiggy's
   page — Foodiee never sees their credentials).
3. Foodiee searches Instamart for the shoppable items, builds a cart, and shows the user a
   full bill.
4. **The user explicitly confirms** before any order is placed. Orders are Cash-on-Delivery.

**Primary server needed:** Instamart. (Food/Dineout not required initially.)

**Scopes requested:** `mcp:tools`, `mcp:resources`, `mcp:prompts`

**Tools we expect to use:** `get_addresses`, `search_products`, `get_cart`,
`update_cart`, `clear_cart`, and the order/checkout tool (COD).

## 4. Redirect URIs

- **Production:** `https://api.foodiee.live/auth/swiggy/callback`
- **Local development:** `http://localhost:8787/auth/swiggy/callback`

(Exact-match HTTPS; we will register additional URIs through `builders@swiggy.in` if the
backend domain changes.)

## 5. Architecture & security posture

- **OAuth 2.1 + PKCE.** Authentication is performed by Swiggy's own consent page; Foodiee
  **never collects or stores phone numbers, OTPs, or passwords**.
- **Backend token handling.** A small backend exchanges the auth code for tokens and stores
  each user's tokens **encrypted at rest**, scoped per-user, refreshed as needed. The OAuth
  client secret lives only on the server, never in the browser.
- **Explicit order confirmation.** No order is ever placed without the user reviewing the
  cart and bill and tapping confirm. We surface that **Instamart orders cannot be cancelled**
  before they confirm.
- **Data minimisation.** We store only what is needed to build a cart (token, selected
  address id, list items). Users can disconnect, which deletes their tokens.
- **Single Swiggy session.** We advise users not to use the Swiggy app concurrently during
  an MCP session, per your guidance.

## 6. Scale & intent

- **Audience:** a small, closed community — the families in our apartment building
  (~[N] households initially).
- **Volume:** low; a handful of grocery orders per week.
- **Commercial:** non-commercial / internal community use. Not monetised.
- **Compliance:** we will follow the Builders Club guidelines
  (`/builders/access/#guidelines`) and Swiggy's terms; happy to limit to a sandbox or a
  capped allowlist of users during review.

## 7. Contact

- **Primary contact:** [Your name] — [Your email] — [Your phone]
- **Availability for review/security questions:** [e.g. weekdays, IST]

---

*Prepared for the Foodiee project. We are happy to start in a restricted/sandbox capacity
and demonstrate the consent + confirmation flow before any production access.*
