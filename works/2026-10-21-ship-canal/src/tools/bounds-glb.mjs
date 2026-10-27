import fs from 'node:fs'
const buf = fs.readFileSync(process.argv[2])
const jsonLength = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLength).toString())
const only = process.argv.slice(3)
function meshBounds(meshIndex) {
  let min = [1e9,1e9,1e9], max = [-1e9,-1e9,-1e9]
  for (const p of json.meshes[meshIndex].primitives) {
    const a = json.accessors[p.attributes.POSITION]
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a.min[k]); max[k] = Math.max(max[k], a.max[k]) }
  }
  return { min, max }
}
function bounds(i) {
  const n = json.nodes[i]
  let min = [1e9,1e9,1e9], max = [-1e9,-1e9,-1e9]
  const off = n.translation || [0,0,0]
  if (n.mesh !== undefined) { const b = meshBounds(n.mesh); for (let k=0;k<3;k++){min[k]=Math.min(min[k],b.min[k]);max[k]=Math.max(max[k],b.max[k])} }
  for (const c of n.children || []) { const b = bounds(c); for (let k=0;k<3;k++){min[k]=Math.min(min[k],b.min[k]);max[k]=Math.max(max[k],b.max[k])} }
  return { min: min.map((v,k)=>v+off[k]), max: max.map((v,k)=>v+off[k]) }
}
for (const r of json.scenes[0].nodes) {
  const n = json.nodes[r]
  if (only.length && !only.includes(n.name)) continue
  const off = n.translation || [0,0,0]
  const b = bounds(r)
  const f = a => a.map(v => (+v).toFixed(2)).join(',')
  // subtract root offset so bounds are local to root
  console.log(n.name.padEnd(20), 'min', f(b.min.map((v,k)=>v-off[k])), 'max', f(b.max.map((v,k)=>v-off[k])))
}
