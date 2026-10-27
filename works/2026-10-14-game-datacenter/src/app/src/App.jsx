import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './scene/Scene.jsx'
import { TopBar } from './ui/TopBar.jsx'
import { CameraButtons, DetailCard, Kpis } from './ui/Panels.jsx'
import { ListTabs, RunTimeline } from './ui/BottomBar.jsx'
import { activeWorld, select } from './store.js'
import { entityPosition } from './world.js'
import { lookFrom, projectToScreen } from './cameraRig.js'

// The film script records frames from the canvas, which needs the drawing buffer kept.
const filmMode = new URLSearchParams(window.location.search).has('film')

// Lets the film script find where a moving object is on screen; it still clicks with the real mouse.
window.kelvin = {
  screenPositionOf(id) {
    const world = activeWorld()
    const entity = world.index.get(id)
    if (!entity) return null
    const { x, z } = entityPosition(world, entity)
    return projectToScreen(x, entity.kind === 'robot' ? 0.5 : 1.0, z)
  },
  // Close-up screenshots: where an entity stands, and an instant camera placement.
  positionOf(id) {
    const world = activeWorld()
    const entity = world.index.get(id)
    return entity ? entityPosition(world, entity) : null
  },
  lookFrom,
  select,
  ids: () => [...activeWorld().index.keys()],
  units: () => {
    const world = activeWorld()
    return world.units.map(({ id, state, ticketId, path, x }) => ({
      id, state, ticketId, waypoints: path.length,
      // In a side corridor nothing stands between the camera and the unit.
      inCorridor: Math.abs(Math.abs(x) - world.layout.corridorX) < 0.3,
    }))
  },
}

export function App() {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="app">
      <Canvas
        className="scene"
        shadows="percentage"
        dpr={1}
        gl={{ antialias: false, preserveDrawingBuffer: filmMode, powerPreference: 'high-performance' }}
        camera={{ fov: 28, near: 1, far: 600, position: [40, 40, 40] }}
        onPointerMissed={(event) => event.button === 0 && select(null)}
      >
        <Scene />
      </Canvas>
      <TopBar />
      <Kpis />
      <CameraButtons />
      <DetailCard />
      <RunTimeline />
      <ListTabs />
    </div>
  )
}
