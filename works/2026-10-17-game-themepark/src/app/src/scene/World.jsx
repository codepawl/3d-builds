// Static parts of a land: ground, walkways, water, parking, buildings, queues, stands and props.
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { scatter } from '../data.js'
import { makePath, samplePath } from '../paths.js'
import { flatClone, InstancedModel } from './assets.jsx'
import { pointerHandlers } from './Markers.jsx'
import { asphaltMaterial, edgeMaterial, lawnMaterial, paintMaterial, pavingMaterial, waterMaterial } from './materials.js'

const TILE = 6

// Ground-plane geometry with UVs in world metres, so textures keep one scale everywhere.
function planar(geometry, height) {
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, height, 0)
  const positions = geometry.attributes.position
  const uvs = new Float32Array(positions.count * 2)
  for (let index = 0; index < positions.count; index++) {
    uvs[index * 2] = positions.getX(index) / TILE
    uvs[index * 2 + 1] = -positions.getZ(index) / TILE
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  return geometry
}

function cleanForMerge(geometry) {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry
  for (const name of Object.keys(plain.attributes)) if (!['position', 'normal', 'uv'].includes(name)) plain.deleteAttribute(name)
  return plain
}

function ribbon(points, closed, width, height) {
  const pieces = []
  const count = closed ? points.length : points.length - 1
  for (let index = 0; index < count; index++) {
    const from = points[index]
    const to = points[(index + 1) % points.length]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    if (length < 0.01) continue
    const plane = new THREE.PlaneGeometry(width, length)
    plane.rotateZ(-Math.atan2(to[0] - from[0], to[1] - from[1]))
    plane.translate((from[0] + to[0]) / 2, -(from[1] + to[1]) / 2, 0)
    pieces.push(plane)
  }
  for (const point of points) {
    const disc = new THREE.CircleGeometry(width / 2, 20)
    disc.translate(point[0], -point[1], 0)
    pieces.push(disc)
  }
  return planar(mergeGeometries(pieces.map(cleanForMerge)), height)
}

function roundedBox(x, z, width, depth, radius, height) {
  const shape = new THREE.Shape()
  const left = x - width / 2
  const top = -z - depth / 2
  shape.moveTo(left + radius, top)
  shape.lineTo(left + width - radius, top)
  shape.quadraticCurveTo(left + width, top, left + width, top + radius)
  shape.lineTo(left + width, top + depth - radius)
  shape.quadraticCurveTo(left + width, top + depth, left + width - radius, top + depth)
  shape.lineTo(left + radius, top + depth)
  shape.quadraticCurveTo(left, top + depth, left, top + depth - radius)
  shape.lineTo(left, top + radius)
  shape.quadraticCurveTo(left, top, left + radius, top)
  return planar(new THREE.ShapeGeometry(shape, 6), height)
}

function plazaGeometry(plaza, height, grow = 0) {
  if (plaza.radius) {
    const disc = new THREE.CircleGeometry(plaza.radius + grow, 48)
    disc.translate(plaza.x, -plaza.z, 0)
    return planar(disc, height)
  }
  return roundedBox(plaza.x, plaza.z, plaza.w + grow * 2, plaza.d + grow * 2, Math.min(4 + grow, plaza.w / 2, plaza.d / 2), height)
}

function Ground({ layout }) {
  const { lawn, bounds } = layout.ground
  const geometries = useMemo(() => {
    const paving = [...layout.walkways.map((walkway) => ribbon(walkway.points, walkway.closed, walkway.width, 0.03)), ...layout.plazas.map((plaza) => plazaGeometry(plaza, 0.03))]
    const water = layout.water.map((pond) => plazaGeometry({ ...pond }, 0.06))
    const edges = layout.water.map((pond) => plazaGeometry({ ...pond }, 0.045, 1.4))
    const lawnPlane = planar(new THREE.PlaneGeometry(bounds[2] - bounds[0] + 400, bounds[3] - bounds[1] + 400).translate((bounds[0] + bounds[2]) / 2, -(bounds[1] + bounds[3]) / 2, 0), 0)
    const asphalt = []
    if (layout.parking) {
      const lot = layout.parking
      asphalt.push(roundedBox((lot.minX + lot.maxX) / 2, (lot.minZ + lot.maxZ) / 2, lot.maxX - lot.minX, lot.maxZ - lot.minZ, 6, 0.03))
    }
    if (layout.tramLoop) asphalt.push(ribbon(layout.tramLoop, true, 7, 0.035))
    return {
      lawn: lawnPlane,
      paving: mergeGeometries(paving.map(cleanForMerge)),
      water: water.length ? mergeGeometries(water.map(cleanForMerge)) : null,
      edges: edges.length ? mergeGeometries(edges.map(cleanForMerge)) : null,
      asphalt: asphalt.length ? mergeGeometries(asphalt.map(cleanForMerge)) : null,
    }
  }, [layout, bounds])
  return (
    <group>
      <mesh geometry={geometries.lawn} material={lawnMaterial(lawn)} receiveShadow raycast={() => null} />
      <mesh geometry={geometries.paving} material={pavingMaterial(layout.paving)} receiveShadow raycast={() => null} />
      {geometries.edges && <mesh geometry={geometries.edges} material={edgeMaterial()} receiveShadow raycast={() => null} />}
      {geometries.water && <mesh geometry={geometries.water} material={waterMaterial()} receiveShadow raycast={() => null} />}
      {geometries.asphalt && <mesh geometry={geometries.asphalt} material={asphaltMaterial()} receiveShadow raycast={() => null} />}
      {layout.parking && <ParkingPaint lot={layout.parking} />}
    </group>
  )
}

// Parking rows: bays face each other across 7 m aisles.
export function parkingBays(lot) {
  const bays = []
  for (let rowZ = lot.minZ + 5; rowZ + 5 < lot.maxZ; rowZ += 17) {
    for (const side of [-1, 1]) {
      for (let x = lot.minX + 4; x < lot.maxX - 3; x += 2.8) bays.push({ x, z: rowZ + side * 2.6, facing: side })
    }
  }
  return bays.map((bay) => ({ ...bay, z: bay.z + (bay.facing > 0 ? 0 : 0) }))
}

function ParkingPaint({ lot }) {
  const geometry = useMemo(() => {
    const pieces = []
    for (const bay of parkingBays(lot)) {
      const line = new THREE.PlaneGeometry(0.14, 5)
      line.translate(bay.x - 1.4, -bay.z, 0)
      pieces.push(line)
    }
    return planar(mergeGeometries(pieces), 0.05)
  }, [lot])
  return <mesh geometry={geometry} material={paintMaterial()} raycast={() => null} />
}

// ---------- placed models ----------

export function Placed({ nodes, node, position, rotation = 0, scale = 1, pickId = null }) {
  const object = useMemo(() => flatClone(nodes[node]), [nodes, node])
  const handlers = pickId ? pointerHandlers(pickId) : {}
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale} {...handlers}>
      <primitive object={object} />
    </group>
  )
}

function distanceToPolyline(points, closed, x, z) {
  let best = Infinity
  const count = closed ? points.length : points.length - 1
  for (let index = 0; index < count; index++) {
    const [ax, az] = points[index]
    const [bx, bz] = points[(index + 1) % points.length]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

function useProps(layout) {
  return useMemo(() => {
    const [minX, minZ, maxX, maxZ] = layout.ground.bounds
    const avoid = layout.avoid.filter((zone) => zone[4] !== 'ring')
    const clear = (item) => {
      const [x, , z] = item.position
      if (layout.walkways.some((walkway) => distanceToPolyline(walkway.points, walkway.closed, x, z) < walkway.width / 2 + 2.6)) return false
      if (layout.monorail && distanceToPolyline(layout.monorail.points, true, x, z) < 5) return false
      if (layout.tramLoop && distanceToPolyline(layout.tramLoop, true, x, z) < 6) return false
      if (layout.parking && x > layout.parking.minX - 3 && x < layout.parking.maxX + 3 && z > layout.parking.minZ - 3 && z < layout.parking.maxZ + 3) return false
      if (layout.plazas.some((plaza) => (plaza.radius ? Math.hypot(x - plaza.x, z - plaza.z) < plaza.radius + 2 : Math.abs(x - plaza.x) < plaza.w / 2 + 2 && Math.abs(z - plaza.z) < plaza.d / 2 + 2))) return false
      if (layout.water.some((pond) => Math.abs(x - pond.x) < pond.w / 2 + 2.5 && Math.abs(z - pond.z) < pond.d / 2 + 2.5)) return false
      if (layout.queues.some((queue) => x > queue.x - 4 && x < queue.x + queue.length + 4 && z > queue.z - 3 && z < queue.z + queue.lanes * 1.2 + 3)) return false
      if (layout.stands.some((stand) => Math.hypot(x - stand.position[0], z - stand.position[2]) < 9)) return false
      return true
    }
    const raw = scatter({ seed: minX * -7 + 13, boxes: [[minX, minZ, maxX, maxZ]], avoid, count: layout.props.treeCount * 3, kinds: layout.props.trees })
    const trees = raw.filter(clear).slice(0, layout.props.treeCount)
    const bushes = scatter({ seed: 77 + maxZ, boxes: [[minX + 20, minZ + 20, maxX - 20, maxZ - 20]], avoid, count: 140, kinds: ['bush_a', 'bush_b', 'flower_bed'] }).filter(clear).slice(0, 60)
    // Lamps, benches and bins along the main walkways.
    const lamps = []
    const benches = []
    const bins = []
    const point = {}
    layout.walkways.forEach((walkway, walkwayIndex) => {
      const path = makePath(walkway.points, walkway.closed)
      for (let s = 6; s < path.length - 4; s += 18) {
        samplePath(path, s, point)
        for (const side of [-1, 1]) {
          const offset = walkway.width / 2 + 0.7
          const x = point.x + Math.cos(point.heading) * offset * side
          const z = point.z - Math.sin(point.heading) * offset * side
          const facing = point.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2)
          if (layout.queues.some((queue) => x > queue.x - 3 && x < queue.x + queue.length + 3 && z > queue.z - 2.5 && z < queue.z + queue.lanes * 1.2 + 2.5)) continue
          if (layout.stands.some((stand) => Math.hypot(x - stand.position[0], z - stand.position[2]) < 7)) continue
          const slot = Math.round(s / 18 + walkwayIndex + (side > 0 ? 1 : 0))
          if (slot % 2 === 0) lamps.push({ position: [x, 0, z], rotation: facing })
          else if (slot % 4 === 1) benches.push({ position: [x, 0, z], rotation: facing })
          else bins.push({ position: [x, 0, z], rotation: facing })
        }
      }
    })
    const group = (kind) => trees.filter((tree) => tree.kind === kind)
    return { trees: layout.props.trees.filter((kind, index, list) => list.indexOf(kind) === index).map((kind) => [kind, group(kind)]), bushes, lamps, benches, bins }
  }, [layout])
}

function Queues({ nodes, layout, queues }) {
  const rails = useMemo(() => queues.flatMap((queue) => queue.rails), [queues])
  const turns = useMemo(() => queues.flatMap((queue) => queue.turns), [queues])
  const canopies = useMemo(() => queues.flatMap((queue) => queue.canopies), [queues])
  const merges = useMemo(() => queues.map((queue) => ({ position: [queue.path[queue.path.length - 1][0] + 0.6, 0, queue.path[queue.path.length - 1][1] + 2.2], rotation: Math.PI / 2 })), [queues])
  const boards = useMemo(() => layout.queues.map((spec) => ({ position: [spec.x + spec.length + 2.4, 0, spec.z + spec.lanes * 1.2 + 0.4], rotation: 0 })), [layout])
  return (
    <group>
      <InstancedModel node={nodes.queue_rail_straight} items={rails} shadows={false} />
      <InstancedModel node={nodes.queue_rail_turn} items={turns} shadows={false} />
      <InstancedModel node={nodes.queue_canopy} items={canopies} />
      <InstancedModel node={nodes.fastpass_merge} items={merges} />
      <InstancedModel node={nodes.wait_board} items={boards} />
    </group>
  )
}

function CarsInLot({ nodes, lot }) {
  const items = useMemo(() => {
    let seed = 91
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const byModel = { car_hatch: [], car_sedan: [], car_suv: [] }
    const models = Object.keys(byModel)
    for (const bay of parkingBays(lot)) {
      if (random() < 0.18) continue
      const model = models[Math.floor(random() * 3)]
      byModel[model].push({ position: [bay.x, 0, bay.z], rotation: bay.facing > 0 ? Math.PI : 0, color: ['#d8dde4', '#2e3440', '#a83a3f', '#3f6fa8', '#c9ccd2', '#5c6b5a', '#f2f2f0'][Math.floor(random() * 7)] })
    }
    return byModel
  }, [lot])
  return Object.entries(items).map(([model, list]) => <InstancedModel key={model} node={nodes[model]} items={list} colorOf={(item) => item.color} />)
}

export function World({ state, nodes }) {
  const layout = state.layout
  const props = useProps(layout)
  const tables = useMemo(() => layout.tables.map(([x, z], index) => ({ position: [x, 0, z], rotation: index * 0.7 })), [layout])
  const balloons = useMemo(() => (layout.props.balloons ?? []).map(([x, z]) => ({ position: [x, 0, z], rotation: 0 })), [layout])
  return (
    <group>
      <Ground layout={layout} />
      {props.trees.map(([kind, items]) => (
        <InstancedModel key={kind} node={nodes[kind]} items={items} />
      ))}
      {['bush_a', 'bush_b', 'flower_bed'].map((kind) => (
        <InstancedModel key={kind} node={nodes[kind]} items={props.bushes.filter((item) => item.kind === kind)} shadows={false} />
      ))}
      <InstancedModel node={nodes.lamp_post} items={props.lamps} />
      <InstancedModel node={nodes.bench} items={props.benches} shadows={false} />
      <InstancedModel node={nodes.trash_bin} items={props.bins} shadows={false} />
      <InstancedModel node={nodes.table_umbrella} items={tables} />
      <InstancedModel node={nodes.balloon_cluster} items={balloons} />
      <Queues nodes={nodes} layout={layout} queues={state.queues} />
      {layout.buildings.map((building) => (
        <Placed key={building.node} nodes={nodes} node={building.node} position={building.position} rotation={building.rotation} pickId={building.rideId} />
      ))}
      {state.stands.map((stand) => (
        <Placed key={stand.id} nodes={nodes} node={stand.node} position={stand.position} rotation={stand.rotation} pickId={stand.id} />
      ))}
      {layout.parking && <CarsInLot nodes={nodes} lot={layout.parking} />}
    </group>
  )
}
