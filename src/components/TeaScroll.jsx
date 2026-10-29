import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import CupSpin from './CupSpin.jsx'
import { CONFIG } from '../config.js'

const Tea3D = lazy(() => import('./Tea3D.jsx'))

const SCENES = [
  {
    id: 'intro',
    a: 0,
    b: 0.1,
    dot: 'Cup',
    kicker: 'Our little cup',
    title: 'Burmese tea in a small paper cup',
    text: 'About 3 inches tall, with a sip lid and our ဆရာကြီး sticker. Scroll to make it.',
  },
  { id: 'open', a: 0.1, b: 0.22, dot: 'Open', kicker: 'Step 1', title: 'Lift the lid', text: 'A small, empty cup, ready for tea.' },
  { id: 'tea', a: 0.22, b: 0.38, dot: 'Tea', kicker: 'Step 2', my: 'လက်ဖက်ရည်ပြင်း', title: 'Strong tea goes in first', text: 'Hot, strong tea is poured into the empty cup first.' },
  { id: 'milk', a: 0.38, b: 0.52, dot: 'Milk', kicker: 'Step 3', my: 'နို့', title: 'Then the milk', text: 'Creamy milk is poured in over the tea.' },
  { id: 'sugar', a: 0.52, b: 0.66, dot: 'Sugar', kicker: 'Step 4', my: 'သကြား', title: 'Add sugar', text: 'Sugar goes in and melts into the milky tea.' },
  { id: 'froth', a: 0.66, b: 0.84, dot: 'Froth', kicker: 'Step 5', title: 'Pour from up high', text: 'Poured from high, the tea mixes, turns frothy and steams hot.' },
  { id: 'ready', a: 0.84, b: 1, dot: 'Ready', kicker: 'Ready', title: 'Lid on, logo to the front', text: `฿${CONFIG.prices.tea} · regular or less sweet · −฿${CONFIG.prices.comboSaving} with any wafer.` },
]

function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function TeaScroll({ onOrder }) {
  const ref = useRef(null)
  const [scene, setScene] = useState(0)
  const gl3d = useMemo(webglOK, [])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const i = SCENES.findIndex((s) => p < s.b)
    const s = i === -1 ? SCENES.length - 1 : i
    setScene((old) => (old === s ? old : s))
  })

  if (!gl3d) return <CupSpin />

  const cur = SCENES[scene]

  const jump = (i) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    const mid = SCENES[i].a + (SCENES[i].b - SCENES[i].a) * 0.5
    window.scrollTo({ top: top + span * (i === 0 ? 0 : mid), behavior: 'smooth' })
  }

  return (
    <section className="tea-scroll" id="tea" ref={ref}>
      <div className="stage tea-stage">
        <div className="outline-text left" aria-hidden="true">BURMESE</div>
        <div className="outline-text right" aria-hidden="true">TEA</div>

        <div className="tea-canvas">
          <Suspense fallback={null}>
            <Tea3D progress={scrollYProgress} label="A small paper cup of Burmese tea: the lid opens, milk and tea are poured in" />
          </Suspense>
        </div>

        <nav className="scene-dots" aria-label="Tea steps">
          {SCENES.map((s, i) => (
            <button key={s.id} type="button" className={i === scene ? 'on' : ''} onClick={() => jump(i)} aria-label={s.dot} aria-current={i === scene}>
              <span>{s.dot}</span>
            </button>
          ))}
        </nav>

        <div className="stage-copy" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div key={cur.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <small className="kick">
                {cur.kicker}
                {cur.my && <span lang="my" className="kick-my"> · {cur.my}</span>}
              </small>
              <h2>{cur.title}</h2>
              <p>{cur.text}</p>
              {cur.id === 'ready' && (
                <button type="button" className="btn btn-navy" onClick={() => onOrder('teaRegular')}>
                  Add Burmese tea · ฿{CONFIG.prices.tea}
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
