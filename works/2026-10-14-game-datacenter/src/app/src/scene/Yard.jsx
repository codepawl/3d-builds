// Outside the hall: chiller yard, substation, battery room, the campus pad, roads, trees and neighbouring halls.
// Every object here is a Blender model from public/assets/cooling.glb, power.glb and campus.glb.
import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { createRandom } from '../world.js'
import { COLORS } from './palette.js'
import { useSpinningRotors } from './Hall.jsx'
import { selectOnClick } from './picking.js'
import { planRoads } from './roads.js'
import { InstancedAsset, fillRun, placement, useAssetClone, useInstanceParts } from './assets.jsx'

const PIPE_MODULE = 1
// The substation's concrete pad curb reaches 2.6 m from its centre; the hall wall is 0.16 m thick.
const SUBSTATION_PAD_HALF_DEPTH = 2.6
const WALL_OVERLAP = 0.1
const PIPE_HEIGHTS = { cold: 0.3, hot: 0.62 }
const TREE_VARIANTS = ['tree_a', 'tree_b', 'tree_c']

function campusBounds(layout) {
  return {
    minX: -(layout.wallX + 10.5),
    maxX: layout.wallX + 13,
    minZ: -(layout.wallZ + 11),
    maxZ: layout.wallZ + 5,
  }
}

function Chiller({ chiller, variant }) {
  const model = useAssetClone('cooling', variant)
  const speedRef = useRef(chiller.load)
  useFrame(() => {
    speedRef.current = 0.5 + chiller.load * 0.6
  })
  useSpinningRotors(model, speedRef)
  return (
    <group position={[chiller.x, 0, chiller.z]} onClick={selectOnClick(() => chiller.id)}>
      <primitive object={model} />
    </group>
  )
}

// Supply and return headers along the chiller yard, a tee where the branch from the hall wall joins, end caps and stanchions.
function PipeRun({ temperature, layout, spanZ, headerX }) {
  const segmentParts = useInstanceParts('cooling', `pipe_segment_${temperature}`)
  const teeParts = useInstanceParts('cooling', `pipe_tee_${temperature}`)
  const capParts = useInstanceParts('cooling', `pipe_cap_${temperature}`)
  const { segments, tees, caps } = useMemo(() => {
    const y = PIPE_HEIGHTS[temperature]
    const header = fillRun(spanZ, PIPE_MODULE)
    const segments = header.offsets.map((offset) => placement(headerX, y, offset, Math.PI / 2, [header.stretch, 1, 1]))
    const branchLength = headerX - 0.36 - layout.wallX
    const branch = fillRun(branchLength, PIPE_MODULE)
    for (const offset of branch.offsets) segments.push(placement(layout.wallX + branchLength / 2 + offset, y, 0, 0, [branch.stretch, 1, 1]))
    const caps = [placement(headerX, y, spanZ / 2, -Math.PI / 2), placement(headerX, y, -spanZ / 2, Math.PI / 2)]
    return { segments, tees: [placement(headerX, y, 0)], caps }
  }, [temperature, layout, spanZ, headerX])
  return (
    <group>
      <InstancedAsset parts={segmentParts} matrices={segments} />
      <InstancedAsset parts={teeParts} matrices={tees} />
      <InstancedAsset parts={capParts} matrices={caps} />
    </group>
  )
}

function ChillerPipes({ layout, chillers }) {
  const supportParts = useInstanceParts('cooling', 'pipe_support')
  const zs = chillers.map((chiller) => chiller.z)
  const spanZ = Math.max(...zs) - Math.min(...zs) + 1.2
  const headerX = layout.wallX + 2.4
  const supports = useMemo(() => {
    const run = fillRun(spanZ - 1, 1.8)
    return run.offsets.filter((offset) => Math.abs(offset) > 0.5).map((offset) => placement(headerX, 0, offset, Math.PI / 2))
  }, [spanZ, headerX])
  return (
    <group>
      <PipeRun temperature="cold" layout={layout} spanZ={spanZ} headerX={headerX} />
      <PipeRun temperature="hot" layout={layout} spanZ={spanZ} headerX={headerX} />
      <InstancedAsset parts={supportParts} matrices={supports} />
    </group>
  )
}

function ClonedModel({ file, node, item }) {
  const model = useAssetClone(file, node)
  return (
    <group position={[item.x, 0, item.z]} onClick={selectOnClick(() => item.id)}>
      <primitive object={model} />
    </group>
  )
}

function TreeVariant({ variant, matrices }) {
  const parts = useInstanceParts('campus', variant)
  return <InstancedAsset parts={parts} matrices={matrices} receiveShadow={false} />
}

function Trees({ bounds, seed, keepClear }) {
  const matricesByVariant = useMemo(() => {
    const random = createRandom(seed + 5)
    const spots = []
    const margin = 6.4
    for (let x = bounds.minX - margin; x <= bounds.maxX + margin; x += 3.2 + random() * 1.6) {
      spots.push([x, bounds.minZ - margin - random() * 2])
      if (random() > 0.35) spots.push([x, bounds.maxZ + margin + random() * 2])
    }
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 3.4 + random() * 1.8) {
      spots.push([bounds.minX - margin - random() * 2, z])
      spots.push([bounds.maxX + margin + random() * 2, z])
    }
    const groups = TREE_VARIANTS.map(() => [])
    const onRoad = ([x, z]) => keepClear.some((zone) => x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ)
    for (const [x, z] of spots.filter((spot) => !onRoad(spot))) {
      const scale = 0.75 + random() * 0.5
      const variant = Math.floor(random() * TREE_VARIANTS.length)
      groups[variant].push(placement(x, 0, z, random() * Math.PI * 2, scale))
    }
    return groups
  }, [bounds, seed, keepClear])
  return TREE_VARIANTS.map((variant, index) => <TreeVariant key={variant} variant={variant} matrices={matricesByVariant[index]} />)
}

// A ring road around the campus pad with corner and T-junction pieces, plus an access road to each neighbour hall's loading door.
function Roads({ plan }) {
  const tileParts = useInstanceParts('campus', 'road_tile')
  const cornerParts = useInstanceParts('campus', 'road_corner')
  const teeParts = useInstanceParts('campus', 'road_tee')
  const curbParts = useInstanceParts('campus', 'curb')
  return (
    <group>
      <InstancedAsset parts={tileParts} matrices={plan.tiles} castShadow={false} />
      <InstancedAsset parts={cornerParts} matrices={plan.corners} castShadow={false} />
      <InstancedAsset parts={teeParts} matrices={plan.tees} castShadow={false} />
      <InstancedAsset parts={curbParts} matrices={plan.curbs} />
    </group>
  )
}

function NeighbourHall({ hall }) {
  const model = useAssetClone('campus', hall.variant)
  return <primitive object={model} position={[hall.x, 0, hall.z]} />
}

export const Yard = memo(function Yard({ world }) {
  const bounds = useMemo(() => campusBounds(world.layout), [world.layout])
  const plan = useMemo(() => planRoads(bounds), [bounds])
  const chillers = world.equipment.filter((item) => item.kind === 'chiller')
  const substation = world.equipment.find((item) => item.kind === 'substation')
  const battery = world.equipment.find((item) => item.kind === 'battery')
  // A walkway that runs from the substation's pad to the hall wall without a gap at either end.
  const walkwayFromZ = substation.z + SUBSTATION_PAD_HALF_DEPTH
  const walkwayToZ = -world.layout.wallZ - WALL_OVERLAP
  return (
    <group>
      <mesh position-y={-0.02} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>
      <mesh position={[(bounds.minX + bounds.maxX) / 2, 0.005, (bounds.minZ + bounds.maxZ) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
        <meshStandardMaterial color={COLORS.pad} roughness={0.95} />
      </mesh>
      <Roads plan={plan} />
      <Trees bounds={bounds} seed={world.site.seed} keepClear={plan.keepClear} />
      {Object.values(plan.halls).map((hall) => <NeighbourHall key={hall.variant} hall={hall} />)}
      <ChillerPipes layout={world.layout} chillers={chillers} />
      {chillers.map((chiller, index) => <Chiller key={chiller.id} chiller={chiller} variant={index % 2 ? 'chiller_b' : 'chiller_a'} />)}
      <ClonedModel file="power" node="substation" item={substation} />
      <mesh position={[substation.x, 0.02, (walkwayFromZ + walkwayToZ) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.9, walkwayToZ - walkwayFromZ]} />
        <meshStandardMaterial color="#d5dae6" roughness={0.9} />
      </mesh>
      <ClonedModel file="power" node="battery_room" item={battery} />
    </group>
  )
})
