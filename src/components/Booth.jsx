import { motion } from 'framer-motion'
import { CONFIG } from '../config.js'
import QR, { downloadQR } from './QR.jsx'

const STEPS = [
  { n: '1', t: 'Build your set', d: 'Pick your wafer and tea on this page.' },
  { n: '2', t: `Pre-order, save ฿${CONFIG.preorder.discount} on every item`, d: 'Choose a pickup time and get your order code.' },
  { n: '3', t: 'Pay by QR and send your slip', d: 'We confirm your payment. No pre-order price without it.' },
  { n: '4', t: 'Come to the booth', d: `${CONFIG.event.place}, ${CONFIG.event.placeDetail.toLowerCase()}. Tell us your name or show your code and collect.` },
]

export default function Booth() {
  const e = CONFIG.event
  const s = CONFIG.social
  const socials = [
    s.instagram && { href: s.instagram, label: s.instagramHandle || 'Instagram' },
    s.tiktok && { href: s.tiktok, label: s.tiktokHandle || 'TikTok' },
    s.lineHandle && { href: `https://line.me/R/ti/p/${s.lineHandle}`, label: `LINE ${s.lineHandle}` },
  ].filter(Boolean)

  return (
    <section className="section booth" id="booth">
      <div className="wrap booth-grid">
        <motion.div
          className="booth-card"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
        >
          <p className="kicker kicker-gold">Booth day</p>
          <div className="big-date">
            <b>{e.shortDate.split(' ')[0]}</b>
            <span>{e.shortDate.split(' ')[1]}</span>
          </div>
          <p className="booth-time">{e.dateLabel}<br />{e.timeLabel}</p>
          <p className="booth-place">
            <strong>{e.place}</strong>
            {e.placeDetail}
            <em>{e.campus}</em>
          </p>
          {socials.length > 0 && (
            <p className="socials">
              {socials.map((x) => (
                <a key={x.href} href={x.href} target="_blank" rel="noreferrer">{x.label}</a>
              ))}
            </p>
          )}
        </motion.div>

        <div className="booth-side">
          <h2>How pre-ordering works</h2>
          <ol className="steps">
            {STEPS.map((st, i) => (
              <motion.li
                key={st.n}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08 }}
              >
                <i>{st.n}</i>
                <div>
                  <strong>{st.t}</strong>
                  <span>{st.d}</span>
                </div>
              </motion.li>
            ))}
          </ol>

          <div className="notes">
            <p><b>Why we’re doing this.</b> {CONFIG.donation}</p>
            <p><b>Allergy notice.</b> {CONFIG.allergy}</p>
          </div>
          <div className="qr-card">
            <QR size={132} />
            <div>
              <strong>Scan to pre-order</strong>
              <span>Put this QR on the booth poster and at the end of every video.</span>
              <button type="button" className="btn btn-navy btn-sm" onClick={downloadQR}>Download QR (PNG)</button>
            </div>
          </div>
          <a className="btn btn-navy" href="#order">Start my pre-order</a>
        </div>
      </div>
    </section>
  )
}
