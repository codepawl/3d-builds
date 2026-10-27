import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { buildSite } from './buildSite.js'
import { siteById, LANE_X } from '../data/canal.js'
import { buildSnapshot, detailFor } from '../snapshot.js'
import { getState, setState, useStore, cameraBus } from '../store.js'
import { tick as playbackTick, stopTour } from '../playback.js'
import { STAGE_FLY_SECONDS } from '../data/stages.js'
import { StatusIcon } from '../ui/icons.jsx'

const SNAPSHOT_INTERVAL = 0.25
const MIN_DISTANCE = 40
const MAX_DISTANCE = 2400

export function Scene({ assets, simulation }) {
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 28, near: 0.5, far: 7000, position: [-300, 400, 800] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap }}
    >
      <color attach="background" args={['#cfe3f1']} />
      <fog attach="fog" args={['#cfe3f1', 2600, 7000]} />
      <World assets={assets} simulation={simulation} />
    </Canvas>
  )
}

function presetFor(siteId, world) {
  const geometry = world.siteGeometry
  if (siteId === 'lake') return { target: [0, geometry.floorY(0) + 14, -120], yaw: -0.8, pitch: 0.6, distance: 640 }
  if (siteId === 'control') return { target: [world.center.x - 70, world.center.y + 14, world.center.z], yaw: -1.15, pitch: 0.4, distance: 430 }
  return { target: [0, geometry.floorY(1) + 20, -geometry.chamberCentreS(1)], yaw: -0.8, pitch: 0.58, distance: 1150 }
}

function World({ assets, simulation }) {
  const siteId = useStore((state) => state.siteId)
  const world = useMemo(() => buildSite({ siteId, assets, simulation }), [siteId, assets, simulation])
  const snapshotTimer = useRef(99)
  const camera = useThree((state) => state.camera)
  const rig = useRef(null)

  useEffect(() => {
    window.__world = world
    window.__sim = simulation
    window.__project = (ref, lift = 0) => {
      const pose = world.poseOf(ref)
      if (!pose) return null
      const point = new THREE.Vector3(pose.x, pose.y + lift, pose.z).project(camera)
      return { x: ((point.x + 1) / 2) * window.innerWidth, y: ((1 - point.y) / 2) * window.innerHeight }
    }
    window.__rig = rig
  }, [world, simulation, camera])

  useFrame((state, delta) => {
    const clamped = Math.min(delta, 0.1)
    playbackTick(clamped)
    simulation.advance(clamped)
    world.update(clamped, simulation.renderTime)
    snapshotTimer.current += clamped
    if (snapshotTimer.current >= SNAPSHOT_INTERVAL) {
      snapshotTimer.current = 0
      const current = getState()
      const focusRef = current.selected?.type === 'ship' ? current.selected : current.following?.type === 'ship' ? current.following : null
      const snapshot = buildSnapshot(simulation, current.siteId, focusRef)
      setState({ snapshot, detail: detailFor(simulation, snapshot, current.selected, current.siteId) })
    }
  })

  return (
    <>
      <primitive object={world.group} />
      <Lighting rig={rig} />
      <CameraRig world={world} siteId={siteId} rig={rig} />
      <SelectionRing world={world} />
      <Pins world={world} rig={rig} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO aoRadius={6} distanceFalloff={1.5} intensity={2.4} quality="medium" halfRes />
        <Bloom intensity={0.5} luminanceThreshold={1.1} luminanceSmoothing={0.25} mipmapBlur radius={0.6} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <SMAA />
      </EffectComposer>
    </>
  )
}

function Lighting({ rig }) {
  const light = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    if (!light.current || !rig.current) return
    const { target: focus, distance } = rig.current.current
    const half = distance < 260 ? 170 : distance < 520 ? 320 : distance < 900 ? 520 : 900
    const camera = light.current.shadow.camera
    if (camera.right !== half) {
      camera.left = -half
      camera.right = half
      camera.top = half
      camera.bottom = -half
      camera.updateProjectionMatrix()
    }
    const texel = (half * 2) / 4096
    const snappedX = Math.round(focus.x / (texel * 8)) * texel * 8
    const snappedZ = Math.round(focus.z / (texel * 8)) * texel * 8
    target.position.set(snappedX, focus.y, snappedZ)
    light.current.position.set(snappedX - 320, focus.y + 520, snappedZ + 260)
    target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#e4f0ff', '#b9b1a5', 1.0]} />
      <directionalLight
        ref={light}
        color="#fff3df"
        intensity={2.3}
        castShadow
        target={target}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.7}
        shadow-radius={4}
        shadow-camera-near={10}
        shadow-camera-far={1800}
      />
    </>
  )
}

function CameraRig({ world, siteId, rig }) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const initial = useMemo(() => {
    const preset = presetFor(siteId, world)
    return { target: new THREE.Vector3(...preset.target), yaw: preset.yaw, pitch: preset.pitch, distance: preset.distance }
  }, [siteId, world])

  if (!rig.current) {
    rig.current = {
      current: { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance * 1.2 },
      goal: { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance },
      follow: null,
      orbit: false,
      siteKey: siteId,
    }
  }
  if (rig.current.siteKey !== siteId) {
    rig.current.siteKey = siteId
    rig.current.current = { target: initial.target.clone(), yaw: initial.yaw - 0.45, pitch: initial.pitch + 0.1, distance: initial.distance * 1.25 }
    rig.current.goal = { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance }
    rig.current.follow = null
    rig.current.orbit = false
    queueMicrotask(() => setState({ following: null, orbiting: false }))
  }

  useEffect(() => {
    const element = gl.domElement
    let dragging = null
    const pointerRay = (event) => {
      const rect = element.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return pickWith(raycaster, world)
    }
    const onDown = (event) => {
      stopTour()
      cancelFly(rig.current)
      dragging = { x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey, moved: 0 }
    }
    const onMove = (event) => {
      if (!dragging) return
      const dx = event.clientX - dragging.x
      const dy = event.clientY - dragging.y
      dragging.x = event.clientX
      dragging.y = event.clientY
      dragging.moved += Math.abs(dx) + Math.abs(dy)
      const goal = rig.current.goal
      if (dragging.button === 2 || dragging.shift) {
        const scale = goal.distance * 0.0016
        const right = new THREE.Vector3(Math.cos(goal.yaw), 0, -Math.sin(goal.yaw))
        const forward = new THREE.Vector3(-Math.sin(goal.yaw), 0, -Math.cos(goal.yaw))
        goal.target.addScaledVector(right, -dx * scale)
        goal.target.addScaledVector(forward, dy * scale)
        rig.current.follow = null
        setState({ following: null })
      } else if (dragging.moved > 3) {
        goal.yaw -= dx * 0.0052
        goal.pitch = Math.min(1.45, Math.max(0.28, goal.pitch + dy * 0.0042))
        if (rig.current.orbit) {
          rig.current.orbit = false
          setState({ orbiting: false })
        }
      }
    }
    const onUp = (event) => {
      const wasClick = dragging && dragging.moved < 4 && dragging.button === 0
      dragging = null
      if (!wasClick) return
      const ref = pointerRay(event)
      if (ref) {
        setState({ selected: ref })
        if (ref.type === 'ship') cameraBus.push({ type: 'fly', ref, follow: true })
      } else {
        rig.current.follow = null
        setState({ selected: null, detail: null, following: null })
      }
    }
    const onWheel = (event) => {
      event.preventDefault()
      stopTour()
      cancelFly(rig.current)
      const goal = rig.current.goal
      goal.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, goal.distance * Math.exp(event.deltaY * 0.0011)))
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        rig.current.follow = null
        setState({ selected: null, detail: null, following: null })
      }
    }
    const onHover = (event) => {
      if (dragging) return
      element.style.cursor = pointerRay(event) ? 'pointer' : 'grab'
    }
    const onContext = (event) => event.preventDefault()
    element.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    element.addEventListener('pointermove', onHover)
    window.addEventListener('pointerup', onUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointermove', onHover)
      window.removeEventListener('pointerup', onUp)
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
    }
  }, [camera, gl, raycaster, world, rig])

  useFrame((state, delta) => {
    const data = rig.current
    const dt = Math.min(delta, 0.1)
    while (cameraBus.pending.length > 0) handleCommand(cameraBus.pending.shift(), data, world, initial)
    if (data.orbit) data.goal.yaw += dt * 0.085
    if (data.follow) {
      const pose = world.poseOf(data.follow)
      if (pose) {
        const focusY = pose.focusY ?? pose.y
        data.goal.target.x = pose.x
        data.goal.target.z = pose.z
        data.goal.target.y = focusY
      }
    }
    if (data.fly) advanceFly(data, dt)
    const blend = data.fly ? 0 : 1 - Math.exp(-dt * 4)
    const current = data.current
    const goal = data.goal
    const follow = data.follow ? 1 - Math.exp(-dt * 9) : blend
    current.target.x += (goal.target.x - current.target.x) * follow
    current.target.z += (goal.target.z - current.target.z) * follow
    current.target.y += (goal.target.y - current.target.y) * (data.follow ? 1 - Math.exp(-dt * 3) : blend)
    current.yaw += (goal.yaw - current.yaw) * blend
    current.pitch += (goal.pitch - current.pitch) * blend
    current.distance += (goal.distance - current.distance) * blend
    let pitch = current.pitch
    const place = () => {
      const horizontal = Math.cos(pitch) * current.distance
      camera.position.set(
        current.target.x + Math.sin(current.yaw) * horizontal,
        current.target.y + Math.sin(pitch) * current.distance,
        current.target.z + Math.cos(current.yaw) * horizontal,
      )
    }
    place()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const clearance = world.clearanceAt(camera.position.x, camera.position.z) + 16
      if (camera.position.y >= clearance) break
      pitch = Math.min(1.5, pitch + 0.08)
      place()
    }
    camera.lookAt(current.target)
  })
  return null
}

function handleCommand(command, data, world, initial) {
  const goal = data.goal
  switch (command.type) {
    case 'fly': {
      const pose = world.poseOf(command.ref)
      if (!pose) return
      data.orbit = false
      data.fly = null
      goal.target.set(pose.x, pose.focusY ?? pose.y, pose.z)
      const wanted = command.distance ?? (command.ref.type === 'ship' ? 400 : command.ref.type === 'chamber' ? 430 : command.ref.type === 'mule' ? 150 : 360)
      goal.distance = Math.max(command.minimum ?? 0, wanted)
      goal.pitch = command.pitch ?? (command.ref.type === 'ship' && command.ref.id[0] === 'B' ? 0.78 : 0.6)
      if (command.yaw !== undefined) goal.yaw = command.yaw
      else if (command.ref.type !== 'center') goal.yaw = -0.85
      data.follow = command.ref.type === 'ship' || command.follow ? command.ref : null
      setState({ orbiting: false, following: data.follow })
      break
    }
    case 'stage': {
      data.follow = null
      data.orbit = false
      setState({ following: null, orbiting: false })
      const to = { target: new THREE.Vector3(...command.camera.target), yaw: command.camera.yaw, pitch: command.camera.pitch, distance: command.camera.distance }
      if (command.snap) {
        data.fly = null
        data.current.target.copy(to.target)
        Object.assign(data.current, { yaw: to.yaw, pitch: to.pitch, distance: to.distance })
        goal.target.copy(to.target)
        Object.assign(goal, { yaw: to.yaw, pitch: to.pitch, distance: to.distance })
        break
      }
      const from = { target: data.current.target.clone(), yaw: data.current.yaw, pitch: data.current.pitch, distance: data.current.distance }
      data.fly = { from, to, elapsed: 0 }
      break
    }
    case 'follow': {
      if (command.off) {
        data.follow = null
        setState({ following: null })
        break
      }
      data.fly = null
      data.orbit = false
      data.follow = command.ref
      if (command.distance) goal.distance = command.distance
      setState({ orbiting: false, following: command.ref })
      break
    }
    case 'zoom':
      goal.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, goal.distance * command.factor))
      break
    case 'orbit':
      data.orbit = command.value ?? !data.orbit
      setState({ orbiting: data.orbit })
      break
    case 'reset':
      data.follow = null
      data.orbit = false
      goal.target.copy(initial.target)
      goal.yaw = initial.yaw
      goal.pitch = initial.pitch
      goal.distance = initial.distance
      setState({ following: null, orbiting: false })
      break
    case 'top':
      data.follow = null
      goal.pitch = 1.38
      setState({ following: null })
      break
    case 'look':
      data.follow = null
      Object.assign(goal, { yaw: command.yaw ?? goal.yaw, pitch: command.pitch ?? goal.pitch, distance: command.distance ?? goal.distance })
      if (command.target) goal.target.set(...command.target)
      if (command.snap) {
        data.current.target.copy(goal.target)
        Object.assign(data.current, { yaw: goal.yaw, pitch: goal.pitch, distance: goal.distance })
      }
      setState({ following: null })
      break
    default:
  }
}

const smoothStep = (value) => value * value * (3 - 2 * value)

// A stage flight interpolates the camera between two orbit poses in about a second, taking the short way round in yaw.
function advanceFly(data, dt) {
  const fly = data.fly
  fly.elapsed += dt
  const progress = Math.min(1, fly.elapsed / STAGE_FLY_SECONDS)
  const eased = smoothStep(progress)
  const { from, to } = fly
  let yawDelta = to.yaw - from.yaw
  yawDelta -= Math.round(yawDelta / (Math.PI * 2)) * Math.PI * 2
  data.current.target.lerpVectors(from.target, to.target, eased)
  data.current.yaw = from.yaw + yawDelta * eased
  data.current.pitch = from.pitch + (to.pitch - from.pitch) * eased
  data.current.distance = from.distance + (to.distance - from.distance) * eased
  data.goal.target.copy(data.current.target)
  Object.assign(data.goal, { yaw: data.current.yaw, pitch: data.current.pitch, distance: data.current.distance })
  if (progress >= 1) data.fly = null
}

function cancelFly(data) {
  if (!data || !data.fly) return
  data.fly = null
  data.goal.target.copy(data.current.target)
  Object.assign(data.goal, { yaw: data.current.yaw, pitch: data.current.pitch, distance: data.current.distance })
}

function pickWith(raycaster, world) {
  const candidates = world.proxies.filter((proxy) => proxy.userData.active !== false)
  const hits = raycaster.intersectObjects(candidates, false)
  if (hits.length === 0) return null
  hits.sort((a, b) => b.object.userData.priority - a.object.userData.priority || a.distance - b.distance)
  return hits[0].object.userData.ref
}

function ringGeometry(spec, width) {
  const steps = 140
  const positions = []
  const indices = []
  const point = (angle, extra) => {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const exponent = 2 / spec.power
    return [Math.sign(cosine) * Math.pow(Math.abs(cosine), exponent) * (spec.rx + extra), 0, Math.sign(sine) * Math.pow(Math.abs(sine), exponent) * (spec.rz + extra)]
  }
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2
    positions.push(...point(angle, 0), ...point(angle, width))
    if (step < steps) {
      const base = step * 2
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

function SelectionRing({ world }) {
  const selected = useStore((state) => state.selected)
  const mesh = useRef()
  const geometry = useMemo(() => {
    if (!selected) return null
    const pose = world.poseOf(selected)
    if (!pose) return null
    return ringGeometry(pose.ring, selected.type === 'ship' ? 1.3 : selected.type === 'mule' ? 0.5 : 1.0)
  }, [selected, world])
  useFrame((state) => {
    if (!mesh.current || !selected) return
    const pose = world.poseOf(selected)
    if (!pose) { mesh.current.visible = false; return }
    mesh.current.visible = true
    mesh.current.position.set(pose.x, pose.waterY + pose.raise, pose.z)
    mesh.current.rotation.y = pose.yaw
    mesh.current.material.opacity = 0.7 + 0.25 * Math.sin(state.clock.elapsedTime * 4)
  })
  if (!selected || !geometry) return null
  return (
    <mesh ref={mesh} geometry={geometry} renderOrder={20}>
      <meshBasicMaterial color="#00d1b2" transparent opacity={0.9} depthTest toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Pins({ world, rig }) {
  const shipKeys = useStore((state) => (state.snapshot ? state.snapshot.ships.map((row) => row.id).join(',') : ''))
  const chamberKeys = useStore((state) => (state.snapshot ? state.snapshot.chambers.map((row) => row.id).join(',') : ''))
  return (
    <>
      {chamberKeys.split(',').filter(Boolean).map((id) => <ChamberPin key={id} id={id} world={world} rig={rig} />)}
      {shipKeys.split(',').filter(Boolean).map((id) => <ShipPin key={id} id={id} world={world} rig={rig} />)}
      <CenterPin world={world} />
    </>
  )
}

function ChamberPin({ id, world, rig }) {
  const group = useRef()
  const dom = useRef()
  const row = useStore((state) => state.snapshot?.chambers.find((candidate) => candidate.id === id))
  useFrame(() => {
    const pose = world.poseOf({ type: 'chamber', id })
    if (!group.current || !pose) return
    group.current.position.set(LANE_X[id[0]] + (id[0] === 'A' ? -4 : 4), pose.waterY + 48, pose.z)
    if (dom.current && rig.current) dom.current.style.opacity = rig.current.current.distance > 380 && rig.current.current.distance < 1500 ? '1' : '0'
  })
  if (!row) return null
  const kind = row.phase === 'level' ? 'holding' : row.phase
  return (
    <group ref={group}>
      <Html center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={dom} className="pin pin-chamber">
          <StatusIcon kind={kind} size={12} />
          <span className="pin-id">{`${id[0]}${id.slice(1)}`}</span>
          <span className="pin-count">{row.level.toFixed(1)} m</span>
        </div>
      </Html>
    </group>
  )
}

function ShipPin({ id, world, rig }) {
  const group = useRef()
  const dom = useRef()
  const row = useStore((state) => state.snapshot?.ships.find((candidate) => candidate.id === id))
  useFrame(() => {
    const pose = world.poseOf({ type: 'ship', id })
    if (!group.current) return
    if (!pose) { group.current.visible = false; return }
    group.current.visible = true
    group.current.position.set(pose.x, pose.waterY + 62, pose.z)
    if (dom.current && rig.current) dom.current.style.opacity = rig.current.current.distance > 1500 ? '0' : '1'
  })
  if (!row) return null
  return (
    <group ref={group}>
      <Html center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={dom} className="pin pin-ship">
          <StatusIcon kind={row.status} size={12} />
          <span className="pin-id">{row.name}</span>
        </div>
      </Html>
    </group>
  )
}

function CenterPin({ world }) {
  const frame = world.center
  return (
    <group position={[frame.x, frame.y + 62, frame.z]}>
      <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="pin pin-ship"><StatusIcon kind="holding" size={12} /><span className="pin-id">Control center</span></div>
      </Html>
    </group>
  )
}

export { siteById }
