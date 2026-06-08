// Per-user token store with encryption-at-rest.
//
// SCAFFOLD: uses an in-memory Map so it works out of the box for local prototyping.
// For production, swap `save`/`load`/`remove` to a real database (Postgres/KV) — the
// encrypt/decrypt helpers and the interface stay the same.
import crypto from 'node:crypto'

const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY || ''
const key = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null

function encrypt(plain) {
  if (!key) return plain // dev fallback; set TOKEN_ENCRYPTION_KEY in prod
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decrypt(blob) {
  if (!key) return blob
  const [ivH, tagH, dataH] = blob.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivH, 'hex'))
  decipher.setAuthTag(Buffer.from(tagH, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]).toString('utf8')
}

// uid -> { token: <encrypted>, expiresAt, scope }
const db = new Map()

export const tokenStore = {
  save(uid, { accessToken, expiresAt, scope }) {
    db.set(uid, { token: encrypt(accessToken), expiresAt, scope })
  },
  load(uid) {
    const row = db.get(uid)
    if (!row) return null
    if (row.expiresAt && row.expiresAt < Date.now()) {
      db.delete(uid) // expired — Swiggy v1 has no refresh, user must reconnect
      return null
    }
    return { accessToken: decrypt(row.token), expiresAt: row.expiresAt, scope: row.scope }
  },
  remove(uid) {
    db.delete(uid)
  },
  isConnected(uid) {
    return !!this.load(uid)
  },
}

// Short-lived store for in-flight OAuth (state -> { verifier, uid }). 10-min TTL.
const pending = new Map()
export const pendingAuth = {
  put(state, value) {
    pending.set(state, { ...value, ts: Date.now() })
  },
  take(state) {
    const v = pending.get(state)
    pending.delete(state)
    if (!v || Date.now() - v.ts > 10 * 60 * 1000) return null
    return v
  },
}
