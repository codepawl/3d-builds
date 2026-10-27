// The 3D canvas: lights, camera rig, post effects and the current site (fab floor or campus).
import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { advanceWorld, camera, currentSite, findEntity, followSelection, setUi, useUiValue, viewSite, world } from '../store.js'
import { PALETTE } from './materials.js'
import { FabWorld } from './FabWorld.jsx'
import { FabUnits, entityTop } from './Units.jsx'
import { Campus } from './Campus.jsx'

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
  const isCampus = state.site.kind === 'campus'
  const center = isCampus ? { x: 12, z: 22 } : state.layout.center
  const half = isCampus ? 190 : state.layout.width * 0.62
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
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0003}
      shadow-normalBias={isCampus ? 0.3 : 0.03}
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
      minDistance={7}
      maxDistance={720}
      minPolarAngle={0.25}
      maxPolarAngle={1.25}
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
    window.waferlineScreenPosition = (id, lift = 0) => {
      const entity = findEntity(id)
      if (!entity) return null
      const height = entity.type === 'vehicle' ? entity.position.y - 0.45 : entity.type === 'lot' ? entity.position.y + 0.2 : entityTop(entity) * 0.6
      const point = new THREE.Vector3(entity.position.x, height + lift, entity.position.z).project(activeCamera)
      return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
    }
    window.waferlinePick = (kind, allowedIds = null) => {
      const state = currentSite()
      const allowed = (id) => !allowedIds || allowedIds.includes(id)
      if (kind === 'movingVehicle') {
        // A loaded vehicle with a long way still to go, so it keeps moving after the click.
        const bay = (vehicle) => state.bays[vehicle.bay]
        const remaining = (vehicle) => (vehicle.job.to.s - vehicle.s + bay(vehicle).loop) % bay(vehicle).loop
        const moving = state.vehicles.filter((vehicle) => vehicle.job?.phase === 'toDrop' && vehicle.speed > 1)
        moving.sort((a, b) => remaining(b) - remaining(a))
        return moving[0]?.id ?? state.vehicles.find((vehicle) => vehicle.speed > 0.5)?.id ?? null
      }
      if (kind === 'processingLot') return state.lots.find((lot) => lot.state === 'processing' && allowed(lot.id))?.id ?? null
      if (kind === 'runningTool') return state.tools.find((tool) => tool.state === 'running' && allowed(tool.id))?.id ?? null
      return null
    }
    window.waferlineSite = currentSite
    window.waferlineLookAt = (position, target) => camera.controls?.setLookAt(...position, ...target, false)
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
  const isCampus = state.site.kind === 'campus'
  const onPointerMissed = useGroundDeselect()
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 30, near: 1, far: 3000, position: [60, 120, 160] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.74
        window.waferlineRenderer = gl
      }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={[isCampus ? PALETTE.ground : PALETTE.outside]} />
      <fog attach="fog" args={[isCampus ? PALETTE.ground : PALETTE.outside, isCampus ? 700 : 320, isCampus ? 1500 : 760]} />
      <hemisphereLight args={['#eef4ff', '#aab6c8', 0.6]} />
      <Sun key={siteId} state={state} />
      <SoftEnvironment />
      <Simulation />
      <CameraRig />
      <ScreenProjection />
      <Suspense fallback={null}>
        <group key={siteId}>
          {isCampus ? (
            <Campus state={state} />
          ) : (
            <>
              <FabWorld state={state} />
              <FabUnits state={state} />
            </>
          )}
        </group>
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes quality="performance" aoRadius={isCampus ? 6 : 1.6} intensity={2.4} distanceFalloff={1.0} color="#33415c" />
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.7} radius={0.55} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
