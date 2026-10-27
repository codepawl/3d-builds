// "Build your own": the free sandbox. Plain data (parts and wires on the board), a tiny circuit check, and the
// sketches the Run button plays. No React in here except the store hook.
import { useSyncExternalStore } from 'react'
import { PWM_PINS, holePos, place, railPos, unoPin, BB } from './layout.js'
import { wireCurve } from './parts.jsx'

// ---------- tray ----------
export const TRAY_ITEMS = [
  { id: 'led-red', kind: 'led', color: 'red', label: 'Red LED' },
  { id: 'led-yellow', kind: 'led', color: 'yellow', label: 'Yellow LED' },
  { id: 'led-green', kind: 'led', color: 'green', label: 'Green LED' },
  { id: 'res-220', kind: 'resistor', ohms: 220, label: '220 Ω' },
  { id: 'res-1k', kind: 'resistor', ohms: 1000, label: '1 kΩ' },
  { id: 'res-10k', kind: 'resistor', ohms: 10000, label: '10 kΩ' },
  { id: 'button', kind: 'button', label: 'Button' },
  { id: 'pot', kind: 'pot', label: 'Pot 10 kΩ' },
  { id: 'servo', kind: 'servo', label: 'Servo' },
]
const ONLY_ONE = new Set(['button', 'pot', 'servo'])
export const SERVO_AT = [7.1, 0, 0.9]
const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const WIRE_COLOURS = ['#ff8a1f', '#f4c20d', '#2fbf71', '#8b5cf6', '#2f9bff']

// ---------- references: a hole is [col,row]; a rail hole {rail,i}; a header pin {uno:name} ----------
export const refKey = (ref) => (Array.isArray(ref) ? `${ref[0]}${ref[1]}` : ref.rail ? `r${ref.rail}${ref.i}` : `u${ref.uno}`)
const netOf = (ref) => (Array.isArray(ref) ? `c${ref[0]}${ref[1] < 'f' ? 'F' : 'B'}` : ref.rail ? `r:${ref.rail}` : `u:${ref.uno}`)

// Every hole and pin that can be picked, built once.
const PIN_NAMES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'GND', '5V', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']
export const PICKABLE = (() => {
  const list = []
  for (let col = 1; col <= 30; col += 1) ROWS.forEach((row) => list.push({ ref: [col, row], pos: holePos(col, row), kind: 'hole' }))
  ;['botPlus', 'botMinus', 'topMinus', 'topPlus'].forEach((rail) => {
    for (let i = 0; i < 25; i += 1) list.push({ ref: { rail, i }, pos: railPos(rail, i), kind: 'hole' })
  })
  PIN_NAMES.forEach((uno) => list.push({ ref: { uno }, pos: unoPin(uno, 0.1), kind: 'pin' }))
  return list
})()

// ---------- parts: where each one sits ----------
// Quarter turns, 0 to 3. Older saves only had `flip`, which was a half turn.
export const rotOf = (part) => part.rot ?? (part.flip ? 2 : 0)
export function leadsOf(part) {
  const { col, row = 'e' } = part
  const rot = rotOf(part)
  switch (part.kind) {
    case 'led':
      if (rot === 1) return [[col, 'e'], [col, 'f']] // vertical across the middle gap, anode in front
      if (rot === 3) return [[col, 'f'], [col, 'e']]
      return rot === 2 ? [[col + 1, row], [col, row]] : [[col, row], [col + 1, row]] // [anode, cathode]
    case 'resistor': return rot % 2 === 1 ? [[col, 'e'], [col, 'f']] : [[col, row], [col + 4, row]]
    case 'button': return [[col, 'e'], [col + 2, 'e'], [col, 'f'], [col + 2, 'f']]
    case 'pot': return rot >= 2 ? [[col + 2, 'e'], [col, 'e'], [col - 2, 'e']] : [[col - 2, 'e'], [col, 'e'], [col + 2, 'e']]
    case 'servo': return rot >= 2 ? [[col + 2, 'e'], [col + 1, 'e'], [col, 'e']] : [[col, 'e'], [col + 1, 'e'], [col + 2, 'e']] // gnd, 5V, signal
    default: return []
  }
}

// The part the tray item would become if its first lead went in this hole, or null when it does not fit.
export function placeItem(item, hole, parts, wires) {
  if (!hole || !Array.isArray(hole)) return null
  let [col, row] = hole
  const span = { led: 1, resistor: 4, button: 2, pot: 4, servo: 2 }[item.kind]
  if (item.kind === 'pot') col = Math.min(28, Math.max(3, col))
  col = Math.min(col, 30 - (item.kind === 'pot' ? 0 : span))
  if (item.kind === 'pot' || item.kind === 'servo' || item.kind === 'button') row = 'e'
  const candidate = { kind: item.kind, color: item.color, ohms: item.ohms, col, row, rot: 0 }
  if (ONLY_ONE.has(item.kind) && parts.some((part) => part.kind === item.kind)) return null
  const taken = occupiedKeys(parts, wires)
  return leadsOf(candidate).every((lead) => !taken.has(refKey(lead))) ? candidate : null
}

export function occupiedKeys(parts, wires, ignorePart, ignoreWire) {
  const taken = new Set()
  parts.forEach((part) => { if (part.id !== ignorePart) leadsOf(part).forEach((lead) => taken.add(refKey(lead))) })
  wires.forEach((wire) => { if (wire.id !== ignoreWire) { taken.add(refKey(wire.from)); taken.add(refKey(wire.to)) } })
  return taken
}

// ---------- store ----------
const STORAGE_KEY = 'hookup-sandbox-v1'
export const PRESETS = [
  { id: 'blink', label: 'Blink', pinLabel: 'LED pin' },
  { id: 'button', label: 'Button', pinLabel: 'LED pin' },
  { id: 'fade', label: 'Fade', pinLabel: 'LED pin' },
  { id: 'pot', label: 'Pot to LED', pinLabel: 'LED pin' },
  { id: 'servo', label: 'Servo sweep', pinLabel: 'Servo pin' },
]
const emptyState = () => ({ parts: [], wires: [], selected: null, draft: null, drag: null, running: false, preset: 'blink', pin: 13, nextId: 1, messages: [], flowTick: 0 })
function load() {
  const base = emptyState()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && Array.isArray(saved.parts) && Array.isArray(saved.wires)) return { ...base, parts: saved.parts, wires: saved.wires, preset: saved.preset ?? base.preset, pin: saved.pin ?? base.pin, nextId: saved.nextId ?? 1 }
  } catch (error) { void error }
  return base
}
let state = typeof localStorage === 'undefined' ? emptyState() : load()
const listeners = new Set()
export const getSandbox = () => state
export function setSandbox(patch) {
  state = { ...state, ...patch }
  if ('parts' in patch || 'wires' in patch || 'preset' in patch || 'pin' in patch) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ parts: state.parts, wires: state.wires, preset: state.preset, pin: state.pin, nextId: state.nextId })) } catch (error) { void error }
  }
  listeners.forEach((listener) => listener())
}
export function useSandbox() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => state)
}

export function addPart(candidate) {
  const id = `p${state.nextId}`
  setSandbox({ parts: [...state.parts, { ...candidate, id }], nextId: state.nextId + 1, selected: { kind: 'part', id } })
  return id
}
export function addWire(from, to) {
  const id = `w${state.nextId}`
  const isGround = (ref) => ref.uno === 'GND' || ref.rail === 'botMinus' || ref.rail === 'topMinus'
  const isPower = (ref) => ref.uno === '5V' || ref.rail === 'botPlus' || ref.rail === 'topPlus'
  const colour = isGround(from) || isGround(to) ? '#3b4048' : isPower(from) || isPower(to) ? '#e0343f' : WIRE_COLOURS[state.wires.length % WIRE_COLOURS.length]
  setSandbox({ wires: [...state.wires, { id, from, to, colour }], nextId: state.nextId + 1, selected: { kind: 'wire', id } })
}
export function rotateSelected() {
  const { selected, parts } = state
  if (!selected || selected.kind !== 'part') return
  const part = parts.find((entry) => entry.id === selected.id)
  if (!part) return
  const taken = occupiedKeys(parts, state.wires, part.id)
  for (let turn = 1; turn <= 3; turn += 1) {
    const turned = { ...part, rot: (rotOf(part) + turn) % 4, flip: undefined }
    if (leadsOf(turned).every((lead) => !taken.has(refKey(lead)))) {
      setSandbox({ parts: parts.map((entry) => (entry.id === part.id ? turned : entry)) })
      return
    }
  }
}
export function deleteSelected() {
  const { selected } = state
  if (!selected) return
  if (selected.kind === 'part') setSandbox({ parts: state.parts.filter((part) => part.id !== selected.id), selected: null })
  else setSandbox({ wires: state.wires.filter((wire) => wire.id !== selected.id), selected: null })
}
export function resetSandbox() {
  setSandbox({ ...emptyState(), preset: state.preset, pin: state.pin, running: false })
}

// ---------- the sketches ----------
export function sketchLines(preset, pin) {
  switch (preset) {
    case 'blink': return [`const int led = ${pin};`, 'void setup() { pinMode(led, OUTPUT); }', 'void loop() {', '  digitalWrite(led, HIGH);', '  delay(500);', '  digitalWrite(led, LOW);', '  delay(500);', '}']
    case 'button': return [`const int led = ${pin};`, 'void setup() {', '  pinMode(led, OUTPUT);', '  pinMode(2, INPUT);', '}', 'void loop() {', '  digitalWrite(led, digitalRead(2));', '}']
    case 'fade': return [`const int led = ${pin};`, 'void setup() { pinMode(led, OUTPUT); }', 'void loop() {', '  for (int v = 0; v < 255; v++) {', '    analogWrite(led, v);', '    delay(8);', '  }', '}']
    case 'pot': return [`const int led = ${pin};`, 'void setup() { pinMode(led, OUTPUT); }', 'void loop() {', '  int raw = analogRead(A0);', '  analogWrite(led, raw / 4);', '}']
    default: return ['#include <Servo.h>', 'Servo arm;', `void setup() { arm.attach(${pin}); }`, 'void loop() {', '  for (int a = 0; a <= 180; a++) {', '    arm.write(a);', '    delay(15);', '  }', '}']
  }
}

// ---------- the circuit check ----------
const LED_DROP = 2.0
const LED_FULL_MA = 12
const POT_OHMS = 10000
const fmtOhms = (ohms) => (ohms >= 1000 ? `${Math.round(ohms / 100) / 10} kΩ`.replace('.0', '') : `${Math.round(ohms)} Ω`)

// Live per-LED numbers the 3D scene reads every frame (the store only carries what the UI shows).
export const sandboxLive = { leds: {} }
const polylineCache = new Map()
function polylineOf(wire) {
  const key = `${wire.id}${refKey(wire.from)}${refKey(wire.to)}`
  if (!polylineCache.has(key)) polylineCache.set(key, wireCurve(wire).getPoints(24).map((point) => [point.x, point.y, point.z]))
  return polylineCache.get(key)
}

function buildEdges(parts, wires, potFraction, pressed) {
  const edges = []
  wires.forEach((wire) => {
    edges.push({ id: wire.id, a: netOf(wire.from), b: netOf(wire.to), r: 0, pts: polylineOf(wire) })
  })
  const at = (ref) => place(ref, 0.3)
  parts.forEach((part) => {
    const leads = leadsOf(part)
    if (part.kind === 'resistor') edges.push({ id: part.id, a: netOf(leads[0]), b: netOf(leads[1]), r: part.ohms, pts: [at(leads[0]), at(leads[1])] })
    if (part.kind === 'button') {
      edges.push({ id: `${part.id}l`, a: netOf(leads[0]), b: netOf(leads[2]), r: 0, pts: [at(leads[0]), at(leads[2])] })
      edges.push({ id: `${part.id}r`, a: netOf(leads[1]), b: netOf(leads[3]), r: 0, pts: [at(leads[1]), at(leads[3])] })
      if (pressed) edges.push({ id: `${part.id}c`, a: netOf(leads[0]), b: netOf(leads[1]), r: 0, pts: [at(leads[0]), at(leads[1])] })
    }
    if (part.kind === 'pot') {
      const fraction = part.flip ? 1 - potFraction : potFraction
      edges.push({ id: `${part.id}1`, a: netOf(leads[0]), b: netOf(leads[1]), r: POT_OHMS * fraction, pts: [at(leads[0]), at(leads[1])] })
      edges.push({ id: `${part.id}2`, a: netOf(leads[1]), b: netOf(leads[2]), r: POT_OHMS * (1 - fraction), pts: [at(leads[1]), at(leads[2])] })
    }
  })
  return edges
}

// Cheapest route (in ohms) from a net to any net the test accepts. Returns { r, steps: [{ edge, forward }] } or null.
function route(edges, start, accepts) {
  const cost = new Map([[start, 0]])
  const how = new Map()
  const done = new Set()
  for (;;) {
    let current = null
    cost.forEach((value, net) => { if (!done.has(net) && (current === null || value < cost.get(current))) current = net })
    if (current === null) return null
    if (accepts(current)) {
      const steps = []
      let net = current
      while (how.has(net)) {
        const { edge, forward, from } = how.get(net)
        steps.unshift({ edge, forward })
        net = from
      }
      return { r: cost.get(current), steps, end: current }
    }
    done.add(current)
    edges.forEach((edge) => {
      const forward = edge.a === current
      if (!forward && edge.b !== current) return
      const next = forward ? edge.b : edge.a
      const total = cost.get(current) + edge.r
      if (!done.has(next) && (!cost.has(next) || total < cost.get(next))) {
        cost.set(next, total)
        how.set(next, { edge, forward, from: current })
      }
    })
  }
}

const orient = (steps) => steps.flatMap(({ edge, forward }) => (forward ? edge.pts : [...edge.pts].reverse()))
const lengthOf = (points) => points.reduce((sum, point, index) => (index ? sum + Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1], point[2] - points[index - 1][2]) : 0), 0)

// One pass of the circuit check. `pinLevels` maps a pin name to 0..1 (what the sketch drives right now).
export function checkCircuit(parts, wires, pinLevels, potFraction, pressed) {
  const edges = buildEdges(parts, wires, potFraction, pressed)
  const result = { leds: {}, messages: [], pin2High: false, a0Fraction: null, servo: null }
  const isSource = (net) => net === 'u:5V' || /^u:\d+$/.test(net)
  const sourceLevel = (net) => (net === 'u:5V' ? 1 : pinLevels[net.slice(2)] ?? 0)
  const toGround = (net) => net === 'u:GND'

  const high = route(edges, 'u:2', (net) => net === 'u:5V')
  result.pin2High = Boolean(high && high.r < 2000)

  const pot = parts.find((part) => part.kind === 'pot')
  if (pot) {
    const [end0, wiper, end2] = leadsOf(pot).map(netOf)
    const withoutPot = edges.filter((edge) => edge.id !== `${pot.id}1` && edge.id !== `${pot.id}2`)
    if (route(withoutPot, wiper, (net) => net === 'u:A0')) {
      const fraction = pot.flip ? 1 - potFraction : potFraction
      if (route(withoutPot, end0, (net) => net === 'u:5V') && route(withoutPot, end2, toGround)) result.a0Fraction = 1 - fraction
      else if (route(withoutPot, end2, (net) => net === 'u:5V') && route(withoutPot, end0, toGround)) result.a0Fraction = fraction
    }
  }

  parts.filter((part) => part.kind === 'led').forEach((led) => {
    const [anode, cathode] = leadsOf(led)
    const report = { lit: false, level: 0, ma: 0, ohms: 0, state: 'open', route: null, split: 2 }
    result.leds[led.id] = report
    const label = `${led.color[0].toUpperCase()}${led.color.slice(1)} LED`
    if (netOf(anode) === netOf(cathode)) { report.state = 'shorted'; result.messages.push({ kind: 'bad', text: `${label} is shorted: both legs share a strip.` }); return }
    const fromPin = route(edges, netOf(anode), isSource)
    const toGnd = route(edges, netOf(cathode), toGround)
    if (fromPin && toGnd) {
      const total = fromPin.r + toGnd.r
      const level = sourceLevel(fromPin.end)
      report.ohms = total
      if (total < 1) {
        report.state = 'no-resistor'
        result.messages.push({ kind: 'bad', text: `${label}: no resistor. It would burn out, so it stays dark.` })
        return
      }
      const fullMa = Math.max(0, ((5 - LED_DROP) / total) * 1000)
      report.ma = fullMa * level
      report.fullMa = fullMa
      report.level = Math.min(1, fullMa / LED_FULL_MA) * level
      report.lit = report.level > 0.02
      report.state = report.lit ? 'lit' : 'off'
      const sourceName = fromPin.end === 'u:5V' ? '5V' : `pin ${fromPin.end.slice(2)}`
      const before = orient([...fromPin.steps].reverse().map(({ edge, forward }) => ({ edge, forward: !forward })))
      const anodePoint = place(anode, 0.3)
      const topPoint = [(place(anode)[0] + place(cathode)[0]) / 2, BB.h + 0.75, place(anode)[2]]
      const points = [...before, anodePoint, topPoint, place(cathode, 0.3), ...orient(toGnd.steps)]
      report.route = points
      report.split = lengthOf([...before, anodePoint, topPoint]) / lengthOf(points)
      report.key = `${led.id}:${fromPin.steps.map((step) => step.edge.id).join('>')}|${toGnd.steps.map((step) => step.edge.id).join('>')}`
      if (report.lit) result.messages.push({ kind: 'ok', text: `${label} lit: about ${fullMa < 10 ? fullMa.toFixed(1) : Math.round(fullMa)} mA through ${fmtOhms(total)} from ${sourceName}.` })
      else if (fromPin.end !== 'u:5V' && fromPin.end.slice(2) !== String(pinLevels.__pin ?? '')) result.messages.push({ kind: 'warn', text: `${label} is on pin ${fromPin.end.slice(2)}, but the sketch drives pin ${pinLevels.__pin}.` })
      else result.messages.push({ kind: 'idle', text: `${label} is wired correctly (${fmtOhms(total)}) and waiting for HIGH.` })
      return
    }
    const reverseFromPin = route(edges, netOf(cathode), isSource)
    const reverseToGnd = route(edges, netOf(anode), toGround)
    if (reverseFromPin && reverseToGnd) {
      report.state = 'reversed'
      result.messages.push({ kind: 'bad', text: `${label} is backwards. Select it and press Rotate.` })
    } else if (fromPin && !toGnd) {
      result.messages.push({ kind: 'warn', text: `${label}: its short leg has no path to GND yet.` })
    } else if (!fromPin && toGnd) {
      result.messages.push({ kind: 'warn', text: `${label}: its long leg is not wired to a pin yet.` })
    } else {
      result.messages.push({ kind: 'warn', text: `${label} is not wired to anything yet.` })
    }
  })

  const servo = parts.find((part) => part.kind === 'servo')
  if (servo) {
    const [ground, power, signal] = leadsOf(servo)
    const signalRoute = route(edges, netOf(signal), (net) => /^u:\d+$/.test(net))
    const powerRoute = route(edges, netOf(power), (net) => net === 'u:5V')
    const groundRoute = route(edges, netOf(ground), toGround)
    result.servo = { pin: signalRoute ? signalRoute.end.slice(2) : null, powered: Boolean(powerRoute && groundRoute) }
  }
  return result
}

// What the sketch does at time t (seconds since Run).
export function pinLevelsAt(preset, pin, time, check, potFraction) {
  const levels = { __pin: pin }
  const name = String(pin)
  if (preset === 'blink') levels[name] = Math.floor(time / 0.5) % 2 === 0 ? 1 : 0
  if (preset === 'button') levels[name] = check.pin2High ? 1 : 0
  if (preset === 'fade') {
    const duty = (time % 2) / 2
    levels[name] = PWM_PINS.has(name) ? duty : duty > 0.5 ? 1 : 0
  }
  if (preset === 'pot') {
    const duty = check.a0Fraction ?? 0
    levels[name] = PWM_PINS.has(name) ? duty : duty > 0.5 ? 1 : 0
  }
  void potFraction
  return levels
}

export const isPwmPin = (pin) => PWM_PINS.has(String(pin))
export const ledLabelText = (ma, ohms) => `LED ~ ${ma < 10 ? ma.toFixed(1) : Math.round(ma)} mA at ${fmtOhms(ohms)}`
