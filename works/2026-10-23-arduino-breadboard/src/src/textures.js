// Canvas textures painted at real scale: the Uno silkscreen, the breadboard top, the desk mat and the LED glow.
import * as THREE from 'three'
import { ANALOG_PINS, BB, DIGITAL_PINS, PITCH, POWER_PINS, PWM_PINS, ROW_Z, RAIL_Z } from './layout.js'

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
function toTexture(canvas, anisotropy = 8) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

// ---------- Uno ----------
export const UNO_PX_PER_MM = 45
// Board millimetres from the lower-left corner -> canvas pixels (canvas y grows toward the near edge).
export const unoPx = (millimetres) => millimetres * UNO_PX_PER_MM
export const unoPy = (millimetres) => (53.34 - millimetres) * UNO_PX_PER_MM

function build_makeUnoTexture() {
  const width = Math.round(68.58 * UNO_PX_PER_MM)
  const height = Math.round(53.34 * UNO_PX_PER_MM)
  const canvas = canvasOf(width, height)
  const g = canvas.getContext('2d')
  const gradient = g.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0d8798')
  gradient.addColorStop(1, '#09707f')
  g.fillStyle = gradient
  g.fillRect(0, 0, width, height)

  // Faint copper traces so the mask does not read as flat paint.
  g.strokeStyle = 'rgba(180, 235, 240, 0.16)'
  g.lineWidth = 0.35 * UNO_PX_PER_MM
  g.lineJoin = 'round'
  const trace = (points) => {
    g.beginPath()
    points.forEach(([bx, by], index) => (index ? g.lineTo(unoPx(bx), unoPy(by)) : g.moveTo(unoPx(bx), unoPy(by))))
    g.stroke()
  }
  DIGITAL_PINS.forEach(([, inches], index) => {
    const x = inches * 25.4
    trace([[x, 50.8], [x, 47 - (index % 4) * 1.2], [x + (index % 2 ? 2 : -2), 44 - (index % 5)]])
  })
  ;[...POWER_PINS, ...ANALOG_PINS].forEach(([, inches], index) => {
    const x = inches * 25.4
    trace([[x, 2.54], [x, 6 + (index % 3)], [x - 3, 9 + (index % 4)]])
  })
  trace([[28, 33], [40, 33], [40, 25]])
  trace([[22, 18], [30, 18], [30, 12], [40, 12]])

  // Mounting holes with a pad ring.
  const holes = [[14.0, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]]
  holes.forEach(([bx, by]) => {
    g.fillStyle = '#d9c26a'
    g.beginPath()
    g.arc(unoPx(bx), unoPy(by), 2.9 * UNO_PX_PER_MM, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#05181c'
    g.beginPath()
    g.arc(unoPx(bx), unoPy(by), 1.6 * UNO_PX_PER_MM, 0, Math.PI * 2)
    g.fill()
  })

  // Silkscreen.
  const silk = '#f4faf8'
  g.fillStyle = silk
  g.strokeStyle = silk
  g.textBaseline = 'middle'
  const font = (millimetres, weight = 700) => `${weight} ${millimetres * UNO_PX_PER_MM}px "Bahnschrift", "Segoe UI", Arial, sans-serif`
  const label = (text, bx, by, size = 1.9, align = 'left', angle = 0, weight = 700) => {
    g.save()
    g.translate(unoPx(bx), unoPy(by))
    g.rotate(angle)
    g.font = font(size, weight)
    g.textAlign = align
    g.fillText(text, 0, 0)
    g.restore()
  }
  const outline = (bx, by, widthMm, heightMm, lineMm = 0.3) => {
    g.lineWidth = lineMm * UNO_PX_PER_MM
    g.strokeRect(unoPx(bx), unoPy(by + heightMm), widthMm * UNO_PX_PER_MM, heightMm * UNO_PX_PER_MM)
  }

  // Header outlines and pin labels (rotated so a 2.54 mm pitch fits a readable size).
  const upward = -Math.PI / 2
  outline(16.0, 49.4, 25.4, 2.9)
  outline(44.2, 49.4, 20.3, 2.9)
  outline(25.0, 1.1, 20.3, 2.9)
  outline(47.4, 1.1, 15.3, 2.9)
  DIGITAL_PINS.forEach(([name, inches]) => {
    const text = PWM_PINS.has(name) ? `~${name}` : name
    label(text, inches * 25.4, 47.7, name.length > 2 ? 1.75 : 2.15, 'right', upward)
  })
  POWER_PINS.forEach(([name, inches]) => label(name, inches * 25.4, 5.6, name.length > 3 ? 1.7 : 2.0, 'left', upward))
  ANALOG_PINS.forEach(([name, inches]) => label(name, inches * 25.4, 5.6, 2.1, 'left', upward))
  g.lineWidth = 0.35 * UNO_PX_PER_MM
  g.beginPath()
  g.moveTo(unoPx(17.5), unoPy(44.2))
  g.lineTo(unoPx(64.5), unoPy(44.2))
  g.stroke()
  label('DIGITAL (PWM ~)', 41, 41.9, 1.9, 'center', 0, 600)
  g.beginPath()
  g.moveTo(unoPx(26), unoPy(11.3))
  g.lineTo(unoPx(44.5), unoPy(11.3))
  g.moveTo(unoPx(48), unoPy(11.3))
  g.lineTo(unoPx(62), unoPy(11.3))
  g.stroke()
  label('POWER', 35, 9.2, 1.9, 'center', 0, 600)
  label('ANALOG IN', 55, 9.2, 1.9, 'center', 0, 600)

  // Board name: generic, no logo.
  label('UNO', 24, 22, 7.5, 'left', 0, 800)
  label('R3', 24, 15.5, 4.2, 'left', 0, 800)
  label('16 MHz', 38.8, 31.2, 1.6, 'center', 0, 600)
  // Component outlines and names.
  g.lineWidth = 0.28 * UNO_PX_PER_MM
  outline(-2, 31.5, 16.2, 13)
  outline(-2, 1.5, 14.8, 10.2)
  label('USB', 1.5, 30.3, 1.6, 'left', 0, 600)
  label('DC IN', 1.5, 13.4, 1.6, 'left', 0, 600)
  outline(29.0, 13.4, 36.2, 9.0, 0.3)
  label('RESET', 14.5, 41.4, 1.6, 'center', 0, 600)
  label('L', 34.6, 37.0, 1.7, 'left')
  label('TX', 34.6, 35.0, 1.5, 'left')
  label('RX', 34.6, 33.0, 1.5, 'left')
  label('ON', 47.4, 35.8, 1.5, 'left')
  label('ICSP', 59.5, 32.6, 1.4, 'left')
  label('ICSP', 6.2, 51.0, 1.2, 'left')
  label('SDA SCL', 16.2, 52.1, 1.2, 'left', 0, 600)
  g.font = font(1.3, 600)
  g.textAlign = 'right'
  g.fillText('generic UNO R3 layout', unoPx(66), unoPy(51.7))
  return toTexture(canvas, 16)
}

// ---------- breadboard ----------
export const BB_PX_PER_CM = 300
const bbPx = (x) => (x + BB.w / 2) * BB_PX_PER_CM
const bbPy = (z) => (z + BB.d / 2) * BB_PX_PER_CM

function build_makeBreadboardTexture() {
  const width = Math.round(BB.w * BB_PX_PER_CM)
  const height = Math.round(BB.d * BB_PX_PER_CM)
  const canvas = canvasOf(width, height)
  const g = canvas.getContext('2d')
  g.fillStyle = '#eceae4'
  g.fillRect(0, 0, width, height)
  // Centre channel between rows e and f.
  g.fillStyle = '#d3d0c6'
  g.fillRect(0, bbPy(-0.3), width, 0.6 * BB_PX_PER_CM)
  g.fillStyle = '#c4c1b6'
  g.fillRect(0, bbPy(-0.3), width, 0.04 * BB_PX_PER_CM)
  g.fillRect(0, bbPy(0.26), width, 0.04 * BB_PX_PER_CM)
  // Power rail lines: red for +, blue for -.
  const railLine = (z, colour) => {
    g.fillStyle = colour
    g.fillRect(bbPx(-3.63), bbPy(z), 7.26 * BB_PX_PER_CM, 0.05 * BB_PX_PER_CM)
  }
  railLine(RAIL_Z.topPlus - 0.27, '#d9372b')
  railLine(RAIL_Z.topMinus + 0.27, '#2467d6')
  railLine(RAIL_Z.botMinus - 0.27, '#2467d6')
  railLine(RAIL_Z.botPlus + 0.27, '#d9372b')

  const hole = (x, z) => {
    const size = 0.1 * BB_PX_PER_CM
    const px = bbPx(x)
    const py = bbPy(z)
    g.fillStyle = '#b9b6ab'
    g.fillRect(px - size * 0.95, py - size * 0.95, size * 1.9, size * 1.9)
    g.fillStyle = '#171a1d'
    g.fillRect(px - size / 2, py - size / 2, size, size)
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(px - size * 0.95, py + size * 0.62, size * 1.9, size * 0.14)
  }
  for (let col = 1; col <= 30; col += 1) {
    const x = (col - 15.5) * PITCH
    Object.values(ROW_Z).forEach((z) => hole(x, z))
  }
  const railX = (index) => -(27 * PITCH) / 2 + (index + Math.floor(index / 5)) * PITCH
  Object.values(RAIL_Z).forEach((z) => {
    for (let index = 0; index < 25; index += 1) hole(railX(index), z)
  })

  // Printed numbers and letters.
  g.fillStyle = '#7d7a70'
  g.font = `700 ${0.2 * BB_PX_PER_CM}px "Bahnschrift", "Segoe UI", Arial, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  ;[1, 5, 10, 15, 20, 25, 30].forEach((col) => {
    const x = (col - 15.5) * PITCH
    g.fillText(String(col), bbPx(x), bbPy(ROW_Z.j - 0.3))
  })
  Object.entries(ROW_Z).forEach(([name, z]) => g.fillText(name, bbPx(-15 * PITCH - 0.42), bbPy(z)))
  g.font = `800 ${0.3 * BB_PX_PER_CM}px "Bahnschrift", "Segoe UI", Arial, sans-serif`
  g.fillStyle = '#d9372b'
  ;[RAIL_Z.topPlus, RAIL_Z.botPlus].forEach((z) => g.fillText('+', bbPx(-3.84), bbPy(z)))
  g.fillStyle = '#2467d6'
  ;[RAIL_Z.topMinus, RAIL_Z.botMinus].forEach((z) => g.fillText('−', bbPx(-3.84), bbPy(z)))
  return toTexture(canvas, 16)
}

// ---------- desk mat with a 1 cm grid ----------
export function makeMatTexture(base, line, major) {
  const canvas = canvasOf(1024, 1024)
  const g = canvas.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, 1024, 1024)
  const cell = 1024 / 16
  for (let index = 0; index <= 16; index += 1) {
    g.fillStyle = index % 4 === 0 ? major : line
    const thickness = index % 4 === 0 ? 3 : 1.5
    g.fillRect(index * cell - thickness / 2, 0, thickness, 1024)
    g.fillRect(0, index * cell - thickness / 2, 1024, thickness)
  }
  const texture = toTexture(canvas, 16)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function build_makeGlowTexture() {
  const canvas = canvasOf(128, 128)
  const g = canvas.getContext('2d')
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

// Brushed grain for metal parts (USB shell, crystal).
function build_makeMetalTexture() {
  const canvas = canvasOf(128, 128)
  const g = canvas.getContext('2d')
  g.fillStyle = '#c9d0d6'
  g.fillRect(0, 0, 128, 128)
  for (let index = 0; index < 400; index += 1) {
    g.fillStyle = `rgba(${index % 2 ? 255 : 90},${index % 2 ? 255 : 100},${index % 2 ? 255 : 110},0.07)`
    g.fillRect(0, (index * 37) % 128, 128, 1)
  }
  return toTexture(canvas, 4)
}

let cached_makeUnoTexture
export const makeUnoTexture = () => (cached_makeUnoTexture ??= build_makeUnoTexture())

let cached_makeBreadboardTexture
export const makeBreadboardTexture = () => (cached_makeBreadboardTexture ??= build_makeBreadboardTexture())

let cached_makeGlowTexture
export const makeGlowTexture = () => (cached_makeGlowTexture ??= build_makeGlowTexture())

let cached_makeMetalTexture
export const makeMetalTexture = () => (cached_makeMetalTexture ??= build_makeMetalTexture())
