// Deploy as a Web App. Set WALKIN_SHARED_SECRET in Script Properties.
// Optional: set SHEET_ID in Script Properties to override the default pre-order spreadsheet.
const DEFAULT_SHEET_ID = '16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0';
const ZONE = 'Asia/Bangkok';
const SALES_HEADERS = ['sale_id', 'request_id', 'timestamp', 'staff_id', 'sale_type', 'subtotal', 'combo_discount', 'total', 'currency', 'payment_method', 'payment_status', 'sale_status', 'voided_at', 'void_reason', 'voided_by', 'record_state', 'request_hash'];
const ITEM_HEADERS = ['sale_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'line_total'];
const AUDIT_HEADERS = ['timestamp', 'sale_id', 'action', 'staff_id', 'reason'];
const PRODUCT_IDS = ['classic', 'choco', 'mixed', 'teaRegular', 'teaLess'];

function doGet() {
  return ContentService.createTextOutput('Walk-in sales endpoint is running.');
}

// Run once in the Apps Script editor to auto-create Sales, SaleItems, and AuditLog tabs
// inside the pre-order spreadsheet without touching the existing Orders tab.
function setup() {
  const book = openBook_();
  checkSheets_(book);
  SpreadsheetApp.flush();
  Logger.log('Ready. Sales, SaleItems, and AuditLog tabs are prepared in spreadsheet ' + book.getId());
}

function doPost(e) {
  try {
    const envelope = JSON.parse(e.postData.contents);
    const message = String(envelope.message || '');
    const secret = PropertiesService.getScriptProperties().getProperty('WALKIN_SHARED_SECRET');
    if (!secret || !secureEqual_(hex_(Utilities.computeHmacSha256Signature(message, secret)), String(envelope.signature || ''))) {
      return json_({ ok: false, code: 'AUTH', error: 'Invalid signature.' });
    }
    const request = JSON.parse(message);
    if (!Number.isFinite(request.timestamp) || Math.abs(Date.now() - request.timestamp) > 300000) {
      return json_({ ok: false, code: 'AUTH', error: 'Expired request.' });
    }
    if (!['create', 'status', 'sales', 'summary', 'void'].includes(request.action) || !request.payload || typeof request.payload !== 'object') {
      return json_({ ok: false, code: 'INVALID', error: 'Invalid action.' });
    }
    const book = openBook_();
    checkSheets_(book);
    const actions = { create: create_, status: status_, sales: sales_, summary: summary_, void: void_ };
    return json_({ ok: true, data: actions[request.action](book, request.payload) });
  } catch (error) {
    const code = error.code || 'STORAGE';
    console.error(error);
    return json_({ ok: false, code, error: code === 'STORAGE' ? 'Storage operation failed. Check request status.' : error.message });
  }
}

function openBook_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  if (sheetId) return SpreadsheetApp.openById(sheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) fail_('STORAGE', 'Missing SHEET_ID.');
  return active;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function secureEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hex_(bytes) {
  return bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

function now_() {
  return Utilities.formatDate(new Date(), ZONE, "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
}

function dateText_(value) {
  return value instanceof Date ? Utilities.formatDate(value, ZONE, "yyyy-MM-dd'T'HH:mm:ss'+07:00'") : String(value || '');
}

function sheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    if (typeof book.insertSheet !== 'function') fail_('STORAGE', `Missing ${name} worksheet.`);
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
    return sheet;
  }
  const found = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some((h, i) => found[i] !== h)) fail_('STORAGE', `Incorrect ${name} headers.`);
  return sheet;
}

function checkSheets_(book) {
  sheet_(book, 'Sales', SALES_HEADERS);
  sheet_(book, 'SaleItems', ITEM_HEADERS);
  sheet_(book, 'AuditLog', AUDIT_HEADERS);
}

function rows_(sheet, width) {
  const last = sheet.getLastRow();
  return last < 2 ? [] : sheet.getRange(2, 1, last - 1, width).getValues();
}

function saleBy_(sheet, col, value) {
  const rows = rows_(sheet, SALES_HEADERS.length);
  const index = rows.findIndex(row => row[col] === value);
  return index < 0 ? null : { row: index + 2, values: rows[index] };
}

function validateCreate_(p) {
  if (!/^[a-f0-9-]{36}$/i.test(String(p.request_id || ''))) fail_('INVALID', 'Invalid request ID.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.staff_id || ''))) fail_('INVALID', 'Invalid staff ID.');
  if (!['Cash', 'PromptPay'].includes(p.payment_method)) fail_('INVALID', 'Invalid payment method.');
  if (!p.cart || typeof p.cart !== 'object' || !p.items || !Array.isArray(p.items)) fail_('INVALID', 'Invalid sale.');
  if (Object.keys(p.cart).some(id => !PRODUCT_IDS.includes(id))) fail_('INVALID', 'Unknown product.');
  const items = p.items;
  if (!items.length || items.length > PRODUCT_IDS.length || new Set(items.map(i => i.product_id)).size !== items.length) fail_('INVALID', 'Invalid items.');
  for (const item of items) {
    if (!PRODUCT_IDS.includes(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 ||
        p.cart[item.product_id] !== item.quantity || typeof item.product_name !== 'string' || !Number.isInteger(item.unit_price) ||
        item.unit_price <= 0 || item.line_total !== item.quantity * item.unit_price) fail_('INVALID', 'Invalid item values.');
  }
  if (PRODUCT_IDS.some(id => (p.cart[id] || 0) !== (items.find(i => i.product_id === id)?.quantity || 0))) fail_('INVALID', 'Cart does not match items.');
  const raw = items.reduce((sum, item) => sum + item.line_total, 0);
  const wafers = (p.cart.classic || 0) + (p.cart.choco || 0) + (p.cart.mixed || 0);
  const teas = (p.cart.teaRegular || 0) + (p.cart.teaLess || 0);
  if (p.subtotal !== raw || p.combo_discount !== Math.min(wafers, teas) * 5 || p.total !== raw - p.combo_discount) fail_('INVALID', 'Totals do not match items.');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) fail_('STORAGE', 'Sales are busy. Check status and retry.');
  try {
    const result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function create_(book, p) {
  validateCreate_(p);
  return withLock_(() => {
    const sales = sheet_(book, 'Sales', SALES_HEADERS);
    const items = sheet_(book, 'SaleItems', ITEM_HEADERS);
    const audit = sheet_(book, 'AuditLog', AUDIT_HEADERS);
    const hash = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(p)));
    let entry = saleBy_(sales, 1, p.request_id);
    if (entry && entry.values[16] !== hash) fail_('CONFLICT', 'Request ID already belongs to another sale.');
    if (!entry) {
      const saleId = 'WI-' + Utilities.getUuid().toUpperCase();
      sales.appendRow([saleId, p.request_id, now_(), p.staff_id, 'walk_in', p.subtotal, p.combo_discount, p.total, 'THB', p.payment_method, 'paid', 'completed', '', '', '', 'PENDING', hash]);
      SpreadsheetApp.flush();
      entry = saleBy_(sales, 1, p.request_id);
      if (!entry) fail_('STORAGE', 'Sale could not be read back.');
    }
    const saleId = entry.values[0];
    if (entry.values[15] !== 'COMPLETED') {
      const existing = rows_(items, ITEM_HEADERS.length).filter(row => row[0] === saleId);
      for (const item of p.items) {
        const expected = [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, item.line_total];
        const found = existing.find(row => row[1] === item.product_id);
        if (found && JSON.stringify(found) !== JSON.stringify(expected)) fail_('CONFLICT', 'Stored item differs from request.');
        if (!found) items.appendRow(expected);
      }
      SpreadsheetApp.flush();
      const verified = rows_(items, ITEM_HEADERS.length).filter(row => row[0] === saleId);
      if (verified.length !== p.items.length) fail_('STORAGE', 'Items are incomplete.');
      const logged = rows_(audit, AUDIT_HEADERS.length).some(row => row[1] === saleId && row[2] === 'CREATED');
      if (!logged) audit.appendRow([now_(), saleId, 'CREATED', p.staff_id, 'Payment confirmed by staff']);
      SpreadsheetApp.flush();
      sales.getRange(entry.row, 16).setValue('COMPLETED');
      SpreadsheetApp.flush();
    }
    return publicSale_(saleBy_(sales, 0, saleId).values, rows_(items, ITEM_HEADERS.length));
  });
}

function publicSale_(row, itemRows) {
  return {
    sale_id: row[0], request_id: row[1], timestamp: dateText_(row[2]), staff_id: row[3], sale_type: row[4],
    subtotal: Number(row[5]), combo_discount: Number(row[6]), total: Number(row[7]), currency: row[8],
    payment_method: row[9], payment_status: row[10], sale_status: row[11], voided_at: dateText_(row[12]),
    void_reason: row[13], voided_by: row[14], record_state: row[15],
    items: itemRows.filter(item => item[0] === row[0]).map(item => ({ product_id: item[1], product_name: item[2], quantity: Number(item[3]), unit_price: Number(item[4]), line_total: Number(item[5]) })),
  };
}

function status_(book, p) {
  if (!/^[a-f0-9-]{36}$/i.test(String(p.request_id || ''))) fail_('INVALID', 'Invalid request ID.');
  const sales = sheet_(book, 'Sales', SALES_HEADERS);
  const entry = saleBy_(sales, 1, p.request_id);
  if (!entry) return { state: 'NOT_FOUND' };
  if (entry.values[15] !== 'COMPLETED') return { state: 'PENDING', sale_id: entry.values[0] };
  return { state: 'COMPLETED', sale: publicSale_(entry.values, rows_(sheet_(book, 'SaleItems', ITEM_HEADERS), ITEM_HEADERS.length)) };
}

function sales_(book, p) {
  const limit = Math.max(1, Math.min(100, Number(p.limit) || 30));
  const rows = rows_(sheet_(book, 'Sales', SALES_HEADERS), SALES_HEADERS.length).filter(row => row[15] === 'COMPLETED').slice(-limit).reverse();
  const items = rows_(sheet_(book, 'SaleItems', ITEM_HEADERS), ITEM_HEADERS.length);
  return { sales: rows.map(row => publicSale_(row, items)) };
}

function summary_(book) {
  const today = Utilities.formatDate(new Date(), ZONE, 'yyyy-MM-dd');
  const rows = rows_(sheet_(book, 'Sales', SALES_HEADERS), SALES_HEADERS.length).filter(row => dateText_(row[2]).slice(0, 10) === today && row[15] === 'COMPLETED');
  const paid = rows.filter(row => row[10] === 'paid' && row[11] === 'completed');
  const ids = new Set(paid.map(row => row[0]));
  const product_quantities = {};
  rows_(sheet_(book, 'SaleItems', ITEM_HEADERS), ITEM_HEADERS.length).filter(row => ids.has(row[0])).forEach(row => {
    product_quantities[row[1]] = (product_quantities[row[1]] || 0) + Number(row[3]);
  });
  return {
    date: today, currency: 'THB', revenue: paid.reduce((sum, row) => sum + Number(row[7]), 0),
    transactions: paid.length,
    cash: paid.filter(row => row[9] === 'Cash').reduce((sum, row) => sum + Number(row[7]), 0),
    promptpay: paid.filter(row => row[9] === 'PromptPay').reduce((sum, row) => sum + Number(row[7]), 0),
    product_quantities,
  };
}

function void_(book, p) {
  if (!/^WI-[A-Z0-9-]{8,50}$/.test(String(p.sale_id || '')) || typeof p.reason !== 'string' || p.reason.trim().length < 5 || p.reason.length > 300 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.staff_id || ''))) fail_('INVALID', 'Invalid void request.');
  return withLock_(() => {
    const sales = sheet_(book, 'Sales', SALES_HEADERS);
    const audit = sheet_(book, 'AuditLog', AUDIT_HEADERS);
    const entry = saleBy_(sales, 0, p.sale_id);
    if (!entry || entry.values[15] !== 'COMPLETED') fail_('INVALID', 'Completed sale not found.');
    if (entry.values[11] !== 'voided') {
      if (!rows_(audit, AUDIT_HEADERS.length).some(row => row[1] === p.sale_id && row[2] === 'VOID_REQUESTED')) {
        audit.appendRow([now_(), p.sale_id, 'VOID_REQUESTED', p.staff_id, safeText_(p.reason.trim())]);
        SpreadsheetApp.flush();
      }
      sales.getRange(entry.row, 12, 1, 4).setValues([['voided', now_(), safeText_(p.reason.trim()), p.staff_id]]);
      SpreadsheetApp.flush();
    }
    if (!rows_(audit, AUDIT_HEADERS.length).some(row => row[1] === p.sale_id && row[2] === 'VOIDED')) {
      audit.appendRow([now_(), p.sale_id, 'VOIDED', p.staff_id, safeText_(p.reason.trim())]);
      SpreadsheetApp.flush();
    }
    return publicSale_(saleBy_(sales, 0, p.sale_id).values, rows_(sheet_(book, 'SaleItems', ITEM_HEADERS), ITEM_HEADERS.length));
  });
}

function safeText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
