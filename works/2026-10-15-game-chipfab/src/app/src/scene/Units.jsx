// Everything that moves in a fab: OHT vehicles with their hoists, wafer pods, people in
// bunny suits, plus the selection ring, pins over selected and down tools, and the name tag.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import geometry from '../geometry.json'
import { RAIL_Y } from '../sim.js'
import { currentSite, findEntity, lotPosition, selectEntity, useUi, useUiValue } from '../store.js'
import { lotStatus, personStatus, toolStatus, truckStatus, vehicleStatus } from '../status.js'
import { BRAND, standard } from './materials.js'
import { findParts, useAssets } from './assets.jsx'
import { StatusIcon } from '../ui/Icon.jsx'

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

// ---------- OHT vehicles ----------

function Vehicle({ vehicle, nodes }) {
  const parts = useMemo(() => {
    const root = nodes[vehicle.variant].clone(true)
    return {
      root,
      hoist: findParts(root, `${vehicle.variant}_hoist`)[0],
      belts: findParts(root, `${vehicle.variant}_belts`)[0],
      wheels: findParts(root, `${vehicle.variant}_wheel`),
    }
  }, [nodes, vehicle.variant])
  const hoistHome = parts.hoist.position.y
  useFrame(() => {
    const { root, hoist, belts, wheels } = parts
    root.position.set(vehicle.position.x, RAIL_Y, vehicle.position.z)
    root.rotation.y = vehicle.heading
    hoist.position.y = hoistHome - vehicle.hoist
    belts.scale.y = Math.max(0.001, vehicle.hoist)
    belts.visible = vehicle.hoist > 0.01
    wheels.forEach((wheel) => {
      wheel.rotation.x = vehicle.wheel
    })
  })
  return <primitive object={parts.root} {...pointerHandlers(vehicle.id)} />
}

// ---------- wafer pods ----------

const POD_NODE = { hot: 'foup_hot', eng: 'foup_eng', mon: 'foup_mon', normal: 'foup_std' }

function podHeading(state, lot) {
  if (lot.place.type === 'vehicle') return state.vehicles.find((vehicle) => vehicle.id === lot.place.id).heading
  const tool = state.tools.find((candidate) => candidate.id === lot.place.toolId)
  return tool.angle + Math.PI
}

// One instanced mesh per pod part and band colour, rewritten each frame from the lots that are
// on a load port or under a hoist (pods inside stockers are not drawn).
function PodGroup({ state, lots, node }) {
  const parts = useMemo(() => {
    node.updateWorldMatrix(true, true)
    const toNode = new THREE.Matrix4().copy(node.matrixWorld).invert()
    const list = []
    node.traverse((object) => {
      if (object.isMesh) list.push({ geometry: object.geometry, material: object.material, matrix: new THREE.Matrix4().multiplyMatrices(toNode, object.matrixWorld) })
    })
    return list
  }, [node])
  const meshRefs = useRef([])
  const visibleLots = useRef([])
  useFrame(() => {
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    const shown = lots.filter((lot) => lot.place.type === 'port' || lot.place.type === 'vehicle')
    visibleLots.current = shown
    parts.forEach((part, partIndex) => {
      const mesh = meshRefs.current[partIndex]
      if (!mesh) return
      shown.forEach((lot, index) => {
        const position = lotPosition(state, lot)
        rotation.setFromAxisAngle(up, podHeading(state, lot))
        matrix.compose(new THREE.Vector3(position.x, position.y, position.z), rotation, one).multiply(part.matrix)
        mesh.setMatrixAt(index, matrix)
      })
      mesh.count = shown.length
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  })
  const onClick = (event) => {
    const lot = visibleLots.current[event.instanceId]
    if (lot) selectEntity(event, lot.id)
  }
  return parts.map((part, index) => (
    <instancedMesh
      key={index}
      ref={(mesh) => {
        meshRefs.current[index] = mesh
      }}
      args={[part.geometry, part.material, Math.max(1, lots.length)]}
      frustumCulled={false}
      castShadow
      receiveShadow
      onClick={onClick}
    />
  ))
}

function Pods({ state, nodes }) {
  const groups = useMemo(() => {
    const byType = {}
    for (const lot of state.lots) (byType[lot.priority] ??= []).push(lot)
    return byType
  }, [state])
  return Object.entries(groups).map(([priority, lots]) => <PodGroup key={priority} state={state} lots={lots} node={nodes[POD_NODE[priority]]} />)
}

// ---------- people ----------

const FADE_SECONDS = 0.25

function Person({ person, nodes, clips }) {
  const rootName = person.role === 'technician' ? 'person_technician' : 'person_engineer'
  const { object, mixer, actions } = useMemo(() => {
    const clone = cloneSkeleton(nodes[rootName])
    const animationMixer = new THREE.AnimationMixer(clone)
    const byName = {}
    for (const clip of clips) {
      if (!clip.name.startsWith(rootName)) continue
      byName[clip.name.slice(rootName.length + 1)] = animationMixer.clipAction(clip)
    }
    clone.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeBoundingSphere()
        child.castShadow = child.geometry.boundingSphere.radius > 0.2
        child.receiveShadow = true
      }
    })
    return { object: clone, mixer: animationMixer, actions: byName }
  }, [nodes, clips, rootName])
  const current = useRef(null)
  useEffect(() => () => mixer.stopAllAction(), [mixer])
  useFrame((_, dt) => {
    const wanted = person.state === 'walk' ? 'walk' : person.state === 'work' ? 'work' : 'idle'
    if (current.current !== wanted) {
      const next = actions[wanted]
      const previous = current.current && actions[current.current]
      next.reset().fadeIn(FADE_SECONDS).play()
      if (previous) previous.fadeOut(FADE_SECONDS)
      current.current = wanted
    }
    mixer.update(Math.min(dt, 1 / 15))
    object.position.set(person.position.x, 0, person.position.z)
    const difference = Math.atan2(Math.sin(person.heading - object.rotation.y), Math.cos(person.heading - object.rotation.y))
    object.rotation.y += difference * Math.min(1, dt * 8)
  })
  return <primitive object={object} {...pointerHandlers(person.id)} />
}

// ---------- selection ring, pins and tag ----------

function toolRadius(tool) {
  const { min, max } = geometry[`tool_${tool.variant}`]
  return Math.max(max[0] - min[0], max[2] - min[2]) / 2 + 0.6
}

function entityRadius(entity) {
  switch (entity.type) {
    case 'tool':
      return toolRadius(entity.item)
    case 'stocker':
      return 3.4
    case 'vehicle':
      return 1.1
    case 'lot':
      return 0.7
    case 'person':
      return 0.75
    case 'building': {
      const { min, max } = geometry[entity.item.node]
      return Math.max(max[0] - min[0], max[2] - min[2]) / 2 + 4
    }
    case 'truck':
      return 7.5
    default:
      return 1
  }
}

// Height of the top of an entity, where its pin sits.
export function entityTop(entity) {
  switch (entity.type) {
    case 'tool':
      return entity.item.height
    case 'stocker':
      return entity.item.height
    case 'vehicle':
      return RAIL_Y + 1.1
    case 'lot':
      return entity.position.y + 0.5
    case 'person':
      return 1.9
    case 'building':
      return geometry[entity.item.node].max[1]
    case 'truck':
      return 4
    default:
      return 2
  }
}

function useFollowSelected(selectedId, apply) {
  const groupRef = useRef()
  useFrame((frameState, dt) => {
    const entity = findEntity(selectedId)
    const group = groupRef.current
    if (!group) return
    group.visible = Boolean(entity)
    if (entity) apply(group, entity, frameState, dt)
  })
  return groupRef
}

export function SelectionRing({ selectedId, floorY = 0.06 }) {
  const materialRef = useRef()
  const groupRef = useFollowSelected(selectedId, (group, entity, frameState) => {
    group.position.set(entity.position.x, floorY, entity.position.z)
    const pulse = 1 + Math.sin(frameState.clock.elapsedTime * 3) * 0.04
    group.scale.setScalar(entityRadius(entity) * pulse)
    materialRef.current.opacity = 0.8 + Math.sin(frameState.clock.elapsedTime * 3) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[0.88, 1, 64]} />
        <meshBasicMaterial ref={materialRef} color={BRAND} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} renderOrder={1}>
        <circleGeometry args={[0.88, 64]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function Pin({ color, follow, scale = 1, bob = 0 }) {
  const groupRef = useRef()
  useFrame(({ clock }) => {
    const target = follow()
    if (!target) return
    groupRef.current.position.set(target.x, target.y + 2.2 * scale + Math.sin(clock.elapsedTime * 2 + bob) * 0.25 * scale, target.z)
  })
  return (
    <group ref={groupRef} scale={scale}>
      <mesh material={standard(color, { roughness: 0.35 })} castShadow>
        <sphereGeometry args={[1.0, 24, 18]} />
      </mesh>
      <mesh position={[0, -1.4, 0]} rotation={[Math.PI, 0, 0]} material={standard(color, { roughness: 0.35 })}>
        <coneGeometry args={[0.68, 1.5, 24]} />
      </mesh>
      <Billboard>
        <mesh position={[0, 0, 0.8]}>
          <circleGeometry args={[0.44, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </Billboard>
    </group>
  )
}

function entityTag(state, entity) {
  switch (entity.type) {
    case 'tool':
      return { title: entity.item.name, status: toolStatus(entity.item) }
    case 'stocker':
      return { title: entity.item.name, status: { icon: 'stack', label: `${entity.item.lots.length} pods stored`, tone: 'muted' } }
    case 'vehicle':
      return { title: entity.item.name, status: vehicleStatus(state, entity.item) }
    case 'lot':
      return { title: `Lot ${entity.item.name}`, status: lotStatus(state, entity.item) }
    case 'person':
      return { title: entity.item.name, status: personStatus(state, entity.item) }
    case 'building':
      return { title: entity.item.name, status: null }
    case 'truck':
      return { title: entity.item.name, status: truckStatus(state, entity.item) }
    default:
      return { title: '', status: null }
  }
}

export function NameTag({ selectedId, scale = 1 }) {
  useUi()
  const state = currentSite()
  const entity = findEntity(selectedId)
  const groupRef = useFollowSelected(selectedId, (group, current) => {
    group.position.set(current.position.x, entityTop(current) + 4.6 * scale, current.position.z)
  })
  if (!entity) return null
  const { title, status } = entityTag(state, entity)
  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="scene-tag">
          <strong>{title}</strong>
          {status && (
            <span className={`tone-${status.tone}`}>
              <StatusIcon name={status.icon} />
              {status.label}
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}


// Changes only when the set of down tools changes, so pins are not rebuilt every refresh.
function downSignature(state) {
  return state.tools.filter((tool) => tool.state === 'down').map((tool) => tool.id).join(',')
}

export function FabUnits({ state }) {
  const { nodes, clips } = useAssets()
  const selectedId = useUiValue((ui) => ui.selectedId)
  useUiValue(() => downSignature(state))
  const downTools = state.tools.filter((tool) => tool.state === 'down' && tool.id !== selectedId)
  const pinTarget = (id) => () => {
    const entity = findEntity(id, state)
    return entity && { x: entity.position.x, y: entityTop(entity), z: entity.position.z }
  }
  return (
    <group>
      {state.vehicles.map((vehicle) => (
        <Vehicle key={vehicle.id} vehicle={vehicle} nodes={nodes} />
      ))}
      <Pods state={state} nodes={nodes} />
      {state.people.map((person) => (
        <Person key={person.id} person={person} nodes={nodes} clips={clips} />
      ))}
      <SelectionRing selectedId={selectedId} />
      {selectedId && <Pin key={selectedId} color={BRAND} scale={0.42} follow={pinTarget(selectedId)} />}
      {downTools.map((tool, index) => (
        <Pin key={tool.id} color="#e5484d" scale={0.42} follow={pinTarget(tool.id)} bob={index * 1.7} />
      ))}
      <NameTag selectedId={selectedId} scale={0.42} />
    </group>
  )
}
