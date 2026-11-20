import { motion } from 'framer-motion'
import { CONFIG } from '../config.js'
import { FLAVORS, TEA } from '../data.js'

export default function Menu() {
  const items = [...FLAVORS.map((f) => ({ id: f.id, name: f.name, price: f.price })), { id: TEA.id, name: TEA.name, price: TEA.price }]
  return (
    <section className="section menu" id="menu">
      <div className="wrap menu-grid">
        <motion.div
          className="menu-copy"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
        >
          <p className="kicker">Menu</p>
          <h2>Our menu</h2>
          <p className="sub">
            Any wafer with a Burmese tea saves ฿{CONFIG.prices.comboSaving}. Pre-order and save another ฿{CONFIG.preorder.discount} on every item.
          </p>
          <ul className="menu-list">
            {items.map((it) => (
              <li key={it.id}>
                <span>{it.name}</span>
                <b>฿{it.price}</b>
              </li>
            ))}
            <li>
              <span>Wafer + tea combo</span>
              <b>−฿{CONFIG.prices.comboSaving}</b>
            </li>
          </ul>
          <div className="menu-actions">
            <a className="btn btn-navy" href="#order">Pre-order now</a>
            <a className="btn btn-gold btn-sm" href="img/sip-and-crunch-menu.png" download>Download the menu (PNG)</a>
          </div>
        </motion.div>

        <motion.img
          className="menu-img"
          src="img/menu.webp"
          width="900"
          height="1125"
          loading="lazy"
          alt="SIP & CRUNCH menu: Classic Coconut Milk ฿45, Choco-Coco ฿55, Mixed-Layer ฿50, Burmese Tea ฿35, and ฿5 off a wafer and tea combo"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
        />
      </div>
    </section>
  )
}
