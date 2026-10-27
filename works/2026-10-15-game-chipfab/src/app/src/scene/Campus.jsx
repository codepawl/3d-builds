// The campus at real size: both fabs, packaging, utilities, the ring road with delivery
// trucks, cooling-tower fans and the tower crane over the fab still being built.
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import geometry from '../geometry.json'
import { CAMPUS_ROAD } from '../data.js'
import { findEntity, selectEntity, useUiValue } from '../store.js'
import { Html } from '@react-three/drei'
import { findParts, InstancedModel, useAssets } from './assets.jsx'
import { PALETTE, standard } from './materials.js'
import { NameTag, Pin, SelectionRing } from './Units.jsx'
import { BRAND } from './materials.js'

const ROAD_WIDTH = 9

function pointerHandlers(id) {
  return {
    onClick: (event) => selectEntity(event, id),
    onPointerOver: (event) => {
      event.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
  }
}

function Building({ building, nodes, clock }) {
  const object = useMemo(() => {
    const clone = nodes[building.node].clone(true)
    // The tower crane is painted in the amber lamp material; give it plain paint so it does not bloom.
    if (building.node === 'bldg_fab_ramp') {
      clone.traverse((child) => {
        if (child.isMesh && child.material.name === 'glow_amber') child.material = standard('#e9b52f', { roughness: 0.5 })
      })
    }
    return clone
  }, [nodes, building.node])
  const fans = useMemo(() => findParts(object, `${building.node}_fan`), [object, building.node])
  const jib = useMemo(() => findParts(object, `${building.node}_crane_jib`)[0], [object, building.node])
  useFrame((_, dt) => {
    fans.forEach((fan, index) => {
      fan.rotation.y += dt * (5 + index * 0.4)
    })
    if (jib) jib.rotation.y = Math.sin(clock() * 0.05) * 1.1
  })
  const { min, max } = geometry[building.node]
  return (
    <group>
      <mesh position={[building.position[0] + (min[0] + max[0]) / 2, 0.04, building.position[2] + (min[2] + max[2]) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={standard(PALETTE.pad, { roughness: 0.95 })}>
        <planeGeometry args={[max[0] - min[0] + 10, max[2] - min[2] + 10]} />
      </mesh>
      <primitive object={object} position={building.position} rotation={[0, building.rotation, 0]} {...pointerHandlers(building.id)} />
      <Html position={[building.position[0] + (min[0] + max[0]) / 2, max[1] + 4, building.position[2] + (min[2] + max[2]) / 2]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
        <div className="building-label">{building.name}</div>
      </Html>
    </group>
  )
}

function Truck({ truck, nodes }) {
  const object = useMemo(() => nodes[truck.node].clone(true), [nodes, truck.node])
  const wheels = useMemo(() => findParts(object, `${truck.node}_wheel`), [object, truck.node])
  useFrame(() => {
    object.position.set(truck.position.x, 0, truck.position.z)
    object.rotation.y = truck.heading
    wheels.forEach((wheel) => {
      wheel.rotation.x = truck.wheel
    })
  })
  return <primitive object={object} {...pointerHandlers(truck.id)} />
}

function Roads() {
  const segments = CAMPUS_ROAD.map((corner, index) => {
    const next = CAMPUS_ROAD[(index + 1) % CAMPUS_ROAD.length]
    const length = Math.hypot(next[0] - corner[0], next[1] - corner[1]) + ROAD_WIDTH
    const angle = Math.atan2(next[0] - corner[0], next[1] - corner[1])
    return { x: (corner[0] + next[0]) / 2, z: (corner[1] + next[1]) / 2, length, angle }
  })
  const access = [
    { x: -14, z: 66, length: 52, angle: 0 },
    { x: -60, z: 30, length: 20, angle: 0 },
    { x: 58, z: 28, length: 26, angle: 0 },
  ]
  return (
    <group>
      {[...segments, ...access].map((segment, index) => (
        <group key={index} position={[segment.x, 0.06, segment.z]} rotation={[0, segment.angle, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={standard(PALETTE.road, { roughness: 0.9 })}>
            <planeGeometry args={[ROAD_WIDTH, segment.length]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={standard('#f6f8fb')}>
            <planeGeometry args={[0.3, segment.length - ROAD_WIDTH]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function scatter(seed, count, area, avoid) {
  let value = seed
  const next = () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
  const list = []
  let attempts = 0
  while (list.length < count && attempts < count * 40) {
    attempts++
    const x = area[0] + next() * (area[2] - area[0])
    const z = area[1] + next() * (area[3] - area[1])
    if (avoid(x, z)) continue
    list.push({ position: [x, 0, z], rotation: next() * Math.PI * 2, scale: 0.8 + next() * 0.5 })
  }
  return list
}

function Greenery({ state }) {
  const blocked = useMemo(() => {
    const boxes = state.buildings.map((building) => {
      const { min, max } = geometry[building.node]
      return [building.position[0] + min[0] - 8, building.position[2] + min[2] - 8, building.position[0] + max[0] + 8, building.position[2] + max[2] + 8]
    })
    const roadBoxes = CAMPUS_ROAD.map((corner, index) => {
      const next = CAMPUS_ROAD[(index + 1) % CAMPUS_ROAD.length]
      return [Math.min(corner[0], next[0]) - 9, Math.min(corner[1], next[1]) - 9, Math.max(corner[0], next[0]) + 9, Math.max(corner[1], next[1]) + 9]
    })
    const accessBoxes = [[-21, 38, -7, 96], [-67, 18, -53, 42], [51, 14, 65, 42]]
    return [...boxes, ...roadBoxes, ...accessBoxes]
  }, [state])
  const avoid = (x, z) => blocked.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)
  const treesA = useMemo(() => scatter(7, 70, [-160, -110, 190, 150], avoid), [blocked])
  const treesB = useMemo(() => scatter(19, 60, [-160, -110, 190, 150], avoid), [blocked])
  const lamps = useMemo(() => {
    const list = []
    for (let x = -100; x <= 130; x += 24) list.push({ position: [x, 0, 40 - ROAD_WIDTH / 2 - 1.2], rotation: 0 }, { position: [x + 12, 0, 92 + ROAD_WIDTH / 2 + 1.2], rotation: Math.PI })
    return list
  }, [])
  const { nodes } = useAssets()
  return (
    <group>
      <InstancedModel node={nodes.tree_a} items={treesA} />
      <InstancedModel node={nodes.tree_b} items={treesB} />
      <InstancedModel node={nodes.lamp_post} items={lamps} />
    </group>
  )
}

export function Campus({ state }) {
  const { nodes } = useAssets()
  const selectedId = useUiValue((ui) => ui.selectedId)
  const clock = () => state.clock
  const pinTarget = () => {
    const entity = findEntity(selectedId, state)
    if (!entity) return null
    const top = entity.type === 'building' ? geometry[entity.item.node].max[1] : 4
    return { x: entity.position.x, y: top, z: entity.position.z }
  }
  return (
    <group>
      <mesh position={[15, 0, 20]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>
      <Roads />
      <Greenery state={state} />
      {state.buildings.map((building) => (
        <Building key={building.id} building={building} nodes={nodes} clock={clock} />
      ))}
      {state.trucks.map((truck) => (
        <Truck key={truck.id} truck={truck} nodes={nodes} />
      ))}
      <SelectionRing selectedId={selectedId} floorY={0.2} />
      {selectedId && <Pin key={selectedId} color={BRAND} scale={4} follow={pinTarget} />}
      <NameTag selectedId={selectedId} scale={4} />
    </group>
  )
}
