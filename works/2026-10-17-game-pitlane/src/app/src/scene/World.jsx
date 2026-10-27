// Everything that does not move on a circuit: ground, track ribbon, kerbs, barriers, pit lane surface and markings,
// garages, paddock, grandstands and scenery. Repeats are instanced.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GARAGE_TEAMS, LAYOUT, TEAMS, garageX } from '../data.js'
import { buildPath, seededRandom } from '../sim.js'
import { boxFillMaterial, cityBlockMaterial, lightPoolMaterial, streetLampMaterials, surfaces } from './materials.js'
import { Instanced } from './assets.jsx'
import { selectEntity } from '../store.js'

// A flat ribbon along a path; UVs run in metres divided by `tile`.
function ribbonGeometry(path, halfWidth, y, tile = 10, offset = 0, from = 0, to = path.length, step = 2) {
  const positions = []
  const uvs = []
  const indices = []
  let row = 0
  for (let distance = from; distance <= to + 0.001; distance += step) {
    const point = path.at(Math.min(distance, path.length - 0.001))
    const normalX = Math.cos(point.heading)
    const normalZ = -Math.sin(point.heading)
    for (const side of [-1, 1]) {
      const lateral = offset + side * halfWidth
      positions.push(point.x + normalX * lateral, y, point.z + normalZ * lateral)
      uvs.push((side * halfWidth + offset) / tile, distance / tile)
    }
    if (row > 0) {
      const base = (row - 1) * 2
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
    row++
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function rectGeometry(minX, maxX, minZ, maxZ, y, tile = 10) {
  const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, y, (minZ + maxZ) / 2)
  const uv = geometry.attributes.uv
  for (let index = 0; index < uv.count; index++) uv.setXY(index, (uv.getX(index) * (maxX - minX)) / tile, (uv.getY(index) * (maxZ - minZ)) / tile)
  return geometry
}

function Rect({ bounds, y, material, tile = 10, receiveShadow = true }) {
  const geometry = useMemo(() => rectGeometry(...bounds, y, tile), [bounds, y, tile])
  return <mesh geometry={geometry} material={material} receiveShadow={receiveShadow} />
}

// Lane paint: thin rectangles from a list of [minX, maxX, minZ, maxZ].
function PaintStrips({ strips, material, y = 0.05 }) {
  const geometry = useMemo(() => {
    const parts = strips.map((bounds) => rectGeometry(...bounds, y, 1))
    const merged = mergeGeometries(parts)
    parts.forEach((part) => part.dispose())
    return merged
  }, [strips, y])
  return <mesh geometry={geometry} material={material} receiveShadow />
}

function mergeGeometries(geometries) {
  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  let offset = 0
  for (const geometry of geometries) {
    const index = geometry.index.array
    positions.push(...geometry.attributes.position.array)
    normals.push(...geometry.attributes.normal.array)
    uvs.push(...geometry.attributes.uv.array)
    for (const value of index) indices.push(value + offset)
    offset += geometry.attributes.position.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  merged.setIndex(indices)
  return merged
}

const nearStraight = (point) => Math.abs(point.x) < 182 && Math.abs(point.z - LAYOUT.straightZ) < 4

function Track({ state }) {
  const material = surfaces(state.site.night)
  const { track, site } = state
  const geometries = useMemo(() => {
    const runoff = site.kind === 'street' ? 0 : site.kind === 'desert' ? 26 : 22
    return {
      asphalt: ribbonGeometry(track, LAYOUT.trackWidth / 2, 0.03, 8),
      runoff: runoff ? ribbonGeometry(track, runoff / 2, 0.012, 8) : null,
      lines: [-1, 1].map((side) => ribbonGeometry(track, 0.18, 0.045, 1, side * (LAYOUT.trackWidth / 2 - 0.35))),
    }
  }, [track, site.kind])
  const placements = useMemo(() => {
    const kerbs = []
    const barriers = []
    const fences = []
    const random = seededRandom(site.seed)
    for (let distance = 0; distance < track.length; distance += 6) {
      const point = track.at(distance)
      if (state.speedAt(distance) < 52 && !nearStraight(point)) {
        for (const side of [-1, 1]) {
          const lateral = side * (LAYOUT.trackWidth / 2 + 0.6)
          kerbs.push({ x: point.x + Math.cos(point.heading) * lateral, z: point.z - Math.sin(point.heading) * lateral, heading: point.heading })
        }
      }
    }
    const barrierOffset = site.kind === 'street' ? 9.5 : 15
    for (let distance = 0; distance < track.length; distance += 4) {
      const point = track.at(distance)
      for (const side of [-1, 1]) {
        if (nearStraight(point)) continue
        const lateral = side * barrierOffset
        const x = point.x + Math.cos(point.heading) * lateral
        const z = point.z - Math.sin(point.heading) * lateral
        if (x > -175 && x < 180 && z > -12 && z < 12) continue
        barriers.push({ x, z, heading: point.heading + Math.PI / 2 + (side > 0 ? Math.PI : 0) })
      }
    }
    for (let x = -177; x <= 177; x += 6) fences.push({ x, z: -17.5, heading: Math.PI })
    void random
    return { kerbs, barriers, fences }
  }, [track, site, state])
  return (
    <group>
      <mesh geometry={geometries.asphalt} material={material.asphalt} receiveShadow />
      {geometries.runoff && <mesh geometry={geometries.runoff} material={site.kind === 'desert' ? material.gravel : material.verge} receiveShadow />}
      {geometries.lines.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={material.paint} receiveShadow />
      ))}
      <Instanced name="kerb_straight" items={placements.kerbs} castShadow={false} />
      <Instanced name={site.barrier} items={placements.barriers} castShadow={false} />
      <Instanced name="debris_fence" items={placements.fences} castShadow={false} />
    </group>
  )
}

function PitLane({ state }) {
  const material = surfaces(state.site.night)
  const ramps = useMemo(() => {
    const lane = LAYOUT.fastLaneZ
    const entry = buildPath([[LAYOUT.entryX, LAYOUT.straightZ], [-140, -6.4], [-120, -1.6], [-104, 4.2], [-90, lane], [-80, lane]], false, 1)
    const exit = buildPath([[80, lane], [90, lane], [104, 4.2], [120, -1.6], [140, -6.4], [LAYOUT.exitX, LAYOUT.straightZ]], false, 1)
    return [entry, exit].map((path) => ({ surface: ribbonGeometry(path, 4.2, 0.028, 8, 0, 4), lines: [-1, 1].map((side) => ribbonGeometry(path, 0.12, 0.046, 1, side * 4.0, 18)) }))
  }, [])
  const markings = useMemo(() => {
    const white = []
    const yellow = []
    // Working-lane line, dashed, and the solid pit-wall edge.
    for (let x = -90; x < 90; x += 4) white.push([x, x + 2.2, 9.95, 10.12])
    white.push([-92, 92, 3.4, 3.55])
    white.push([-82, 82, 17.9, 18.05])
    for (const x of [-LAYOUT.pitLimitX, LAYOUT.pitLimitX]) white.push([x - 0.25, x + 0.25, 3.4, 10])
    for (let index = 0; index < LAYOUT.garageCount; index++) {
      const x = garageX(index)
      white.push([x - 4.6, x + 4.6, 10.4, 10.55], [x - 4.6, x + 4.6, 17.45, 17.6], [x - 4.6, x - 4.45, 10.4, 17.6], [x + 4.45, x + 4.6, 10.4, 17.6])
      if (GARAGE_TEAMS[index]) {
        // Wheel and jack marks for the stop crew.
        for (const axle of [1.7, -1.7]) for (const side of [1, -1]) yellow.push([x + axle - 0.4, x + axle + 0.4, 14 + side * 1.25 - 0.06, 14 + side * 1.25 + 0.06])
        yellow.push([x + 2.6, x + 2.75, 13.4, 14.6], [x - 2.55, x - 2.4, 13.4, 14.6])
      }
    }
    return { white, yellow }
  }, [])
  const boxFills = useMemo(() => Object.entries(GARAGE_TEAMS).map(([index, team]) => ({ x: garageX(Number(index)), material: boxFillMaterial(TEAMS[team].color) })), [])
  const pitWalls = useMemo(() => Array.from({ length: 14 }, (_, index) => ({ x: -78 + index * 12, z: LAYOUT.pitWallZ, heading: 0 })), [])
  const garages = useMemo(() => {
    const groups = {}
    for (const item of state.statics.filter((candidate) => candidate.type === 'garage')) (groups[item.node] ??= []).push(item)
    return groups
  }, [state])
  return (
    <group>
      <Rect bounds={[-92, 92, 0.2, 18]} y={0.026} material={material.pitAsphalt} tile={8} />
      <Rect bounds={[-92, 92, 0.2, 3.4]} y={0.03} material={material.concrete} tile={6} />
      <Rect bounds={[-110, 110, 18, 92]} y={0.022} material={material.paddock} tile={12} />
      {ramps.map((ramp, index) => (
        <group key={index}>
          <mesh geometry={ramp.surface} material={material.pitAsphalt} receiveShadow />
          {ramp.lines.map((geometry, lineIndex) => (
            <mesh key={lineIndex} geometry={geometry} material={material.paint} />
          ))}
        </group>
      ))}
      <PaintStrips strips={markings.white} material={material.paint} />
      <PaintStrips strips={markings.yellow} material={material.yellowPaint} y={0.052} />
      {boxFills.map((fill) => (
        <Rect key={fill.x} bounds={[fill.x - 4.45, fill.x + 4.45, 10.55, 17.45]} y={0.048} material={fill.material} tile={10} receiveShadow={false} />
      ))}
      <Instanced name="pit_wall_section" items={pitWalls} />
      {Object.entries(garages).map(([node, items]) => (
        <Instanced key={node} name={node} items={items} onPick={(event, item) => selectEntity(event, item.id)} />
      ))}
      <Instanced name="start_gantry" items={[{ x: 0, z: LAYOUT.straightZ, heading: Math.PI / 2 }]} />
      <Instanced name="drs_board" items={[{ x: -150, z: -16.4, heading: 0 }, { x: 60, z: -16.4, heading: 0 }]} />
    </group>
  )
}

// Paddock, grandstands and other pickable statics that are not animated.
function Statics({ state }) {
  const groups = useMemo(() => {
    const result = {}
    for (const item of state.statics) {
      if (!['truck', 'hospitality', 'stand', 'grandstand', 'rack'].includes(item.type)) continue
      ;(result[item.node] ??= []).push(item)
    }
    return result
  }, [state])
  return Object.entries(groups).map(([node, items]) => <Instanced key={node} name={node} items={items} onPick={(event, item) => selectEntity(event, item.id)} />)
}

// Trees, palms or rocks scattered outside the track corridor and the pit complex; billboards and lights.
function Scenery({ state }) {
  const { site, track } = state
  const placements = useMemo(() => {
    const random = seededRandom(site.seed * 13)
    const samples = []
    for (let distance = 0; distance < track.length; distance += 8) samples.push(track.at(distance))
    const clear = (x, z, margin) => samples.every((point) => (point.x - x) ** 2 + (point.z - z) ** 2 > margin * margin)
    const byNode = Object.fromEntries(site.scenery.map((node) => [node, []]))
    let attempts = 0
    const target = site.kind === 'desert' ? 220 : site.kind === 'street' ? 130 : 180
    let placed = 0
    while (placed < target && attempts < 6000) {
      attempts++
      const x = (random() - 0.5) * 640
      const z = -260 + random() * 380
      if (x > -125 && x < 125 && z > -40 && z < 98) continue
      if (!clear(x, z, site.kind === 'street' ? 14 : 22)) continue
      const node = site.scenery[Math.floor(random() * site.scenery.length)]
      byNode[node].push({ x, z, heading: random() * Math.PI * 2, scale: 0.8 + random() * 0.5 })
      placed++
    }
    // A row along the paddock edge so the pit complex does not end in bare ground.
    for (let x = -120; x <= 120; x += 15) {
      const node = site.scenery[Math.abs(Math.round(x / 15)) % site.scenery.length]
      byNode[node].push({ x, z: 98 + (Math.abs(x) % 4), heading: x, scale: 1 })
    }
    const lights = []
    if (site.night) {
      for (let distance = 0; distance < track.length; distance += 46) {
        const point = track.at(distance)
        if (nearStraight(point)) continue
        lights.push({ x: point.x + Math.cos(point.heading) * 12, z: point.z - Math.sin(point.heading) * 12, heading: point.heading - Math.PI / 2, poolX: point.x + Math.cos(point.heading) * 3, poolZ: point.z - Math.sin(point.heading) * 3 })
      }
      for (let x = -150; x <= 150; x += 30) lights.push({ x, z: -20, heading: Math.PI, poolX: x, poolZ: -9 })
    }
    const boards = []
    for (let x = -165; x <= 165; x += 55) boards.push({ x, z: -40, heading: 0 })
    return { byNode, lights, boards }
  }, [site, track])
  return (
    <group>
      {Object.entries(placements.byNode).map(([node, items]) => items.length > 0 && <Instanced key={node} name={node} items={items} />)}
      {placements.lights.length > 0 && <Instanced name="floodlight_pole" items={placements.lights} />}
      {placements.lights.length > 0 && <LightPools lights={placements.lights} />}
      <Instanced name="billboard" items={placements.boards} castShadow={false} />
      {site.night && <CityBlocks state={state} />}
      {site.night && <StreetLamps state={state} />}
    </group>
  )
}

// Floodlit ground under each pole and along the pit lane at night.
function LightPools({ lights }) {
  const material = lightPoolMaterial()
  const geometry = useMemo(() => {
    const parts = []
    const add = (x, z, radius) => {
      const plane = new THREE.PlaneGeometry(radius * 2, radius * 2)
      plane.rotateX(-Math.PI / 2)
      plane.translate(x, 0.07, z)
      parts.push(plane)
    }
    for (const light of lights) add(light.poolX, light.poolZ, 11)
    for (let x = -84; x <= 84; x += 14) add(x, 12, 9)
    for (let x = -90; x <= 90; x += 30) add(x, 50, 14)
    const merged = mergeGeometries(parts)
    parts.forEach((part) => part.dispose())
    return merged
  }, [lights])
  return <mesh geometry={geometry} material={material} renderOrder={2} />
}

function Ground({ state }) {
  const material = surfaces(state.site.night)
  const { site } = state
  const base = site.ground === 'grass' ? material.grass : site.ground === 'sand' ? material.sand : material.city
  const tile = site.ground === 'city' ? 24 : 20
  return (
    <group>
      <Rect bounds={[-900, 900, -700, 700]} y={0} material={base} tile={tile} />
      {site.kind === 'street' && <Rect bounds={[-900, 900, -700, -235]} y={0.05} material={material.water} tile={40} />}
      {site.kind === 'street' && <Rect bounds={[-900, 900, -238, -232]} y={0.02} material={material.concrete} tile={6} />}
    </group>
  )
}

// Nothing under the world moves, so its matrices are computed once and the per-frame update skips the subtree.
function useFrozen() {
  const groupRef = useRef()
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    const group = groupRef.current
    if (!group || frames.current < 3 || !group.matrixWorldAutoUpdate) return
    group.updateMatrixWorld(true)
    group.traverse((object) => {
      object.matrixAutoUpdate = false
    })
    group.matrixWorldAutoUpdate = false
  })
  return groupRef
}

export function World({ state }) {
  const groupRef = useFrozen()
  return (
    <group ref={groupRef}>
      <Ground state={state} />
      <Track state={state} />
      <PitLane state={state} />
      <Statics state={state} />
      <Scenery state={state} />
    </group>
  )
}

// Where a low block or a street lamp may stand: clear of the track, the pit complex and the billboards.
function useOutsideSpots(state) {
  const { track } = state
  return useMemo(() => {
    const samples = []
    for (let distance = 0; distance < track.length; distance += 8) samples.push(track.at(distance))
    const trackDistance = (x, z) => Math.sqrt(Math.min(...samples.map((point) => (point.x - x) ** 2 + (point.z - z) ** 2)))
    const insidePitComplex = (x, z, margin) => x > -125 - margin && x < 125 + margin && z > -28 - margin && z < 100 + margin
    return { trackDistance, insidePitComplex }
  }, [track])
}

// Low dark blocks with a few lit windows, scattered outside the circuit so the night is not empty ground.
function CityBlocks({ state }) {
  const spots = useOutsideSpots(state)
  const geometry = useMemo(() => {
    const random = seededRandom(state.site.seed * 29)
    const placed = []
    const parts = []
    let attempts = 0
    while (placed.length < 120 && attempts < 12000) {
      attempts++
      const width = 9 + random() * 11
      const depth = 9 + random() * 11
      const height = 4 + random() * 7
      const x = (random() - 0.5) * 620
      const z = -222 + random() * 400
      const reach = Math.max(width, depth) / 2 + 12
      if (spots.insidePitComplex(x, z, reach)) continue
      if (spots.trackDistance(x, z) < reach + 16) continue
      if (placed.some((block) => Math.hypot(block.x - x, block.z - z) < (block.reach + reach) * 0.9)) continue
      placed.push({ x, z, reach })
      const box = new THREE.BoxGeometry(width, height, depth)
      box.translate(x, height / 2, z)
      const uv = box.attributes.uv
      const position = box.attributes.position
      const normal = box.attributes.normal
      const floorHeight = 2.4
      const bayWidth = 2.6
      for (let index = 0; index < uv.count; index++) {
        if (normal.getY(index) > 0.5) {
          uv.setXY(index, 0.5, 0.05)
          continue
        }
        const alongX = Math.abs(normal.getX(index)) < 0.5
        const horizontal = alongX ? position.getX(index) : position.getZ(index)
        uv.setXY(index, horizontal / (bayWidth * 4), position.getY(index) / ((floorHeight * 6) / 0.86))
      }
      parts.push(box)
    }
    const merged = mergeGeometries(parts)
    parts.forEach((part) => part.dispose())
    return merged
  }, [state, spots])
  return <mesh geometry={geometry} material={cityBlockMaterial()} castShadow receiveShadow />
}

// Lamps along the outside of the circuit: a dark pole, a warm head and a small pool of light below it.
function StreetLamps({ state }) {
  const { track } = state
  const materials = streetLampMaterials()
  const { poles, heads, pools } = useMemo(() => {
    const poleParts = []
    const headParts = []
    const poolParts = []
    for (let distance = 12; distance < track.length; distance += 30) {
      const point = track.at(distance)
      if (nearStraight(point)) continue
      for (const side of [-1, 1]) {
        const lateral = side * 14.5
        const x = point.x + Math.cos(point.heading) * lateral
        const z = point.z - Math.sin(point.heading) * lateral
        const pole = new THREE.CylinderGeometry(0.18, 0.24, 9, 8)
        pole.translate(x, 4.5, z)
        poleParts.push(pole)
        const head = new THREE.BoxGeometry(2.2, 0.35, 0.9)
        head.translate(x - Math.cos(point.heading) * side * 1.0, 9.1, z + Math.sin(point.heading) * side * 1.0)
        headParts.push(head)
        const pool = new THREE.PlaneGeometry(14, 14)
        pool.rotateX(-Math.PI / 2)
        pool.translate(x - Math.cos(point.heading) * side * 3, 0.07, z + Math.sin(point.heading) * side * 3)
        poolParts.push(pool)
      }
    }
    const build = (parts) => {
      const merged = mergeGeometries(parts)
      parts.forEach((part) => part.dispose())
      return merged
    }
    return { poles: build(poleParts), heads: build(headParts), pools: build(poolParts) }
  }, [track])
  return (
    <group>
      <mesh geometry={poles} material={materials.pole} castShadow />
      <mesh geometry={heads} material={materials.head} />
      <mesh geometry={pools} material={lightPoolMaterial()} renderOrder={2} />
    </group>
  )
}
