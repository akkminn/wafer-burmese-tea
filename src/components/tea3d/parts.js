import * as THREE from 'three'

export const H = 2.75 // rim height of the cup
export const FLOOR = 0.1 // inside bottom of the cup
export const STEP = 0.3 // where the double-wall base steps in
export const LID_H = 0.162 // how far the lid stands above the rim

export const outerR = (y) => (y < STEP ? 0.74 + 0.04 * (y / STEP) : 0.84 + 0.28 * ((y - STEP) / (H - STEP)))
export const innerR = (y) => 0.7 + (y - FLOOR) * (0.37 / (H - FLOOR))

const rand = (seed) => {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/** split long segments so the smooth lathe normals stay flat along them */
function densify(pts, maxLen) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxLen))
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
  }
  return out.map(([x, y]) => new THREE.Vector2(x, y))
}

export function makeCupGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.7, 0.0],
    [0.74, 0.025],
    [0.78, STEP - 0.004],
    [0.78, STEP],
    [0.84, STEP],
    [0.84, STEP + 0.012],
    [outerR(H), H],
    [outerR(H) - 0.05, H],
    [innerR(H), H - 0.02],
    [innerR(FLOOR), FLOOR],
    [0.0, FLOOR],
  ]
  return new THREE.LatheGeometry(densify(pts, 0.3), 80)
}

export function makeStickerGeometry(y0, y1, centerAngle) {
  const rb = outerR(y0) + 0.007
  const rt = outerR(y1) + 0.007
  const h = y1 - y0
  const thetaLength = h / ((rb + rt) / 2) // keep a round logo round: arc length = height
  const g = new THREE.CylinderGeometry(rt, rb, h, 48, 1, true, centerAngle - thetaLength / 2, thetaLength)
  g.translate(0, y0 + h / 2, 0)
  return g
}

export function makeCollarGeometry() {
  const y0 = H - 0.7
  const g = new THREE.CylinderGeometry(outerR(H) + 0.02, outerR(y0) + 0.02, H - y0, 96, 1, true)
  g.translate(0, (y0 + H) / 2, 0)
  return g
}

export function makeRibTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 16
  const g = c.getContext('2d')
  g.fillStyle = '#f3f1ea'
  g.fillRect(0, 0, 64, 16)
  const grad = g.createLinearGradient(0, 0, 64, 0)
  grad.addColorStop(0, 'rgba(90,84,70,.0)')
  grad.addColorStop(0.5, 'rgba(90,84,70,.55)')
  grad.addColorStop(1, 'rgba(90,84,70,.0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 16)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(40, 1)
  t.colorSpace = THREE.SRGBColorSpace
  const b = new THREE.CanvasTexture(c)
  b.wrapS = THREE.RepeatWrapping
  b.repeat.set(40, 1)
  return { map: t, bumpMap: b }
}

export function makeBackLabelTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const draw = () => {
    const g = c.getContext('2d')
    g.clearRect(0, 0, 512, 512)
    g.fillStyle = '#0b5230'
    g.beginPath()
    g.roundRect(26, 90, 460, 332, 40)
    g.fill()
    g.strokeStyle = '#f5a30a'
    g.lineWidth = 8
    g.beginPath()
    g.roundRect(48, 112, 416, 288, 28)
    g.stroke()
    g.textAlign = 'center'
    g.fillStyle = '#ffd36b'
    g.font = '800 54px Outfit, sans-serif'
    g.fillText('BURMESE TEA', 256, 205)
    g.fillStyle = '#ffffff'
    g.font = '500 52px "Noto Sans Myanmar", sans-serif'
    g.fillText('မြန်မာ့လက်ဖက်ရည်', 256, 285)
    g.fillStyle = '#cfe8d6'
    g.font = '500 32px Outfit, sans-serif'
    g.fillText('regular · less sweet', 256, 355)
    t.needsUpdate = true
  }
  draw()
  if (document.fonts?.ready) document.fonts.ready.then(draw)
  return t
}

export function makeLidGeometry() {
  const pts = [
    [0.0, 0.12],
    [0.5, 0.12],
    [0.6, 0.105],
    [0.66, 0.055],
    [0.9, 0.055],
    [1.06, 0.045],
    [1.14, 0.03],
    [1.16, 0.0],
    [1.16, -0.11],
    [1.2, -0.11],
    [1.2, -0.04],
    [1.215, 0.03],
    [1.205, 0.095],
    [1.16, 0.13],
    [1.1, 0.125],
    [1.0, 0.1],
    [0.9, 0.092],
    [0.7, 0.09],
    [0.665, 0.1],
    [0.625, 0.15],
    [0.56, LID_H],
    [0.3, LID_H],
    [0.0, LID_H],
  ]
  return new THREE.LatheGeometry(densify(pts, 0.12), 96)
}

export function makeLidTextTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const draw = () => {
    const g = c.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, 512, 512)
    g.translate(256, 256)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '700 38px Outfit, sans-serif'
    const text = 'CAUTION  ·  CONTENTS HOT  ·  '
    const step = (Math.PI * 2) / text.length
    for (const [dx, col] of [
      [2, 'rgba(0,0,0,.45)'],
      [0, 'rgba(255,226,196,.38)'],
    ]) {
      g.fillStyle = col
      for (let i = 0; i < text.length; i++) {
        g.save()
        g.rotate(-Math.PI / 2 + i * step)
        g.translate(0, -205)
        g.fillText(text[i], dx, dx)
        g.restore()
      }
    }
    t.needsUpdate = true
  }
  draw()
  if (document.fonts?.ready) document.fonts.ready.then(draw)
  return t
}

export const LIQ_N = 72

export function makeLiquidGeometry() {
  const N = LIQ_N
  const g = new THREE.BufferGeometry()
  const count = 3 * (N + 1) + 1
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  const idx = []
  for (let i = 0; i < N; i++) {
    const a = i
    const b = i + 1
    const c = N + 1 + i
    const d = N + 1 + i + 1
    idx.push(a, c, b, b, c, d)
    idx.push(3 * (N + 1), 2 * (N + 1) + i + 1, 2 * (N + 1) + i)
  }
  g.setIndex(idx)
  setLiquid(g, 0.01)
  return g
}

export function setLiquid(g, level) {
  const N = LIQ_N
  const top = FLOOR + level * (H - FLOOR)
  const rb = innerR(FLOOR) - 0.012
  const rt = innerR(top) - 0.012
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const slope = (rt - rb) / Math.max(top - FLOOR, 0.0001)
  const nl = Math.hypot(1, slope)
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    pos.setXYZ(i, ca * rb, FLOOR, sa * rb)
    pos.setXYZ(N + 1 + i, ca * rt, top, sa * rt)
    pos.setXYZ(2 * (N + 1) + i, ca * rt, top, sa * rt)
    nor.setXYZ(i, ca / nl, -slope / nl, sa / nl)
    nor.setXYZ(N + 1 + i, ca / nl, -slope / nl, sa / nl)
    nor.setXYZ(2 * (N + 1) + i, 0, 1, 0)
  }
  pos.setXYZ(3 * (N + 1), 0, top, 0)
  nor.setXYZ(3 * (N + 1), 0, 1, 0)
  pos.needsUpdate = true
  nor.needsUpdate = true
  g.computeBoundingSphere()
  return top
}

export const STREAM_SEG = 44
export const STREAM_RAD = 14

export function makeStreamGeometry() {
  const g = new THREE.BufferGeometry()
  const n = (STREAM_SEG + 1) * (STREAM_RAD + 1)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const idx = []
  for (let j = 0; j < STREAM_SEG; j++) {
    for (let i = 0; i < STREAM_RAD; i++) {
      const a = j * (STREAM_RAD + 1) + i
      const b = a + STREAM_RAD + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  g.setIndex(idx)
  return g
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * o: { x, z, yTop, yHit, head, tail, flow, r0, narrow, wob, sway, t }
 * head 0..1: the front of the stream falls from yTop to yHit; tail 0..1: the back end drains down after the pour stops.
 * returns false when there is nothing to draw
 */
export function shapeStream(g, o) {
  if (o.head < 0.004 || o.tail > 0.995 || o.flow < 0.02) return false
  const span = o.yTop - o.yHit
  const upper = o.yTop - span * o.tail * o.tail
  const arrived = o.head > 0.999
  const lower = arrived ? o.yHit - 0.03 : o.yTop - span * o.head * o.head
  const pos = g.attributes.position
  for (let j = 0; j <= STREAM_SEG; j++) {
    const v = j / STREAM_SEG
    const y = upper + (lower - upper) * v
    const w = clamp01((o.yTop - y) / span)
    const prof = 1 - o.narrow * Math.pow(w, 0.6)
    const wob = 1 + o.wob * Math.sin(w * 22 - o.t * 9) * (0.3 + 0.7 * w)
    let cap = 1
    if (!arrived) {
      const k = 1 - v
      if (k < 0.1) cap = Math.sqrt(Math.max(0, 1 - Math.pow((0.1 - k) / 0.1, 2)))
    }
    if (o.tail > 0) cap *= smooth(0, 0.2, v)
    const base = arrived ? 1 + 0.5 * smooth(0.9, 1, v) : 1
    const r = o.r0 * o.flow * prof * wob * cap * base
    const sway = o.sway * Math.sin(Math.PI * w) * Math.sin(o.t * 1.7 + w * 3.2)
    const cx = o.x + sway + (o.lean || 0) * Math.pow(1 - w, 2)
    const cz = o.z + sway * 0.3
    for (let i = 0; i <= STREAM_RAD; i++) {
      const a = (i / STREAM_RAD) * Math.PI * 2
      pos.setXYZ(j * (STREAM_RAD + 1) + i, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)
    }
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return true
}

export function makeFoamTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const r = rand(7)
  g.fillStyle = '#e4c796'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(184,132,76,${0.12 + r() * 0.14})`
    g.beginPath()
    g.arc(r() * 256, r() * 256, 20 + r() * 36, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 280; i++) {
    const x = r() * 256
    const y = r() * 256
    const rad = 2.5 + r() * 11
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad)
    gr.addColorStop(0, 'rgba(255,250,236,.95)')
    gr.addColorStop(1, 'rgba(226,190,136,.6)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(150,104,56,.28)'
    g.lineWidth = 1
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeSteamTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = rand(3)
  for (let k = 0; k < 7; k++) {
    const x = 64 + (r() - 0.5) * 38
    const y = 64 + (r() - 0.5) * 54
    const rad = 24 + r() * 20
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, 'rgba(255,255,255,.5)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeSugarTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const r = rand(11)
  g.fillStyle = '#f7f3ea'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 520; i++) {
    const v = 200 + Math.floor(r() * 56)
    g.fillStyle = `rgb(${v},${v - 2},${v - 8})`
    g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2))
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  const bump = new THREE.CanvasTexture(c)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  return { map, bump }
}

export function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62)
  gr.addColorStop(0, 'rgba(0,0,0,.5)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
