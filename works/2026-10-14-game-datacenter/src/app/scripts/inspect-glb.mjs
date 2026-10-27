// Lists every GLB in public/assets: root nodes, their children and triangle counts. Usage: node scripts/inspect-glb.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const assetDirectory = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public', 'assets')

function readGltfJson(file) {
  const buffer = readFileSync(file)
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'))
}

function triangles(gltf, nodeIndex) {
  const node = gltf.nodes[nodeIndex]
  let count = 0
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) count += gltf.accessors[primitive.indices].count / 3
  }
  for (const child of node.children ?? []) count += triangles(gltf, child)
  return count
}

let totalBytes = 0
for (const name of readdirSync(assetDirectory).filter((file) => file.endsWith('.glb'))) {
  const file = path.join(assetDirectory, name)
  const gltf = readGltfJson(file)
  totalBytes += statSync(file).size
  console.log(`${name}  ${(statSync(file).size / 1024).toFixed(0)} KB  ${gltf.materials?.length ?? 0} materials  ${gltf.images?.length ?? 0} images`)
  for (const root of gltf.scenes[0].nodes) {
    const node = gltf.nodes[root]
    const children = (node.children ?? []).map((child) => gltf.nodes[child].name).join(', ')
    console.log(`  ${node.name}  ${triangles(gltf, root)} tris${children ? `  [${children}]` : ''}`)
  }
}
console.log(`total ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
