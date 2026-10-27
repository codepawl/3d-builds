// The 3D canvas: lights, camera rig, post effects and the current hospital.
import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { advanceWorld, camera, currentSite, findEntity, followPoint, followSelection, setUi, useUiValue, viewSite, world } from '../store.js'
import { PALETTE, BRAND } from './materials.js'
import { useAssets } from './assets.jsx'
import { entityTop, NameTag, Pin, SelectionRing } from './Markers.jsx'
import { Hospital } from './Hospital.jsx'

// Things that need a look: inbound ambulances and helicopters, and level 1-2 patients waiting for a doctor.
function alertIds(state) {
  const inbound = [...state.vehicles, ...state.helis].filter((unit) => unit.phase === 'arriving' || unit.phase === 'approach').map((unit) => unit.id)
  const urgent = state.patients.filter((patient) => !patient.gone && patient.level <= 2 && patient.needs === 'doctor').map((patient) => patient.id)
  return [...inbound, ...urgent]
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
      <Hospital state={state} nodes={nodes} clips={clips} />
      <SelectionRing selectedId={selectedId} floorY={0.05} />
      {selectedId && <Pin key={selectedId} color={BRAND} scale={0.42} follow={pinTarget(selectedId)} />}
      {alerts
        .split(',')
        .filter((id) => id && id !== selectedId)
        .map((id, index) => (
          <Pin key={id} color={id.startsWith('P-') ? '#e5484d' : '#f5a524'} scale={0.36} follow={pinTarget(id)} bob={index * 1.7} />
        ))}
      <NameTag selectedId={selectedId} scale={0.42} />
    </group>
  )
}

const MAX_STEP = 1 / 15

// The shadow map is redrawn every other frame (a film recording redraws it every frame): moving
// shadows stay smooth and the shadow pass costs half as much.
function Simulation() {
  const frame = useRef(0)
  useFrame(({ gl }, dt) => {
    advanceWorld(Math.min(dt, MAX_STEP))
    frame.current++
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = window.filmMode || frame.current % 2 === 0
  }, -1)
  return null
}

// The sun's shadow box follows the site: a fab floor is about 100 m across, the campus 300 m.
function Sun({ state }) {
  const lightRef = useRef()
  const center = state.layout.center
  const half = state.layout.width * 0.6
  useEffect(() => {
    const light = lightRef.current
    const shadowCamera = light.shadow.camera
    shadowCamera.left = -half
    shadowCamera.right = half
    shadowCamera.top = half * 0.75
    shadowCamera.bottom = -half * 0.75
    shadowCamera.near = 1
    shadowCamera.far = half * 6
    shadowCamera.updateProjectionMatrix()
    light.target.position.set(center.x, 0, center.z)
    light.target.updateMatrixWorld()
    light.shadow.needsUpdate = true
  }, [center.x, center.z, half])
  const distance = half * 2.2
  return (
    <directionalLight
      ref={lightRef}
      position={[center.x - distance * 0.45, distance, center.z + distance * 0.55]}
      intensity={2.1}
      color="#fff6ea"
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.0003}
      shadow-normalBias={0.04}
      shadow-radius={4}
    />
  )
}

// Image-based light from a neutral room, generated locally, so painted metal and glass have
// something soft to reflect.
function SoftEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = texture
    scene.environmentIntensity = 0.3
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
    viewSite(currentSite(), false)
    const stopFollowing = () => {
      camera.followId = null
    }
    controls.addEventListener('controlstart', stopFollowing)
    return () => {
      controls.removeEventListener('controlstart', stopFollowing)
      camera.controls = null
    }
  }, [])
  useFrame(followSelection)
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={9}
      maxDistance={320}
      minPolarAngle={0.25}
      maxPolarAngle={1.18}
      smoothTime={0.55}
      draggingSmoothTime={0.18}
      dollySpeed={0.6}
    />
  )
}

// Lets the screenshot and film scripts find an object on screen so they can click it for real.
function ScreenProjection() {
  const { camera: activeCamera, size } = useThree()
  useEffect(() => {
    window.appScreenPosition = (id, lift = 0) => {
      const entity = findEntity(id)
      if (!entity) return null
      const point3 = entity.type === 'vehicle' ? { x: entity.position.x, y: 1.6, z: entity.position.z } : entity.type === 'heli' ? { x: entity.position.x, y: entity.position.y + 1.6, z: entity.position.z } : { x: entity.position.x, y: (entityTop(entity) + entity.position.y) / 2, z: entity.position.z }
      const point = new THREE.Vector3(point3.x, point3.y + lift, point3.z).project(activeCamera)
      return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
    }
    window.appFollowPoint = (id) => followPoint(findEntity(id))
    window.appSite = currentSite
    window.appWorld = world
    window.appLookAt = (position, target) => camera.controls?.setLookAt(...position, ...target, false)
  }, [activeCamera, size])
  return null
}

// A click on empty ground closes the card; a drag that ends there does not.
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
      camera={{ fov: 30, near: 0.5, far: 2000, position: [60, 120, 160] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMappingExposure = 0.74
        gl.localClippingEnabled = true
        window.appRenderer = gl
        window.appScene = scene
      }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={[PALETTE.outside]} />
      <fog attach="fog" args={[PALETTE.outside, 260, 620]} />
      <hemisphereLight args={['#eef4ff', '#aab6c8', 0.6]} />
      <Sun key={siteId} state={state} />
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
        <N8AO halfRes quality="performance" aoRadius={1.6} intensity={2.4} distanceFalloff={1.0} color="#33415c" />
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.7} radius={0.55} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
