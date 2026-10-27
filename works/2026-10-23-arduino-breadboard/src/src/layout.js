// Real-size layout. One scene unit = 1 cm. x runs left to right, z runs toward the viewer, y is up.
// Sources for every number: FACTS.md and references/*.md.
export const PITCH = 0.254 // 2.54 mm

// Half-size breadboard, 82.6 x 54.6 x 8.5 mm, 30 columns x (a-e, f-j) + two power rails on each long edge.
export const BB = { x: 0, z: 0, w: 8.26, d: 5.46, h: 0.85 }
export const ROW_Z = { a: 1.397, b: 1.143, c: 0.889, d: 0.635, e: 0.381, f: -0.381, g: -0.635, h: -0.889, i: -1.143, j: -1.397 }
export const RAIL_Z = { botPlus: 2.413, botMinus: 2.159, topMinus: -2.159, topPlus: -2.413 }
export const colX = (col) => BB.x + (col - 15.5) * PITCH
export const holePos = (col, row, y = BB.h) => [colX(col), y, BB.z + ROW_Z[row]]
export const railX = (index) => BB.x - (27 * PITCH) / 2 + (index + Math.floor(index / 5)) * PITCH
export const railPos = (name, index, y = BB.h) => [railX(index), y, BB.z + RAIL_Z[name]]
// The rail hole nearest to a given x.
export function railNear(name, x) {
  let best = 0
  for (let index = 0; index < 25; index += 1) {
    if (Math.abs(railX(index) - x) < Math.abs(railX(best) - x)) best = index
  }
  return railPos(name, best)
}

// Uno R3, 68.6 x 53.4 mm, lying flat with the USB end on the left. Digital header on the far edge (toward the
// breadboard), power and analog headers on the near edge.
export const UNO = { x: 0, y: 0, z: 6.57, w: 6.858, d: 5.334, t: 0.16, headerH: 0.85 }
// Pin x positions in inches from the left edge of the board (0.1 in pitch, 0.16 in extra gap between pins 7 and 8).
export const DIGITAL_PINS = [
  ['SCL', 0.64], ['SDA', 0.74], ['AREF', 0.84], ['GND', 0.94], ['13', 1.04], ['12', 1.14], ['11', 1.24], ['10', 1.34], ['9', 1.44], ['8', 1.54],
  ['7', 1.8], ['6', 1.9], ['5', 2.0], ['4', 2.1], ['3', 2.2], ['2', 2.3], ['1', 2.4], ['0', 2.5],
]
export const POWER_PINS = [['', 1.0], ['IOREF', 1.1], ['RESET', 1.2], ['3V3', 1.3], ['5V', 1.4], ['GND', 1.5], ['GND', 1.6], ['VIN', 1.7]]
export const ANALOG_PINS = [['A0', 1.9], ['A1', 2.0], ['A2', 2.1], ['A3', 2.2], ['A4', 2.3], ['A5', 2.4]]
export const PWM_PINS = new Set(['3', '5', '6', '9', '10', '11'])
const LOCAL_X = (inches) => inches * 2.54 - UNO.w / 2 // inches from the left edge -> cm from the board centre
const headerZ = UNO.d / 2 - 0.254 // 0.1 in from the long edge
export function unoPin(name, lift = 0) {
  let inches
  let side = 'far'
  const digital = DIGITAL_PINS.find(([label]) => label === name)
  if (digital) inches = digital[1]
  else {
    const power = POWER_PINS.find(([label]) => label === name && label !== '')
    const analog = ANALOG_PINS.find(([label]) => label === name)
    inches = (power ?? analog)[1]
    side = 'near'
  }
  const x = UNO.x + LOCAL_X(inches)
  const z = UNO.z + (side === 'far' ? -headerZ : headerZ)
  return [x, UNO.y + UNO.t + UNO.headerH + lift, z]
}

// A reference to a place: a breadboard hole, a rail hole, an Uno pin or a raw point.
export function place(ref, lift = 0) {
  if (Array.isArray(ref)) {
    if (typeof ref[1] === 'string') return holePos(ref[0], ref[1], BB.h + lift)
    return ref
  }
  if (ref.rail) return railPos(ref.rail, ref.i, BB.h + lift)
  if (ref.railNear) return railNear(ref.railNear[0], ref.railNear[1]).map((value, index) => (index === 1 ? BB.h + lift : value))
  if (ref.uno) return unoPin(ref.uno, lift)
  if (ref.at) return [ref.at[0], ref.at[1] + lift, ref.at[2]]
  throw new Error(`bad place ${JSON.stringify(ref)}`)
}

// Resistor colour bands for a value in ohms (four bands, 5 % gold).
const BAND_COLOURS = ['#111111', '#7a3b12', '#d62828', '#f77f00', '#f2d300', '#2a9d3f', '#2a5bd7', '#8a4fff', '#8d99a6', '#f5f5f5']
export function resistorBands(ohms) {
  let exponent = 0
  let value = ohms
  while (value >= 100) {
    value /= 10
    exponent += 1
  }
  const digits = String(Math.round(value)).padStart(2, '0')
  return [BAND_COLOURS[Number(digits[0])], BAND_COLOURS[Number(digits[1])], BAND_COLOURS[exponent], '#c9a227']
}
export function bandNames(ohms) {
  const names = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']
  let exponent = 0
  let value = ohms
  while (value >= 100) {
    value /= 10
    exponent += 1
  }
  const digits = String(Math.round(value)).padStart(2, '0')
  return [names[Number(digits[0])], names[Number(digits[1])], names[exponent], 'gold']
}
