// Canvas contents: light, camera controls, the hall and yard of the active site, units, markers and post effects.
import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { activeWorld, advance, model, useModelVersion } from '../store.js'
import { attachRig, flyHome } from '../cameraRig.js'
import { Hall } from './Hall.jsx'
import { Yard } from './Yard.jsx'
import { Units } from './Units.jsx'
import { Markers } from './Markers.jsx'
import { COLORS } from './palette.js'

function Simulation() {
  useFrame((_, delta) => advance(delta))
  return null
}

function Rig() {
  const controlsRef = useRef()
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  useEffect(() => {
    attachRig(controlsRef.current, camera, size)
  }, [camera, size])
  useEffect(() => {
    flyHome(activeWorld(), false)
  }, [])
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.55}
      minDistance={7}
      maxDistance={150}
      minPolarAngle={0.25}
      maxPolarAngle={1.22}
      dollySpeed={0.6}
    />
  )
}

function Site() {
  useModelVersion()
  const world = activeWorld()
  const siteRef = useRef(model.siteId)
  useEffect(() => {
    if (siteRef.current !== model.siteId) {
      siteRef.current = model.siteId
      flyHome(world)
    }
  }, [world])
  return (
    <group key={world.site.id}>
      <Yard world={world} />
      <Hall world={world} />
      <Units world={world} />
      <Markers world={world} />
    </group>
  )
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9d2e6', 0.55]} />
      <directionalLight
        position={[28, 46, 22]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={6}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={0.9} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
        <Lightformer intensity={0.45} position={[20, 6, 10]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} color="#dfe6ff" />
        <Lightformer intensity={0.35} position={[-20, 6, -10]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} color="#ffffff" />
      </Environment>
    </>
  )
}

export function Scene() {
  return (
    <>
      <color attach="background" args={[COLORS.ground]} />
      <fog attach="fog" args={[COLORS.ground, 110, 260]} />
      <Simulation />
      <Lights />
      <Rig />
      <Suspense fallback={null}>
        <Site />
      </Suspense>
      <EffectComposer multisampling={4}>
        <N8AO halfRes aoRadius={1.4} intensity={2.4} distanceFalloff={0.8} color="#29304a" />
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.75} radius={0.6} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </>
  )
}
