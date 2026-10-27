import * as THREE from 'three'
import {
  CHAMBER_LENGTH, CHAMBER_WIDTH, LIFT, TILE, LANE_X, WEST_FACE_X, EAST_WALL_OUTER_X, SHIP_SCALE, CHAMBER_START_OFFSET, siteById,
} from '../data/canal.js'
import { cloneRoot, instanceModule, createClipPlayer } from './assets.js'
import { createTerrainModel, buildTerrainMesh, buildWestSkirt, strataBox, BASE_DEPTH, CONTROL_PAD } from './terrain.js'

const RAMP_LENGTH = 45.75
const RAIL_HEIGHT = 0.5
const TILE_VARIANTS_SIDE = ['wall_side_a', 'wall_side_a', 'wall_side_b', 'wall_side_a', 'wall_side_a', 'wall_side_c', 'wall_side_a', 'wall_side_a']
const PORT_ROWS = [-12.2, -6.1, 0, 6.1, 12.2]
const PORTS_A = [-12.3, -8.7, -5.1, -1.5, 1.5, 5.1, 8.7, 12.3]
const PORTS_B_EVEN = [-14, -10.5, -7, -3.5, 0, 3.5, 7, 10.5, 14]
const WATER_COLOR = '#3fb2d4'
const MULE_SETS = 3
const MULE_OFFSET = 112
const SHIP_FINISH_PADDING = 10

const matrixOf = (x, y, z, rotationY = 0, scaleZ = 1, rotationX = 0) => {
  const matrix = new THREE.Matrix4()
  matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, 0, 'YXZ')), new THREE.Vector3(1, 1, scaleZ))
  return matrix
}

function findMaterial(assets, name) {
  let found = null
  Object.values(assets).forEach((entry) => {
    if (found || !entry.scene) return
    entry.scene.traverse((object) => {
      if (found || !object.isMesh) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      found = materials.find((material) => material.name === name) ?? null
    })
  })
  return found
}

function rippleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  context.fillStyle = '#000'
  context.fillRect(0, 0, 256, 256)
  context.strokeStyle = 'rgba(255,255,255,0.8)'
  context.lineWidth = 2.2
  context.lineCap = 'round'
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let index = 0; index < 46; index += 1) {
    const x = random() * 256
    const y = random() * 256
    const length = 18 + random() * 34
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + length * 0.5, y + (random() - 0.5) * 8, x + length, y)
    context.stroke()
    // wrap so the tile repeats without a seam
    context.beginPath()
    context.moveTo(x - 256, y)
    context.quadraticCurveTo(x - 256 + length * 0.5, y + (random() - 0.5) * 8, x - 256 + length, y)
    context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// One closed body of water seen from outside: only its top and the faces towards the camera are drawn, so there is one layer.
function createWaterBody({ minX, maxX, minS, maxS, bottomY, texture }) {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  geometry.translate(0, 0.5, 0)
  const sideMaterial = new THREE.MeshStandardMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.5, roughness: 0.25, metalness: 0, depthWrite: false })
  const topTexture = texture.clone()
  topTexture.needsUpdate = true
  topTexture.repeat.set(Math.max(1, (maxX - minX) / 42), Math.max(1, (maxS - minS) / 42))
  const topMaterial = new THREE.MeshStandardMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.66, roughness: 0.12, metalness: 0, depthWrite: false, emissive: '#bfeaf5', emissiveMap: topTexture, emissiveIntensity: 0.16 })
  const hidden = new THREE.MeshBasicMaterial({ visible: false })
  // Faces: +x, -x (the cut face), top, bottom, and the two ends, which stay hidden so abutting bodies show no sheet.
  const mesh = new THREE.Mesh(geometry, [sideMaterial, sideMaterial, topMaterial, hidden, hidden, hidden])
  mesh.position.set((minX + maxX) / 2, bottomY, -(minS + maxS) / 2)
  mesh.scale.set(maxX - minX, 1, maxS - minS)
  mesh.renderOrder = 5
  mesh.userData = { bottomY, topTexture }
  mesh.setLevel = (level) => { mesh.scale.y = Math.max(0.01, level - bottomY) }
  return mesh
}

const gaugeMaterials = new Map()
// Piers double as depth gauges: light and dark bands every 2.5 m, so a rising level reads against them.
function gaugeMaterial(height) {
  const key = Math.round(height)
  if (!gaugeMaterials.has(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 64
    const context = canvas.getContext('2d')
    context.fillStyle = '#dde1e4'
    context.fillRect(0, 0, 4, 32)
    context.fillStyle = '#9ba5ac'
    context.fillRect(0, 32, 4, 32)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.magFilter = THREE.NearestFilter
    texture.colorSpace = THREE.SRGBColorSpace
    texture.repeat.set(1, height / 5)
    gaugeMaterials.set(key, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }))
  }
  return gaugeMaterials.get(key)
}

function portPositions(tileIndex) {
  const variantB = tileIndex % 2 === 1
  const ports = []
  PORT_ROWS.forEach((row, rowIndex) => {
    if (!variantB) PORTS_A.forEach((x) => ports.push([x, row]))
    else if (rowIndex % 2 === 0) PORTS_B_EVEN.forEach((x) => ports.push([x, row]))
    else PORTS_B_EVEN.slice(0, 8).forEach((x) => ports.push([x + 1.75, row]))
  })
  return ports
}

class BubbleField {
  constructor(ports, floorY) {
    this.ports = ports
    this.floorY = floorY
    this.count = ports.length * 2
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 6, 4), new THREE.MeshBasicMaterial({ color: '#e9fbff', transparent: true, opacity: 0.85, depthWrite: false }), this.count)
    this.foam = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false }), ports.length)
    this.foam.geometry.rotateX(-Math.PI / 2)
    ;[this.bubbles, this.foam].forEach((mesh) => { mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false })
    this.phase = new Float32Array(this.count)
    for (let index = 0; index < this.count; index += 1) this.phase[index] = (Math.sin(index * 12.9898) * 43758.5453) % 1
    this.matrix = new THREE.Matrix4()
    this.position = new THREE.Vector3()
    this.quaternion = new THREE.Quaternion()
    this.scale = new THREE.Vector3()
  }

  update(time, waterY, intensity, foamStrength) {
    const visible = intensity > 0.02
    this.bubbles.visible = visible
    this.foam.visible = visible && foamStrength > 0.02
    if (!visible) return
    const depth = Math.max(1, waterY - this.floorY - 0.6)
    for (let index = 0; index < this.count; index += 1) {
      const port = this.ports[index >> 1]
      const phase = Math.abs(this.phase[index])
      const progress = (time * (0.55 + 0.4 * phase) + phase * 7) % 1
      const radius = (0.25 + 0.5 * phase) * (0.4 + 0.6 * progress) * Math.min(1, intensity * 1.3)
      const wobble = Math.sin(time * 3 + index) * 0.5 * progress
      this.position.set(port[0] + wobble, this.floorY + 0.7 + progress * depth, port[1] + Math.cos(time * 2.4 + index) * 0.5 * progress)
      this.scale.setScalar(radius)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.bubbles.setMatrixAt(index, this.matrix)
    }
    this.bubbles.instanceMatrix.needsUpdate = true
    if (this.foam.visible) {
      for (let index = 0; index < this.ports.length; index += 1) {
        const port = this.ports[index]
        const pulse = 1.0 + 0.5 * Math.sin(time * 2.6 + index * 1.7)
        this.position.set(port[0], waterY + 0.07, port[1])
        this.scale.setScalar(pulse * foamStrength)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        this.foam.setMatrixAt(index, this.matrix)
      }
      this.foam.instanceMatrix.needsUpdate = true
    }
  }
}

export function buildSite({ siteId, assets, simulation }) {
  const site = siteById[siteId]
  const flight = simulation.flights[siteId]
  const geometry = flight.geometry
  const chambers = geometry.chambers
  const group = new THREE.Group()
  const proxies = []
  const dynamics = []
  const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false })
  const concrete = findMaterial(assets, 'concrete_light') ?? new THREE.MeshStandardMaterial({ color: '#cfd2d4' })
  const concreteDouble = concrete.clone()
  concreteDouble.side = THREE.DoubleSide
  const rippleMap = rippleTexture()
  const terrainModel = createTerrainModel(geometry, siteId)
  const zoneStart = terrainModel.zoneStart
  const zoneEnd = terrainModel.zoneEnd
  const laneIds = ['A', 'B']
  const laneStates = {}

  const addProxy = (parent, width, height, depth, ref, priority, offset = [0, 0, 0]) => {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), proxyMaterial)
    proxy.position.set(...offset)
    proxy.userData = { ref, priority, active: true }
    parent.add(proxy)
    proxies.push(proxy)
    return proxy
  }

  // ---- terrain, cut faces and plinths
  // The diorama stands on a pale table so the cut face reads against something.
  const table = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: '#e6edf2', roughness: 1 }))
  table.rotation.x = -Math.PI / 2
  table.position.set(-4500 + WEST_FACE_X + 1, BASE_DEPTH - 0.02, -900)
  table.receiveShadow = true
  group.add(table)
  group.add(buildTerrainMesh(terrainModel, geometry))
  buildWestSkirt(terrainModel, geometry).forEach((piece) => group.add(piece))
  const plinthMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  for (let chamber = 0; chamber < chambers; chamber += 1) {
    const from = chamber === 0 ? zoneStart : geometry.chamberStartS(chamber)
    const to = chamber === chambers - 1 ? zoneEnd : geometry.chamberStartS(chamber + 1)
    const plinth = new THREE.Mesh(strataBox(WEST_FACE_X, EAST_WALL_OUTER_X + 1.5, BASE_DEPTH, geometry.floorY(chamber) - 3.05, -to, -from), plinthMaterial)
    plinth.receiveShadow = true
    group.add(plinth)
  }

  // ---- floors, walls, rails
  const floorMatrices = { a: [], b: [] }
  const sideMatrices = {}
  const gateWallMatrices = []
  const centerMatrices = { wall_center_a: [], wall_center_b: [] }
  const trackMatrices = []
  const sillMatrices = []
  const pushSide = (name, matrix) => { (sideMatrices[name] ??= []).push(matrix) }
  const railDefinitions = {
    A: [{ x: -45, shipSide: 1 }, { x: -6.5, shipSide: -1 }],
    B: [{ x: 6.5, shipSide: 1 }, { x: 45, shipSide: -1 }],
  }
  const addFloor = (laneId, floorY, sCentre, tile) => {
    floorMatrices[tile % 2 === 0 ? 'a' : 'b'].push(matrixOf(LANE_X[laneId], floorY + (floorY > geometry.floorBase ? 0.04 : 0), -sCentre))
  }
  // Sea-side gate station (no sill): one floor tile and the wall tiles that carry the gate pocket.
  laneIds.forEach((laneId) => addFloor(laneId, geometry.floorY(0), -10, 0))
  centerMatrices.wall_center_a.push(matrixOf(0, geometry.floorY(0), 10))
  gateWallMatrices.push(matrixOf(42.5, geometry.floorY(0), 10))
  for (let chamber = 0; chamber < chambers; chamber += 1) {
    const floorY = geometry.floorY(chamber)
    const start = geometry.chamberStartS(chamber)
    for (let tile = 0; tile < 10; tile += 1) {
      const sCentre = start + TILE / 2 + TILE * tile
      laneIds.forEach((laneId) => addFloor(laneId, floorY, sCentre, tile))
      centerMatrices[tile % 3 === 1 ? 'wall_center_b' : 'wall_center_a'].push(matrixOf(0, floorY, -sCentre))
      if (tile === 9) gateWallMatrices.push(matrixOf(42.5, floorY, -sCentre))
      else pushSide(TILE_VARIANTS_SIDE[(tile + chamber) % TILE_VARIANTS_SIDE.length], matrixOf(42.5, floorY, -sCentre))
    }
    const topY = geometry.wallTopY(chamber)
    const flatTiles = chamber === chambers - 1 ? 10 : 8
    const railX = [...railDefinitions.A, ...railDefinitions.B].map((rail) => rail.x)
    railX.forEach((x) => {
      for (let tile = 0; tile < flatTiles; tile += 1) trackMatrices.push(matrixOf(x, topY, -(start + TILE / 2 + TILE * tile)))
      if (chamber < chambers - 1) trackMatrices.push(matrixOf(x, topY, -(start + TILE * 8 + TILE / 4)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.5)))
    })
    // sill under the upper gate of this chamber
    laneIds.forEach((laneId) => sillMatrices.push(matrixOf(LANE_X[laneId], floorY, -geometry.gateS(chamber + 1))))
  }
  group.add(instanceModule(assets, 'lock_structure', 'chamber_floor_a', floorMatrices.a))
  group.add(instanceModule(assets, 'lock_structure', 'chamber_floor_b', floorMatrices.b))
  Object.entries(sideMatrices).forEach(([name, matrices]) => group.add(instanceModule(assets, 'lock_structure', name, matrices)))
  group.add(instanceModule(assets, 'lock_structure', 'wall_side_gate', gateWallMatrices))
  Object.entries(centerMatrices).forEach(([name, matrices]) => group.add(instanceModule(assets, 'lock_structure', name, matrices)))
  group.add(instanceModule(assets, 'lock_structure', 'chamber_sill', sillMatrices))
  group.add(instanceModule(assets, 'lock_structure', 'mule_track_a', trackMatrices, { castShadow: false }))

  // Inclined mule track between chambers: a concrete wedge on the lower wall tops with the rail laid on its slope.
  const rampAngle = Math.atan(LIFT / RAMP_LENGTH)
  const slopeLength = Math.hypot(LIFT, RAMP_LENGTH)
  const rampTracks = []
  for (let gate = 1; gate < chambers; gate += 1) {
    const lowY = geometry.wallTopY(gate - 1)
    const lowS = geometry.gateS(gate) - 40.5
    const highS = lowS + RAMP_LENGTH
    ;[...railDefinitions.A, ...railDefinitions.B].forEach((rail) => {
      const x0 = rail.x - 2.5
      const x1 = rail.x + 2.5
      const wedge = new THREE.BufferGeometry()
      const vertices = [
        x0, lowY, -lowS, x1, lowY, -lowS, x0, lowY, -highS, x1, lowY, -highS, x0, lowY + LIFT, -highS, x1, lowY + LIFT, -highS,
      ]
      wedge.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      wedge.setIndex([0, 2, 4, 1, 5, 3, 2, 3, 5, 2, 5, 4, 0, 4, 5, 0, 5, 1, 0, 1, 3, 0, 3, 2])
      wedge.computeVertexNormals()
      const mesh = new THREE.Mesh(wedge, concreteDouble)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      rampTracks.push(matrixOf(rail.x, lowY + LIFT / 2 + 0.02, -(lowS + RAMP_LENGTH / 2), 0, slopeLength / TILE, rampAngle))
    })
  }
  if (rampTracks.length > 0) group.add(instanceModule(assets, 'lock_structure', 'mule_track_a', rampTracks, { castShadow: false }))

  // West side of lane A is cut open: a gallery beam carries the rail, piers carry the beam.
  for (let chamber = 0; chamber < chambers; chamber += 1) {
    const floorY = geometry.floorY(chamber)
    const start = geometry.chamberStartS(chamber)
    const end = start + CHAMBER_LENGTH
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, end - start), concrete)
    beam.position.set(WEST_FACE_X + 3, floorY + 25 - 1.1, -(start + end) / 2)
    beam.castShadow = true
    beam.receiveShadow = true
    group.add(beam)
    for (let pier = 0; pier <= 5; pier += 1) {
      const s = start + 2.5 + (CHAMBER_LENGTH - 5) * (pier / 5)
      const column = new THREE.Mesh(new THREE.BoxGeometry(5, 22.8, 5), gaugeMaterial(22.8))
      column.position.set(WEST_FACE_X + 2.5, floorY + 11.4, -s)
      column.castShadow = true
      column.receiveShadow = true
      group.add(column)
    }
  }
  for (let gate = 0; gate <= chambers; gate += 1) {
    const floorY = geometry.floorY(gate)
    const pierHeight = geometry.wallTopY(Math.max(0, gate - 1)) - 0.3 - floorY
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4.6, pierHeight, 5), gaugeMaterial(pierHeight))
    pier.position.set(-46.2, floorY + pierHeight / 2, -geometry.gateS(gate))
    pier.castShadow = true
    group.add(pier)
  }

  // ---- gates, valves, signals
  const gates = {}
  const valves = {}
  laneIds.forEach((laneId) => {
    gates[laneId] = []
    for (let gate = 0; gate <= chambers; gate += 1) {
      const leaves = ['L', 'R'].map((side) => {
        const leaf = cloneRoot(assets, 'lock_equipment', `gate_h23_${side}`)
        leaf.position.set(LANE_X[laneId] + (side === 'L' ? -18.35 : 18.35), geometry.floorY(Math.min(gate, chambers)), -geometry.gateS(gate))
        group.add(leaf)
        return createClipPlayer(leaf, assets.lock_equipment.animations, 'gate_open')
      })
      gates[laneId].push(leaves)
    }
    valves[laneId] = []
    for (let chamber = 0; chamber < chambers; chamber += 1) {
      const houses = [0.17, 0.82].map((share, index) => {
        const house = cloneRoot(assets, 'lock_equipment', index === 0 ? 'valve_house_a' : 'valve_house_b')
        const sign = laneId === 'A' ? -1 : 1
        house.position.set(sign * 2.3, geometry.wallTopY(chamber) + 0.25, -(geometry.chamberStartS(chamber) + CHAMBER_LENGTH * share + (laneId === 'A' ? 0 : 22)))
        group.add(house)
        const lampOpen = house.getObjectByName(`${house.name}_lamp_open`)
        const lampClosed = house.getObjectByName(`${house.name}_lamp_closed`)
        return { player: createClipPlayer(house, assets.lock_equipment.animations, 'valve_open'), lampOpen, lampClosed, offOpen: lampOpen.material, offClosed: lampClosed.material }
      })
      valves[laneId].push(houses)
    }
  })

  // ---- fixtures on the centre wall and beyond
  const lampOn = (name) => assets.states[name]
  Object.values(assets.states).forEach((material) => { if ('emissiveIntensity' in material) material.emissiveIntensity = 2.6 })
  const lightTowers = []
  for (let gate = 0; gate <= chambers; gate += 1) {
    const tower = cloneRoot(assets, 'site', 'light_tower')
    tower.position.set(0, geometry.wallTopY(Math.max(0, gate - (gate === chambers ? 1 : 0))) + 0.25, -(geometry.gateS(gate) + (gate === chambers ? -18 : 12)))
    group.add(tower)
    const lamps = tower.getObjectByName('light_tower_lamps')
    lamps.material = lampOn('lamp_warm_on')
    lightTowers.push(tower)
  }
  const house = cloneRoot(assets, 'site', 'control_house_a')
  house.scale.setScalar(0.78)
  house.position.set(0, geometry.wallTopY(Math.min(1, chambers - 1)) + 0.25, -(geometry.chamberStartS(Math.min(1, chambers - 1)) + 150))
  group.add(house)
  house.traverse((object) => { if (object.isMesh && object.name.endsWith('_windows')) object.material = lampOn('window_lit') })

  const center = cloneRoot(assets, 'site', 'control_center')
  center.position.set(CONTROL_PAD.x, terrainModel.padLevel, -terrainModel.padS)
  center.rotation.y = -Math.PI / 2
  group.add(center)
  center.traverse((object) => { if (object.isMesh && object.name.endsWith('_screens')) object.material = lampOn('screen_on') })
  const radar = createClipPlayer(center, assets.site.animations, 'radar_sweep')
  addProxy(center, 72, 40, 34, { type: 'center', id: 'control' }, 2, [-2, 18, 0])
  dynamics.push((time) => radar?.setFraction((time * 0.12) % 1))

  // Buoys line the approach channels.
  const buoys = []
  const buoyStations = []
  for (let index = 0; index < 8; index += 1) {
    buoyStations.push({ s: zoneStart - 90 - index * 190, y: geometry.lowerWaterY })
    buoyStations.push({ s: zoneEnd + 70 + index * 190, y: geometry.upperWaterY })
  }
  buoyStations.forEach((station, index) => {
    ;[['buoy_red', -47], ['buoy_green', 52]].forEach(([name, x]) => {
      const buoy = cloneRoot(assets, 'site', name)
      buoy.position.set(x, station.y, -station.s)
      group.add(buoy)
      const lamp = buoy.getObjectByName(`${name}_lamp`)
      buoys.push({ lamp, off: lamp.material, on: lampOn(name === 'buoy_red' ? 'lamp_red_on' : 'lamp_green_on'), phase: index * 0.9, buoy })
    })
  })
  dynamics.push((time) => buoys.forEach((entry) => { entry.lamp.material = Math.sin(time * 2.1 + entry.phase) > 0.2 ? entry.on : entry.off; entry.buoy.position.y += 0 }))

  // Tugs patrol the channels.
  const tugs = []
  const tugPaths = [
    { name: 'tug_a', centre: [8, zoneStart - 520], radius: [55, 150], y: geometry.lowerWaterY, period: 110, phase: 0 },
    { name: 'tug_b', centre: [10, zoneStart - 980], radius: [60, 160], y: geometry.lowerWaterY, period: 130, phase: 0.4 },
    { name: 'tug_b', centre: [8, zoneEnd + 560], radius: [60, 150], y: geometry.upperWaterY, period: 120, phase: 0.2 },
    { name: 'tug_a', centre: [8, zoneEnd + 1040], radius: [60, 170], y: geometry.upperWaterY, period: 140, phase: 0.7 },
  ]
  tugPaths.forEach((path) => {
    const tug = cloneRoot(assets, 'tugs', path.name)
    group.add(tug)
    tugs.push({ tug, path, thruster: createClipPlayer(tug, assets.tugs.animations, 'thruster_steer') })
  })
  dynamics.push((time) => tugs.forEach(({ tug, path, thruster }) => {
    const angle = (time / path.period + path.phase) * Math.PI * 2
    const x = path.centre[0] + Math.cos(angle) * path.radius[0]
    const s = path.centre[1] + Math.sin(angle) * path.radius[1]
    const headingX = -Math.sin(angle) * path.radius[0]
    const headingS = Math.cos(angle) * path.radius[1]
    tug.position.set(x, path.y, -s)
    tug.rotation.y = Math.atan2(headingX, -headingS)
    thruster?.setFraction(0.5 + 0.5 * Math.sin(time * 0.7 + path.phase))
  }))

  // ---- water
  const waterBodies = []
  const addWater = (body) => { group.add(body); waterBodies.push(body); return body }
  const rippleSpeed = []
  const seaWater = addWater(createWaterBody({ minX: WEST_FACE_X, maxX: 560, minS: zoneStart - 1350, maxS: geometry.gateS(0) + 3, bottomY: geometry.floorBase - 0.3, texture: rippleMap }))
  seaWater.setLevel(geometry.lowerWaterY)
  const lakeWater = addWater(createWaterBody({ minX: WEST_FACE_X, maxX: 560, minS: geometry.gateS(chambers) + 3, maxS: zoneEnd + 1300, bottomY: terrainModel.lakeBed - 0.3, texture: rippleMap }))
  lakeWater.setLevel(geometry.upperWaterY)
  rippleSpeed.push(seaWater, lakeWater)

  // ---- per-lane chambers, bubbles, ships, mules
  const hullMaterial = new THREE.MeshStandardMaterial({ color: '#2a2f35', roughness: 0.9 })
  const cableMaterial = new THREE.MeshStandardMaterial({ color: '#2d3136', roughness: 0.8 })
  const cableGeometry = new THREE.CylinderGeometry(0.28, 0.28, 1, 6)
  const railBounds = { min: geometry.chamberStartS(0) + 8, max: zoneEnd - 14 }
  const railTop = (s) => {
    let value = geometry.wallTopY(0)
    for (let gate = 1; gate < chambers; gate += 1) value += LIFT * Math.min(1, Math.max(0, (s - (geometry.gateS(gate) - 40.5)) / RAMP_LENGTH))
    return value
  }
  const railPitch = (s) => {
    for (let gate = 1; gate < chambers; gate += 1) {
      const from = geometry.gateS(gate) - 40.5
      if (s > from && s < from + RAMP_LENGTH) return rampAngle
    }
    return 0
  }

  laneIds.forEach((laneId) => {
    const lane = flight.lanes[laneId]
    const state = { chambers: [], ships: [], mules: [] }
    laneStates[laneId] = state
    for (let chamber = 0; chamber < chambers; chamber += 1) {
      const minX = LANE_X[laneId] - CHAMBER_WIDTH / 2 + 0.03
      const maxX = LANE_X[laneId] + CHAMBER_WIDTH / 2 - 0.03
      const body = createWaterBody({
        minX, maxX, minS: geometry.gateS(chamber) + 3, maxS: geometry.gateS(chamber + 1) + 3, bottomY: geometry.floorY(chamber), texture: rippleMap,
      })
      group.add(body)
      waterBodies.push(body)
      const bubbleHolder = new THREE.Group()
      bubbleHolder.position.set(LANE_X[laneId], 0, 0)
      const ports = []
      for (let tile = 0; tile < 10; tile += 1) {
        const sCentre = geometry.chamberStartS(chamber) + TILE / 2 + TILE * tile
        portPositions(tile).forEach(([x, offset]) => ports.push([x, -(sCentre + offset)]))
      }
      const field = new BubbleField(ports, geometry.floorY(chamber))
      bubbleHolder.add(field.bubbles, field.foam)
      group.add(bubbleHolder)
      const chamberProxy = addProxy(group, CHAMBER_WIDTH, 20, CHAMBER_LENGTH, { type: 'chamber', id: `${laneId}${chamber + 1}` }, 1, [LANE_X[laneId], geometry.floorY(chamber) + 14, -geometry.chamberCentreS(chamber)])
      state.chambers.push({ body, field, chamberProxy })
    }
    for (let index = 0; index < lane.ships.length; index += 1) {
      const ship = lane.ships[index]
      const wrapper = new THREE.Group()
      wrapper.visible = false
      const model = cloneRoot(assets, 'ships', ship.spec.key)
      wrapper.add(model)
      const player = createClipPlayer(model, assets.ships.animations, 'prop_spin')
      wrapper.scale.setScalar(SHIP_SCALE)
      group.add(wrapper)
      wrapper.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const centre = bounds.getCenter(new THREE.Vector3())
      const local = bounds.clone()
      local.min.multiplyScalar(1 / SHIP_SCALE)
      local.max.multiplyScalar(1 / SHIP_SCALE)
      const proxy = addProxy(model, size.x / SHIP_SCALE, size.y / SHIP_SCALE, size.z / SHIP_SCALE, { type: 'ship', id: ship.spec.id }, 5, [centre.x / SHIP_SCALE, centre.y / SHIP_SCALE, centre.z / SHIP_SCALE])
      proxy.userData.shipIndex = index
      const anchors = ['bow', 'stern'].map((end) => {
        const holder = new THREE.Object3D()
        holder.position.set(0, 13, end === 'bow' ? local.max.z - 42 : local.min.z + 38)
        model.add(holder)
        return holder
      })
      state.ships.push({ ship, wrapper, model, player, bounds, size, anchors, proxy })
    }
    const lanes = railDefinitions[laneId]
    for (let set = 0; set < MULE_SETS; set += 1) {
      const mules = []
      for (let slot = 0; slot < 4; slot += 1) {
        const rail = lanes[slot % 2]
        const pitchGroup = new THREE.Group()
        const flipGroup = new THREE.Group()
        const mule = cloneRoot(assets, 'mules', ['mule_a', 'mule_b', 'mule_c'][(set + slot) % 3])
        flipGroup.add(mule)
        pitchGroup.add(flipGroup)
        pitchGroup.visible = false
        group.add(pitchGroup)
        const anchor = new THREE.Object3D()
        anchor.position.set(2.95, 3.5, 3.4)
        flipGroup.add(anchor)
        const wheels = createClipPlayer(mule, assets.mules.animations, 'wheel_roll')
        const capstan = createClipPlayer(mule, assets.mules.animations, 'capstan_spin')
        const arm = createClipPlayer(mule, assets.mules.animations, 'arm_swing_out')
        arm?.setFraction(0.98)
        const cable = new THREE.Mesh(cableGeometry, cableMaterial)
        cable.visible = false
        cable.castShadow = false
        group.add(cable)
        const id = `${laneId}${String(set + 1).padStart(2, '0')}-${slot + 1}`
        const proxy = addProxy(flipGroup, 6, 7, 12, { type: 'mule', id }, 4, [0, 3, 0])
        mules.push({ pitchGroup, flipGroup, rail, slot, anchor, wheels, capstan, cable, id, proxy, set })
      }
      state.mules.push(mules)
    }
  })

  const shipPose = (laneId, index) => {
    const lane = flight.lanes[laneId]
    return lane.pose(index, simulation.laneTime(lane))
  }
  const poseOfShip = (id) => {
    const laneId = id[0]
    const index = Number(id.slice(1)) - 1
    const lane = flight.lanes[laneId]
    if (!lane.ships[index]) return null
    const pose = shipPose(laneId, index)
    if (!pose.visible) return null
    const entry = laneStates[laneId].ships[index]
    return { x: LANE_X[laneId], y: pose.y + 6, z: -pose.s, yaw: lane.uphill ? Math.PI : 0, ring: { rx: entry.size.x * 0.5 * 1.18, rz: entry.size.z * 0.5 * 1.04, power: 2 }, waterY: pose.y, raise: 0.5, focusY: pose.holdY + 8 }
  }
  const poseOfChamber = (id) => {
    const laneId = id[0]
    const chamber = Number(id.slice(1)) - 1
    const lane = flight.lanes[laneId]
    const y = lane.levelY(chamber, simulation.laneTime(lane))
    return { x: LANE_X[laneId], y: y + 3, z: -geometry.chamberCentreS(chamber), yaw: 0, ring: { rx: CHAMBER_WIDTH / 2 + 1.2, rz: CHAMBER_LENGTH / 2 + 2, power: 8 }, waterY: y, raise: 0.4 }
  }
  const poseOfMule = (id) => {
    const [laneId, rest] = [id[0], id.slice(1)]
    const [setText, slotText] = rest.split('-')
    const entry = laneStates[laneId].mules[Number(setText) - 1]?.[Number(slotText) - 1]
    if (!entry || !entry.pitchGroup.visible) return null
    const position = entry.pitchGroup.position
    return { x: position.x, y: position.y + 2, z: position.z, yaw: 0, ring: { rx: 3.5, rz: 7.5, power: 2 }, waterY: position.y, raise: 0.2 }
  }
  const poseOf = (ref) => {
    if (ref.type === 'ship') return poseOfShip(ref.id)
    if (ref.type === 'chamber') return poseOfChamber(ref.id)
    if (ref.type === 'mule') return poseOfMule(ref.id)
    if (ref.type === 'center') return { x: CONTROL_PAD.x, y: terrainModel.padLevel + 12, z: -terrainModel.padS, yaw: -Math.PI / 2, ring: { rx: 40, rz: 20, power: 4 }, waterY: terrainModel.padLevel, raise: 0.5 }
    return null
  }

  const tempA = new THREE.Vector3()
  const tempB = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const direction = new THREE.Vector3()
  const setCable = (cable, from, to) => {
    direction.subVectors(to, from)
    const length = direction.length()
    cable.position.copy(from).addScaledVector(direction, 0.5)
    cable.scale.set(1, length, 1)
    cable.quaternion.setFromUnitVectors(up, direction.normalize())
  }

  const update = (delta, renderTime) => {
    laneIds.forEach((laneId) => {
      const lane = flight.lanes[laneId]
      const laneTime = simulation.laneTime(lane)
      const state = laneStates[laneId]
      // water, culvert flow, valves
      for (let chamber = 0; chamber < chambers; chamber += 1) {
        const level = lane.levelY(chamber, laneTime)
        const entry = state.chambers[chamber]
        entry.body.setLevel(level)
        const valve = lane.valveFraction(chamber, laneTime)
        const segment = lane.activeLevelSegment(chamber, laneTime)
        const rising = segment ? segment.to > segment.from : false
        entry.field.update(renderTime, level, valve * (rising ? 1 : 0.4), rising ? valve : 0)
        valves[laneId][chamber].forEach((houseValve) => {
          houseValve.player?.setFraction(valve)
          houseValve.lampOpen.material = valve > 0.5 ? lampOn('lamp_green_on') : houseValve.offOpen
          houseValve.lampClosed.material = valve > 0.5 ? houseValve.offClosed : lampOn('lamp_red_on')
        })
        entry.chamberProxy.position.y = geometry.floorY(chamber) + 14
      }
      for (let gate = 0; gate <= chambers; gate += 1) {
        const fraction = lane.gateFraction(gate, laneTime)
        gates[laneId][gate].forEach((player) => player?.setFraction(fraction))
      }
      // ships
      state.ships.forEach((entry, index) => {
        const pose = lane.pose(index, laneTime)
        entry.wrapper.visible = pose.visible
        entry.proxy.userData.active = pose.visible
        if (!pose.visible) return
        entry.wrapper.position.set(LANE_X[laneId], pose.y, -pose.s)
        entry.wrapper.rotation.y = lane.uphill ? Math.PI : 0
        entry.player?.setFraction(pose.moving ? (renderTime * 0.9) % 1 : (renderTime * 0.05) % 1)
      })
      // mules and cables
      state.mules.forEach((mules, set) => {
        const index = lane.ships.findIndex((ship, shipIndex) => shipIndex % MULE_SETS === set && laneTime >= ship.startMove - 8 && laneTime <= ship.clearTime + SHIP_FINISH_PADDING)
        mules.forEach((mule) => { mule.pitchGroup.visible = index >= 0; mule.proxy.userData.active = index >= 0 })
        if (index < 0) { mules.forEach((mule) => { mule.cable.visible = false }); return }
        const pose = lane.pose(index, laneTime)
        const shipEntry = state.ships[index]
        const shipS = pose.visible ? pose.s : (laneTime > lane.ships[index].clearTime ? lane.outS : lane.waitS)
        const sign = lane.uphill ? 1 : -1
        mules.forEach((mule) => {
          const bow = mule.slot < 2
          const wanted = shipS + sign * (bow ? MULE_OFFSET : -MULE_OFFSET)
          const s = Math.min(railBounds.max, Math.max(railBounds.min, wanted))
          const pitch = railPitch(s)
          mule.pitchGroup.position.set(mule.rail.x, railTop(s) + RAIL_HEIGHT + 0.06, -s)
          mule.pitchGroup.rotation.set(pitch, 0, 0)
          const facingUp = lane.uphill
          const scaleX = mule.rail.shipSide === 1 ? 1 : -1
          mule.flipGroup.scale.set(scaleX, 1, facingUp ? -1 : 1)
          if (mule.rail.shipSide === -1) mule.flipGroup.scale.set(facingUp ? 1 : -1, 1, facingUp ? 1 : 1)
          mule.flipGroup.rotation.y = mule.rail.shipSide === -1 && facingUp ? Math.PI : 0
          mule.wheels?.setFraction(((s * 0.12) % 1 + 1) % 1)
          mule.capstan?.setFraction((renderTime * 0.7) % 1)
          const attached = pose.visible && shipS > railBounds.min - 60 && shipS < railBounds.max + 90
          mule.cable.visible = attached
          if (attached) {
            mule.pitchGroup.updateMatrixWorld(true)
            shipEntry.wrapper.updateMatrixWorld(true)
            mule.anchor.getWorldPosition(tempA)
            shipEntry.anchors[bow ? 0 : 1].getWorldPosition(tempB)
            tempB.x += (mule.rail.shipSide === 1 ? -1 : 1) * 12
            setCable(mule.cable, tempA, tempB)
          }
        })
      })
    })
    rippleSpeed.concat(waterBodies).forEach((body, index) => {
      const offset = body.userData.topTexture.offset
      offset.x = (renderTime * 0.006 + index * 0.13) % 1
      offset.y = (renderTime * 0.004) % 1
    })
    dynamics.forEach((callback) => callback(renderTime))
  }

  return {
    group,
    proxies,
    update,
    poseOf,
    siteGeometry: geometry,
    terrainModel,
    heightAt: (x, z) => terrainModel.height(x, -z),
    clearanceAt: (x, z) => {
      const s = -z
      let ground = terrainModel.height(x, s)
      if (x > -52 && x < 60 && s > zoneStart && s < zoneEnd) ground = Math.max(ground, railTop(s) + 6)
      return Math.max(ground, geometry.lowerWaterY + 2)
    },
    laneStates,
    site,
    center: { x: CONTROL_PAD.x, y: terrainModel.padLevel, z: -terrainModel.padS },
    railTop,
  }
}
