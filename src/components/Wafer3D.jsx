import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  DRIPS,
  SHEET,
  THICK,
  makeCoconutMaterial,
  makeDrizzleMaterial,
  makePuddleGeometry,
  makeRibbonsGeometry,
  makeShadowTexture,
  makeSheetMaterials,
  makeWaffleTextures,
} from './wafer3d/parts.js'

const GAP = 0.68 // distance between layers when pulled apart
const EDGE = { wafer: 1.35, milk: 1.1, choco: 1.1, coconut: 1.0 } // rough half width for the leader-line anchor

const LABEL = {
  wafer: { name: 'Wafer sheet', sub: 'ဝေဖာ · crispy sheet' },
  milk: { name: 'Milk drizzle', sub: 'ယို · runny condensed milk' },
  choco: { name: 'Chocolate drizzle', sub: 'ယို · runny chocolate' },
  coconut: { name: 'Coconut slices', sub: 'အုန်းသီးဖက် · young coconut' },
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))

function PackBox({ boxO }) {
  const group = useRef()
  const lid = useRef()
  const mats = useMemo(
    () => ({
      kraft: new THREE.MeshStandardMaterial({ color: '#c79a55', roughness: 0.85, transparent: true }),
      floor: new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.9, transparent: true }),
      lid: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      edge: new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }),
    }),
    [],
  )
  const lidEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.88, 0.5, 2.88)), [])
  useFrame(() => {
    const o = boxO.get()
    if (!group.current) return
    group.current.visible = o > 0.01
    mats.kraft.opacity = o
    mats.floor.opacity = o
    mats.lid.opacity = 0.16 * o
    mats.edge.opacity = 0.7 * o
    if (lid.current) lid.current.position.y = 0.95 + (1 - o) * 1.4
  })
  const wall = 0.7
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, -0.03, 0]} material={mats.floor}><boxGeometry args={[2.8, 0.06, 2.8]} /></mesh>
      <mesh position={[0, wall / 2, 1.4]} material={mats.kraft}><boxGeometry args={[2.86, wall, 0.06]} /></mesh>
      <mesh position={[0, wall / 2, -1.4]} material={mats.kraft}><boxGeometry args={[2.86, wall, 0.06]} /></mesh>
      <mesh position={[1.4, wall / 2, 0]} material={mats.kraft}><boxGeometry args={[0.06, wall, 2.8]} /></mesh>
      <mesh position={[-1.4, wall / 2, 0]} material={mats.kraft}><boxGeometry args={[0.06, wall, 2.8]} /></mesh>
      <group ref={lid} position={[0, 0.95, 0]}>
        <mesh material={mats.lid}><boxGeometry args={[2.88, 0.5, 2.88]} /></mesh>
        <lineSegments geometry={lidEdges} material={mats.edge} />
      </group>
    </group>
  )
}

function Scene({ layers, explode, boxO, yaw, onFrame }) {
  const { gl, scene, camera, size } = useThree()
  const stack = useRef()
  const groups = useRef([])
  const drips = useRef([])

  const parts = useMemo(() => {
    const tex = makeWaffleTextures()
    return {
      sheetGeo: new THREE.BoxGeometry(SHEET, THICK.wafer, SHEET),
      sheetMats: makeSheetMaterials(tex),
      puddles: [makePuddleGeometry(3), makePuddleGeometry(8), makePuddleGeometry(15)],
      ribbons: [makeRibbonsGeometry(21), makeRibbonsGeometry(77), makeRibbonsGeometry(140)],
      milk: makeDrizzleMaterial('milk'),
      choco: makeDrizzleMaterial('choco'),
      coconut: makeCoconutMaterial(),
      strandGeo: new THREE.CylinderGeometry(0.043, 0.024, 1, 12, 1, true),
      beadGeo: new THREE.SphereGeometry(0.078, 18, 14),
      shadowTex: makeShadowTexture(),
    }
  }, [])

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

  const base = useMemo(() => {
    const ys = []
    let y = 0
    for (const k of layers) {
      ys.push(y)
      y += THICK[k]
    }
    return ys
  }, [layers])

  const pts = useRef([])
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), l: new THREE.Vector3(), r: new THREE.Vector3(), right: new THREE.Vector3() }), [])

  useFrame(() => {
    const e = explode.get()
    const p = yaw.get()
    if (stack.current) stack.current.rotation.y = 0.55 + p * 5.2

    layers.forEach((k, i) => {
      const g = groups.current[i]
      if (g) g.position.y = base[i] + i * GAP * e
      if (k === 'milk' || k === 'choco') {
        const list = drips.current[i] || []
        list.forEach((d, j) => {
          if (!d) return
          const L = 0.07 + (j % 3) * 0.025 + GAP * e * DRIPS[j].k
          d.strand.scale.y = L
          d.strand.position.y = -L / 2 + 0.035
          d.bead.position.y = -L + 0.035
          const s = 1 - 0.3 * e
          d.bead.scale.set(s, 1 + 0.35 * e, s)
        })
      }
    })

    const fov = (camera.fov * Math.PI) / 180
    const aspect = size.width / size.height
    const needH = 7.4
    const needW = 8.4
    const dist = Math.max(needH / (2 * Math.tan(fov / 2)), needW / (2 * Math.tan(fov / 2) * aspect))
    const ease = e * e * (3 - 2 * e)
    const ty = 0.55 + (2.3 - 0.55) * ease
    camera.position.set(0, ty + dist * 0.4, dist * 0.92)
    camera.lookAt(0, ty, 0)
    camera.updateMatrixWorld()

    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0)
    layers.forEach((k, i) => {
      const y = base[i] + i * GAP * e + THICK[k] / 2
      const hw = EDGE[k]
      tmp.c.set(0, y, 0)
      tmp.l.copy(tmp.c).addScaledVector(tmp.right, -hw)
      tmp.r.copy(tmp.c).addScaledVector(tmp.right, hw)
      const proj = (v) => {
        const q = v.clone().project(camera)
        return [((q.x + 1) / 2) * size.width, ((1 - q.y) / 2) * size.height]
      }
      const [cx, cy] = proj(tmp.c)
      const [lx] = proj(tmp.l)
      const [rx] = proj(tmp.r)
      pts.current[i] = { cx, cy, lx, rx }
    })
    onFrame(pts.current, e)
  })

  let milkN = 0
  let chocoN = 0
  let cocoN = 0

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} />
      <directionalLight position={[-4, 2.5, -3]} intensity={0.7} color="#fff1d6" />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]}>
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial map={parts.shadowTex} transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <group ref={stack}>
        <PackBox boxO={boxO} />
        {layers.map((k, i) => {
          let body = null
          if (k === 'wafer') {
            body = <mesh geometry={parts.sheetGeo} material={parts.sheetMats} position-y={THICK.wafer / 2} />
          } else if (k === 'milk' || k === 'choco') {
            const mat = k === 'milk' ? parts.milk : parts.choco
            const n = k === 'milk' ? milkN++ : chocoN++
            drips.current[i] = []
            body = (
              <>
                <mesh geometry={parts.puddles[(n + (k === 'choco' ? 1 : 0)) % 3]} material={mat} />
                {DRIPS.map((d, j) => (
                  <group key={j} position={[Math.cos(d.a) * 1.02 * d.r, 0, Math.sin(d.a) * 1.02 * d.r]}>
                    <mesh geometry={parts.strandGeo} material={mat} ref={(el) => ((drips.current[i][j] ||= {}).strand = el)} />
                    <mesh geometry={parts.beadGeo} material={mat} ref={(el) => ((drips.current[i][j] ||= {}).bead = el)} />
                  </group>
                ))}
              </>
            )
          } else {
            body = <mesh geometry={parts.ribbons[cocoN++ % 3]} material={parts.coconut} />
          }
          return (
            <group key={`${k}-${i}`} ref={(el) => (groups.current[i] = el)} position-y={base[i]}>
              {body}
            </group>
          )
        })}
      </group>
    </>
  )
}

export default function Wafer3D({ layers, explode, boxO, yaw, label }) {
  const wrap = useRef(null)
  const labelEls = useRef([])
  const lineEls = useRef([])
  const dotEls = useRef([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { threshold: 0 })
    if (wrap.current) io.observe(wrap.current)
    return () => io.disconnect()
  }, [])

  const onFrame = useCallback((pts, e) => {
    const o = String(clamp01((e - 0.72) / 0.28))
    pts.forEach((p, i) => {
      if (!p) return
      const left = i % 2 === 0
      const ax = left ? p.lx : p.rx
      const lab = labelEls.current[i]
      const line = lineEls.current[i]
      const dot = dotEls.current[i]
      if (lab) {
        lab.style.transform = `translate(${left ? ax - 34 : ax + 34}px, ${p.cy}px) translate(${left ? '-100%' : '0'}, -50%)`
        lab.style.opacity = o
      }
      if (line) {
        line.setAttribute('x1', ax)
        line.setAttribute('x2', left ? ax - 30 : ax + 30)
        line.setAttribute('y1', p.cy)
        line.setAttribute('y2', p.cy)
        line.style.opacity = o
      }
      if (dot) {
        dot.setAttribute('cx', ax)
        dot.setAttribute('cy', p.cy)
        dot.style.opacity = o
      }
    })
  }, [])

  return (
    <div className="w3d" ref={wrap} role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ fov: 30, position: [0, 5, 11], near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Scene layers={layers} explode={explode} boxO={boxO} yaw={yaw} onFrame={onFrame} />
      </Canvas>

      <svg className="w3d-leaders" aria-hidden="true">
        {layers.map((k, i) => (
          <g key={i}>
            <line ref={(el) => (lineEls.current[i] = el)} stroke="#fff" strokeOpacity=".85" strokeWidth="1.6" />
            <circle ref={(el) => (dotEls.current[i] = el)} r="4.5" fill="#fff" />
          </g>
        ))}
      </svg>
      {layers.map((k, i) => (
        <div key={i} ref={(el) => (labelEls.current[i] = el)} className={`w3d-label ${i % 2 === 0 ? 'left' : 'right'}`} aria-hidden="true">
          <b>{LABEL[k].name}</b>
          <span lang="my">{LABEL[k].sub}</span>
        </div>
      ))}
    </div>
  )
}
