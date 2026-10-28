import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CONFIG } from '../config.js'

const OX = 232 // where the cup sits inside the wide drawing
const OY = 12
const CX = 160
const TOP = 112 // top of the cup body
const BOT = 268 // bottom of the cup body
const hwAt = (y) => 94 - ((y - TOP) / (BOT - TOP)) * 24
const LABEL_Y = 192
const LOGO = 112
const RIBS = 30
const TAU = Math.PI * 2

export default function CupSpin() {
  const wrap = useRef(null)
  const logo = useRef(null)
  const back = useRef(null)
  const seam = useRef(null)
  const ribs = useRef([])
  const st = useRef({ theta: -0.7, vel: 0.5, down: false, lastX: 0, lastT: 0, snap: null, visible: true })
  const [facing, setFacing] = useState('logo')
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const draw = (th) => {
    const R = hwAt(LABEL_Y)
    const c = Math.cos(th)
    const s = Math.sin(th)
    if (logo.current) {
      logo.current.setAttribute('transform', `translate(${CX + R * s} ${LABEL_Y}) scale(${Math.max(c, 0.001)} 1)`)
      logo.current.style.opacity = c > 0.02 ? String(Math.min(1, 0.35 + c)) : '0'
    }
    if (back.current) {
      const cb = -c
      back.current.setAttribute('transform', `translate(${CX - R * s} ${LABEL_Y}) scale(${Math.max(cb, 0.001)} 1)`)
      back.current.style.opacity = cb > 0.02 ? String(Math.min(1, 0.35 + cb)) : '0'
    }
    if (seam.current) {
      const a = th + 2.3
      seam.current.setAttribute('d', `M${CX + hwAt(TOP) * Math.sin(a)} ${TOP} L${CX + hwAt(BOT) * Math.sin(a)} ${BOT}`)
      seam.current.style.opacity = Math.cos(a) > 0 ? '1' : '0'
    }
    ribs.current.forEach((el, k) => {
      if (!el) return
      const a = th + (k * TAU) / RIBS
      const x = CX + 97 * Math.sin(a)
      el.setAttribute('x1', x)
      el.setAttribute('x2', x)
      el.style.opacity = Math.cos(a) > 0.04 ? String(0.18 + 0.2 * Math.cos(a)) : '0'
    })
  }

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (st.current.visible = e.isIntersecting), { threshold: 0.1 })
    if (wrap.current) io.observe(wrap.current)
    let raf
    let prev = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const s = st.current
      if (s.visible) {
        if (!s.down) {
          if (s.snap != null) {
            const d = s.snap - s.theta
            s.theta += d * Math.min(1, dt * 7)
            if (Math.abs(d) < 0.003) {
              s.theta = s.snap
              s.snap = null
              s.vel = 0
            }
          } else {
            s.theta += s.vel * dt
            const idle = reduced.current ? 0 : 0.45
            s.vel += (idle - s.vel) * Math.min(1, dt * 1.6)
          }
        }
        draw(s.theta)
        const face = Math.cos(s.theta) > 0 ? 'logo' : 'back'
        setFacing((f) => (f === face ? f : face))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])

  const down = (e) => {
    const s = st.current
    s.down = true
    s.snap = null
    s.lastX = e.clientX
    s.lastT = performance.now()
    s.vel = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    const s = st.current
    if (!s.down) return
    const now = performance.now()
    const dx = e.clientX - s.lastX
    const dt = Math.max(1, now - s.lastT) / 1000
    s.theta += dx * 0.017
    s.vel = Math.max(-14, Math.min(14, (dx * 0.017) / dt))
    s.lastX = e.clientX
    s.lastT = now
  }
  const up = () => {
    st.current.down = false
  }
  const key = (e) => {
    if (e.key === 'ArrowLeft') st.current.vel = -3.2
    if (e.key === 'ArrowRight') st.current.vel = 3.2
  }
  const show = (side) => {
    const s = st.current
    const k = Math.round(s.theta / TAU) * TAU
    const cands = side === 'logo' ? [k - TAU, k, k + TAU] : [k - Math.PI, k + Math.PI, k + 3 * Math.PI]
    s.snap = cands.reduce((a, b) => (Math.abs(b - s.theta) < Math.abs(a - s.theta) ? b : a))
  }

  const bodyPath = `M${CX - hwAt(TOP)} ${TOP} L${CX + hwAt(TOP)} ${TOP} L${CX + hwAt(BOT)} ${BOT} Q${CX} ${BOT + 12} ${CX - hwAt(BOT)} ${BOT} Z`
  const collarPath = `M${CX - 98} 82 L${CX + 98} 82 L${CX + hwAt(TOP)} ${TOP + 5} L${CX - hwAt(TOP)} ${TOP + 5} Z`

  return (
    <section className="cup-scene" id="tea">
      <div className="outline-text left" aria-hidden="true">BURMESE</div>
      <div className="outline-text right" aria-hidden="true">TEA</div>

      <div className="cup-inner">
        <p className="script">our little cup</p>
        <h2>Spin the cup. Find our logo.</h2>
        <p className="cup-sub">
          Burmese tea in a small paper cup, about 3 inches tall, with our <span lang="my">ဆရာကြီး</span> sticker on the
          front. Drag it sideways to turn it round.
        </p>

        <div
          className="cup-stage"
          ref={wrap}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
          tabIndex={0}
          role="img"
          aria-label="Small paper cup of Burmese tea with our logo. Drag sideways to spin it."
        >
          <svg viewBox="0 0 760 330" className="cup-svg">
            <defs>
              <clipPath id="cupBody">
                <path d={bodyPath} />
              </clipPath>
              <linearGradient id="cupShade" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#000" stopOpacity=".26" />
                <stop offset=".2" stopColor="#000" stopOpacity=".03" />
                <stop offset=".38" stopColor="#fff" stopOpacity=".5" />
                <stop offset=".52" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity=".3" />
              </linearGradient>
              <linearGradient id="lidShade" x1="0" x2="1">
                <stop offset="0" stopColor="#2a160c" />
                <stop offset=".4" stopColor="#6a4228" />
                <stop offset="1" stopColor="#24120a" />
              </linearGradient>
              <radialGradient id="cupFloor" cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="#000" stopOpacity=".38" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g className="leader" fill="none">
              <line x1="170" y1="80" x2={OX + 48} y2="80" stroke="#fff" strokeOpacity=".9" strokeWidth="1.6" />
              <circle cx={OX + 48} cy="80" r="4.5" fill="#fff" />
              <text x="156" y="76" textAnchor="end" className="lab-name">Brown lid</text>
              <text x="156" y="100" textAnchor="end" className="lab-my">အဖုံး</text>

              <line x1="170" y1="204" x2={OX + 78} y2="204" stroke="#fff" strokeOpacity=".9" strokeWidth="1.6" />
              <circle cx={OX + 78} cy="204" r="4.5" fill="#fff" />
              <text x="156" y="200" textAnchor="end" className="lab-name">Our sticker</text>
              <text x="156" y="224" textAnchor="end" className="lab-my">ဆရာကြီး</text>

              <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <line x1="556" y1="24" x2="556" y2="292" />
                <line x1="546" y1="24" x2="566" y2="24" />
                <line x1="546" y1="292" x2="566" y2="292" />
              </g>
              <text x="592" y="158" className="lab-name" transform="rotate(90 592 158)" textAnchor="middle">about 3 in · 7.5 cm</text>
            </g>

            <g transform={`translate(${OX} ${OY})`}>
              <ellipse cx={CX} cy={BOT + 10} rx="104" ry="14" fill="url(#cupFloor)" />

              <g clipPath="url(#cupBody)">
                <rect x="40" y={TOP} width="240" height={BOT - TOP + 20} fill="#fbfaf6" />
                <path ref={seam} d="" stroke="#cfc8b6" strokeWidth="1.6" fill="none" />

                <g ref={logo}>
                  <image href="img/logo-sticker.webp" x={-LOGO / 2} y={-LOGO / 2} width={LOGO} height={LOGO} />
                </g>

                <g ref={back}>
                  <rect x="-54" y="-42" width="108" height="84" rx="14" fill="#0b5230" />
                  <rect x="-49" y="-37" width="98" height="74" rx="10" fill="none" stroke="#f5a30a" strokeWidth="1.6" />
                  <text x="0" y="-14" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffd36b" fontFamily="Outfit, sans-serif" letterSpacing="1.6">BURMESE TEA</text>
                  <text x="0" y="6" textAnchor="middle" fontSize="13" fill="#fff" fontFamily="'Noto Sans Myanmar', sans-serif">မြန်မာ့လက်ဖက်ရည်</text>
                  <path d="M-12 20 q12 -16 24 0 q-12 8 -24 0 Z" fill="#f5a30a" />
                  <text x="0" y="33" textAnchor="middle" fontSize="8.5" fill="#cfe8d6" fontFamily="Outfit, sans-serif">regular · less sweet</text>
                </g>

                <rect x="40" y={TOP} width="240" height={BOT - TOP + 20} fill="url(#cupShade)" />
              </g>

              <path d={collarPath} fill="#f3f1ea" />
              {Array.from({ length: RIBS }, (_, k) => (
                <line key={k} ref={(el) => (ribs.current[k] = el)} y1="84" y2={TOP + 3} stroke="#6b6558" strokeWidth="2" />
              ))}
              <path d={collarPath} fill="url(#cupShade)" opacity=".6" />

              <rect x="48" y="52" width="224" height="34" rx="14" fill="url(#lidShade)" />
              <path d="M66 54 Q160 10 254 54 Z" fill="url(#lidShade)" />
              <rect x="136" y="30" width="46" height="9" rx="4.5" fill="#1a0c06" />
              <path d="M82 51 Q160 20 238 51" stroke="#fff" strokeOpacity=".16" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
          </svg>
          <p className="cup-hint" aria-hidden="true"><motion.span animate={{ x: [-6, 6, -6] }} transition={{ duration: 2.4, repeat: Infinity }}>↔</motion.span> drag to spin</p>
        </div>

        <div className="cup-bottom">
          <div className="cup-btns" role="group" aria-label="Show a side of the cup">
            <button type="button" aria-pressed={facing === 'logo'} onClick={() => show('logo')}>Logo side</button>
            <button type="button" aria-pressed={facing === 'back'} onClick={() => show('back')}>Label side</button>
          </div>
          <p className="cup-price"><b>฿{CONFIG.prices.tea}</b> regular or less sweet · <b>−฿{CONFIG.prices.comboSaving}</b> with any wafer</p>
        </div>
      </div>
    </section>
  )
}
