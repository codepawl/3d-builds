// The 3D canvas: lights, camera rig, post effects and the current circuit.
import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { advanceWorld, applyView, camera, currentSite, findEntity, followSelection, select, setUi, siteView, useUiValue, world } from '../store.js'
import { World } from './World.jsx'
import { Units } from './Units.jsx'

const MAX_STEP = 1 / 15

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

// The sun's shadow box covers the pit complex and the near part of the lap.
function Sun({ night }) {
  const lightRef = useRef()
  useEffect(() => {
    const light = lightRef.current
    const shadowCamera = light.shadow.camera
    shadowCamera.left = -150
    shadowCamera.right = 150
    shadowCamera.top = 110
    shadowCamera.bottom = -110
    shadowCamera.near = 10
    shadowCamera.far = 900
    shadowCamera.updateProjectionMatrix()
    light.target.position.set(0, 0, 0)
    light.target.updateMatrixWorld()
  }, [])
  return (
    <directionalLight
      ref={lightRef}
      position={night ? [160, 300, -120] : [-190, 330, -230]}
      intensity={night ? 0.55 : 2.3}
      color={night ? '#bcd0ff' : '#fff4e6'}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
      shadow-radius={5}
    />
  )
}

function SoftEnvironment({ intensity }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = texture
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      texture.dispose()
      generator.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

function CameraRig() {
  const controlsRef = useRef()
  useEffect(() => {
    const controls = controlsRef.current
    camera.controls = controls
    applyView(siteView(), false)
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
      maxDistance={700}
      minPolarAngle={0.3}
      maxPolarAngle={1.18}
      smoothTime={0.4}
      draggingSmoothTime={0.15}
      dollySpeed={0.6}
    />
  )
}

// Hooks for the screenshot and film scripts: where an object is on screen, so they can click it for real.
function ScriptHooks() {
  const { camera: activeCamera, size } = useThree()
  useEffect(() => {
    window.boxline = {
      screenPosition: (id, lift = 0.6) => {
        const entity = findEntity(id)
        if (!entity) return null
        const point = new THREE.Vector3(entity.position.x, (entity.position.y ?? 0) + lift, entity.position.z).project(activeCamera)
        return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
      },
      site: currentSite,
      select,
      setUi,
      lookAt: (position, target) => camera.controls?.setLookAt(...position, ...target, false),
      controls: () => camera.controls,
    }
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
  const night = state.site.night
  const sky = night ? '#060a13' : state.site.kind === 'desert' ? '#efe4d2' : '#dce8ee'
  const onPointerMissed = useGroundDeselect()
  return (
    <Canvas
      shadows="soft"
      dpr={1}
      camera={{ fov: 30, near: 2, far: 2400, position: [60, 160, -160] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        window.boxlineScene = scene
        gl.toneMappingExposure = 0.8
        window.boxlineRenderer = gl
      }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, night ? 700 : 520, night ? 2000 : 1500]} />
      <hemisphereLight args={night ? ['#3d4f78', '#10141e', 0.42] : ['#eef5ff', '#9aa98a', 0.75]} />
      <Sun key={siteId} night={night} />
      <SoftEnvironment intensity={night ? 0.14 : 0.32} />
      <Simulation />
      <CameraRig />
      <ScriptHooks />
      <Suspense fallback={null}>
        <group key={siteId}>
          <World state={state} />
          <Units state={state} />
        </group>
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes quality="performance" aoRadius={2.2} intensity={2.2} distanceFalloff={1.0} color={night ? '#05080f' : '#2c3a52'} />
        <Bloom mipmapBlur luminanceThreshold={night ? 1.0 : 0.95} luminanceSmoothing={0.2} intensity={night ? 0.4 : 0.6} radius={night ? 0.35 : 0.6} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
