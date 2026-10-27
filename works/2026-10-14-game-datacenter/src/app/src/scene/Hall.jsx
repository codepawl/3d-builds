// The data hall: raised floor, aisles, cut-away walls, racks with GPU trays, cable trays and cooling units.
// Racks, trays, walls, cable trays, cooling units and docks are Blender models from public/assets/hall.glb and cooling.glb.
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, Matrix4, RepeatWrapping, SRGBColorSpace } from 'three'
import { RACK, createRandom } from '../world.js'
import { COLORS, temperatureColor } from './palette.js'
import { selectOnClick } from './picking.js'
import { InstancedAsset, fillRun, findRotors, placement, recolorParts, useAssetClone, useInstanceParts } from './assets.jsx'

const TRAY_BASE_Y = 0.36
const TRAY_GAP_Y = 0.2
// The tray faceplate sits just behind the rack's front rails.
const TRAY_FRONT_Z = RACK.depth / 2 - 0.05
const CABLE_TRAY_Y = 2.62
const CABLE_TRAY_MODULE = 2
const WALL_MODULE = 3
const RACK_VARIANTS = ['rack_a', 'rack_b', 'rack_c']

function useFloorTexture(width, depth) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = '#f5f7fc'
    context.fillRect(0, 0, 256, 256)
    context.strokeStyle = '#e2e7f2'
    context.lineWidth = 3
    for (let line = 0; line <= 4; line++) {
      context.beginPath()
      context.moveTo(line * 64, 0)
      context.lineTo(line * 64, 256)
      context.moveTo(0, line * 64)
      context.lineTo(256, line * 64)
      context.stroke()
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    // One canvas holds four 0.6 m tiles.
    texture.repeat.set(width / 2.4, depth / 2.4)
    return texture
  }, [width, depth])
}

function Floor({ layout }) {
  const width = layout.wallX * 2
  const depth = layout.wallZ * 2
  const texture = useFloorTexture(width, depth)
  return (
    <mesh position={[0, -0.12, 0]} receiveShadow>
      <boxGeometry args={[width, 0.24, depth]} />
      <meshStandardMaterial attach="material-0" color="#e6eaf3" />
      <meshStandardMaterial attach="material-1" color="#e6eaf3" />
      <meshStandardMaterial attach="material-2" map={texture} roughness={0.85} />
      <meshStandardMaterial attach="material-3" color="#e6eaf3" />
      <meshStandardMaterial attach="material-4" color="#dfe4ef" />
      <meshStandardMaterial attach="material-5" color="#dfe4ef" />
    </mesh>
  )
}

function Aisles({ site, layout }) {
  const aisles = []
  for (let boundary = 0; boundary <= site.rows; boundary++) {
    const z = (boundary - site.rows / 2) * RACK.pitchZ
    // Between an even row and the next odd row the fronts meet: a cold aisle. Every other gap is hot.
    const cold = boundary % 2 === 1
    aisles.push(
      <mesh key={boundary} position={[0, 0.006, z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[layout.halfSpanX * 2 + 0.6, RACK.pitchZ - RACK.depth - 0.1]} />
        <meshStandardMaterial color={cold ? COLORS.coldAisle : COLORS.hotAisle} roughness={0.9} />
      </mesh>,
    )
  }
  return <group>{aisles}</group>
}

// Precast wall modules tiled along each side. Back walls stand tall, front walls stay low so the camera sees in: a cut-away diorama.
function Walls({ layout }) {
  const tallParts = useInstanceParts('hall', 'wall_tall')
  const lowParts = useInstanceParts('hall', 'wall_low')
  const { tall, low } = useMemo(() => {
    const { wallX, wallZ } = layout
    const runs = [
      { tall: true, center: [0, -wallZ], length: wallX * 2 + 0.32, alongX: true },
      { tall: true, center: [-wallX, 0], length: wallZ * 2, alongX: false },
      { tall: false, center: [0, wallZ], length: wallX * 2 + 0.32, alongX: true },
      { tall: false, center: [wallX, 0], length: wallZ * 2, alongX: false },
    ]
    const matrices = { tall: [], low: [] }
    for (const run of runs) {
      const { offsets, stretch } = fillRun(run.length, WALL_MODULE)
      for (const offset of offsets) {
        const x = run.center[0] + (run.alongX ? offset : 0)
        const z = run.center[1] + (run.alongX ? 0 : offset)
        matrices[run.tall ? 'tall' : 'low'].push(placement(x, 0, z, run.alongX ? 0 : Math.PI / 2, [stretch, 1, 1]))
      }
    }
    return matrices
  }, [layout])
  return (
    <group>
      <InstancedAsset parts={tallParts} matrices={tall} />
      <InstancedAsset parts={lowParts} matrices={low} />
    </group>
  )
}

function rackMatrix(rack) {
  return placement(rack.x, 0, rack.z, rack.facing > 0 ? 0 : Math.PI)
}

function RackBodies({ world, variant, racks }) {
  const color = world.site.rackColor
  const baseParts = useInstanceParts('hall', variant)
  const parts = useMemo(() => recolorParts(baseParts, { rack_paint: color, rack_door: color }), [baseParts, color])
  const matrices = useMemo(() => racks.map(rackMatrix), [racks])
  return <InstancedAsset parts={parts} matrices={matrices} onClick={selectOnClick((event) => racks[event.instanceId]?.id)} />
}

// GPU tray faceplates, their temperature glow bars and the rack status strips. Glow colours come from the model every frame.
function TraysAndStrips({ racks }) {
  const trayParts = useInstanceParts('hall', 'gpu_tray')
  const [glowPart] = useInstanceParts('hall', 'tray_glow')
  const [stripPart] = useInstanceParts('hall', 'status_strip')
  const glowRef = useRef()
  const stripRef = useRef()
  const scratchColor = useMemo(() => new Color(), [])

  const { trayMatrices, stripMatrices } = useMemo(() => {
    const trays = []
    const strips = []
    const offset = new Matrix4()
    for (const rack of racks) {
      const base = rackMatrix(rack)
      for (let tray = 0; tray < RACK.trays; tray++) {
        offset.makeTranslation(0, TRAY_BASE_Y + tray * TRAY_GAP_Y, TRAY_FRONT_Z)
        trays.push(base.clone().multiply(offset))
      }
      offset.makeTranslation(0, RACK.height + 0.012, RACK.depth / 2 - 0.06)
      strips.push(base.clone().multiply(offset))
    }
    return { trayMatrices: trays, stripMatrices: strips }
  }, [racks])

  useFrame(({ clock }) => {
    const blinkOn = Math.sin(clock.elapsedTime * 9) > 0
    racks.forEach((rack, index) => {
      for (let tray = 0; tray < RACK.trays; tray++) {
        if (tray === rack.failedTray) scratchColor.set(blinkOn ? '#ff2d44' : '#3a0a10').multiplyScalar(blinkOn ? 3 : 1)
        else temperatureColor(rack.trayTemperatures[tray], scratchColor)
        glowRef.current.setColorAt(index * RACK.trays + tray, scratchColor)
      }
      temperatureColor(rack.temperature, scratchColor, 1.6)
      stripRef.current.setColorAt(index, scratchColor)
    })
    glowRef.current.instanceColor.needsUpdate = true
    stripRef.current.instanceColor.needsUpdate = true
  })

  const pickTray = selectOnClick((event) => racks[Math.floor(event.instanceId / RACK.trays)]?.id)
  return (
    <group>
      <InstancedAsset parts={trayParts} matrices={trayMatrices} castShadow={false} onClick={pickTray} />
      <GlowInstances meshRef={glowRef} geometry={glowPart.geometry} matrices={trayMatrices} onClick={pickTray} />
      <GlowInstances meshRef={stripRef} geometry={stripPart.geometry} matrices={stripMatrices} />
    </group>
  )
}

function GlowInstances({ meshRef, geometry, matrices, onClick }) {
  useLayoutEffect(() => {
    const mesh = meshRef.current
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    // Create the colour buffer before the first frame writes into it.
    mesh.setColorAt(0, new Color())
    mesh.computeBoundingSphere()
  }, [meshRef, matrices])
  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, matrices.length]} onClick={onClick}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function Racks({ world }) {
  const racksByVariant = useMemo(() => {
    const random = createRandom(world.site.seed + 17)
    const groups = RACK_VARIANTS.map(() => [])
    for (const rack of world.racks) groups[Math.floor(random() * RACK_VARIANTS.length)].push(rack)
    return groups
  }, [world])
  return (
    <group>
      {RACK_VARIANTS.map((variant, index) => (
        <RackBodies key={variant} world={world} variant={variant} racks={racksByVariant[index]} />
      ))}
      <TraysAndStrips racks={world.racks} />
    </group>
  )
}

// Ladder trays over every row on posts standing on the racks, and a spine along the left corridor on floor stands.
function CableTrays({ site, layout }) {
  const trayParts = useInstanceParts('hall', 'cable_tray')
  const postParts = useInstanceParts('hall', 'cable_tray_post')
  const standParts = useInstanceParts('hall', 'cable_stand')
  const { trays, posts, stands } = useMemo(() => {
    const matrices = { trays: [], posts: [], stands: [] }
    const rowLength = layout.halfSpanX * 2 + 0.4
    const rowRun = fillRun(rowLength, CABLE_TRAY_MODULE)
    const spineX = -layout.halfSpanX - 0.2
    for (let row = 0; row < site.rows; row++) {
      const z = (row - (site.rows - 1) / 2) * RACK.pitchZ
      for (const offset of rowRun.offsets) matrices.trays.push(placement(offset, CABLE_TRAY_Y, z, 0, [rowRun.stretch, 1, 1]))
      // A post every fourth rack, so each one lands on a rack top.
      for (let column = 1; column < site.racksPerRow; column += 4) {
        matrices.posts.push(placement((column - (site.racksPerRow - 1) / 2) * RACK.pitchX, CABLE_TRAY_Y, z))
      }
      matrices.stands.push(placement(spineX, CABLE_TRAY_Y, z))
    }
    const spineLength = (site.rows - 1) * RACK.pitchZ + 0.5
    const spineRun = fillRun(spineLength, CABLE_TRAY_MODULE)
    for (const offset of spineRun.offsets) {
      matrices.trays.push(placement(spineX, CABLE_TRAY_Y + 0.004, offset, Math.PI / 2, [spineRun.stretch, 1, 1]))
    }
    return matrices
  }, [site, layout])
  return (
    <group>
      <InstancedAsset parts={trayParts} matrices={trays} />
      <InstancedAsset parts={postParts} matrices={posts} />
      <InstancedAsset parts={standParts} matrices={stands} />
    </group>
  )
}

// Spins every `_rotor` node of a model about its own axis at speedRef.current (1 = nominal).
export function useSpinningRotors(object, speedRef) {
  const rotors = useMemo(() => findRotors(object), [object])
  useFrame((_, delta) => {
    for (const rotor of rotors) rotor.rotation.y += delta * (speedRef.current ?? 0.7) * 14
  })
}

function CoolingUnit({ unit }) {
  const model = useAssetClone('cooling', 'crah')
  const speedRef = useRef(unit.fanSpeed)
  useFrame(({ clock }) => {
    // A worn bearing makes the fan surge and stall.
    const surge = unit.health < 0.8 ? 0.55 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 3.3)) : 1
    speedRef.current = unit.fanSpeed * surge
  })
  useSpinningRotors(model, speedRef)
  // The model's front faces +Z; turn it to face the racks.
  return (
    <group position={[unit.x, 0, unit.z]} rotation-y={-unit.side * Math.PI / 2} onClick={selectOnClick(() => unit.id)}>
      <primitive object={model} />
    </group>
  )
}

function RobotDock({ home }) {
  const model = useAssetClone('hall', 'dock')
  return <primitive object={model} position={[home.x, 0, home.z]} />
}

export const Hall = memo(function Hall({ world }) {
  const { site, layout } = world
  return (
    <group>
      <Floor layout={layout} />
      <Aisles site={site} layout={layout} />
      <Walls layout={layout} />
      <Racks world={world} />
      <CableTrays site={site} layout={layout} />
      {world.equipment.filter((item) => item.kind === 'crah').map((unit) => <CoolingUnit key={unit.id} unit={unit} />)}
      {world.units.filter((unit) => unit.kind === 'robot').map((robot) => <RobotDock key={robot.id} home={robot.home} />)}
    </group>
  )
})
