// Tideline: launch-site operations for the made-up Saltgrass Point complex, drawn as a point-cloud survey.
import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, N8AO, TiltShift2 } from '@react-three/postprocessing'
import * as THREE from 'three'
import { World, onMissed } from './scene.jsx'
import { Dashboard } from './ui.jsx'

function FpsProbe() {
  useEffect(() => {
    const samples = []
    let last = performance.now()
    let frame
    const tick = (now) => {
      samples.push(now - last)
      last = now
      if (samples.length > 120) samples.shift()
      window.__fps = 1000 / (samples.reduce((sum, value) => sum + value, 0) / samples.length)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return null
}

export function App() {
  return (
    <div className="app">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 32, near: 2, far: 9000, position: [400, 300, 400] }}
        onPointerMissed={onMissed}
      >
        <color attach="background" args={['#e6e7e6']} />
        <fog attach="fog" args={['#e6e7e6', 900, 2600]} />
        <Suspense fallback={null}>
          <World />
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <N8AO aoRadius={7} intensity={3.2} distanceFalloff={0.8} halfRes quality="medium" color="#3a3d40" />
            <TiltShift2 blur={0.16} taper={0.55} start={[0, 0.56]} end={[1, 0.56]} samples={8} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <FpsProbe />
      <Dashboard />
    </div>
  )
}
