import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CONFIG } from '../config.js'
import { EMPTY_CART, cartLines, makeOrderCode, pickupSlots, preorderOpen, priceCart } from '../pricing.js'
import { blobToBase64, compressImage, postJSON } from '../slip.js'
import PayQR from './PayQR.jsx'
import { makeTicket } from '../ticket.js'

const STORAGE_KEY = 'wafer-tea-last-order'

function orderText(o) {
  const e = CONFIG.event
  return [
    `Pre-order ${o.code} — ${CONFIG.brand}`,
    `Name: ${o.name}`,
    `Contact: ${o.contact}`,
    `Pickup: ${e.dateLabel}, ${o.slot} · ${e.place} (${e.placeDetail})`,
    ...o.items.map((i) => `• ${i}`),
    `Total: ${o.total} baht (pre-order −${o.discount} included)`,
    o.note ? `Note: ${o.note}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function lineLink(text) {
  const id = CONFIG.lineOAId
  const q = encodeURIComponent(text)
  return id ? `https://line.me/R/oaMessage/${id}/?${q}` : `https://line.me/R/share?text=${q}`
}

export default function Preorder({ cart, setCart }) {
  const open = preorderOpen()
  const slots = useMemo(pickupSlots, [])
  const pricing = priceCart(cart, { isPreorder: true })
  const lines = cartLines(cart)
  const canPay = Boolean(CONFIG.payment?.promptPayId)
  const canUpload = canPay && Boolean(CONFIG.orderEndpoint)

  const [form, setForm] = useState({ name: '', contact: '', slot: '', note: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | error
  const [done, setDone] = useState(null) // the confirmation being shown
  const [last, setLast] = useState(null) // the previous order saved in this browser, shown only as a small reminder
  const [copied, setCopied] = useState(false)
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState('')
  const [slipState, setSlipState] = useState({ status: 'idle', message: '' }) // idle | sending | error
  const [ticketUrl, setTicketUrl] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.code) setLast(saved)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!slipFile) return setSlipPreview('')
    const url = URL.createObjectURL(slipFile)
    setSlipPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [slipFile])

  const cartAtOpen = useRef(cart)
  useEffect(() => {
    cartAtOpen.current = cart
  }, [done])
  useEffect(() => {
    if (done && cart !== cartAtOpen.current) setDone(null)
  }, [cart])

  useEffect(() => {
    let live = true
    if (done?.slipSent) makeTicket(done).then((u) => live && setTicketUrl(u)).catch(() => live && setTicketUrl(''))
    else setTicketUrl('')
    return () => {
      live = false
    }
  }, [done])

  const keep = (order) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    } catch {
      /* private mode */
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const remove = (key) => setCart((c) => ({ ...c, [key]: 0 }))

  const validate = () => {
    const er = {}
    if (!pricing.items) er.cart = 'Add at least one wafer or tea to your order.'
    if (!form.name.trim()) er.name = 'Please tell us your name.'
    if (!form.contact.trim()) er.contact = 'Add your LINE ID or phone number so we can reach you.'
    if (!form.slot) er.slot = 'Choose a pickup time.'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setStatus('sending')
    const order = {
      type: 'order',
      code: makeOrderCode(),
      createdAt: new Date().toISOString(),
      name: form.name.trim(),
      contact: form.contact.trim(),
      slot: form.slot,
      pickupDate: CONFIG.event.dateLabel,
      note: form.note.trim(),
      items: lines.map((l) => `${l.qty} × ${l.label}`),
      wafers: pricing.waferCount,
      teas: pricing.teaCount,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      total: pricing.total,
      saved: false,
      slipSent: false,
    }
    try {
      if (CONFIG.orderEndpoint) {
        const res = await postJSON(CONFIG.orderEndpoint, order)
        if (!res.ok) throw new Error(res.error)
        order.saved = true
      }
      keep(order)
      setLast(order)
      setDone(order)
      setCart(EMPTY_CART)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  const sendSlip = async () => {
    if (!slipFile || !done) return
    setSlipState({ status: 'sending', message: '' })
    try {
      const blob = await compressImage(slipFile)
      const data = await blobToBase64(blob)
      const res = await postJSON(CONFIG.orderEndpoint, { type: 'slip', code: done.code, name: done.name, mime: 'image/jpeg', data })
      if (!res.ok) throw new Error(res.error || 'Upload failed.')
      const next = { ...done, slipSent: true }
      keep(next)
      setLast(next)
      setDone(next)
      setSlipFile(null)
      setSlipState({ status: 'idle', message: '' })
    } catch (err) {
      setSlipState({ status: 'error', message: err?.message || 'Upload failed. Please try again.' })
    }
  }

  const forget = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setLast(null)
  }

  const newOrder = () => {
    setDone(null)
    setSlipFile(null)
    setSlipState({ status: 'idle', message: '' })
    setForm({ name: '', contact: '', slot: '', note: '' })
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  if (done) {
    const text = orderText(done)
    const slipText = `${text}\n\nI have paid ${done.total} baht by PromptPay. My payment slip is attached.`
    const paid = done.slipSent
    return (
      <aside className="order order-done" aria-live="polite">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <p className="done-badge">{paid ? '✓ Slip received' : canPay ? 'Step 2 of 2: pay to confirm' : done.saved ? '✓ Pre-order received' : 'Almost done'}</p>
          <h3>
            {paid ? 'Thank you! We will confirm your payment' : canPay ? `Pay ฿${done.total} to confirm` : done.saved ? 'See you at the booth!' : 'Send it to us on LINE to confirm'}
          </h3>
          <div className="code">{done.code}</div>
          <p className="done-meta">
            <strong>{done.pickupDate}, {done.slot}</strong>
            <br />
            {CONFIG.event.place} · {CONFIG.event.placeDetail}
          </p>
          <ul className="lines">
            {done.items.map((t, i) => (
              <li key={i}><span>{t}</span></li>
            ))}
          </ul>
          <p className="done-total">
            <span>Total {done.discount ? `(pre-order −฿${done.discount})` : ''}</span>
            <b>฿{done.total}</b>
          </p>

          {canPay && !paid && (
            <div className="pay-box">
              <p className="pay-title">1. Scan with your banking app</p>
              <PayQR amount={done.total} code={done.code} />
              <p className="pay-title">2. Send us your payment slip</p>
              {canUpload ? (
                <>
                  <label className="slip-pick">
                    <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} />
                    <span>{slipFile ? 'Choose another picture' : 'Choose slip screenshot'}</span>
                  </label>
                  {slipPreview && <img className="slip-preview" src={slipPreview} alt="Your payment slip" />}
                  <button type="button" className="btn btn-gold btn-block" disabled={!slipFile || slipState.status === 'sending'} onClick={sendSlip}>
                    {slipState.status === 'sending' ? 'Sending…' : 'Send my slip'}
                  </button>
                  {slipState.status === 'error' && <p className="err">{slipState.message}</p>}
                  <p className="small">The slip is only used to check your payment. We confirm it as soon as we can.</p>
                </>
              ) : (
                <a className="btn btn-gold btn-block" href={lineLink(slipText)} target="_blank" rel="noreferrer">
                  Send the slip on LINE
                </a>
              )}
            </div>
          )}

          {paid && ticketUrl && (
            <div className="ticket-box">
              <p className="pay-title">Your order ticket</p>
              <img className="ticket-preview" src={ticketUrl} alt={`Order ticket ${done.code} for ${done.name}`} />
              <a className="btn btn-gold btn-block" href={ticketUrl} download={`ticket-${done.code}.png`}>Save my ticket (PNG)</a>
              <p className="small">You can also press and hold the picture to save it. Show it at the booth with your name.</p>
            </div>
          )}

          <p className="small">
            {paid ? 'We will message you when your payment is confirmed. ' : ''}
            {canPay ? 'Your order is confirmed after we check your payment. ' : ''}
            On {CONFIG.event.dayMonth}, tell us your name or show this code to collect.
          </p>
          <div className="order-actions">
            <button type="button" className="btn btn-ghost-light" onClick={() => copy(text)}>
              {copied ? 'Copied ✓' : 'Copy order'}
            </button>
            {(!canPay || paid) && (
              <a className="btn btn-ghost-light" href={lineLink(text)} target="_blank" rel="noreferrer">Send on LINE</a>
            )}
          </div>
          <button type="button" className="linklike" onClick={newOrder}>Make another pre-order</button>
        </motion.div>
      </aside>
    )
  }

  return (
    <aside className="order">
      <h3>Your pre-order</h3>
      {last && (
        <div className="last-order">
          <span>
            Last order <b>{last.code}</b> · ฿{last.total} · {last.slipSent ? 'slip received ✓' : 'waiting for your payment slip'}
          </span>
          <button type="button" onClick={() => setDone(last)}>View</button>
          <button type="button" onClick={forget} aria-label="Hide the last order">×</button>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="empty">Nothing yet. Use the + buttons to choose your wafers and tea.</p>
      ) : (
        <ul className="lines">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16, height: 0 }}
              >
                <span><b>{l.qty} ×</b> {l.label}</span>
                <button type="button" onClick={() => remove(l.key)} aria-label={`Remove ${l.label}`}>×</button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {errors.cart && <p className="err">{errors.cart}</p>}

      <dl className="totals">
        <div><dt>Wafers ({pricing.waferCount})</dt><dd>฿{pricing.waferTotal}</dd></div>
        <div><dt>Tea ({pricing.teaCount})</dt><dd>฿{pricing.teaTotal}</dd></div>
        {pricing.pairs > 0 && <div className="save"><dt>Combo saving ({pricing.pairs} × wafer + tea)</dt><dd>−฿{pricing.comboSaving}</dd></div>}
        {pricing.discount > 0 && <div className="save"><dt>Pre-order discount{CONFIG.preorder.mode === 'perItem' ? ` (${pricing.discountedItems} × ฿${CONFIG.preorder.discount})` : ''}</dt><dd>−฿{pricing.discount}</dd></div>}
        <div className="grand"><dt>Total</dt><dd>฿{pricing.total}</dd></div>
      </dl>

      {!open ? (
        <p className="closed">Pre-orders are closed. Come to the booth on {CONFIG.event.dateLabel}!</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label>
            Your name
            <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Aye" />
            {errors.name && <span className="err">{errors.name}</span>}
          </label>
          <label>
            LINE ID or phone
            <input value={form.contact} onChange={set('contact')} autoComplete="tel" placeholder="so we can reach you" />
            {errors.contact && <span className="err">{errors.contact}</span>}
          </label>
          <label>
            Pickup time on {CONFIG.event.dayMonth}
            <select value={form.slot} onChange={set('slot')}>
              <option value="">Choose a time…</option>
              {slots.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.slot && <span className="err">{errors.slot}</span>}
          </label>
          <label>
            Note or allergies <small>(optional)</small>
            <textarea rows="2" value={form.note} onChange={set('note')} placeholder="e.g. no hazelnut" />
          </label>

          <p className="small">{CONFIG.allergy}</p>
          <button className="btn btn-gold btn-block" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : canPay ? `Next: pay ฿${pricing.total}` : `Pre-order · ฿${pricing.total}`}
          </button>
          {status === 'error' && <p className="err">Could not send. Please check your connection and try again.</p>}
          <p className="small">{CONFIG.preorder.paymentNote}</p>
          {import.meta.env.DEV && !CONFIG.orderEndpoint && (
            <p className="dev">Dev note: orders and slips are not saved yet. Set VITE_ORDER_ENDPOINT in .env.local (see apps-script/README.md).</p>
          )}
        </form>
      )}
    </aside>
  )
}
