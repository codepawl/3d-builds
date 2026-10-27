// The film's scenes. Exteriors, except the 1957 jail room and courtroom, the Waupun ward, the 1968 courtroom and
// the 1984 hospital corridor. Buildings reuse the app's models; the
// La Crosse house, the school road, the courthouse, the hospital and the corridor are simple blocks.
// People are mannequins (Mannequin.jsx). No victim ever appears as a figure, and no figure of Ed Gein shares a
// scene with a victim. Every animation reads clock.shotSeconds.
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  ASSETS, TimeOfDay, Trees, useBuilding, cloneNode, getSlipTexture, getGlowTexture, seededRandom,
  VIGNETTE_TREE_SPOTS, VILLAGE_TREE_SPOTS, FARM_TREE_SPOTS, POLICE_CARS, LAMP_RIGS,
} from '../world.jsx'
import { easeInOut, smoothstep } from '../anim.js'
import { Mannequin, COLORS } from './Mannequin.jsx'
import { clock } from './clock.js'
import { frameGlazing, panelDoor } from './joinery.js'
import { MapScene, Plate } from './MapScene.jsx'

const WINDOW_WARM = new THREE.Color('#ffcf8a')
const WINDOW_RED = new THREE.Color('#ff2a2f')

// ---------- small shared pieces ----------

function Ground({ color = '#1b1c1f' }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[900, 900]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

function Backdrop({ color }) {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color(color)
    scene.fog = null
  }, [scene, color])
  return null
}

function Block({ position, size, color = '#2c2d31', ...rest }) {
  return (
    <mesh position={position} castShadow receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

function Glow({ position, size, color = '#ffcf8a', intensity = 1, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(intensity)} toneMapped={false} />
    </mesh>
  )
}

// Snow as soft round discs that drift down and wrap at the ground.
let snowflakeTexture = null
function getSnowflakeTexture() {
  if (snowflakeTexture) return snowflakeTexture
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  snowflakeTexture = new THREE.CanvasTexture(canvas)
  return snowflakeTexture
}

function Snow({ box, count = 1600, top = 30 }) {
  const points = useMemo(() => {
    const random = seededRandom(1116)
    const positions = new Float32Array(count * 3)
    const seeds = []
    for (let index = 0; index < count; index++) {
      seeds.push({ x: box[0] + random() * (box[1] - box[0]), z: box[2] + random() * (box[3] - box[2]), height: random() * top, speed: 1.1 + random() * 0.7, phase: random() * 6.28 })
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({ color: '#eef1f6', size: 0.22, map: getSnowflakeTexture(), transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.02 })
    return { object: new THREE.Points(geometry, material), seeds }
  }, [box, count, top])
  useFrame(() => {
    const seconds = clock.shotSeconds
    const positions = points.object.geometry.attributes.position
    points.seeds.forEach((flake, index) => {
      const height = (((flake.height - seconds * flake.speed) % top) + top) % top
      positions.setXYZ(index, flake.x + Math.sin(seconds * 0.6 + flake.phase) * 0.4, height, flake.z + Math.cos(seconds * 0.5 + flake.phase) * 0.3)
    })
    positions.needsUpdate = true
  })
  return <primitive object={points.object} />
}

const FRAME_COLOR = '#151517'

// A window on a wall facing +z (rotate the group for other faces): lit pane, frame, sash bar and mullion, sill.
function FramedWindow({ position, size = [0.9, 1.2], glow = 0.9, color = '#ffcf8a', rotation = 0 }) {
  const [width, height] = size
  const bar = 0.07
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Glow position={[0, 0, 0.01]} size={size} color={color} intensity={glow} />
      <Block position={[0, height / 2 + bar / 2, 0.04]} size={[width + bar * 2, bar, 0.08]} color={FRAME_COLOR} />
      <Block position={[0, -height / 2 - bar / 2, 0.06]} size={[width + bar * 3, bar * 1.4, 0.14]} color={FRAME_COLOR} />
      <Block position={[-width / 2 - bar / 2, 0, 0.04]} size={[bar, height, 0.08]} color={FRAME_COLOR} />
      <Block position={[width / 2 + bar / 2, 0, 0.04]} size={[bar, height, 0.08]} color={FRAME_COLOR} />
      <Block position={[0, 0, 0.03]} size={[0.035, height, 0.05]} color={FRAME_COLOR} />
      <Block position={[0, 0, 0.03]} size={[width, 0.065, 0.06]} color={FRAME_COLOR} />
      <Block position={[0, height / 4, 0.03]} size={[width, 0.035, 0.05]} color={FRAME_COLOR} />
      <Block position={[0, -height / 4, 0.03]} size={[width, 0.035, 0.05]} color={FRAME_COLOR} />
    </group>
  )
}

const DOOR_WOOD = '#2b231f'
const DOOR_PANEL = '#352c26'

// One door leaf facing +z: rails and stiles as a solid slab, four raised panels, and, with `lite`, a glazed
// upper light split by a muntin cross (the light shows through the panes, the frame stays solid).
function DoorLeaf({ x, width, height, lite, glow }) {
  const panelWidth = width * 0.34
  const liteHeight = height * 0.3
  return (
    <group position={[x, 0, 0]}>
      <Block position={[0, height / 2, 0.03]} size={[width, height, 0.06]} color={DOOR_WOOD} />
      {[-1, 1].map((side) => [0.18, 0.42].map((level) => (
        <Block key={`${side}-${level}`} position={[(side * width) / 4.2, height * level, 0.07]} size={[panelWidth, height * 0.18, 0.03]} color={DOOR_PANEL} />
      )))}
      {lite ? (
        <group position={[0, height * 0.75, 0.065]}>
          <Glow position={[0, 0, 0]} size={[width * 0.7, liteHeight]} intensity={glow} />
          <Block position={[0, 0, 0.01]} size={[0.035, liteHeight, 0.03]} color={FRAME_COLOR} />
          <Block position={[0, 0, 0.01]} size={[width * 0.7, 0.035, 0.03]} color={FRAME_COLOR} />
        </group>
      ) : (
        <Block position={[0, height * 0.72, 0.07]} size={[panelWidth * 2.3, height * 0.22, 0.03]} color={DOOR_PANEL} />
      )}
      <mesh position={[width * 0.38 * (x > 0 ? -1 : 1), height * 0.47, 0.11]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color="#8a7a5a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

// A door on a +z wall: casing, lintel, a step, and one leaf or a pair (`double`).
function FramedDoor({ position, size = [1, 2.1], double = false, lite = false, glow = 0.7 }) {
  const [width, height] = size
  const leafWidth = double ? width / 2 - 0.01 : width
  return (
    <group position={position}>
      {double ? (
        <>
          <DoorLeaf x={-width / 4} width={leafWidth} height={height} lite={lite} glow={glow} />
          <DoorLeaf x={width / 4} width={leafWidth} height={height} lite={lite} glow={glow} />
        </>
      ) : (
        <DoorLeaf x={0} width={leafWidth} height={height} lite={lite} glow={glow} />
      )}
      <Block position={[0, height + 0.09, 0.06]} size={[width + 0.4, 0.18, 0.14]} color={FRAME_COLOR} />
      <Block position={[-width / 2 - 0.08, height / 2, 0.06]} size={[0.14, height, 0.12]} color={FRAME_COLOR} />
      <Block position={[width / 2 + 0.08, height / 2, 0.06]} size={[0.14, height, 0.12]} color={FRAME_COLOR} />
      <Block position={[0, 0.1, 0.38]} size={[width + 0.6, 0.2, 0.7]} color="#2a2b2e" />
    </group>
  )
}

// Clapboard siding: thin shadowed boards across a +z wall.
function Clapboard({ width, height, z, color = '#36373b' }) {
  const boards = []
  for (let y = 0.45; y < height - 0.1; y += 0.3) boards.push(y)
  return boards.map((y) => <Block key={y} position={[0, y, z + 0.02]} size={[width, 0.05, 0.04]} color={color} castShadow={false} />)
}

// Glowing edges on the building that matters in a shot, built once the target exists; fades in after `delay`.
// `target` is an Object3D, a ref, or a function returning one. `keep(worldPoint)`, when given, keeps only the
// edges with both ends inside it (the store keeps its front, so its deep roof line does not run off past the roof).
function Highlight({ target, color, delay = 0.4, strength = 1.6, skip = /light_pool|outline|rear_lot|label/, keep, clip }) {
  const groupRef = useRef()
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [color, strength])
  // Edges behind an open doorway are cut away with the walls (clip: { planes, except: the door }).
  const clippedMaterial = useMemo(() => {
    if (!clip) return material
    const copy = material.clone()
    copy.clippingPlanes = clip.planes
    copy.clipIntersection = true
    return copy
  }, [material, clip])
  const built = useRef(false)
  useFrame(() => {
    const object = typeof target === 'function' ? target() : target?.isObject3D ? target : target?.current
    if (!built.current && object && groupRef.current) {
      built.current = true
      object.updateMatrixWorld(true)
      const inverseParent = groupRef.current.matrixWorld.clone().invert()
      object.traverse((child) => {
        if (!child.isMesh || !child.visible || child.userData.joinery || skip.test(child.name) || child.material?.name?.startsWith('red_glow')) return
        const geometry = new THREE.EdgesGeometry(child.geometry, 35)
        if (keep) keepEdges(geometry, child.matrixWorld, keep)
        const edges = new THREE.LineSegments(geometry, clip && !isInside(child, clip.except) ? clippedMaterial : material)
        edges.matrixAutoUpdate = false
        edges.matrix.multiplyMatrices(inverseParent, child.matrixWorld)
        groupRef.current.add(edges)
      })
    }
    material.opacity = 0.85 * smoothstep((clock.shotSeconds - delay) / 0.9)
    clippedMaterial.opacity = material.opacity
  })
  return <group ref={groupRef} />
}

function keepEdges(geometry, matrixWorld, keep) {
  const positions = geometry.attributes.position
  const start = new THREE.Vector3()
  const end = new THREE.Vector3()
  const kept = []
  for (let index = 0; index + 1 < positions.count; index += 2) {
    start.fromBufferAttribute(positions, index)
    end.fromBufferAttribute(positions, index + 1)
    const startWorld = start.clone().applyMatrix4(matrixWorld)
    const endWorld = end.clone().applyMatrix4(matrixWorld)
    if (keep(startWorld) && keep(endWorld)) kept.push(start.x, start.y, start.z, end.x, end.y, end.z)
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
}

// A plain gable house with detail: foundation, clapboard, eaves, chimney, framed windows and door, a porch.
function GableHouse({ position, width, depth, height, color = '#2e2f33', roof = '#1c1c1f', windows = [], windowColor = '#ffcf8a', glow = 0.9, porch = true, chimney = true }) {
  const pitch = 0.6
  const slab = depth / 2 / Math.cos(pitch) + 0.55
  const front = depth / 2
  return (
    <group position={position}>
      <Block position={[0, 0.2, 0]} size={[width + 0.2, 0.4, depth + 0.2]} color="#232326" />
      <Block position={[0, height / 2 + 0.2, 0]} size={[width, height - 0.4, depth]} color={color} />
      <Clapboard width={width} height={height} z={front} color={new THREE.Color(color).multiplyScalar(1.25).getStyle()} />
      <Block position={[0, height - 0.05, front + 0.12]} size={[width + 0.6, 0.12, 0.2]} color={FRAME_COLOR} />
      {[1, -1].map((side) => <Block key={side} position={[side * (width / 2 - 0.05), height / 2, front + 0.03]} size={[0.14, height, 0.08]} color={FRAME_COLOR} />)}
      {chimney ? <Block position={[width * 0.28, height + depth * 0.32, -depth * 0.12]} size={[0.6, depth * 0.55, 0.6]} color="#2a2423" /> : null}
      {[1, -1].map((side) => (
        <Block
          key={side}
          position={[0, height + (depth / 4) * Math.tan(pitch), (side * depth) / 4]}
          size={[width + 0.5, 0.2, slab]}
          rotation={[side * pitch, 0, 0]}
          color={roof}
        />
      ))}
      {[1, -1].map((side) => (
        <mesh key={`gable${side}`} position={[(side * width) / 2, height, 0]} rotation={[0, side * Math.PI / 2, 0]} castShadow>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, (depth / 2) * Math.tan(pitch))])]} />
          <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {windows.map(([x, y], index) => (
        <FramedWindow key={index} position={[x, y, front + 0.02]} color={windowColor} glow={glow} />
      ))}
      <FramedDoor position={[0, 0.4, front + 0.02]} />
      {porch ? (
        <group position={[0, 0, front]}>
          <Block position={[0, 0.3, 1.1]} size={[3.2, 0.2, 2.2]} color="#2b2b2e" />
          {[-1.45, 1.45].map((x) => <Block key={x} position={[x, 1.55, 2.1]} size={[0.14, 2.5, 0.14]} color={FRAME_COLOR} />)}
          <Block position={[0, 2.85, 1.2]} size={[3.6, 0.12, 2.6]} rotation={[0.18, 0, 0]} color={roof} />
          <Block position={[0, 0.1, 2.45]} size={[1.4, 0.2, 0.5]} color="#2b2b2e" />
        </group>
      ) : null}
    </group>
  )
}

// Fence posts with two wires along x, at a fixed z.
function Fence({ fromX, toX, z, spacing = 3 }) {
  const posts = []
  for (let x = fromX; x <= toX; x += spacing) posts.push(x)
  const length = toX - fromX
  return (
    <group>
      {posts.map((x) => <Block key={x} position={[x, 0.6, z]} size={[0.12, 1.2, 0.12]} color="#2a2724" />)}
      {[0.55, 1.0].map((height) => <Block key={height} position={[fromX + length / 2, height, z]} size={[length, 0.025, 0.025]} color="#4a4a4e" />)}
    </group>
  )
}

// The vehicle models point along +x (front wheels at +x, left doors at -z). Heading for travel along a
// direction (dx, dz): rotation.y = atan2(-dz, dx); +z travel is -PI/2, -z travel is +PI/2.
const headingFor = (dx, dz) => Math.atan2(-dz, dx)
const WHEEL_RADIUS = 0.36

function useVehicle(name, { tint, position, rotation = 0 }) {
  const vehicles = useGLTF(`${ASSETS}/vehicles.glb`, false)
  return useMemo(() => {
    const object = cloneNode(vehicles, name, { tint })
    object.position.set(...position)
    object.rotation.y = rotation
    let lamp = null
    let rearDoor = null
    const wheels = []
    object.traverse((child) => {
      if (child.isMesh && child.material.name?.startsWith('police_blue')) {
        child.material.toneMapped = false
        lamp = child.material
      }
      if (child.name === 'police_car_door_rear_left') rearDoor = child
      if (/_wheel_(front|rear)_(left|right)$/.test(child.name)) wheels.push(child)
    })
    // Rolling forward along +x turns each wheel about its axle (z).
    const roll = (distance) => {
      for (const wheel of wheels) wheel.rotation.z = -distance / WHEEL_RADIUS
    }
    return { object, lamp, rearDoor, roll }
    // The spot is fixed per scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, name, tint])
}

function PoliceCar({ position, rotation, seed = 0, light = true }) {
  const car = useVehicle('police_car_generic', { position, rotation })
  useFrame(() => {
    if (car.lamp) car.lamp.emissiveIntensity = 2.5 + 2.5 * Math.sin(clock.shotSeconds * 6 + seed) ** 2
  })
  return (
    <group>
      <primitive object={car.object} />
      {light ? <pointLight position={[position[0], 2.3, position[2]]} color="#3f7fe0" intensity={14} distance={16} decay={1.5} /> : null}
    </group>
  )
}

// Flames, embers and smoke over a base area. `power` scales the light; everything ignites over the first half second.
function Fire({ position, spread, height, size, count, power, seed }) {
  const glow = getGlowTexture()
  const parts = useMemo(() => {
    const random = seededRandom(seed)
    const flames = []
    for (let index = 0; index < count; index++) {
      const material = new THREE.SpriteMaterial({ map: glow, color: '#ffb347', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })
      const sprite = new THREE.Sprite(material)
      flames.push({ sprite, x: (random() - 0.5) * spread[0], z: (random() - 0.5) * spread[1], period: 0.55 + random() * 0.6, phase: random(), reach: 0.55 + random() * 0.6 })
    }
    const smoke = []
    for (let index = 0; index < Math.ceil(count / 3); index++) {
      const material = new THREE.SpriteMaterial({ map: glow, color: '#2b2622', transparent: true, depthWrite: false, opacity: 0 })
      smoke.push({ sprite: new THREE.Sprite(material), x: (random() - 0.5) * spread[0], z: (random() - 0.5) * spread[1], period: 3 + random() * 2, phase: random() })
    }
    const emberCount = count * 3
    const emberPositions = new Float32Array(emberCount * 3)
    const emberSeeds = []
    for (let index = 0; index < emberCount; index++) emberSeeds.push({ x: (random() - 0.5) * spread[0], z: (random() - 0.5) * spread[1], period: 1.5 + random() * 2, phase: random(), drift: random() * 6.28 })
    const emberGeometry = new THREE.BufferGeometry()
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
    const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({ color: '#ffae5a', size: size * 0.035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    return { flames, smoke, embers, emberSeeds }
  }, [glow, spread, count, size, seed])
  const lightRef = useRef()
  const poolRef = useRef()
  const deep = useMemo(() => new THREE.Color('#ff3a0a'), [])
  const bright = useMemo(() => new THREE.Color('#ffd27a'), [])
  useFrame(() => {
    const seconds = clock.shotSeconds
    const ignite = smoothstep(seconds / 0.7)
    for (const flame of parts.flames) {
      const life = (seconds / flame.period + flame.phase) % 1
      const scale = size * (1 - life * 0.7) * (0.75 + 0.25 * Math.sin(seconds * 13 + flame.phase * 20))
      flame.sprite.position.set(flame.x * (1 - life * 0.3), height * flame.reach * life + size * 0.3, flame.z * (1 - life * 0.3))
      flame.sprite.scale.set(scale * 0.8, scale * 1.25, 1)
      flame.sprite.material.color.copy(bright).lerp(deep, life)
      flame.sprite.material.opacity = ignite * (1 - life) ** 0.8
    }
    for (const puff of parts.smoke) {
      const life = (seconds / puff.period + puff.phase) % 1
      const scale = size * (1.2 + life * 3)
      puff.sprite.position.set(puff.x + life * 3, height * 0.8 + life * height * 2.4, puff.z)
      puff.sprite.scale.set(scale, scale, 1)
      puff.sprite.material.opacity = ignite * 0.4 * Math.sin(Math.PI * life)
    }
    const positions = parts.embers.geometry.attributes.position
    parts.emberSeeds.forEach((ember, index) => {
      const life = (seconds / ember.period + ember.phase) % 1
      positions.setXYZ(index, ember.x + Math.sin(ember.drift + seconds) * life * 2, life * height * 2.2, ember.z + Math.cos(ember.drift + seconds) * life * 2)
    })
    positions.needsUpdate = true
    parts.embers.material.opacity = ignite
    const flicker = 0.8 + 0.12 * Math.sin(seconds * 17) + 0.08 * Math.sin(seconds * 41)
    lightRef.current.intensity = power * ignite * flicker
    poolRef.current.material.opacity = 0.75 * ignite * flicker
  })
  return (
    <group position={position}>
      {parts.flames.map((flame, index) => <primitive key={`f${index}`} object={flame.sprite} />)}
      {parts.smoke.map((puff, index) => <primitive key={`s${index}`} object={puff.sprite} />)}
      <primitive object={parts.embers} />
      <pointLight ref={lightRef} position={[0, height * 0.6, 0]} color="#ff7a2a" intensity={0} distance={height * 18} decay={1.4} />
      <mesh ref={poolRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[spread[0] * 3 + 8, spread[1] * 3 + 8]} />
        <meshBasicMaterial color="#ff5a1a" map={glow} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

// ---------- 1906: La Crosse County ----------

function Birth() {
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  return (
    <group>
      <TimeOfDay light="dusk" shadowSize={30} />
      <Ground color="#1d1e21" />
      <GableHouse position={[0, 0, -4]} width={8} depth={6} height={3.2} windows={[[-2.4, 1.7], [2.4, 1.7]]} glow={1.1} />
      <Trees props={props} spots={VIGNETTE_TREE_SPOTS} />
      <Fence fromX={-14} toX={14} z={6} />
      {/* A gate post and rail close to the camera, for parallax as it trucks past. */}
      <Block position={[-0.6, 0.7, 9.4]} size={[0.16, 1.4, 0.16]} color="#2a2724" />
      <Block position={[-2.4, 0.95, 9.4]} size={[3.6, 0.08, 0.06]} color="#2a2724" />
      <pointLight position={[0, 2.6, 0.2]} color="#ffcf8a" intensity={6} distance={12} decay={1.6} />
      <Mannequin who="george" path={[[0, -1.3, 2.1, 0.15]]} />
      <Mannequin who="augusta" scale={0.95} style="cradle" path={[[0, 0, 2.3, 0]]}>
        {/* Edward, a newborn: a small bundle in his own colour. */}
        <mesh position={[0, 1.2, 0.24]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.085, 0.2, 3, 7]} />
          <meshStandardMaterial color={COLORS.ed} emissive={new THREE.Color(COLORS.ed).multiplyScalar(0.2)} flatShading roughness={0.6} />
        </mesh>
      </Mannequin>
      <Mannequin who="henry" scale={0.58} child path={[[0, 1.1, 2.7, -0.2]]} />
    </group>
  )
}

// ---------- the farm near Plainfield ----------

function useFarm() {
  const farm = useGLTF(`${ASSETS}/farm.glb`, false)
  return useMemo(() => {
    const scene = farm.scene.clone(true)
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
    })
    panelDoor(scene.getObjectByName('summer_kitchen_door'))
    frameGlazing(scene)
    scene.updateMatrixWorld(true)
    const houseBox = new THREE.Box3().setFromObject(scene.getObjectByName('farmhouse'))
    return { scene, houseBox, houseCentre: houseBox.getCenter(new THREE.Vector3()) }
  }, [farm])
}

// A lit window on the farmhouse front; a dark pane closes over it at `offAt` (shot seconds) and its light goes out.
function LitWindow({ position, offAt = Infinity }) {
  const cover = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0b0c0e', transparent: true, opacity: 0 }), [])
  const light = useRef()
  useFrame(() => {
    const off = smoothstep((clock.shotSeconds - offAt) / 0.3)
    cover.opacity = off
    if (light.current) light.current.intensity = 5 * (1 - off)
  })
  return (
    <group>
      <FramedWindow position={position} size={[0.8, 1.1]} glow={1.6} />
      <mesh position={[position[0], position[1], position[2] + 0.025]} material={cover}>
        <planeGeometry args={[0.8, 1.1]} />
      </mesh>
      <pointLight ref={light} position={[position[0], position[1], position[2] + 1.2]} color="#ffcf8a" intensity={5} distance={9} decay={1.6} />
    </group>
  )
}

// The farmhouse model has no front door of its own. This one sits on the wing front (local x, where there is no
// porch), cut into the wall with a dim, lamp-lit hall behind it, so a figure walks in and out through a door that opens.
const FARM_DOOR = { localX: 5.4, width: 0.95, height: 2.1, openAngle: 1.25 }

function useFarmDoor(farm, enabled) {
  return useMemo(() => {
    if (!enabled) return null
    const house = farm.scene.getObjectByName('farmhouse')
    farm.scene.updateMatrixWorld(true)
    const sill = house.localToWorld(new THREE.Vector3(FARM_DOOR.localX, 0, 0))
    const doorWood = new THREE.MeshStandardMaterial({ color: DOOR_WOOD, roughness: 0.9 })
    const panelWood = new THREE.MeshStandardMaterial({ color: DOOR_PANEL, roughness: 0.9 })
    const hinge = new THREE.Group()
    hinge.position.set(sill.x - FARM_DOOR.width / 2, sill.y, sill.z + 0.02)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(FARM_DOOR.width, FARM_DOOR.height, 0.06), doorWood)
    leaf.position.set(FARM_DOOR.width / 2, FARM_DOOR.height / 2, -0.03)
    leaf.castShadow = true
    hinge.add(leaf)
    for (const [across, up] of [[0.27, 0.3], [0.73, 0.3], [0.27, 0.7], [0.73, 0.7]]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(FARM_DOOR.width * 0.32, FARM_DOOR.height * 0.3, 0.02), panelWood)
      panel.position.set(FARM_DOOR.width * across, FARM_DOOR.height * up, 0.005)
      hinge.add(panel)
    }
    farm.scene.add(hinge)
    const casing = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.9 })
    for (const [x, y, width, height] of [
      [-FARM_DOOR.width / 2 - 0.07, FARM_DOOR.height / 2, 0.12, FARM_DOOR.height],
      [FARM_DOOR.width / 2 + 0.07, FARM_DOOR.height / 2, 0.12, FARM_DOOR.height],
      [0, FARM_DOOR.height + 0.08, FARM_DOOR.width + 0.34, 0.16],
    ]) {
      const piece = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), casing)
      piece.position.set(sill.x + x, sill.y + y, sill.z + 0.06)
      farm.scene.add(piece)
    }
    const step = new THREE.Mesh(new THREE.BoxGeometry(FARM_DOOR.width + 0.5, 0.16, 0.6), new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 1 }))
    step.position.set(sill.x, sill.y + 0.08, sill.z + 0.32)
    step.receiveShadow = true
    farm.scene.add(step)
    farm.scene.updateMatrixWorld(true)
    const bodyBox = new THREE.Box3().setFromObject(farm.scene.getObjectByName('farmhouse_body'))
    const doorway = cutDoorway(farm.scene, hinge, bodyBox)
    doorway.backWall.emissive.set('#ffcf8a')
    doorway.backWall.emissiveIntensity = 0.22
    return { hinge, doorway, outside: [sill.x, sill.z + 0.7], inside: [sill.x, sill.z - 1.0], clip: { planes: doorway.planes, except: hinge } }
  }, [farm, enabled])
}

// `openings`: [openAt, closeAt] pairs in shot seconds; the leaf swings in over half a second and back.
function FarmDoorMotion({ door, openings }) {
  const lightRef = useRef()
  useFrame(() => {
    const seconds = clock.shotSeconds
    const open = Math.max(0, ...openings.map(([openAt, closeAt]) => smoothstep((seconds - openAt) / 0.5) * (1 - smoothstep((seconds - closeAt) / 0.5))))
    door.hinge.rotation.y = FARM_DOOR.openAngle * open
    if (lightRef.current) lightRef.current.intensity = 6 * open
  })
  return (
    <>
      <LocalClipping />
      <pointLight ref={lightRef} position={[door.outside[0], 1.4, door.outside[1] - 1.2]} color="#ffcf8a" intensity={0} distance={5} decay={1.6} />
    </>
  )
}

// `windows`: lit front windows as [fraction across the house front, height, offAt?]; `litWindow` is the one kitchen window.
// `doorOpenings`: adds the working front door and opens it at those [openAt, closeAt] times.
function FarmGrounds({ light, ground = '#1b1c1f', children, litWindow = false, windows, highlight = true, doorOpenings }) {
  const farm = useFarm()
  const door = useFarmDoor(farm, Boolean(doorOpenings))
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const box = farm.houseBox
  const litWindows = windows ?? (litWindow ? [[0.3, 1.8]] : [])
  return (
    <group>
      <TimeOfDay light={light} shadowSize={70} />
      <Ground color={ground} />
      <primitive object={farm.scene} />
      {door ? <FarmDoorMotion door={door} openings={doorOpenings} /> : null}
      {highlight ? <Highlight target={() => farm.scene.getObjectByName('farmhouse')} color="#ffb35c" strength={1.2} delay={0.8} clip={door?.clip} /> : null}
      <Trees props={props} spots={FARM_TREE_SPOTS} />
      <Fence fromX={-30} toX={36} z={18} spacing={3.5} />
      {litWindows.map(([fraction, height, offAt]) => (
        <LitWindow key={`${fraction}-${height}`} position={[box.min.x + (box.max.x - box.min.x) * fraction, box.min.y + height, box.max.z + 0.03]} offAt={offAt} />
      ))}
      {typeof children === 'function' ? children({ ...farm, door }) : children}
    </group>
  )
}

function FarmArrival() {
  return (
    <FarmGrounds light="day">
      <Mannequin who="george" path={[[0, 10, 12], [3.6, 6, 6.6]]} />
      <Mannequin who="augusta" scale={0.95} path={[[0, 11.3, 12.4], [3.6, 7.2, 7.0]]} />
      <Mannequin who="henry" scale={0.68} child path={[[0, 9.6, 13.6], [3.6, 5.6, 8.0]]} />
      <Mannequin who="ed" scale={0.56} child path={[[0, 10.8, 14.1], [3.6, 6.8, 8.5]]} />
    </FarmGrounds>
  )
}

function SchoolRoad() {
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const spots = useMemo(() => {
    const random = seededRandom(1916)
    return [[-26, -12], [-14, -18], [4, -24], [18, -12], [-30, 14], [-8, 16], [14, 18], [28, 12]].map(([x, z]) => [x, z, Math.floor(random() * 3), random() * 6.28])
  }, [])
  return (
    <group>
      <TimeOfDay light="morning" shadowSize={40} />
      <Ground color="#1e1f22" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 4.4]} />
        <meshStandardMaterial color="#3a3a3c" roughness={1} />
      </mesh>
      <Fence fromX={-60} toX={60} z={-3.6} />
      <Fence fromX={-60} toX={60} z={3.8} />
      <Trees props={props} spots={spots} />
      <GableHouse position={[9, 0, -15]} width={6} depth={9} height={3.4} windows={[[-1.6, 1.8], [1.6, 1.8]]} glow={0.5} />
      <Block position={[9, 6, -11.4]} size={[1.2, 1.6, 1.2]} />
      <Mannequin who="henry" scale={0.74} child path={[[0, -10.5, 0.7], [3.4, -4.6, 0.7]]} />
      <Mannequin who="ed" scale={0.62} child path={[[0, -11.2, -0.5], [3.4, -5.4, -0.5]]} />
    </group>
  )
}

function Farm1940() {
  return (
    <FarmGrounds light="day">
      <Mannequin who="augusta" scale={0.95} path={[[0, 7.6, 4.4, -2.2]]} />
      <Mannequin who="henry" path={[[0, 9.4, 6.4, -2.4]]} />
      <Mannequin who="ed" path={[[0, 10.5, 9.4], [2.8, 8.4, 6.3], [3.4, 8.4, 6.3, -2.3]]} />
    </FarmGrounds>
  )
}

function BrushFire() {
  return (
    <FarmGrounds light="dusk">
      <Fire position={[80, 0, -60]} spread={[26, 6]} height={3.5} size={3.2} count={40} power={420} seed={1944} />
      <Mannequin who="ed" style="watch" path={[[0, 21.6, 9.4, 2.44]]} />
      <Mannequin who="augusta" scale={0.95} style="watch" path={[[0, 20.4, 10.0, 2.44]]} />
    </FarmGrounds>
  )
}

// The kitchen window, then the two windows of Augusta's rooms (upstairs), as fractions across the house front.
const KITCHEN_WINDOW = [0.3, 1.8]
const MOTHER_WINDOWS = [[0.14, 4.4], [0.27, 4.4]]

// 29 Dec 1945: the farmhouse in snow at night, every window lit; nobody outside.
function Winter() {
  return (
    <FarmGrounds light="night" ground="#2a2c30" windows={[KITCHEN_WINDOW, ...MOTHER_WINDOWS]}>
      <Snow box={[-40, 30, -40, 20]} count={2200} top={26} />
    </FarmGrounds>
  )
}

// Logs held against the chest; shown only while `carrying(seconds)` is true.
function CarriedLogs({ carrying }) {
  const group = useRef()
  useFrame(() => { group.current.visible = carrying(clock.shotSeconds) })
  return (
    <group ref={group} position={[0, 1.12, 0.3]}>
      {[[-0.08, 0], [0.08, 0], [0, 0.11]].map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.5, 7]} />
          <meshBasicMaterial color={new THREE.Color(COLORS.ed).multiplyScalar(0.55)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// Before Augusta's death: Ed carries firewood from the pile to the house, opens the door and goes in, comes back
// out empty-handed for more. The door swings open before he reaches it and shuts behind him each way.
const CARING_DOOR_OPENINGS = [[2.2, 3.15], [3.75, 4.75]]

function Caring() {
  return (
    <FarmGrounds light="night" ground="#2a2c30" windows={[KITCHEN_WINDOW, ...MOTHER_WINDOWS]} doorOpenings={CARING_DOOR_OPENINGS}>
      {(farm) => {
        const box = farm.houseBox
        const { outside, inside } = farm.door
        const pile = [box.max.x + 2.4, box.max.z + 3.2]
        const path = [
          [0, pile[0], pile[1]],
          [0.4, pile[0], pile[1]],
          [2.45, outside[0], outside[1]],
          [3.05, inside[0], inside[1]],
          [3.9, inside[0], inside[1]],
          [4.5, outside[0], outside[1]],
          [6.9, pile[0] - 0.6, pile[1]],
        ]
        return (
          <>
            <Snow box={[-40, 30, -40, 20]} count={1800} top={26} />
            <group position={[pile[0] + 0.9, 0, pile[1] - 0.3]}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <mesh key={index} position={[(index % 4) * 0.16 - 0.24, 0.08 + Math.floor(index / 4) * 0.15, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.075, 0.075, 0.9, 7]} />
                  <meshStandardMaterial color="#3a2e24" roughness={1} />
                </mesh>
              ))}
            </group>
            <Mannequin who="ed" style="cradle" path={path} hidden={[[3.05, 3.9]]}>
              <CarriedLogs carrying={(seconds) => seconds < 3.05} />
            </Mannequin>
          </>
        )
      }}
    </FarmGrounds>
  )
}

// After 1945: the windows of Augusta's rooms go dark for good; the kitchen window stays lit.
function SealedRooms() {
  return (
    <FarmGrounds light="night" ground="#2a2c30" windows={[KITCHEN_WINDOW, [...MOTHER_WINDOWS[0], 1.3], [...MOTHER_WINDOWS[1], 1.9]]}>
      <Snow box={[-40, 30, -40, 20]} count={900} top={26} />
    </FarmGrounds>
  )
}

// A bare winter tree: trunk and a few angled limbs.
function BareTree({ position, height = 6, seed = 1 }) {
  const limbs = useMemo(() => {
    const random = seededRandom(seed)
    return Array.from({ length: 7 }, (_, index) => ({
      y: height * (0.45 + 0.07 * index),
      length: height * (0.35 - 0.03 * index),
      turn: random() * Math.PI * 2,
      tilt: 0.55 + random() * 0.4,
    }))
  }, [height, seed])
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.2, height, 7]} />
        <meshStandardMaterial color="#1d1b1a" roughness={1} />
      </mesh>
      {limbs.map((limb, index) => (
        <group key={index} position={[0, limb.y, 0]} rotation={[0, limb.turn, limb.tilt]}>
          <mesh position={[0, limb.length / 2, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.06, limb.length, 5]} />
            <meshStandardMaterial color="#1d1b1a" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// A plain 1930s hearse, built from blocks: long body, tall closed rear, round fenders and wheels.
function Hearse({ position, rotation = 0 }) {
  const paint = '#141416'
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block position={[0, 0.75, 0]} size={[5.2, 0.7, 1.75]} color={paint} />
      <Block position={[-0.7, 1.55, 0]} size={[3.4, 0.95, 1.6]} color={paint} />
      <Block position={[2.0, 1.0, 0]} size={[1.4, 0.35, 1.2]} color={paint} />
      <Block position={[0.95, 1.55, 0]} size={[0.06, 0.7, 1.4]} color="#2b3038" />
      {[[-1.7, 0.86], [-1.7, -0.86], [1.7, 0.86], [1.7, -0.86]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.38, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.22, 16]} />
          <meshStandardMaterial color="#0c0c0d" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// Plainfield Cemetery: the Gein headstones, older stones around, bare trees and the gate.
// stones: [{ text, x }]; mourners: [{ who, x, z }] facing the stones.
const OLD_STONES = [[-6, -3.5], [-4.2, -4.2], [-2.4, -3.8], [3.4, -3.9], [5.4, -4.4], [-6.8, 0.2], [6.6, -0.6], [4.6, 2.4], [-5.4, 3.1], [-1.4, -7.4], [2.2, -7.8], [-4.6, -8.2]]
function Burial({ stones, mourners = [], light = 'day', snow = false, mound, hearse = true }) {
  const stoneColor = '#6a6c70'
  return (
    <group>
      <TimeOfDay light={light} shadowSize={40} />
      <Ground color={snow ? '#3a3d42' : '#1c1e1d'} />
      {snow ? <Snow box={[-30, 30, -30, 20]} count={1200} top={18} /> : null}
      {stones.map(({ text, x }) => (
        <group key={text} position={[x, 0, 0]}>
          <Block position={[0, 0.06, 0]} size={[0.95, 0.12, 0.4]} color="#45474b" />
          <Block position={[0, 0.5, 0]} size={[0.75, 0.8, 0.16]} color={stoneColor} />
          <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.375, 0.375, 0.16, 24, 1, false, Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={stoneColor} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.68, 0.085]}>
            <planeGeometry args={[0.7, 0.46]} />
            <meshStandardMaterial map={boardTexture(text, { background: stoneColor, color: '#18191c', width: 512, height: 336, font: 62 })} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {mound !== undefined ? <Block position={[mound, 0.07, 1.25]} size={[0.9, 0.14, 1.9]} color={snow ? '#4a4c50' : '#2a2420'} /> : null}
      {OLD_STONES.map(([x, z], index) => <Block key={index} position={[x, 0.32 + (index % 3) * 0.08, z]} size={[0.6, 0.64 + (index % 3) * 0.16, 0.14]} color="#45474b" />)}
      {[[-8, -6, 7, 3], [-3, -11, 8, 5], [4, -10, 7.5, 7], [9, -5, 6.5, 11], [10, 4, 6, 13]].map(([x, z, height, seed]) => <BareTree key={seed} position={[x, 0, z]} height={height} seed={seed} />)}
      {/* The gate: two stone posts and an iron arch, with the fence running off both ways. */}
      <Block position={[-9.5, 1.1, -10]} size={[0.5, 2.2, 0.5]} color="#4a4c50" />
      <Block position={[-6.5, 1.1, -10]} size={[0.5, 2.2, 0.5]} color="#4a4c50" />
      <mesh position={[-8, 2.2, -10]}>
        <torusGeometry args={[1.5, 0.04, 6, 24, Math.PI]} />
        <meshStandardMaterial color="#1a1a1c" metalness={0.6} roughness={0.5} />
      </mesh>
      <Fence fromX={-40} toX={-10} z={-10} />
      <Fence fromX={-6} toX={30} z={-10} />
      {hearse ? <Hearse position={[-4.5, 0, -13.5]} /> : null}
      {mourners.map(({ who, x, z, scale }) => <Mannequin key={`${who}${x}`} who={who} scale={scale ?? 1} style="mourn" path={[[0, x, z, 0]]} />)}
    </group>
  )
}

const STONE_GEORGE = { text: 'GEORGE P. GEIN\n1873-1940', x: -1.0 }
const STONE_HENRY = { text: 'HENRY GEIN\n1944', x: 1.9 }
const STONE_AUGUSTA = { text: 'AUGUSTA GEIN\n1945', x: 0.6 }

function BurialGeorge() {
  const mourners = [
    { who: 'augusta', x: -1.0, z: -1.5, scale: 0.95 }, { who: 'ed', x: -1.8, z: -1.6 }, { who: 'henry', x: -0.2, z: -1.6 },
    { who: 'town', x: -3.0, z: -2.3 }, { who: 'town', x: 0.9, z: -2.4 }, { who: 'town', x: -3.8, z: -1.8 },
  ]
  return <Burial light="day" stones={[STONE_GEORGE]} mound={-1.0} mourners={mourners} />
}

function BurialHenry() {
  return <Burial light="day" stones={[STONE_GEORGE, STONE_HENRY]} mound={1.9} hearse={false} />
}

function BurialAugusta() {
  const mourners = [{ who: 'ed', x: 0.6, z: -1.6 }, { who: 'town', x: -0.8, z: -2.3 }, { who: 'town', x: 2.0, z: -2.4 }]
  return <Burial light="day" snow stones={[STONE_GEORGE, STONE_AUGUSTA, STONE_HENRY]} mound={0.6} mourners={mourners} />
}

// Drifting smoke: soft grey sprites rising slowly and leaning with the wind, wrapping back to the ground.
function Smoke({ area, count = 40, seed = 7 }) {
  const glow = getGlowTexture()
  const puffs = useMemo(() => {
    const random = seededRandom(seed)
    return Array.from({ length: count }, () => ({ x: area[0] + random() * (area[1] - area[0]), z: area[2] + random() * (area[3] - area[2]), phase: random(), size: 3 + random() * 3 }))
  }, [area, count, seed])
  const material = useMemo(() => new THREE.SpriteMaterial({ map: glow, color: '#9a9692', transparent: true, opacity: 0.035, depthWrite: false }), [glow])
  const sprites = useRef([])
  useFrame(() => {
    puffs.forEach((puff, index) => {
      const sprite = sprites.current[index]
      const age = (puff.phase + clock.shotSeconds * 0.06) % 1
      sprite.position.set(puff.x + age * 5, 0.3 + age * 2.2, puff.z - age * 1.5)
      sprite.scale.setScalar(puff.size * (0.6 + age))
    })
  })
  return puffs.map((puff, index) => <sprite key={index} ref={(sprite) => { sprites.current[index] = sprite }} material={material} />)
}

// 16 May 1944, after dark: the burnt marsh, a few embers, smoke drifting. No figure.
function MarshNight() {
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const field = useMemo(() => {
    const random = seededRandom(1944)
    const stubs = Array.from({ length: 420 }, () => [-30 + random() * 60, -26 + random() * 32, 0.2 + random() * 0.7])
    const embers = Array.from({ length: 60 }, () => [-22 + random() * 44, -20 + random() * 24, random()])
    return { stubs, embers }
  }, [])
  const emberMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a2a').multiplyScalar(1.4), toneMapped: false }), [])
  useFrame(() => { emberMaterial.color.setStyle('#ff6a2a').multiplyScalar(1.1 + 0.4 * Math.sin(clock.shotSeconds * 3.1) ** 2) })
  return (
    <group>
      <TimeOfDay light="night" shadowSize={40} />
      <hemisphereLight args={['#4a5a7a', '#0a0a0c', 0.5]} />
      <Ground color="#23262b" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8]}>
        <circleGeometry args={[28, 40]} />
        <meshStandardMaterial color="#0b0a0a" roughness={1} />
      </mesh>
      {field.stubs.map(([x, z, height], index) => (
        <mesh key={index} position={[x, height / 2, z]}>
            <cylinderGeometry args={[0.02, 0.035, height, 4]} />
          <meshStandardMaterial color="#2c2724" roughness={1} />
        </mesh>
      ))}
      {field.embers.map(([x, z], index) => (
        <mesh key={index} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]} material={emberMaterial}>
          <circleGeometry args={[0.09, 6]} />
        </mesh>
      ))}
      <pointLight position={[2, 0.6, -6]} color="#ff6a2a" intensity={3} distance={14} decay={1.5} />
      <Smoke area={[-24, 18, -22, -2]} count={110} />
      <Trees props={props} spots={[[-40, -46, 0, 1], [-20, -52, 1, 2], [0, -50, 2, 3], [22, -48, 0, 4], [42, -44, 1, 5]]} />
    </group>
  )
}

// 1945-1954: odd jobs in Plainfield. Ed shovels the walk of a house; townspeople pass on the street.
function OddJobs() {
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const shovel = useRef()
  useFrame(() => {
    const lift = (1 - Math.cos(clock.shotSeconds * 2.4)) / 2
    shovel.current.position.y = 0.05 + 0.3 * lift
  })
  return (
    <group>
      <TimeOfDay light="morning" shadowSize={40} />
      <Ground color="#4a4d53" />
      <Snow box={[-20, 20, -15, 15]} count={700} top={14} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 5.6]} receiveShadow>
        <planeGeometry args={[120, 3.2]} />
        <meshStandardMaterial color="#3a3c40" roughness={1} />
      </mesh>
      <GableHouse position={[0, 0, -4]} width={7} depth={6} height={3.2} windows={[[-2.0, 1.7], [2.0, 1.7]]} glow={0.4} />
      <GableHouse position={[11, 0, -5]} width={6} depth={6} height={3.0} windows={[[-1.6, 1.7], [1.6, 1.7]]} glow={0.4} />
      <GableHouse position={[-11, 0, -5]} width={6} depth={6} height={3.0} windows={[[-1.6, 1.7], [1.6, 1.7]]} glow={0.4} />
      {/* The cleared walk and the snow banks either side. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.7]} receiveShadow>
        <planeGeometry args={[1.2, 3.6]} />
        <meshStandardMaterial color="#2c2e32" roughness={1} />
      </mesh>
      <Block position={[-0.9, 0.12, 2.2]} size={[0.5, 0.24, 2.6]} color="#7d8088" />
      <Block position={[0.9, 0.12, 2.2]} size={[0.5, 0.24, 2.6]} color="#7d8088" />
      <BareTree position={[-5.5, 0, 2.5]} height={6.5} seed={21} />
      <BareTree position={[6, 0, 2.2]} height={6} seed={22} />
      <Trees props={props} spots={[[-20, -14, 0, 1], [18, -16, 1, 2]]} />
      <Mannequin who="ed" style="shovel" path={[[0, 0, 2.6, Math.PI / 2]]}>
        <group ref={shovel} position={[0, 0.05, 0.75]}>
          <mesh position={[0, 0.5, -0.28]} rotation={[-0.55, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.3, 6]} />
            <meshBasicMaterial color={new THREE.Color(COLORS.ed).multiplyScalar(0.5)} toneMapped={false} />
          </mesh>
          <Block position={[0, 0.02, 0]} size={[0.4, 0.04, 0.34]} color="#55585e" />
        </group>
      </Mannequin>
      <Mannequin who="town" path={[[0, -11, 4.8], [7.6, 0.5, 4.8]]} />
      <Mannequin who="town" path={[[0, 8, 6.2], [7.6, -4, 6.2]]} />
      <Mannequin who="town" scale={0.95} path={[[0, 10.5, 5.6], [7.6, -1, 5.6]]} />
    </group>
  )
}

// ---------- open doorways ----------
// A door that swings open must show a room behind it, not the wall, glass or window quad the model keeps there.
// cutDoorway clips a box the size of the closed leaf, running from the leaf's outer face into the building, out of
// every mesh except the door itself, and fills it with a shallow dark vestibule: floor, ceiling, side walls and a
// dim back wall. Nothing else of the interior is shown.
const VESTIBULE_DEPTH = 1.6
const vestibuleDark = new THREE.MeshStandardMaterial({ color: '#0b0a0a', roughness: 1, metalness: 0 })
const vestibuleFloor = new THREE.MeshStandardMaterial({ color: '#1a1716', roughness: 0.95, metalness: 0 })
const hiddenFace = new THREE.MeshBasicMaterial({ visible: false })

function isInside(object, ancestor) {
  for (let node = object; node; node = node.parent) if (node === ancestor) return true
  return false
}

// buildingBox: the building's body, to tell inside from outside. Returns { planes, vestibule, backWall }.
function cutDoorway(scene, door, buildingBox) {
  scene.updateMatrixWorld(true)
  const doorBox = new THREE.Box3().setFromObject(door)
  const size = doorBox.getSize(new THREE.Vector3())
  const centre = doorBox.getCenter(new THREE.Vector3())
  const axis = size.x < size.z ? 'x' : 'z'
  const inward = Math.sign(buildingBox.getCenter(new THREE.Vector3())[axis] - centre[axis]) || 1
  const outerFace = inward > 0 ? doorBox.min[axis] : doorBox.max[axis]
  const innerFace = inward > 0 ? doorBox.max[axis] : doorBox.min[axis]
  const cut = doorBox.clone()
  cut.min.y += 0.01
  if (inward > 0) {
    cut.min[axis] = outerFace - 0.05
    cut.max[axis] = innerFace + VESTIBULE_DEPTH
  } else {
    cut.max[axis] = outerFace + 0.05
    cut.min[axis] = innerFace - VESTIBULE_DEPTH
  }
  // Six planes facing out of the box: with clipIntersection, only what lies inside all six is cut away.
  const planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), cut.min.x),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -cut.max.x),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), cut.min.y),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -cut.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), cut.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -cut.max.z),
  ]
  // Clipping is spatial, so a material shared with far-away meshes can be clipped in place; only one the door
  // itself uses is copied, so the leaf stays whole as it swings through the box.
  const doorMaterials = new Set()
  door.traverse((object) => {
    if (object.isMesh) doorMaterials.add(object.material)
  })
  scene.traverse((object) => {
    if (!object.isMesh || isInside(object, door) || object.name === 'doorway_vestibule') return
    const box = new THREE.Box3().setFromObject(object)
    if (!box.intersectsBox(cut)) return
    if (doorMaterials.has(object.material)) object.material = object.material.clone()
    object.material.clippingPlanes = planes
    object.material.clipIntersection = true
  })
  // The vestibule: an inside-out box behind the leaf, open on the street side.
  const depth = VESTIBULE_DEPTH
  const width = axis === 'x' ? size.z : size.x
  const height = size.y
  const backWall = new THREE.MeshStandardMaterial({ color: '#0d0b0b', roughness: 1, metalness: 0, emissive: '#ff2a2f', emissiveIntensity: 0 })
  const geometry = axis === 'x' ? new THREE.BoxGeometry(depth, height, width) : new THREE.BoxGeometry(width, height, depth)
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z.
  const faces = [vestibuleDark, vestibuleDark, vestibuleDark, vestibuleFloor, vestibuleDark, vestibuleDark]
  const axisFaces = axis === 'x' ? [0, 1] : [4, 5]
  const [positiveFace, negativeFace] = axisFaces
  faces[inward > 0 ? negativeFace : positiveFace] = hiddenFace
  faces[inward > 0 ? positiveFace : negativeFace] = backWall
  for (const material of faces) material.side = THREE.BackSide
  const vestibule = new THREE.Mesh(geometry, faces)
  vestibule.receiveShadow = true
  vestibule.position.copy(centre)
  vestibule.position.y = doorBox.min.y + height / 2
  vestibule.position[axis] = innerFace + (inward * depth) / 2 - inward * 0.005
  vestibule.name = 'doorway_vestibule'
  scene.add(vestibule)
  return { planes, vestibule, backWall }
}

// Clipping planes only work once the renderer allows them.
function LocalClipping() {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  return null
}

// ---------- 8 Dec 1954: the tavern in the Town of Pine Grove (generic building; no figures) ----------
// A rural roadside tavern near Bancroft. The lot is unknown, so the setting is generic: a two-lane country road with
// gravel shoulders and a crossroad, a gravel lot, utility poles, a mailbox, a plain TAVERN board, a beer sign in the
// window, bare trees with a windbreak behind, and one distant farm. Frost-grey ground, no snow.

// A painted board or a small neon sign, drawn once into a canvas.
const boardTextures = new Map()
function boardTexture(text, { background, color, glow = 0, width = 512, height = 160, font = 92 }) {
  const key = `${text}|${background}|${color}|${glow}|${width}|${height}|${font}`
  if (boardTextures.has(key)) return boardTextures.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = background
  context.fillRect(0, 0, width, height)
  context.font = `600 ${font}px 'Bahnschrift', 'Segoe UI', sans-serif`
  context.letterSpacing = '0.12em'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = color
  context.shadowBlur = glow
  context.fillStyle = color
  // One or more lines ('\n'), centred as a block.
  const lines = text.split('\n')
  const lineHeight = font * 1.2
  lines.forEach((line, index) => context.fillText(line, width / 2, height / 2 + 4 + (index - (lines.length - 1) / 2) * lineHeight))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  boardTextures.set(key, texture)
  return texture
}

// Wires between two pole tops, sagging in the middle.
function sagLine(from, to, sag = 0.6, steps = 16) {
  const points = []
  for (let index = 0; index <= steps; index++) {
    const along = index / steps
    points.push(new THREE.Vector3(
      from[0] + (to[0] - from[0]) * along,
      from[1] + (to[1] - from[1]) * along - sag * 4 * along * (1 - along),
      from[2] + (to[2] - from[2]) * along,
    ))
  }
  return points
}

const ROAD_Z = 13.5
const POLE_Z = ROAD_Z + 6
const POLE_XS = [-105, -70, -35, 0, 35, 70, 105]
const CROSSROAD_X = -34

function CountryRoad() {
  const wires = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color: '#4c4f55' })
    const group = new THREE.Group()
    for (let index = 0; index + 1 < POLE_XS.length; index++) {
      for (const offset of [-0.7, 0.7]) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(sagLine([POLE_XS[index], 7.6, POLE_Z + offset], [POLE_XS[index + 1], 7.6, POLE_Z + offset])), material)
        group.add(line)
      }
    }
    return group
  }, [])
  const dashes = []
  for (let x = -118; x < 118; x += 9) dashes.push(x)
  return (
    <group>
      {/* Asphalt, two 3.5 m lanes, with gravel shoulders. */}
      <Block position={[0, 0.01, ROAD_Z]} size={[240, 0.02, 7]} color="#202226" castShadow={false} />
      <Block position={[0, 0.005, ROAD_Z - 4.2]} size={[240, 0.01, 1.4]} color="#4f4d47" castShadow={false} />
      <Block position={[0, 0.005, ROAD_Z + 4.2]} size={[240, 0.01, 1.4]} color="#4f4d47" castShadow={false} />
      {dashes.map((x) => <Block key={x} position={[x, 0.025, ROAD_Z]} size={[3, 0.01, 0.14]} color="#a39c80" castShadow={false} />)}
      {/* The crossroad running north. */}
      <Block position={[CROSSROAD_X, 0.012, ROAD_Z - 68]} size={[6.5, 0.02, 130]} color="#25272b" castShadow={false} />
      {/* Utility poles with a crossarm, and the wires between them. */}
      {POLE_XS.map((x) => (
        <group key={x} position={[x, 0, POLE_Z]}>
          <mesh position={[0, 4, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.16, 8, 8]} />
            <meshStandardMaterial color="#2a2621" roughness={1} />
          </mesh>
          <Block position={[0, 7.6, 0]} size={[0.14, 0.14, 1.8]} color="#2a2621" />
        </group>
      ))}
      <primitive object={wires} />
    </group>
  )
}

function TavernLot({ front, doorX }) {
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const sedan = useVehicle('ford49_sedan', { tint: '#3a3b3f', position: [6.2, 0, 4.6], rotation: headingFor(0.3, -1) })
  const pickup = useVehicle('pickup_generic', { tint: '#45423c', position: [-6.4, 0, 6.2], rotation: headingFor(0.25, -1) })
  const windbreak = useMemo(() => {
    const random = seededRandom(1207)
    const spots = []
    for (let x = -34; x <= 34; x += 4.2) spots.push([x + (random() - 0.5) * 1.5, -24 + (random() - 0.5) * 2, Math.floor(random() * 3), random() * Math.PI * 2])
    return spots
  }, [])
  return (
    <group>
      {/* Gravel lot between the porch and the road. */}
      <Block position={[0, 0.004, front + 4.8]} size={[20, 0.01, 7.4]} color="#45423d" castShadow={false} />
      <primitive object={sedan.object} />
      <primitive object={pickup.object} />
      {/* A plain TAVERN board on two posts by the road; no business name is known. */}
      <group position={[-5.4, 0, ROAD_Z - 5.2]} rotation={[0, 0.3, 0]}>
        <Block position={[-1.15, 1.3, 0]} size={[0.12, 2.6, 0.12]} color="#2a2621" />
        <Block position={[1.15, 1.3, 0]} size={[0.12, 2.6, 0.12]} color="#2a2621" />
        <mesh position={[0, 2.25, 0.07]}>
          <planeGeometry args={[2.6, 0.82]} />
          <meshStandardMaterial map={boardTexture('TAVERN', { background: '#d9d3c4', color: '#2a2622' })} emissive="#ffffff" emissiveMap={boardTexture('TAVERN', { background: '#d9d3c4', color: '#2a2622' })} emissiveIntensity={0.12} roughness={0.9} />
        </mesh>
      </group>
      {/* A mailbox on a post at the lot's edge. */}
      <group position={[7.2, 0, ROAD_Z - 4.6]}>
        <Block position={[0, 0.55, 0]} size={[0.1, 1.1, 0.1]} color="#2a2621" />
        <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.5, 12, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#55575c" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <Block position={[0, 1.1, 0]} size={[0.26, 0.02, 0.5]} color="#55575c" />
      </group>
      {/* A small beer sign glowing in the front window. */}
      <mesh position={[1.0, 1.95, 0.16]}>
        <planeGeometry args={[0.8, 0.3]} />
        <meshBasicMaterial map={boardTexture('BEER', { background: '#120808', color: '#ffb35c', glow: 18, width: 256, height: 96, font: 64 })} toneMapped={false} />
      </mesh>
      <Trees props={props} spots={windbreak} />
      {/* One distant farm on the horizon with a lit window. */}
      <group position={[-72, 0, -150]}>
        <Block position={[0, 3, 0]} size={[8, 6, 7]} color="#1a1b1f" />
        <Block position={[11, 4, -2]} size={[9, 8, 10]} color="#17181b" />
        <Glow position={[-1.5, 2.6, 3.52]} size={[1, 1.2]} color="#ffcf8a" intensity={1.6} />
      </group>
    </group>
  )
}

// ---------- the tavern found empty: inside, nobody there ----------
// A dim, empty 1950s rural tavern seen through its open door. The evidence stays abstract, as in the store: a red
// light pool on the floor (not blood), a small evidence marker for the spent shell casing, a dotted red line to the
// door for the trail. No figure, no weapon.
const ROOM = { width: 8, depth: 10, height: 3.1 }
const DOOR_X = -0.9
const DOOR_WIDTH = 0.95
const POOL = [0.7, -6.2]
const MARKER = [1.2, -7.4]
// Pendant lamps [x, z, intensity]: two over the bar, one over the tables.
const PENDANTS = [[2.1, -3.9, 7], [2.1, -6.6, 7], [-2.0, -4.6, 4.5]]

// ---------- the tavern's furnishings (generic 1954 rural Wisconsin tavern, no brands) ----------

// Canvas-painted surface textures, made once and repeated.
const paintedTextures = new Map()
function paintedTexture(key, width, height, paint) {
  if (!paintedTextures.has(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    paint(canvas.getContext('2d'), width, height, seededRandom(key.length * 97 + 13))
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 4
    paintedTextures.set(key, texture)
  }
  return paintedTextures.get(key)
}

function repeated(texture, repeatX, repeatY) {
  const copy = texture.clone()
  copy.repeat.set(repeatX, repeatY)
  copy.needsUpdate = true
  return copy
}

// Knotty pine: eight vertical boards per tile, honey tones, dark grooves, grain and knots.
function paintKnottyPine(context, width, height, random) {
  const boardWidth = width / 8
  for (let board = 0; board < 8; board++) {
    const shade = 0.85 + random() * 0.3
    context.fillStyle = `rgb(${Math.round(120 * shade)}, ${Math.round(78 * shade)}, ${Math.round(42 * shade)})`
    context.fillRect(board * boardWidth, 0, boardWidth, height)
    context.strokeStyle = 'rgba(60, 34, 16, 0.35)'
    context.lineWidth = 1
    for (let line = 0; line < 6; line++) {
      const x = board * boardWidth + 4 + random() * (boardWidth - 8)
      context.beginPath()
      context.moveTo(x, 0)
      for (let y = 0; y <= height; y += 32) context.lineTo(x + Math.sin(y * 0.02 + line) * 2, y)
      context.stroke()
    }
    for (let knot = 0; knot < 2; knot++) {
      const x = board * boardWidth + boardWidth * (0.3 + random() * 0.4)
      const y = random() * height
      context.fillStyle = 'rgba(52, 28, 12, 0.85)'
      context.beginPath()
      context.ellipse(x, y, 3 + random() * 4, 5 + random() * 6, 0, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = 'rgba(70, 40, 18, 0.5)'
      context.beginPath()
      context.ellipse(x, y, 8, 12, 0, 0, Math.PI * 2)
      context.stroke()
    }
    context.fillStyle = 'rgba(28, 16, 8, 0.9)'
    context.fillRect(board * boardWidth, 0, 2, height)
  }
}

// Worn floor planks running front to back.
function paintPlanks(context, width, height, random) {
  const plankWidth = width / 6
  for (let plank = 0; plank < 6; plank++) {
    const shade = 0.8 + random() * 0.35
    context.fillStyle = `rgb(${Math.round(70 * shade)}, ${Math.round(52 * shade)}, ${Math.round(38 * shade)})`
    context.fillRect(plank * plankWidth, 0, plankWidth, height)
    context.fillStyle = 'rgba(15, 10, 6, 0.9)'
    context.fillRect(plank * plankWidth, 0, 2, height)
    context.fillRect(plank * plankWidth, random() * height, plankWidth, 2)
    context.strokeStyle = 'rgba(30, 20, 12, 0.3)'
    for (let line = 0; line < 4; line++) {
      const x = plank * plankWidth + random() * plankWidth
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x + 2, height)
      context.stroke()
    }
  }
}

// A wall calendar for December 1954 (the month starts on a Wednesday).
function paintCalendar(context, width, height) {
  context.fillStyle = '#c9c1ad'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#5a2a22'
  context.fillRect(0, 0, width, height * 0.38)
  context.fillStyle = '#e9e2d0'
  context.font = `700 ${Math.round(width * 0.13)}px 'Bahnschrift', 'Segoe UI', sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('DECEMBER', width / 2, height * 0.15)
  context.fillText('1954', width / 2, height * 0.29)
  context.fillStyle = '#2a2622'
  context.font = `600 ${Math.round(width * 0.065)}px 'Bahnschrift', 'Segoe UI', sans-serif`
  const cellWidth = width / 7
  const cellHeight = (height * 0.58) / 5
  for (let day = 1; day <= 31; day++) {
    const slot = day + 2
    const column = slot % 7
    const row = Math.floor(slot / 7)
    context.fillText(String(day), cellWidth * (column + 0.5), height * 0.42 + cellHeight * (row + 0.5))
  }
}

// Frost creeping in from the edges of a night window pane.
function paintFrost(context, width, height, random) {
  context.clearRect(0, 0, width, height)
  for (let speck = 0; speck < 900; speck++) {
    const edge = random()
    const x = random() * width
    const y = random() * height
    const fromEdge = Math.min(x, width - x, y, height - y) / (Math.min(width, height) / 2)
    if (edge < fromEdge * 1.4) continue
    context.fillStyle = `rgba(210, 225, 240, ${0.08 + random() * 0.25})`
    context.beginPath()
    context.arc(x, y, 1 + random() * 3, 0, Math.PI * 2)
    context.fill()
  }
}

// Bottles on the back bar: several shapes and glass colours, deterministic.
const BOTTLE_GLASS = ['#7a4a16', '#2f5a2a', '#9aa3a0', '#4a2a14', '#6a1a1a', '#24364f', '#a07a2a', '#3a4a2a']
function useBottles(half) {
  return useMemo(() => {
    const random = seededRandom(1954)
    const bottles = []
    for (const [y, count] of [[1.5, 30], [1.92, 30], [1.02, 18]]) {
      for (let index = 0; index < count; index++) {
        const z = -7.75 + (index / count) * 5.1 + random() * 0.04
        const shape = ['tall', 'squat', 'square', 'neck'][Math.floor(random() * 4)]
        bottles.push({ x: half - 0.28 + (y < 1.2 ? 0.05 : 0) + (random() - 0.5) * 0.08, y, z, shape, color: BOTTLE_GLASS[Math.floor(random() * BOTTLE_GLASS.length)] })
      }
    }
    return bottles
  }, [half])
}

function Bottle({ x, y, z, shape, color }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.15, emissive: new THREE.Color(color).multiplyScalar(0.35) }), [color])
  const body = { tall: [0.038, 0.24], squat: [0.055, 0.15], square: [0.045, 0.2], neck: [0.032, 0.16] }[shape]
  const [radius, height] = body
  return (
    <group position={[x, y, z]}>
      {shape === 'square'
        ? <mesh position={[0, height / 2, 0]} material={material}><boxGeometry args={[radius * 2, height, radius * 2]} /></mesh>
        : <mesh position={[0, height / 2, 0]} material={material}><cylinderGeometry args={[radius, radius, height, 10]} /></mesh>}
      <mesh position={[0, height + 0.05, 0]} material={material}>
        <cylinderGeometry args={[0.012, radius * 0.6, 0.1, 8]} />
      </mesh>
    </group>
  )
}

function Glass({ position }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.035, 0.03, 0.1, 10]} />
      <meshStandardMaterial color="#cfd6d8" transparent opacity={0.4} roughness={0.05} metalness={0.2} emissive="#3a3a36" />
    </mesh>
  )
}

function Ashtray({ position }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.07, 0.06, 0.03, 12]} />
      <meshStandardMaterial color="#2a2c2e" metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

// Dust motes drifting in the lamp light.
function DustMotes({ centres }) {
  const points = useMemo(() => {
    const random = seededRandom(8)
    const positions = new Float32Array(centres.length * 70 * 3)
    const seeds = []
    centres.forEach(([x, z], centreIndex) => {
      for (let index = 0; index < 70; index++) {
        seeds.push({ x: x + (random() - 0.5) * 0.9, y: 0.9 + random() * 1.6, z: z + (random() - 0.5) * 0.9, phase: random() * 6.28 })
        positions[(centreIndex * 70 + index) * 3] = 0
      }
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({ color: '#ffd9a0', size: 0.012, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    return { object: new THREE.Points(geometry, material), seeds }
  }, [centres])
  useFrame(() => {
    const seconds = clock.shotSeconds
    const attribute = points.object.geometry.attributes.position
    points.seeds.forEach((seed, index) => {
      attribute.setXYZ(index, seed.x + Math.sin(seconds * 0.3 + seed.phase) * 0.08, seed.y + Math.sin(seconds * 0.2 + seed.phase * 2) * 0.1 - seconds * 0.01, seed.z + Math.cos(seconds * 0.25 + seed.phase) * 0.08)
    })
    attribute.needsUpdate = true
  })
  return <primitive object={points.object} />
}

// The furnished room around the evidence: panelling, floor, bar and back bar, games, stove, jukebox and the small
// things a 1954 country tavern holds, with a little life (neon buzz, embers, a swaying lamp, the jukebox light).
const POOL_TABLE = [-1.3, -8.2]
function TavernFurnishings({ half }) {
  const pine = paintedTexture('knotty-pine', 512, 512, paintKnottyPine)
  const planks = paintedTexture('floor-planks', 512, 512, paintPlanks)
  const calendar = paintedTexture('calendar-dec-1954', 256, 360, paintCalendar)
  const frost = paintedTexture('window-frost', 256, 256, paintFrost)
  const walls = useMemo(() => ({
    side: new THREE.MeshStandardMaterial({ map: repeated(pine, ROOM.depth, 1), roughness: 0.75 }),
    back: new THREE.MeshStandardMaterial({ map: repeated(pine, ROOM.width, 1), roughness: 0.75 }),
    floor: new THREE.MeshStandardMaterial({ map: repeated(planks, 4, 5), roughness: 0.85 }),
  }), [pine, planks])
  const bottles = useBottles(half)
  const neon = useMemo(() => new THREE.MeshBasicMaterial({ map: boardTexture('BEER', { background: '#120808', color: '#ff5a4a', glow: 18, width: 256, height: 96, font: 64 }), toneMapped: false }), [])
  const onTap = useMemo(() => new THREE.MeshBasicMaterial({ map: boardTexture('ON TAP', { background: '#0d0b08', color: '#ffc27a', glow: 10, width: 256, height: 96, font: 52 }), toneMapped: false }), [])
  const jukeboxFront = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false }), [])
  const embers = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff7a2a', toneMapped: false }), [])
  const stoveLight = useRef()
  const poolLamp = useRef()
  useFrame(() => {
    const seconds = clock.shotSeconds
    // Neon buzz: steady with a quick dip now and then.
    const dip = Math.sin(seconds * 23.0) > 0.97 || (seconds % 2.7) < 0.06 ? 0.55 : 1
    neon.color.setScalar(dip * (0.95 + 0.05 * Math.sin(seconds * 120)))
    onTap.color.setScalar(0.9 + 0.1 * Math.sin(seconds * 2.1))
    jukeboxFront.color.setStyle('#ffb35c').multiplyScalar(0.9 + 0.35 * (0.5 + 0.5 * Math.sin(seconds * 2.6)))
    const flicker = 0.75 + 0.25 * Math.sin(seconds * 7.3) * Math.sin(seconds * 3.1 + 1)
    embers.color.setStyle('#ff7a2a').multiplyScalar(1.2 + 0.6 * flicker)
    if (stoveLight.current) stoveLight.current.intensity = 1.6 + 0.8 * flicker
    if (poolLamp.current) poolLamp.current.rotation.z = 0.035 * Math.sin(seconds * 1.4)
  })
  return (
    <group>
      {/* Knotty pine on the three walls in view, a dark chair rail, plank floor. */}
      <mesh position={[-half + 0.001, ROOM.height / 2, -ROOM.depth / 2]} rotation={[0, Math.PI / 2, 0]} material={walls.side} receiveShadow>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
      </mesh>
      <mesh position={[half - 0.001, ROOM.height / 2, -ROOM.depth / 2]} rotation={[0, -Math.PI / 2, 0]} material={walls.side} receiveShadow>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
      </mesh>
      <mesh position={[0, ROOM.height / 2, -ROOM.depth + 0.001]} material={walls.back} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
      </mesh>
      <mesh position={[0, 0.001, -ROOM.depth / 2]} rotation={[-Math.PI / 2, 0, 0]} material={walls.floor} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </mesh>
      <Block position={[-half + 0.02, 0.95, -ROOM.depth / 2]} size={[0.04, 0.06, ROOM.depth]} color="#2a1c12" />
      <Block position={[0, 0.95, -ROOM.depth + 0.02]} size={[ROOM.width, 0.06, 0.04]} color="#2a1c12" />

      {/* Brass foot rail along the bar, a sixth stool. */}
      <mesh position={[1.98, 0.2, -5.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 6, 10]} />
        <meshStandardMaterial color="#b08a3a" metalness={0.9} roughness={0.3} emissive="#3a2a10" />
      </mesh>
      {[-2.6, -4.0, -5.4, -6.8, -8.0].map((z) => <Block key={z} position={[2.04, 0.2, z]} size={[0.08, 0.04, 0.04]} color="#8a6a2a" />)}

      {/* Back bar: many bottles, stacked glasses, taps with handles, the radio. */}
      {bottles.map((bottle, index) => <Bottle key={index} {...bottle} />)}
      {[[-3.0, 0], [-3.12, 0], [-3.24, 0], [-3.06, 0.1], [-3.18, 0.1], [-3.12, 0.2], [-3.6, 0], [-3.72, 0], [-3.66, 0.1]].map(([z, y], index) => <Glass key={index} position={[half - 0.4, 1.06 + y, z]} />)}
      {[-4.6, -4.8, -5.0].map((z) => <Block key={z} position={[2.75, 1.58, z]} size={[0.05, 0.16, 0.05]} color="#111" />)}
      <Block position={[2.62, 1.16, -4.8]} size={[0.22, 0.03, 0.6]} color="#7d7f83" />
      <mesh position={[2.66, 1.85, -4.8]} rotation={[0, -Math.PI / 2, 0]} material={onTap}>
        <planeGeometry args={[0.5, 0.19]} />
      </mesh>
      <group position={[half - 0.3, 1.0, -3.9]}>
        <Block position={[0, 0.12, 0]} size={[0.2, 0.24, 0.36]} color="#4a3020" />
        <Glow position={[-0.105, 0.14, 0]} size={[0.24, 0.07]} color="#ffcf8a" intensity={0.9} rotation={[0, -Math.PI / 2, 0]} />
      </group>
      {/* A small wreath above the back-bar mirror. */}
      <group position={[half - 0.05, 2.72, -5.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <torusGeometry args={[0.17, 0.05, 8, 20]} />
          <meshStandardMaterial color="#244a2a" roughness={0.9} />
        </mesh>
        <Block position={[0, -0.17, 0.05]} size={[0.1, 0.07, 0.03]} color="#7a1a18" />
      </group>

      {/* Tables: ashtrays, bottles and glasses left behind. */}
      {[[-2.4, -3.0], [-2.4, -6.0]].map(([x, z]) => (
        <group key={z} position={[x, 0.765, z]}>
          <Ashtray position={[0.12, 0.015, 0.1]} />
          <Bottle x={-0.15} y={0} z={-0.05} shape="neck" color="#4a2a14" />
          <Glass position={[0.05, 0.05, -0.2]} />
        </group>
      ))}

      {/* Pool table with its hanging lamp; the cue rack on the back wall. */}
      <group position={[POOL_TABLE[0], 0, POOL_TABLE[1]]}>
        <Block position={[0, 0.62, 0]} size={[2.1, 0.2, 1.15]} color="#3a2616" />
        <Block position={[0, 0.725, 0]} size={[1.9, 0.02, 0.95]} color="#1f4a2f" />
        {[[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]].map(([x, z]) => <Block key={`${x}${z}`} position={[x, 0.27, z]} size={[0.14, 0.54, 0.14]} color="#2a1a10" />)}
        {[[0.3, 0.1, '#e8e2d0'], [-0.4, -0.2, '#a02020'], [-0.5, 0.15, '#2040a0']].map(([x, z, color]) => (
          <mesh key={color} position={[x, 0.765, z]}>
            <sphereGeometry args={[0.028, 12, 8]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <group ref={poolLamp} position={[POOL_TABLE[0], ROOM.height, POOL_TABLE[1]]}>
        <Block position={[0, -0.35, 0]} size={[0.015, 0.7, 0.015]} color="#111" />
        <Block position={[0, -0.78, 0]} size={[1.0, 0.16, 0.34]} color="#1d3a24" />
        <Glow position={[0, -0.865, 0]} size={[0.9, 0.28]} color="#ffe0a8" intensity={1.2} rotation={[Math.PI / 2, 0, 0]} />
        <pointLight position={[0, -0.95, 0]} color="#ffe0a8" intensity={3.5} distance={3.5} decay={1.4} />
      </group>
      <group position={[-2.3, 1.25, -ROOM.depth + 0.04]}>
        <Block position={[0, 0.55, 0]} size={[0.6, 0.06, 0.06]} color="#2a1a10" />
        <Block position={[0, -0.55, 0]} size={[0.6, 0.06, 0.06]} color="#2a1a10" />
        {[-0.22, -0.08, 0.06, 0.2].map((x) => <Block key={x} position={[x, 0, 0.03]} size={[0.025, 1.3, 0.025]} color="#6a4a2a" />)}
      </group>

      {/* Back wall: mounted antlers, the clock, a dartboard, the cigarette machine. */}
      <group position={[-1.3, 2.42, -ROOM.depth + 0.04]}>
        <Block position={[0, 0, 0]} size={[0.3, 0.36, 0.04]} color="#2a1a10" />
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.08, 0.1, 0.06]} rotation={[0, 0, side * -0.7]}>
            <Block position={[0, 0.25, 0]} size={[0.03, 0.5, 0.03]} color="#c8bba0" />
            {[0.12, 0.25, 0.38].map((y) => <Block key={y} position={[side * 0.07, y, 0]} size={[0.14, 0.025, 0.025]} color="#c8bba0" rotation={[0, 0, side * 0.9]} />)}
          </group>
        ))}
      </group>
      <group position={[-0.25, 2.5, -ROOM.depth + 0.03]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.05, 24]} />
          <meshStandardMaterial color="#d8d2c0" emissive="#3a362c" />
        </mesh>
        <Block position={[0, 0.05, 0.03]} size={[0.012, 0.11, 0.01]} color="#111" />
        <Block position={[0.05, 0, 0.03]} size={[0.13, 0.012, 0.01]} color="#111" rotation={[0, 0, 0.5]} />
      </group>
      <group position={[1.85, 1.72, -ROOM.depth + 0.03]}>
        {[[0.24, '#1a1a1a'], [0.2, '#d8cfb0'], [0.15, '#1a1a1a'], [0.1, '#8a2020'], [0.03, '#2a6a2a']].map(([radius, color], index) => (
          <mesh key={index} position={[0, 0, index * 0.004]}>
            <circleGeometry args={[radius, 24]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ))}
      </group>
      <group position={[3.25, 0, -9.65]}>
        <Block position={[0, 0.85, 0]} size={[0.72, 1.7, 0.55]} color="#5a5c60" />
        <Glow position={[0, 1.25, 0.28]} size={[0.56, 0.5]} color="#c8b88a" intensity={0.55} />
        {[-0.24, -0.08, 0.08, 0.24].map((x) => <Block key={x} position={[x, 0.82, 0.3]} size={[0.1, 0.05, 0.06]} color="#a8aaae" />)}
      </group>

      {/* Left wall, front to back: calendar, coat hooks with a coat and a hunting cap, phone, frosted window, beer cases. */}
      <mesh position={[-half + 0.012, 1.75, -2.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.36, 0.5]} />
        <meshStandardMaterial map={calendar} roughness={1} emissive="#2a2620" />
      </mesh>
      <group position={[-half + 0.03, 0, -3.8]}>
        <Block position={[0, 1.7, 0]} size={[0.04, 0.08, 0.9]} color="#2a1a10" />
        <mesh position={[0.12, 1.2, -0.2]} castShadow>
          <capsuleGeometry args={[0.16, 0.6, 4, 8]} />
          <meshStandardMaterial color="#3a3530" roughness={1} />
        </mesh>
        <group position={[0.1, 1.68, 0.25]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.11, 0.1, 14]} />
            <meshStandardMaterial color="#7a1e1a" roughness={0.9} />
          </mesh>
          <mesh position={[0.06, -0.04, 0]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.015, 14, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#6a1a16" roughness={0.9} />
          </mesh>
        </group>
      </group>
      <group position={[-half + 0.06, 1.5, -6.15]}>
        <Block position={[0, 0, 0]} size={[0.1, 0.34, 0.2]} color="#3a2616" />
        <Block position={[0.07, 0.06, 0.08]} size={[0.05, 0.2, 0.05]} color="#111" />
        <Block position={[0.07, 0.05, -0.06]} size={[0.03, 0.06, 0.03]} color="#888" />
      </group>
      <group position={[-half + 0.02, 1.75, -7.3]} rotation={[0, Math.PI / 2, 0]}>
        <Glow position={[0, 0, 0]} size={[1.0, 0.8]} color="#1b2436" intensity={0.9} />
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1.0, 0.8]} />
          <meshBasicMaterial map={frost} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <Block position={[0, 0, 0.03]} size={[0.05, 0.8, 0.05]} color="#1a120c" />
        <Block position={[0, 0, 0.03]} size={[1.0, 0.05, 0.05]} color="#1a120c" />
        <Block position={[0, -0.43, 0.05]} size={[1.1, 0.06, 0.1]} color="#1a120c" />
      </group>
      <pointLight position={[-3.4, 1.75, -7.3]} color="#4a6a9a" intensity={0.6} distance={2.5} decay={1.6} />
      {[[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]].map(([column, row]) => (
        <group key={`${column}${row}`} position={[-half + 0.3, 0.16 + row * 0.31, -6.95 - column * 0.5]}>
          <Block position={[0, 0, 0]} size={[0.42, 0.3, 0.46]} color="#5a4630" />
          {row === 0 ? (
            <mesh position={[0.215, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.3, 0.12]} />
              <meshStandardMaterial map={boardTexture(column === 0 ? 'BEER' : 'LAGER', { background: '#5a4630', color: '#d8c8a0', width: 256, height: 96, font: 56 })} roughness={1} />
            </mesh>
          ) : null}
        </group>
      ))}

      {/* Stove pipe elbow into the wall, embers flickering. */}
      <Block position={[-3.3, 3.0, -9.45]} size={[0.16, 0.16, 0.9]} color="#1c1c1e" />
      <mesh position={[-3.3, 0.45, -8.54]} material={embers}>
        <planeGeometry args={[0.24, 0.14]} />
      </mesh>
      <pointLight ref={stoveLight} position={[-3.3, 0.5, -8.2]} color="#ff7a2a" intensity={2} distance={4} decay={1.4} />

      {/* The BEER neon on the back wall and the jukebox front, both alive. */}
      <mesh position={[0.6, 2.25, -ROOM.depth + 0.015]} material={neon}>
        <planeGeometry args={[0.9, 0.34]} />
      </mesh>
      <mesh position={[-half + 0.61, 0.95, -5.0]} rotation={[0, Math.PI / 2, 0]} material={jukeboxFront}>
        <planeGeometry args={[0.6, 0.5]} />
      </mesh>
      <DustMotes centres={[[2.1, -3.9], [2.1, -6.6], [-2.0, -4.6], POOL_TABLE]} />
    </group>
  )
}

function TavernInterior({ shot }) {
  const glow = getGlowTexture()
  const trail = useMemo(() => {
    const dots = []
    const steps = 8
    const end = [DOOR_X + 0.5, -4.8]
    for (let index = 0; index <= steps; index++) {
      const along = index / steps
      const x = POOL[0] + (end[0] - POOL[0]) * along + Math.sin(along * Math.PI) * 0.35
      const z = POOL[1] + (end[1] - POOL[1]) * along
      dots.push([x, z])
    }
    return dots
  }, [])
  const trailMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2f').multiplyScalar(1.6), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [])
  const poolMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: glow, color: '#ff2a2f', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), [glow])
  useFrame(() => {
    poolMaterial.opacity = 1.0 * smoothstep((clock.shotSeconds - 0.8) / 0.8)
    trailMaterial.opacity = 0.9 * smoothstep((clock.shotSeconds - 2.4) / 0.6)
  })
  const plates = shot.plates ?? []
  const half = ROOM.width / 2
  return (
    <group>
      <TimeOfDay light="night" shadowSize={20} />
      <ambientLight color="#ffe2c0" intensity={0.45} />
      <hemisphereLight args={['#7a6e5e', '#2a2016', 0.7]} />
      {PENDANTS.map(([x, z, intensity], index) => (
        <group key={index} position={[x, 0, z]}>
          <Block position={[0, ROOM.height - 0.3, 0]} size={[0.015, 0.6, 0.015]} color="#111" castShadow={false} />
          <mesh position={[0, ROOM.height - 0.66, 0]}>
            <coneGeometry args={[0.24, 0.2, 20, 1, true]} />
            <meshStandardMaterial color="#2f3a2c" emissive="#ffcf8a" emissiveIntensity={0.15} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, ROOM.height - 0.74, 0]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial color={new THREE.Color('#ffd9a0').multiplyScalar(2)} toneMapped={false} />
          </mesh>
          <pointLight position={[0, ROOM.height - 0.8, 0]} color="#ffc27a" intensity={intensity} distance={8} decay={1.3} castShadow={index === 0} />
        </group>
      ))}
      <pointLight position={[0.6, 2.0, -9.4]} color="#ff4a3a" intensity={3} distance={4.5} decay={1.4} />
      <pointLight position={[-3.0, 1.1, -5.0]} color="#ffb35c" intensity={0.8} distance={2.5} decay={1.4} />
      {/* The room: floor, ceiling, walls; the front wall has the door opening and a window. */}
      <Block position={[0, -0.05, -ROOM.depth / 2]} size={[ROOM.width, 0.1, ROOM.depth]} color="#3d3226" />
      <Block position={[0, ROOM.height + 0.05, -ROOM.depth / 2]} size={[ROOM.width, 0.1, ROOM.depth]} color="#161310" />
      <Block position={[-half - 0.05, ROOM.height / 2, -ROOM.depth / 2]} size={[0.1, ROOM.height, ROOM.depth]} color="#4a3b2c" />
      <Block position={[half + 0.05, ROOM.height / 2, -ROOM.depth / 2]} size={[0.1, ROOM.height, ROOM.depth]} color="#4a3b2c" />
      <Block position={[0, ROOM.height / 2, -ROOM.depth - 0.05]} size={[ROOM.width, ROOM.height, 0.1]} color="#4a3b2c" />
      {/* Front wall pieces around the door (x -1.375..-0.425, up to 2.15) and the window (x 1.0..2.6, 1.1..2.2). */}
      <Block position={[-2.6875, ROOM.height / 2, 0.05]} size={[2.625, ROOM.height, 0.1]} color="#4a3b2c" />
      <Block position={[DOOR_X, (ROOM.height + 2.15) / 2, 0.05]} size={[DOOR_WIDTH, ROOM.height - 2.15, 0.1]} color="#4a3b2c" />
      <Block position={[0.2875, ROOM.height / 2, 0.05]} size={[1.425, ROOM.height, 0.1]} color="#4a3b2c" />
      <Block position={[1.8, 0.55, 0.05]} size={[1.6, 1.1, 0.1]} color="#4a3b2c" />
      <Block position={[1.8, (ROOM.height + 2.2) / 2, 0.05]} size={[1.6, ROOM.height - 2.2, 0.1]} color="#4a3b2c" />
      <Block position={[3.3, ROOM.height / 2, 0.05]} size={[1.4, ROOM.height, 0.1]} color="#4a3b2c" />
      {/* The window to the night, with a cross bar. */}
      <Glow position={[1.8, 1.65, 0.12]} size={[1.6, 1.1]} color="#1b2436" intensity={0.9} rotation={[0, Math.PI, 0]} />
      <Block position={[1.8, 1.65, 0.02]} size={[0.06, 1.1, 0.06]} color="#151210" />
      <Block position={[1.8, 1.65, 0.02]} size={[1.6, 0.06, 0.06]} color="#151210" />
      {/* Outside the door: dark ground and the open leaf swung back inside. */}
      <Block position={[DOOR_X, -0.05, 5]} size={[12, 0.1, 10]} color="#15161a" />
      <group position={[DOOR_X - DOOR_WIDTH / 2, 0, -0.05]} rotation={[0, 1.25, 0]}>
        <Block position={[DOOR_WIDTH / 2, 1.07, 0]} size={[DOOR_WIDTH, 2.14, 0.05]} color="#3a2e22" />
      </group>
      {/* The bar: counter, foot rail, stools, taps and the register. */}
      <Block position={[2.5, 0.55, -5.2]} size={[0.75, 1.1, 6]} color="#3b2b1e" />
      <Block position={[2.5, 1.12, -5.2]} size={[0.95, 0.06, 6.2]} color="#4c3826" />
      {[-2.8, -3.9, -5.0, -6.1, -7.2].map((z) => (
        <group key={z} position={[1.65, 0, z]}>
          <mesh position={[0, 0.38, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.06, 0.76, 8]} />
            <meshStandardMaterial color="#55575c" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
            <meshStandardMaterial color="#4a1e1c" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {[-4.6, -4.8, -5.0].map((z) => (
        <mesh key={z} position={[2.75, 1.32, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
          <meshStandardMaterial color="#b8b9bc" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      <Block position={[2.55, 1.33, -7.5]} size={[0.42, 0.36, 0.4]} color="#6a6c70" />
      <Block position={[2.45, 1.55, -7.5]} size={[0.3, 0.12, 0.38]} color="#7d7f83" rotation={[0, 0, 0.5]} />
      {/* The back bar: cabinet, mirror and two shelves of bottles. */}
      <Block position={[half - 0.25, 0.5, -5.2]} size={[0.5, 1.0, 6]} color="#33251a" />
      <mesh position={[half - 0.02, 1.95, -5.2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[4.2, 0.9]} />
        <meshStandardMaterial color="#5c6066" metalness={0.9} roughness={0.15} emissive="#6a6a66" emissiveIntensity={0.55} />
      </mesh>
      <Block position={[half - 0.28, 1.48, -5.2]} size={[0.4, 0.04, 4.6]} color="#4c3826" />
      <Block position={[half - 0.28, 1.9, -5.2]} size={[0.4, 0.04, 4.6]} color="#4c3826" />
      {/* Tables and chairs on the left. */}
      {[[-2.4, -3.0], [-2.4, -6.0]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.05, 20]} />
            <meshStandardMaterial color="#3e2e20" roughness={0.8} />
          </mesh>
          <Block position={[0, 0.37, 0]} size={[0.08, 0.74, 0.08]} color="#2a2018" />
          {[[-0.62, 0], [0.62, 0]].map(([chairX]) => (
            <group key={chairX} position={[chairX, 0, 0]}>
              <Block position={[0, 0.45, 0]} size={[0.4, 0.05, 0.4]} color="#3a2b1e" />
              <Block position={[chairX > 0 ? 0.18 : -0.18, 0.72, 0]} size={[0.05, 0.55, 0.4]} color="#3a2b1e" />
              <Block position={[0, 0.22, 0]} size={[0.32, 0.44, 0.32]} color="#241a12" />
            </group>
          ))}
        </group>
      ))}
      {/* The stove with its pipe, embers barely glowing. */}
      <mesh position={[-3.3, 0.5, -8.9]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 1, 16]} />
        <meshStandardMaterial color="#1c1c1e" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[-3.3, 2.05, -8.9]}>
        <cylinderGeometry args={[0.08, 0.08, 2.1, 8]} />
        <meshStandardMaterial color="#1c1c1e" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* A jukebox against the left wall. */}
      <group position={[-half + 0.32, 0, -5.0]} rotation={[0, Math.PI / 2, 0]}>
        <Block position={[0, 0.65, 0]} size={[0.85, 1.3, 0.55]} color="#3a2a22" />
        <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.425, 0.425, 0.55, 20, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#3a2a22" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <TavernFurnishings half={half} />
      {/* Evidence, abstract: the red light pool, the marker, the dotted trail to the door. */}
      <mesh position={[POOL[0], 0.012, POOL[1]]} rotation={[-Math.PI / 2, 0, 0]} material={poolMaterial} renderOrder={4}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      {trail.map(([x, z], index) => (
        <mesh key={index} position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]} material={trailMaterial} renderOrder={5}>
          <circleGeometry args={[0.045, 10]} />
        </mesh>
      ))}
      <group position={[MARKER[0], 0, MARKER[1]]}>
        <mesh position={[0, 0.07, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.1, 0.14, 4]} />
          <meshBasicMaterial color="#e8d9a8" toneMapped={false} />
        </mesh>
      </group>
      {plates.map(([name, at, anchor, away]) => <Plate key={name} anchor={anchor} away={away} gap={0.07} leader name={name} at={at} scale={0.85} />)}
    </group>
  )
}

function useFramedBuilding(file, doorName) {
  const building = useBuilding(file, doorName)
  return useMemo(() => {
    panelDoor(building.door)
    frameGlazing(building.scene)
    const doorway = cutDoorway(building.scene, building.door, building.box)
    doorway.backWall.emissiveIntensity = 0.12
    return { ...building, doorway }
  }, [building])
}

function Tavern() {
  const building = useFramedBuilding('tavern', 'tavern_door')
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const front = building.box.max.z
  useEffect(() => {
    building.door.rotation.y = -0.9
    for (const material of building.windows) {
      material.emissive.copy(WINDOW_RED)
      material.emissiveIntensity = 1.5
    }
    for (const glow of building.glows) glow.visible = true
  }, [building])
  return (
    <group>
      <TimeOfDay light="dusk" shadowSize={70} />
      <Ground color="#2a2d33" />
      <CountryRoad />
      <TavernLot front={front} doorX={building.doorPosition.x} />
      <primitive object={building.scene} />
      <LocalClipping />
      <Highlight target={building.scene} color="#ff2a2f" delay={0.6} clip={{ planes: building.doorway.planes, except: building.door }} />
      <Trees props={props} spots={VIGNETTE_TREE_SPOTS} />
      <pointLight position={[building.doorPosition.x, 1.4, front - 2.5]} color="#ff2a2f" intensity={24} distance={14} decay={1.6} />
    </group>
  )
}

// ---------- 16 Nov 1957: Plainfield ----------

function useVillage() {
  const street = useGLTF(`${ASSETS}/main_street.glb`, false)
  return useMemo(() => {
    const scene = street.scene.clone(true)
    const windows = []
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
      if (object.material.name.startsWith('window_warm')) {
        object.material.toneMapped = false
        windows.push(object.material)
      }
      // The app's red outline is a map marker, not part of the street.
      if (object.material.name.startsWith('red_glow')) object.visible = false
    })
    panelDoor(scene.getObjectByName('hardware_store_door'))
    panelDoor(scene.getObjectByName('hardware_store_rear_door'))
    frameGlazing(scene)
    scene.updateMatrixWorld(true)
    const pool = scene.getObjectByName('hardware_store_light_pool')
    const poolMaterial = new THREE.MeshBasicMaterial({ color: '#ff2a2f', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    pool.traverse((object) => {
      if (object.isMesh) {
        object.material = poolMaterial
        object.visible = true
      }
    })
    const storeWindows = []
    scene.getObjectByName('hardware_store_body').parent.traverse((object) => {
      if (object.isMesh && object.material.name?.startsWith('window_warm')) storeWindows.push(object.material)
    })
    const door = scene.getObjectByName('hardware_store_door')
    const storeBox = new THREE.Box3().setFromObject(scene.getObjectByName('hardware_store_body'))
    const doorway = cutDoorway(scene, door, storeBox)
    const poolPosition = pool.getWorldPosition(new THREE.Vector3())
    const store = scene.getObjectByName('hardware_store_body')
    return { scene, windows, storeWindows, poolMaterial, door, storeBox, poolPosition, store, doorway, doorwayClip: { planes: doorway.planes, except: door } }
  }, [street])
}

// red: shot seconds at which the store's windows and floor turn red (Infinity = never); from the start when 0.
function Village({ light, red = Infinity, doorOpenAt = Infinity, snow = false, children }) {
  const village = useVillage()
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const redLightRef = useRef()
  const doorwayLightRef = useRef()
  useFrame(() => {
    const seconds = clock.shotSeconds
    const level = red === 0 ? 1 : smoothstep((seconds - red) / 0.7)
    for (const material of village.windows) {
      material.emissive.copy(WINDOW_WARM)
      material.emissiveIntensity = light === 'morning' ? 0.35 : 0.9
    }
    for (const material of village.storeWindows) {
      material.emissive.copy(WINDOW_WARM).lerp(WINDOW_RED, level)
      material.emissiveIntensity = 0.6 + 1.3 * level
    }
    village.poolMaterial.opacity = 0.85 * level
    // The red light inside reaches the back of the vestibule and spills out over the threshold.
    village.doorway.backWall.emissiveIntensity = 0.05 + 1.1 * level
    village.door.rotation.y = doorOpenAt === 0 ? -1.2 : -1.2 * smoothstep((seconds - doorOpenAt) / 0.5)
    redLightRef.current.intensity = 30 * level
    doorwayLightRef.current.intensity = 9 * level
  })
  return (
    <group>
      <TimeOfDay light={light} shadowSize={110} />
      <LocalClipping />
      <primitive object={village.scene} />
      <Trees props={props} spots={VILLAGE_TREE_SPOTS} />
      {snow ? <Snow box={[-60, 60, -20, 90]} count={2400} top={36} /> : null}
      <pointLight ref={redLightRef} position={[village.poolPosition.x, 1.5, village.poolPosition.z]} color="#ff2a2f" intensity={0} distance={16} decay={1.5} />
      {/* Red light from inside the open door, falling on the threshold. */}
      <pointLight ref={doorwayLightRef} position={village.doorway.vestibule.position.toArray()} color="#ff2a2f" intensity={0} distance={6} decay={1.4} />
      <StoreSign village={village} />
      {red !== Infinity ? <Highlight target={village.store} color="#ff2a2f" delay={red === 0 ? 0.2 : red} keep={(point) => point.x < village.storeBox.min.x + 2.5} clip={village.doorwayClip} /> : null}
      {typeof children === 'function' ? children(village) : children}
    </group>
  )
}

// The one real business name in the film, on a board above the store front (the front faces -x).
let signTexture = null
function getSignTexture() {
  if (signTexture) return signTexture
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 192
  const context = canvas.getContext('2d')
  context.fillStyle = '#1c1b19'
  context.fillRect(0, 0, 1024, 192)
  context.fillStyle = '#d9d2bf'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  // The largest size whose text fits the board with a margin.
  let fontSize = 110
  context.font = `bold ${fontSize}px Georgia, serif`
  const width = context.measureText('WORDEN HARDWARE').width
  fontSize = Math.floor(fontSize * Math.min(1, 900 / width))
  context.font = `bold ${fontSize}px Georgia, serif`
  context.fillText('WORDEN HARDWARE', 512, 100)
  signTexture = new THREE.CanvasTexture(canvas)
  signTexture.colorSpace = THREE.SRGBColorSpace
  return signTexture
}

function StoreSign({ village }) {
  const box = village.storeBox
  const centreZ = (box.min.z + box.max.z) / 2
  return (
    // Drawn last without depth test: facade trim in the model stands proud of the wall and cut the board's letters.
    <mesh position={[box.min.x - 0.45, 3.7, centreZ]} rotation={[0, -Math.PI / 2, 0]} renderOrder={10}>
      <planeGeometry args={[4.6, 0.86]} />
      <meshStandardMaterial map={getSignTexture()} roughness={0.8} emissive="#ffffff" emissiveMap={getSignTexture()} emissiveIntensity={0.25} depthTest={false} />
    </mesh>
  )
}

const TOWNSPEOPLE = [
  [[0, -10, 18], [3.4, -10, 23]],
  [[0, -10.6, 52], [3.4, -10.6, 47]],
  [[0, 10.2, 30], [3.4, 10.2, 34.6]],
  [[0, 10.6, 60], [3.4, 10.6, 55.4]],
  [[0, -9.8, 36], [3.4, -9.8, 40.5]],
  [[0, 11, 8], [3.4, 11, 12.5]],
]

// Parked along the kerbs, nose in the direction of their lane.
const PARKED = [
  { name: 'ford49_sedan', position: [-7.2, 0, 26], rotation: headingFor(0, -1), tint: '#3d3e42' },
  { name: 'pickup_generic', position: [7.4, 0, 62], rotation: headingFor(0, 1), tint: '#4b4842' },
  { name: 'ford49_sedan', position: [-7.2, 0, 70], rotation: headingFor(0, -1), tint: '#2f3338' },
]

function ParkedCar({ spot }) {
  const car = useVehicle(spot.name, spot)
  return <primitive object={car.object} />
}

function VillageMorning() {
  // Right-hand traffic: northbound (+z) in the east lane, southbound in the west lane.
  const sedan = useVehicle('ford49_sedan', { tint: '#3d3e42', position: [3.2, 0, 6], rotation: headingFor(0, 1) })
  const pickup = useVehicle('pickup_generic', { tint: '#4b4842', position: [-3.2, 0, 78], rotation: headingFor(0, -1) })
  useFrame(() => {
    const seconds = clock.shotSeconds
    sedan.object.position.z = 6 + seconds * 9
    sedan.roll(seconds * 9)
    pickup.object.position.z = 78 - seconds * 8
    pickup.roll(seconds * 8)
  })
  return (
    <Village light="morning" snow>
      <primitive object={sedan.object} />
      <primitive object={pickup.object} />
      {PARKED.map((spot, index) => <ParkedCar key={index} spot={spot} />)}
      {TOWNSPEOPLE.map((path, index) => <Mannequin key={index} who="town" path={path} />)}
    </Village>
  )
}

function StoreEvening() {
  return (
    <Village light="dusk" red={1.9} doorOpenAt={1.55}>
      {(village) => {
        const doorX = village.storeBox.min.x - 0.6
        const doorZ = village.door.getWorldPosition(new THREE.Vector3()).z
        return <Mannequin who="frank" path={[[0, doorX - 4.2, doorZ + 2.6], [1.5, doorX, doorZ], [2.3, doorX, doorZ, Math.PI / 2], [3.3, doorX + 2.4, doorZ]]} />
      }}
    </Village>
  )
}

function SalesSlip() {
  const { camera } = useThree()
  const slipRef = useRef()
  const texture = getSlipTexture()
  useFrame(() => {
    const seconds = clock.shotSeconds
    const slip = slipRef.current
    slip.position.y = 1.5 + 0.75 * easeInOut(seconds / 2.4)
    slip.quaternion.copy(camera.quaternion)
    slip.rotateZ(0.06 * Math.sin(seconds * 1.3))
    slip.material.opacity = smoothstep((seconds - 0.2) / 0.8)
  })
  return (
    <Village light="dusk" red={0} doorOpenAt={0}>
      {(village) => (
        <mesh ref={slipRef} position={[village.storeBox.min.x - 1.6, 1.7, 44.5]}>
          <planeGeometry args={[1.3, 1.73]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      )}
    </Village>
  )
}

// ---------- that night: West Plainfield (generic building) and the farm ----------

function Arrest() {
  const building = useFramedBuilding('grocery', 'grocery_door')
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const front = building.box.max.z
  const doorX = building.doorPosition.x
  const carPosition = [6.8, 0, front + 6.5]
  const car = useVehicle('police_car_generic', { position: carPosition, rotation: 0 })
  useFrame(() => {
    const seconds = clock.shotSeconds
    if (car.lamp) car.lamp.emissiveIntensity = 2.5 + 2.5 * Math.sin(seconds * 6) ** 2
    if (car.rearDoor) car.rearDoor.rotation.y = 1.1 * smoothstep((seconds - 0.4) / 0.5)
    for (const material of building.windows) material.emissiveIntensity = 1.1
  })
  const target = [carPosition[0] - 1.4, carPosition[2] - 1.6]
  return (
    <group>
      <TimeOfDay light="night" shadowSize={50} />
      <Ground />
      <primitive object={building.scene} />
      <Trees props={props} spots={VIGNETTE_TREE_SPOTS} />
      <primitive object={car.object} />
      <pointLight position={[6.4, 2.3, front + 6.5]} color="#3f7fe0" intensity={18} distance={18} decay={1.5} />
      <pointLight position={[doorX, 2.6, front + 1.5]} color="#ffd29a" intensity={9} distance={11} decay={1.6} />
      <Mannequin who="ed" style="cuffed" path={[[0.3, doorX, front + 1.2], [3.0, target[0], target[1]], [3.6, target[0], target[1], 1.2]]} />
      <Mannequin who="deputy" style="escort" path={[[0.3, doorX - 0.75, front + 1.0], [3.0, target[0] - 0.75, target[1] - 0.3], [3.6, target[0] - 0.75, target[1] - 0.3, 1.2]]} />
      <Mannequin who="deputy" path={[[0.3, doorX + 0.6, front + 0.5], [3.0, target[0] + 0.9, target[1] - 0.6], [3.6, target[0] + 0.9, target[1] - 0.6, 1.4]]} />
    </group>
  )
}

export const FLOOD_LAMP_ON = [0.25, 0.65, 1.05, 1.45]

function FloodLamps() {
  const lights = useGLTF(`${ASSETS}/lights.glb`, false)
  const rigs = useMemo(() => LAMP_RIGS.map((rig) => {
    const object = lights.scene.getObjectByName('lights').clone(true)
    object.position.set(...rig.position)
    object.rotation.y = rig.rotation
    object.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.material = child.material.clone()
      if (child.material.name?.startsWith('lamp_warm')) {
        child.material.toneMapped = false
        child.material.emissiveIntensity = 4
      }
    })
    object.updateMatrixWorld(true)
    const head = object.getObjectByName('flood_lamp_head').getWorldPosition(new THREE.Vector3())
    const target = new THREE.Object3D()
    target.position.set(...rig.aim)
    return { object, head, target }
  }), [lights])
  // The generator runs; each lamp clunks on in turn (FLOOD_LAMP_ON, also the sound cues), with a short flicker.
  const spotRefs = useRef([])
  useFrame(() => {
    rigs.forEach((rig, index) => {
      const since = clock.shotSeconds - FLOOD_LAMP_ON[index]
      const flicker = since > 0 && since < 0.25 ? (Math.sin(since * 70) > 0 ? 1 : 0.25) : 1
      const level = since > 0 ? flicker : 0
      if (spotRefs.current[index]) spotRefs.current[index].intensity = 220 * level
      rig.object.traverse((child) => {
        if (child.isMesh && child.material.name?.startsWith('lamp_warm')) child.material.emissiveIntensity = 0.2 + 4 * level
      })
    })
  })
  return rigs.map((rig, index) => (
    <group key={index}>
      <primitive object={rig.object} />
      <primitive object={rig.target} />
      <spotLight ref={(light) => { spotRefs.current[index] = light }} position={rig.head} target={rig.target} color="#f3f1e6" intensity={0} distance={60} angle={0.75} penumbra={0.6} decay={1.5} />
    </group>
  ))
}

function FarmSearch() {
  const ford = useVehicle('ford49_sedan', { tint: '#4a2a2a', position: [-14, 0, 4], rotation: 0.5 })
  return (
    <FarmGrounds light="night">
      <primitive object={ford.object} />
      {POLICE_CARS.map((plan, index) => <PoliceCar key={index} position={plan.final} rotation={plan.rotation} seed={index * 1.7} light={index === 0} />)}
      <FloodLamps />
      <Mannequin who="deputy" path={[[0, 10, 10], [3.2, 6.5, 5.5]]} />
      <Mannequin who="deputy" path={[[0, 13, 4], [3.2, 9.8, 0.5]]} />
      <Mannequin who="deputy" path={[[0, 6, 12.5, -2.4]]} />
      <Mannequin who="deputy" path={[[0, -9, 8], [3.2, -6.5, 4.5]]} />
    </FarmGrounds>
  )
}

// ---------- the courthouse (generic block) and the hospital ----------

// A triangular pediment facing +z.
function Pediment({ position, width, height, depth, color }) {
  const shape = useMemo(() => new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, height)]), [width, height])
  return (
    <mesh position={position} castShadow receiveShadow>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

const STONE = '#3a3c41'

// Generic courthouse: brick block on a foundation with cornice and parapet, framed windows, a portico of four
// columns (base, shaft, capital) under an entablature and pediment, steps, and a cupola with a dome.
function Courthouse({ light, children }) {
  const buildingRef = useRef()
  const columns = [-4.5, -1.5, 1.5, 4.5]
  const windows = []
  for (const x of [-12, -9.5, -7, 7, 9.5, 12]) for (const y of [2.4, 5.9]) windows.push([x, y])
  return (
    <group>
      <TimeOfDay light={light} shadowSize={50} />
      <Ground color="#1c1d20" />
      <group ref={buildingRef}>
        <Block position={[0, 0.4, -4]} size={[28.6, 0.8, 14.6]} color="#2a2b2f" />
        <Block position={[0, 4.9, -4]} size={[28, 8.2, 14]} color="#34363b" />
        <Block position={[0, 9.15, -4]} size={[29, 0.5, 15]} color={STONE} />
        <Block position={[0, 9.75, -4]} size={[28.2, 0.7, 14.2]} color="#2c2d32" />
        <Block position={[0, 11.3, -4]} size={[4.5, 2.6, 4.5]} color="#303237" />
        <Block position={[0, 12.7, -4]} size={[5, 0.3, 5]} color={STONE} />
        <mesh position={[0, 12.85, -4]} castShadow>
          <sphereGeometry args={[2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2a2b30" roughness={0.8} />
        </mesh>
        {columns.map((x) => (
          <group key={x} position={[x, 1.6, 4.2]}>
            <Block position={[0, 0.15, 0]} size={[1.2, 0.3, 1.2]} color={STONE} />
            <mesh position={[0, 3.3, 0]} castShadow>
              <cylinderGeometry args={[0.4, 0.47, 6, 12]} />
              <meshStandardMaterial color="#46484e" roughness={0.85} />
            </mesh>
            <Block position={[0, 6.4, 0]} size={[1.15, 0.25, 1.15]} color={STONE} />
          </group>
        ))}
        <Block position={[0, 8.45, 4.2]} size={[11.6, 0.9, 2.6]} color="#3a3c42" />
        <Pediment position={[0, 8.9, 2.9]} width={11.8} height={2.1} depth={2.6} color="#33353a" />
        {[0, 1, 2, 3].map((step) => <Block key={step} position={[0, 0.2 + step * 0.4, 7.4 - step * 0.7]} size={[11.6 - step * 0.4, 0.4, 1.4 + step * 0.0]} color="#3d3f44" />)}
      </group>
      {windows.map(([x, y]) => <FramedWindow key={`${x}-${y}`} position={[x, y, 3.02]} size={[1.2, 1.8]} glow={0.6} />)}
      <FramedDoor position={[0, 1.6, 3.02]} size={[2.2, 3.2]} double lite />
      <pointLight position={[0, 3.5, 6]} color="#ffcf8a" intensity={7} distance={14} decay={1.6} />
      <Highlight target={buildingRef} color="#ffcf8a" strength={1.1} delay={0.7} />
      {children}
    </group>
  )
}

function Arraignment() {
  return (
    <Courthouse light="morning">
      <PoliceCar position={[10, 0, 12]} rotation={headingFor(-1, 0)} light={false} />
      <Mannequin who="ed" style="cuffed" path={[[0, 6.4, 14.4], [3.4, 0.5, 9.2]]} />
      <Mannequin who="deputy" style="escort" path={[[0, 5.6, 14.9], [3.4, -0.3, 9.6]]} />
      <Mannequin who="deputy" path={[[0, 7.6, 15.0], [3.4, 1.5, 9.9]]} />
    </Courthouse>
  )
}

function Trial() {
  return (
    <Courthouse light="day">
      <Mannequin who="ed" style="cuffed" path={[[0, 0.6, 9.0], [4.2, 1.4, 13.4]]} />
      <Mannequin who="deputy" style="escort" path={[[0, -0.2, 9.2], [4.2, 0.6, 13.6]]} />
    </Courthouse>
  )
}

function Hospital() {
  const windows = useMemo(() => {
    const random = seededRandom(1958)
    const list = []
    for (let x = -32; x <= 32; x += 3.2) {
      if (Math.abs(x) < 5.5) continue
      for (const y of [1.8, 5.0, 8.2]) list.push([x, y, 0.35 + random() * 0.75])
    }
    return list
  }, [])
  const buildingRef = useRef()
  return (
    <group>
      <TimeOfDay light="night" shadowSize={80} />
      <Ground />
      <group ref={buildingRef}>
        <Block position={[0, 0.35, -6]} size={[70.6, 0.7, 12.6]} color="#232427" />
        <Block position={[0, 5.2, -6]} size={[70, 9.6, 12]} color="#2b2c30" />
        <Block position={[0, 10.15, -6]} size={[70.8, 0.3, 12.8]} color={STONE} />
        <Block position={[0, 10.6, -6]} size={[70, 0.6, 12]} color="#26272b" />
        <Block position={[0, 7.2, -5]} size={[10, 14.4, 14]} color="#303237" />
        <Block position={[0, 14.55, -5]} size={[10.8, 0.3, 14.8]} color={STONE} />
        {[3.6, 6.8].map((y) => <Block key={y} position={[0, y, 0.03]} size={[70, 0.12, 0.08]} color="#36373c" />)}
        {/* Entrance: canopy on two posts over a flight of steps. */}
        <Block position={[0, 4.3, 3.6]} size={[5.4, 0.25, 3.2]} color={STONE} />
        {[-2.4, 2.4].map((x) => <Block key={x} position={[x, 2.2, 4.9]} size={[0.25, 4.2, 0.25]} color={STONE} />)}
        {[0, 1, 2].map((step) => <Block key={step} position={[0, 0.15 + step * 0.3, 4.4 - step * 0.6]} size={[4.6, 0.3, 1.2]} color="#34363b" />)}
      </group>
      {windows.map(([x, y, level]) => <FramedWindow key={`${x}-${y}`} position={[x, y, 0.02]} size={[1.1, 1.5]} glow={level} />)}
      <FramedDoor position={[0, 0.9, 2.03]} size={[2.2, 3]} double lite glow={0.9} />
      <Fence fromX={-40} toX={40} z={16} spacing={2.5} />
      <pointLight position={[0, 4, 6]} color="#ffcf8a" intensity={10} distance={20} decay={1.5} />
      <Highlight target={buildingRef} color="#bcd4ff" strength={1.1} delay={0.7} />
    </group>
  )
}

// ---------- 20 Mar 1958: the farmhouse burns, seen from the road ----------

function FarmFire() {
  return (
    <FarmGrounds light="night" highlight={false}>
      {(farm) => {
        const box = farm.houseBox
        return (
          <Fire
            position={[farm.houseCentre.x, 0, farm.houseCentre.z]}
            spread={[box.max.x - box.min.x, box.max.z - box.min.z]}
            height={box.max.y + 3}
            size={4.6}
            count={70}
            power={900}
            seed={1958}
          />
        )
      }}
    </FarmGrounds>
  )
}

// ---------- 26 Jul 1984: a corridor at Mendota ----------

function Corridor() {
  const sunTarget = useMemo(() => {
    const object = new THREE.Object3D()
    object.position.set(0, 0, -12)
    return object
  }, [])
  const pillars = []
  for (let z = 4; z >= -30; z -= 4) pillars.push(z)
  return (
    <group>
      <Backdrop color="#c9d0d8" />
      <hemisphereLight args={['#aeb6c2', '#1a1b1e', 0.6]} />
      <primitive object={sunTarget} />
      <directionalLight
        position={[-14, 9, -6]}
        target={sunTarget}
        intensity={3.2}
        color="#f1ead8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <Block position={[0, -0.05, -12]} size={[3.4, 0.1, 40]} color="#3a3b3f" />
      <Block position={[0, 3.25, -12]} size={[3.4, 0.1, 40]} color="#202124" />
      <Block position={[1.7, 1.6, -12]} size={[0.1, 3.2, 40]} color="#2a2b2f" />
      <Block position={[-1.7, 0.45, -12]} size={[0.1, 0.9, 40]} color="#2a2b2f" />
      <Block position={[-1.7, 2.95, -12]} size={[0.1, 0.5, 40]} color="#2a2b2f" />
      {pillars.map((z) => <Block key={z} position={[-1.7, 1.6, z]} size={[0.14, 3.2, 1.2]} color="#2a2b2f" />)}
      {/* Window frames: sill, head and a transom bar in each opening; a skirting board on the right wall. */}
      {pillars.slice(0, -1).map((z) => (
        <group key={`frame${z}`} position={[-1.68, 0, z - 2]}>
          <Block position={[0, 0.92, 0]} size={[0.22, 0.06, 2.8]} color="#1c1c1f" />
          <Block position={[0, 2.68, 0]} size={[0.12, 0.06, 2.8]} color="#1c1c1f" />
          <Block position={[0, 2.2, 0]} size={[0.05, 0.05, 2.8]} color="#1c1c1f" />
          <Block position={[0, 1.8, 0]} size={[0.05, 1.76, 0.05]} color="#1c1c1f" />
        </group>
      ))}
      <Block position={[1.64, 0.08, -12]} size={[0.04, 0.16, 40]} color="#1a1a1d" />
      {[-4, -12, -20, -28].map((z) => <Block key={`lamp${z}`} position={[0, 3.17, z]} size={[0.5, 0.05, 1.4]} color="#3a3c40" />)}
      <Block position={[0, 1.6, -32]} size={[3.4, 3.2, 0.1]} color="#1b1c1f" />
      <Mannequin who="ed" style="old" path={[[0, -0.95, -13.6, -Math.PI / 2]]} />
    </group>
  )
}

// ---------- interiors: 1950s rooms built from blocks, lit by a few hanging lamps ----------

function Room({ width, depth, height, centreZ = 0, floor = '#3d3226', wall = '#4a3b2c', ceiling = '#161310', trim = '#2c2118' }) {
  const half = width / 2
  const back = centreZ + depth / 2
  const front = centreZ - depth / 2
  return (
    <group>
      <Block position={[0, -0.05, centreZ]} size={[width, 0.1, depth]} color={floor} />
      <Block position={[0, height + 0.05, centreZ]} size={[width, 0.1, depth]} color={ceiling} />
      <Block position={[-half - 0.05, height / 2, centreZ]} size={[0.1, height, depth]} color={wall} />
      <Block position={[half + 0.05, height / 2, centreZ]} size={[0.1, height, depth]} color={wall} />
      <Block position={[0, height / 2, front - 0.05]} size={[width, height, 0.1]} color={wall} />
      <Block position={[0, height / 2, back + 0.05]} size={[width, height, 0.1]} color={wall} />
      {/* A dark wainscot band round the foot of every wall. */}
      <Block position={[-half + 0.01, 0.5, centreZ]} size={[0.04, 1.0, depth]} color={trim} />
      <Block position={[half - 0.01, 0.5, centreZ]} size={[0.04, 1.0, depth]} color={trim} />
      <Block position={[0, 0.5, front + 0.01]} size={[width, 1.0, 0.04]} color={trim} />
      <Block position={[0, 0.5, back - 0.01]} size={[width, 1.0, 0.04]} color={trim} />
    </group>
  )
}

// A shaded bulb on a cord with its own light; `sway` swings it a few degrees, as in a draughty cell.
function HangingLamp({ position, ceilingHeight, intensity = 6, distance = 8, shade = '#2f3a2c', sway = false }) {
  const swing = useRef()
  useFrame(() => {
    if (sway && swing.current) swing.current.rotation.z = Math.sin(clock.shotSeconds * 0.9) * 0.035
  })
  const drop = ceilingHeight - position[1]
  return (
    <group position={[position[0], ceilingHeight, position[2]]}>
      <group ref={swing}>
        <Block position={[0, -drop / 2, 0]} size={[0.015, drop, 0.015]} color="#111" castShadow={false} />
        <mesh position={[0, -drop, 0]}>
          <coneGeometry args={[0.26, 0.2, 20, 1, true]} />
          <meshStandardMaterial color={shade} emissive="#ffcf8a" emissiveIntensity={0.15} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -drop - 0.08, 0]}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color={new THREE.Color('#ffd9a0').multiplyScalar(2)} toneMapped={false} />
        </mesh>
        <pointLight position={[0, -drop - 0.15, 0]} color="#ffc27a" intensity={intensity} distance={distance} decay={1.3} />
      </group>
    </group>
  )
}

// A window with a dim glow behind it and, when `bars` is set, vertical iron bars. Local +z points into the room.
function WallWindow({ position, rotationY = 0, width = 1.0, height = 1.3, glow = '#26334a', bars = 0 }) {
  const frameSides = [[0, height / 2 + 0.04, width + 0.16, 0.08], [0, -height / 2 - 0.04, width + 0.16, 0.08], [-width / 2 - 0.04, 0, 0.08, height], [width / 2 + 0.04, 0, 0.08, height]]
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Glow position={[0, 0, 0.02]} size={[width, height]} color={glow} intensity={0.9} />
      {frameSides.map(([x, y, frameWidth, frameHeight]) => <Block key={`${x}${y}`} position={[x, y, 0.05]} size={[frameWidth, frameHeight, 0.1]} color="#151210" />)}
      <Block position={[0, 0, 0.05]} size={[width, 0.05, 0.05]} color="#151210" />
      {Array.from({ length: bars }, (_, index) => <Block key={index} position={[-width / 2 + (width * (index + 1)) / (bars + 1), 0, 0.09]} size={[0.035, height, 0.035]} color="#0c0c0e" />)}
    </group>
  )
}

// A chair faces +z at rotation 0; a seated figure placed at the same spot and heading sits on it.
function Chair({ position, rotation = 0, color = '#3a2b1e' }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block position={[0, 0.45, 0]} size={[0.44, 0.05, 0.44]} color={color} />
      <Block position={[0, 0.74, -0.2]} size={[0.44, 0.5, 0.05]} color={color} />
      <Block position={[0, 0.22, 0]} size={[0.32, 0.44, 0.32]} color="#241a12" />
    </group>
  )
}

function InteriorDoor({ position, rotationY = 0, width = 0.95, height = 2.15, color = '#2b231f' }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Block position={[0, height / 2, 0.03]} size={[width + 0.2, height + 0.1, 0.06]} color="#151210" />
      <Block position={[0, height / 2, 0.07]} size={[width, height, 0.05]} color={color} />
      <Block position={[width / 2 - 0.12, 1.0, 0.12]} size={[0.07, 0.05, 0.05]} color="#9a8a62" />
    </group>
  )
}

// ---- 17 Nov 1957: a small county-jail interview room (the real building is not known, so this one is generic) ----

const JAIL_ROOM = { width: 6, depth: 6, height: 2.8 }
const TABLE_LEGS = [[-0.65, -0.32], [0.65, -0.32], [-0.65, 0.32], [0.65, 0.32]]

function JailRoom() {
  const half = JAIL_ROOM.width / 2
  const farWall = -JAIL_ROOM.depth / 2
  return (
    <group>
      <TimeOfDay light="night" shadowSize={12} />
      <ambientLight color="#ffe2c0" intensity={0.4} />
      <hemisphereLight args={['#6f7684', '#241f1a', 0.55]} />
      <Room {...JAIL_ROOM} floor="#2a2b2d" wall="#3b3f3e" ceiling="#141414" trim="#262826" />
      <HangingLamp position={[0, 1.9, 0]} ceilingHeight={JAIL_ROOM.height} intensity={7} distance={7} sway />
      <WallWindow position={[0.9, 1.75, farWall]} width={0.9} height={0.7} bars={4} />
      <InteriorDoor position={[-half, 0, 0.4]} rotationY={Math.PI / 2} />
      {/* Table, a tin cup and a sheet of paper, two chairs facing each other. */}
      <Block position={[0, 0.72, 0]} size={[1.5, 0.05, 0.8]} color="#4a3a2a" />
      {TABLE_LEGS.map(([x, z]) => <Block key={`${x}${z}`} position={[x, 0.36, z]} size={[0.06, 0.72, 0.06]} color="#2a2018" />)}
      <mesh position={[0.4, 0.8, 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 12]} />
        <meshStandardMaterial color="#7d8084" metalness={0.7} roughness={0.4} />
      </mesh>
      <Block position={[-0.2, 0.752, 0.12]} size={[0.3, 0.004, 0.22]} color="#cfc8b4" />
      <Chair position={[0, 0, -0.74]} rotation={0} />
      <Chair position={[0, 0, 0.74]} rotation={Math.PI} />
      <Mannequin who="ed" style="seatedBowed" path={[[0, 0, -0.74, 0]]} />
      <Mannequin who="deputy" style="seated" path={[[0, 0, 0.74, Math.PI]]} />
    </group>
  )
}

// ---- A small courtroom: Waushara County Court in 1957, the Sauk County judge's bench trial in 1968 ----

const COURT = { width: 10, depth: 12.5, height: 4.2, centreZ: -0.3 }
const GALLERY_ROWS = [0.4, 1.6, 2.8, 4.0]
const GALLERY_SIDES = [-2.6, 2.6]
const JURY_ROWS = [-5.0, -4.2, -3.4, -2.6]
const COUNSEL_TABLES = [-1.6, 1.6]

function CourtFlag({ position }) {
  return (
    <group position={position}>
      <Block position={[0.75, 0, 0.05]} size={[0.04, 3.4, 0.04]} color="#3a2a1a" />
      {Array.from({ length: 7 }, (_, index) => <Block key={index} position={[0.15, -0.11 * index, 0.02]} size={[1.2, 0.11, 0.02]} color={index % 2 === 0 ? '#7a2e30' : '#cfc9b9'} />)}
      <Block position={[-0.2, -0.165, 0.035]} size={[0.5, 0.44, 0.02]} color="#27304c" />
    </group>
  )
}

function Courtroom({ crowd }) {
  const half = COURT.width / 2
  const railPosts = []
  for (let x = -4.8; x <= 4.81; x += 0.3) if (Math.abs(x) > 0.55) railPosts.push(x)
  return (
    <group>
      <TimeOfDay light="night" shadowSize={14} />
      <ambientLight color="#ffe2c0" intensity={0.5} />
      <hemisphereLight args={['#7a7e8a', '#2a2218', 0.7]} />
      <Room {...COURT} floor="#43362a" wall="#4d3e2f" ceiling="#15120f" trim="#2e231a" />
      {[[-2.2, 11], [1.6, 8], [4.4, 8]].map(([z, intensity]) => <HangingLamp key={z} position={[0, 3.0, z]} ceilingHeight={COURT.height} intensity={intensity} distance={11} shade="#3a342c" />)}
      {[-3.4, 0.2, 3.6].map((z) => <WallWindow key={z} position={[half, 2.4, z]} rotationY={-Math.PI / 2} width={1.1} height={1.9} glow="#2c3a52" />)}
      {/* The bench on its platform, the judge's high chair, a flag and the wall clock. */}
      <Block position={[0, 0.16, -5.5]} size={[5.2, 0.32, 1.9]} color="#3a2c20" />
      <Block position={[0, 0.72, -4.75]} size={[3.6, 0.8, 0.45]} color="#50402e" />
      <Block position={[0, 1.2, -6.1]} size={[0.8, 1.7, 0.1]} color="#2a2018" />
      <CourtFlag position={[-3.1, 2.3, -6.15]} />
      <mesh position={[0, 3.3, -6.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.06, 24]} />
        <meshBasicMaterial color={new THREE.Color('#d8d2c0').multiplyScalar(0.8)} toneMapped={false} />
      </mesh>
      <Block position={[0, 3.3, -6.14]} size={[0.03, 0.24, 0.02]} color="#151210" />
      <Block position={[0.08, 3.3, -6.14]} size={[0.16, 0.03, 0.02]} color="#151210" />
      {/* The witness stand and the jury box, which stays empty: both trials are heard by a judge alone. */}
      <Block position={[3.4, 0.5, -4.6]} size={[1.1, 1.0, 0.9]} color="#4a3a2a" />
      <Block position={[-3.4, 0.45, -3.8]} size={[0.12, 0.9, 3.6]} color="#4a3a2a" />
      <Block position={[-4.75, 0.14, -3.8]} size={[0.8, 0.28, 3.4]} color="#2a2018" />
      {JURY_ROWS.map((z) => <Chair key={`front${z}`} position={[-4.3, 0, z]} rotation={Math.PI / 2} color="#34281d" />)}
      {JURY_ROWS.map((z) => <Chair key={`back${z}`} position={[-4.75, 0.28, z]} rotation={Math.PI / 2} color="#34281d" />)}
      {/* The two counsel tables, defence on the left. */}
      {COUNSEL_TABLES.map((x) => (
        <group key={x}>
          <Block position={[x, 0.34, -3.7]} size={[1.9, 0.68, 0.8]} color="#4a3a2a" />
          <Chair position={[x - 0.45, 0, -2.85]} rotation={Math.PI} />
          <Chair position={[x + 0.45, 0, -2.85]} rotation={Math.PI} />
        </group>
      ))}
      {/* The rail between the well and the gallery, with a gate gap in the middle. */}
      <Block position={[-2.7, 0.72, -1.4]} size={[4.3, 0.07, 0.1]} color="#4a3a2a" />
      <Block position={[2.7, 0.72, -1.4]} size={[4.3, 0.07, 0.1]} color="#4a3a2a" />
      {railPosts.map((x) => <Block key={x} position={[x, 0.35, -1.4]} size={[0.05, 0.7, 0.05]} color="#3a2c20" />)}
      {/* Gallery benches, a block of them either side of the aisle. */}
      {GALLERY_ROWS.map((z) => GALLERY_SIDES.map((x) => (
        <group key={`${z}${x}`} position={[x, 0, z]}>
          <Block position={[0, 0.45, 0]} size={[3.2, 0.06, 0.5]} color="#4a3a2a" />
          <Block position={[0, 0.8, 0.28]} size={[3.2, 0.7, 0.06]} color="#3f3226" />
          <Block position={[-1.55, 0.22, 0]} size={[0.08, 0.44, 0.46]} color="#2a2018" />
          <Block position={[1.55, 0.22, 0]} size={[0.08, 0.44, 0.46]} color="#2a2018" />
        </group>
      )))}
      <Mannequin who="judge" style="seated" lift={0.32} path={[[0, 0, -5.55, 0]]} />
      <Mannequin who="ed" style="seated" path={[[0, -2.05, -2.75, Math.PI]]} />
      <Mannequin who="deputy" path={[[0, -3.0, -2.6, Math.PI]]} />
      <Mannequin who="official" style="seated" path={[[0, 1.15, -2.85, Math.PI]]} />
      <Mannequin who="official" style="seated" path={[[0, 2.05, -2.85, Math.PI]]} />
      {crowd.map(([row, side, slot]) => <Mannequin key={`${row}${side}${slot}`} who="town" style="seated" path={[[0, GALLERY_SIDES[side] + (slot - 1) * 0.95, GALLERY_ROWS[row] - 0.05, Math.PI]]} />)}
    </group>
  )
}

// [row (0 is the front bench), side (0 left of the aisle, 1 right), slot 0-2 across the bench]. Only the right-hand
// benches are filled: the left ones are nearest the camera and would sit under the caption.
const CROWD_1957 = [[0, 1, 0], [0, 1, 2], [1, 1, 1], [1, 1, 0]]
const CROWD_1968 = [[0, 1, 0], [0, 1, 1], [0, 1, 2], [1, 1, 0], [1, 1, 1], [1, 1, 2], [2, 1, 1]]

function Arraignment1957() {
  return <Courtroom crowd={CROWD_1957} />
}

function Trial1968() {
  return <Courtroom crowd={CROWD_1968} />
}

// ---- Central State Hospital, Waupun: a plain institutional ward ----

const WARD = { width: 6.4, depth: 10.5, height: 3.2 }
const BED_ZS = [-3.6, -1.2, 1.2, 3.6]

function WardBed({ side, z }) {
  const x = (WARD.width / 2 - 0.55) * side
  return (
    <group position={[x, 0, z]}>
      <Block position={[0, 0.26, 0]} size={[0.9, 0.08, 2.0]} color="#2a2c2e" />
      <Block position={[0, 0.42, 0]} size={[0.84, 0.18, 1.94]} color="#6a7078" />
      <Block position={[0, 0.5, -0.78]} size={[0.6, 0.1, 0.34]} color="#b7b9b4" />
      <Block position={[0, 0.5, 0.2]} size={[0.86, 0.04, 1.3]} color="#4d535a" />
      <Block position={[0, 0.55, -1.02]} size={[0.92, 0.6, 0.05]} color="#1c1d1f" />
      <Block position={[0, 0.4, 1.02]} size={[0.92, 0.3, 0.05]} color="#1c1d1f" />
    </group>
  )
}

function Ward() {
  const half = WARD.width / 2
  const farWall = -WARD.depth / 2
  return (
    <group>
      <TimeOfDay light="night" shadowSize={12} />
      <ambientLight color="#dfe6ee" intensity={0.45} />
      <hemisphereLight args={['#7e8896', '#1c1e20', 0.6]} />
      <Room {...WARD} floor="#303336" wall="#3f454a" ceiling="#18191b" trim="#2a2e31" />
      {[-3.2, 0, 3.2].map((z) => <HangingLamp key={z} position={[0, 2.5, z]} ceilingHeight={WARD.height} intensity={7} distance={8} shade="#4a4f55" />)}
      {BED_ZS.map((z) => <WardBed key={`left${z}`} side={-1} z={z} />)}
      {BED_ZS.map((z) => <WardBed key={`right${z}`} side={1} z={z} />)}
      {BED_ZS.map((z) => <WallWindow key={z} position={[half, 1.9, z]} rotationY={-Math.PI / 2} width={0.9} height={1.1} bars={4} glow="#2a3750" />)}
      <InteriorDoor position={[0, 0, farWall]} width={1.1} color="#3a3f44" />
      <Mannequin who="ed" style="seatedBowed" path={[[0, -half + 0.75, 1.2, Math.PI / 2]]} />
      <Mannequin who="frank" path={[[0, 0.3, farWall + 1.2, 0]]} />
    </group>
  )
}

function End() {
  return <Backdrop color="#000000" />
}

export const SCENES = {
  map: MapScene,
  birth: Birth,
  farmArrival: FarmArrival,
  schoolRoad: SchoolRoad,
  farm1940: Farm1940,
  brushFire: BrushFire,
  winter: Winter,
  caring: Caring,
  sealedRooms: SealedRooms,
  marshNight: MarshNight,
  burialGeorge: BurialGeorge,
  burialHenry: BurialHenry,
  burialAugusta: BurialAugusta,
  oddJobs: OddJobs,
  tavern: Tavern,
  tavernInterior: TavernInterior,
  villageMorning: VillageMorning,
  storeEvening: StoreEvening,
  salesSlip: SalesSlip,
  arrest: Arrest,
  farmSearch: FarmSearch,
  jailRoom: JailRoom,
  courthouse: Arraignment,
  courtroom1957: Arraignment1957,
  hospital: Hospital,
  ward: Ward,
  fire: FarmFire,
  trial: Trial,
  courtroom1968: Trial1968,
  corridor: Corridor,
  end: End,
}
