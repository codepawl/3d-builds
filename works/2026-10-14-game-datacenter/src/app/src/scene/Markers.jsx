// Selection ring under the selected object and pins over open alerts.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { entityPosition } from '../world.js'
import { selectedEntity, useModelVersion } from '../store.js'
import { COLORS } from './palette.js'
import { selectOnClick } from './picking.js'

// How high the selection pin hovers above each kind of object, clear of the tallest racks around it.
const PIN_HEIGHT = { rack: 3.4, robot: 2.9, tech: 3.0, crah: 3.4, chiller: 3.3, substation: 4.2, battery: 4.0 }
const DEFAULT_PIN_HEIGHT = 3.2
const RING_RADIUS = { rack: 0.95, robot: 0.85, tech: 0.6, crah: 1.5, chiller: 2.2, substation: 5.2, battery: 4.4, job: 6 }

function ringRadius(entity) {
  if (entity.kind === 'alert' || entity.kind === 'ticket') return 1.1
  return RING_RADIUS[entity.kind] ?? 1
}

const RING_COLOR = [0.55, 0.45, 2.4]
const OVERLAY_RENDER_ORDER = 1000

// The ring on the floor, a second thinner ring drawn over everything so racks cannot hide it, and a pin above the object.
function SelectionRing({ world }) {
  const ringRef = useRef()
  const pinRef = useRef()
  useFrame(({ clock }) => {
    const ring = ringRef.current
    const pin = pinRef.current
    const entity = selectedEntity()
    ring.visible = Boolean(entity)
    pin.visible = Boolean(entity)
    if (!entity) return
    const { x, z } = entityPosition(world, entity)
    const pulse = 1 + 0.06 * Math.sin(clock.elapsedTime * 4)
    const radius = ringRadius(entity) * pulse
    ring.position.set(x, 0.035, z)
    ring.scale.set(radius, 1, radius)
    const height = PIN_HEIGHT[entity.kind] ?? DEFAULT_PIN_HEIGHT
    pin.position.set(x, height + Math.sin(clock.elapsedTime * 3) * 0.1, z)
  })
  return (
    <group>
      <group ref={ringRef}>
        <mesh rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.9, 1, 64]} />
          <meshBasicMaterial color={RING_COLOR} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.9, 64]} />
          <meshBasicMaterial color={COLORS.brand} transparent opacity={0.14} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} renderOrder={OVERLAY_RENDER_ORDER}>
          <ringGeometry args={[0.93, 1, 64]} />
          <meshBasicMaterial color={RING_COLOR} toneMapped={false} transparent opacity={0.8} depthTest={false} depthWrite={false} />
        </mesh>
      </group>
      <group ref={pinRef}>
        <mesh rotation-x={Math.PI} renderOrder={OVERLAY_RENDER_ORDER}>
          <coneGeometry args={[0.3, 0.6, 4]} />
          <meshBasicMaterial color={RING_COLOR} toneMapped={false} depthTest={false} depthWrite={false} transparent />
        </mesh>
        <mesh position-y={0.55} renderOrder={OVERLAY_RENDER_ORDER}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} depthTest={false} depthWrite={false} transparent />
        </mesh>
      </group>
    </group>
  )
}

function Pin({ alert, world }) {
  const groupRef = useRef()
  const target = world.index.get(alert.targetId)
  const height = target?.kind === 'rack' ? 3.5 : 3.1
  const color = alert.severity === 'critical' ? COLORS.critical : COLORS.warn
  useFrame(({ clock }) => {
    if (!target) return
    const position = entityPosition(world, target)
    groupRef.current.position.set(position.x, height + Math.sin(clock.elapsedTime * 2.4 + alert.createdAt) * 0.12, position.z)
  })
  if (!target) return null
  return (
    <group ref={groupRef} onClick={selectOnClick(() => alert.targetId)}>
      <mesh castShadow>
        <sphereGeometry args={[0.34, 24, 18]} />
        <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position-y={-0.42} rotation-x={Math.PI}>
        <coneGeometry args={[0.2, 0.5, 20]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position-y={0}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

export function Markers({ world }) {
  useModelVersion()
  return (
    <group>
      <SelectionRing world={world} />
      {world.alerts.filter((alert) => !alert.resolved).map((alert) => <Pin key={alert.id} alert={alert} world={world} />)}
    </group>
  )
}
