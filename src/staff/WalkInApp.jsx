import { useCallback, useEffect, useRef, useState } from 'react'
import { WALK_IN_PRODUCTS } from '../catalog.js'
import { EMPTY_CART, priceCart } from '../pricing.js'
import { staffApi } from './api.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const PRODUCT_IDS = Object.keys(WALK_IN_PRODUCTS)
const money = (n) => `฿${Number(n || 0).toLocaleString('en-US')}`
const PENDING_KEY = 'walk-in-pending-request'

function readPending() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    if (typeof value?.request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.request_id) ||
        !['Cash', 'PromptPay'].includes(value.payment_method) ||
        PRODUCT_IDS.some((id) => !Number.isInteger(value.cart?.[id]) || value.cart[id] < 0 || value.cart[id] > 20)) return null
    return value
  } catch { return null }
}

function Login({ onToken }) {
  const button = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!CLIENT_ID) return
    const timer = setInterval(() => {
      if (!window.google?.accounts?.id) return
      clearInterval(timer)
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: ({ credential }) => onToken(credential) })
      window.google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'signin_with', width: 280 })
      setReady(true)
    }, 100)
    return () => clearInterval(timer)
  }, [onToken])
  return <div className="staff-login"><h2 className="staff-login-title">Walk-in sales</h2><p>Staff sign-in is required to record or view sales.</p>{CLIENT_ID ? <div ref={button} /> : <p className="staff-error">Google sign-in is not configured.</p>}{CLIENT_ID && !ready && <p>Loading Google sign-in…</p>}</div>
}

function SaleDetails({ sale, canVoid, onVoid, busy }) {
  const [reason, setReason] = useState('')
  const voidSale = () => {
    if (reason.trim().length < 5 || !window.confirm(`Void sale ${sale.sale_id}? This will remove it from revenue.`)) return
    onVoid(sale.sale_id, reason.trim())
  }
  return <details className={`staff-sale ${sale.sale_status === 'voided' ? 'is-voided' : ''}`}>
    <summary><span><b>{sale.sale_id}</b><small>{sale.timestamp} · {sale.payment_method}</small></span><strong>{money(sale.total)}</strong><em>{sale.sale_status}</em></summary>
    <div className="staff-sale-body"><p>Recorded by {sale.staff_id}</p><ul>{sale.items.map((item) => <li key={item.product_id}>{item.quantity} × {item.product_name} · {money(item.line_total)}</li>)}</ul><p>Subtotal {money(sale.subtotal)} · Combo saving −{money(sale.combo_discount)}</p><p>Payment: {sale.payment_status}</p>{sale.sale_status === 'voided' && <p>Voided by {sale.voided_by} at {sale.voided_at}: {sale.void_reason}</p>}{canVoid && sale.sale_status === 'completed' && <div className="staff-void"><label>Reason for void<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Describe the correction" /></label><button type="button" disabled={busy || reason.trim().length < 5} onClick={voidSale}>Void sale</button></div>}</div>
  </details>
}

export default function WalkInApp() {
  const [token, setToken] = useState('')
  const [cart, setCart] = useState(() => readPending()?.cart || { ...EMPTY_CART })
  const [payment, setPayment] = useState(() => readPending()?.payment_method || 'Cash')
  const [confirmed, setConfirmed] = useState(false)
  const [review, setReview] = useState(false)
  const [pending, setPending] = useState(readPending)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [summary, setSummary] = useState(null)
  const [canVoid, setCanVoid] = useState(false)
  const pricing = priceCart(cart, { isPreorder: false })

  useEffect(() => {
    try {
      if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      else localStorage.removeItem(PENDING_KEY)
    } catch { /* storage may be unavailable */ }
  }, [pending])

  const onToken = useCallback((value) => { setToken(value); setError('') }, [])

  const refresh = useCallback(async (credential = token) => {
    if (!credential) return
    try {
      const [sales, totals] = await Promise.all([staffApi('sales', credential), staffApi('summary', credential)])
      setHistory(sales.sales)
      setCanVoid(sales.can_void)
      setSummary(totals)
    } catch (err) {
      setError(err.message)
      if (err.status === 401 || err.status === 403) setToken('')
    }
  }, [token])

  useEffect(() => { if (token) refresh(token) }, [token, refresh])

  const change = (id, amount) => {
    if (pending || busy) return
    setCart((current) => ({ ...current, [id]: Math.max(0, Math.min(20, current[id] + amount)) }))
    setConfirmed(false)
    setReview(false)
    setMessage('')
  }

  const settle = (sale) => {
    setPending(null)
    setCart({ ...EMPTY_CART })
    setConfirmed(false)
    setReview(false)
    setMessage(`Saved ${sale.sale_id} · ${money(sale.total)} · ${sale.payment_method}`)
    setError('')
    refresh()
  }

  const record = async (attempt) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const sale = await staffApi('create', token, { ...attempt, payment_confirmed: true })
      settle(sale)
    } catch (err) {
      setError(`${err.message} Check this request before retrying.`)
      if (err.status === 401 || err.status === 403) setToken('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const submit = () => {
    if (!pricing.items || !confirmed || pending || busyRef.current) return
    const attempt = { request_id: crypto.randomUUID(), cart: { ...cart }, payment_method: payment }
    setPending(attempt)
    record(attempt)
  }

  const check = async () => {
    if (!pending || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await staffApi('status', token, { request_id: pending.request_id })
      if (result.state === 'COMPLETED') settle(result.sale)
      else setMessage(result.state === 'PENDING' ? 'The sale is still pending. Retry with the same request ID.' : 'No sale was found. Retry with the same request ID.')
    } catch (err) {
      setError(err.message)
      if (err.status === 401 || err.status === 403) setToken('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const voidSale = async (sale_id, reason) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await staffApi('void', token, { sale_id, reason })
      setMessage(`Voided ${sale_id}.`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return <main className="staff-shell">
    <header className="staff-header"><div><small>ဆရာကြီး · Staff</small><h1>Walk-in sales</h1></div>{token && <button type="button" onClick={() => { setToken(''); setHistory([]); setSummary(null) }}>Sign out</button>}</header>
    {!token ? <Login onToken={onToken} /> : <>
      {message && <p role="status" className="staff-success">{message}</p>}
      {error && <p role="alert" className="staff-error">{error}</p>}
      <div className="staff-layout"><section className="staff-panel"><h2>New sale</h2><p className="staff-muted">Tap to add items. Walk-in combo savings apply automatically.</p>
        <div className="staff-products">{PRODUCT_IDS.map((id) => <div className="staff-product" key={id}><div><b>{WALK_IN_PRODUCTS[id].name}</b><span>{money(WALK_IN_PRODUCTS[id].price)}</span></div><div className="staff-qty"><button type="button" aria-label={`Remove one ${WALK_IN_PRODUCTS[id].name}`} disabled={!cart[id] || !!pending || busy} onClick={() => change(id, -1)}>−</button><output aria-label={`${WALK_IN_PRODUCTS[id].name} quantity`}>{cart[id]}</output><button type="button" aria-label={`Add one ${WALK_IN_PRODUCTS[id].name}`} disabled={cart[id] >= 20 || !!pending || busy} onClick={() => change(id, 1)}>+</button></div></div>)}</div>
        <div className="staff-total"><h3>Order summary</h3>{pricing.items ? <ul className="staff-cart-lines">{PRODUCT_IDS.filter((id) => cart[id]).map((id) => <li key={id}><span>{cart[id]} × {WALK_IN_PRODUCTS[id].name}</span><b>{money(cart[id] * WALK_IN_PRODUCTS[id].price)}</b></li>)}</ul> : <p className="staff-muted">No items selected.</p>}<p><span>Subtotal</span><b>{money(pricing.waferTotal + pricing.teaTotal)}</b></p><p><span>Combo saving</span><b>−{money(pricing.comboSaving)}</b></p><p className="grand"><span>Total</span><b>{money(pricing.total)}</b></p></div>
        <fieldset disabled={!!pending || busy} className="staff-payment"><legend>Payment method</legend><label><input type="radio" name="payment" checked={payment === 'Cash'} onChange={() => { setPayment('Cash'); setConfirmed(false); setReview(false) }} /> Cash</label><label><input type="radio" name="payment" checked={payment === 'PromptPay'} onChange={() => { setPayment('PromptPay'); setConfirmed(false); setReview(false) }} /> PromptPay</label></fieldset>
        {!review && <button className="staff-primary" type="button" disabled={!pricing.items || !!pending || busy} onClick={() => setReview(true)}>Review sale · {money(pricing.total)}</button>}
        {review && !pending && <div className="staff-review"><h3>Confirm this sale</h3><p>{pricing.items} items · {payment} · <strong>{money(pricing.total)}</strong></p><label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I verified that {payment === 'Cash' ? 'cash was received' : 'the PromptPay payment was received'}.</label><div className="staff-review-actions"><button type="button" onClick={() => setReview(false)}>Edit</button><button className="staff-primary" type="button" disabled={!confirmed || busy} onClick={submit}>Record completed sale</button></div></div>}
        {pending && <div className="staff-pending"><p>Request ID: <code>{pending.request_id}</code></p><p>Keep this cart until its status is confirmed.</p><div className="staff-review-actions"><button type="button" disabled={busy} onClick={check}>Check status</button><button type="button" disabled={busy} onClick={() => record(pending)}>{busy ? 'Saving…' : 'Retry same request'}</button></div></div>}
      </section><section className="staff-panel"><div className="staff-row"><h2>Today’s sales</h2><button type="button" disabled={busy} onClick={() => refresh()}>Refresh</button></div>{summary ? <><p className="staff-date">{summary.date} · Asia/Bangkok</p><div className="staff-stats"><div><span>Revenue</span><b>{money(summary.revenue)}</b></div><div><span>Transactions</span><b>{summary.transactions}</b></div><div><span>Cash</span><b>{money(summary.cash)}</b></div><div><span>PromptPay</span><b>{money(summary.promptpay)}</b></div></div><h3>Products sold</h3><ul className="staff-counts">{PRODUCT_IDS.map((id) => <li key={id}><span>{WALK_IN_PRODUCTS[id].name}</span><b>{summary.product_quantities[id] || 0}</b></li>)}</ul></> : <p>Loading summary…</p>}
        <h3>Recent transactions</h3>{history.length ? history.map((sale) => <SaleDetails key={sale.sale_id} sale={sale} canVoid={canVoid} onVoid={voidSale} busy={busy} />) : <p className="staff-muted">No saved transactions yet.</p>}
      </section></div>
    </>}
  </main>
}
