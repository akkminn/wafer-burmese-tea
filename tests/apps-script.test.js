import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { calculateSale } from '../server/pricing.js'

const salesHeaders = ['sale_id', 'request_id', 'timestamp', 'staff_id', 'sale_type', 'subtotal', 'combo_discount', 'total', 'currency', 'payment_method', 'payment_status', 'sale_status', 'voided_at', 'void_reason', 'voided_by', 'record_state', 'request_hash']
const itemHeaders = ['sale_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'line_total']
const auditHeaders = ['timestamp', 'sale_id', 'action', 'staff_id', 'reason']

function harness({ empty = false, sheetIdProp = '', activeSheet = true } = {}) {
  class Sheet {
    constructor(headers) {
      this.rows = headers ? [headers] : []
      this.frozenRows = 0
      this.failAfterAppend = false
    }
    getLastRow() { return this.rows.length }
    setFrozenRows(n) { this.frozenRows = n }
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? '')),
        getDisplayValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => String(this.rows[row - 1 + i]?.[col - 1 + j] ?? ''))),
        setValue: (value) => { this.rows[row - 1][col - 1] = value },
        setValues: (values) => { values.forEach((line, i) => line.forEach((value, j) => { this.rows[row - 1 + i][col - 1 + j] = value })) },
      }
    }
    appendRow(values) {
      this.rows.push([...values])
      if (this.failAfterAppend) { this.failAfterAppend = false; throw new Error('Simulated lost write response') }
    }
  }
  const sheets = empty
    ? { Orders: new Sheet(['Received', 'Code']) }
    : { Sales: new Sheet(salesHeaders), SaleItems: new Sheet(itemHeaders), AuditLog: new Sheet(auditHeaders) }
  let openedSheetId = null
  const book = {
    getId: () => openedSheetId || 'active-book',
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => {
      sheets[name] = new Sheet()
      return sheets[name]
    },
  }
  const lock = { acquired: false, blocked: false, calls: 0, tryLock() { this.calls++; if (this.blocked || this.acquired) return false; this.acquired = true; return true }, releaseLock() { this.acquired = false } }
  const context = {
    console: { error() {} },
    Logger: { log() {} },
    Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({}) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (activeSheet ? book : null),
      openById: (id) => {
        openedSheetId = id
        return book
      },
      flush() {},
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (name) => name === 'SHEET_ID' ? sheetIdProp : 'secret' }) },
    LockService: { getScriptLock: () => lock },
    Utilities: {
      computeHmacSha256Signature: (text, secret) => [...createHmac('sha256', secret).update(text).digest()],
      computeDigest: (_algorithm, text) => [...createHash('sha256').update(text).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: randomUUID,
      formatDate: (date, _zone, pattern) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, pattern === 'yyyy-MM-dd' ? 10 : pattern === 'HH:mm' ? 16 : 19),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this } }) },
  }
  vm.runInNewContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const call = (action, payload) => {
    const message = JSON.stringify({ action, payload, timestamp: Date.now() })
    const signature = createHmac('sha256', 'secret').update(message).digest('hex')
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ message, signature }) } }).text)
  }
  const raw = (message, signature) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ message, signature }) } }).text)
  return { sheets, lock, call, raw, getOpenedSheetId: () => openedSheetId, context }
}

test('auto-creates Sales, SaleItems, and AuditLog tabs inside the pre-order spreadsheet without touching Orders', () => {
  const { sheets, call, getOpenedSheetId } = harness({ empty: true, activeSheet: false })
  const res = call('summary', {})
  assert.equal(res.ok, true)
  assert.equal(getOpenedSheetId(), '16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0')
  assert.deepEqual(sheets.Sales.rows[0], salesHeaders)
  assert.deepEqual(sheets.SaleItems.rows[0], itemHeaders)
  assert.deepEqual(sheets.AuditLog.rows[0], auditHeaders)
  assert.equal(sheets.Sales.frozenRows, 1)
  assert.deepEqual(sheets.Orders.rows[0], ['Received', 'Code'])
})

test('duplicate and concurrent requests do not create extra sales', () => {
  const { sheets, lock, call } = harness()
  const request_id = randomUUID()
  const payload = { request_id, staff_id: 'staff@example.com', payment_method: 'Cash', ...calculateSale({ classic: 1, tea: 1 }) }
  lock.blocked = true
  assert.equal(call('create', payload).ok, false)
  assert.equal(sheets.Sales.rows.length, 1)
  lock.blocked = false
  const first = call('create', payload)
  const second = call('create', payload)
  assert.equal(first.ok, true)
  assert.equal(second.data.sale_id, first.data.sale_id)
  assert.equal(sheets.Sales.rows.length, 2)
  assert.equal(sheets.SaleItems.rows.length, 3)
  assert.equal(sheets.AuditLog.rows.length, 2)
  assert.ok(lock.calls >= 3)
  assert.equal(call('create', { ...payload, payment_method: 'PromptPay' }).code, 'CONFLICT')
})

test('partial write remains out of revenue and is recovered with the same request ID', () => {
  const { sheets, call } = harness()
  const payload = { request_id: randomUUID(), staff_id: 'staff@example.com', payment_method: 'PromptPay', ...calculateSale({ choco: 1, tea: 1 }) }
  sheets.SaleItems.failAfterAppend = true
  assert.equal(call('create', payload).ok, false)
  assert.equal(call('status', { request_id: payload.request_id }).data.state, 'PENDING')
  assert.equal(call('summary', {}).data.revenue, 0)
  const retry = call('create', payload)
  assert.equal(retry.ok, true)
  assert.equal(retry.data.total, 85)
  assert.equal(call('status', { request_id: payload.request_id }).data.state, 'COMPLETED')
  assert.equal(sheets.SaleItems.rows.length, 3)
  assert.equal(call('summary', {}).data.revenue, 85)
  assert.equal(call('summary', {}).data.product_quantities.tea, 1)
})

test('voids retain history and audit while removing revenue', () => {
  const { sheets, call } = harness()
  const payload = { request_id: randomUUID(), staff_id: 'staff@example.com', payment_method: 'Cash', ...calculateSale({ classic: 1 }) }
  const sale = call('create', payload).data
  assert.equal(call('summary', {}).data.revenue, 45)
  const voided = call('void', { sale_id: sale.sale_id, staff_id: 'manager@example.com', reason: 'Entered twice' })
  assert.equal(voided.data.sale_status, 'voided')
  assert.equal(call('summary', {}).data.revenue, 0)
  assert.equal(call('sales', { limit: 30 }).data.sales.length, 1)
  assert.deepEqual(sheets.AuditLog.rows.slice(1).map((row) => row[2]), ['CREATED', 'VOID_REQUESTED', 'VOIDED'])
})

test('retry repairs a failed final void audit write without changing the sale twice', () => {
  for (const failAfterAppend of [false, true]) {
    const { sheets, call } = harness()
    const payload = { request_id: randomUUID(), staff_id: 'staff@example.com', payment_method: 'Cash', ...calculateSale({ classic: 1 }) }
    const sale = call('create', payload).data
    const audit = sheets.AuditLog
    const append = audit.appendRow.bind(audit)
    audit.appendRow = (values) => {
      if (values[2] !== 'VOIDED') return append(values)
      audit.appendRow = append
      if (failAfterAppend) append(values)
      throw new Error('Simulated final audit write failure')
    }

    const request = { sale_id: sale.sale_id, staff_id: 'manager@example.com', reason: 'Entered twice' }
    assert.equal(call('void', request).ok, false)
    assert.equal(call('summary', {}).data.revenue, 0)
    const voidedAt = sheets.Sales.rows[1][12]
    assert.equal(sheets.Sales.rows[1][11], 'voided')

    const retry = call('void', request)
    assert.equal(retry.ok, true)
    assert.equal(retry.data.sale_status, 'voided')
    assert.equal(sheets.Sales.rows[1][12], voidedAt)
    assert.equal(sheets.Sales.rows.length, 2)
    assert.deepEqual(sheets.AuditLog.rows.slice(1).map((row) => row[2]), ['CREATED', 'VOID_REQUESTED', 'VOIDED'])
    assert.equal(call('sales', { limit: 30 }).data.sales.length, 1)
    assert.equal(call('summary', {}).data.revenue, 0)
  }
})

test('unsigned requests cannot read sales', () => {
  const { sheets, raw } = harness()
  assert.equal(raw(JSON.stringify({ action: 'sales', payload: {}, timestamp: Date.now() }), '').code, 'AUTH')
  assert.equal(sheets.Sales.rows.length, 1)
})

test('unified Apps Script handles pre-orders, pickup confirmation, and walk-in tabs in one spreadsheet', () => {
  const { sheets, call, context } = harness()

  // 1. Pre-order writes to Orders tab
  const orderRes = JSON.parse(context.doPost({
    postData: { contents: JSON.stringify({ type: 'order', code: 'WB-AB12', name: 'Aye', contact: '0812345678', pickupDate: 'Thu, 26 Nov 2026', slot: '12:00 PM', items: ['1 × Classic'], wafers: 1, teas: 0, subtotal: 45, discount: 5, total: 40 }) },
  }).text)
  assert.equal(orderRes.ok, true)
  assert.equal(sheets.Orders.rows.length, 2)

  // 2. Walk-in sale writes to Sales, SaleItems, AuditLog tabs
  const walkinRes = call('create', { request_id: randomUUID(), staff_id: 'admin@example.com', payment_method: 'PromptPay', ...calculateSale({ classic: 1, tea: 1 }) })
  assert.equal(walkinRes.ok, true)
  assert.equal(walkinRes.data.total, 75)
  assert.equal(sheets.Sales.rows.length, 2)
  assert.equal(sheets.SaleItems.rows.length, 3)

  // 3. Pre-order pickup enforces admin confirmation in Orders sheet
  const list = call('preorders', {})
  assert.equal(list.ok, true)
  assert.equal(list.data.preorders.length, 1)
  assert.equal(list.data.preorders[0].confirmed, false)

  const blocked = call('pickup', { code: 'WB-AB12', staff_id: 'admin@example.com' })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.code, 'CONFLICT')

  // Admin types Yes in column 16 (Confirmed?)
  sheets.Orders.rows[1][15] = 'Yes'
  const picked = call('pickup', { code: 'wb-ab12', staff_id: 'admin@example.com' })
  assert.equal(picked.ok, true)
  assert.equal(picked.data.confirmed, true)
  assert.equal(picked.data.picked_up, true)
  assert.match(picked.data.picked_up_info, /Yes · .* · admin@example\.com/)
  assert.equal(sheets.AuditLog.rows.at(-1)[2], 'PICKED_UP')
})
