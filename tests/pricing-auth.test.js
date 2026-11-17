import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { calculateSale, validateCart } from '../server/pricing.js'
import { priceCart } from '../src/pricing.js'
import { verifyGoogleToken, authenticate } from '../server/auth.js'

test('walk-in pricing matches the public calculator without pre-order discounts', () => {
  const cart = { classic: 2, choco: 1, mixed: 0, teaRegular: 2, teaLess: 1 }
  const sale = calculateSale(cart)
  const walkin = priceCart(cart, { isPreorder: false })
  const preorder = priceCart(cart, { isPreorder: true })
  assert.equal(sale.subtotal, 250)
  assert.equal(sale.combo_discount, 15)
  assert.equal(sale.total, 235)
  assert.equal(sale.total, walkin.total)
  assert.equal(preorder.total, 205)
})

test('invalid quantities and unknown products are rejected', () => {
  for (const cart of [{ classic: -1 }, { classic: 1.5 }, { classic: 21 }, { classic: '2' }, { fake: 1 }, {}]) {
    assert.throws(() => validateCart(cart))
  }
})

test('Google tokens require a valid signature, audience and approved email', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const originalFetch = global.fetch
  const originalClient = process.env.GOOGLE_CLIENT_ID
  const originalStaff = process.env.STAFF_ALLOWED_EMAILS
  const originalVoid = process.env.STAFF_VOID_EMAILS
  const jwk = publicKey.export({ format: 'jwk' })
  global.fetch = async () => ({ ok: true, headers: { get: () => 'max-age=300' }, json: async () => ({ keys: [{ ...jwk, kid: 'test-key', use: 'sig' }] }) })
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.STAFF_ALLOWED_EMAILS = 'staff@example.com'
  process.env.STAFF_VOID_EMAILS = 'manager@example.com'
  const token = (claims, key = privateKey) => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'client-id', sub: '123', exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000), email: 'staff@example.com', email_verified: true, ...claims })).toString('base64url')
    return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), key).toString('base64url')}`
  }
  try {
    const good = token({})
    assert.equal((await verifyGoogleToken(good, 'client-id')).email, 'staff@example.com')
    assert.equal((await authenticate({ headers: { authorization: `Bearer ${good}` } })).email, 'staff@example.com')
    await assert.rejects(() => verifyGoogleToken(token({ aud: 'other' }), 'client-id'))
    await assert.rejects(() => verifyGoogleToken(token({ email_verified: false }), 'client-id'))
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    await assert.rejects(() => verifyGoogleToken(token({}, other), 'client-id'))
    await assert.rejects(() => authenticate({ headers: { authorization: `Bearer ${token({ email: 'stranger@example.com' })}` } }))
    await assert.rejects(() => authenticate({ headers: { authorization: `Bearer ${good}` } }, 'void'))
  } finally {
    global.fetch = originalFetch
    for (const [key, value] of Object.entries({ GOOGLE_CLIENT_ID: originalClient, STAFF_ALLOWED_EMAILS: originalStaff, STAFF_VOID_EMAILS: originalVoid })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
