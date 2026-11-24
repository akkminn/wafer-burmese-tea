import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { WALK_IN_PRODUCTS } from '../catalog.js'
import { CONFIG } from '../config.js'
import { COMBOS } from '../data.js'
import { EMPTY_CART, priceCart } from '../pricing.js'
import { promptPayPayload } from '../promptpay.js'
import { staffApi, staffLogin } from './api.js'

const PRODUCT_IDS = Object.keys(WALK_IN_PRODUCTS)
const money = (n) => `฿${Number(n || 0).toLocaleString('en-US')}`
const PENDING_KEY = 'walk-in-pending-request'
const SESSION_KEY = 'walk-in-staff-session'

function readPending() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    if (typeof value?.request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.request_id) ||
        !['Cash', 'PromptPay'].includes(value.payment_method) ||
        PRODUCT_IDS.some((id) => !Number.isInteger(value.cart?.[id]) || value.cart[id] < 0 || value.cart[id] > 20)) return null
    return value
  } catch { return null }
}

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (typeof value?.token === 'string' && value.token && typeof value?.email === 'string' && value.email) {
      return { token: value.token, email: value.email, canVoid: Boolean(value.canVoid) }
    }
    return null
  } catch { return null }
}

function formatTime(iso) {
  if (!iso) return ''
  const match = /T(\d{2}:\d{2})/.exec(String(iso))
  return match ? match[1] : String(iso)
}

function Login({ onSession, initialError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(initialError || '')

  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const data = await staffLogin(email.trim(), password)
      onSession({ token: data.token, email: data.email, canVoid: Boolean(data.can_void) })
    } catch (err) {
      setError(err.message || 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="staff-login">
      <div className="staff-login-head">
        <span className="staff-badge">Staff POS</span>
        <h2 className="staff-login-title">Sign in</h2>
        <p className="staff-muted">Use your staff account email and password to record walk-in sales.</p>
      </div>
      {error && <p role="alert" className="staff-error">{error}</p>}
      <form className="staff-login-form" onSubmit={submit} noValidate>
        <label className="staff-field">
          <span>Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
          />
        </label>
        <label className="staff-field">
          <span>Password</span>
          <div className="staff-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              className="staff-toggle-pw"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <button className="staff-primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function PromptPayCard({ amount, onOpenFullScreen }) {
  const { promptPayId, accountName, bank, method } = CONFIG.payment
  const [svg, setSvg] = useState('')
  const payload = useMemo(() => (promptPayId && amount > 0 ? promptPayPayload(promptPayId, amount) : ''), [promptPayId, amount])

  useEffect(() => {
    let live = true
    if (!payload) {
      setSvg('')
      return undefined
    }
    QRCode.toString(payload, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b3d6b', light: '#ffffff' },
    })
      .then((markup) => { if (live) setSvg(markup) })
      .catch(() => { if (live) setSvg('') })
    return () => { live = false }
  }, [payload])

  if (!promptPayId) {
    return (
      <div className="staff-qr-missing">
        PromptPay ID is not configured (`VITE_PROMPTPAY_ID`). Verify transfer manually on the bank app.
      </div>
    )
  }

  return (
    <div className="staff-qr-card">
      <div className="staff-qr-top">
        <span className="staff-qr-tag">{method} QR</span>
        <strong className="staff-qr-amount">{money(amount)}</strong>
      </div>
      <div
        className="staff-qr-box"
        role="img"
        aria-label={`PromptPay QR code for ${amount} baht`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="staff-qr-meta">
        <b>{accountName}</b>
        <span>{bank} · Exact amount pre-filled</span>
      </p>
      <button type="button" className="staff-qr-expand" onClick={onOpenFullScreen}>
        Show full-screen QR to customer
      </button>
    </div>
  )
}

function FullScreenQRModal({ amount, onClose }) {
  const { promptPayId, accountName, bank, method } = CONFIG.payment
  const [svg, setSvg] = useState('')
  const payload = useMemo(() => (promptPayId && amount > 0 ? promptPayPayload(promptPayId, amount) : ''), [promptPayId, amount])

  useEffect(() => {
    let live = true
    if (!payload) return undefined
    QRCode.toString(payload, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b3d6b', light: '#ffffff' },
    })
      .then((markup) => { if (live) setSvg(markup) })
      .catch(() => { if (live) setSvg('') })
    return () => { live = false }
  }, [payload])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="staff-qr-modal" role="dialog" aria-modal="true" aria-label={`Customer PromptPay QR for ${amount} baht`}>
      <div className="staff-qr-modal-card">
        <p className="staff-qr-modal-brand">{CONFIG.brand} · {method}</p>
        <p className="staff-qr-modal-amount">{money(amount)}</p>
        <div
          className="staff-qr-modal-code"
          role="img"
          aria-label={`Large PromptPay QR code for ${amount} baht`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="staff-qr-modal-acct">
          <b>{accountName}</b>
          <span>{bank}</span>
        </p>
        <button type="button" className="staff-primary" onClick={onClose}>
          Done · Back to POS
        </button>
      </div>
    </div>
  )
}

function SaleDetails({ sale, canVoid, onVoid, busy }) {
  const [reason, setReason] = useState('')
  const voidSale = () => {
    if (reason.trim().length < 5 || !window.confirm(`Void sale ${sale.sale_id}? This will remove it from revenue.`)) return
    onVoid(sale.sale_id, reason.trim())
  }
  return (
    <details className={`staff-sale ${sale.sale_status === 'voided' ? 'is-voided' : ''}`}>
      <summary>
        <span>
          <b>{sale.sale_id}</b>
          <small>{formatTime(sale.timestamp)} · {sale.payment_method}</small>
        </span>
        <strong>{money(sale.total)}</strong>
        <em className={sale.sale_status === 'voided' ? 'is-voided' : ''}>{sale.sale_status}</em>
      </summary>
      <div className="staff-sale-body">
        <p className="staff-muted">Recorded by {sale.staff_id} · {sale.timestamp}</p>
        <ul>
          {sale.items.map((item) => (
            <li key={item.product_id}>
              <span>{item.quantity} × {item.product_name}</span>
              <b>{money(item.line_total)}</b>
            </li>
          ))}
        </ul>
        <p>Subtotal {money(sale.subtotal)} · Combo saving −{money(sale.combo_discount)}</p>
        <p>Payment: {sale.payment_method} ({sale.payment_status})</p>
        {sale.sale_status === 'voided' && (
          <p className="staff-void-note">Voided by {sale.voided_by} at {sale.voided_at}: {sale.void_reason}</p>
        )}
        {canVoid && sale.sale_status === 'completed' && (
          <div className="staff-void">
            <label>
              Reason for void
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="Describe the correction (min 5 chars)"
              />
            </label>
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={voidSale}>
              Void sale
            </button>
          </div>
        )}
      </div>
    </details>
  )
}

export default function WalkInApp() {
  const [session, setSession] = useState(readSession)
  const [tab, setTab] = useState('sale') // 'sale' | 'summary' | 'history'
  const [cart, setCart] = useState(() => readPending()?.cart || { ...EMPTY_CART })
  const [payment, setPayment] = useState(() => readPending()?.payment_method || 'Cash')
  const [confirmed, setConfirmed] = useState(false)
  const [review, setReview] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [pending, setPending] = useState(readPending)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const reviewRef = useRef(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [summary, setSummary] = useState(null)
  const [canVoid, setCanVoid] = useState(() => Boolean(readSession()?.canVoid))
  const pricing = priceCart(cart, { isPreorder: false })

  const token = session?.token || ''

  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
    } catch { /* storage may be unavailable */ }
  }, [session])

  useEffect(() => {
    try {
      if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      else localStorage.removeItem(PENDING_KEY)
    } catch { /* storage may be unavailable */ }
  }, [pending])

  const clearSession = useCallback((reason = '') => {
    setSession(null)
    setHistory([])
    setSummary(null)
    setCanVoid(false)
    setQrModalOpen(false)
    if (reason) setError(reason)
  }, [])

  const onSession = useCallback((next) => {
    setSession(next)
    setCanVoid(Boolean(next.canVoid))
    setError('')
    setMessage('')
  }, [])

  const refresh = useCallback(async (credential = token) => {
    if (!credential) return
    try {
      const [sales, totals] = await Promise.all([staffApi('sales', credential), staffApi('summary', credential)])
      setHistory(sales.sales)
      setCanVoid(Boolean(sales.can_void))
      setSummary(totals)
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        clearSession(err.message)
      } else {
        setError(err.message)
      }
    }
  }, [token, clearSession])

  useEffect(() => { if (token) refresh(token) }, [token, refresh])

  const change = (id, amount) => {
    if (pending || busy) return
    setCart((current) => ({ ...current, [id]: Math.max(0, Math.min(20, current[id] + amount)) }))
    setConfirmed(false)
    setReview(false)
    setMessage('')
  }

  const addCombo = (combo) => {
    if (pending || busy) return
    setCart((current) => {
      const next = { ...current }
      for (const [id, qty] of Object.entries(combo.add)) {
        next[id] = Math.min(20, (next[id] || 0) + qty)
      }
      return next
    })
    setConfirmed(false)
    setReview(false)
    setMessage('')
  }

  const clearCart = () => {
    if (pending || busy) return
    setCart({ ...EMPTY_CART })
    setConfirmed(false)
    setReview(false)
    setQrModalOpen(false)
    setMessage('')
    setError('')
  }

  const openReview = () => {
    if (!pricing.items || pending || busy) return
    setReview(true)
    setTimeout(() => {
      reviewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  const settle = (sale) => {
    setPending(null)
    setCart({ ...EMPTY_CART })
    setConfirmed(false)
    setReview(false)
    setQrModalOpen(false)
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
      if (err.status === 401 || err.status === 403) {
        clearSession(err.message)
      } else {
        setError(`${err.message} Check this request before retrying.`)
      }
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
      if (err.status === 401 || err.status === 403) {
        clearSession(err.message)
      } else {
        setError(err.message)
      }
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
      if (err.status === 401 || err.status === 403) {
        clearSession(err.message)
      } else {
        setError(err.message)
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const showStickyBar = Boolean(token && tab === 'sale' && pricing.items > 0 && !review && !pending)

  return (
    <main className={`staff-shell ${token ? 'has-tabs' : ''} ${showStickyBar ? 'has-sticky-bar' : ''}`}>
      <header className="staff-header">
        <div>
          <small>{CONFIG.brand} · Staff</small>
          <h1>Walk-in POS</h1>
          {session?.email && <p className="staff-user-email">{session.email}</p>}
        </div>
        {token && (
          <button type="button" className="staff-signout" onClick={() => clearSession()}>
            Sign out
          </button>
        )}
      </header>

      {!token ? (
        <Login onSession={onSession} initialError={error} />
      ) : (
        <>
          {message && <p role="status" className="staff-success">{message}</p>}
          {error && <p role="alert" className="staff-error">{error}</p>}

          <div className="staff-layout">
            {/* NEW SALE PANEL */}
            <section className={`staff-panel staff-pane ${tab === 'sale' ? 'is-active' : ''}`} aria-label="New sale">
              <div className="staff-row">
                <h2>New sale</h2>
                {pricing.items > 0 && !pending && (
                  <button type="button" className="staff-clear-btn" disabled={busy} onClick={clearCart}>
                    Clear
                  </button>
                )}
              </div>
              <p className="staff-muted">Quick combos or tap items below. Combo savings apply automatically.</p>

              <div className="staff-combos" role="group" aria-label="Quick combos">
                {COMBOS.map((combo) => (
                  <button
                    key={combo.name}
                    type="button"
                    className="staff-combo-chip"
                    disabled={!!pending || busy}
                    onClick={() => addCombo(combo)}
                  >
                    <strong>+ {combo.name}</strong>
                    <span>{money(combo.price)}</span>
                  </button>
                ))}
              </div>

              <div className="staff-products">
                {PRODUCT_IDS.map((id) => (
                  <div className={`staff-product ${cart[id] > 0 ? 'has-qty' : ''}`} key={id}>
                    <div>
                      <b>{WALK_IN_PRODUCTS[id].name}</b>
                      <span>{money(WALK_IN_PRODUCTS[id].price)}</span>
                    </div>
                    <div className="staff-qty">
                      <button
                        type="button"
                        aria-label={`Remove one ${WALK_IN_PRODUCTS[id].name}`}
                        disabled={!cart[id] || !!pending || busy}
                        onClick={() => change(id, -1)}
                      >
                        −
                      </button>
                      <output aria-label={`${WALK_IN_PRODUCTS[id].name} quantity`}>{cart[id]}</output>
                      <button
                        type="button"
                        aria-label={`Add one ${WALK_IN_PRODUCTS[id].name}`}
                        disabled={cart[id] >= 20 || !!pending || busy}
                        onClick={() => change(id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="staff-total">
                <h3>Order summary</h3>
                {pricing.items ? (
                  <ul className="staff-cart-lines">
                    {PRODUCT_IDS.filter((id) => cart[id]).map((id) => (
                      <li key={id}>
                        <span>{cart[id]} × {WALK_IN_PRODUCTS[id].name}</span>
                        <b>{money(cart[id] * WALK_IN_PRODUCTS[id].price)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="staff-muted">No items selected.</p>
                )}
                <p><span>Subtotal</span><b>{money(pricing.waferTotal + pricing.teaTotal)}</b></p>
                <p className={pricing.comboSaving > 0 ? 'staff-saving' : ''}>
                  <span>Combo saving</span>
                  <b>−{money(pricing.comboSaving)}</b>
                </p>
                <p className="grand"><span>Total</span><b>{money(pricing.total)}</b></p>
              </div>

              <fieldset disabled={!!pending || busy} className="staff-payment">
                <legend>Payment method</legend>
                <label className={payment === 'Cash' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'Cash'}
                    onChange={() => { setPayment('Cash'); setConfirmed(false); setReview(false); setQrModalOpen(false) }}
                  />
                  <span>Cash</span>
                </label>
                <label className={payment === 'PromptPay' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'PromptPay'}
                    onChange={() => { setPayment('PromptPay'); setConfirmed(false); setReview(false) }}
                  />
                  <span>PromptPay QR</span>
                </label>
              </fieldset>

              {payment === 'PromptPay' && pricing.total > 0 && (
                <PromptPayCard amount={pricing.total} onOpenFullScreen={() => setQrModalOpen(true)} />
              )}

              {!review && (
                <button
                  className="staff-primary staff-review-trigger"
                  type="button"
                  disabled={!pricing.items || !!pending || busy}
                  onClick={openReview}
                >
                  Review sale · {money(pricing.total)}
                </button>
              )}

              {review && !pending && (
                <div className="staff-review" ref={reviewRef}>
                  <h3>Confirm this sale</h3>
                  <p>{pricing.items} items · {payment} · <strong>{money(pricing.total)}</strong></p>
                  <label className="staff-check-label">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>I verified that {payment === 'Cash' ? 'cash was received' : 'the PromptPay payment was received'}.</span>
                  </label>
                  <div className="staff-review-actions">
                    <button type="button" onClick={() => setReview(false)}>Edit</button>
                    <button className="staff-primary" type="button" disabled={!confirmed || busy} onClick={submit}>
                      Record completed sale
                    </button>
                  </div>
                </div>
              )}

              {pending && (
                <div className="staff-pending">
                  <p>Request ID: <code>{pending.request_id}</code></p>
                  <p>Keep this cart until its status is confirmed.</p>
                  <div className="staff-review-actions">
                    <button type="button" disabled={busy} onClick={check}>Check status</button>
                    <button type="button" disabled={busy} onClick={() => record(pending)}>
                      {busy ? 'Saving…' : 'Retry same request'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT COLUMN ON DESKTOP / SEPARATE TABS ON PHONE */}
            <div className="staff-side-col">
              {/* SUMMARY PANEL */}
              <section className={`staff-panel staff-pane ${tab === 'summary' ? 'is-active' : ''}`} aria-label="Today's summary">
                <div className="staff-row">
                  <h2>Today’s sales</h2>
                  <button type="button" disabled={busy} onClick={() => refresh()}>Refresh</button>
                </div>
                {summary ? (
                  <>
                    <p className="staff-date">{summary.date} · Asia/Bangkok</p>
                    <div className="staff-stats">
                      <div><span>Revenue</span><b>{money(summary.revenue)}</b></div>
                      <div><span>Transactions</span><b>{summary.transactions}</b></div>
                      <div><span>Cash</span><b>{money(summary.cash)}</b></div>
                      <div><span>PromptPay</span><b>{money(summary.promptpay)}</b></div>
                    </div>
                    <h3>Products sold</h3>
                    <ul className="staff-counts">
                      {PRODUCT_IDS.map((id) => (
                        <li key={id}>
                          <span>{WALK_IN_PRODUCTS[id].name}</span>
                          <b>{summary.product_quantities[id] || 0}</b>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="staff-muted">Loading summary…</p>
                )}
              </section>

              {/* HISTORY PANEL */}
              <section className={`staff-panel staff-pane ${tab === 'history' ? 'is-active' : ''}`} aria-label="Recent transactions">
                <div className="staff-row">
                  <h2>Recent transactions</h2>
                  <button type="button" disabled={busy} onClick={() => refresh()}>Refresh</button>
                </div>
                {history.length ? (
                  history.map((sale) => (
                    <SaleDetails key={sale.sale_id} sale={sale} canVoid={canVoid} onVoid={voidSale} busy={busy} />
                  ))
                ) : (
                  <p className="staff-muted">No saved transactions yet.</p>
                )}
              </section>
            </div>
          </div>

          {/* STICKY MOBILE TOTAL BAR */}
          {showStickyBar && (
            <div className="staff-sticky-bar">
              <div className="staff-sticky-info">
                <small>
                  {pricing.items} {pricing.items === 1 ? 'item' : 'items'}
                  {pricing.comboSaving > 0 ? ` · saved ${money(pricing.comboSaving)}` : ''}
                </small>
                <strong>{money(pricing.total)}</strong>
              </div>
              <div className="staff-sticky-actions">
                {payment === 'PromptPay' && CONFIG.payment.promptPayId && (
                  <button type="button" className="staff-sticky-qr" onClick={() => setQrModalOpen(true)}>
                    QR
                  </button>
                )}
                <button type="button" className="staff-primary" onClick={openReview}>
                  Review · {money(pricing.total)}
                </button>
              </div>
            </div>
          )}

          {/* MOBILE BOTTOM TAB BAR */}
          <nav className="staff-tabs" aria-label="POS sections">
            <button type="button" className={tab === 'sale' ? 'is-active' : ''} onClick={() => setTab('sale')}>
              <span>New Sale</span>
              {pricing.items > 0 && <em className="staff-tab-badge">{pricing.items}</em>}
            </button>
            <button type="button" className={tab === 'summary' ? 'is-active' : ''} onClick={() => setTab('summary')}>
              <span>Summary</span>
            </button>
            <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>
              <span>History</span>
              {history.length > 0 && <em className="staff-tab-count">{history.length}</em>}
            </button>
          </nav>

          {qrModalOpen && pricing.total > 0 && (
            <FullScreenQRModal amount={pricing.total} onClose={() => setQrModalOpen(false)} />
          )}
        </>
      )}
    </main>
  )
}
