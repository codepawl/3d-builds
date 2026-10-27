// Prints triangle counts per root node and material names for each GLB (dev aid).
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const assets = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'assets')
for (const file of readdirSync(assets).filter((name) => name.endsWith('.glb'))) {
  const buffer = readFileSync(join(assets, file))
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'))
  const triangles = (meshIndex) => json.meshes[meshIndex].primitives.reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0)
  const count = (index) => { const node = json.nodes[index]; return (node.mesh !== undefined ? triangles(node.mesh) : 0) + (node.children || []).reduce((sum, child) => sum + count(child), 0) }
  console.log(file, 'materials:', json.materials.map((material) => material.name).join(','))
  for (const index of json.scenes[0].nodes) console.log('  ', json.nodes[index].name, Math.round(count(index)), 'tris', 'pos', JSON.stringify(json.nodes[index].translation || [0,0,0]))
}
