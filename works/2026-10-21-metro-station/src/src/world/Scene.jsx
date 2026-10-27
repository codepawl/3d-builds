import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { buildSite } from './buildSite.js'
import { siteById, stationById, lineById } from '../data/network.js'
import { buildSnapshot, detailFor } from '../snapshot.js'
import { getState, setState, useStore, cameraBus } from '../store.js'
import { StatusIcon } from '../ui/icons.jsx'
import { stageByKey, stageCameraGoal } from '../data/stages.js'
import { attachSimulation, installPlaybackHandle, updatePlayback } from '../playback.js'
import { Simulation } from '../sim/simulation.js'

const SNAPSHOT_INTERVAL = 0.25

export function Scene({ assets, simulation }) {
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 28, near: 8, far: 5600, position: [300, 400, 800] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <color attach="background" args={['#d7e5ef']} />
      <fog attach="fog" args={['#d7e5ef', 1800, 5200]} />
      <World assets={assets} simulation={simulation} />
    </Canvas>
  )
}

function World({ assets, simulation }) {
  const siteId = useStore((state) => state.siteId)
  const site = siteById[siteId]
  const world = useMemo(() => buildSite({ site, assets, simulation }), [site, assets, simulation])
  const snapshotTimer = useRef(99)
  const camera = useThree((state) => state.camera)
  const rig = useRef(null)

  useEffect(() => {
    window.__world = world
    window.__sim = simulation
    attachSimulation(simulation)
    installPlaybackHandle({ stationFrames: world.stationFrames, createSimulation: (seed) => new Simulation(seed), Simulation })
    // Tooling only: screen position of an object, so a script can aim a real click at it.
    window.__project = (ref, lift = 2.2) => {
      const pose = world.poseOf(ref)
      if (!pose) return null
      const point = new THREE.Vector3(pose.x, pose.y + lift, pose.z).project(camera)
      return { x: ((point.x + 1) / 2) * window.innerWidth, y: ((1 - point.y) / 2) * window.innerHeight }
    }
  }, [world, simulation, camera])

  useFrame((state, delta) => {
    const clamped = Math.min(delta, 0.1)
    updatePlayback(clamped)
    simulation.advance(clamped)
    world.update(clamped, simulation.renderTime)
    snapshotTimer.current += clamped
    if (snapshotTimer.current >= SNAPSHOT_INTERVAL) {
      snapshotTimer.current = 0
      const current = getState()
      const focusRef = current.selected?.type === 'train' ? current.selected : current.following?.type === 'train' ? current.following : null
      const snapshot = buildSnapshot(simulation, current.siteId, focusRef?.id ?? null)
      setState({ snapshot, detail: detailFor(simulation, snapshot, current.selected) })
    }
  })

  return (
    <>
      <primitive object={world.group} />
      <Lighting rig={rig} />
      <CameraRig world={world} site={site} rig={rig} />
      <Picking world={world} />
      <SelectionRing world={world} />
      <Pins world={world} simulation={simulation} rig={rig} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO aoRadius={5} distanceFalloff={1.4} intensity={2.6} quality="medium" halfRes />
        <Bloom intensity={0.55} luminanceThreshold={1.05} luminanceSmoothing={0.25} mipmapBlur radius={0.6} />
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
    const half = distance < 220 ? 130 : distance < 420 ? 230 : distance < 800 ? 380 : 640
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
    target.position.set(snappedX, 0, snappedZ)
    light.current.position.set(snappedX - 240, 420, snappedZ + 180)
    target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#e4f0ff', '#b9b1a5', 0.95]} />
      <directionalLight
        ref={light}
        color="#fff3df"
        intensity={2.25}
        castShadow
        target={target}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.6}
        shadow-radius={4}
        shadow-camera-near={10}
        shadow-camera-far={1400}
      />
    </>
  )
}

function CameraRig({ world, site, rig }) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const initial = useMemo(() => {
    const config = site.camera
    return {
      target: new THREE.Vector3(...config.target),
      yaw: config.yaw,
      pitch: config.pitch,
      distance: config.distance,
    }
  }, [site])

  if (!rig.current) {
    rig.current = {
      current: { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance * 1.25 },
      goal: { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance },
      follow: null,
      orbit: false,
      siteKey: site.id,
    }
  }
  if (rig.current.siteKey !== site.id) {
    rig.current.siteKey = site.id
    rig.current.current = { target: initial.target.clone(), yaw: initial.yaw - 0.5, pitch: initial.pitch + 0.12, distance: initial.distance * 1.3 }
    rig.current.goal = { target: initial.target.clone(), yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance }
    rig.current.follow = null
    rig.current.orbit = false
    queueMicrotask(() => setState({ following: null, orbiting: false }))
  }

  useEffect(() => {
    const element = gl.domElement
    let dragging = null
    const onDown = (event) => {
      dragging = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, button: event.button, shift: event.shiftKey, moved: 0 }
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
        goal.pitch = Math.min(1.45, Math.max(0.3, goal.pitch + dy * 0.0042))
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
      const rect = element.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const ref = pickWith(raycaster, world)
      if (ref) {
        setState({ selected: ref })
        if (ref.type === 'train') cameraBus.push({ type: 'fly', ref, follow: true, minimum: 140 })
      } else {
        rig.current.follow = null
        setState({ selected: null, detail: null, following: null })
      }
    }
    const onWheel = (event) => {
      event.preventDefault()
      const goal = rig.current.goal
      goal.distance = Math.min(2600, Math.max(35, goal.distance * Math.exp(event.deltaY * 0.0011)))
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        rig.current.follow = null
        setState({ selected: null, detail: null, following: null })
      }
    }
    const onContext = (event) => event.preventDefault()
    const onHover = (event) => {
      if (dragging) return
      const rect = element.getBoundingClientRect()
      const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      element.style.cursor = pickWith(raycaster, world) ? 'pointer' : 'grab'
    }
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
    const pendingKey = getState().pendingStage
    if (pendingKey && stageByKey[pendingKey].siteId === site.id && world.stationFrames[stageByKey[pendingKey].stationId]) {
      setState({ pendingStage: null })
      cameraBus.push({ type: 'stage', key: pendingKey })
    }
    while (cameraBus.pending.length > 0) {
      const command = cameraBus.pending.shift()
      handleCommand(command, data, world, initial)
    }
    if (data.orbit) data.goal.yaw += dt * 0.085
    if (data.follow) {
      const pose = world.poseOf(data.follow)
      if (pose) data.goal.target.set(pose.x, pose.y + 2, pose.z)
    }
    const blend = 1 - Math.exp(-dt * (data.follow ? 5.5 : 4))
    const current = data.current
    const goal = data.goal
    current.target.lerp(goal.target, data.follow ? 1 - Math.exp(-dt * 9) : blend)
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
    // Stay above buildings and the ground.
    for (let attempt = 0; attempt < 6 && !data.free; attempt += 1) {
      const clearance = Math.max(world.heightAt(camera.position.x, camera.position.z) + 14, 8)
      if (camera.position.y >= clearance) break
      pitch = Math.min(1.5, pitch + 0.1)
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
      data.free = false
      const pose = world.poseOf(command.ref)
      if (!pose) return
      data.orbit = false
      goal.target.set(pose.x, pose.y + 2, pose.z)
      const wanted = command.ref.type === 'train' ? 160 : command.ref.type === 'station' ? 300 : command.ref.type === 'signal' ? 70 : 230
      goal.distance = Math.max(command.minimum ?? 0, wanted)
      goal.pitch = Math.max(goal.pitch, 0.34)
      data.follow = command.ref.type === 'train' || command.follow ? command.ref : null
      setState({ orbiting: false, following: data.follow })
      break
    }
    case 'stage': {
      const stage = stageByKey[command.key]
      const stageGoal = stage ? stageCameraGoal(stage, world.stationFrames) : null
      if (!stageGoal) return
      data.follow = null
      data.orbit = false
      data.free = Boolean(stage.lowCamera)
      goal.target.set(...stageGoal.target)
      goal.yaw = stageGoal.yaw
      goal.pitch = stageGoal.pitch
      goal.distance = stageGoal.distance
      setState({ following: null, orbiting: false })
      break
    }
    case 'pose': {
      // Exact camera pose for checks and screenshots: { target: [x, y, z], yaw, pitch, distance }, applied at once.
      data.follow = null
      data.orbit = false
      data.free = true
      ;[goal, data.current].forEach((view) => {
        view.target.set(...command.target)
        view.yaw = command.yaw
        view.pitch = command.pitch
        view.distance = command.distance
      })
      setState({ following: null, orbiting: false })
      break
    }
    case 'followDistance':
      goal.distance = command.distance
      break
    case 'unfollow':
      data.follow = null
      setState({ following: null })
      break
    case 'zoom':
      goal.distance = Math.min(2600, Math.max(35, goal.distance * command.factor))
      break
    case 'orbit':
      data.orbit = command.value ?? !data.orbit
      setState({ orbiting: data.orbit })
      break
    case 'reset':
      data.free = false
      data.follow = null
      data.orbit = false
      goal.target.copy(initial.target)
      goal.yaw = initial.yaw
      goal.pitch = initial.pitch
      goal.distance = initial.distance
      setState({ following: null, orbiting: false })
      break
    case 'top':
      data.free = false
      data.follow = null
      goal.pitch = 1.4
      setState({ following: null })
      break
    case 'look':
      data.free = false
      data.follow = null
      Object.assign(goal, { yaw: command.yaw ?? goal.yaw, pitch: command.pitch ?? goal.pitch, distance: command.distance ?? goal.distance })
      if (command.target) goal.target.set(...command.target)
      setState({ following: null })
      break
    default:
  }
}

function pickWith(raycaster, world) {
  const candidates = world.proxies.filter((proxy) => proxy.userData.active !== false)
  const hits = raycaster.intersectObjects(candidates, false)
  if (hits.length === 0) return null
  hits.sort((a, b) => b.object.userData.priority - a.object.userData.priority || a.distance - b.distance)
  return hits[0].object.userData.ref
}

function Picking() {
  return null
}

function ringGeometry(spec, width) {
  const steps = 120
  const positions = []
  const indices = []
  const point = (angle, extra) => {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const exponent = 2 / spec.power
    const x = Math.sign(cosine) * Math.pow(Math.abs(cosine), exponent) * (spec.rx + extra)
    const z = Math.sign(sine) * Math.pow(Math.abs(sine), exponent) * (spec.rz + extra)
    return [x, 0, z]
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
    return ringGeometry(pose.ring, selected.type === 'train' ? 0.55 : selected.type === 'signal' ? 0.18 : 0.7)
  }, [selected, world])
  useFrame((state) => {
    if (!mesh.current || !selected) return
    const pose = world.poseOf(selected)
    if (!pose) {
      mesh.current.visible = false
      return
    }
    mesh.current.visible = true
    mesh.current.position.set(pose.x, pose.y + (selected.type === 'station' ? 1.3 : selected.type === 'train' ? 0.3 : 0.2), pose.z)
    mesh.current.rotation.y = pose.yaw
    mesh.current.material.opacity = 0.7 + 0.25 * Math.sin(state.clock.elapsedTime * 4)
  })
  if (!selected || !geometry) return null
  return (
    <mesh ref={mesh} geometry={geometry} renderOrder={20}>
      <meshBasicMaterial color="#00d1b2" transparent opacity={0.9} depthTest={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Pins({ world, simulation, rig }) {
  const stationIds = world.siteStations.map((station) => station.id)
  const trainIds = useStore((state) => (state.snapshot ? state.snapshot.trains.map((row) => row.id).join(',') : ''))
  return (
    <>
      {stationIds.map((id) => (
        <StationPin key={id} id={id} world={world} />
      ))}
      {trainIds.split(',').filter(Boolean).map((id) => (
        <TrainPin key={id} id={id} world={world} rig={rig} />
      ))}
    </>
  )
}

function StationPin({ id, world }) {
  const group = useRef()
  const row = useStore((state) => state.snapshot?.stations.find((candidate) => candidate.id === id))
  const frame = world.stationFrames[id]
  if (!frame || !row) return null
  const hot = row.crowding > 0.7 ? 'pin-hot' : row.crowding > 0.4 ? 'pin-warm' : 'pin-cool'
  return (
    <group ref={group} position={[frame.x, frame.line.buried ? 26 : frame.y + 24, frame.z]}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`pin pin-station ${hot}`}>
          <span className="pin-line" style={{ background: row.color }} />
          <span className="pin-name">{row.name}</span>
          <span className="pin-count"><StatusIcon kind={row.crowding > 0.7 ? 'held' : 'running'} size={12} />{row.waiting}</span>
        </div>
      </Html>
    </group>
  )
}

function TrainPin({ id, world, rig }) {
  const group = useRef()
  const dom = useRef()
  const row = useStore((state) => state.snapshot?.trains.find((candidate) => candidate.id === id))
  useFrame(() => {
    const pose = world.poseOf({ type: 'train', id })
    if (!group.current) return
    if (!pose) {
      group.current.visible = false
      return
    }
    group.current.visible = true
    group.current.position.set(pose.x, pose.y + 9, pose.z)
    if (dom.current && rig.current) dom.current.style.opacity = rig.current.current.distance > 1100 ? '0' : '1'
  })
  if (!row) return null
  return (
    <group ref={group}>
      <Html center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={dom} className="pin pin-train">
          <StatusIcon kind={row.status} size={12} />
          <span className="pin-id">{row.id}</span>
        </div>
      </Html>
    </group>
  )
}

export { stationById, lineById }
