// The 3D canvas: lights, camera rig, post effects and the current land.
import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { advanceWorld, camera, currentSite, findEntity, followSelection, getUi, setUi, useUiValue, viewSite, world } from '../store.js'
import { BRAND, SKY } from './materials.js'
import { useAssets } from './assets.jsx'
import { entityTop, NameTag, Pin, SelectionRing } from './Markers.jsx'
import { World } from './World.jsx'
import { Rides } from './Rides.jsx'
import { Crowd } from './Crowd.jsx'
import { COASTER_TRACK, sampleTrack } from '../paths.js'

function alertIds(state) {
  return state.rides.filter((ride) => ride.state !== 'open').map((ride) => `${ride.id}:${ride.state}`)
}

function SiteWorld({ state }) {
  const { nodes, clips } = useAssets()
  const selectedId = useUiValue((ui) => ui.selectedId)
  const alerts = useUiValue(() => alertIds(state).join(','))
  const pinTarget = (id) => () => {
    const entity = findEntity(id, state)
    return entity && { x: entity.position.x, y: entityTop(entity), z: entity.position.z }
  }
  return (
    <group>
      <World state={state} nodes={nodes} />
      <Rides state={state} nodes={nodes} clips={clips} />
      <Crowd state={state} nodes={nodes} clips={clips} />
      <SelectionRing selectedId={selectedId} />
      {selectedId && <Pin key={selectedId} color={BRAND} scale={0.6} follow={pinTarget(selectedId)} />}
      {alerts
        .split(',')
        .filter(Boolean)
        .map((entry, index) => {
          const [id, rideState] = entry.split(':')
          if (id === selectedId) return null
          return <Pin key={id} color={rideState === 'down' ? '#d6373d' : '#e59a12'} scale={0.9} follow={pinTarget(id)} bob={index * 1.7} />
        })}
      <NameTag selectedId={selectedId} />
    </group>
  )
}

const MAX_STEP = 1 / 15

function Simulation() {
  const frame = useRef(0)
  useFrame(({ gl }, dt) => {
    gl.info.autoReset = false
    window.parkStats = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    gl.info.reset()
    advanceWorld(Math.min(dt, MAX_STEP))
    frame.current++
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = window.filmMode || frame.current % 2 === 0
  }, -1)
  return null
}

// The sun's shadow box covers the land around its view target.
function Sun({ siteId }) {
  const lightRef = useRef()
  const state = world.sites[siteId]
  const [x, , z] = state.layout.view.target
  const [minX, minZ, maxX, maxZ] = state.layout.ground.bounds
  const half = Math.max(maxX - minX, maxZ - minZ) * 0.55
  useEffect(() => {
    const light = lightRef.current
    const shadowCamera = light.shadow.camera
    shadowCamera.left = -half
    shadowCamera.right = half
    shadowCamera.top = half
    shadowCamera.bottom = -half
    shadowCamera.near = 1
    shadowCamera.far = half * 5
    shadowCamera.updateProjectionMatrix()
    light.target.position.set(x, 0, z)
    light.target.updateMatrixWorld()
  }, [x, z, half])
  const distance = half * 1.8
  return <directionalLight ref={lightRef} position={[x - distance * 0.5, distance, z + distance * 0.45]} intensity={2.3} color="#fff4e2" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.05} shadow-radius={5} />
}

function SoftEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = texture
    scene.environmentIntensity = 0.35
    return () => {
      scene.environment = null
      texture.dispose()
      generator.dispose()
    }
  }, [gl, scene])
  return null
}

function CameraRig() {
  const controlsRef = useRef()
  useEffect(() => {
    const controls = controlsRef.current
    camera.controls = controls
    viewSite(getUi().siteId, false)
    const stopFollowing = () => {
      camera.followId = null
    }
    controls.addEventListener('controlstart', stopFollowing)
    return () => {
      controls.removeEventListener('controlstart', stopFollowing)
      camera.controls = null
    }
  }, [])
  useFrame(() => {
    const controls = controlsRef.current
    controls.smoothTime = camera.followId ? 0.3 : 0.55
    followSelection()
  })
  return <CameraControls ref={controlsRef} makeDefault minDistance={10} maxDistance={520} minPolarAngle={0.25} maxPolarAngle={1.22} smoothTime={0.55} draggingSmoothTime={0.18} dollySpeed={0.6} />
}

// Lets the screenshot and film scripts find an object on screen so they can click it for real.
function ScreenProjection() {
  const { camera: activeCamera, size } = useThree()
  useEffect(() => {
    window.parkScreenPosition = (id, lift = 0) => {
      const entity = findEntity(id)
      if (!entity) return null
      const height = entity.type === 'ride' ? entity.item.top * 0.35 : entity.type === 'stand' ? 2 : entity.position.y + 1 + lift
      const point = new THREE.Vector3(entity.position.x, height, entity.position.z).project(activeCamera)
      return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
    }
    window.parkSite = currentSite
    // A point on a coaster train, `back` metres behind its lead car, in screen pixels.
    window.parkTrainScreen = (id, back = 0) => {
      const state = currentSite()
      const unit = state.units.find((candidate) => candidate.id === id)
      if (!unit) return null
      const sample = sampleTrack(COASTER_TRACK, unit.along - back)
      const offset = state.layout.coaster.offset
      const point = new THREE.Vector3(sample.position[0] + offset[0], sample.position[1] + 1.3, sample.position[2] + offset[2]).project(activeCamera)
      return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
    }
    window.parkTrainOnLift = (from, to) => currentSite().units.find((unit) => unit.kind === 'train' && unit.dwell <= 0 && unit.along >= from && unit.along <= to)?.id ?? null
    window.parkWorld = world
    window.parkLookAt = (position, target) => camera.controls?.setLookAt(...position, ...target, false)
    window.parkCamera = () => ({ distance: camera.controls?.distance, polar: camera.controls?.polarAngle, azimuth: camera.controls?.azimuthAngle, position: activeCamera.position.toArray() })
  }, [activeCamera, size])
  return null
}

function useGroundDeselect() {
  const downAt = useRef(null)
  useEffect(() => {
    const onDown = (event) => {
      downAt.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])
  return (event) => {
    const start = downAt.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
    setUi({ selectedId: null })
  }
}

export function Scene() {
  const siteId = useUiValue((ui) => ui.siteId)
  const state = world.sites[siteId]
  const onPointerMissed = useGroundDeselect()
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 30, near: 2, far: 2400, position: [60, 120, 160] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMappingExposure = 0.8
        window.parkRenderer = gl
        window.parkScene = scene
      }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 380, 900]} />
      <hemisphereLight args={['#eef6ff', '#9fb38c', 0.65]} />
      <Sun key={siteId} siteId={siteId} />
      <SoftEnvironment />
      <Simulation />
      <CameraRig />
      <ScreenProjection />
      <Suspense fallback={null}>
        <group key={siteId}>
          <SiteWorld state={state} />
        </group>
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes quality="performance" aoRadius={1.8} intensity={2.2} distanceFalloff={1.0} color="#2f3d33" />
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.6} radius={0.55} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
