import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  FLOOR,
  H,
  LID_H,
  innerR,
  makeBackLabelTexture,
  makeCollarGeometry,
  makeCupGeometry,
  makeFoamTexture,
  makeLidGeometry,
  makeLidTextTexture,
  makeLiquidGeometry,
  makeRibTexture,
  makeShadowTexture,
  makeStickerGeometry,
  makeStreamGeometry,
  makeSteamTexture,
  makeSugarTexture,
  setLiquid,
  shapeStream,
} from './tea3d/parts.js'

const S = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t

const MILK = new THREE.Color('#f4e6c2')
const TEA = new THREE.Color('#bf8446')
const DROP_MILK = new THREE.Color('#fbf1da')
const DROP_TEA = new THREE.Color('#b9742f')
const RIPPLE_MILK = new THREE.Color('#fffaf0')
const RIPPLE_TEA = new THREE.Color('#f6dfae')
const LEVEL_MAX = 0.86
const MILK_LEVEL = 0.24

const Y_TOP = 6.9 // the streams start above the picture
const PX = 0.08 // where the streams land

const MILK_T = { start: 0.22, headDur: 0.03, end: 0.36, tailDur: 0.03 }
const TEA_T = { start: 0.53, headDur: 0.03, end: 0.8, tailDur: 0.035 }

const CUBES = [
  { x: -0.3, z: 0.14, s: 0.395 },
  { x: 0.34, z: -0.18, s: 0.43 },
  { x: 0.02, z: 0.3, s: 0.465 },
]
const CUBE_FALL = 0.04
const CUBE_SINK = 0.025
const CUBE_SIZE = 0.32

const DROPS = Array.from({ length: 12 }, (_, i) => ({ a: i * 2.399, v: 0.35 + (i % 4) * 0.13, vy: 1.4 + (i % 3) * 0.4, off: i / 12 }))
const STEAM = Array.from({ length: 14 }, (_, i) => ({
  off: (i * 0.173) % 1,
  ox: Math.cos(i * 2.1) * (0.35 + ((i * 37) % 10) / 16),
  oz: Math.sin(i * 2.1) * (0.35 + ((i * 53) % 10) / 16),
  k: i * 1.7,
}))

/** labels that point at what is being added; w = [fade in start, fade in end, fade out start, fade out end] */
const LABELS = [
  { id: 'lid1', en: 'Sip lid', my: 'အဖုံး', side: 'left', w: [-0.01, 0, 0.075, 0.1] },
  { id: 'milk', en: 'Milk', my: 'နို့', side: 'left', w: [0.225, 0.25, 0.36, 0.39] },
  { id: 'sugar', en: 'Sugar', my: 'သကြား', side: 'right', w: [0.395, 0.415, 0.5, 0.525] },
  { id: 'tea', en: 'Strong tea', my: 'လက်ဖက်ရည်ပြင်း', side: 'left', w: [0.54, 0.57, 0.78, 0.81] },
  { id: 'steam', en: 'Steaming hot', my: 'ပူပူလေး', side: 'right', w: [0.6, 0.64, 0.84, 0.88] },
  { id: 'lid2', en: 'Sip lid on', my: 'အဖုံး', side: 'left', w: [0.93, 0.96, 1.02, 1.03] },
]

function streamState(c, p) {
  const head = S(c.start, c.start + c.headDur, p)
  const tail = S(c.end, c.end + c.tailDur, p)
  const grow = 0.55 + 0.45 * S(c.start + c.headDur, c.start + c.headDur + 0.02, p)
  const flow = grow * (1 - 0.65 * tail)
  const hit = head > 0.999 && tail < 0.9 ? flow : 0
  return { head, tail, flow, hit }
}

function Scene({ progress, onFrame }) {
  const { gl, scene, camera, size, clock } = useThree()
  const logoTex = useLoader(THREE.TextureLoader, 'img/logo-sticker.webp')
  const cup = useRef()
  const lid = useRef()
  const liquid = useRef()
  const foam = useRef()
  const milkS = useRef()
  const teaS = useRef()
  const ripples = useRef([])
  const drops = useRef([])
  const cubes = useRef([])
  const steam = useRef([])
  const lastLevel = useRef(-1)

  const parts = useMemo(() => {
    logoTex.colorSpace = THREE.SRGBColorSpace
    logoTex.anisotropy = 8
    const rib = makeRibTexture()
    const sugar = makeSugarTexture()
    const steamTex = makeSteamTexture()
    const ripple = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    return {
      cupGeo: makeCupGeometry(),
      collarGeo: makeCollarGeometry(),
      stickerFront: makeStickerGeometry(0.55, 1.6, 0),
      stickerBack: makeStickerGeometry(0.55, 1.6, Math.PI),
      cupMat: new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.55, side: THREE.DoubleSide }),
      collarMat: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rib.map, bumpMap: rib.bumpMap, bumpScale: 1.4, roughness: 0.6, side: THREE.DoubleSide }),
      logoMat: new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }),
      backMat: new THREE.MeshStandardMaterial({ map: makeBackLabelTexture(), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),

      lidGeo: makeLidGeometry(),
      lidMat: new THREE.MeshPhysicalMaterial({ color: '#2f1a10', roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
      lidTextMat: new THREE.MeshStandardMaterial({ map: makeLidTextTexture(), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      slotMat: new THREE.MeshBasicMaterial({ color: '#0a0504', polygonOffset: true, polygonOffsetFactor: -3 }),

      liquidGeo: makeLiquidGeometry(),
      liquidMat: new THREE.MeshPhysicalMaterial({ color: MILK.clone(), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1, side: THREE.DoubleSide }),
      foamMat: new THREE.MeshStandardMaterial({ map: makeFoamTexture(), roughness: 0.55, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),

      milkGeo: makeStreamGeometry(),
      teaGeo: makeStreamGeometry(),
      milkStreamMat: new THREE.MeshPhysicalMaterial({ color: '#f8eed6', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
      teaStreamMat: new THREE.MeshPhysicalMaterial({ color: '#b8702a', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5, transparent: true, opacity: 0.93, side: THREE.DoubleSide }),

      rippleGeo: new THREE.RingGeometry(0.86, 1, 48),
      rippleMats: Array.from({ length: 5 }, ripple),
      dropGeo: new THREE.SphereGeometry(1, 10, 8),
      dropMat: new THREE.MeshPhysicalMaterial({ color: DROP_MILK.clone(), roughness: 0.15, clearcoat: 1 }),

      cubeGeo: new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
      cubeMat: new THREE.MeshStandardMaterial({ color: '#fffdf6', map: sugar.map, bumpMap: sugar.bump, bumpScale: 1.6, roughness: 0.8 }),

      steamMats: STEAM.map(() => new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: '#ffffff' })),
      shadow: makeShadowTexture(),
    }
  }, [logoTex])

  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])

  const v = useMemo(() => new THREE.Vector3(), [])
  const out = useMemo(
    () => ({ dim: { x: 0, top: 0, bottom: 0, show: 0 }, cupL: 0, cupR: 0, width: 0, labels: LABELS.map(() => ({ ax: 0, ay: 0, a: 0 })) }),
    [],
  )

  useFrame(() => {
    const p = progress.get()
    const t = clock.elapsedTime

    const open = S(0.1, 0.2, p) - S(0.84, 0.93, p)
    const yaw = p < 0.1 ? lerp(-0.62, 0.05, S(0, 0.1, p)) : p < 0.84 ? lerp(0.05, 0.5, (p - 0.1) / 0.74) : lerp(0.5, 0, S(0.84, 1, p))
    if (cup.current) cup.current.rotation.y = yaw

    const L = lid.current
    if (L) {
      L.visible = open < 0.99
      L.position.set(lerp(0, 1.6, open), lerp(H, 9.5, open), 0)
      L.rotation.set(0, yaw * (1 - open), -open * 0.9)
    }

    const ms = streamState(MILK_T, p)
    const ts = streamState(TEA_T, p)
    const level = MILK_LEVEL * S(0.245, 0.365, p) + (LEVEL_MAX - MILK_LEVEL) * S(0.555, 0.8, p)
    if (Math.abs(level - lastLevel.current) > 1e-4) {
      setLiquid(parts.liquidGeo, Math.max(level, 0.004))
      lastLevel.current = level
    }
    const topY = FLOOR + level * (H - FLOOR)
    const surfR = innerR(topY) - 0.06
    if (liquid.current) {
      liquid.current.visible = level > 0.004
      parts.liquidMat.color.copy(MILK).lerp(TEA, S(0.56, 0.78, p))
    }

    if (milkS.current) {
      milkS.current.visible = shapeStream(parts.milkGeo, { x: PX, z: 0, yTop: Y_TOP, yHit: topY, head: ms.head, tail: ms.tail, flow: ms.flow, r0: 0.066, narrow: 0.45, wob: 0.14, sway: 0.035, lean: 0.4, t })
    }
    if (teaS.current) {
      const pull = S(0.66, 0.74, p) // poured from higher: thinner, swaying
      teaS.current.visible = shapeStream(parts.teaGeo, { x: PX, z: 0, yTop: Y_TOP, yHit: topY, head: ts.head, tail: ts.tail, flow: ts.flow, r0: lerp(0.046, 0.038, pull), narrow: 0.5, wob: 0.1, sway: lerp(0.025, 0.1, pull), lean: lerp(0.3, 0.55, pull), t })
    }

    const hit = Math.max(ms.hit, ts.hit)
    const teaHits = ts.hit > ms.hit
    const rcol = teaHits ? RIPPLE_TEA : RIPPLE_MILK
    for (let k = 0; k < 2; k++) {
      const r = ripples.current[k]
      if (!r) continue
      const ph = (t * 0.85 + k * 0.5) % 1
      r.visible = hit > 0.2
      r.position.set(PX, topY + 0.006, 0)
      r.scale.setScalar(Math.max(0.01, (0.1 + ph * 0.62) * surfR))
      parts.rippleMats[k].color.copy(rcol)
      parts.rippleMats[k].opacity = Math.min(1, hit) * (1 - ph) * 0.6
    }
    parts.dropMat.color.copy(teaHits ? DROP_TEA : DROP_MILK)
    DROPS.forEach((d, i) => {
      const m = drops.current[i]
      if (!m) return
      const tau = ((t * 1.8 + d.off) % 1) * 0.36
      const y = topY + d.vy * tau - 4.5 * tau * tau
      m.visible = hit > 0.2 && y > topY + 0.005
      m.position.set(PX + Math.cos(d.a) * d.v * tau * 2.2, y, Math.sin(d.a) * d.v * tau * 2.2)
      m.scale.setScalar(0.03 * Math.min(1, hit))
    })

    let activeCube = CUBES[0]
    let activeY = Y_TOP - 0.6
    CUBES.forEach((c, i) => {
      const m = cubes.current[i]
      const q = clamp01((p - c.s) / CUBE_FALL)
      const sink = clamp01((p - c.s - CUBE_FALL) / CUBE_SINK)
      const falling = p > c.s && sink < 1
      let y = lerp(Y_TOP - 0.3, topY + CUBE_SIZE * 0.45, q * q)
      if (q >= 1) y = lerp(topY + CUBE_SIZE * 0.45, topY - CUBE_SIZE * 0.9, sink)
      if (m) {
        m.visible = falling
        m.position.set(c.x, y, c.z)
        m.rotation.set(q * 6 + i, q * 8 + i * 2, q * 4)
        m.scale.setScalar(1 - 0.25 * sink)
      }
      if (falling && q < 1) {
        activeCube = c
        activeY = y
      }
      const r = clamp01((p - c.s - CUBE_FALL) / 0.03)
      const rp = ripples.current[2 + i]
      if (rp) {
        rp.visible = r > 0 && r < 1
        rp.position.set(c.x, topY + 0.006, c.z)
        rp.scale.setScalar(Math.max(0.01, (0.12 + r * 0.5) * surfR))
        parts.rippleMats[2 + i].color.copy(RIPPLE_MILK)
        parts.rippleMats[2 + i].opacity = (1 - r) * 0.65
      }
    })

    if (foam.current) {
      const amt = S(0.7, 0.8, p)
      foam.current.visible = amt > 0.01
      foam.current.position.y = topY + 0.004
      foam.current.scale.set(surfR, surfR, 1)
      parts.foamMat.opacity = amt * 0.92
    }

    const steamAmt = S(0.55, 0.66, p)
    const slotX = 0.504 * Math.cos(yaw) + 0.622 * Math.sin(yaw)
    const slotZ = -0.504 * Math.sin(yaw) + 0.622 * Math.cos(yaw)
    const shown = Math.round(lerp(4, 14, open))
    STEAM.forEach((st, i) => {
      const sp = steam.current[i]
      if (!sp) return
      const ph = (t * 0.2 + st.off) % 1
      const bump = S(0, 0.18, ph) * (1 - S(0.55, 1, ph))
      const alpha = i < shown ? steamAmt * bump * lerp(0.4, 0.85, open) : 0
      const spread = 0.6 * open * surfR
      sp.visible = alpha > 0.004
      sp.position.set(
        lerp(slotX, 0, open) + st.ox * spread + Math.sin(t * 0.9 + st.k) * 0.22 * ph,
        lerp(H + 0.1, topY + 0.1, open) + ph * 2.3,
        lerp(slotZ, 0, open) + st.oz * spread + Math.cos(t * 0.8 + st.k) * 0.08 * ph,
      )
      const sc = lerp(0.6, 1.8, ph) * lerp(0.7, 1, open)
      sp.scale.set(sc, sc, 1)
      parts.steamMats[i].opacity = alpha
    })

    const fov = (camera.fov * Math.PI) / 180
    const aspect = size.width / size.height
    const pour = S(0.17, 0.26, p) - S(0.84, 0.92, p)
    const needH = lerp(4.9, 6.0, pour)
    const needW = aspect < 0.9 ? 5.2 : 4.4
    const dist = Math.max(needH / (2 * Math.tan(fov / 2)), needW / (2 * Math.tan(fov / 2) * aspect))
    const elev = lerp(0.3, 0.95, S(0.08, 0.27, p)) - 0.65 * S(0.86, 0.97, p)
    const ty = lerp(1.45, 1.8, pour)
    camera.position.set(0.2, ty + Math.sin(elev) * dist, Math.cos(elev) * dist)
    camera.lookAt(0.2, ty, 0)
    camera.updateMatrixWorld()

    const proj = (x, y, z) => {
      v.set(x, y, z).project(camera)
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height]
    }
    const [bx, by] = proj(1.5, 0, 0)
    const [, ty2] = proj(1.5, H + LID_H, 0)
    out.dim.x = bx
    out.dim.top = ty2
    out.dim.bottom = by
    out.dim.show = 1 - S(0.08, 0.14, p) + S(0.93, 1, p)
    out.cupL = proj(-1.3, 1.2, 0)[0]
    out.cupR = proj(1.3, 1.2, 0)[0]
    out.width = size.width

    let lidAt = [0, 0]
    if (L && L.visible) {
      L.updateMatrixWorld(true)
      L.localToWorld(v.set(-0.8, 0.1, 0.45))
      lidAt = proj(v.x, v.y, v.z)
    }
    const anchors = {
      lid1: lidAt,
      lid2: lidAt,
      milk: proj(PX, 3.9, 0),
      sugar: proj(activeCube.x, Math.min(activeY, 4.6), activeCube.z),
      tea: proj(PX, 3.6, 0),
      steam: proj(0.3, H + 1.4, 0),
    }
    LABELS.forEach((lb, i) => {
      const [a, b, c, d] = lb.w
      const o = out.labels[i]
      o.a = S(a, b, p) * (1 - S(c, d, p))
      o.ax = anchors[lb.id][0]
      o.ay = anchors[lb.id][1]
    })
    onFrame(out)
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 5]} intensity={2.2} />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#fff1d6" />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[5.5, 5.5]} />
        <meshBasicMaterial map={parts.shadow} transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <group ref={cup}>
        <mesh geometry={parts.cupGeo} material={parts.cupMat} />
        <mesh geometry={parts.collarGeo} material={parts.collarMat} />
        <mesh geometry={parts.stickerFront} material={parts.logoMat} />
        <mesh geometry={parts.stickerBack} material={parts.backMat} />
        <mesh ref={liquid} geometry={parts.liquidGeo} material={parts.liquidMat} visible={false} />
        <mesh ref={foam} rotation-x={-Math.PI / 2} material={parts.foamMat} visible={false}>
          <circleGeometry args={[1, 56]} />
        </mesh>
      </group>

      <group ref={lid} position={[0, H, 0]}>
        <mesh geometry={parts.lidGeo} material={parts.lidMat} />
        <mesh position={[0, LID_H + 0.0015, 0]} rotation-x={-Math.PI / 2} material={parts.lidTextMat}>
          <circleGeometry args={[0.62, 64]} />
        </mesh>
        <group rotation-y={-0.89} position={[0, 0.0925, 0]}>
          <mesh position={[0.8, 0, 0]} rotation-x={-Math.PI / 2} scale={[0.065, 0.2, 1]} material={parts.slotMat}>
            <circleGeometry args={[1, 28]} />
          </mesh>
        </group>
      </group>

      <mesh ref={milkS} geometry={parts.milkGeo} material={parts.milkStreamMat} visible={false} frustumCulled={false} />
      <mesh ref={teaS} geometry={parts.teaGeo} material={parts.teaStreamMat} visible={false} frustumCulled={false} />

      {parts.rippleMats.map((m, i) => (
        <mesh key={`r${i}`} ref={(el) => (ripples.current[i] = el)} geometry={parts.rippleGeo} material={m} rotation-x={-Math.PI / 2} visible={false} />
      ))}
      {DROPS.map((d, i) => (
        <mesh key={`d${i}`} ref={(el) => (drops.current[i] = el)} geometry={parts.dropGeo} material={parts.dropMat} visible={false} />
      ))}
      {CUBES.map((c, i) => (
        <mesh key={`c${i}`} ref={(el) => (cubes.current[i] = el)} geometry={parts.cubeGeo} material={parts.cubeMat} visible={false} />
      ))}
      {STEAM.map((s, i) => (
        <sprite key={`s${i}`} ref={(el) => (steam.current[i] = el)} material={parts.steamMats[i]} visible={false} renderOrder={5} />
      ))}
    </>
  )
}

export default function Tea3D({ progress, label }) {
  const wrap = useRef(null)
  const dim = useRef(null)
  const labelEls = useRef([])
  const groupEls = useRef([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { threshold: 0 })
    if (wrap.current) io.observe(wrap.current)
    return () => io.disconnect()
  }, [])

  const onFrame = useMemo(
    () => (d) => {
      const el = dim.current
      if (el) {
        el.style.transform = `translate(${d.dim.x + 14}px, ${d.dim.top}px)`
        el.style.height = `${Math.max(0, d.dim.bottom - d.dim.top)}px`
        el.style.opacity = String(clamp01(d.dim.show))
      }
      LABELS.forEach((lb, i) => {
        const box = labelEls.current[i]
        const g = groupEls.current[i]
        if (!box || !g) return
        const l = d.labels[i]
        box.style.opacity = String(l.a)
        g.style.opacity = String(l.a)
        if (l.a < 0.01) return
        const right = lb.side === 'right'
        if (box._ww !== d.width) {
          box.style.maxWidth = `${Math.min(150, d.width * 0.42)}px`
          box._w = box.offsetWidth
          box._ww = d.width
        }
        const w = box._w
        const near = right ? d.cupR + 26 : d.cupL - 26
        const fits = right ? d.width - near - 8 >= w : near - 8 >= w
        const x = fits ? near : right ? d.width - 8 : 8
        const alignRight = fits ? !right : right
        const y = l.ay - 36
        box.style.textAlign = alignRight ? 'right' : 'left'
        box.style.transform = `translate(${x}px, ${y}px)${alignRight ? ' translateX(-100%)' : ''}`
        const bl = alignRight ? x - w : x
        const edge = l.ax > bl + w / 2 ? bl + w + 6 : bl - 6 // the side of the text that faces the anchor
        const line = g.firstChild
        const dot = g.lastChild
        line.setAttribute('x1', l.ax)
        line.setAttribute('y1', l.ay)
        line.setAttribute('x2', edge)
        line.setAttribute('y2', y + 13)
        dot.setAttribute('cx', l.ax)
        dot.setAttribute('cy', l.ay)
      })
    },
    [],
  )

  return (
    <div className="t3d" ref={wrap} role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ fov: 30, position: [0, 4, 10], near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Suspense fallback={null}>
          <Scene progress={progress} onFrame={onFrame} />
        </Suspense>
      </Canvas>
      <div className="tea-dim" ref={dim} aria-hidden="true">
        <span>about 3 in · 7.5 cm</span>
      </div>
      <svg className="w3d-leaders tea-leaders" aria-hidden="true">
        {LABELS.map((lb, i) => (
          <g key={lb.id} ref={(el) => (groupEls.current[i] = el)} style={{ opacity: 0 }}>
            <line className="tea-lead-line" strokeWidth="1.8" />
            <circle className="tea-lead-dot" r="4.5" />
          </g>
        ))}
      </svg>
      {LABELS.map((lb, i) => (
        <div key={lb.id} ref={(el) => (labelEls.current[i] = el)} className={`w3d-label tea-label ${lb.side === 'left' ? 'left' : 'right'}`} aria-hidden="true">
          <b>{lb.en}</b>
          <span lang="my">{lb.my}</span>
        </div>
      ))}
    </div>
  )
}
