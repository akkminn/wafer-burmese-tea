import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import reactPlugin from '@vitejs/plugin-react'

function setInputValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  descriptor.set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

test('staff email/password login, PromptPay QR generation, and uncertain sale retry work end-to-end', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/staff/walk-in/' })
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'localStorage']
  const original = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const originalFetch = globalThis.fetch
  const originalPromptPay = process.env.VITE_PROMPTPAY_ID
  const originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'localStorage' ? dom.window.localStorage : dom.window[key],
    })
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  process.env.VITE_PROMPTPAY_ID = '0845077107'

  let createAttempts = 0
  const requests = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).split('/').at(-1)
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body })
    if (path === 'login') {
      assert.equal(body.email, 'admin@example.com')
      assert.equal(body.password, 'secret123')
      return { ok: true, json: async () => ({ ok: true, data: { token: 'mock-session-token', email: 'admin@example.com', can_void: true } }) }
    }
    if (path === 'sales') return { ok: true, json: async () => ({ ok: true, data: { sales: [], can_void: true } }) }
    if (path === 'summary') return { ok: true, json: async () => ({ ok: true, data: { date: '2026-11-26', revenue: 0, transactions: 0, cash: 0, promptpay: 0, product_quantities: {} } }) }
    if (path === 'status') return { ok: true, json: async () => ({ ok: true, data: { state: 'NOT_FOUND' } }) }
    if (path === 'create') {
      createAttempts++
      if (createAttempts === 1) throw new Error('Network unavailable')
      return { ok: true, json: async () => ({ ok: true, data: { sale_id: 'WI-MOCK', total: 75, payment_method: 'PromptPay' } }) }
    }
    throw new Error(`Unexpected request: ${path}`)
  }

  const vite = await createServer({ configFile: false, plugins: [reactPlugin()], server: { middlewareMode: true }, appType: 'custom' })
  let root
  try {
    const { default: WalkInApp } = await vite.ssrLoadModule('/src/staff/WalkInApp.jsx')
    const { createRoot } = await import('react-dom/client')
    const { act, createElement } = await import('react')
    root = createRoot(document.getElementById('root'))
    await act(async () => root.render(createElement(WalkInApp)))
    assert.equal(document.querySelectorAll('h1').length, 1)

    // Sign in with email + password
    await act(async () => {
      setInputValue(document.querySelector('input[type="email"]'), 'admin@example.com')
      setInputValue(document.querySelector('input[type="password"]'), 'secret123')
    })
    await act(async () => {
      document.querySelector('.staff-login-form button[type="submit"]').click()
    })
    assert.equal(requests.some((r) => r.path === 'login'), true)
    assert.equal(JSON.parse(localStorage.getItem('walk-in-staff-session')).email, 'admin@example.com')

    const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.includes(label))

    // Tap quick combo chip (Classic Combo = ฿75) and switch to PromptPay QR
    await act(async () => button('Classic Combo').click())
    const promptPayRadio = [...document.querySelectorAll('input[name="payment"]')][1]
    await act(async () => promptPayRadio.click())

    // Wait for async QR SVG generation
    await act(async () => {
      for (let i = 0; i < 20 && !document.querySelector('.staff-qr-box svg'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    })
    assert.ok(document.querySelector('.staff-qr-box svg'), 'PromptPay QR SVG should render')

    // Open and close full-screen customer QR modal
    await act(async () => button('Show full-screen QR').click())
    assert.ok(document.querySelector('.staff-qr-modal'), 'Full-screen QR modal should open')
    await act(async () => button('Done · Back to POS').click())
    assert.equal(document.querySelector('.staff-qr-modal'), null)

    // Review, verify, and trigger uncertain network error then recover with same request_id
    await act(async () => button('Review sale').click())
    await act(async () => document.querySelector('.staff-review input[type="checkbox"]').click())
    assert.equal(button('Record completed sale').disabled, false)
    await act(async () => button('Record completed sale').click())

    const first = requests.find((request) => request.path === 'create').body
    assert.equal(first.payment_method, 'PromptPay')
    assert.match(document.body.textContent, /Network unavailable/)
    assert.equal(JSON.parse(localStorage.getItem('walk-in-pending-request')).request_id, first.request_id)

    await act(async () => button('Check status').click())
    assert.equal(requests.find((request) => request.path === 'status').body.request_id, first.request_id)
    await act(async () => button('Retry same request').click())

    const creates = requests.filter((request) => request.path === 'create')
    assert.equal(creates.length, 2)
    assert.equal(creates[1].body.request_id, first.request_id)
    assert.deepEqual(creates[1].body.cart, first.cart)
    assert.equal(creates[1].body.payment_method, 'PromptPay')
    assert.equal(localStorage.getItem('walk-in-pending-request'), null)
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => root.unmount())
    }
    await vite.close()
    dom.window.close()
    globalThis.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    if (originalPromptPay === undefined) delete process.env.VITE_PROMPTPAY_ID
    else process.env.VITE_PROMPTPAY_ID = originalPromptPay
    for (const key of globals) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key])
      else delete globalThis[key]
    }
  }
})
