// Window and door joinery laid over the app's building models, whose windows are single glowing boxes.
// Every window box (24 vertices, axis-aligned in its mesh's space) gets a frame, mullions and muntins, so the
// light shows through panes; a wide shop window also gets a transom bar and a solid bulkhead below the glass.
// Doors get a static casing in the wall and raised panels on the leaf, which swing with the door.
// Added meshes carry userData.joinery, so edge highlights skip them.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const FRAME_MATERIAL = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.8 })
const PANEL_MATERIAL = new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.75 })
const BAR = 0.07
const MUNTIN = 0.035
const STOREFRONT_WIDTH = 2.0

// A box between two corners in a frame where `along` is the window's horizontal axis, `normal` its thin axis.
function bar(geometries, centre, axes, size) {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const scale = new THREE.Vector3()
  scale.setComponent(axes.along, size.along)
  scale.setComponent(1, size.up)
  scale.setComponent(axes.normal, size.depth)
  geometry.scale(scale.x, scale.y, scale.z)
  geometry.translate(centre.x, centre.y, centre.z)
  geometries.push(geometry)
}

function windowBars(box, geometries) {
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const normal = size.x < size.z ? 0 : 2
  const along = normal === 0 ? 2 : 0
  const axes = { along, normal }
  const width = size.getComponent(along)
  const height = size.y
  const depth = size.getComponent(normal) + 0.06
  const at = (offsetAlong, offsetUp) => {
    const point = centre.clone()
    point.setComponent(along, point.getComponent(along) + offsetAlong)
    point.y += offsetUp
    return point
  }
  // Frame on all four sides.
  bar(geometries, at(0, height / 2), axes, { along: width + BAR * 2, up: BAR, depth })
  bar(geometries, at(0, -height / 2), axes, { along: width + BAR * 3, up: BAR * 1.4, depth: depth + 0.06 })
  bar(geometries, at(-width / 2, 0), axes, { along: BAR, up: height, depth })
  bar(geometries, at(width / 2, 0), axes, { along: BAR, up: height, depth })
  if (width > STOREFRONT_WIDTH) {
    // Shop window: mullions about every metre, a transom bar, and a bulkhead when the glass comes low.
    const columns = Math.max(2, Math.round(width / 1.0))
    for (let index = 1; index < columns; index++) bar(geometries, at(-width / 2 + (width * index) / columns, 0), axes, { along: BAR * 0.8, up: height, depth })
    bar(geometries, at(0, height * 0.28), axes, { along: width, up: BAR, depth })
    if (box.min.y < 0.9) {
      const bulkhead = Math.min(0.5, height * 0.2)
      bar(geometries, at(0, -height / 2 + bulkhead / 2), axes, { along: width, up: bulkhead, depth: depth + 0.04 })
    }
    return
  }
  // Sash window: a centre mullion, a heavier meeting rail and a muntin in each sash.
  if (width > 0.5) bar(geometries, at(0, 0), axes, { along: MUNTIN, up: height, depth })
  bar(geometries, at(0, 0), axes, { along: width, up: MUNTIN * 1.8, depth })
  if (height > 0.9) {
    bar(geometries, at(0, height / 4), axes, { along: width, up: MUNTIN, depth })
    bar(geometries, at(0, -height / 4), axes, { along: width, up: MUNTIN, depth })
  }
}

// One box per pane: vertices are grouped by position into connected pieces (faces share corner positions even
// where the exporter split the vertices), so the order of the vertex buffer does not matter.
function paneBoxes(geometry) {
  const positions = geometry.attributes.position
  const parent = new Int32Array(positions.count).map((_, index) => index)
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const join = (first, second) => {
    parent[find(first)] = find(second)
  }
  const byPosition = new Map()
  for (let index = 0; index < positions.count; index++) {
    const key = `${positions.getX(index).toFixed(3)},${positions.getY(index).toFixed(3)},${positions.getZ(index).toFixed(3)}`
    if (byPosition.has(key)) join(index, byPosition.get(key))
    else byPosition.set(key, index)
  }
  const triangleIndex = geometry.index
  if (triangleIndex) {
    for (let corner = 0; corner + 2 < triangleIndex.count; corner += 3) {
      join(triangleIndex.getX(corner), triangleIndex.getX(corner + 1))
      join(triangleIndex.getX(corner), triangleIndex.getX(corner + 2))
    }
  } else {
    for (let corner = 0; corner + 2 < positions.count; corner += 3) {
      join(corner, corner + 1)
      join(corner, corner + 2)
    }
  }
  const boxes = new Map()
  const point = new THREE.Vector3()
  for (let index = 0; index < positions.count; index++) {
    const root = find(index)
    if (!boxes.has(root)) boxes.set(root, new THREE.Box3())
    boxes.get(root).expandByPoint(point.fromBufferAttribute(positions, index))
  }
  return [...boxes.values()]
}

function glazingMesh(mesh) {
  const geometries = []
  for (const box of paneBoxes(mesh.geometry)) {
    const size = box.getSize(new THREE.Vector3())
    // Only flat panes: skip anything thick in both horizontal axes (not a window).
    if (Math.min(size.x, size.z) > 0.2) continue
    windowBars(box, geometries)
  }
  if (!geometries.length) return null
  const frames = new THREE.Mesh(mergeGeometries(geometries), FRAME_MATERIAL)
  frames.castShadow = true
  frames.receiveShadow = true
  frames.userData.joinery = true
  return frames
}

// Frames every lit (window_warm) and unlit (glass_dark) window box under `root`.
export function frameGlazing(root) {
  const meshes = []
  root.traverse((object) => {
    const name = object.material?.name ?? ''
    if (object.isMesh && object.visible && object.material.visible !== false && !object.userData.joinery && (name.startsWith('window_warm') || name.startsWith('glass_dark'))) meshes.push(object)
  })
  for (const mesh of meshes) {
    const frames = glazingMesh(mesh)
    if (frames) mesh.add(frames)
  }
  return root
}

// Replaces a model door with one clean door: the original leaf and lite are hidden (their stacked, coplanar
// faces flickered), and a single leaf is built in their place, with raised panels proud of each face, glass
// only in an upper lite when the original had one (the same material, so its light still changes), one muntin
// cross in front of the glass, and a static casing in the wall. Every layer sits a few centimetres off the next.
export function panelDoor(door) {
  if (!door || door.userData.panelled) return
  door.userData.panelled = true
  const box = new THREE.Box3()
  let woodMaterial = PANEL_MATERIAL
  let glassMaterial = null
  door.traverse((child) => {
    if (!child.isMesh) return
    child.geometry.computeBoundingBox()
    const matrix = child === door ? new THREE.Matrix4() : child.matrix
    box.union(child.geometry.boundingBox.clone().applyMatrix4(matrix))
    const name = child.material.name ?? ''
    if (name.startsWith('window_warm') || name.startsWith('glass_dark')) glassMaterial = child.material
    else woodMaterial = child.material
    // Hide the original through a hidden material, so a door that is itself a mesh keeps its children.
    child.material = child.material.clone()
    child.material.visible = false
    child.userData.joinery = true
  })
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const normal = size.x < size.z ? 0 : 2
  const along = normal === 0 ? 2 : 0
  const axes = { along, normal }
  const width = size.getComponent(along)
  const height = size.y
  // 5 cm thicker than the model door on each side, so the leaf stands clear of a shop window or frame behind it.
  const depth = Math.max(0.05, size.getComponent(normal)) + 0.1
  const at = (offsetAlong, offsetUp, offsetNormal = 0) => {
    const point = centre.clone()
    point.setComponent(along, point.getComponent(along) + offsetAlong)
    point.setComponent(normal, point.getComponent(normal) + offsetNormal)
    point.y += offsetUp
    return point
  }
  const addMesh = (geometries, material, parent) => {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material)
    mesh.userData.joinery = true
    mesh.castShadow = true
    parent.add(mesh)
  }
  const leaf = []
  bar(leaf, at(0, 0), axes, { along: width, up: height, depth })
  addMesh(leaf, woodMaterial, door)
  // Raised panels: two pairs low on the leaf, and one wide panel high up when there is no glass.
  const panels = []
  const panelDepth = 0.024
  for (const face of [-1, 1]) {
    const proud = face * (depth / 2 + panelDepth / 2 + 0.004)
    for (const side of [-1, 1]) {
      for (const level of [-0.34, -0.1]) bar(panels, at((side * width) / 4.4, height * level, proud), axes, { along: width * 0.34, up: height * 0.19, depth: panelDepth })
    }
    if (!glassMaterial) bar(panels, at(0, height * 0.24, proud), axes, { along: width * 0.76, up: height * 0.3, depth: panelDepth })
  }
  addMesh(panels, PANEL_MATERIAL, door)
  if (glassMaterial) {
    const liteWidth = width * 0.62
    const liteHeight = height * 0.3
    const liteUp = height * 0.24
    const glass = []
    const muntins = []
    for (const face of [-1, 1]) {
      bar(glass, at(0, liteUp, face * (depth / 2 + 0.006)), axes, { along: liteWidth, up: liteHeight, depth: 0.012 })
      const front = face * (depth / 2 + 0.024)
      bar(muntins, at(0, liteUp, front), axes, { along: MUNTIN, up: liteHeight, depth: 0.02 })
      bar(muntins, at(0, liteUp, front), axes, { along: liteWidth, up: MUNTIN, depth: 0.02 })
      bar(muntins, at(0, liteUp + liteHeight / 2, front), axes, { along: liteWidth + 0.08, up: 0.04, depth: 0.02 })
      bar(muntins, at(0, liteUp - liteHeight / 2, front), axes, { along: liteWidth + 0.08, up: 0.04, depth: 0.02 })
      bar(muntins, at(-liteWidth / 2, liteUp, front), axes, { along: 0.04, up: liteHeight, depth: 0.02 })
      bar(muntins, at(liteWidth / 2, liteUp, front), axes, { along: 0.04, up: liteHeight, depth: 0.02 })
    }
    addMesh(glass, glassMaterial, door)
    addMesh(muntins, FRAME_MATERIAL, door)
  }
  // The casing sits in the door's rest frame on its parent, so it stays put when the leaf swings. It stands
  // 8 cm proud of the leaf on both sides and leaves a 1 cm gap at the jambs, so no face meets the leaf's.
  const casing = []
  const casingDepth = depth + 0.16
  bar(casing, at(0, height / 2 + 0.09), axes, { along: width + 0.44, up: 0.16, depth: casingDepth })
  bar(casing, at(-width / 2 - 0.085, 0.04), axes, { along: 0.15, up: height + 0.08, depth: casingDepth })
  bar(casing, at(width / 2 + 0.085, 0.04), axes, { along: 0.15, up: height + 0.08, depth: casingDepth })
  const rest = new THREE.Group()
  rest.position.copy(door.position)
  rest.quaternion.copy(door.quaternion)
  addMesh(casing, FRAME_MATERIAL, rest)
  door.parent.add(rest)
}
