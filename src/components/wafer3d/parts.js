import * as THREE from 'three'

export const SHEET = 2.4
export const THICK = { wafer: 0.11, milk: 0.07, choco: 0.07, coconut: 0.15 }

/** small deterministic random */
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function makeWaffleTextures() {
  const S = 512
  const N = 8
  const cell = S / N
  const r = rng(11)

  const color = document.createElement('canvas')
  color.width = color.height = S
  const g = color.getContext('2d')
  g.fillStyle = '#e4b45f'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * cell
      const y = j * cell
      const gr = g.createLinearGradient(x, y, x + cell, y + cell)
      gr.addColorStop(0, '#f6d896')
      gr.addColorStop(1, '#e2ae55')
      g.fillStyle = gr
      g.fillRect(x + 9, y + 9, cell - 18, cell - 18)
    }
  }
  g.strokeStyle = '#a56d1f'
  g.lineWidth = 9
  for (let i = 0; i <= N; i++) {
    g.beginPath()
    g.moveTo(i * cell, 0)
    g.lineTo(i * cell, S)
    g.moveTo(0, i * cell)
    g.lineTo(S, i * cell)
    g.stroke()
  }
  for (let k = 0; k < 900; k++) {
    g.fillStyle = r() > 0.5 ? 'rgba(150,88,20,.22)' : 'rgba(255,240,200,.25)'
    g.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3)
  }

  const bump = document.createElement('canvas')
  bump.width = bump.height = S
  const b = bump.getContext('2d')
  b.fillStyle = '#ffffff'
  b.fillRect(0, 0, S, S)
  b.strokeStyle = '#000'
  b.lineWidth = 14
  for (let i = 0; i <= N; i++) {
    b.beginPath()
    b.moveTo(i * cell, 0)
    b.lineTo(i * cell, S)
    b.moveTo(0, i * cell)
    b.lineTo(S, i * cell)
    b.stroke()
  }

  const map = new THREE.CanvasTexture(color)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const bumpMap = new THREE.CanvasTexture(bump)
  bumpMap.anisotropy = 8
  return { map, bumpMap }
}

export function makeSheetMaterials({ map, bumpMap }) {
  const side = new THREE.MeshStandardMaterial({ color: '#c8963f', roughness: 0.75 })
  const top = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 0.7 })
  const bottom = new THREE.MeshStandardMaterial({ color: '#b98532', roughness: 0.8 })
  // BoxGeometry order: +x, -x, +y (top), -y (bottom), +z, -z
  return [side, side, top, bottom, side, side]
}

export function makePuddleGeometry(seed, radius = 1.0, height = 0.07) {
  const r = rng(seed)
  const geo = new THREE.CylinderGeometry(radius, radius, height, 88, 4, false)
  geo.translate(0, height / 2, 0)
  const lobes = Array.from({ length: 6 }, () => ({ a: r() * Math.PI * 2, w: 0.06 + r() * 0.1, s: 0.25 + r() * 0.2 }))
  const ph = r() * 6
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = pos.getY(i)
    const rad = Math.hypot(x, z)
    if (rad < 1e-4) {
      pos.setY(i, y + height * 0.55) // centre of the dome
      continue
    }
    const a = Math.atan2(z, x)
    let f = 1 + 0.035 * Math.sin(3 * a + ph) + 0.025 * Math.sin(5 * a + 2 * ph) + 0.015 * Math.sin(9 * a + 3 * ph)
    for (const l of lobes) {
      let d = Math.abs(a - l.a)
      d = Math.min(d, Math.PI * 2 - d)
      f += l.w * Math.exp(-(d * d) / (2 * l.s * l.s))
    }
    pos.setX(i, x * f)
    pos.setZ(i, z * f)
    if (y > height * 0.9) pos.setY(i, y + height * 0.5 * (1 - Math.min(1, rad / radius) ** 2))
  }
  geo.computeVertexNormals()
  return geo
}

export function makeDrizzleMaterial(kind) {
  return kind === 'milk'
    ? new THREE.MeshPhysicalMaterial({
        color: '#ffe6a0',
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        emissive: '#7a5a12',
        emissiveIntensity: 0.22,
        envMapIntensity: 1.25,
      })
    : new THREE.MeshPhysicalMaterial({
        color: '#3d1e0d',
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.4,
      })
}

export const DRIPS = [
  { a: 0.35, k: 0.95, r: 1.0 },
  { a: 1.15, k: 0.55, r: 0.99 },
  { a: 1.95, k: 0.85, r: 1.02 },
  { a: 2.9, k: 0.7, r: 1.0 },
  { a: 3.7, k: 0.98, r: 1.01 },
  { a: 4.45, k: 0.6, r: 0.99 },
  { a: 5.4, k: 0.8, r: 1.0 },
]

export function makeRibbonsGeometry(seed, count = 54) {
  const r = rng(seed)
  const positions = []
  const colors = []
  const index = []
  const RINGS = 14
  let base = 0

  for (let n = 0; n < count; n++) {
    const rad = Math.sqrt(r()) * 0.92
    const ang = r() * Math.PI * 2
    const cx = Math.cos(ang) * rad
    const cz = Math.sin(ang) * rad
    const y0 = 0.03 + r() * 0.07
    const dirA = r() * Math.PI * 2
    const dx = Math.cos(dirA)
    const dz = Math.sin(dirA)
    const len = 0.7 + r() * 0.55
    const bulge = 0.05 + r() * 0.1
    const wig = (r() - 0.5) * 0.28
    const wigF = 1 + r() * 1.5
    const curl = (r() - 0.5) * 1.6
    const twist0 = r() * Math.PI * 2
    const twist = (r() - 0.5) * 3.2
    const w = 0.12 + r() * 0.08
    const th = 0.04 + r() * 0.025
    const tint = 0.93 + r() * 0.07

    const pts = []
    for (let k = 0; k <= RINGS; k++) {
      const s = k / RINGS
      const along = (s - 0.5) * len
      const side = wig * Math.sin(Math.PI * 2 * wigF * s)
      const x = cx + dx * along - dz * side
      const z = cz + dz * along + dx * side
      const y = y0 + bulge * Math.sin(Math.PI * s) + curl * 0.06 * Math.sin(Math.PI * 2 * s)
      pts.push(new THREE.Vector3(x, Math.max(0.02, y), z))
    }

    for (let k = 0; k <= RINGS; k++) {
      const p = pts[k]
      const a = pts[Math.max(0, k - 1)]
      const b = pts[Math.min(RINGS, k + 1)]
      const T = new THREE.Vector3().subVectors(b, a).normalize()
      const phi = twist0 + twist * (k / RINGS)
      const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(T, phi)
      const W = new THREE.Vector3().crossVectors(T, up).normalize()
      const N = new THREE.Vector3().crossVectors(W, T).normalize()
      const taper = k === 0 || k === RINGS ? 0.55 : 1
      const hw = (w / 2) * taper
      const ht = (th / 2) * taper
      const corners = [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ]
      for (const [cw, cn] of corners) {
        const v = p.clone().addScaledVector(W, hw * cw).addScaledVector(N, ht * cn)
        positions.push(v.x, v.y, v.z)
        colors.push(tint, tint, tint * 0.98)
      }
    }
    for (let k = 0; k < RINGS; k++) {
      const a = base + k * 4
      const b = base + (k + 1) * 4
      for (let e = 0; e < 4; e++) {
        const e2 = (e + 1) % 4
        index.push(a + e, b + e, b + e2, a + e, b + e2, a + e2)
      }
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3)
    const last = base + RINGS * 4
    index.push(last, last + 2, last + 1, last, last + 3, last + 2)
    base += (RINGS + 1) * 4
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

export function makeCoconutMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.22,
    emissive: '#f4ead4',
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  })
}

export function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 126)
  gr.addColorStop(0, 'rgba(0,0,0,.55)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
