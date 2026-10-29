import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { VIDEOS } from '../data.js'
import { StackIcon } from './Icons.jsx'

const DEMO_LENGTH = 15 // seconds the overlay demo runs when a video file is missing (dev only)

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function VideoCard({ v, onDead }) {
  const box = useRef(null)
  const vid = useRef(null)
  const [t, setT] = useState(0)
  const [len, setLen] = useState(0)
  const [failed, setFailed] = useState(false)
  const [muted, setMuted] = useState(true)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) vid.current?.pause()
    }, { threshold: 0.3 })
    if (box.current) io.observe(box.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (started) vid.current?.play().catch(() => {})
  }, [started])

  const toggle = () => {
    const el = vid.current
    if (!started) setStarted(true)
    else if (el?.paused) el.play().catch(() => {})
    else el?.pause()
  }

  useEffect(() => {
    if (!failed || !playing) return
    const id = setInterval(() => setT((x) => (x + 0.25) % DEMO_LENGTH), 250)
    return () => clearInterval(id)
  }, [failed, playing])

  useEffect(() => {
    if (failed && !import.meta.env.DEV) onDead(v.id)
  }, [failed, onDead, v.id])

  const duration = failed ? DEMO_LENGTH : len
  const cards = v.cards || []
  let idx = 0
  if (duration && cards.length) {
    if (cards.some((c) => c.at != null)) {
      cards.forEach((c, k) => {
        if (c.at != null && t >= c.at) idx = k
      })
    } else {
      idx = Math.min(cards.length - 1, Math.floor(t / (duration / cards.length)))
    }
  }
  const card = cards[idx]

  if (failed && !import.meta.env.DEV) return null

  return (
    <article className="phone" ref={box}>
      <div className="screen">
        {failed ? (
          <div className="poster"><StackIcon flavor={v.flavor} className="poster-icon" /></div>
        ) : (
          <video
            ref={vid}
            src={started ? v.src : undefined}
            poster={v.poster}
            muted={muted}
            loop
            playsInline
            preload="none"
            onLoadedMetadata={(e) => setLen(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => started && setFailed(true)}
          />
        )}
        {card && (
          <div className="screen-bottom">
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                className="info-card"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                <small>{card.kicker}</small>
                <strong>{card.title}</strong>
                <span>{card.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <button
          type="button"
          className={`play-toggle ${playing ? 'is-playing' : ''}`}
          onClick={failed ? () => setPlaying((x) => !x) : toggle}
          aria-label={playing ? `Pause video: ${v.title}` : `Play video: ${v.title}`}
        >
          <span className="play-icon">{playing ? <PauseIcon /> : <PlayIcon />}</span>
        </button>

        {!failed && started && (
          <button type="button" className="sound" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}

        <div className="progress" aria-hidden="true">
          <span style={{ width: duration ? `${Math.min(100, (t / duration) * 100)}%` : 0 }} />
        </div>
      </div>
      <h3>{v.title}</h3>
      {failed && import.meta.env.DEV && <p className="dev">Dev note: add the video as public/{v.src}</p>}
    </article>
  )
}

export default function VideoReel() {
  const row = useRef(null)
  const drag = useRef({ down: false, x: 0, left: 0 })
  const [dead, setDead] = useState({})
  const onDead = (id) => setDead((d) => (d[id] ? d : { ...d, [id]: true }))

  const alive = VIDEOS.filter((v) => !dead[v.id])
  if (!alive.length && !import.meta.env.DEV) return null
  const many = alive.length > 1

  const scrollBy = (dir) => row.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.target.closest('button,a')) return
    drag.current = { down: true, x: e.clientX, left: row.current.scrollLeft }
    row.current.classList.add('grabbing')
  }
  const onMove = (e) => {
    if (!drag.current.down) return
    row.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const onUp = () => {
    drag.current.down = false
    row.current?.classList.remove('grabbing')
  }

  return (
    <section className="section videos" id="videos">
      <div className="wrap">
        <p className="kicker">See it in action</p>
        <h2>{many ? 'Quick looks at our wafer and tea' : 'See it before you taste it'}</h2>
        <p className="sub">
          {many ? 'Drag or swipe to browse. ' : 'Tap play, and the speaker for sound. '}
          Watch to the end for the pre-order info, the booth place and a QR code.
        </p>
        {many && (
          <div className="reel-bar">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous video">←</button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Next video">→</button>
          </div>
        )}
      </div>
      <div
        className={`reel ${many ? '' : 'solo'}`}
        ref={row}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {VIDEOS.map((v) => (
          <VideoCard key={v.id} v={v} onDead={onDead} />
        ))}
      </div>
    </section>
  )
}
