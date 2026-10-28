import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { COMBOS, FLAVORS, TEA } from '../data.js'
import { CONFIG } from '../config.js'
import { EMPTY_CART } from '../pricing.js'
import Preorder from './Preorder.jsx'
import { CupIcon, StackIcon } from './Icons.jsx'

function Stepper({ value, onChange, label, small }) {
  return (
    <div className={`stepper ${small ? 'stepper-sm' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Fewer ${label}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} aria-label={`More ${label}`}>+</button>
    </div>
  )
}

export default function Order({ pick }) {
  const [cart, setCart] = useState(EMPTY_CART)
  const set = (key) => (v) => setCart((c) => ({ ...c, [key]: v }))
  const [selected, setSelected] = useState('')

  const covers = (c, add) => Object.entries(add).every(([k, n]) => (c[k] || 0) >= n)
  const shift = (c, add, sign) => {
    const next = { ...c }
    for (const [k, n] of Object.entries(add)) next[k] = Math.max(0, Math.min(20, (next[k] || 0) + sign * n))
    return next
  }
  const isSelected = (combo) => selected === combo.name && covers(cart, combo.add)

  const toggleCombo = (combo) => {
    const turnOff = isSelected(combo)
    const prev = COMBOS.find((x) => x.name === selected)
    setCart((c) => {
      let next = c
      if (prev && covers(c, prev.add)) next = shift(next, prev.add, -1)
      return turnOff ? next : shift(next, combo.add, +1)
    })
    setSelected(turnOff ? '' : combo.name)
    if (!turnOff && window.matchMedia('(max-width: 1020px)').matches) {
      setTimeout(() => document.querySelector('aside.order')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    }
  }

  useEffect(() => {
    if (pick?.flavorId) setCart((c) => ({ ...c, [pick.flavorId]: Math.min(20, c[pick.flavorId] + 1) }))
  }, [pick])

  return (
    <section className="section order-sec" id="order">
      <div className="wrap">
        <p className="kicker kicker-gold">Pre-order</p>
        <h2>Choose your set</h2>
        <p className="sub">
          Select a combo to start your order with it, or pick what you want below. Choose a pickup time, and save ฿{CONFIG.preorder.discount} on every wafer and tea. A wafer + tea together saves ฿{CONFIG.prices.comboSaving} more, on the day too. Pay in advance by QR, send us the slip, and collect on {CONFIG.event.dayMonth} with your name. Pre-orders close {CONFIG.preorder.closesLabel}.
        </p>

        <div className="combos combos-dark">
          {COMBOS.map((c) => (
            <button type="button" className={`combo ${isSelected(c) ? 'is-selected' : ''}`} key={c.name} onClick={() => toggleCombo(c)} aria-pressed={isSelected(c)} aria-label={`${c.name}, ${c.from ? 'from ' : ''}${c.price} baht`}>
              <span className="combo-text">
                <strong>{c.name}</strong>
                <span>{c.desc}</span>
              </span>
              <b>{c.from && <small>from</small>}฿{c.price}</b>
              <i className="combo-add" aria-hidden="true">{isSelected(c) ? '✓ Selected' : 'Select'}</i>
            </button>
          ))}
        </div>

        <div className="order-grid">
          <div className="picker">
            {FLAVORS.map((f, i) => (
              <motion.div
                key={f.id}
                className={`pick-row ${cart[f.id] > 0 ? 'has' : ''}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.06 }}
              >
                <StackIcon flavor={f.id} />
                <div className="pick-info">
                  <strong>{f.name}</strong>
                  <span>{f.ingredients}</span>
                  <b>฿{f.price}</b>
                </div>
                <Stepper value={cart[f.id]} onChange={set(f.id)} label={`${f.name} wafers`} />
              </motion.div>
            ))}

            <div className={`pick-row ${cart.teaRegular + cart.teaLess > 0 ? 'has' : ''}`}>
              <CupIcon />
              <div className="pick-info">
                <strong>{TEA.name}</strong>
                <span>{TEA.tagline}</span>
                <b>฿{TEA.price}</b>
              </div>
              <div className="tea-steppers">
                <label>Regular <Stepper small value={cart.teaRegular} onChange={set('teaRegular')} label="regular teas" /></label>
                <label>Less sweet <Stepper small value={cart.teaLess} onChange={set('teaLess')} label="less sweet teas" /></label>
              </div>
            </div>
          </div>

          <Preorder cart={cart} setCart={setCart} />
        </div>
      </div>
    </section>
  )
}
