// Markers over the world: selection ring, pins, the floating name tag, and pointer handlers.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import { currentSite, findEntity, selectEntity, useUi } from '../store.js'
import { bedStatus, heliStatus, patientStatus, personStatus, roomStatus, vehicleStatus } from '../status.js'
import { TRIAGE } from '../data.js'
import { BRAND, standard } from './materials.js'
import { StatusIcon } from '../ui/Icon.jsx'

export function pointerHandlers(id) {
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

// Ring radius fitted to each footprint (no more than about 1.3 times the object's half length).
function entityRadius(entity) {
  switch (entity.type) {
    case 'patient':
      return 1.2
    case 'bed':
      return entity.item.kind === 'resus' ? 2.2 : 1.65
    case 'vehicle':
      return 3.9
    case 'heli':
      return 6.2
    case 'person':
      return 0.5
    case 'room':
      return entity.item.kind === 'xray' ? 2.3 : entity.item.kind === 'lab' ? 2.6 : 1.9
    default:
      return 1
  }
}

// Height of the top of an entity, where its pin sits.
export function entityTop(entity) {
  switch (entity.type) {
    case 'patient':
      return entity.position.y + (entity.item.carrier?.type === 'person' ? 1.85 : 0.9)
    case 'bed':
      return 2.5
    case 'vehicle':
      return 3.5
    case 'heli':
      return entity.position.y + 3.9
    case 'person':
      return 1.9
    case 'room':
      return 2.4
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
        <meshBasicMaterial ref={materialRef} color={BRAND} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} renderOrder={1}>
        <circleGeometry args={[0.88, 64]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.14} depthWrite={false} depthTest={false} />
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
  const item = entity.item
  switch (entity.type) {
    case 'patient':
      return { title: `${item.id} · ${TRIAGE[item.level].short}`, status: patientStatus(item) }
    case 'bed':
      return { title: item.name, status: bedStatus(item) }
    case 'vehicle':
      return { title: item.name, status: vehicleStatus(item) }
    case 'heli':
      return { title: item.name, status: heliStatus(item) }
    case 'person':
      return { title: item.name, status: personStatus(item) }
    case 'room':
      return { title: item.name, status: roomStatus(item) }
    default:
      return { title: '', status: null }
  }
}

export function NameTag({ selectedId, scale = 1 }) {
  useUi()
  const state = currentSite()
  const entity = findEntity(selectedId)
  const groupRef = useFollowSelected(selectedId, (group, current) => {
    group.position.set(current.position.x, entityTop(current) + 3.2 * scale, current.position.z)
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


