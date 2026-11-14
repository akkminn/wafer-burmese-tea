import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

const MAX_DPR = 1.5

function Monitor({ cap, setCap }) {
  const st = useRef({ skip: 90, n: 0, t: 0 })
  useFrame((_, dt) => {
    const s = st.current
    if (s.skip > 0) {
      s.skip--
      return
    }
    s.n++
    s.t += Math.min(dt, 0.1)
    if (s.n < 40) return
    const avg = s.t / s.n
    s.n = 0
    s.t = 0
    if (avg > 0.028 && cap > 1.01) setCap((c) => Math.max(1, c - 0.25))
  })
  return null
}

/** Draws at most 1.5x pixels, and fewer if frames are slow, so scrolling stays smooth on phones. */
export function useAdaptiveDpr() {
  const [cap, setCap] = useState(MAX_DPR)
  return { dpr: [1, cap], monitor: <Monitor cap={cap} setCap={setCap} /> }
}
