// Procedural surface textures drawn on canvases: asphalt with aggregate, mown grass, sand, concrete slabs.
import * as THREE from 'three'
import { seededRandom } from '../sim.js'

function canvasTexture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  draw(context, size, seededRandom(size * 31 + repeat))
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.repeat.set(repeat, repeat)
  return texture
}

function speckle(context, size, random, count, colors, maxRadius) {
  for (let index = 0; index < count; index++) {
    context.fillStyle = colors[Math.floor(random() * colors.length)]
    const radius = random() * maxRadius + 0.4
    context.fillRect(random() * size, random() * size, radius, radius)
  }
}

const drawAsphalt = (base, flecks) => (context, size, random) => {
  context.fillStyle = base
  context.fillRect(0, 0, size, size)
  speckle(context, size, random, size * size * 0.18, flecks, 1.6)
}

function drawGrass(context, size, random) {
  // Mowing stripes, then blade noise.
  for (let stripe = 0; stripe < 8; stripe++) {
    context.fillStyle = stripe % 2 ? '#86bf63' : '#7cb65a'
    context.fillRect(0, (stripe * size) / 8, size, size / 8)
  }
  speckle(context, size, random, size * size * 0.12, ['#6fa94f', '#93c96f', '#8bc266', '#74ad55'], 1.8)
}

function drawVerge(context, size, random) {
  context.fillStyle = '#93c46d'
  context.fillRect(0, 0, size, size)
  speckle(context, size, random, size * size * 0.14, ['#86b962', '#a1cd7b', '#8fc169'], 1.6)
}

function drawSand(context, size, random) {
  context.fillStyle = '#e3c79a'
  context.fillRect(0, 0, size, size)
  speckle(context, size, random, size * size * 0.2, ['#d8b985', '#ead3aa', '#dcbf8f', '#cfae7b'], 1.8)
  context.strokeStyle = 'rgba(190,150,100,0.18)'
  context.lineWidth = 3
  for (let ripple = 0; ripple < 14; ripple++) {
    context.beginPath()
    const y = random() * size
    context.moveTo(0, y)
    for (let x = 0; x <= size; x += 16) context.lineTo(x, y + Math.sin(x / 40 + ripple) * 6)
    context.stroke()
  }
}

function drawGravel(context, size, random) {
  context.fillStyle = '#d9cfbf'
  context.fillRect(0, 0, size, size)
  speckle(context, size, random, size * size * 0.3, ['#c9bda9', '#e6ddd0', '#bfb19c', '#d2c6b3'], 2.4)
}

const drawConcrete = (base, joint, slab) => (context, size, random) => {
  context.fillStyle = base
  context.fillRect(0, 0, size, size)
  speckle(context, size, random, size * size * 0.08, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], 2)
  context.strokeStyle = joint
  context.lineWidth = 2
  for (let line = 0; line <= size; line += slab) {
    context.beginPath()
    context.moveTo(line, 0)
    context.lineTo(line, size)
    context.moveTo(0, line)
    context.lineTo(size, line)
    context.stroke()
  }
}

function drawWater(context, size, random) {
  const gradient = context.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#1d3d5c')
  gradient.addColorStop(1, '#173450')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  context.strokeStyle = 'rgba(140,190,230,0.12)'
  for (let wave = 0; wave < 120; wave++) {
    const x = random() * size
    const y = random() * size
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + 8, y - 3, x + 16, y)
    context.stroke()
  }
}

const caches = { day: null, night: null }

// Dark paving for the night circuit: the same layers as by day, in colours that read as asphalt under street lamps.
function nightSurfaces() {
  const standard = (map, roughness = 0.92, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, ...extra })
  const layered = (map, roughness, offset) => standard(map, roughness, { polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2 })
  const darkPaint = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })
  return {
    ...surfacesFor('day'),
    city: standard(canvasTexture(512, drawConcrete('#0c0f15', 'rgba(2,4,8,0.6)', 128))),
    water: standard(canvasTexture(256, drawNightWater), 0.2, { metalness: 0.1 }),
    asphalt: layered(canvasTexture(512, drawAsphalt('#4a505a', ['#4d535d', '#3a3f48', '#565c66', '#33373f'])), 0.9, 2),
    pitAsphalt: layered(canvasTexture(512, drawAsphalt('#383d46', ['#40454e', '#30343c', '#494f59'])), 0.88, 2),
    concrete: layered(canvasTexture(512, drawConcrete('#3b414b', 'rgba(8,10,14,0.55)', 128)), 0.9, 1),
    paddock: layered(canvasTexture(512, drawConcrete('#2a2f38', 'rgba(6,8,12,0.55)', 170)), 0.92, 1),
    paint: darkPaint('#c9ced6'),
    yellowPaint: darkPaint('#d9aa28'),
    verge: layered(canvasTexture(256, drawAsphalt('#1b2027', ['#22272f', '#15191f'])), 0.95, 1),
  }
}

function drawNightWater(context, size, random) {
  const gradient = context.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#07131f')
  gradient.addColorStop(1, '#050e18')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  context.strokeStyle = 'rgba(110,150,190,0.10)'
  for (let wave = 0; wave < 120; wave++) {
    const x = random() * size
    const y = random() * size
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + 8, y - 3, x + 16, y)
    context.stroke()
  }
}

// One set of materials per time of day, built once on first use.
export function surfaces(night = false) {
  const key = night ? 'night' : 'day'
  if (!caches[key]) caches[key] = night ? nightSurfaces() : surfacesFor('day')
  return caches[key]
}

function surfacesFor() {
  if (caches.day) return caches.day
  const standard = (map, roughness = 0.92, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, ...extra })
  const layered = (map, roughness, offset) => standard(map, roughness, { polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2 })
  caches.day = {
    grass: standard(canvasTexture(512, drawGrass)),
    verge: layered(canvasTexture(256, drawVerge), 0.95, 1),
    sand: standard(canvasTexture(512, drawSand)),
    gravel: layered(canvasTexture(256, drawGravel), 0.98, 1),
    city: standard(canvasTexture(512, drawConcrete('#353b46', 'rgba(10,14,20,0.45)', 128))),
    water: standard(canvasTexture(256, drawWater), 0.25, { metalness: 0.1 }),
    asphalt: layered(canvasTexture(512, drawAsphalt('#4d535d', ['#5c626c', '#434850', '#676d77', '#3e434b'])), 0.88, 2),
    pitAsphalt: layered(canvasTexture(512, drawAsphalt('#5a606a', ['#666c76', '#50565f', '#727882'])), 0.85, 2),
    concrete: layered(canvasTexture(512, drawConcrete('#c9ced6', 'rgba(110,118,130,0.45)', 128)), 0.9, 1),
    paddock: layered(canvasTexture(512, drawConcrete('#bfc5ce', 'rgba(100,108,120,0.4)', 170)), 0.92, 1),
    paint: new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    yellowPaint: new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    ring: new THREE.MeshBasicMaterial({ color: '#c6f432', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
    ringShadow: new THREE.MeshBasicMaterial({ color: '#0b1a33', transparent: true, opacity: 0.28, depthWrite: false }),
  }
  return caches.day
}

export function boxFillMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })
}

let poolCache = null

// A soft warm disc for floodlit ground at night, drawn additively.
export function lightPoolMaterial() {
  if (poolCache) return poolCache
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,190,110,0.85)')
  gradient.addColorStop(0.4, 'rgba(255,170,90,0.28)')
  gradient.addColorStop(1, 'rgba(255,160,80,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  poolCache = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 })
  return poolCache
}

let cityCache = null

// Facade for the dark city blocks: a plain wall with a grid of windows, a few of them lit. The emissive map holds
// only the lit windows, and the bottom strip stays blank so roofs (whose UVs point there) read as plain concrete.
export function cityBlockMaterial() {
  if (cityCache) return cityCache
  const size = 256
  const random = seededRandom(4242)
  const wall = document.createElement('canvas')
  const glow = document.createElement('canvas')
  for (const canvas of [wall, glow]) {
    canvas.width = size
    canvas.height = size
  }
  const wallContext = wall.getContext('2d')
  const glowContext = glow.getContext('2d')
  wallContext.fillStyle = '#1b2029'
  wallContext.fillRect(0, 0, size, size)
  glowContext.fillStyle = '#000'
  glowContext.fillRect(0, 0, size, size)
  const columns = 4
  const rows = 6
  const cellWidth = size / columns
  const cellHeight = (size * 0.86) / rows
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = column * cellWidth + cellWidth * 0.2
      const y = row * cellHeight + cellHeight * 0.22
      wallContext.fillStyle = '#10141b'
      wallContext.fillRect(x, y, cellWidth * 0.6, cellHeight * 0.56)
      if (random() < 0.16) {
        const warm = random() < 0.7
        glowContext.fillStyle = warm ? '#ffc26b' : '#bcd8ff'
        glowContext.fillRect(x, y, cellWidth * 0.6, cellHeight * 0.56)
        wallContext.fillStyle = warm ? '#ffc26b' : '#bcd8ff'
        wallContext.fillRect(x, y, cellWidth * 0.6, cellHeight * 0.56)
      }
    }
  }
  const toTexture = (canvas, colorSpace) => {
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = colorSpace
    texture.anisotropy = 8
    return texture
  }
  cityCache = new THREE.MeshStandardMaterial({
    map: toTexture(wall, THREE.SRGBColorSpace),
    emissiveMap: toTexture(glow, THREE.SRGBColorSpace),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.9,
    roughness: 0.9,
  })
  return cityCache
}

let lampCache = null

// Street lamp parts: dark poles and warm lamp heads that do not take part in tone mapping so bloom picks them up.
export function streetLampMaterials() {
  if (lampCache) return lampCache
  lampCache = {
    pole: new THREE.MeshStandardMaterial({ color: '#2a303a', roughness: 0.7, metalness: 0.3 }),
    head: new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }),
  }
  return lampCache
}
