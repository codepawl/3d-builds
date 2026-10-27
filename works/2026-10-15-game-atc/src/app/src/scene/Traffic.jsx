// Every flight on the scope: the Blender airframe in its livery, a data tag, the radar history
// trail, a drop line to the ground and the separation ring that turns amber and red.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AIRCRAFT_TYPES } from '../data.js'
import { selectEntity, setUi, useUiValue } from '../store.js'
import { aircraftModel, findParts, useAssets } from './assets.jsx'

const RING_COLORS = { none: '#55657f', amber: '#f2a516', red: '#ef4444', selected: '#2a4fd8' }
const TRAIL_COLOR = new THREE.Color('#2a4fd8')
const GROUND_COLOR = new THREE.Color('#e6edf4')
const TAG_SIZE = { width: 100, height: 48, gap: 4 }

// Data tags that would overlap on screen are stacked upward, the way a radar display declutters
// labels. Each tag registers its element and anchor here; Declutter moves them once per frame.
const tags = new Map()

function Declutter() {
  const projected = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const items = []
    tags.forEach((entry) => {
      if (entry.element.style.display === 'none') return
      projected.set(entry.anchor.x, entry.anchor.y, entry.anchor.z).project(camera)
      if (projected.z > 1) return
      items.push({ entry, x: ((projected.x + 1) / 2) * size.width, y: ((1 - projected.y) / 2) * size.height })
    })
    items.sort((a, b) => b.y - a.y)
    const placed = []
    items.forEach((item) => {
      const box = (offset) => ({ left: item.x + 10, right: item.x + 10 + TAG_SIZE.width, top: item.y - 6 - TAG_SIZE.height + offset, bottom: item.y - 6 + offset })
      const overlaps = (candidate) => placed.some((other) => candidate.left < other.right && candidate.right > other.left && candidate.top < other.bottom && candidate.bottom > other.top)
      let target = 0
      for (let step = 0; step < 6 && overlaps(box(target)); step++) target -= TAG_SIZE.height + TAG_SIZE.gap
      placed.push(box(target))
      const entry = item.entry
      entry.offset += (target - entry.offset) * 0.25
      entry.element.style.translate = `0 ${entry.offset.toFixed(1)}px`
    })
  })
  return null
}

// Map scale grows with altitude in the wide sectors so jets read at sector zoom but still fit the runway.
function visualScale(site, flight) {
  if (site.aircraftScale === 1) return 1
  if (site.id === 'CTR') return site.aircraftScale
  const lift = Math.min(1, flight.altitude / 3000)
  return 1 + (site.aircraftScale - 1) * lift
}

function useBlink(parts, period, onFraction, phase) {
  useFrame(({ clock }) => {
    const on = (clock.elapsedTime + phase) % period < period * onFraction
    parts.forEach((part) => {
      part.visible = on
    })
  })
}

function Airframe({ flight, phase }) {
  const nodes = useAssets()
  const variant = AIRCRAFT_TYPES[flight.type].variant
  const model = useMemo(() => aircraftModel(nodes, variant, flight.airline).clone(true), [nodes, variant, flight.airline])
  const parts = useMemo(
    () => ({
      spinners: [...findParts(model, `${variant}_fan_`), ...findParts(model, `${variant}_prop_`)],
      props: variant.startsWith('prop'),
      gear: findParts(model, `${variant}_gear_`).filter((part) => part.parent.name === variant),
      beacons: findParts(model, `${variant}_beacon_`),
      strobes: findParts(model, `${variant}_strobe`),
      landingLights: findParts(model, `${variant}_landing_light`),
    }),
    [model, variant],
  )
  useBlink(parts.beacons, 1.1, 0.14, phase)
  useBlink(parts.strobes, 1.3, 0.06, phase + 0.4)
  useFrame((_, dt) => {
    const running = flight.phase !== 'parked'
    const speed = running ? (parts.props ? 40 : 24) : 0.5
    parts.spinners.forEach((spinner) => {
      spinner.rotation.z += speed * dt
    })
    parts.gear.forEach((gear) => {
      gear.visible = flight.gearDown
    })
    parts.landingLights.forEach((light) => {
      light.visible = flight.gearDown && flight.phase !== 'parked'
    })
  })
  return <primitive object={model} />
}

function DataTag({ flight, site, selected }) {
  const tagRef = useRef()
  const lines = useRef({})
  // Html mounts its content in a later commit, so the tag registers itself once its element exists.
  useEffect(() => () => tags.delete(flight.id), [flight])
  useFrame(() => {
    const tag = tagRef.current
    if (!tag) return
    if (tags.get(flight.id)?.element !== tag) tags.set(flight.id, { element: tag, anchor: flight.position, offset: 0 })
    const level = Math.round(flight.altitude / 100)
    const cleared = Math.round(flight.clearedAltitude / 100)
    const trend = flight.mode === 'track' || Math.abs(flight.clearedAltitude - flight.altitude) < 60 ? '' : flight.clearedAltitude > flight.altitude ? '↑' : '↓'
    const second = flight.altitude < 50 ? `GND ${Math.round(flight.speed)}kt` : `${String(level).padStart(3, '0')}${trend}${trend ? String(cleared).padStart(3, '0') : ''}  ${Math.round(flight.speed)}kt`
    if (lines.current.second !== second) {
      lines.current.second = second
      tag.querySelector('.tag-data').textContent = second
    }
    // Ground traffic is tower's business; the radar sectors only label what is in the air.
    const hidden = site.id !== 'TWR' && flight.altitude < 50
    if (lines.current.hidden !== hidden) {
      lines.current.hidden = hidden
      tag.style.display = hidden ? 'none' : ''
    }
    const alert = flight.alert
    if (lines.current.alert !== alert) {
      lines.current.alert = alert
      tag.dataset.alert = alert
    }
  })
  return (
    <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={tagRef}
        className={selected ? 'data-tag selected' : 'data-tag'}
        data-id={flight.id}
        onClick={(event) => {
          event.stopPropagation()
          setUi({ selectedId: flight.id })
        }}
      >
        <span className="tag-callsign">{flight.callsign}</span>
        <span className="tag-data" />
        <span className="tag-type">{flight.type}{site.id === 'TWR' && flight.standIndex !== null && flight.phase !== 'climb' ? ` · S${flight.standIndex + 1}` : ''}</span>
      </div>
    </Html>
  )
}

// History dots and a fading line from the oldest radar return to the aircraft.
function Trail({ flight }) {
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(new Float32Array(18 * 3), 3))
    return buffer
  }, [])
  const objects = useMemo(() => {
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }))
    const dots = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: 4.5, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }))
    line.frustumCulled = false
    dots.frustumCulled = false
    return { line, dots }
  }, [geometry])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => {
    const points = [...flight.history, flight.position]
    const positions = geometry.attributes.position
    const colors = geometry.attributes.color
    const color = new THREE.Color()
    points.forEach((point, index) => {
      positions.setXYZ(index, point.x, point.y, point.z)
      color.copy(GROUND_COLOR).lerp(TRAIL_COLOR, (index + 1) / points.length)
      colors.setXYZ(index, color.r, color.g, color.b)
    })
    geometry.setDrawRange(0, points.length)
    positions.needsUpdate = true
    colors.needsUpdate = true
  })
  return (
    <>
      <primitive object={objects.line} />
      <primitive object={objects.dots} />
    </>
  )
}

function FlightView({ flight, site, selected, phase }) {
  const bodyRef = useRef()
  const ringRef = useRef()
  const dropRef = useRef()
  const markerRef = useRef()
  const tagAnchorRef = useRef()
  const motion = useRef({ heading: flight.heading, bank: 0 })
  const ringRadius = (site.minimumSeparation * site.nm) / 2
  const dropGeometry = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), [])
  useFrame(({ clock }, dt) => {
    const scale = visualScale(site, flight)
    const { x, y, z } = flight.position
    const state = motion.current
    const turn = ((flight.heading - state.heading + 540) % 360) - 180
    state.heading = flight.heading
    const targetBank = flight.altitude > 200 ? THREE.MathUtils.clamp((turn / Math.max(dt, 1e-3)) * 0.004, -0.45, 0.45) : 0
    state.bank = THREE.MathUtils.damp(state.bank, targetBank, 3, dt)
    const body = bodyRef.current
    body.position.set(x, y, z)
    body.rotation.set(0, Math.PI - (flight.heading * Math.PI) / 180, 0)
    body.rotateZ(-state.bank)
    const pitch = flight.mode === 'steer' && flight.altitude > 200 ? THREE.MathUtils.clamp((flight.clearedAltitude - flight.altitude) / 4000, -0.06, 0.12) : flight.phase === 'climb' ? 0.12 : 0
    body.rotateX(-pitch)
    body.scale.setScalar(scale)
    tagAnchorRef.current.position.set(x, y + 4.6 * scale, z)

    const airborne = flight.altitude > 300
    const ring = ringRef.current
    ring.visible = airborne
    ring.position.set(x, y, z)
    const alert = flight.alert
    ring.material.color.set(alert !== 'none' ? RING_COLORS[alert] : selected ? RING_COLORS.selected : RING_COLORS.none)
    ring.material.opacity = alert === 'red' ? 0.6 + Math.sin(clock.elapsedTime * 10) * 0.3 : alert === 'amber' ? 0.8 : selected ? 0.7 : 0.28
    const drop = dropRef.current
    drop.visible = airborne
    const positions = dropGeometry.attributes.position
    positions.setXYZ(0, x, y, z)
    positions.setXYZ(1, x, 0.4, z)
    positions.needsUpdate = true
    markerRef.current.visible = airborne
    markerRef.current.position.set(x, 0.5, z)
  })
  const select = (event) => selectEntity(event, flight.id)
  const ringWidth = site.nm * 0.05
  return (
    <group>
      <group ref={bodyRef} onClick={select}>
        <Airframe flight={flight} phase={phase} />
      </group>
      <group ref={tagAnchorRef}>
        <DataTag flight={flight} site={site} selected={selected} />
      </group>
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[ringRadius - ringWidth, ringRadius, 72]} />
        <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments ref={dropRef} geometry={dropGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#51617d" transparent opacity={0.45} />
      </lineSegments>
      <mesh ref={markerRef} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[site.nm * 0.09, 20]} />
        <meshBasicMaterial color="#51617d" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Trail flight={flight} />
    </group>
  )
}

// Re-renders when flights are added or removed; positions update every frame inside each view.
export function Traffic({ state }) {
  const selectedId = useUiValue((ui) => ui.selectedId)
  // The roster string changes only when flights come or go, which re-renders this list.
  useUiValue(() => state.flights.map((flight) => flight.id).join(","))
  return (
    <>
      <Declutter />
      {state.flights.map((flight, index) => (
        <FlightView key={flight.id} flight={flight} site={state.site} selected={flight.id === selectedId} phase={index * 0.37} />
      ))}
    </>
  )
}
