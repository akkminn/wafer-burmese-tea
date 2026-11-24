import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSale, validateCart } from '../server/pricing.js'
import { priceCart } from '../src/pricing.js'
import { authenticate, createSessionToken, parseAccounts, verifyCredentials, verifySessionToken } from '../server/auth.js'

test('walk-in pricing matches the public calculator without pre-order discounts', () => {
  const cart = { classic: 2, choco: 1, mixed: 0, tea: 3 }
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

test('email/password credentials and signed session tokens enforce roles', async () => {
  const original = Object.fromEntries(
    ['STAFF_ACCOUNTS', 'STAFF_LOGIN_EMAIL', 'STAFF_LOGIN_PASSWORD', 'STAFF_SESSION_SECRET', 'WALKIN_APPS_SCRIPT_SECRET']
      .map((key) => [key, process.env[key]]),
  )
  process.env.STAFF_ACCOUNTS = 'admin@example.com:AdminPass!23:admin,staff@example.com:StaffPass!23:staff'
  process.env.STAFF_SESSION_SECRET = 'test-session-secret-32-characters-long'
  delete process.env.STAFF_LOGIN_EMAIL
  delete process.env.STAFF_LOGIN_PASSWORD

  try {
    const accounts = parseAccounts(process.env)
    assert.equal(accounts.length, 2)
    assert.equal(accounts[0].canVoid, true)
    assert.equal(accounts[1].canVoid, false)

    const admin = verifyCredentials('ADMIN@example.com', 'AdminPass!23')
    assert.deepEqual(admin, { email: 'admin@example.com', canVoid: true })
    const staff = verifyCredentials('staff@example.com', 'StaffPass!23')
    assert.deepEqual(staff, { email: 'staff@example.com', canVoid: false })

    assert.throws(() => verifyCredentials('admin@example.com', 'wrong-password'))
    assert.throws(() => verifyCredentials('stranger@example.com', 'AdminPass!23'))

    const adminToken = createSessionToken(admin)
    const staffToken = createSessionToken(staff)
    assert.equal(verifySessionToken(adminToken).email, 'admin@example.com')

    assert.deepEqual(await authenticate({ headers: { authorization: `Bearer ${adminToken}` } }, 'void'), {
      email: 'admin@example.com',
      canVoid: true,
    })
    assert.deepEqual(await authenticate({ headers: { authorization: `Bearer ${staffToken}` } }), {
      email: 'staff@example.com',
      canVoid: false,
    })
    await assert.rejects(() => authenticate({ headers: { authorization: `Bearer ${staffToken}` } }, 'void'))
    await assert.rejects(() => authenticate({ headers: { authorization: `Bearer ${staffToken}tampered` } }))
    await assert.rejects(() => authenticate({ headers: {} }))

    // JSON format and single-account env vars also work
    const jsonAccounts = parseAccounts({
      STAFF_ACCOUNTS: JSON.stringify([{ email: 'boss@example.com', password: 'p:with:colon', role: 'admin' }]),
    })
    assert.equal(jsonAccounts[0].password, 'p:with:colon')
    assert.equal(jsonAccounts[0].canVoid, true)

    const single = parseAccounts({ STAFF_LOGIN_EMAIL: 'solo@example.com', STAFF_LOGIN_PASSWORD: 'secret' })
    assert.deepEqual(single, [{ email: 'solo@example.com', password: 'secret', canVoid: true }])
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
