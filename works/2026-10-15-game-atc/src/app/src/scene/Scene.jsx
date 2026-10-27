// The 3D canvas: lights, camera rig, post effects and the current sector's world.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { advanceWorld, camera, currentSite, findEntity, followSelection, setUi, useUiValue, viewSite, world } from '../store.js'
import { PALETTE } from './materials.js'
import { Airport } from './Airport.jsx'
import { Traffic } from './Traffic.jsx'
import { Terrain, makeTerrain } from './Terrain.jsx'
import { Birds, Clouds, Fixes, Weather } from './Overlays.jsx'
import { advanceSweep, createMapUniforms } from './mapShader.js'

const MAX_STEP = 1 / 15
const pointerDown = { x: 0, y: 0 }
const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.8, -0.38).normalize()

function Simulation() {
  useFrame((_, dt) => advanceWorld(Math.min(dt, MAX_STEP)), -1)
  return null
}

// The sun follows the camera target and sizes its shadow box to the zoom, so shadows stay crisp
// in a close-up and still cover the view when zoomed out.
function Sun() {
  const lightRef = useRef()
  const { scene } = useThree()
  useEffect(() => {
    scene.add(lightRef.current.target)
  }, [scene])
  useFrame(() => {
    const controls = camera.controls
    const light = lightRef.current
    if (!controls || !light) return
    const target = controls.getTarget(new THREE.Vector3())
    const half = THREE.MathUtils.clamp(controls.distance * 0.55, 90, 2600)
    light.target.position.copy(target)
    light.position.copy(target).addScaledVector(SUN_DIRECTION, half * 2.5)
    const shadowCamera = light.shadow.camera
    if (shadowCamera.right !== half) {
      shadowCamera.left = -half
      shadowCamera.right = half
      shadowCamera.top = half
      shadowCamera.bottom = -half
      shadowCamera.far = half * 6
      shadowCamera.updateProjectionMatrix()
    }
  })
  return (
    <directionalLight
      ref={lightRef}
      intensity={2.3}
      color="#fffaf2"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.05}
      shadow-radius={3}
    />
  )
}

function SoftEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = texture
    scene.environmentIntensity = 0.32
    return () => {
      scene.environment = null
      texture.dispose()
      generator.dispose()
    }
  }, [gl, scene])
  return null
}

function CameraRig({ site }) {
  const controlsRef = useRef()
  const { camera: activeCamera } = useThree()
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
  // Near and far planes track the zoom so close-ups and the wide en-route view both keep depth precision.
  useFrame(() => {
    followSelection()
    const distance = controlsRef.current.distance
    const near = THREE.MathUtils.clamp(distance * 0.02, 0.5, 60)
    if (Math.abs(activeCamera.near - near) > near * 0.1) {
      activeCamera.near = near
      activeCamera.far = distance * 8 + 4000
      activeCamera.updateProjectionMatrix()
    }
  })
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={24}
      maxDistance={site.view.distance * 1.5}
      minPolarAngle={0.25}
      maxPolarAngle={1.25}
      smoothTime={0.55}
      draggingSmoothTime={0.18}
      dollySpeed={0.6}
    />
  )
}

function SiteFog({ site }) {
  const { scene } = useThree()
  useEffect(() => {
    scene.fog = new THREE.Fog(PALETTE.ground, site.view.distance * 1.3, site.view.distance * 3.4)
  }, [scene, site])
  return null
}

// Lets the screenshot and film scripts find an object on screen so they can click it for real.
function ScreenProjection() {
  const { camera: activeCamera, size } = useThree()
  useEffect(() => {
    window.squawkScreenPosition = (id, lift = 0) => {
      const entity = findEntity(id)
      if (!entity) return null
      const point = new THREE.Vector3(entity.position.x, (entity.position.y ?? 0) + lift, entity.position.z).project(activeCamera)
      return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
    }
    // A flight that will keep moving on screen for a while: airborne, not about to leave.
    window.squawkPick = (kind, allowedIds = null) => {
      const state = currentSite()
      const candidates = state.flights.filter((flight) => !allowedIds || allowedIds.includes(flight.id))
      if (kind === 'moving') {
        const steering = candidates.filter((flight) => flight.mode === 'steer' && flight.altitude > 2000 && state.clock - flight.bornAt > 40 * 8)
        steering.sort((a, b) => Math.hypot(a.position.x, a.position.z) - Math.hypot(b.position.x, b.position.z))
        return steering[0]?.id ?? candidates[0]?.id ?? null
      }
      return candidates[0]?.id ?? null
    }
    window.squawkSite = currentSite
    window.squawkLookAt = (position, target) => camera.controls?.setLookAt(...position, ...target, false)
    window.squawkSelect = (id) => setUi({ selectedId: id })
  }, [activeCamera, size])
  return null
}

function SectorWorld({ state }) {
  const site = state.site
  const terrain = useMemo(() => makeTerrain(site), [site])
  const mapUniforms = useMemo(() => createMapUniforms(site), [site])
  useFrame(({ clock }) => advanceSweep(mapUniforms, clock.elapsedTime))
  return (
    <>
      <SiteFog site={site} />
      <Terrain site={site} terrain={terrain} mapUniforms={mapUniforms} />
      {site.hasAirport && <Airport />}
      <Fixes site={site} terrain={terrain} />
      {state.weather && <Weather state={state} />}
      <Clouds site={site} />
      <Birds site={site} />
      <Traffic state={state} />
    </>
  )
}

export function Scene() {
  const siteId = useUiValue((ui) => ui.siteId)
  const state = world.sites[siteId]
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 30, near: 2, far: 20000, position: [600, 900, -1400] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerDown={(event) => {
        pointerDown.x = event.clientX
        pointerDown.y = event.clientY
      }}
      onPointerMissed={(event) => {
        // A drag that ends on empty ground is a camera move, not a click on the ground.
        if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 6) setUi({ selectedId: null })
      }}
    >
      <color attach="background" args={[PALETTE.ground]} />
      <hemisphereLight args={['#eef4ff', '#c9d3e2', 0.95]} />
      <Sun />
      <SoftEnvironment />
      <Simulation />
      <CameraRig site={state.site} />
      <ScreenProjection />
      <Suspense fallback={null}>
        <group key={siteId}>
          <SectorWorld state={state} />
        </group>
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes quality="performance" aoRadius={4} intensity={2.2} distanceFalloff={1.2} color="#3b4a66" />
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.85} radius={0.6} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
