// 3D parts at real size (1 unit = 1 cm): Uno R3, half-size breadboard, 5 mm LED, resistor, push button,
// 10k potentiometer, SG90 servo, jumper wires and the current-flow dots.
import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BB, DIGITAL_PINS, UNO, ANALOG_PINS, POWER_PINS, PITCH, holePos, place, resistorBands } from './layout.js'
import { live, SceneContext } from './live.js'
import { makeBreadboardTexture, makeGlowTexture, makeMetalTexture, makeUnoTexture } from './textures.js'

// ---------- small building blocks ----------
function Box({ size, pos = [0, 0, 0], color = '#888', rough = 0.5, metal = 0, rot, emissive, emissiveIntensity = 1, radius, shadow = true }) {
  const geometry = useMemo(() => (radius ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius) : new THREE.BoxGeometry(...size)), [size.join(','), radius])
  return (
    <mesh geometry={geometry} position={pos} rotation={rot} castShadow={shadow} receiveShadow>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} />
    </mesh>
  )
}
function Cyl({ r, h, pos = [0, 0, 0], color = '#888', rough = 0.5, metal = 0, rot, rTop, segments = 24, emissive, emissiveIntensity = 1, shadow = true }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, segments]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} />
    </mesh>
  )
}

const clampDelta = (delta) => Math.min(delta, 0.1)
const easeOutCubic = (value) => 1 - (1 - value) ** 3

// Progress 0..1 that grows after `delay` seconds once `show` turns on, and falls quickly when it turns off.
export function useGrow(show, delay = 0, seconds = 0.8) {
  const progress = useRef(0)
  const waited = useRef(0)
  useFrame((_, delta) => {
    const dt = clampDelta(delta)
    if (show) {
      waited.current += dt
      if (waited.current >= delay) progress.current = Math.min(1, progress.current + dt / seconds)
    } else {
      waited.current = 0
      progress.current = Math.max(0, progress.current - dt * 4)
    }
  })
  return progress
}

// A part starts on the bench tray (offset `rest` from its final place), is carried up in an arc, then pressed into its holes.
// `slide` parts (the breadboard) slide in along the table. `fixed` parts never move.
const smooth = (value) => { const x = Math.min(1, Math.max(0, value)); return x * x * (3 - 2 * x) }
const DROP_SECONDS = 1.3
function Drop({ show, delay = 0, rest, slide, fixed = false, placed = false, children }) {
  const group = useRef()
  const { sandbox } = useContext(SceneContext)
  const elapsed = useRef(placed && show ? DROP_SECONDS : 0)
  const waited = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (show) {
      waited.current += dt
      if (waited.current >= delay) elapsed.current = Math.min(DROP_SECONDS, elapsed.current + dt)
    } else {
      waited.current = 0
      elapsed.current = Math.max(0, elapsed.current - dt * 2.5)
    }
    const q = elapsed.current / DROP_SECONDS
    const node = group.current
    if (fixed) return
    if (slide) {
      node.visible = q > 0.001
      node.position.set(slide[0] * (1 - smooth(q)), 0, slide[2] * (1 - smooth(q)))
      return
    }
    const offset = rest ?? (sandbox ? [0, 2.4, 0] : [0, 0, 0])
    const hover = sandbox ? 0 : 1.3
    if (q < 0.62) {
      const e = smooth(q / 0.62)
      node.position.set(offset[0] * (1 - e), offset[1] * (1 - e) + hover * e + (sandbox ? 0 : 1.1 * Math.sin(Math.PI * e)), offset[2] * (1 - e))
    } else {
      const r = (q - 0.62) / 0.38
      node.position.set(0, hover * (1 - r) ** 3 - 0.07 * Math.sin(Math.PI * r), 0)
    }
  })
  return <group ref={group}>{children}</group>
}

// Turns its children about the vertical axis through `at`.
function Turn({ at, angle, children }) {
  return (
    <group position={[at[0], 0, at[2]]} rotation={[0, angle, 0]}>
      <group position={[-at[0], 0, -at[2]]}>{children}</group>
    </group>
  )
}

// Pulsing rings on the holes a new part goes into.
function HoleMarks({ holes, show, delay = 0 }) {
  const { theme } = useContext(SceneContext)
  const group = useRef()
  const age = useRef(0)
  useFrame((state, delta) => {
    age.current += Math.min(delta, 0.1)
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5)
    group.current.visible = show && age.current > delay
    group.current.children.forEach((ring) => {
      ring.scale.setScalar(0.9 + pulse * 0.45)
      ring.material.opacity = 0.95 - pulse * 0.45
    })
  })
  return (
    <group ref={group} visible={false}>
      {holes.map((hole, index) => (
        <mesh key={index} position={[hole[0], hole[1] + 0.012, hole[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <ringGeometry args={[0.1, 0.19, 28]} />
          <meshBasicMaterial color={theme.accentColor} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- breadboard ----------
export function Breadboard({ show, delay, placed }) {
  const texture = useMemo(() => makeBreadboardTexture(), [])
  return (
    <Drop show={show} delay={0} slide={[-11, 0, 0]} placed={placed}>
      <Box size={[BB.w, BB.h, BB.d]} pos={[BB.x, BB.h / 2 - 0.002, BB.z]} color="#e6e3dc" rough={0.55} radius={0.07} />
      <mesh position={[BB.x, BB.h + 0.002, BB.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BB.w - 0.05, BB.d - 0.05]} />
        <meshStandardMaterial map={texture} roughness={0.5} />
      </mesh>
      {/* the two rows of mounting tabs on the long sides, as on a real half-size board */}
      <Box size={[BB.w - 0.3, 0.06, 0.05]} pos={[BB.x, 0.3, BB.z + BB.d / 2 + 0.01]} color="#d8d5cc" shadow={false} />
      <Box size={[BB.w - 0.3, 0.06, 0.05]} pos={[BB.x, 0.3, BB.z - BB.d / 2 - 0.01]} color="#d8d5cc" shadow={false} />
    </Drop>
  )
}

// ---------- Uno ----------
const mmToLocal = (bx, by) => [(bx - 34.29) / 10, (26.67 - by) / 10]

function Headers() {
  const goldRef = useRef()
  const holeRef = useRef()
  const pinPositions = useMemo(() => {
    const list = []
    const farZ = -(UNO.d / 2 - 0.254)
    const nearZ = UNO.d / 2 - 0.254
    DIGITAL_PINS.forEach(([, inches]) => list.push([inches * 2.54 - UNO.w / 2, farZ]))
    POWER_PINS.forEach(([, inches]) => list.push([inches * 2.54 - UNO.w / 2, nearZ]))
    ANALOG_PINS.forEach(([, inches]) => list.push([inches * 2.54 - UNO.w / 2, nearZ]))
    return list
  }, [])
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    pinPositions.forEach(([x, z], index) => {
      matrix.makeTranslation(x, UNO.t + UNO.headerH + 0.002, z)
      goldRef.current.setMatrixAt(index, matrix)
      matrix.makeTranslation(x, UNO.t + UNO.headerH + 0.006, z)
      holeRef.current.setMatrixAt(index, matrix)
    })
    goldRef.current.instanceMatrix.needsUpdate = true
    holeRef.current.instanceMatrix.needsUpdate = true
  }, [pinPositions])
  const block = (firstInches, count, z) => (
    <Box key={`${firstInches}-${z}`} size={[count * PITCH, UNO.headerH, 0.254]} pos={[(firstInches + (count - 1) * 0.05) * 2.54 - UNO.w / 2, UNO.t + UNO.headerH / 2, z]} color="#202327" rough={0.6} />
  )
  const farZ = -(UNO.d / 2 - 0.254)
  const nearZ = UNO.d / 2 - 0.254
  return (
    <group>
      {block(0.64, 10, farZ)}
      {block(1.8, 8, farZ)}
      {block(1.0, 8, nearZ)}
      {block(1.9, 6, nearZ)}
      <instancedMesh ref={goldRef} args={[null, null, pinPositions.length]}>
        <boxGeometry args={[0.17, 0.01, 0.17]} />
        <meshStandardMaterial color="#d6b34a" metalness={0.9} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={holeRef} args={[null, null, pinPositions.length]}>
        <boxGeometry args={[0.1, 0.01, 0.1]} />
        <meshStandardMaterial color="#050607" roughness={1} />
      </instancedMesh>
    </group>
  )
}

function SmdLed({ at, colour, drive, always = 0, size = [0.2, 0.08, 0.12] }) {
  const material = useRef()
  const light = useRef()
  useFrame(() => {
    const level = Math.max(always, drive ? live.drive[drive] ?? 0 : 0)
    material.current.emissiveIntensity = 0.1 + level * 5
    if (light.current) light.current.intensity = level * 0.5
  })
  return (
    <group position={at}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial ref={material} color={colour} emissive={colour} emissiveIntensity={0.1} roughness={0.35} />
      </mesh>
      {(drive || always) && <pointLight ref={light} color={colour} distance={2.5} decay={2} intensity={0} position={[0, 0.3, 0]} />}
    </group>
  )
}

export function UnoBoard({ show = true }) {
  const texture = useMemo(() => makeUnoTexture(), [])
  const metal = useMemo(() => makeMetalTexture(), [])
  const at = (bx, by, y = UNO.t) => {
    const [x, z] = mmToLocal(bx, by)
    return [x, y, z]
  }
  const dipPins = []
  for (let index = 0; index < 14; index += 1) {
    const x = (-16.5 + index * 2.54) / 10 * 1
    dipPins.push(<Box key={`a${index}`} size={[0.05, 0.14, 0.1]} pos={[x, 0.07, -0.43]} color="#bfc6cc" metal={0.9} rough={0.35} shadow={false} />)
    dipPins.push(<Box key={`b${index}`} size={[0.05, 0.14, 0.1]} pos={[x, 0.07, 0.43]} color="#bfc6cc" metal={0.9} rough={0.35} shadow={false} />)
  }
  return (
    <group position={[UNO.x, UNO.y, UNO.z]} visible={show}>
      <mesh position={[0, UNO.t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[UNO.w, UNO.t, UNO.d]} />
        <meshStandardMaterial attach="material-0" color="#08616d" roughness={0.5} />
        <meshStandardMaterial attach="material-1" color="#08616d" roughness={0.5} />
        <meshStandardMaterial attach="material-2" map={texture} roughness={0.38} metalness={0.05} />
        <meshStandardMaterial attach="material-3" color="#08616d" roughness={0.5} />
        <meshStandardMaterial attach="material-4" color="#08616d" roughness={0.5} />
        <meshStandardMaterial attach="material-5" color="#08616d" roughness={0.5} />
      </mesh>
      <Headers />
      {/* USB-B receptacle: 16 x 12 x 11 mm steel shell, hanging past the left edge */}
      <group position={at(1.8, 38.0, UNO.t)}>
        <Box size={[1.6, 1.1, 1.2]} pos={[0, 0.55, 0]} color="#e3e8ec" metal={0.8} rough={0.28} />
        <Box size={[0.04, 0.02, 1.2]} pos={[0.45, 1.105, 0]} color="#6f7a85" metal={0.9} rough={0.4} shadow={false} />
        <Box size={[0.08, 0.7, 0.8]} pos={[-0.8, 0.55, 0]} color="#101214" rough={0.9} shadow={false} />
        <Box size={[0.1, 0.18, 0.5]} pos={[-0.805, 0.42, 0]} color="#d9dde0" metal={0.7} shadow={false} />
      </group>
      {/* DC barrel jack: 14 x 9 x 11 mm */}
      <group position={at(3.0, 8.0, UNO.t)}>
        <Box size={[1.42, 1.1, 0.9]} pos={[0, 0.55, 0]} color="#1b1e22" rough={0.55} />
        <Box size={[0.08, 0.72, 0.58]} pos={[-0.71, 0.6, 0]} color="#050607" rough={1} shadow={false} />
        <Cyl r={0.12} h={0.12} pos={[-0.76, 0.6, 0]} rot={[0, 0, Math.PI / 2]} color="#aab0b6" metal={0.9} shadow={false} />
      </group>
      {/* ATmega328P, 28-pin DIP in a socket: 34.8 x 7.5 x 3.5 mm */}
      <group position={at(47, 18, UNO.t)}>
        <Box size={[3.6, 0.3, 0.92]} pos={[0, 0.15, 0]} color="#0d0f11" rough={0.7} />
        <Box size={[3.48, 0.35, 0.75]} pos={[0, 0.47, 0]} color="#17191c" rough={0.45} />
        <ChipLabel />
        <Cyl r={0.06} h={0.02} pos={[-1.5, 0.66, 0.2]} color="#2c2f33" shadow={false} />
        <group position={[0, 0.2, 0]}>{dipPins}</group>
      </group>
      {/* ATmega16U2 (USB bridge), TQFP-32 */}
      <group position={at(25.5, 33.0, UNO.t)}>
        <Box size={[0.7, 0.1, 0.7]} pos={[0, 0.08, 0]} color="#16181b" rough={0.5} />
        <Box size={[0.76, 0.03, 0.76]} pos={[0, 0.02, 0]} color="#aeb5ba" metal={0.8} shadow={false} />
      </group>
      {/* 16 MHz crystal, regulator, capacitors, reset button, ICSP headers */}
      <Box size={[1.12, 0.32, 0.46]} pos={at(33.5, 27.0, UNO.t + 0.16)} color="#cfd5da" metal={0.95} rough={0.25} />
      <Box size={[0.65, 0.15, 0.35]} pos={at(20.5, 21.0, UNO.t + 0.075)} color="#14161a" rough={0.5} />
      <Box size={[0.4, 0.06, 0.3]} pos={at(20.5, 24.0, UNO.t + 0.03)} color="#b8bec3" metal={0.9} shadow={false} />
      <Cyl r={0.32} h={0.55} pos={at(15.5, 17.0, UNO.t + 0.275)} color="#c6ccd1" metal={0.9} rough={0.3} />
      <Cyl r={0.32} h={0.55} pos={at(15.5, 24.0, UNO.t + 0.275)} color="#c6ccd1" metal={0.9} rough={0.3} />
      <Cyl r={0.3} h={0.04} pos={at(15.5, 17.0, UNO.t + 0.56)} color="#2b2d30" shadow={false} />
      <Cyl r={0.3} h={0.04} pos={at(15.5, 24.0, UNO.t + 0.56)} color="#2b2d30" shadow={false} />
      <group position={at(14.5, 45.0, UNO.t)}>
        <Box size={[0.62, 0.2, 0.62]} pos={[0, 0.1, 0]} color="#c4c9ce" metal={0.9} rough={0.3} />
        <Cyl r={0.2} h={0.16} pos={[0, 0.28, 0]} color="#22262b" rough={0.5} />
      </group>
      <Box size={[0.76, 0.85, 0.5]} pos={at(65.0, 30.0, UNO.t + 0.425)} color="#202327" rough={0.6} rot={[0, Math.PI / 2, 0]} />
      <Box size={[0.76, 0.85, 0.5]} pos={at(6.0, 49.0, UNO.t + 0.425)} color="#202327" rough={0.6} />
      {/* small passives */}
      {[[40, 36], [42, 36], [44, 38], [30, 40], [28, 22], [29, 14], [37, 8], [40, 24], [52, 33], [55, 35], [22, 29], [24, 44]].map(([bx, by], index) => (
        <Box key={index} size={[0.2, 0.06, 0.1]} pos={at(bx, by, UNO.t + 0.03)} color={index % 3 ? '#25211c' : '#a79a82'} shadow={false} />
      ))}
      {/* the four status LEDs: L (pin 13), TX, RX, ON */}
      <SmdLed at={at(32.5, 37.0, UNO.t + 0.04)} colour="#ffb020" drive="onboardL" />
      <SmdLed at={at(32.5, 35.0, UNO.t + 0.04)} colour="#ffb020" drive="onboardTx" />
      <SmdLed at={at(32.5, 33.0, UNO.t + 0.04)} colour="#ffb020" drive="onboardRx" />
      <SmdLed at={at(44.6, 35.8, UNO.t + 0.05)} colour="#37e07a" always={1} />
    </group>
  )
}

function ChipLabel() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const g = canvas.getContext('2d')
    g.fillStyle = '#17191c'
    g.fillRect(0, 0, 512, 128)
    g.fillStyle = '#9aa2a8'
    g.font = '700 38px "Bahnschrift", Arial, sans-serif'
    g.textBaseline = 'middle'
    g.fillText('ATMEGA328P-PU', 90, 40)
    g.font = '600 26px "Bahnschrift", Arial, sans-serif'
    g.fillText('16 MHz  DIP-28', 90, 88)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.anisotropy = 8
    return result
  }, [])
  return (
    <mesh position={[0, 0.652, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.3, 0.7]} />
      <meshStandardMaterial map={texture} roughness={0.5} />
    </mesh>
  )
}

// ---------- jumper wires ----------
const PLUG_HEIGHT = 0.95
export function wireCurve(spec) {
  const start = new THREE.Vector3(...place(spec.from))
  const end = new THREE.Vector3(...place(spec.to))
  const startTop = start.clone().add(new THREE.Vector3(0, PLUG_HEIGHT, 0))
  const endTop = end.clone().add(new THREE.Vector3(0, PLUG_HEIGHT, 0))
  const points = [startTop, startTop.clone().add(new THREE.Vector3(0, 0.35, 0))]
  if (spec.via) spec.via.forEach((point) => points.push(new THREE.Vector3(...point)))
  else {
    const span = startTop.distanceTo(endTop)
    const middle = startTop.clone().lerp(endTop, 0.5)
    middle.y += spec.arc ?? Math.max(0.6, span * 0.22)
    points.push(middle)
  }
  points.push(endTop.clone().add(new THREE.Vector3(0, 0.35, 0)), endTop)
  return new THREE.CatmullRomCurve3(points, false, 'centripetal')
}

function Plug({ colour }) {
  return (
    <group>
      <Box size={[0.25, PLUG_HEIGHT - 0.1, 0.25]} pos={[0, 0.1 + (PLUG_HEIGHT - 0.1) / 2, 0]} color={colour} rough={0.55} radius={0.03} />
      <Box size={[0.07, 0.62, 0.07]} pos={[0, -0.02, 0]} color="#d6b34a" metal={0.9} rough={0.3} shadow={false} />
    </group>
  )
}

// The bench tray beside the board: wires lie here as loose coils (plugs on their sides), parts wait in two columns.
export const TRAY = { x: -6.6, z: 2.5, w: 3.6, d: 13.5, top: 0.12 }
export const traySpot = (index) => [TRAY.x + (index % 2 === 0 ? -0.9 : 0.9), TRAY.top, 4.6 + Math.floor(index / 2) * 1.3]

export function Tray() {
  return (
    <group>
      <Box size={[TRAY.w, TRAY.top, TRAY.d]} pos={[TRAY.x, TRAY.top / 2, TRAY.z]} color="#7a8394" rough={0.8} radius={0.05} />
    </group>
  )
}

const SAMPLES = 28
const WIRE_SECONDS = 2.0
const clamp01 = (value) => Math.min(1, Math.max(0, value))

function coilOf(slot, length) {
  const turns = Math.max(2, Math.min(6, Math.round(length / 4)))
  const centreZ = TRAY.z - 5.9 + slot * 1.0
  const points = []
  for (let index = 0; index < SAMPLES; index += 1) {
    const s = index / (SAMPLES - 1)
    points.push(new THREE.Vector3(
      TRAY.x + 0.7 * Math.sin(2 * Math.PI * turns * s) * (0.35 + 0.65 * Math.sin(Math.PI * s)),
      TRAY.top + 0.1 + 0.07 * Math.sin(6 * Math.PI * s),
      centreZ + (s - 0.5) * 0.7 + 0.2 * Math.sin(4 * Math.PI * turns * s + 1),
    ))
  }
  const plug = new THREE.Vector3(PLUG_HEIGHT, 0, 0)
  const first = points[0].clone().sub(plug)
  const last = points[SAMPLES - 1].clone().sub(plug)
  first.y = TRAY.top + 0.13
  last.y = TRAY.top + 0.13
  return { points, first, last }
}

// One plug: rests on the tray, is lifted and carried in an arc, lowered over the hole, pressed in with a tiny settle.
function plugPose(u, hole, rest, out) {
  const carry = clamp01(u / 0.7)
  out.progress = clamp01(u)
  if (u <= 0) {
    out.tip.copy(rest)
    out.alpha = Math.PI / 2
  } else if (u < 0.7) {
    const e = smooth(carry)
    const hover = hole.y + 1.5
    out.tip.set(
      rest.x + (hole.x - rest.x) * e,
      rest.y + (hover - rest.y) * e + 1.4 * Math.sin(Math.PI * e),
      rest.z + (hole.z - rest.z) * e,
    )
    out.alpha = (Math.PI / 2) * (1 - smooth(Math.min(1, e * 1.6)))
  } else if (u < 1) {
    const r = (u - 0.7) / 0.3
    out.tip.set(hole.x, hole.y + 1.5 * (1 - r) ** 3 - 0.08 * Math.sin(Math.PI * r), hole.z)
    out.alpha = 0
  } else {
    out.tip.copy(hole)
    out.alpha = 0
  }
  return out
}

export function Wire({ spec, show, delay = 0, slot = 0, instant = false }) {
  const { curves } = useContext(SceneContext)
  const finalPoints = useMemo(() => curves[spec.id].getSpacedPoints(SAMPLES - 1), [curves, spec.id])
  const holeA = useMemo(() => new THREE.Vector3(...place(spec.from)), [spec])
  const holeB = useMemo(() => new THREE.Vector3(...place(spec.to)), [spec])
  const coil = useMemo(() => coilOf(slot, curves[spec.id].getLength()), [slot, curves, spec.id])
  const mesh = useRef()
  const plugA = useRef()
  const plugB = useRef()
  const elapsed = useRef(instant ? WIRE_SECONDS : 0)
  const waited = useRef(0)
  const drawn = useRef(-1)
  const poseA = useMemo(() => ({ tip: new THREE.Vector3(), alpha: 0, progress: 0 }), [])
  const poseB = useMemo(() => ({ tip: new THREE.Vector3(), alpha: 0, progress: 0 }), [])
  useEffect(() => () => mesh.current?.geometry.dispose(), [])
  useFrame((_, delta) => {
    const dt = clampDelta(delta)
    if (show) {
      waited.current += dt
      if (waited.current >= delay) elapsed.current = Math.min(WIRE_SECONDS, elapsed.current + dt)
    } else {
      waited.current = 0
      elapsed.current = Math.max(0, elapsed.current - dt * 2.2)
    }
    const t = elapsed.current
    if (t === drawn.current) return
    drawn.current = t
    plugPose(t, holeA, coil.first, poseA)
    plugPose(t - 1, holeB, coil.last, poseB)
    const topA = new THREE.Vector3(Math.sin(poseA.alpha), Math.cos(poseA.alpha), 0).multiplyScalar(PLUG_HEIGHT).add(poseA.tip)
    const topB = new THREE.Vector3(Math.sin(poseB.alpha), Math.cos(poseB.alpha), 0).multiplyScalar(PLUG_HEIGHT).add(poseB.tip)
    const weight = smooth(0.4 * poseA.progress + 0.6 * poseB.progress)
    const last = SAMPLES - 1
    const points = []
    for (let index = 0; index < SAMPLES; index += 1) {
      const s = index / last
      const pullA = (1 - s) ** 1.5
      const pullB = s ** 1.5
      const loose = coil.points[index].clone().addScaledVector(topA.clone().sub(coil.points[0]), pullA).addScaledVector(topB.clone().sub(coil.points[last]), pullB)
      const placed = finalPoints[index].clone().addScaledVector(topA.clone().sub(finalPoints[0]), pullA).addScaledVector(topB.clone().sub(finalPoints[last]), pullB)
      const point = loose.lerp(placed, weight)
      if (index > 0 && index < last) {
        const overBoard = Math.abs(point.x - BB.x) < 4.2 && Math.abs(point.z - BB.z) < 2.8
        const overUno = Math.abs(point.x - UNO.x) < 3.5 && Math.abs(point.z - UNO.z) < 2.75
        const floor = overUno ? 1.2 : overBoard ? BB.h + 0.15 : TRAY.top + 0.1
        point.y = Math.max(point.y, weight < 0.999 ? floor : -9)
      }
      points.push(point)
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 80, 0.07, 8, false)
    mesh.current.geometry.dispose()
    mesh.current.geometry = geometry
    plugA.current.position.copy(poseA.tip)
    plugA.current.rotation.z = -poseA.alpha
    plugB.current.position.copy(poseB.tip)
    plugB.current.rotation.z = -poseB.alpha
  })
  return (
    <group>
      <mesh ref={mesh} castShadow receiveShadow>
        <bufferGeometry />
        <meshStandardMaterial color={spec.colour} roughness={0.45} metalness={0.05} />
      </mesh>
      <group ref={plugA}><Plug colour={spec.colour} /></group>
      <group ref={plugB}><Plug colour={spec.colour} /></group>
    </group>
  )
}

// ---------- resistor (axial, 1/4 W) ----------
export function Resistor({ spec, show, delay, rest, placed }) {
  const holeA = holePos(spec.a[0], spec.a[1])
  const holeB = holePos(spec.b[0], spec.b[1])
  const mid = [(holeA[0] + holeB[0]) / 2, BB.h, (holeA[2] + holeB[2]) / 2]
  const turned = Boolean(spec.turn)
  const a = turned ? [mid[0] - 0.381, BB.h, mid[2]] : holeA
  const b = turned ? [mid[0] + 0.381, BB.h, mid[2]] : holeB
  const bands = useMemo(() => resistorBands(spec.ohms), [spec.ohms])
  const height = 0.34
  const length = Math.abs(b[0] - a[0])
  const bodyLength = 0.63
  const centreX = (a[0] + b[0]) / 2
  const bandOffsets = [-0.23, -0.12, 0.0, 0.2]
  return (
    <Drop show={show} delay={delay} rest={rest} placed={placed}>
      <Turn at={mid} angle={spec.turn ?? 0}>
      <group position={[0, 0, a[2]]}>
        <Cyl r={0.032} h={height + 0.35} pos={[a[0], BB.h + height / 2 - 0.175, 0]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
        <Cyl r={0.032} h={height + 0.35} pos={[b[0], BB.h + height / 2 - 0.175, 0]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
        <group position={[0, BB.h, 0]}>
          <Cyl r={0.032} h={(length - bodyLength) / 2 + 0.05} pos={[a[0] + ((length - bodyLength) / 2) / 2 * Math.sign(b[0] - a[0]) + 0.0, height, 0]} rot={[0, 0, Math.PI / 2]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
          <Cyl r={0.032} h={(length - bodyLength) / 2 + 0.05} pos={[b[0] - ((length - bodyLength) / 2) / 2 * Math.sign(b[0] - a[0]), height, 0]} rot={[0, 0, Math.PI / 2]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
          <group position={[centreX, height, 0]}>
            <Cyl r={0.125} h={bodyLength - 0.16} rot={[0, 0, Math.PI / 2]} color="#dcc08a" rough={0.5} />
            <Cyl r={0.15} h={0.14} pos={[-bodyLength / 2 + 0.07, 0, 0]} rot={[0, 0, Math.PI / 2]} color="#dcc08a" rough={0.5} />
            <Cyl r={0.15} h={0.14} pos={[bodyLength / 2 - 0.07, 0, 0]} rot={[0, 0, Math.PI / 2]} color="#dcc08a" rough={0.5} />
            {bands.map((colour, index) => (
              <Cyl key={index} r={0.158} h={0.065} pos={[bandOffsets[index], 0, 0]} rot={[0, 0, Math.PI / 2]} color={colour} rough={0.6} shadow={false} />
            ))}
          </group>
        </group>
        <group position={[0, BB.h, 0]} />
      </group>
      </Turn>
    </Drop>
  )
}

// ---------- LED, 5 mm ----------
const LED_COLOURS = { red: ['#ff2f2f', '#d84a46'], yellow: ['#ffc21a', '#f1c04a'], green: ['#2fe068', '#52c97f'] }
export function Led({ spec, show, delay, ready, rest, placed }) {
  const holeAnode = holePos(spec.anode[0], spec.anode[1])
  const holeCathode = holePos(spec.cathode[0], spec.cathode[1])
  const mid = [(holeAnode[0] + holeCathode[0]) / 2, BB.h, (holeAnode[2] + holeCathode[2]) / 2]
  const turned = Boolean(spec.turn)
  const anode = turned ? [mid[0] - 0.381, BB.h, mid[2]] : holeAnode
  const cathode = turned ? [mid[0] + 0.381, BB.h, mid[2]] : holeCathode
  const [glowColour, bodyColour] = LED_COLOURS[spec.color]
  const profile = useMemo(() => {
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(0.29, 0), new THREE.Vector2(0.29, 0.1), new THREE.Vector2(0.25, 0.1), new THREE.Vector2(0.25, 0.58)]
    for (let step = 1; step <= 12; step += 1) {
      const angle = (step / 12) * (Math.PI / 2)
      points.push(new THREE.Vector2(0.25 * Math.cos(angle), 0.58 + 0.28 * Math.sin(angle)))
    }
    return points
  }, [])
  const material = useRef()
  const light = useRef()
  const glow = useRef()
  const glowTexture = useMemo(() => makeGlowTexture(), [])
  const { current } = useContext(SceneContext)
  useFrame(() => {
    const level = ready ? live.drive[spec.drive] ?? 0 : 0
    material.current.emissiveIntensity = 0.04 + level * 2.6
    material.current.opacity = 0.82 + level * 0.18
    light.current.intensity = level * 1.4
    glow.current.material.opacity = level * (current ? 1 : 0.9)
    glow.current.scale.setScalar((0.4 + level * 2.6) * (current ? 1.35 : 1))
  })
  const centreX = (anode[0] + cathode[0]) / 2
  const lift = 0.28
  return (
    <Drop show={show} delay={delay} rest={rest} placed={placed}>
      <Turn at={mid} angle={spec.turn ?? 0}>
      {/* legs: the anode is the longer, bent one */}
      <Box size={[0.05, 0.7, 0.05]} pos={[anode[0], BB.h - 0.2 + 0.0, anode[2]]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
      <Box size={[0.05, 0.7, 0.05]} pos={[cathode[0], BB.h - 0.2 + 0.0, cathode[2]]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
      <Box size={[0.05, 0.05, 0.05 + 0.0]} pos={[anode[0], BB.h + 0.17, anode[2]]} color="#c9ced3" shadow={false} />
      <group position={[centreX, BB.h + lift, anode[2]]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[profile, 40]} />
          <meshStandardMaterial ref={material} color={bodyColour} emissive={glowColour} emissiveIntensity={0.04} transparent opacity={0.85} roughness={0.18} metalness={0.05} />
        </mesh>
        {/* die cup and anvil visible through the lens */}
        <Cyl r={0.045} h={0.4} pos={[-0.12, 0.28, 0]} color="#b9bfc4" metal={0.9} rough={0.3} shadow={false} />
        <Cyl r={0.045} h={0.4} pos={[0.12, 0.28, 0]} color="#b9bfc4" metal={0.9} rough={0.3} shadow={false} />
        <Cyl r={0.1} rTop={0.13} h={0.12} pos={[0.12, 0.5, 0]} color="#d4d8db" metal={0.9} rough={0.3} shadow={false} />
        <pointLight ref={light} color={glowColour} distance={3.2} decay={2} intensity={0} position={[0, 0.6, 0]} />
        <sprite ref={glow} position={[0, 0.55, 0]} renderOrder={6}>
          <spriteMaterial map={glowTexture} color={glowColour} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
      </Turn>
    </Drop>
  )
}

// ---------- tactile push button, 6 x 6 mm ----------
export function PushButton({ spec, show, delay, rest, placed }) {
  const [left, right] = spec.cols
  const frontZ = holePos(left, 'e')[2]
  const backZ = holePos(left, 'f')[2]
  const centre = [(holePos(left, 'e')[0] + holePos(right, 'e')[0]) / 2, BB.h, (frontZ + backZ) / 2]
  const cap = useRef()
  useFrame(() => {
    const target = live.pressed ? 0.35 : 0.42
    cap.current.position.y += (target - cap.current.position.y) * 0.6
  })
  const onDown = (event) => {
    event.stopPropagation()
    live.pressed = true
    live.hover = true
  }
  const release = () => {
    live.pressed = false
  }
  useEffect(() => {
    window.addEventListener('pointerup', release)
    return () => window.removeEventListener('pointerup', release)
  }, [])
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  return (
    <Drop show={show} delay={delay} rest={rest} placed={placed}>
      <Turn at={centre} angle={(spec.turn ?? 0) * Math.PI / 2}>
      <group position={centre}>
        {legs.map(([sx, sz], index) => (
          <Box key={index} size={[0.05, 0.5, 0.05]} pos={[sx * (right - left) * PITCH / 2, -0.12, sz * Math.abs(frontZ - backZ) / 2]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
        ))}
        <Box size={[0.62, 0.34, 0.62]} pos={[0, 0.22, 0]} color="#1c1f23" rough={0.55} radius={0.03} />
        <Box size={[0.6, 0.04, 0.6]} pos={[0, 0.4, 0]} color="#c8ced3" metal={0.9} rough={0.3} />
        <group ref={cap} position={[0, 0.42, 0]}>
          <Cyl r={0.2} h={0.2} pos={[0, 0.1, 0]} color="#e0463a" rough={0.45} segments={32} />
        </group>
        <mesh position={[0, 0.3, 0]} onPointerDown={onDown} onPointerOver={() => { live.hover = true }} onPointerOut={() => { live.hover = false }}>
          <cylinderGeometry args={[0.55, 0.55, 0.9, 20]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      </Turn>
    </Drop>
  )
}

// ---------- 10k rotary potentiometer ----------
export function Potentiometer({ spec, show, delay, rest, placed }) {
  const knob = useRef()
  const dragging = useRef(null)
  const middle = holePos(spec.col, 'e')
  const centre = [middle[0], BB.h, middle[2] - 0.5]
  useFrame(() => {
    knob.current.rotation.y = -THREE.MathUtils.degToRad(live.potAngle - 135)
  })
  const onDown = (event) => {
    event.stopPropagation()
    dragging.current = { x: event.nativeEvent.clientX, angle: live.potAngle }
    live.hover = true
    event.target.setPointerCapture?.(event.pointerId)
  }
  useEffect(() => {
    const onMove = (event) => {
      if (!dragging.current) return
      const angle = THREE.MathUtils.clamp(dragging.current.angle + (event.clientX - dragging.current.x) * 0.9, 0, 270)
      live.callbacks.setPot?.(Math.round(angle))
    }
    const onUp = () => {
      dragging.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])
  return (
    <Drop show={show} delay={delay} rest={rest} placed={placed}>
      {[-2, 0, 2].map((offset) => (
        <Box key={offset} size={[0.05, 0.62, 0.05]} pos={[middle[0] + offset * PITCH, BB.h + 0.12, middle[2]]} color="#c9ced3" metal={0.95} rough={0.25} shadow={false} />
      ))}
      <group position={centre} rotation={[0, (spec.turn ?? 0) * Math.PI / 2, 0]}>
        <Cyl r={0.5} h={0.5} pos={[0, 0.55, 0]} color="#2f6fd0" rough={0.5} segments={36} />
        <Cyl r={0.5} h={0.04} pos={[0, 0.82, 0]} color="#cfd5da" metal={0.9} rough={0.3} segments={36} />
        <Box size={[0.9, 0.2, 0.34]} pos={[0, 0.4, 0.34]} color="#2a60b8" rough={0.5} />
        <Cyl r={0.12} h={0.25} pos={[0, 0.95, 0]} color="#dfe4e8" metal={0.9} rough={0.25} />
        <group ref={knob} position={[0, 1.08, 0]}>
          <Cyl r={0.72} rTop={0.62} h={0.62} pos={[0, 0.31, 0]} color="#24272c" rough={0.5} segments={48} />
          <Cyl r={0.64} rTop={0.64} h={0.03} pos={[0, 0.635, 0]} color="#3a3e45" rough={0.4} segments={48} />
          <Box size={[0.09, 0.03, 0.5]} pos={[0, 0.66, -0.3]} color="#f4f6f7" rough={0.4} shadow={false} />
        </group>
        <mesh position={[0, 1.4, 0]} onPointerDown={onDown} onPointerOver={() => { live.hover = true }} onPointerOut={() => { if (!dragging.current) live.hover = false }}>
          <cylinderGeometry args={[0.85, 0.85, 1.4, 24]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </Drop>
  )
}

// ---------- SG90 micro servo ----------
export function Servo({ spec, show, delay, rest, placed }) {
  const horn = useRef()
  const pins = spec.plugCols.map((col) => holePos(col, spec.row))
  const base = spec.at
  const cable = useMemo(() => {
    const quarter = (spec.turn ?? 0) * Math.PI / 2
    const exit = new THREE.Vector3(base[0] - 1.14 * Math.cos(quarter), 0.45, base[2] + 1.14 * Math.sin(quarter))
    const plugSide = new THREE.Vector3(pins[2][0] + 0.55, BB.h + 0.55, pins[1][2])
    return new THREE.CatmullRomCurve3([
      exit,
      new THREE.Vector3(exit.x - 0.6, 0.55, exit.z - 0.1),
      new THREE.Vector3(4.7, 1.35, (exit.z + plugSide.z) / 2),
      new THREE.Vector3(plugSide.x + 0.9, BB.h + 1.0, plugSide.z),
      plugSide,
    ], false, 'centripetal')
  }, [base, pins, spec.turn])
  const strands = ['#6b3f1d', '#d63a2f', '#ff9a1f'] // brown ground, red 5 V, orange signal
  const strandGeometries = useMemo(
    () => strands.map((colour, index) => {
      const offset = (index - 1) * 0.085
      const points = cable.getPoints(50).map((point) => point.clone().add(new THREE.Vector3(0, offset * 0.5, offset)))
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 60, 0.045, 6, false)
    }),
    [cable],
  )
  useFrame(() => {
    const angle = THREE.MathUtils.degToRad(live.servoAngle)
    horn.current.rotation.y = angle - 0 // 0 deg points at +x, 90 deg points away from the viewer
  })
  return (
    <>
      <Drop show={show} delay={delay} fixed>
        <group position={base} rotation={[0, (spec.turn ?? 0) * Math.PI / 2, 0]}>
          <Box size={[2.28, 2.27, 1.22]} pos={[0, 1.135, 0]} color="#2d62b8" rough={0.45} radius={0.04} />
          <Box size={[3.25, 0.25, 1.2]} pos={[0.0, 1.62, 0]} color="#2d62b8" rough={0.45} />
          <Box size={[0.3, 0.3, 0.3]} pos={[-1.35, 0.45, 0]} color="#1c1f23" rough={0.6} />
          <Cyl r={0.6} h={0.33} pos={[0.52, 2.43, 0]} color="#2d62b8" rough={0.45} segments={32} />
          <Cyl r={0.26} h={0.3} pos={[0.52, 2.7, 0]} color="#dfe4e8" metal={0.8} rough={0.3} />
          <group ref={horn} position={[0.52, 2.86, 0]}>
            <Cyl r={0.42} h={0.14} color="#f1f3f4" rough={0.5} segments={32} />
            <mesh position={[0.95, 0, 0]} castShadow>
              <boxGeometry args={[1.9, 0.12, 0.34]} />
              <meshStandardMaterial color="#f1f3f4" roughness={0.5} />
            </mesh>
            <Cyl r={0.17} h={0.13} pos={[1.82, 0, 0]} color="#f1f3f4" rough={0.5} />
            <Cyl r={0.07} h={0.16} pos={[1.45, 0, 0]} color="#8d96a0" shadow={false} />
            <Cyl r={0.07} h={0.16} pos={[1.15, 0, 0]} color="#8d96a0" shadow={false} />
          </group>
        </group>
      </Drop>
      <Drop show={show} delay={delay + 0.3} fixed>
        {strandGeometries.map((geometry, index) => (
          <mesh key={index} geometry={geometry} castShadow>
            <meshStandardMaterial color={strands[index]} roughness={0.5} />
          </mesh>
        ))}
        {/* three-pin male header on the breadboard and the servo's plug on top of it */}
        {pins.map((pin, index) => (
          <Box key={index} size={[0.065, 0.9, 0.065]} pos={[pin[0], BB.h + 0.05, pin[2]]} color="#d6b34a" metal={0.9} rough={0.3} shadow={false} />
        ))}
        <Box size={[3 * PITCH, 0.24, PITCH]} pos={[pins[1][0], BB.h + 0.12, pins[1][2]]} color="#16181b" rough={0.6} />
        <Box size={[3 * PITCH + 0.06, 0.6, 0.31]} pos={[pins[1][0], BB.h + 0.54, pins[1][2]]} color="#202327" rough={0.55} radius={0.03} />
      </Drop>
    </>
  )
}

// ---------- current flow ----------
// Bright dots with a short trail travel along a polyline from + to - while there is current (and "Show current" is on).
// Speed follows the current in mA. Red on the 5 V side, blue on the ground side (`split` = fraction of the path at the LED).
const RED = new THREE.Color('#ff3b30')
const BLUE = new THREE.Color('#2f9bff')
const TRAIL = [[0, 1, 3.4], [0.22, 0.72, 1.8], [0.44, 0.46, 1.0]]
export function Flow({ path, drive, ready, ma = 14, split = 2, levelOf }) {
  const mesh = useRef()
  const phase = useRef(0)
  const { current } = useContext(SceneContext)
  const { positions, lengths, total } = useMemo(() => {
    const cumulative = [0]
    for (let index = 1; index < path.length; index += 1) cumulative.push(cumulative[index - 1] + path[index].distanceTo(path[index - 1]))
    return { positions: path, lengths: cumulative, total: cumulative[cumulative.length - 1] }
  }, [path])
  const count = Math.max(6, Math.floor(total / 0.9))
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tint = useMemo(() => new THREE.Color(), [])
  useFrame((_, delta) => {
    const level = levelOf ? levelOf() : ready ? live.drive[drive] ?? 0 : 0
    const visible = current && level > 0.04
    mesh.current.visible = visible
    if (!visible) return
    const amount = ma * level
    phase.current += Math.min(delta, 0.1) * (1.4 + 0.22 * Math.min(amount, 14))
    const spacing = total / count
    for (let index = 0; index < count; index += 1) {
      TRAIL.forEach(([behind, size, glow], trailIndex) => {
        const distance = (((phase.current + index * spacing - behind) % total) + total) % total
        let segment = 1
        while (segment < lengths.length - 1 && lengths[segment] < distance) segment += 1
        const span = lengths[segment] - lengths[segment - 1] || 1
        const t = (distance - lengths[segment - 1]) / span
        dummy.position.lerpVectors(positions[segment - 1], positions[segment], t)
        dummy.scale.setScalar(size * Math.min(1, 0.4 + amount / 8))
        dummy.updateMatrix()
        const slotIndex = index * 3 + trailIndex
        mesh.current.setMatrixAt(slotIndex, dummy.matrix)
        const blend = smooth((distance / total - split) / 0.06 + 0.5)
        tint.copy(RED).lerp(BLUE, blend).multiplyScalar(glow)
        mesh.current.setColorAt(slotIndex, tint)
      })
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[null, null, count * 3]} frustumCulled={false} renderOrder={7} visible={false}>
      <sphereGeometry args={[0.13, 12, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export { Drop, HoleMarks, Box, Cyl }
