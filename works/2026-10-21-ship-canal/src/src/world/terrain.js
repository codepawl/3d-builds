import * as THREE from 'three'
import { WEST_FACE_X, EAST_WALL_OUTER_X, LIFT } from '../data/canal.js'

const smooth = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}
const mix = (from, to, amount) => from + (to - from) * amount

function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}
function valueNoise(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), fx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy)
}
const fbm = (x, y) => valueNoise(x, y) * 0.6 + valueNoise(x * 2.3, y * 2.3) * 0.28 + valueNoise(x * 5.1, y * 5.1) * 0.12

const STRATA = ['#b79a73', '#9c7e58', '#c7ad82', '#8a6f4f', '#b08f66', '#78624a']
export const BASE_DEPTH = -52
export function strataColor(y) {
  const layer = Math.floor((y - BASE_DEPTH) / 7)
  const color = new THREE.Color(STRATA[((layer % STRATA.length) + STRATA.length) % STRATA.length])
  const shade = 0.92 + 0.08 * hash(layer, 3)
  return color.multiplyScalar(shade)
}

export const CONTROL_PAD = { x: 175, radius: 62 }

export function createTerrainModel(geometry, siteId) {
  const chambers = geometry.chambers
  const zoneStart = -25.25
  const zoneEnd = geometry.gateS(chambers) + 9
  const seaLand = siteId === 'lake' ? geometry.wallTopY(0) - 4 : -9
  const lakeBed = geometry.floorY(chambers)
  const middle = (zoneStart + zoneEnd) / 2
  const padS = geometry.chamberCentreS(Math.min(1, chambers - 1)) + 20
  const wallTop = (s) => {
    let value = geometry.wallTopY(0)
    for (let gate = 1; gate < chambers; gate += 1) value += LIFT * smooth((s - (geometry.gateS(gate) - 40.5)) / 45.75)
    return value
  }
  const baseLevel = (s) => (s >= zoneStart ? wallTop(s) : mix(seaLand, wallTop(0), smooth((s - (zoneStart - 950)) / 900)))
  const mountain = (s) => Math.exp(-(((s - middle) / 1000) ** 2))
  const landHeight = (x, s) => {
    const rise = Math.max(0, x - EAST_WALL_OUTER_X) * (siteId === 'lake' ? 0.14 : 0.19) * mountain(s)
    const noise = (fbm(x * 0.012, s * 0.012) - 0.5) * 14 * Math.min(1, (x - EAST_WALL_OUTER_X) / 120 + 0.1)
    let value = baseLevel(s) + rise + Math.max(-3, noise)
    // Earth dam that holds the lake back, east of the last gate.
    const damOffset = (s - (zoneEnd + 22)) / 38
    if (x > EAST_WALL_OUTER_X - 10) value += 7 * Math.exp(-damOffset * damOffset)
    return value
  }
  const height = (x, s) => {
    let value = landHeight(x, s)
    const channel = 1 - smooth((x - EAST_WALL_OUTER_X) / 46)
    if (s < zoneStart) {
      const bed = geometry.floorBase
      value = mix(Math.max(value, bed + 2), bed, Math.max(channel, 0))
      if (x > EAST_WALL_OUTER_X) value = mix(value, Math.max(landHeight(x, s), bed), smooth((x - EAST_WALL_OUTER_X) / 46))
    } else if (s > zoneEnd) {
      const insideS = smooth((s - (zoneEnd + 70)) / 90)
      const insideX = 1 - smooth((x - 430) / 110)
      const mask = Math.max(insideS * insideX, channel)
      value = mix(value, lakeBed, mask)
    }
    const pad = CONTROL_PAD
    const distance = Math.hypot(x - pad.x, s - padS)
    if (distance < pad.radius + 40) {
      const padLevel = landHeight(pad.x, padS)
      value = mix(value, padLevel, 1 - smooth((distance - pad.radius) / 40))
    }
    return value
  }
  return { zoneStart, zoneEnd, height, padS, padLevel: landHeight(CONTROL_PAD.x, padS), lakeBed, wallTop }
}

const SAND = new THREE.Color('#dccb9b')
const GRASS_A = new THREE.Color('#8cc067')
const GRASS_B = new THREE.Color('#6fa95a')
const ROCK = new THREE.Color('#a8a29a')
const ASPHALT = new THREE.Color('#5f666d')
const TOP_SOIL = new THREE.Color('#8a6f4f')

export function buildTerrainMesh(model, geometry) {
  const step = 10
  const xMin = WEST_FACE_X
  const xMax = 560
  const sMin = model.zoneStart - 1350
  const sMax = model.zoneEnd + 1300
  const columns = Math.round((xMax - xMin) / step)
  const rows = Math.round((sMax - sMin) / step)
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3)
  const colors = new Float32Array((columns + 1) * (rows + 1) * 3)
  const heights = new Float32Array((columns + 1) * (rows + 1))
  const waterline = geometry.lowerWaterY
  const upperWater = geometry.upperWaterY
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = xMin + column * step
      const s = sMin + row * step
      const y = model.height(x, s)
      const index = row * (columns + 1) + column
      heights[index] = y
      positions[index * 3] = x
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = -s
    }
  }
  const color = new THREE.Color()
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const index = row * (columns + 1) + column
      const x = xMin + column * step
      const s = sMin + row * step
      const y = heights[index]
      const left = heights[row * (columns + 1) + Math.max(0, column - 1)]
      const right = heights[row * (columns + 1) + Math.min(columns, column + 1)]
      const down = heights[Math.max(0, row - 1) * (columns + 1) + column]
      const up = heights[Math.min(rows, row + 1) * (columns + 1) + column]
      const slope = Math.hypot(right - left, up - down) / (2 * step)
      const patch = fbm(x * 0.03 + 11, s * 0.03 + 5)
      color.copy(GRASS_A).lerp(GRASS_B, patch)
      if (slope > 0.55) color.lerp(ROCK, Math.min(1, (slope - 0.55) * 2.2))
      const nearWater = Math.min(Math.abs(y - waterline), Math.abs(y - upperWater))
      if (nearWater < 3.2) color.lerp(SAND, 1 - nearWater / 3.2)
      if (y < Math.min(waterline, geometry.floorBase + 3) - 0.5) color.lerp(TOP_SOIL, 0.8)
      const roadDistance = Math.abs(x - 80)
      const inLockRoad = s > model.zoneStart - 120 && s < model.zoneEnd + 60 && roadDistance < 6
      const spurDistance = Math.abs(s - model.padS)
      const inSpur = x > 80 && x < CONTROL_PAD.x - 20 && spurDistance < 5
      const onPad = Math.abs(x - CONTROL_PAD.x) < 58 && Math.abs(s - model.padS) < 40
      if (onPad) color.set("#b8bdc1")
      if (inLockRoad || inSpur) color.copy(ASPHALT)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
  }
  const indices = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centreX = xMin + (column + 0.5) * step
      const centreS = sMin + (row + 0.5) * step
      if (centreX < EAST_WALL_OUTER_X - 1 && centreS > model.zoneStart && centreS < model.zoneEnd) continue
      const a = row * (columns + 1) + column
      const b = a + 1
      const c = a + columns + 1
      const d = c + 1
      // Rows go uphill (-z), so this order faces up.
      indices.push(a, c, b, b, c, d)
    }
  }
  const mesh = new THREE.BufferGeometry()
  mesh.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  mesh.setIndex(indices)
  mesh.computeVertexNormals()
  const terrain = new THREE.Mesh(mesh, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }))
  terrain.receiveShadow = true
  terrain.castShadow = true
  return terrain
}

// A box whose vertices are coloured by world height in earth layers, so cut faces read as a cross-section.
export function strataBox(minX, maxX, minY, maxY, minZ, maxZ) {
  const segments = Math.max(1, Math.round((maxY - minY) / 3.5))
  const box = new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ, 1, segments, 1)
  box.translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
  const position = box.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const normal = box.getAttribute('normal')
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index)
    const layer = strataColor(y + (normal.getY(index) === 0 ? 0.01 : 0))
    if (Math.abs(normal.getY(index)) > 0.5) layer.copy(TOP_SOIL)
    colors[index * 3] = layer.r
    colors[index * 3 + 1] = layer.g
    colors[index * 3 + 2] = layer.b
  }
  box.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return box
}

export function buildWestSkirt(model, geometry) {
  const step = 10
  const sMin = model.zoneStart - 1350
  const sMax = model.zoneEnd + 1300
  const pieces = []
  const rowsPerBand = 8
  const addRun = (from, to) => {
    const rows = Math.max(1, Math.round((to - from) / step))
    const positions = []
    const colors = []
    const indices = []
    for (let row = 0; row <= rows; row += 1) {
      const s = from + ((to - from) * row) / rows
      const top = model.height(WEST_FACE_X, s)
      for (let band = 0; band <= rowsPerBand; band += 1) {
        const y = mix(top, BASE_DEPTH, band / rowsPerBand)
        positions.push(WEST_FACE_X, y, -s)
        const layer = strataColor(y - 0.01)
        colors.push(layer.r, layer.g, layer.b)
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let band = 0; band < rowsPerBand; band += 1) {
        const a = row * (rowsPerBand + 1) + band
        const b = a + 1
        const c = a + rowsPerBand + 1
        const d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
    const skirt = new THREE.BufferGeometry()
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    skirt.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    skirt.setIndex(indices)
    skirt.computeVertexNormals()
    const mesh = new THREE.Mesh(skirt, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }))
    mesh.receiveShadow = true
    pieces.push(mesh)
  }
  addRun(sMin, model.zoneStart)
  addRun(model.zoneEnd, sMax)
  return pieces
}
