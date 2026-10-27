// The 3D world: dot-cloud terrain, instanced statics, simulated movers, the launch vehicle, particles,
// selection rings, pins and the camera rig. Everything reads the mutable sim world each frame.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SITE_BY_ID } from './sites.js'
import { GROUND, buildDots } from './terrain.js'
import { PARTICLE_COUNT } from './sim.js'
import { advanceWorld, cameraCommands, clearSelection, entityFocus, findEntity, getUi, selectEntity, setUi, statusOf, useUi, world } from './store.js'
import { StatusIcon } from './icons.jsx'

const FILES = ['rocket', 'pad', 'tanks', 'yard', 'vehicles', 'marine', 'props'].map((name) => `/assets/${name}.glb`)
FILES.forEach((file) => useGLTF.preload(file))

// ---------- materials: matte white clay palette ----------
const PALETTE = {
  clay: { color: '#efeeea', roughness: 0.92 },
  steel_clay: { color: '#e9eaea', roughness: 0.62, metalness: 0.05 },
  frame_clay: { color: '#dcdcd9', roughness: 0.9 },
  concrete_clay: { color: '#d8d7d2', roughness: 1 },
  dark_clay: { color: '#a3a5a7', roughness: 0.9 },
  tile_clay: { color: '#6e7175', roughness: 0.85 },
  glass_clay: { color: '#7d868c', roughness: 0.3 },
  rubber_clay: { color: '#55585b', roughness: 0.95 },
}
const GLOWS = { glow_white: '#ffffff', glow_red: '#ff3b2f', glow_amber: '#ffb240' }
const materialCache = {}
export const glowMaterials = []

function paletteMaterial(name) {
  const key = name.replace(/\.\d+$/, '')
  if (materialCache[key]) return materialCache[key]
  let material
  if (GLOWS[key]) {
    material = new THREE.MeshStandardMaterial({ color: GLOWS[key], emissive: GLOWS[key], emissiveIntensity: 1.6, roughness: 0.5 })
    material.userData.glow = key
    glowMaterials.push(material)
  } else if (key === 'wheel') {
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  } else {
    material = new THREE.MeshStandardMaterial(PALETTE[key] ?? PALETTE.clay)
  }
  materialCache[key] = material
  return material
}

function useLibrary() {
  const files = useGLTF(FILES)
  return useMemo(() => {
    const nodes = {}
    for (const file of files) {
      file.scene.traverse((object) => {
        if (object.isMesh) {
          object.material = paletteMaterial(object.material.name || 'clay')
          object.castShadow = true
          object.receiveShadow = true
        }
      })
      for (const child of file.scene.children) nodes[child.name] = child
    }
    return nodes
  }, [files])
}

function meshesOf(root) {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const list = []
  root.traverse((object) => {
    if (object.isMesh) list.push({ geometry: object.geometry, material: object.material, matrix: inverse.clone().multiply(object.matrixWorld) })
  })
  return list
}

const noRaycast = () => null

// ---------- terrain ----------
function Terrain({ site }) {
  const meshRef = useRef()
  const dots = useMemo(() => buildDots(site), [site])
  const count = dots.length / 3
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.46, 0), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fdfdfc', roughness: 1 }), [])
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    for (let index = 0; index < count; index++) {
      matrix.makeTranslation(dots[index * 3], dots[index * 3 + 1], dots[index * 3 + 2])
      meshRef.current.setMatrixAt(index, matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.computeBoundingSphere()
  }, [dots, count])
  const roads = useMemo(() => site.roads.map((road) => ribbonGeometry(road.points, road.width)), [site])
  return (
    <group>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} receiveShadow raycast={noRaycast} frustumCulled={false} />
      {site.paved.map((rect, index) => (
        <mesh key={index} position={[(rect.x0 + rect.x1) / 2, GROUND - 0.12, (rect.z0 + rect.z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow raycast={noRaycast}>
          <planeGeometry args={[rect.x1 - rect.x0, rect.z1 - rect.z0]} />
          <meshStandardMaterial color="#dddcd8" roughness={1} />
        </mesh>
      ))}
      {roads.map((geometryItem, index) => (
        <mesh key={index} geometry={geometryItem} position-y={GROUND - 0.06} receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color="#d2d2cf" roughness={1} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#cfd3d5" roughness={1} />
      </mesh>
    </group>
  )
}

function ribbonGeometry(points, width) {
  const positions = []
  const indices = []
  for (let index = 0; index < points.length; index++) {
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    const dx = next[0] - previous[0]
    const dz = next[1] - previous[1]
    const length = Math.hypot(dx, dz) || 1
    const nx = (-dz / length) * (width / 2)
    const nz = (dx / length) * (width / 2)
    positions.push(points[index][0] + nx, 0, points[index][1] + nz, points[index][0] - nx, 0, points[index][1] - nz)
    if (index > 0) {
      const a = (index - 1) * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  if (geometry.attributes.normal.array[1] < 0) geometry.index.array.reverse()
  geometry.computeVertexNormals()
  return geometry
}

// ---------- static instancing ----------
const ANIMATED_STATICS = new Set(['tower', 'launch_mount', 'tower_build', 'test_stand', 'checkpoint', 'camera_mast', 'mega_bay', 'high_bay'])

function StaticInstances({ library, site }) {
  const groups = useMemo(() => {
    const byModel = {}
    for (const item of site.statics) {
      if (ANIMATED_STATICS.has(item.model)) continue
      ;(byModel[item.model] ??= []).push(item)
    }
    return Object.entries(byModel).map(([model, items]) => ({ model, items, meshes: meshesOf(library[model]) }))
  }, [library, site])
  return groups.map((group) => group.meshes.map((mesh, meshIndex) => <InstancedPart key={`${group.model}-${meshIndex}`} mesh={mesh} items={group.items} />))
}

function InstancedPart({ mesh, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const placement = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    items.forEach((item, index) => {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation ?? 0)
      placement.compose(new THREE.Vector3(item.x, item.water ? 0 : GROUND, item.z), rotation, new THREE.Vector3(1, 1, 1))
      ref.current.setMatrixAt(index, placement.clone().multiply(mesh.matrix))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, mesh])
  return <instancedMesh ref={ref} args={[mesh.geometry, mesh.material, items.length]} castShadow receiveShadow raycast={noRaycast} />
}

function useClone(library, name) {
  return useMemo(() => {
    const clone = library[name].clone(true)
    clone.position.set(0, 0, 0)
    clone.traverse((object) => {
      if (object.isMesh) object.raycast = noRaycast
    })
    return clone
  }, [library, name])
}

// ---------- animated statics ----------
function AnimatedStatic({ library, item, siteId }) {
  const clone = useClone(library, item.model)
  const parts = useMemo(() => {
    const find = (name) => clone.getObjectByName(name)
    const result = {
      carriage: find('tower_carriage'),
      armLeft: find('tower_carriage_arm_left'),
      armRight: find('tower_carriage_arm_right'),
      qdArm: find('tower_qd_arm'),
      mountQd: find('launch_mount_booster_qd'),
      swingArm: find('test_stand_swing_arm'),
      barrier: find('checkpoint_barrier_arm'),
      head: find('camera_mast_head'),
      module: find('tower_build_module_waiting'),
      door0: find(`${item.model}_door0`),
      door1: find(`${item.model}_door1`),
    }
    for (const door of [result.door0, result.door1]) {
      if (door) door.userData.baseY = door.position.y
    }
    if (result.module) {
      const box = new THREE.Box3().setFromObject(result.module)
      result.module.userData.top = box.max.y
    }
    return result
  }, [clone, item.model])
  useFrame(() => {
    const pad = world.pad
    if (siteId === 'lc1' && parts.carriage) {
      parts.carriage.position.y = 78 + pad.carriageDy
      parts.armLeft.rotation.y = pad.armLeft
      parts.armRight.rotation.y = pad.armRight
      parts.qdArm.rotation.y = pad.qdArm
    }
    if (siteId === 'lc1' && parts.mountQd) parts.mountQd.rotation.x = -pad.mountQd
    if (parts.swingArm) parts.swingArm.rotation.y = (world.sites.ts3.byId['ship-ts3'].armRetract ?? 0) * 1.3
    if (parts.module) {
      const crane = world.sites.lc2.byId['cr-90']
      parts.module.position.y = (crane.lift ?? 0) * 34
      liftState.moduleTop = GROUND + parts.module.userData.top + parts.module.position.y
    }
    if (parts.barrier) {
      const state = world.sites[siteId]
      const near = state.entities.some((entity) => entity.path && Math.hypot(entity.position.x - item.x, entity.position.z - item.z) < 26)
      const goal = near ? 1.35 : 0
      parts.barrier.rotation.z += (goal - parts.barrier.rotation.z) * 0.1
    }
    if (parts.head) {
      const booster = world.sites.lc1.byId['b-14']
      const target = siteId === 'lc1' ? booster.position : { x: 0, y: 20, z: 0 }
      parts.head.rotation.y = Math.atan2(target.x - item.x, target.z - item.z)
    }
    if (parts.door0 && siteId === 'yard') {
      const doors = world.sites.yard.doors ?? { mega: 0, high: 0 }
      const amount = item.model === 'mega_bay' ? doors.mega : item.id === 'bay-high1' ? doors.high : 0
      parts.door0.position.y = parts.door0.userData.baseY + amount * 46
      if (parts.door1) parts.door1.position.y = parts.door1.userData.baseY
    }
  })
  return <primitive object={clone} position={[item.x, GROUND, item.z]} rotation-y={item.rotation ?? 0} />
}

const liftState = { moduleTop: 0 }

// ---------- movers ----------
function Wheeled({ library, entity }) {
  const clone = useClone(library, entity.model)
  const groupRef = useRef()
  const parts = useMemo(() => {
    const wheels = []
    const bogies = []
    clone.traverse((object) => {
      if (/_wheel_\d+$/.test(object.name)) wheels.push(object)
      if (/_bogie_\d+_\d+$/.test(object.name)) bogies.push(object)
    })
    return { wheels, bogies, upper: clone.getObjectByName('crawler_crane_upper'), hook: clone.getObjectByName('crawler_crane_hook'), aframe: clone.getObjectByName('recovery_boat_aframe') }
  }, [clone])
  const hookLength = useMemo(() => {
    if (!parts.hook) return 1
    const box = new THREE.Box3().setFromObject(parts.hook)
    parts.hook.updateWorldMatrix(true, false)
    const pivot = new THREE.Vector3().setFromMatrixPosition(parts.hook.matrixWorld)
    return Math.max(1, pivot.y - box.min.y)
  }, [parts])
  useFrame(() => {
    const group = groupRef.current
    group.position.set(entity.position.x, entity.position.y, entity.position.z)
    group.rotation.y = entity.heading
    if (entity.kind === 'boat') {
      group.position.y = Math.sin(world.time * 0.9 + entity.position.x) * 0.25
      group.rotation.z = Math.sin(world.time * 0.7) * 0.02
    }
    for (const wheel of parts.wheels) wheel.rotation.x = entity.wheelAngle ?? 0
    for (const bogie of parts.bogies) bogie.rotation.y = (entity.steer ?? 0) * Math.sign(bogie.position.z || 1) * 0.6
    if (parts.upper) {
      parts.upper.rotation.y = entity.slew ?? 0
      if (entity.id === 'cr-90') {
        const tipY = GROUND + 3.4 + 103.77
        const bottom = (liftState.moduleTop || GROUND + 15) + 0.5
        parts.hook.scale.y = Math.max(0.05, (tipY - bottom) / hookLength)
      } else {
        parts.hook.scale.y = 0.45 + (entity.lift ?? 0.5) * 0.3
      }
    }
    if (parts.aframe) parts.aframe.rotation.x = Math.sin(world.time * 0.15) * 0.25 - 0.25
  })
  return (
    <group ref={groupRef}>
      <primitive object={clone} />
      {entity.carries && <Carried library={library} model={entity.carries} seat={entity.model === 'spmt_stand' ? 5.1 : 5.1} />}
      <Proxy entity={entity} />
    </group>
  )
}

function Carried({ library, model, seat }) {
  const clone = useClone(library, model)
  return <primitive object={clone} position-y={seat} />
}

// The launch vehicle on LC-1 and the test article on TS-3.
function Vehicle({ library, entity }) {
  const groupRef = useRef()
  const crew = useClone(library, 'ship_crew')
  const cargo = useClone(library, 'ship_cargo')
  const tanker = useClone(library, 'ship_tanker')
  const booster = useClone(library, 'booster_a')
  const ships = useMemo(() => ({ ship_crew: crew, ship_cargo: cargo, ship_tanker: tanker }), [crew, cargo, tanker])
  const fins = useMemo(() => [0, 1, 2, 3].map((index) => booster.getObjectByName(`booster_a_fin_${index}`)), [booster])
  useFrame(() => {
    const group = groupRef.current
    const pose = entity.pose
    if (!pose) return
    group.visible = pose.visible !== false
    if (entity.kind === 'booster') {
      group.position.set(pose.x, GROUND + pose.y, pose.z)
      group.rotation.set(0, 0, pose.tilt)
      fins.forEach((fin, index) => {
        if (fin) fin.rotation.z = (pose.fins ?? 0) * (index % 2 ? 1 : -1)
      })
      return
    }
    for (const [model, clone] of Object.entries(ships)) clone.visible = model === entity.model
    if (pose.onSpmt) {
      group.position.set(entity.position.x, entity.position.y, entity.position.z)
      group.rotation.set(0, entity.heading, 0)
    } else {
      group.position.set(pose.x, GROUND + pose.y, pose.z)
      group.rotation.set(0, pose.turn ?? 0, pose.tilt ?? 0)
    }
  })
  return (
    <group ref={groupRef}>
      {entity.kind === 'booster' ? <primitive object={booster} /> : Object.values(ships).map((clone) => <primitive key={clone.uuid} object={clone} />)}
      <Proxy entity={entity} />
    </group>
  )
}

// ---------- picking proxies ----------
const PROXY_SIZES = {
  booster: [10, 72, 10], ship: [10, 52, 10], tower: [22, 150, 22], mount: [30, 22, 30], tank: [10, 30, 10], boat: [14, 10, 62], spmt: [11, 7, 16],
  tanker: [3.4, 4, 19], van: [2.6, 3, 6.6], pickup: [2.4, 2.4, 5.8], crane: [16, 40, 16], camera: [3, 22, 3], weather: [6, 30, 6], checkpoint: [10, 6, 10], bay: [40, 60, 50], stand: [30, 32, 30],
}
const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })

function proxySize(entity) {
  if (entity.model === 'range_boat') return [5, 5, 15]
  if (entity.model === 'tank_sphere') return [22, 23, 22]
  if (entity.model?.startsWith('tank_horizontal')) return [5, 5, 34]
  if (entity.model === 'mega_bay') return [46, 90, 60]
  if (entity.model === 'high_bay') return [26, 82, 30]
  if (entity.model === 'mid_bay') return [40, 26, 80]
  if (entity.model === 'tent') return [30, 14, 60]
  if (entity.kind === 'spmt' && entity.carries) return [11, entity.carries === 'booster_b' ? 76 : 58, 16]
  return PROXY_SIZES[entity.kind] ?? [6, 6, 6]
}

function Proxy({ entity }) {
  const size = proxySize(entity)
  return (
    <mesh
      material={proxyMaterial}
      position-y={size[1] / 2}
      onClick={(event) => {
        if (event.delta > 6) return
        event.stopPropagation()
        selectEntity(entity.id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <boxGeometry args={size} />
    </mesh>
  )
}

function StaticProxy({ entity }) {
  return (
    <group position={[entity.position.x, entity.position.y, entity.position.z]} rotation-y={entity.heading}>
      <Proxy entity={entity} />
    </group>
  )
}

// ---------- particles ----------
// Hot exhaust dots (warm flag 1 plume, 2 core) are unlit so the core reads as glowing: white at the nozzle,
// through orange, then back to pale smoke. This is the one place warm colour is allowed besides the alert orange.
const HOT_STOPS = ['#ffffff', '#fff1d6', '#ffb35c', '#ff7a2a', '#ffd9bd', '#f4f2f0'].map((value) => new THREE.Color(value))

function hotColor(target, t, core) {
  const position = Math.min(1, (core ? t * 0.55 : t)) * (HOT_STOPS.length - 1)
  const lower = Math.min(HOT_STOPS.length - 2, Math.floor(position))
  return target.copy(HOT_STOPS[lower]).lerp(HOT_STOPS[lower + 1], position - lower)
}

function Particles() {
  const ref = useRef()
  const hotRef = useRef()
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 4), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfbfa', roughness: 1 }), [])
  const hotMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), color: new THREE.Color() }), [])
  useLayoutEffect(() => {
    for (let index = 0; index < PARTICLE_COUNT; index++) hotRef.current.setColorAt(index, scratch.color.set('#ffffff'))
  }, [scratch])
  useFrame(() => {
    const particles = world.particles
    const mesh = ref.current
    const hotMesh = hotRef.current
    let alive = 0
    let hot = 0
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const age = particles.age[index]
      const life = particles.life[index]
      if (age >= life) continue
      const t = age / life
      const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
      const size = (particles.size0[index] + (particles.size1[index] - particles.size0[index]) * t) * 0.5 * Math.max(0.15, fade)
      const base = index * 3
      scratch.matrix.makeScale(size, size, size)
      scratch.matrix.setPosition(particles.position[base], particles.position[base + 1], particles.position[base + 2])
      if (particles.warm[index]) {
        hotMesh.setMatrixAt(hot, scratch.matrix)
        hotMesh.setColorAt(hot, hotColor(scratch.color, t, particles.warm[index] === 2))
        hot++
      } else {
        mesh.setMatrixAt(alive, scratch.matrix)
        alive++
      }
    }
    mesh.count = alive
    mesh.instanceMatrix.needsUpdate = true
    hotMesh.count = hot
    hotMesh.instanceMatrix.needsUpdate = true
    if (hotMesh.instanceColor) hotMesh.instanceColor.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, PARTICLE_COUNT]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={hotRef} args={[geometry, hotMaterial, PARTICLE_COUNT]} frustumCulled={false} raycast={noRaycast} />
    </>
  )
}

// ---------- selection ring and pins ----------
const ORANGE = '#ff5a1f'

function SelectionRing() {
  const { selectedId } = useUi()
  const groupRef = useRef()
  const stemRef = useRef()
  const outerRef = useRef()
  useFrame(() => {
    const entity = findEntity(selectedId)
    const group = groupRef.current
    group.visible = Boolean(entity) && entity.pose?.visible !== false
    if (!entity) return
    const size = proxySize(entity)
    const radius = Math.max(2, Math.max(size[0], size[2]) * 0.5)
    const groundY = entity.kind === 'boat' ? 0.35 : GROUND + 0.25
    group.position.set(entity.position.x, groundY, entity.position.z)
    group.scale.setScalar(radius)
    const height = Math.max(0, entity.position.y - groundY)
    stemRef.current.visible = height > 6
    stemRef.current.scale.set(1 / radius, height / radius, 1 / radius)
    stemRef.current.position.y = height / radius / 2
    outerRef.current.rotation.z = world.time * 0.25
  })
  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <ringGeometry args={[0.965, 1, 64]} />
        <meshBasicMaterial color={ORANGE} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh ref={outerRef} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <ringGeometry args={[1.12, 1.15, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={ORANGE} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <ringGeometry args={[1.45, 1.46, 64]} />
        <meshBasicMaterial color="#202326" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={stemRef} raycast={noRaycast}>
        <cylinderGeometry args={[0.25, 0.25, 1, 6]} />
        <meshBasicMaterial color={ORANGE} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

export function shortLabel(entity) {
  if (entity.kind === 'booster') return 'B-14'
  if (entity.kind === 'ship') return entity.serial ?? 'S-29'
  if (entity.kind === 'spmt' && entity.carries) return `${entity.id.toUpperCase()} · ${entity.carries === 'booster_b' ? 'B-16' : 'S-33'}`
  return entity.id.toUpperCase().replace('BT-', '').replace('-1', '-1')
}

const PIN_KINDS = new Set(['booster', 'ship', 'spmt', 'tanker', 'boat', 'crane', 'tower', 'weather', 'checkpoint', 'bay', 'stand', 'van', 'pickup'])

function Pin({ entity }) {
  const ref = useRef()
  const ui = useUi()
  const selected = ui.selectedId === entity.id
  const status = statusOf(entity)
  useFrame(() => {
    const focus = entityFocus(entity)
    const lift = { booster: 40, ship: 58, tower: 156, crane: 60, bay: 50, stand: 36, weather: 22, boat: 14, spmt: entity.carries ? 46 : 9 }[entity.kind] ?? 8
    ref.current.position.set(focus.x, entity.position.y + lift, focus.z)
    ref.current.visible = entity.pose?.visible !== false
  })
  return (
    <group ref={ref}>
      <Html center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`pin ${selected ? 'selected' : ''}`} data-pin={entity.id}>
          <StatusIcon kind={status.kind} size={11} />
          <span>{shortLabel(entity)}</span>
        </div>
      </Html>
    </group>
  )
}

// ---------- camera rig ----------
export const cameraState = { yaw: 0, pitch: 0, distance: 0 }

function CameraRig() {
  const { camera, gl, size } = useThree()
  const rig = useMemo(() => {
    const overview = SITE_BY_ID[getUi().siteId].overview
    return {
      target: new THREE.Vector3(...overview.target),
      yaw: overview.yaw,
      pitch: overview.pitch,
      distance: overview.distance,
      goal: { target: new THREE.Vector3(...overview.target), yaw: overview.yaw, pitch: overview.pitch, distance: overview.distance },
      followId: null,
      speed: 3,
    }
  }, [])

  useEffect(() => {
    const element = gl.domElement
    let drag = null
    const down = (event) => {
      drag = { button: event.button, x: event.clientX, y: event.clientY }
    }
    const move = (event) => {
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      if (drag.button === 0) {
        rig.goal.yaw -= dx * 0.0045
        rig.goal.pitch = Math.min(1.45, Math.max(0.08, rig.goal.pitch + dy * 0.0035))
      } else {
        const scale = rig.distance * 0.0012
        const right = new THREE.Vector3(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw))
        const forward = new THREE.Vector3(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw))
        rig.goal.target.addScaledVector(right, -dx * scale).addScaledVector(forward, dy * scale)
        rig.followId = null
        if (getUi().followId) setUi({ followId: null })
      }
    }
    const up = () => {
      drag = null
    }
    const wheel = (event) => {
      event.preventDefault()
      rig.goal.distance = Math.min(1500, Math.max(25, rig.goal.distance * Math.exp(event.deltaY * 0.0012)))
    }
    const menu = (event) => event.preventDefault()
    element.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('contextmenu', menu)
    return () => {
      element.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('contextmenu', menu)
    }
  }, [gl, rig])

  useEffect(() => {
    window.tideline = {
      world,
      ui: getUi,
      screenOf(id, heightOffset = null) {
        const entity = findEntity(id)
        if (!entity) return null
        const focus = entityFocus(entity)
        const point = new THREE.Vector3(focus.x, heightOffset === null ? focus.y : entity.position.y + heightOffset, focus.z).project(camera)
        return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height, visible: point.z < 1 }
      },
      camera: () => ({ yaw: rig.yaw, pitch: rig.pitch, distance: rig.distance, target: rig.target.toArray() }),
      look: (target, yaw, pitch, distance) => cameraCommands.push({ type: 'look', target, yaw, pitch, distance }),
      switchSite: (siteId) => setUi({ siteId, selectedId: null, followId: null }),
      skip: (seconds) => {
        for (let step = 0; step < seconds * 30; step++) advanceWorld(1 / 30)
      },
    }
  }, [camera, size])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    while (cameraCommands.length) {
      const command = cameraCommands.shift()
      if (command.type === 'overview') {
        const overview = SITE_BY_ID[getUi().siteId].overview
        rig.followId = null
        rig.goal.target.set(...overview.target)
        rig.goal.yaw = overview.yaw
        rig.goal.pitch = overview.pitch
        rig.goal.distance = overview.distance
        if (command.instant) {
          rig.target.copy(rig.goal.target)
          rig.yaw = rig.goal.yaw
          rig.pitch = rig.goal.pitch
          rig.distance = rig.goal.distance
        }
      } else if (command.type === 'fly' || command.type === 'follow') {
        const entity = findEntity(command.id)
        if (!entity) continue
        rig.followId = command.id
        const focus = entityFocus(entity)
        if (command.type === 'fly' || rig.goal.distance > focus.distance * 1.8) rig.goal.distance = focus.distance
        rig.goal.pitch = Math.min(0.75, Math.max(0.28, rig.goal.pitch))
      } else if (command.type === 'look') {
        // Verification shots only: jump straight to a framing.
        rig.followId = null
        rig.goal.target.set(...command.target)
        rig.target.set(...command.target)
        rig.goal.yaw = rig.yaw = command.yaw
        rig.goal.pitch = rig.pitch = command.pitch
        rig.goal.distance = rig.distance = command.distance
      } else if (command.type === 'zoom') {
        rig.goal.distance = Math.min(1500, Math.max(25, rig.goal.distance * command.factor))
      } else if (command.type === 'rotate') {
        rig.goal.yaw += command.angle
      } else if (command.type === 'pitch') {
        rig.goal.pitch = command.value
      }
    }
    const followId = getUi().followId
    if (!followId) rig.followId = null
    if (rig.followId) {
      const entity = findEntity(rig.followId)
      if (entity) {
        const focus = entityFocus(entity)
        rig.goal.target.set(focus.x, focus.y, focus.z)
      }
    }
    const blend = 1 - Math.exp(-dt * (rig.followId ? 5 : 2.6))
    const turn = 1 - Math.exp(-dt * 3.2)
    rig.target.lerp(rig.goal.target, blend)
    rig.yaw += (rig.goal.yaw - rig.yaw) * turn
    rig.pitch += (rig.goal.pitch - rig.pitch) * turn
    rig.distance += (rig.goal.distance - rig.distance) * turn
    const horizontal = Math.cos(rig.pitch) * rig.distance
    camera.position.set(rig.target.x + Math.sin(rig.yaw) * horizontal, rig.target.y + Math.sin(rig.pitch) * rig.distance, rig.target.z + Math.cos(rig.yaw) * horizontal)
    camera.position.y = Math.max(GROUND + 6, camera.position.y)
    camera.lookAt(rig.target)
    cameraState.yaw = rig.yaw
    cameraState.pitch = rig.pitch
    cameraState.distance = rig.distance
    cameraState.target = rig.target
  })
  return null
}

// ---------- lights ----------
function Lights() {
  const lightRef = useRef()
  const { scene } = useThree()
  useEffect(() => {
    scene.add(lightRef.current.target)
  }, [scene])
  useFrame(() => {
    const light = lightRef.current
    const target = cameraState.target ?? new THREE.Vector3()
    const reach = Math.min(520, Math.max(120, cameraState.distance * 0.75))
    light.target.position.set(target.x, 0, target.z)
    light.position.set(target.x - 420, 360, target.z + 260)
    const shadowCamera = light.shadow.camera
    if (shadowCamera.right !== reach) {
      shadowCamera.left = -reach
      shadowCamera.right = reach
      shadowCamera.top = reach
      shadowCamera.bottom = -reach
      shadowCamera.updateProjectionMatrix()
    }
    const blink = Math.sin(world.time * 3.2) > 0.2 ? 2.2 : 0.25
    for (const material of glowMaterials) {
      if (material.userData.glow === 'glow_red') material.emissiveIntensity = blink
    }
  })
  return (
    <>
      <hemisphereLight args={['#ffffff', '#cfcfca', 1.35]} />
      <directionalLight
        ref={lightRef}
        intensity={2.1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-near={10}
        shadow-camera-far={1600}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-radius={6}
        shadow-intensity={0.62}
      />
    </>
  )
}

// ---------- world ----------
function SiteContent({ siteId }) {
  const library = useLibrary()
  const site = SITE_BY_ID[siteId]
  const state = world.sites[siteId]
  const animatedStatics = site.statics.filter((item) => ANIMATED_STATICS.has(item.model))
  const staticEntities = state.entities.filter((entity) => entity.static)
  const movers = state.entities.filter((entity) => !entity.static)
  const pinned = state.entities.filter((entity) => PIN_KINDS.has(entity.kind))
  return (
    <group>
      <Terrain site={site} />
      <StaticInstances library={library} site={site} />
      {animatedStatics.map((item, index) => <AnimatedStatic key={index} library={library} item={item} siteId={siteId} />)}
      {staticEntities.map((entity) => <StaticProxy key={entity.id} entity={entity} />)}
      {movers.map((entity) => (entity.kind === 'booster' || entity.kind === 'ship' ? <Vehicle key={entity.id} library={library} entity={entity} /> : <Wheeled key={entity.id} library={library} entity={entity} />))}
      {pinned.map((entity) => <Pin key={entity.id} entity={entity} />)}
    </group>
  )
}

function Simulation() {
  useFrame((_, delta) => advanceWorld(Math.min(delta, 1 / 20)))
  return null
}

export function World() {
  const { siteId } = useUi()
  return (
    <>
      <Simulation />
      <CameraRig />
      <Lights />
      <SiteContent key={siteId} siteId={siteId} />
      <Particles />
      <SelectionRing />
      <mesh visible={false} />
    </>
  )
}

export function onMissed(event) {
  if (event.type === 'click' && event.delta <= 6) clearSelection()
}
