import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import reactPlugin from '@vitejs/plugin-react'

test('an uncertain sale keeps its request ID through status check and UI retry', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/staff/walk-in/' })
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'localStorage']
  const original = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const originalFetch = globalThis.fetch
  const originalClientId = process.env.VITE_GOOGLE_CLIENT_ID
  const originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'localStorage' ? dom.window.localStorage : dom.window[key],
    })
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  process.env.VITE_GOOGLE_CLIENT_ID = 'test-client'

  let onCredential
  let createAttempts = 0
  const requests = []
  window.google = { accounts: { id: {
    initialize({ callback }) { onCredential = callback },
    renderButton() {},
  } } }
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).split('/').at(-1)
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body })
    if (path === 'sales') return { ok: true, json: async () => ({ ok: true, data: { sales: [], can_void: false } }) }
    if (path === 'summary') return { ok: true, json: async () => ({ ok: true, data: { date: '2026-11-17', revenue: 0, transactions: 0, cash: 0, promptpay: 0, product_quantities: {} } }) }
    if (path === 'status') return { ok: true, json: async () => ({ ok: true, data: { state: 'NOT_FOUND' } }) }
    if (path === 'create') {
      createAttempts++
      if (createAttempts === 1) throw new Error('Network unavailable')
      return { ok: true, json: async () => ({ ok: true, data: { sale_id: 'WI-MOCK', total: 45, payment_method: 'Cash' } }) }
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
    await act(async () => {
      for (let attempt = 0; attempt < 40 && !onCredential; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    })
    assert.ok(onCredential)
    await act(async () => onCredential({ credential: 'mock-token' }))

    const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.includes(label))
    await act(async () => document.querySelector('[aria-label="Add one Classic Wafer"]').click())
    await act(async () => button('Review sale').click())
    await act(async () => document.querySelector('.staff-review input[type="checkbox"]').click())
    assert.equal(button('Record completed sale').disabled, false)
    await act(async () => button('Record completed sale').click())

    const first = requests.find((request) => request.path === 'create').body
    assert.match(document.body.textContent, /Network unavailable/)
    assert.equal(JSON.parse(localStorage.getItem('walk-in-pending-request')).request_id, first.request_id)

    await act(async () => button('Check status').click())
    assert.equal(requests.find((request) => request.path === 'status').body.request_id, first.request_id)
    await act(async () => button('Retry same request').click())

    const creates = requests.filter((request) => request.path === 'create')
    assert.equal(creates.length, 2)
    assert.equal(creates[1].body.request_id, first.request_id)
    assert.deepEqual(creates[1].body.cart, first.cart)
    assert.equal(creates[1].body.payment_method, first.payment_method)
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
    if (originalClientId === undefined) delete process.env.VITE_GOOGLE_CLIENT_ID
    else process.env.VITE_GOOGLE_CLIENT_ID = originalClientId
    for (const key of globals) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key])
      else delete globalThis[key]
    }
  }
})
