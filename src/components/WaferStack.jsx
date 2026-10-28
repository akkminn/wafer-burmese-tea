import { motion, useTransform } from 'framer-motion'

export const VIEW = { w: 800, h: 640 }
const CX = 400
const W = 280 // full slab width
const H = 62 // half height of the full slab rhombus

const KIND = {
  wafer: { t: 12, inset: 0 },
  milk: { t: 7, inset: 8 },
  choco: { t: 8, inset: 8 },
  coconut: { t: 9, inset: 6 },
}

const LABEL = {
  wafer: { name: 'Wafer sheet', my: 'ဝေဖာ' },
  milk: { name: 'Milk', my: 'ယို' },
  choco: { name: 'Chocolate', my: 'ယို' },
  coconut: { name: 'Coconut', my: 'အုန်းသီးဖက်' },
}

export const BASE_Y = 470 // top vertex of the bottom slab when collapsed
export const GAP = 56 // extra distance between slabs when exploded

/** small deterministic random so the flakes don't jump around on re-render */
function rng(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function pt(top, hw, hh, u, v) {
  return [CX + (u - v) * hw, top + (u + v) * hh]
}

function dripPath(x0, y0, x1, y1, t, seed) {
  const r = rng(seed)
  const n = 8
  let d = `M${x0} ${y0} L${x1} ${y1} `
  const depth = []
  for (let k = 0; k <= n; k++) depth.push(t + (k % 2 ? 4 + r() * 5 : r() * 2))
  d += `L${x1} ${y1 + depth[n]} `
  for (let k = n - 1; k >= 0; k--) {
    const px = x0 + ((x1 - x0) * k) / n
    const py = y0 + ((y1 - y0) * k) / n
    const mx = x0 + ((x1 - x0) * (k + 0.5)) / n
    const my = y0 + ((y1 - y0) * (k + 0.5)) / n
    d += `Q${mx} ${my + Math.max(depth[k], depth[k + 1]) + 3} ${px} ${py + depth[k]} `
  }
  return d + 'Z'
}

function Slab({ kind, topY, seed }) {
  const { t, inset } = KIND[kind]
  const hw = (W - inset * 2) / 2
  const hh = (hw * H) / (W / 2)
  const cy = topY + H // centre stays fixed regardless of inset
  const top = cy - hh
  const L = [CX - hw, cy]
  const R = [CX + hw, cy]
  const B = [CX, cy + hh]
  const T = [CX, top]
  const r = rng(seed)

  const topFace = `${T.join(' ')} ${R.join(' ')} ${B.join(' ')} ${L.join(' ')}`
  const leftFace = `${L.join(' ')} ${B.join(' ')} ${B[0]} ${B[1] + t} ${L[0]} ${L[1] + t}`
  const rightFace = `${B.join(' ')} ${R.join(' ')} ${R[0]} ${R[1] + t} ${B[0]} ${B[1] + t}`

  const bits = []
  if (kind === 'coconut') {
    for (let i = 0; i < 34; i++) {
      const [x, y] = pt(top, hw, hh, 0.06 + r() * 0.88, 0.06 + r() * 0.88)
      bits.push(
        <ellipse key={i} cx={x} cy={y} rx={4 + r() * 4} ry={1.6 + r() * 1.6} transform={`rotate(${r() * 60 - 30} ${x} ${y})`} fill="#fff" stroke="#e8dfc9" strokeWidth=".6" />,
      )
    }
  }
  if (kind === 'choco') {
    for (let i = 0; i < 11; i++) {
      const [x, y] = pt(top, hw, hh, 0.1 + r() * 0.8, 0.1 + r() * 0.8)
      bits.push(<ellipse key={i} cx={x} cy={y} rx={5 + r() * 3} ry={2.6 + r() * 1.4} fill="#c8955a" stroke="#7a4a22" strokeWidth=".8" />)
    }
  }

  if (kind === 'wafer') {
    return (
      <g>
        <polygon points={leftFace} fill="#b98532" />
        <polygon points={rightFace} fill="#cf9a42" />
        <polygon points={topFace} fill="url(#waffle)" stroke="#b98532" strokeWidth="1.2" />
        <polygon points={topFace} fill="url(#sheen)" />
      </g>
    )
  }

  if (kind === 'coconut') {
    return (
      <g>
        <polygon points={leftFace} fill="#ece4d0" />
        <polygon points={rightFace} fill="#f7f2e6" />
        <polygon points={topFace} fill="#fffdf8" stroke="#e8dfc9" strokeWidth="1" />
        {bits}
      </g>
    )
  }

  const c =
    kind === 'milk'
      ? { top: 'url(#milkTop)', l: '#e9c867', r: '#f3d77e' }
      : { top: 'url(#chocoTop)', l: '#2d170d', r: '#3e2012' }
  return (
    <g>
      <path d={dripPath(L[0], L[1], B[0], B[1], t, seed)} fill={c.l} />
      <path d={dripPath(B[0], B[1], R[0], R[1], t, seed + 7)} fill={c.r} />
      <polygon points={topFace} fill={c.top} />
      {kind === 'milk' && (
        <polygon
          points={`${pt(top, hw, hh, 0.2, 0.12).join(' ')} ${pt(top, hw, hh, 0.62, 0.18).join(' ')} ${pt(top, hw, hh, 0.58, 0.26).join(' ')} ${pt(top, hw, hh, 0.2, 0.2).join(' ')}`}
          fill="#fff"
          opacity=".55"
        />
      )}
      {bits}
    </g>
  )
}

function Defs() {
  const N = 9
  const m = `matrix(${W / 2 / N} ${H / N} ${-W / 2 / N} ${H / N} ${CX} 0)`
  return (
    <defs>
      <pattern id="waffle" patternUnits="userSpaceOnUse" width="1" height="1" patternTransform={m}>
        <rect width="1" height="1" fill="#e8bf70" />
        <rect x=".16" y=".16" width=".68" height=".68" fill="#f3d791" />
        <path d="M0 0H1V1H0Z" fill="none" stroke="#b98532" strokeWidth=".1" />
      </pattern>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".35" />
        <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="milkTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff7d6" />
        <stop offset="1" stopColor="#f6dc8a" />
      </linearGradient>
      <linearGradient id="chocoTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6a3d24" />
        <stop offset="1" stopColor="#3b1e11" />
      </linearGradient>
    </defs>
  )
}

export default function WaferStack({ layers, explode, boxO, label }) {
  const ys = []
  let y = BASE_Y
  for (let i = 0; i < layers.length; i++) {
    ys.push(y)
    y -= KIND[layers[i]].t
  }
  const labelO = useTransform(explode, [0.7, 1], [0, 1])
  const shadowO = useTransform(explode, [0, 1], [0.35, 0.16])
  const lift = useTransform(explode, [0, 1], [-175, 0])

  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="wafer-svg" role="img" aria-label={label}>
      <Defs />
      <motion.g style={{ y: lift }}>
      <motion.ellipse cx={CX} cy={BASE_Y + 150} rx="150" ry="30" fill="#000" style={{ opacity: shadowO }} />

      <Box boxO={boxO} part="back" />
      {layers.map((k, i) => (
        <SlabGroup key={i} i={i} kind={k} y={ys[i]} explode={explode} />
      ))}
      <Box boxO={boxO} part="front" />

      {layers.map((k, i) => {
        const left = i % 2 === 0
        const hw = (W - KIND[k].inset * 2) / 2
        const cy = ys[i] + H - i * GAP
        const dotX = left ? CX - hw : CX + hw
        const lineEnd = left ? 214 : VIEW.w - 214
        const textX = left ? 200 : VIEW.w - 200
        return (
          <motion.g key={`l${i}`} style={{ opacity: labelO }} className="leader">
            <line x1={dotX} y1={cy} x2={lineEnd} y2={cy} stroke="#fff" strokeOpacity=".85" strokeWidth="1.6" />
            <circle cx={dotX} cy={cy} r="4.5" fill="#fff" />
            <text x={textX} y={cy - 6} textAnchor={left ? 'end' : 'start'} className="lab-name">{LABEL[k].name}</text>
            <text x={textX} y={cy + 20} textAnchor={left ? 'end' : 'start'} className="lab-my" lang="my">{LABEL[k].my}</text>
          </motion.g>
        )
      })}
      </motion.g>
    </svg>
  )
}

function SlabGroup({ i, kind, y, explode }) {
  const ty = useTransform(explode, (e) => -i * GAP * e)
  return (
    <motion.g style={{ y: ty }}>
      <Slab kind={kind} topY={y} seed={i * 13 + 5} />
    </motion.g>
  )
}

function Box({ boxO, part }) {
  const hw = 168
  const hh = (hw * H) / (W / 2) // same slope as the slabs
  const cy = BASE_Y + H + 4
  const wall = 74
  const T = [CX, cy - hh]
  const R = [CX + hw, cy]
  const B = [CX, cy + hh]
  const L = [CX - hw, cy]
  const up = (p, h = wall) => [p[0], p[1] - h]
  const poly = (...p) => p.map((q) => q.join(' ')).join(' ')

  if (part === 'back') {
    return (
      <motion.g style={{ opacity: boxO }}>
        <polygon points={poly(T, R, B, L)} fill="#b98a4e" />
        <polygon points={poly(T, L, up(L), up(T))} fill="#c99c5f" />
        <polygon points={poly(T, R, up(R), up(T))} fill="#b78648" />
      </motion.g>
    )
  }
  const lidH = 40
  return (
    <motion.g style={{ opacity: boxO }}>
      <polygon points={poly(L, B, up(B), up(L))} fill="#a87a3f" stroke="#8c6430" strokeWidth="1" />
      <polygon points={poly(B, R, up(R), up(B))} fill="#c3924f" stroke="#8c6430" strokeWidth="1" />
      <polygon points={poly(up(L), up(B), up(B, wall + lidH), up(L, wall + lidH))} fill="#fff" opacity=".16" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
      <polygon points={poly(up(B), up(R), up(R, wall + lidH), up(B, wall + lidH))} fill="#fff" opacity=".22" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
      <polygon points={poly(up(T, wall + lidH), up(R, wall + lidH), up(B, wall + lidH), up(L, wall + lidH))} fill="#fff" opacity=".2" stroke="#fff" strokeOpacity=".7" strokeWidth="1.4" />
    </motion.g>
  )
}
