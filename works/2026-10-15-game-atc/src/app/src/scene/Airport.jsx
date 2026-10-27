// Ondra Bay airport: two parallel runways, taxiway A, the apron with six stands, the terminal,
// tower, radar and the runway lighting, all from the Blender kit except the painted pavement.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RUNWAYS, STAND_X, STAND_Z, TAXIWAY_Z } from '../data.js'
import { selectEntity } from '../store.js'
import { InstancedModel, Model, findParts, useAssets } from './assets.jsx'
import { PALETTE, glow } from './materials.js'

const PIXELS_PER_UNIT = 5

function runwayTexture(runway) {
  const length = runway.to - runway.from
  const width = PIXELS_PER_UNIT * length
  const height = Math.round(PIXELS_PER_UNIT * runway.width)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const unit = PIXELS_PER_UNIT
  context.fillStyle = PALETTE.runway
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, unit * 0.6, width, unit * 0.45)
  context.fillRect(0, height - unit * 1.05, width, unit * 0.45)
  const stripes = 6
  for (const end of [0, 1]) {
    const start = end === 0 ? unit * 2 : width - unit * 2 - unit * 12
    for (let index = 0; index < stripes; index++) {
      const lane = (height - unit * 4) / (stripes * 2 - 1)
      context.fillRect(start, unit * 2 + index * 2 * lane, unit * 12, lane)
    }
    // Aiming point and touchdown zone bars.
    const aim = end === 0 ? unit * 50 : width - unit * 50 - unit * 18
    context.fillRect(aim, unit * 3, unit * 18, unit * 2.2)
    context.fillRect(aim, height - unit * 5.2, unit * 18, unit * 2.2)
  }
  context.setLineDash([unit * 9, unit * 7])
  context.strokeStyle = '#ffffff'
  context.lineWidth = unit * 0.5
  context.beginPath()
  context.moveTo(unit * 34, height / 2)
  context.lineTo(width - unit * 34, height / 2)
  context.stroke()
  context.font = `700 ${Math.round(height * 0.62)}px "Segoe UI Variable Display", "Segoe UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  // Each number reads upright for an aircraft landing over that threshold.
  const label = (text, x, angle) => {
    context.save()
    context.translate(x, height / 2)
    context.rotate(angle)
    context.fillText(text, 0, 0)
    context.restore()
  }
  label(runway.name, width - unit * 24, -Math.PI / 2)
  label(runway.reverseName, unit * 24, Math.PI / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function pavement(color, layer, map = null) {
  return new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : color, map, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4 })
}

function Slab({ x, z, width, depth, material, height = 0, onClick }) {
  return (
    <mesh position={[x, height, z]} rotation-x={-Math.PI / 2} material={material} receiveShadow onClick={onClick}>
      <planeGeometry args={[width, depth]} />
    </mesh>
  )
}

function Runway({ runway }) {
  const material = useMemo(() => pavement(null, 4, runwayTexture(runway)), [runway])
  return (
    <Slab
      x={(runway.from + runway.to) / 2}
      z={runway.z}
      width={runway.to - runway.from}
      depth={runway.width}
      material={material}
      height={0.04}
      onClick={(event) => selectEntity(event, runway.id)}
    />
  )
}

function Pavement() {
  const materials = useMemo(
    () => ({ apron: pavement(PALETTE.apron, 1), taxiway: pavement(PALETTE.taxiway, 2), line: pavement(PALETTE.taxiLine, 3) }),
    [],
  )
  const line = 0.7
  return (
    <group>
      <Slab x={0} z={-158} width={300} depth={104} material={materials.apron} height={0.01} />
      <Slab x={8} z={TAXIWAY_Z} width={540} depth={14} material={materials.taxiway} height={0.02} />
      <Slab x={8} z={TAXIWAY_Z} width={530} depth={line} material={materials.line} height={0.03} />
      <Slab x={-147} z={-75} width={16} depth={52} material={materials.taxiway} height={0.02} />
      <Slab x={-147} z={-77} width={line} depth={44} material={materials.line} height={0.03} />
      <Slab x={262} z={-30} width={16} depth={154} material={materials.taxiway} height={0.02} />
      <Slab x={262} z={-30} width={line} depth={140} material={materials.line} height={0.03} />
      <Slab x={250} z={40} width={36} depth={26} material={materials.taxiway} height={0.02} />
      <Slab x={262} z={RUNWAYS.R2.z - 25} width={14} depth={1.2} material={materials.line} height={0.035} />
      {STAND_X.map((x) => (
        <Slab key={x} x={x} z={(STAND_Z + TAXIWAY_Z) / 2 - 4} width={line} depth={TAXIWAY_Z - STAND_Z - 8} material={materials.line} height={0.03} />
      ))}
    </group>
  )
}

// Edge lights every few dozen metres along both runways and the taxiway.
function EdgeLights({ nodes }) {
  const { white, blue } = useMemo(() => {
    const whiteItems = []
    Object.values(RUNWAYS).forEach((runway) => {
      for (let x = runway.from; x <= runway.to; x += 30) {
        whiteItems.push({ position: [x, 0, runway.z - runway.width / 2 - 1.2] }, { position: [x, 0, runway.z + runway.width / 2 + 1.2] })
      }
    })
    const blueItems = []
    for (let x = -250; x <= 270; x += 36) blueItems.push({ position: [x, 0, TAXIWAY_Z - 8] }, { position: [x, 0, TAXIWAY_Z + 8] })
    return { white: whiteItems, blue: blueItems }
  }, [])
  return (
    <>
      <InstancedModel node={nodes.edge_light_white} items={white} shadows={false} />
      <InstancedModel node={nodes.edge_light_blue} items={blue} shadows={false} />
    </>
  )
}

function ApproachLights({ nodes }) {
  const object = useMemo(() => nodes.approach_lights.clone(true), [nodes])
  const bars = useMemo(() => [0, 1, 2, 3, 4].map((index) => findParts(object, `approach_lights_bar${index}`)[0]).filter(Boolean), [object])
  // The sequenced flasher runs from the outermost bar to the threshold twice a second.
  useFrame(({ clock }) => {
    const step = Math.floor(clock.elapsedTime * 10) % 6
    bars.forEach((bar, index) => {
      bar.visible = step !== 5 - index
    })
  })
  return <primitive object={object} position={[RUNWAYS.R1.to + 4, 0, RUNWAYS.R1.z]} rotation-y={Math.PI / 2} />
}

function Papi({ nodes }) {
  const object = useMemo(() => {
    const clone = nodes.papi.clone(true)
    const colors = ['#ffffff', '#ffffff', '#ff3b30', '#ff3b30']
    colors.forEach((color, index) => {
      findParts(clone, `papi_lens${index}`).forEach((lens) => {
        lens.material = glow(color, 3)
      })
    })
    return clone
  }, [nodes])
  return <primitive object={object} position={[RUNWAYS.R1.to - 40, 0, RUNWAYS.R1.z + RUNWAYS.R1.width / 2 + 6]} rotation-y={Math.PI / 2} />
}

function Spinning({ node, part, speed, axis = 'y', ...props }) {
  const object = useMemo(() => {
    const clone = node.clone(true)
    clone.position.set(0, 0, 0)
    return clone
  }, [node])
  const moving = useMemo(() => findParts(object, part), [object, part])
  useFrame((_, dt) => {
    moving.forEach((piece) => {
      piece.rotation[axis] += speed * dt
    })
  })
  return <primitive object={object} {...props} />
}

function Windsock({ nodes }) {
  const object = useMemo(() => nodes.windsock.clone(true), [nodes])
  const sock = useMemo(() => findParts(object, 'windsock_sock')[0], [object])
  useFrame(({ clock }) => {
    if (!sock) return
    sock.rotation.y = 1.75 + Math.sin(clock.elapsedTime * 0.9) * 0.12
    sock.rotation.z = 0.08 + Math.sin(clock.elapsedTime * 1.7) * 0.05
  })
  return <primitive object={object} position={[40, 0, -78]} />
}

// A follow-me car patrolling taxiway A so the ground is never still.
function FollowMe({ nodes }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const span = 420
    const cycle = (clock.elapsedTime * 9) % (span * 2)
    const forward = cycle < span
    const x = -200 + (forward ? cycle : span * 2 - cycle)
    ref.current.position.set(x, 0, TAXIWAY_Z + (forward ? 3.2 : -3.2))
    ref.current.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2
  })
  return (
    <group ref={ref}>
      <Model node={nodes.follow_me} />
    </group>
  )
}

export function Airport() {
  const nodes = useAssets()
  const select = (id) => (event) => selectEntity(event, id)
  return (
    <group>
      <Pavement />
      <Runway runway={RUNWAYS.R1} />
      <Runway runway={RUNWAYS.R2} />
      <EdgeLights nodes={nodes} />
      <ApproachLights nodes={nodes} />
      <Papi nodes={nodes} />
      <Model node={nodes.localizer} position={[RUNWAYS.R1.from - 24, 0, RUNWAYS.R1.z]} rotation-y={Math.PI / 2} />
      <Model node={nodes.glideslope} position={[RUNWAYS.R1.to - 46, 0, RUNWAYS.R1.z - RUNWAYS.R1.width / 2 - 12]} rotation-y={Math.PI / 2} />
      <Windsock nodes={nodes} />
      <Model node={nodes.sign_runway} position={[254, 0, RUNWAYS.R2.z - 27]} rotation-y={Math.PI} />
      <Model node={nodes.sign_taxi} position={[-158, 0, TAXIWAY_Z + 9]} />

      <Model node={nodes.terminal_main} position={[0, 0, -232]} />
      <Model node={nodes.terminal_pier} position={[-82, 0, -228]} />
      <Model node={nodes.terminal_pier} position={[82, 0, -228]} />
      <Model node={nodes.tower_main} position={[200, 0, -170]} rotation-y={-0.6} onClick={select('tower')} />
      <Model node={nodes.hangar_a} position={[-215, 0, -205]} />
      <Model node={nodes.hangar_b} position={[-268, 0, -238]} />
      <Model node={nodes.fire_station} position={[-60, 0, -4]} rotation-y={Math.PI} />
      <Model node={nodes.fire_truck} position={[-48, 0, 6]} rotation-y={0.2} />
      <Model node={nodes.fuel_farm} position={[255, 0, -225]} />
      <Spinning node={nodes.radar_asr} part="radar_asr_antenna" speed={1.3} position={[-300, 0, -150]} />
      <Model node={nodes.radar_weather} position={[-330, 0, -205]} />
      <Model node={nodes.tug} position={[-100, 0, -190]} rotation-y={0.4} />
      <Model node={nodes.tug} position={[52, 0, -192]} rotation-y={-0.3} />
      <FollowMe nodes={nodes} />
    </group>
  )
}
