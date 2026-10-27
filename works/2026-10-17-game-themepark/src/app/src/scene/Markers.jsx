// Markers over the world: selection ring (an ellipse fitted to the footprint), pins and the name tag.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import { findEntity, selectEntity, useUi } from '../store.js'
import { entityStatus } from '../status.js'
import { BRAND, standard } from './materials.js'
import { StatusIcon } from '../ui/Icon.jsx'

export function pointerHandlers(id) {
  if (!id) return {}
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

const UNIT_SHAPES = { train: [1.5, 8.4], boat: [1.3, 3.0], monorail: [2.2, 19], tram: [1.7, 10], cart: [1.4, 2.4], float: [2.4, 5.4], staff: [0.7, 0.7] }

// Half sizes (across, along) of the ring for an entity, its centre offset along its heading, and the ring height.
export function ringShape(entity) {
  if (entity.type === 'ride') return { half: [entity.item.footprint.rx * 1.05, entity.item.footprint.rz * 1.05], heading: 0, y: 0.08, shift: 0 }
  if (entity.type === 'stand') return { half: [entity.item.kind === 'retail' ? 7 : 3.4, entity.item.kind === 'retail' ? 7 : 3.4], heading: 0, y: 0.08, shift: 0 }
  const half = UNIT_SHAPES[entity.type] ?? [1.5, 1.5]
  const shift = entity.type === 'train' ? -5.8 : entity.type === 'tram' ? -1 : 0
  return { half, heading: entity.item.heading ?? 0, y: entity.type === 'train' || entity.type === 'boat' ? entity.position.y - 0.6 : entity.position.y + 0.08, shift }
}

export function entityTop(entity) {
  if (entity.type === 'ride') return entity.item.top
  if (entity.type === 'stand') return entity.item.kind === 'retail' ? 9 : 5
  if (entity.type === 'monorail') return entity.position.y + 3.6
  if (entity.type === 'train') return entity.position.y + 4.2
  if (entity.type === 'staff') return 1.9
  if (entity.type === 'float') return 6
  return entity.position.y + 2.4
}

// The heading of a coaster car or boat comes from its track; the ring follows the lead car.
function trackHeading(entity) {
  return entity.item.heading ?? 0
}

export function SelectionRing({ selectedId }) {
  const groupRef = useRef()
  const lineRef = useRef()
  useFrame(({ clock }) => {
    const entity = findEntity(selectedId)
    const group = groupRef.current
    group.visible = Boolean(entity)
    if (!entity) return
    const shape = ringShape(entity)
    const heading = entity.type === 'train' || entity.type === 'boat' ? trackHeading(entity) : shape.heading
    group.position.set(entity.position.x + Math.sin(heading) * shape.shift, shape.y, entity.position.z + Math.cos(heading) * shape.shift)
    group.rotation.y = heading
    const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.03
    group.scale.set(shape.half[0] * pulse, 1, shape.half[1] * pulse)
    lineRef.current.opacity = 0.85 + Math.sin(clock.elapsedTime * 3) * 0.12
  })
  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.9, 1, 96]} />
        <meshBasicMaterial ref={lineRef} color={BRAND} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} renderOrder={2}>
        <circleGeometry args={[0.9, 96]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.16} depthWrite={false} />
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

export function NameTag({ selectedId }) {
  useUi()
  const entity = findEntity(selectedId)
  const groupRef = useRef()
  useFrame(() => {
    const current = findEntity(selectedId)
    if (!current || !groupRef.current) return
    groupRef.current.position.set(current.position.x, entityTop(current) + 4.6, current.position.z)
  })
  if (!entity) return null
  const status = entityStatus(entity)
  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="scene-tag">
          <strong>{entity.item.name}</strong>
          <span className={`tone-${status.tone}`}>
            <StatusIcon name={status.icon} />
            {status.label}
          </span>
        </div>
      </Html>
    </group>
  )
}
