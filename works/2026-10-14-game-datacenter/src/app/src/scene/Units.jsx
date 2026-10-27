// Robot swap carts and technicians, moved every frame from the model.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MeshBasicMaterial } from 'three'
import { model, useModelVersion } from '../store.js'
import { StatusIcon } from '../ui/icons.jsx'
import { unitTone } from '../describe.js'
import { findChild, useAssetClone } from './assets.jsx'
import { selectOnClick } from './picking.js'

const BEACON_COLORS = {
  moving: [1.2, 1.0, 3.2],
  working: [3.0, 1.7, 0.2],
  charging: [0.4, 2.6, 0.9],
  inspecting: [1.2, 1.0, 3.2],
  idle: [1.4, 1.5, 1.8],
}

function turnToward(current, target, amount) {
  let difference = target - current
  while (difference > Math.PI) difference -= Math.PI * 2
  while (difference < -Math.PI) difference += Math.PI * 2
  return current + difference * amount
}

// An invisible box around a unit so clicks land on it rather than the rack behind.
function HitVolume({ size }) {
  return (
    <mesh position-y={size[1] / 2}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function useFollowUnit(unit, onFrame) {
  const groupRef = useRef()
  useFrame((state, delta) => {
    const group = groupRef.current
    group.position.set(unit.x, 0, unit.z)
    group.rotation.y = turnToward(group.rotation.y, unit.heading, Math.min(1, delta * 8))
    onFrame?.(state, delta)
  })
  return groupRef
}

const WHEEL_RADIUS = 0.12
const TECH_VARIANTS = ['tech_a', 'tech_b', 'tech_c']

function Robot({ unit }) {
  const cart = useAssetClone('units', 'robot')
  const parts = useMemo(() => {
    const beacon = findChild(cart, 'robot_beacon')
    // Each cart's beacon shows its own state, so it gets its own unlit material that can glow past 1 into the bloom.
    beacon.material = new MeshBasicMaterial({ toneMapped: false })
    return {
      beacon,
      lift: findChild(cart, 'robot_lift'),
      cargo: findChild(cart, 'robot_cargo'),
      wheels: ['fl', 'fr', 'rl', 'rr'].map((label) => findChild(cart, `robot_wheel_${label}`)),
    }
  }, [cart])
  const groupRef = useFollowUnit(unit, ({ clock }, delta) => {
    const color = BEACON_COLORS[unit.state] ?? BEACON_COLORS.idle
    const pulse = unit.state === 'working' ? 0.6 + 0.4 * Math.abs(Math.sin(clock.elapsedTime * 6)) : 1
    parts.beacon.material.color.setRGB(color[0] * pulse, color[1] * pulse, color[2] * pulse)
    parts.cargo.visible = Boolean(unit.carrying)
    // While swapping, the lift rises toward the failing tray.
    const liftTarget = unit.state === 'working' ? 0.55 + 0.35 * Math.sin(unit.workProgress * Math.PI) : 0
    parts.lift.position.y += (liftTarget - parts.lift.position.y) * 0.1
    const roll = unit.state === 'moving' ? (unit.speed * delta) / WHEEL_RADIUS : 0
    for (const wheel of parts.wheels) wheel.rotation.x += roll
  })
  return (
    <group ref={groupRef} onClick={selectOnClick(() => unit.id)}>
      <HitVolume size={[1.3, 1.5, 1.5]} />
      <primitive object={cart} />
    </group>
  )
}

function Technician({ unit, variant }) {
  const figure = useAssetClone('units', variant)
  const parts = useMemo(() => ({
    leftLeg: findChild(figure, '_leg_l'),
    rightLeg: findChild(figure, '_leg_r'),
    body: findChild(figure, '_body'),
    leftArm: findChild(figure, '_arm_l'),
    rightArm: findChild(figure, '_arm_r'),
  }), [figure])
  const groupRef = useFollowUnit(unit, ({ clock }) => {
    const walking = unit.state === 'moving'
    const swing = walking ? Math.sin(clock.elapsedTime * 9) * 0.55 : 0
    parts.leftLeg.rotation.x = swing
    parts.rightLeg.rotation.x = -swing
    parts.leftArm.rotation.x = -swing * 0.7
    parts.rightArm.rotation.x = swing * 0.4
    parts.body.position.y = walking ? Math.abs(Math.cos(clock.elapsedTime * 9)) * 0.04 : 0
  })
  return (
    <group ref={groupRef} onClick={selectOnClick(() => unit.id)}>
      <HitVolume size={[0.9, 2.0, 0.9]} />
      <primitive object={figure} />
    </group>
  )
}


function UnitLabel({ unit }) {
  const groupRef = useRef()
  useFrame(() => groupRef.current.position.set(unit.x, unit.kind === 'robot' ? 1.75 : 2.2, unit.z))
  const shortName = unit.kind === 'robot' ? unit.id.split('-').pop() : unit.name.replace('Technician ', '')
  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="unit-chip">
          <StatusIcon tone={unitTone(unit)} size={12} />
          <strong>{shortName}</strong>
          <span>{unit.task}</span>
        </div>
      </Html>
    </group>
  )
}

export function Units({ world }) {
  useModelVersion()
  return (
    <group>
      {world.units.map((unit, index) => (unit.kind === 'robot' ? <Robot key={unit.id} unit={unit} /> : <Technician key={unit.id} unit={unit} variant={TECH_VARIANTS[index % TECH_VARIANTS.length]} />))}
      {world.units
        .filter((unit) => unit.ticketId || unit.id === model.selectedId)
        .map((unit) => <UnitLabel key={unit.id} unit={unit} />)}
    </group>
  )
}
