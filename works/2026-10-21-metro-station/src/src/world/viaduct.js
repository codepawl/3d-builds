import * as THREE from 'three'

// Continuous viaduct deck: one cross-section swept along the lane centreline, so curves have no overlapping or gapped
// span instances (the GLB Viaduct_Span is a straight 30 m piece and doubled its deck and parapets in curves).
// Cross-section numbers come from the GLB: girder box -2..0 (half width 4.8), deck cap 0..0.2 (4.25), parapet base
// 0..0.7 (4.5..4.8), glass 0.7..1.7 (at 4.7), steel top rail 1.7..1.76.
const SAMPLE_STEP = 1.5

const SECTIONS = [
  { material: 'concrete', polygon: [[-4.8, -2], [4.8, -2], [4.8, 0], [-4.8, 0]] },
  { material: 'body_grey', polygon: [[-4.25, 0.004], [4.25, 0.004], [4.25, 0.2], [-4.25, 0.2]] },
  { material: 'concrete_dark', polygon: [[4.5, 0], [4.8, 0], [4.8, 0.7], [4.5, 0.7]] },
  { material: 'concrete_dark', polygon: [[-4.8, 0], [-4.5, 0], [-4.5, 0.7], [-4.8, 0.7]] },
  { material: 'steel', polygon: [[4.6, 1.7], [4.8, 1.7], [4.8, 1.76], [4.6, 1.76]] },
  { material: 'steel', polygon: [[-4.8, 1.7], [-4.6, 1.7], [-4.6, 1.76], [-4.8, 1.76]] },
]
const GLASS_LATERALS = [4.7, -4.7]
const GLASS_BOTTOM = 0.7
const GLASS_TOP = 1.7

function buildStrip(samples, points, materialIndexOffset) {
  void materialIndexOffset
  const positions = []
  const normals = []
  const indices = []
  // points: [{ lateral, height, normalLateral, normalHeight }] describing a polyline; one quad strip per consecutive pair.
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    const first = points[pointIndex]
    const second = points[pointIndex + 1]
    const edgeLateral = second.lateral - first.lateral
    const edgeHeight = second.height - first.height
    const length = Math.hypot(edgeLateral, edgeHeight) || 1
    const normalLateral = edgeHeight / length
    const normalHeight = -edgeLateral / length
    const base = positions.length / 3
    samples.forEach((sample) => {
      ;[first, second].forEach((point) => {
        positions.push(sample.x + sample.normalX * point.lateral, sample.y + point.height, sample.z + sample.normalZ * point.lateral)
        normals.push(sample.normalX * normalLateral, normalHeight, sample.normalZ * normalLateral)
      })
    })
    for (let index = 0; index < samples.length - 1; index += 1) {
      const a = base + index * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  return { positions, normals, indices }
}

function toGeometry(parts) {
  const positions = []
  const normals = []
  const indices = []
  parts.forEach((part) => {
    const offset = positions.length / 3
    positions.push(...part.positions)
    normals.push(...part.normals)
    part.indices.forEach((index) => indices.push(index + offset))
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

// path: PathSampler; offset: lane offset along the left normal; deckY: height of the deck top; materials: by GLB name.
export function buildViaductDeck({ path, offset, deckY, materials }) {
  const samples = []
  const count = Math.ceil(path.length / SAMPLE_STEP)
  for (let index = 0; index <= count; index += 1) {
    const sample = path.at((index / count) * path.length)
    const normalX = sample.tz
    const normalZ = -sample.tx
    samples.push({ x: sample.x + normalX * offset, z: sample.z + normalZ * offset, y: deckY, normalX, normalZ })
  }
  const group = new THREE.Group()
  const byMaterial = new Map()
  SECTIONS.forEach((section) => {
    const closed = [...section.polygon, section.polygon[0]].map(([lateral, height]) => ({ lateral, height }))
    const strip = buildStrip(samples, closed)
    if (!byMaterial.has(section.material)) byMaterial.set(section.material, [])
    byMaterial.get(section.material).push(strip)
  })
  GLASS_LATERALS.forEach((lateral) => {
    const strip = buildStrip(samples, [{ lateral, height: GLASS_BOTTOM }, { lateral, height: GLASS_TOP }])
    if (!byMaterial.has('NoiseGlass')) byMaterial.set('NoiseGlass', [])
    byMaterial.get('NoiseGlass').push(strip)
  })
  byMaterial.forEach((strips, name) => {
    const source = materials[name]
    if (!source) return
    const material = source.clone()
    material.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(toGeometry(strips), material)
    mesh.castShadow = name !== 'NoiseGlass'
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    if (name === 'NoiseGlass') mesh.renderOrder = 5
    group.add(mesh)
  })
  return group
}
