import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, generateKeyPairSync, sign, randomUUID } from 'node:crypto'
import createSale from '../api/staff/create.js'

function response() {
  return { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; return this }, status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
}

test('create API authenticates, reprices, and never confirms a failed Sheets save', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' })
  const originalFetch = global.fetch
  const original = Object.fromEntries(['GOOGLE_CLIENT_ID', 'STAFF_ALLOWED_EMAILS', 'WALKIN_APPS_SCRIPT_URL', 'WALKIN_APPS_SCRIPT_SECRET'].map((key) => [key, process.env[key]]))
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'client-id', STAFF_ALLOWED_EMAILS: 'staff@example.com', WALKIN_APPS_SCRIPT_URL: 'https://example.test/exec', WALKIN_APPS_SCRIPT_SECRET: 'test-secret' })
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'api-key' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'client-id', sub: '123', email: 'staff@example.com', email_verified: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')
  const token = `${header}.${payload}.${sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`
  let stored
  let fail = false
  global.fetch = async (url, options) => {
    if (url.includes('googleapis.com')) return { ok: true, headers: { get: () => 'max-age=300' }, json: async () => ({ keys: [{ ...jwk, kid: 'api-key', use: 'sig' }] }) }
    const envelope = JSON.parse(options.body)
    assert.equal(envelope.signature, createHmac('sha256', 'test-secret').update(envelope.message).digest('hex'))
    stored = JSON.parse(envelope.message).payload
    return { ok: true, json: async () => fail ? { ok: false, code: 'STORAGE', error: 'Failed' } : { ok: true, data: { sale_id: 'WI-TEST', total: stored.total } } }
  }
  try {
    const req = { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: { request_id: randomUUID(), cart: { classic: 1, teaRegular: 1 }, payment_method: 'Cash', payment_confirmed: true, total: 1 } }
    const first = response()
    await createSale(req, first)
    assert.equal(first.code, 200)
    assert.equal(stored.total, 75)
    assert.equal(stored.staff_id, 'staff@example.com')
    const invalid = response()
    await createSale({ ...req, body: { ...req.body, cart: { classic: -1 } } }, invalid)
    assert.equal(invalid.code, 400)
    fail = true
    const failed = response()
    const originalError = console.error
    console.error = () => {}
    try { await createSale(req, failed) } finally { console.error = originalError }
    assert.equal(failed.code, 503)
    assert.equal(failed.body.ok, false)
    const denied = response()
    await createSale({ ...req, headers: {} }, denied)
    assert.equal(denied.code, 401)
  } finally {
    global.fetch = originalFetch
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
