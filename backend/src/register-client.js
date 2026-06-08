// One-time: register this app as an OAuth client (Dynamic Client Registration)
// and print the client_id to put in .env as SWIGGY_CLIENT_ID.
//   node src/register-client.js
import { registerClient } from './oauth.js'

const redirectUri = process.env.REDIRECT_URI || 'http://localhost:8787/auth/swiggy/callback'

try {
  const reg = await registerClient({ redirectUri })
  console.log('Registered. Add this to .env:\n')
  console.log(`SWIGGY_CLIENT_ID=${reg.client_id}`)
  console.log('\nFull response:', JSON.stringify(reg, null, 2))
} catch (e) {
  console.error('✗', e.message)
  process.exit(1)
}
