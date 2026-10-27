// Prints each GLB root's translation and its local bounding box, plus anchor empties, so the app can place models.
// Usage: node tools/bbox.mjs [name filter]
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets')
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null

function nodeMatrix(node) {
  const matrix = new THREE.Matrix4()
  if (node.matrix) return matrix.fromArray(node.matrix)
  const translation = new THREE.Vector3(...(node.translation || [0, 0, 0]))
  const rotation = new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1]))
  const scale = new THREE.Vector3(...(node.scale || [1, 1, 1]))
  return matrix.compose(translation, rotation, scale)
}

for (const file of readdirSync(assets).filter((name) => name.endsWith('.glb'))) {
  const buffer = readFileSync(join(assets, file))
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'))
  for (const rootIndex of gltf.scenes[0].nodes) {
    const root = gltf.nodes[rootIndex]
    if (filter && !filter.test(root.name)) continue
    const box = new THREE.Box3()
    const anchors = []
    const walk = (index, parentMatrix) => {
      const node = gltf.nodes[index]
      const matrix = parentMatrix.clone().multiply(nodeMatrix(node))
      if (node.mesh !== undefined) {
        for (const primitive of gltf.meshes[node.mesh].primitives) {
          const accessor = gltf.accessors[primitive.attributes.POSITION]
          const local = new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max))
          box.union(local.applyMatrix4(matrix))
        }
      } else if (index !== rootIndex && !(node.children || []).length) {
        const position = new THREE.Vector3().setFromMatrixPosition(matrix)
        anchors.push(`${node.name.replace(root.name + '_', '')}(${position.toArray().map((value) => value.toFixed(2)).join(',')})`)
      }
      for (const child of node.children || []) walk(child, matrix)
    }
    walk(rootIndex, new THREE.Matrix4())
    const f = (vector) => vector.toArray().map((value) => value.toFixed(2)).join(',')
    console.log(`${root.name} t=[${(root.translation || [0, 0, 0]).map((value) => value.toFixed(1))}] min=[${f(box.min)}] max=[${f(box.max)}] ${anchors.slice(0, 8).join(' ')}`)
  }
}
