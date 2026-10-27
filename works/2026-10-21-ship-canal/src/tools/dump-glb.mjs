import fs from 'node:fs'
const file = process.argv[2]
const buf = fs.readFileSync(file)
const jsonLength = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLength).toString())
const nodes = json.nodes
const sceneRoots = json.scenes[0].nodes
function walk(i, depth, maxDepth) {
  const n = nodes[i]
  const t = n.translation ? n.translation.map(v => +v.toFixed(2)).join(',') : ''
  const kids = n.children ? n.children.length : 0
  if (depth <= maxDepth) console.log(' '.repeat(depth * 2) + n.name + (n.mesh !== undefined ? ' [mesh]' : '') + (n.skin !== undefined ? ' [skin]' : '') + ' t=' + t + (kids ? ' kids=' + kids : ''))
  if (depth < maxDepth && n.children) n.children.forEach(c => walk(c, depth + 1, maxDepth))
}
const maxDepth = Number(process.argv[3] || 1)
sceneRoots.forEach(r => walk(r, 0, maxDepth))
console.log('animations', (json.animations || []).map(a => a.name + ':' + a.channels.length))
console.log('materials', (json.materials || []).map(m => m.name).join(' | '))
