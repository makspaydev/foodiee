// Thin client over the Swiggy Instamart MCP (Model Context Protocol, streamable HTTP).
// We open a short-lived MCP session per request, authenticated with the user's bearer
// token, call a tool, and close. The 13 Instamart tools mirror what the Swiggy connector
// exposes (get_addresses, search_products, get_cart, update_cart, clear_cart, checkout, …).
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const MCP_URL = process.env.INSTAMART_MCP_URL || 'https://mcp.swiggy.com/im'

// Run `fn(client)` against an authenticated MCP session, then tear it down.
async function withSession(accessToken, fn) {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const client = new Client({ name: 'foodiee-backend', version: '0.1.0' }, { capabilities: {} })
  await client.connect(transport)
  try {
    return await fn(client)
  } finally {
    await client.close().catch(() => {})
  }
}

// Call a tool and parse its JSON result (Instamart tools return JSON as text content).
export async function callTool(accessToken, name, args = {}) {
  return withSession(accessToken, async (client) => {
    const res = await client.callTool({ name, arguments: args })
    const text = (res.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('')
    try {
      return JSON.parse(text)
    } catch {
      return text || res
    }
  })
}

// Convenience wrappers for the tools Foodiee uses.
export const instamart = {
  listTools: (token) => withSession(token, (c) => c.listTools()),
  getAddresses: (token) => callTool(token, 'get_addresses'),
  searchProducts: (token, { addressId, query, offset = 0 }) =>
    callTool(token, 'search_products', { addressId, query, offset }),
  getCart: (token) => callTool(token, 'get_cart'),
  updateCart: (token, { selectedAddressId, items }) =>
    callTool(token, 'update_cart', { selectedAddressId, items }),
  clearCart: (token) => callTool(token, 'clear_cart'),
  // NOTE: the actual order/checkout tool name + params should be confirmed against
  // /builders/docs/reference/ during onboarding before enabling real orders.
  placeOrder: (token, args = {}) => callTool(token, 'checkout', args),
}
