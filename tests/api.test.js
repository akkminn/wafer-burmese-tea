import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import loginStaff from '../api/staff/login.js'
import createSale from '../api/staff/create.js'

function response() {
  return {
    code: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; return this },
    status(code) { this.code = code; return this },
    json(value) { this.body = value; return this },
  }
}

test('login and create APIs authenticate with email/password, reprice, and never confirm a failed Sheets save', async () => {
  const originalFetch = global.fetch
  const keys = ['STAFF_ACCOUNTS', 'STAFF_SESSION_SECRET', 'WALKIN_APPS_SCRIPT_URL', 'WALKIN_APPS_SCRIPT_SECRET']
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, {
    STAFF_ACCOUNTS: 'admin@example.com:secret123:admin,staff@example.com:pass123:staff',
    STAFF_SESSION_SECRET: 'test-session-secret',
    WALKIN_APPS_SCRIPT_URL: 'https://example.test/exec',
    WALKIN_APPS_SCRIPT_SECRET: 'test-secret',
  })

  let stored
  let fail = false
  global.fetch = async (_url, options) => {
    const envelope = JSON.parse(options.body)
    assert.equal(envelope.signature, createHmac('sha256', 'test-secret').update(envelope.message).digest('hex'))
    stored = JSON.parse(envelope.message).payload
    return {
      ok: true,
      json: async () => (fail
        ? { ok: false, code: 'STORAGE', error: 'Failed' }
        : { ok: true, data: { sale_id: 'WI-TEST', total: stored.total } }),
    }
  }

  try {
    const badLogin = response()
    await loginStaff({ method: 'POST', body: { email: 'staff@example.com', password: 'wrong' } }, badLogin)
    assert.equal(badLogin.code, 401)
    assert.equal(badLogin.body.ok, false)

    const goodLogin = response()
    await loginStaff({ method: 'POST', body: { email: 'staff@example.com', password: 'pass123' } }, goodLogin)
    assert.equal(goodLogin.code, 200)
    assert.equal(goodLogin.body.ok, true)
    assert.equal(goodLogin.body.data.email, 'staff@example.com')
    assert.equal(goodLogin.body.data.can_void, false)
    const token = goodLogin.body.data.token
    assert.ok(token)

    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { request_id: randomUUID(), cart: { classic: 1, teaRegular: 1 }, payment_method: 'Cash', payment_confirmed: true, total: 1 },
    }
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
