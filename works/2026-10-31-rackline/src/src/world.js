// Builds everything in the building that does not move, plus the instanced pools the sim drives.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  AISLE_ONE_X, AISLE_TWO_X, BACK_LANE_Z, BAY_CENTER_Z, CONVEYOR_TOP, EMPTY_STACK, FLOOR_FRONT_Z, FLOOR_RIGHT_X, FRONT_LANE_Z, INBOUND_DOORS,
  INBOUND_PICK_X, LEFT_LANE_X, OUTBOUND_DOORS, OUTBOUND_DROP_Z, PARKING_X, PARKING_Z, PICK_LINES, RACK_ROW_X, RIGHT_LANE_X,
  STAND_TOP, STATION_LANE_X, WALL_BACK_Z, WALL_LEFT_X,
} from './layout.js'

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
const modelCache = new Map()

export async function loadModel(name) {
  if (!modelCache.has(name)) {
    modelCache.set(name, loader.loadAsync(`/assets/${name}.glb`))
  }
  const gltf = await modelCache.get(name)
  gltf.scene.updateMatrixWorld(true)
  return gltf.scene
}

// Flattens a model into one geometry per material, keeping world transforms, so it can be instanced cheaply.
export function flattenModel(root, includeMesh = () => true) {
  const byMaterial = new Map()
  root.updateMatrixWorld(true)
  root.traverse((node) => {
    if (!node.isMesh || !includeMesh(node)) return
    const key = node.material.uuid
    if (!byMaterial.has(key)) byMaterial.set(key, { material: node.material, geometries: [] })
    const geometry = node.geometry.clone()
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv', 'tangent'].includes(attribute)) geometry.deleteAttribute(attribute)
    }
    for (const attribute of ['position', 'normal', 'uv']) {
      const data = geometry.getAttribute(attribute)
      if (data?.isInterleavedBufferAttribute || data?.normalized || (data && !(data.array instanceof Float32Array))) {
        geometry.setAttribute(attribute, floatAttribute(data))
      }
    }
    if (geometry.getAttribute('tangent')) geometry.deleteAttribute('tangent')
    if (!geometry.getAttribute('uv')) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2))
    }
    geometry.applyMatrix4(node.matrixWorld)
    byMaterial.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry)
  })
  return [...byMaterial.values()].map(({ material, geometries }) => {
    // The GLBs flag vertex colours, but they are dropped above and the textures carry the colour.
    material.vertexColors = false
    material.needsUpdate = true
    return { material, geometry: mergeGeometries(geometries, false) }
  })
}

function floatAttribute(attribute) {
  const values = new Float32Array(attribute.count * attribute.itemSize)
  for (let index = 0; index < attribute.count; index++) {
    values[index * attribute.itemSize] = attribute.getX(index)
    if (attribute.itemSize > 1) values[index * attribute.itemSize + 1] = attribute.getY(index)
    if (attribute.itemSize > 2) values[index * attribute.itemSize + 2] = attribute.getZ(index)
    if (attribute.itemSize > 3) values[index * attribute.itemSize + 3] = attribute.getW(index)
  }
  return new THREE.BufferAttribute(values, attribute.itemSize)
}

// A set of instanced meshes sharing transforms, one per material of the flattened model.
export function createInstances(flattened, count, parent, { castShadow = true, receiveShadow = true } = {}) {
  const meshes = flattened.map(({ material, geometry }) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.castShadow = castShadow && !material.transparent
    mesh.receiveShadow = receiveShadow
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.count = 0
    parent.add(mesh)
    return mesh
  })
  return {
    meshes,
    setCount(value) {
      for (const mesh of meshes) mesh.count = value
    },
    setMatrix(index, matrix) {
      for (const mesh of meshes) mesh.setMatrixAt(index, matrix)
    },
    commit() {
      for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true
    },
  }
}

const scratchMatrix = new THREE.Matrix4()
const scratchQuaternion = new THREE.Quaternion()
const upAxis = new THREE.Vector3(0, 1, 0)

export function composeMatrix(x, y, z, heading, target = scratchMatrix, scale = 1) {
  scratchQuaternion.setFromAxisAngle(upAxis, heading)
  target.compose(new THREE.Vector3(x, y, z), scratchQuaternion, new THREE.Vector3(scale, scale, scale))
  return target
}

async function placeStatic(name, placements, parent, options) {
  const flattened = flattenModel(await loadModel(name))
  const instances = createInstances(flattened, placements.length, parent, options)
  instances.setCount(placements.length)
  placements.forEach((placement, index) => {
    instances.setMatrix(index, composeMatrix(placement.x, placement.y ?? 0, placement.z, placement.heading ?? 0, new THREE.Matrix4(), placement.scale ?? 1))
  })
  instances.commit()
  return instances
}

function repeatingTexture(url, repeat, colorSpace) {
  const texture = new THREE.TextureLoader().load(url)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = 12
  if (colorSpace) texture.colorSpace = colorSpace
  return texture
}

function buildFloor(parent) {
  const width = FLOOR_RIGHT_X - WALL_LEFT_X
  const depth = FLOOR_FRONT_Z - WALL_BACK_Z
  const material = new THREE.MeshStandardMaterial({
    map: repeatingTexture('/textures/floor_diff.jpg', 9, THREE.SRGBColorSpace),
    roughnessMap: repeatingTexture('/textures/floor_rough.jpg', 9),
    normalMap: repeatingTexture('/textures/floor_nor_gl.jpg', 9),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.5,
    metalness: 0,
    color: 0x9aa0a4,
    envMapIntensity: 1.6,
  })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material)
  floor.rotation.x = -Math.PI / 2
  floor.position.set((FLOOR_RIGHT_X + WALL_LEFT_X) / 2, 0, (FLOOR_FRONT_Z + WALL_BACK_Z) / 2)
  floor.receiveShadow = true
  floor.name = 'floor'
  parent.add(floor)

  // The cut edge of the slab, so the building reads as sliced open and not as floating.
  const slabMaterial = new THREE.MeshStandardMaterial({ color: 0x4d5257, roughness: 0.9 })
  const front = new THREE.Mesh(new THREE.BoxGeometry(width, 1.2, 0.05), slabMaterial)
  front.position.set(floor.position.x, -0.6, FLOOR_FRONT_Z)
  parent.add(front)
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, depth), slabMaterial)
  side.position.set(FLOOR_RIGHT_X, -0.6, floor.position.z)
  parent.add(side)
  return floor
}

function buildFloorPaint(parent) {
  const canvasWidth = 4096
  const metresWidth = FLOOR_RIGHT_X - WALL_LEFT_X
  const metresDepth = FLOOR_FRONT_Z - WALL_BACK_Z
  const pixelsPerMetre = canvasWidth / metresWidth
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = Math.round(metresDepth * pixelsPerMetre)
  const context = canvas.getContext('2d')
  const toPixelX = (x) => (x - WALL_LEFT_X) * pixelsPerMetre
  const toPixelY = (z) => (z - WALL_BACK_Z) * pixelsPerMetre
  const line = (x1, z1, x2, z2, color, width) => {
    context.strokeStyle = color
    context.lineWidth = width * pixelsPerMetre
    context.beginPath()
    context.moveTo(toPixelX(x1), toPixelY(z1))
    context.lineTo(toPixelX(x2), toPixelY(z2))
    context.stroke()
  }
  const yellow = 'rgba(232, 180, 48, 0.82)'
  const halfLane = 1.75
  // Lane edges around the ring.
  for (const z of [FRONT_LANE_Z, BACK_LANE_Z]) {
    line(LEFT_LANE_X - halfLane, z - halfLane, RIGHT_LANE_X + halfLane, z - halfLane, yellow, 0.1)
    line(LEFT_LANE_X - halfLane, z + halfLane, RIGHT_LANE_X + halfLane, z + halfLane, yellow, 0.1)
  }
  for (const x of [LEFT_LANE_X, AISLE_ONE_X, AISLE_TWO_X, STATION_LANE_X, RIGHT_LANE_X]) {
    line(x - halfLane, BACK_LANE_Z + halfLane, x - halfLane, FRONT_LANE_Z - halfLane, yellow, 0.1)
    line(x + halfLane, BACK_LANE_Z + halfLane, x + halfLane, FRONT_LANE_Z - halfLane, yellow, 0.1)
  }
  // Direction chevrons on the lanes.
  const chevron = (x, z, angle) => {
    context.save()
    context.translate(toPixelX(x), toPixelY(z))
    context.rotate(angle)
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    context.lineWidth = 0.14 * pixelsPerMetre
    context.beginPath()
    context.moveTo(-0.45 * pixelsPerMetre, 0.3 * pixelsPerMetre)
    context.lineTo(0, -0.2 * pixelsPerMetre)
    context.lineTo(0.45 * pixelsPerMetre, 0.3 * pixelsPerMetre)
    context.stroke()
    context.restore()
  }
  for (let x = LEFT_LANE_X + 6; x < RIGHT_LANE_X - 2; x += 8) {
    chevron(x, FRONT_LANE_Z, Math.PI / 2)
    chevron(x, BACK_LANE_Z, -Math.PI / 2)
  }
  for (let z = -6; z <= 6; z += 6) {
    for (const x of [AISLE_ONE_X, AISLE_TWO_X, STATION_LANE_X, RIGHT_LANE_X]) chevron(x, z, 0)
    chevron(LEFT_LANE_X, z, Math.PI)
  }
  // Hatched keep-out zones around the picking lines.
  const hatch = (x1, z1, x2, z2) => {
    context.save()
    context.beginPath()
    context.rect(toPixelX(x1), toPixelY(z1), (x2 - x1) * pixelsPerMetre, (z2 - z1) * pixelsPerMetre)
    context.clip()
    context.strokeStyle = 'rgba(232, 180, 48, 0.42)'
    context.lineWidth = 0.14 * pixelsPerMetre
    for (let offset = -(z2 - z1); offset < x2 - x1; offset += 0.7) {
      context.beginPath()
      context.moveTo(toPixelX(x1 + offset), toPixelY(z2))
      context.lineTo(toPixelX(x1 + offset + (z2 - z1)), toPixelY(z1))
      context.stroke()
    }
    context.restore()
  }
  for (const pickLine of PICK_LINES) {
    hatch(pickLine.conveyorStartX - 0.3, pickLine.z + 0.8, pickLine.conveyorEndX + 0.3, pickLine.z + 1.5)
  }
  // Parking bays.
  for (const x of PARKING_X) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    context.lineWidth = 0.08 * pixelsPerMetre
    context.strokeRect(toPixelX(x - 0.85), toPixelY(PARKING_Z - 1.2), 1.7 * pixelsPerMetre, 4.2 * pixelsPerMetre)
  }
  // Zone names lie flat on the floor, drawn only where they fit.
  const label = (text, x, z, size, angle = 0) => {
    context.save()
    context.translate(toPixelX(x), toPixelY(z))
    context.rotate(angle)
    context.font = `600 ${size * pixelsPerMetre}px "Segoe UI", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = 'rgba(238, 243, 246, 0.72)'
    context.fillText(text, 0, 0)
    context.restore()
  }
  label('RECEIVING', -23.7, 11.5, 0.7, -Math.PI / 2)
  label('PICK AND PACK', 19.2, 7.1, 0.85)
  label('SHIPPING', 18.5, -13.2, 0.85)
  label('PARK', -1.5, 17.9, 0.7)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 12
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(metresWidth, metresDepth),
    new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  )
  decal.rotation.x = -Math.PI / 2
  decal.position.set((FLOOR_RIGHT_X + WALL_LEFT_X) / 2, 0.012, (FLOOR_FRONT_Z + WALL_BACK_Z) / 2)
  decal.receiveShadow = true
  parent.add(decal)
}

// Concrete and steel shared by everything built here that the SimReady set does not have.
const steelDark = new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.42, metalness: 0.85 })
const steelLight = new THREE.MeshStandardMaterial({ color: 0x8f979f, roughness: 0.36, metalness: 0.9 })
const accentPaint = new THREE.MeshStandardMaterial({ color: 0x11a593, roughness: 0.42, metalness: 0.3 })
const frameGrey = new THREE.MeshStandardMaterial({ color: 0x59626c, roughness: 0.48, metalness: 0.65 })
const rubberBlack = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.82 })
const concrete = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.92 })
const trailerSkin = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.5, metalness: 0.5 })
const trailerInside = new THREE.MeshStandardMaterial({ color: 0x25282c, roughness: 0.8, side: THREE.BackSide })
const doorLampOn = new THREE.MeshStandardMaterial({ color: 0x47d78a, emissive: 0x47d78a, emissiveIntensity: 5 })

function box(parent, width, height, depth, x, y, z, material = steelDark, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// A dock door: posts and a header in the wall line, rubber seal, and a trailer backed up to it.
function buildDockDoor(parent, position, inwardHeading) {
  const group = new THREE.Group()
  group.position.set(position.x, 0, position.z)
  group.rotation.y = inwardHeading
  parent.add(group)
  // Local +z points into the building, local x runs along the wall.
  const halfModule = 3
  box(group, 1.3, 11.1, 0.5, -halfModule + 0.65, 5.55, -0.1, concrete)
  box(group, 1.3, 11.1, 0.5, halfModule - 0.65, 5.55, -0.1, concrete)
  box(group, 3.4, 7.1, 0.5, 0, 7.55, -0.1, concrete)
  box(group, 0.2, 4, 0.62, -1.72, 2, -0.1, rubberBlack)
  box(group, 0.2, 4, 0.62, 1.72, 2, -0.1, rubberBlack)
  box(group, 3.64, 0.3, 0.62, 0, 3.95, -0.1, rubberBlack)
  const lamp = box(group, 0.32, 0.32, 0.1, 2.1, 4.25, 0.2, doorLampOn, false)
  lamp.name = 'doorLamp'
  const trailer = new THREE.Group()
  group.add(trailer)
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 14), trailerInside)
  shell.position.set(0, 1.7, -7.5)
  trailer.add(shell)
  const outer = new THREE.Mesh(new THREE.BoxGeometry(2.72, 2.92, 14.1), trailerSkin)
  outer.position.set(0, 1.7, -7.55)
  outer.castShadow = true
  outer.material = [trailerSkin, trailerSkin, trailerSkin, trailerSkin, trailerInside, trailerSkin]
  trailer.add(outer)
  return { group, trailer }
}

function buildWalls() {
  const placements = []
  // A wall module spans 6 m along local -z from its origin.
  const doorXs = OUTBOUND_DOORS.map((door) => door.x)
  for (let centerX = WALL_LEFT_X + 3; centerX < FLOOR_RIGHT_X; centerX += 6) {
    if (doorXs.includes(centerX)) continue
    placements.push({ x: centerX - 3, z: WALL_BACK_Z, heading: -Math.PI / 2 })
  }
  const doorZs = INBOUND_DOORS.map((door) => door.z)
  for (let centerZ = WALL_BACK_Z + 3; centerZ < FLOOR_FRONT_Z; centerZ += 6) {
    if (doorZs.includes(centerZ)) continue
    placements.push({ x: WALL_LEFT_X, z: centerZ + 3, heading: 0 })
  }
  return placements
}

function cylinder(parent, radius, height, x, y, z, material, axis = 'y') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material)
  mesh.position.set(x, y, z)
  if (axis === 'z') mesh.rotation.x = Math.PI / 2
  if (axis === 'x') mesh.rotation.z = Math.PI / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function buildGantry(parent, line, x) {
  const group = new THREE.Group()
  group.position.set(x, 0, line.z)
  parent.add(group)
  const legHeight = 3.2
  const postZ = 1.45
  const legs = [[-1.25, -postZ], [1.25, -postZ], [-1.25, postZ], [1.25, postZ]]
  for (const [legX, legZ] of legs) {
    box(group, 0.14, legHeight, 0.14, legX, legHeight / 2, legZ, frameGrey)
    box(group, 0.34, 0.03, 0.34, legX, 0.015, legZ, steelLight)
    for (const boltX of [-0.12, 0.12]) cylinder(group, 0.015, 0.03, legX + boltX, 0.04, legZ + 0.12, steelLight)
  }
  // Rails along both sides, with a linear guide on top of each.
  for (const railZ of [-postZ, postZ]) {
    box(group, 2.64, 0.16, 0.16, 0, legHeight, railZ, frameGrey)
    box(group, 2.64, 0.03, 0.06, 0, legHeight + 0.095, railZ, steelLight)
    const brace = box(group, 1.0, 0.05, 0.05, -0.92, legHeight - 0.35, railZ, frameGrey)
    brace.rotation.z = -0.62
    const braceOther = box(group, 1.0, 0.05, 0.05, 0.92, legHeight - 0.35, railZ, frameGrey)
    braceOther.rotation.z = 0.62
  }
  const bridge = new THREE.Group()
  group.add(bridge)
  box(bridge, 0.2, 0.2, postZ * 2 + 0.2, 0, legHeight + 0.24, 0, accentPaint)
  box(bridge, 0.05, 0.03, postZ * 2, 0, legHeight + 0.355, 0, steelLight)
  for (const truckZ of [-postZ, postZ]) box(bridge, 0.3, 0.09, 0.14, 0, legHeight + 0.15, truckZ, rubberBlack)
  // Energy chain along the bridge.
  box(bridge, 0.1, 0.05, postZ * 1.8, 0.13, legHeight + 0.3, 0, rubberBlack)
  const carriage = new THREE.Group()
  bridge.add(carriage)
  box(carriage, 0.34, 0.26, 0.34, 0, legHeight + 0.24, 0, frameGrey)
  box(carriage, 0.12, 0.18, 0.2, 0.2, legHeight + 0.24, 0, rubberBlack)
  const mast = cylinder(carriage, 0.05, 1, 0, 0, 0, steelLight)
  const head = new THREE.Group()
  carriage.add(head)
  box(head, 0.44, 0.05, 0.44, 0, 0.03, 0, frameGrey)
  for (const cupX of [-0.15, 0.15]) {
    for (const cupZ of [-0.15, 0.15]) cylinder(head, 0.06, 0.035, cupX, -0.01, cupZ, rubberBlack)
  }
  return { group, bridge, carriage, mast, head, legHeight }
}

// A low welded frame a pallet sits on: forks slide between its two rails.
function buildStand(parent, x, z, length = 1.1) {
  for (const railZ of [-0.42, 0.42]) box(parent, 1.2, STAND_TOP, 0.1, x, STAND_TOP / 2, z + railZ * (length / 1.1), frameGrey)
  for (const crossX of [-0.56, 0.56]) box(parent, 0.08, 0.08, length - 0.1, x + crossX, 0.04, z, steelLight)
}

export async function buildWorld(scene, renderer, sim) {
  const environmentTexture = await new RGBELoader().loadAsync('/env/empty_warehouse_01_2k.hdr')
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = environmentTexture
  scene.environmentIntensity = 0.46
  scene.background = new THREE.Color(0x05070a)
  scene.fog = new THREE.FogExp2(0x0b0e12, 0.0042)

  const staticGroup = new THREE.Group()
  scene.add(staticGroup)
  const floor = buildFloor(staticGroup)
  buildFloorPaint(staticGroup)

  // Racks: each row is three bays long and two tiers high.
  const rackPlacements = []
  for (const rowX of RACK_ROW_X) {
    for (const bayZ of BAY_CENTER_Z) {
      rackPlacements.push({ x: rowX, z: bayZ, heading: Math.PI / 2 })
      rackPlacements.push({ x: rowX, y: 3.01, z: bayZ, heading: Math.PI / 2 })
    }
  }
  await placeStatic('rack_large_empty_a01', rackPlacements, staticGroup)

  // Walls and columns.
  await placeStatic('structure_wall_straight_a01', buildWalls(), staticGroup)
  const doors = {}
  doors.inbound = INBOUND_DOORS.map((door) => buildDockDoor(staticGroup, { x: WALL_LEFT_X - 0.2, z: door.z }, Math.PI / 2))
  doors.outbound = OUTBOUND_DOORS.map((door) => buildDockDoor(staticGroup, { x: door.x, z: WALL_BACK_Z - 0.2 }, 0))

  // Conveyors: the a08 module runs along its local +z, 2.72 m long, with a roller bed about 1 m wide centred on x = 0.5.
  const conveyorPlacements = []
  for (const line of PICK_LINES) {
    for (let index = 0; index < 4; index++) {
      conveyorPlacements.push({ x: line.conveyorStartX + index * 2.72, z: line.z + 0.5, heading: Math.PI / 2 })
    }
  }
  for (const door of INBOUND_DOORS) {
    for (let index = 0; index < 2; index++) {
      conveyorPlacements.push({ x: INBOUND_PICK_X + 0.9 - (index + 1) * 2.72, z: door.z + 0.5, heading: Math.PI / 2 })
    }
  }
  for (const door of OUTBOUND_DOORS) {
    for (let index = 0; index < 2; index++) {
      conveyorPlacements.push({ x: door.x - 0.5, z: OUTBOUND_DROP_Z + 1.2 - (index + 1) * 2.72, heading: 0 })
    }
  }
  await placeStatic('conveyor_belt_a08', conveyorPlacements, staticGroup)

  // Pick and pack stands: a low steel frame the pallet sits on, so forks can get under it.
  for (const line of PICK_LINES) {
    for (const x of [line.pickX, line.packX]) {
      buildStand(staticGroup, x, line.z)
    }
    buildStand(staticGroup, line.packX, line.z + 1.7, 1.5)
  }

  // Safety fencing along the lines and rack ends.
  const fencePlacements = []
  for (const line of PICK_LINES) {
    for (let x = line.conveyorStartX + 0.7; x < line.conveyorEndX - 0.5; x += 1.25) {
      fencePlacements.push({ x, z: line.z + 1.15 })
      fencePlacements.push({ x, z: line.z - 1.15 })
    }
  }
  await placeStatic('barrier_fence_metal_a02', fencePlacements, staticGroup)
  await placeStatic('barrier_gate_safetyDock_a02', OUTBOUND_DOORS.flatMap((door) => [{ x: door.x - 3.9, z: -14.7 }, { x: door.x + 0.8, z: -14.7 }]), staticGroup)

  // Lived-in details.
  await placeStatic('ladder_rolling_yellow_a02', [{ x: -24.5, z: 12, heading: 1.2 }, { x: 33, z: -13.2, heading: -0.5 }], staticGroup)
  await placeStatic('sign_warning_a04', [{ x: 8.5, z: 8.4, heading: 0.4 }, { x: -18.9, z: 12.8, heading: 2 }], staticGroup)
  await placeStatic('bin_waste_a01', [{ x: 31.6, z: 7.1, heading: 0.3, scale: 2 }, { x: -25.3, z: 15.2, heading: -0.7, scale: 2 }], staticGroup)
  await placeStatic('pallet_assembly_b01', [{ x: 33, z: 12, heading: 0.15 }, { x: 33.2, z: 9.9, heading: -0.1 }, { x: 33, z: 12, y: 0.57, heading: 1.6 }, { x: -24.5, z: 17, heading: 0.3 }], staticGroup)

  // Roof trusses and hanging LED fixtures over the back half only, so the camera sees in.
  const trussPlacements = []
  const fixturePlacements = []
  const columnPlacements = []
  for (let x = WALL_LEFT_X + 5.4; x < FLOOR_RIGHT_X - 2; x += 10.8) {
    for (let z = WALL_BACK_Z + 3; z < -6; z += 5.4) {
      trussPlacements.push({ x, y: 9.2, z, heading: Math.PI / 2 })
    }
    columnPlacements.push({ x, z: WALL_BACK_Z + 0.5 })
  }
  for (const x of [-15.7, -5.1, 5.9, 16.7, 27.5]) {
    for (const z of [-13, -7.6]) {
      fixturePlacements.push({ x, y: 9, z })
    }
  }
  await placeStatic('structure_beam_a01', trussPlacements, staticGroup)

  const fixtures = await placeStatic('lighting_overheadLed_lightPanel_a01', fixturePlacements.map((placement) => ({ ...placement, scale: 0.42 })), staticGroup, { castShadow: false })
  for (const mesh of fixtures.meshes) {
    const material = mesh.material.clone()
    material.emissive = new THREE.Color(0xfff4e2)
    material.emissiveIntensity = /light|emis|panel|plastic/i.test(material.name) ? 1.7 : 0
    mesh.material = material
  }

  // Empty pallet stack at the park end.
  const palletFlat = flattenModel(await loadModel('pallet_block_a05'))
  const gantries = PICK_LINES.flatMap((line) => [buildGantry(staticGroup, line, line.pickX + 0.6), buildGantry(staticGroup, line, line.packX - 0.4)])

  // Pools the sim fills every frame.
  const palletPool = createInstances(palletFlat, 700, scene)
  const caseVariants = await Promise.all(['box_cardboard_c01', 'box_cardboard_c02', 'box_cardboard_c03'].map(async (name) => flattenModel(await loadModel(name))))
  const casePools = caseVariants.map((flat) => createInstances(flat, 9000, scene))
  const emptyStackPool = createInstances(palletFlat, 24, scene)

  // Forklifts: split into what stays on the chassis, the moving mast stage, and the cab with forks.
  const forkliftRoot = await loadModel('vehicle_forklift_red_b01')
  const partOf = (node) => {
    let current = node
    while (current) {
      if (/^sm_lift/.test(current.name) || /^sm_hydraulicsystem/.test(current.name)) return 'stage'
      if (/^sm_(cabine|glass|button|switch|knob|lever|pedal)/.test(current.name)) return 'cab'
      if (/^sm_/.test(current.name)) return 'chassis'
      current = current.parent
    }
    return 'chassis'
  }
  const forkliftParts = {
    chassis: createInstances(flattenModel(forkliftRoot, (node) => partOf(node) === 'chassis'), sim.forklifts.length, scene),
    stage: createInstances(flattenModel(forkliftRoot, (node) => partOf(node) === 'stage'), sim.forklifts.length, scene),
    cab: createInstances(flattenModel(forkliftRoot, (node) => partOf(node) === 'cab'), sim.forklifts.length, scene),
  }

  return { floor, doors, gantries, palletPool, casePools, emptyStackPool, forkliftParts }
}

export const WORLD_CONSTANTS = { CONVEYOR_TOP, EMPTY_STACK }
