// Reads every GLB in public/assets and writes src/geometry.json: for each top-level node, its
// bounding box (in the node's own frame) and the local position of every child (anchors, pivots).
// Usage: node tools/extract_geometry.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appFolder = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsFolder = join(appFolder, 'public', 'assets')

function readGltf(file) {
  const buffer = readFileSync(file)
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'))
}

function quaternionRotate(quaternion, vector) {
  const [qx, qy, qz, qw] = quaternion
  const [vx, vy, vz] = vector
  const ix = qw * vx + qy * vz - qz * vy
  const iy = qw * vy + qz * vx - qx * vz
  const iz = qw * vz + qx * vy - qy * vx
  const iw = -qx * vx - qy * vy - qz * vz
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}

// Applies a node's local transform to a point: scale, rotate, translate.
function transformPoint(node, point) {
  const scale = node.scale ?? [1, 1, 1]
  const scaled = [point[0] * scale[0], point[1] * scale[1], point[2] * scale[2]]
  const rotated = node.rotation ? quaternionRotate(node.rotation, scaled) : scaled
  const translation = node.translation ?? [0, 0, 0]
  return [rotated[0] + translation[0], rotated[1] + translation[1], rotated[2] + translation[2]]
}

function boxCorners(min, max) {
  const corners = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z])
  return corners
}

// Collects mesh points of `nodeIndex` and its subtree, expressed in the frame of the root's parent chain
// starting below the root (the root's own transform is not applied).
function collectPoints(gltf, nodeIndex, applyOwn, points) {
  const node = gltf.nodes[nodeIndex]
  const local = []
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION]
      local.push(...boxCorners(accessor.min, accessor.max))
    }
  }
  for (const childIndex of node.children ?? []) collectPoints(gltf, childIndex, true, local)
  for (const point of local) points.push(applyOwn ? transformPoint(node, point) : point)
}

const round = (value) => Math.round(value * 1000) / 1000
const output = {}
for (const fileName of readdirSync(assetsFolder).filter((name) => name.endsWith('.glb'))) {
  const gltf = readGltf(join(assetsFolder, fileName))
  for (const rootIndex of gltf.scenes[0].nodes) {
    const root = gltf.nodes[rootIndex]
    const points = []
    collectPoints(gltf, rootIndex, false, points)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const point of points) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis])
        max[axis] = Math.max(max[axis], point[axis])
      }
    }
    const children = {}
    for (const childIndex of root.children ?? []) {
      const child = gltf.nodes[childIndex]
      const childPoints = []
      collectPoints(gltf, childIndex, true, childPoints)
      const childMin = [0, 1, 2].map((axis) => Math.min(...childPoints.map((point) => point[axis])))
      const childMax = [0, 1, 2].map((axis) => Math.max(...childPoints.map((point) => point[axis])))
      children[child.name] = {
        position: (child.translation ?? [0, 0, 0]).map(round),
        ...(child.rotation ? { rotation: child.rotation.map(round) } : {}),
        ...(childPoints.length ? { min: childMin.map(round), max: childMax.map(round) } : {}),
      }
    }
    output[root.name] = { file: fileName, min: min.map(round), max: max.map(round), children }
  }
}
writeFileSync(join(appFolder, 'src', 'geometry.json'), JSON.stringify(output, null, 1))
console.log(`${Object.keys(output).length} nodes written`)
