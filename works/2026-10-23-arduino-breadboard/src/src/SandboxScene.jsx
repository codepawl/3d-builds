// The 3D side of "Build your own": the placed parts and wires, drag-to-place, wire drawing, selection marks,
// the circuit check that runs every frame, and the current view for each lit LED.
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BB, place } from './layout.js'
import { live, SceneContext, setLabelEntries } from './live.js'
import { Breadboard, Flow, HoleMarks, Led, Potentiometer, PushButton, Resistor, Servo, Wire, wireCurve } from './parts.jsx'
import {
  addWire, checkCircuit, getSandbox, isPwmPin, ledLabelText, leadsOf, occupiedKeys, PICKABLE, pinLevelsAt, placeItem, refKey, rotOf,
  sandboxLive, SERVO_AT, setSandbox, useSandbox,
} from './sandbox.js'

const PICK_RADIUS = 0.17
const triangle = (value) => 1 - Math.abs((((value % 2) + 2) % 2) - 1)

function PartView({ part }) {
  const leads = leadsOf(part)
  const rot = rotOf(part)
  switch (part.kind) {
    case 'led': return <Led spec={{ id: part.id, color: part.color, anode: leads[0], cathode: leads[1], drive: `sb:${part.id}`, needs: [], turn: rot % 2 === 1 ? (rot === 1 ? Math.PI / 2 : -Math.PI / 2) : 0 }} show delay={0} ready />
    case 'resistor': return <Resistor spec={{ id: part.id, ohms: part.ohms, a: leads[0], b: leads[1], turn: rot % 2 === 1 ? Math.PI / 2 : 0 }} show delay={0} />
    case 'button': return <PushButton spec={{ id: part.id, cols: [part.col, part.col + 2], turn: rot }} show delay={0} />
    case 'pot': return <Potentiometer spec={{ id: part.id, col: part.col, turn: rot }} show delay={0} />
    case 'servo': return <Servo spec={{ id: part.id, at: SERVO_AT, plugCols: [part.col, part.col + 1, part.col + 2], row: 'e', turn: rot }} show delay={0} />
    default: return null
  }
}

// Wires and gestures. Everything listens on the window so the tray in the DOM and the canvas share one drag.
function Input() {
  const { camera, gl } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BB.h + 0.2)), [])
  useEffect(() => {
    const canvas = gl.domElement
    const point = new THREE.Vector3()
    const aim = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
    }
    const pick = (clientX, clientY) => {
      aim(clientX, clientY)
      let best = null
      let bestDistance = PICK_RADIUS
      PICKABLE.forEach((entry) => {
        point.set(entry.pos[0], entry.pos[1], entry.pos[2])
        const distance = ray.ray.distanceToPoint(point)
        if (distance < bestDistance) {
          best = entry
          bestDistance = distance
        }
      })
      return best ? best.ref : null
    }
    const overCanvas = (event) => document.elementFromPoint(event.clientX, event.clientY) === canvas
    let press = null
    const orbit = (enabled) => {
      const controls = window.__camera?.controls?.current
      if (controls) controls.enabled = enabled
      live.hover = !enabled
    }

    const onDown = (event) => {
      if (event.target !== canvas || event.button !== 0) return
      const ref = pick(event.clientX, event.clientY)
      const { parts, wires } = getSandbox()
      press = { x: event.clientX, y: event.clientY, ref }
      if (ref && !occupiedKeys(parts, wires).has(refKey(ref))) {
        event.stopPropagation()
        orbit(false)
        setSandbox({ draft: { from: ref, snap: null, end: null }, selected: null })
      }
    }
    const onMove = (event) => {
      const current = getSandbox()
      if (current.drag) {
        let snap = null
        if (overCanvas(event)) {
          const ref = pick(event.clientX, event.clientY)
          snap = ref ? placeItem(current.drag.item, ref, current.parts, current.wires) : null
        }
        setSandbox({ drag: { ...current.drag, x: event.clientX, y: event.clientY, snap } })
      } else if (current.draft) {
        aim(event.clientX, event.clientY)
        const hit = ray.ray.intersectPlane(plane, point)
        const ref = pick(event.clientX, event.clientY)
        const free = ref && refKey(ref) !== refKey(current.draft.from) && !occupiedKeys(current.parts, current.wires).has(refKey(ref))
        setSandbox({ draft: { ...current.draft, snap: free ? ref : null, end: hit ? [hit.x, hit.y, hit.z] : current.draft.end } })
      }
    }
    const onUp = (event) => {
      const current = getSandbox()
      if (current.drag) {
        if (current.drag.snap) {
          const id = `p${current.nextId}`
          setSandbox({ parts: [...current.parts, { ...current.drag.snap, id }], nextId: current.nextId + 1, selected: { kind: 'part', id }, drag: null })
        } else setSandbox({ drag: null })
      } else if (current.draft) {
        const { from, snap } = current.draft
        setSandbox({ draft: null })
        orbit(true)
        if (snap) addWire(from, snap)
      } else if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5 && event.target === canvas) {
        const key = press.ref ? refKey(press.ref) : null
        const part = key ? current.parts.find((entry) => leadsOf(entry).some((lead) => refKey(lead) === key)) : null
        const wire = key ? current.wires.find((entry) => refKey(entry.from) === key || refKey(entry.to) === key) : null
        if (part) setSandbox({ selected: { kind: 'part', id: part.id } })
        else if (wire) setSandbox({ selected: { kind: 'wire', id: wire.id } })
        else if (current.selected) setSandbox({ selected: null })
      }
      press = null
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, ray, plane])
  return null
}

// Runs the sketch and the circuit check every frame; publishes messages and the list of lit routes when they change.
function Simulation() {
  const clock = useRef(0)
  const lastSignature = useRef('')
  useFrame((_, delta) => {
    const state = getSandbox()
    clock.current = state.running ? clock.current + Math.min(delta, 0.1) : 0
    const potFraction = live.potAngle / 270
    const first = checkCircuit(state.parts, state.wires, { __pin: state.pin }, potFraction, live.pressed)
    const levels = state.running ? pinLevelsAt(state.preset, state.pin, clock.current, first, potFraction) : { __pin: state.pin }
    const check = state.running && state.preset !== 'servo' ? checkCircuit(state.parts, state.wires, levels, potFraction, live.pressed) : first
    const messages = [...check.messages]
    state.parts.filter((part) => part.kind === 'led').forEach((part) => {
      live.drive[`sb:${part.id}`] = check.leds[part.id]?.level ?? 0
    })
    sandboxLive.leds = check.leds
    if (!state.running) messages.unshift({ kind: 'idle', text: 'Press Run to start the sketch.' })
    else {
      if (['fade', 'pot'].includes(state.preset) && !isPwmPin(state.pin)) messages.unshift({ kind: 'warn', text: `Pin ${state.pin} has no PWM, so it can only be fully on or off. Try 3, 5, 6, 9, 10 or 11.` })
      if (state.preset === 'button' && !state.parts.some((part) => part.kind === 'button')) messages.unshift({ kind: 'warn', text: 'Add a button: 5V on one side, pin 2 and a 10 kΩ to GND on the other.' })
      if (state.preset === 'pot' && !state.parts.some((part) => part.kind === 'pot')) messages.unshift({ kind: 'warn', text: 'Add a potentiometer: 5V and GND on the outer pins, middle pin to A0.' })
      if (state.preset === 'pot' && state.parts.some((part) => part.kind === 'pot') && check.a0Fraction === null) messages.unshift({ kind: 'warn', text: 'A0 is not on the pot middle pin (with 5V and GND on the ends).' })
    }
    if (check.servo) {
      const wired = check.servo.powered && check.servo.pin !== null
      if (!check.servo.powered) messages.push({ kind: 'warn', text: 'Servo needs 5V and GND on its plug (brown is GND, red is 5V).' })
      else if (check.servo.pin === null) messages.push({ kind: 'warn', text: 'Servo signal wire (orange) is not on a pin yet.' })
      else if (check.servo.pin !== String(state.pin) && state.preset === 'servo') messages.push({ kind: 'warn', text: `Servo signal is on pin ${check.servo.pin}, the sketch uses pin ${state.pin}.` })
      else messages.push({ kind: 'ok', text: `Servo on pin ${check.servo.pin}.` })
      if (state.running && state.preset === 'servo' && wired && check.servo.pin === String(state.pin)) live.servoAngle = 180 * triangle(clock.current / 1.6)
    }
    const signature = JSON.stringify([messages, Object.values(check.leds).map((led) => led.key ?? '')])
    if (signature !== lastSignature.current) {
      lastSignature.current = signature
      const flows = Object.entries(check.leds).filter(([, led]) => led.route).map(([id, led]) => ({ id, key: led.key, route: led.route, split: led.split, fullMa: led.fullMa, ohms: led.ohms }))
      setSandbox({ messages: messages.slice(0, 5), flows })
    }
  })
  return null
}

function Draft({ draft }) {
  const curve = useMemo(() => {
    const target = draft.snap ?? { at: draft.end ?? place(draft.from) }
    return wireCurve({ from: draft.from, to: target })
  }, [draft])
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 0.07, 8, false), [curve])
  const end = curve.getPoint(1)
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ff8a1f" roughness={0.45} transparent opacity={0.9} />
      </mesh>
      <mesh position={[end.x, end.y - 0.45, end.z]}>
        <boxGeometry args={[0.25, 0.9, 0.25]} />
        <meshStandardMaterial color="#ff8a1f" roughness={0.5} />
      </mesh>
    </group>
  )
}

function RouteFlow({ entry }) {
  const path = useMemo(() => entry.route.map((point) => new THREE.Vector3(point[0], point[1], point[2])), [entry.key])
  const levelOf = () => ((sandboxLive.leds[entry.id]?.level ?? 0) > 0.02 ? Math.min(1, sandboxLive.leds[entry.id].level * 1.4) : 0)
  return <Flow path={path} levelOf={levelOf} ma={entry.fullMa} split={entry.split} />
}

export default function SandboxScene() {
  const state = useSandbox()
  const { current } = useContext(SceneContext)
  const marks = useMemo(() => {
    const { selected, parts, wires, drag } = state
    if (drag?.snap) return { key: `drag-${refKey(leadsOf(drag.snap)[0])}`, holes: leadsOf(drag.snap).map((lead) => place(lead)) }
    if (selected?.kind === 'part') {
      const part = parts.find((entry) => entry.id === selected.id)
      if (part) return { key: `sel-${part.id}-${rotOf(part)}`, holes: leadsOf(part).map((lead) => place(lead)) }
    }
    if (selected?.kind === 'wire') {
      const wire = wires.find((entry) => entry.id === selected.id)
      if (wire) return { key: `sel-${wire.id}`, holes: [place(wire.from), place(wire.to)] }
    }
    return { key: 'none', holes: [] }
  }, [state.selected, state.parts, state.wires, state.drag])

  useEffect(() => {
    const entries = current ? (state.flows ?? []).map((flow) => {
      const top = flow.route.reduce((best, point) => (point[1] > best[1] && Math.abs(point[1] - (BB.h + 0.75)) < 0.01 ? point : best), flow.route[0])
      return { key: `ma-${flow.id}`, text: ledLabelText(flow.fullMa, flow.ohms), position: [top[0], top[1] + 0.5, top[2]], dx: 0, dy: -10 }
    }) : []
    setLabelEntries(entries, 'current')
    return () => setLabelEntries([], 'current')
  }, [current, state.flows])

  return (
    <>
      <Breadboard show delay={0} placed />
      {state.parts.map((part) => <PartView key={`${part.id}-${rotOf(part)}`} part={part} />)}
      {state.wires.map((wire) => <Wire key={wire.id} spec={wire} show delay={0} instant />)}
      {state.draft ? <Draft draft={state.draft} /> : null}
      {(state.flows ?? []).map((flow) => <RouteFlow key={flow.key} entry={flow} />)}
      <HoleMarks key={marks.key} holes={marks.holes} show />
      <Input />
      <Simulation />
    </>
  )
}
