import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import WaferStack from './WaferStack.jsx'
const Wafer3D = lazy(() => import('./Wafer3D.jsx'))
import { CONFIG } from '../config.js'

const RECIPES = {
  classic: {
    name: 'Classic Coconut Milk',
    word: 'CLASSIC',
    layers: ['wafer', 'milk', 'coconut', 'wafer', 'milk', 'coconut', 'wafer'],
    line: 'Runny milk (ယို) and coconut slices (အုန်းသီးဖက်) between the sheets. Nothing on top.',
    note: 'One box holds two stacks like this one.',
  },
  choco: {
    name: 'Choco-Coco',
    word: 'CHOCO',
    layers: ['wafer', 'choco', 'coconut', 'wafer', 'choco', 'coconut', 'wafer'],
    line: 'Runny chocolate (ယို) and coconut slices (အုန်းသီးဖက်) between the sheets. Nothing on top.',
    note: 'New: our own twist. In Myanmar it is only made with milk. Contains hazelnut.',
  },
  mixed: {
    name: 'Mixed-Layer',
    word: 'MIXED',
    layers: ['wafer', 'milk', 'coconut', 'wafer', 'choco', 'coconut', 'wafer'],
    line: 'One runny milk layer and one runny chocolate layer, each with coconut slices.',
  },
}

const SCENES = [
  { id: 'intro', a: 0, b: 0.16, dot: 'Start' },
  { id: 'classic', a: 0.16, b: 0.4, dot: 'Classic' },
  { id: 'choco', a: 0.4, b: 0.64, dot: 'Choco-Coco' },
  { id: 'mixed', a: 0.64, b: 0.88, dot: 'Mixed' },
  { id: 'packed', a: 0.88, b: 1, dot: 'Packed' },
]

const EXPLODE_IN = [0, 0.16, 0.23, 0.34, 0.4, 0.47, 0.58, 0.64, 0.71, 0.82, 0.88, 1]
const EXPLODE_OUT = [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0]

function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function useCountdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const start = new Date(CONFIG.event.startISO)
  const end = new Date(CONFIG.event.endISO)
  if (now < start) {
    const ms = start - now
    const days = Math.floor(ms / 86_400_000)
    const hours = Math.floor((ms % 86_400_000) / 3_600_000)
    return days >= 1 ? `${days} day${days === 1 ? '' : 's'} to go` : `${hours} hour${hours === 1 ? '' : 's'} to go`
  }
  if (now <= end) return 'Booth is open now!'
  return 'Booth day is over. Thank you!'
}

export default function WaferScroll({ onOrder }) {
  const ref = useRef(null)
  const [scene, setScene] = useState(0)
  const countdown = useCountdown()
  const gl3d = useMemo(webglOK, [])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const explode = useTransform(scrollYProgress, EXPLODE_IN, EXPLODE_OUT)
  const boxO = useTransform(scrollYProgress, [0.9, 0.97], [0, 1])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const i = SCENES.findIndex((s) => p < s.b)
    const s = i === -1 ? SCENES.length - 1 : i
    setScene((old) => (old === s ? old : s))
  })

  const id = SCENES[scene].id
  const flavor = id === 'choco' ? 'choco' : id === 'mixed' || id === 'packed' ? 'mixed' : 'classic'
  const recipe = RECIPES[flavor]
  const isFlavor = id === 'classic' || id === 'choco' || id === 'mixed'

  const jump = (i) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    const mid = SCENES[i].a + (SCENES[i].b - SCENES[i].a) * 0.45
    window.scrollTo({ top: top + span * (i === 0 ? 0 : mid), behavior: 'smooth' })
  }

  const side = id === 'intro' ? 'WAFER' : id === 'packed' ? 'READY' : recipe.word

  return (
    <section className="wafer-scroll" id="wafer" ref={ref}>
      <div className="stage">
        <div className="outline-text left" aria-hidden="true">WAFER</div>
        <div className="outline-text right" aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.span key={side} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} transition={{ duration: 0.3 }}>
              {side}
            </motion.span>
          </AnimatePresence>
        </div>

        <p className="script">a taste of Burmese childhood</p>

        <div className="stack-wrap">
          {gl3d ? (
            <Suspense fallback={<div className="svg-fallback"><WaferStack layers={recipe.layers} explode={explode} boxO={boxO} label="Loading the 3D wafer" /></div>}>
              <Wafer3D layers={recipe.layers} explode={explode} boxO={boxO} yaw={scrollYProgress} label={`${recipe.name} wafer shown layer by layer`} />
            </Suspense>
          ) : (
            <div className="svg-fallback">
              <WaferStack layers={recipe.layers} explode={explode} boxO={boxO} label={`${recipe.name} wafer shown layer by layer`} />
            </div>
          )}
        </div>

        <nav className="scene-dots" aria-label="Scenes">
          {SCENES.map((s, i) => (
            <button key={s.id} type="button" className={i === scene ? 'on' : ''} onClick={() => jump(i)} aria-label={s.dot} aria-current={i === scene}>
              <span>{s.dot}</span>
            </button>
          ))}
        </nav>

        <div className="stage-copy" aria-live="polite">
          <AnimatePresence mode="wait">
            {id === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h1>
                  Wafer Dessert <span>&amp;</span> Burmese Tea
                </h1>
                <p className="chips">
                  <b>{countdown}</b>
                  <span>{CONFIG.event.dayMonth} · {CONFIG.event.timeLabel}</span>
                  <span>{CONFIG.event.place}</span>
                </p>
                <div className="mouse" aria-hidden="true"><i /></div>
                <small>scroll to take it apart</small>
              </motion.div>
            )}
            {isFlavor && (
              <motion.div key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2>{recipe.name}</h2>
                <p>{recipe.line}</p>
                {recipe.note && <p className="note">{recipe.note}</p>}
                <button type="button" className="btn btn-gold" onClick={() => onOrder(flavor)}>
                  Pre-order · ฿{CONFIG.prices.wafer[flavor]} · save ฿{CONFIG.preorder.discount}
                </button>
              </motion.div>
            )}
            {id === 'packed' && (
              <motion.div key="packed" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2>Stacked and packed</h2>
                <p>Two stacks of three sheets, with their fillings, in a kraft box with a clear lid. Easy to carry to class.</p>
                <button type="button" className="btn btn-gold" onClick={() => onOrder(flavor)}>
                  Pre-order now · save ฿{CONFIG.preorder.discount} each
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
