// One hospital's world: grounds, the cut-away emergency department, bays, beds and patients,
// people, ambulances, the helicopter and imaging. Everything that moves reads the sim each frame.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { TRIAGE } from '../data.js'
import { byId, patientPose } from '../sim/er.js'
import { useUiValue } from '../store.js'
import { bedLampColor } from '../status.js'
import { findParts, flatClone, InstancedModel, mergeByColor, ownMaterial } from './assets.jsx'
import { pointerHandlers } from './Markers.jsx'
import { hatchTexture, jointTexture, PALETTE, standard, textTexture } from './materials.js'

const FADE_SECONDS = 0.25
const BACKREST_SIGN = 1

// ---------- grounds ----------

function Slab({ minX, maxX, minZ, maxZ, y = 0.01, material }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, y, (minZ + maxZ) / 2]} receiveShadow material={material}>
      <planeGeometry args={[maxX - minX, maxZ - minZ]} />
    </mesh>
  )
}

function pavingMaterial(width, depth) {
  return standard(PALETTE.paving, { roughness: 0.92, map: jointTexture(PALETTE.paving, PALETTE.pavingLine, 4, width / 6, depth / 6) })
}

function Grounds({ state, nodes }) {
  const layout = state.layout
  const { halfWidth, halfDepth, driveX, roadZ, ambulanceBay, helipad, walkIn, bounds } = layout
  const statics = useMemo(() => {
    const items = { road_tile: [], parking_mark: [], tree_a: [], tree_b: [], tree_c: [], lamp_post: [], bollard: [], shrub: [], bench: [] }
    const roadStart = Math.floor((bounds.minX - 40) / 8) * 8
    for (let x = roadStart; x < bounds.maxX + 60; x += 8) items.road_tile.push({ position: [x + 4, 0, roadZ], rotation: Math.PI / 2 })
    for (let z = roadZ - 8; z > ambulanceBay.doorZ - 14; z -= 8) items.road_tile.push({ position: [driveX, 0, z], rotation: 0 })
    for (let index = 0; index < 7; index++) {
      items.parking_mark.push({ position: [-halfWidth - 5 + index * 3.4, 0.01, halfDepth + 9], rotation: 0 })
    }
    let seed = state.site.seed * 31
    const jitter = (amount) => {
      seed = (seed * 16807) % 2147483647
      return (seed / 2147483647 - 0.5) * amount
    }
    const keepClear = (x, z) => {
      if (Math.abs(z - roadZ) < 7) return false
      if (Math.abs(x - driveX) < 7 && z > ambulanceBay.doorZ - 16 && z < roadZ) return false
      if (helipad && Math.hypot(x - helipad.x, z - helipad.z) < 15) return false
      if (x > -halfWidth - 3 && x < halfWidth + 13 && z > -halfDepth - 3 && z < halfDepth + 3) return false
      if (x > -halfWidth - 14 && x < -halfWidth && Math.abs(z - layout.wardDoor.outside.z) < 5) return false
      return true
    }
    const kinds = ['tree_a', 'tree_b', 'tree_c']
    for (let x = bounds.minX - 6; x <= bounds.maxX + 6; x += 9) {
      for (const z of [bounds.minZ - 4, bounds.maxZ + 3]) {
        const point = { x: x + jitter(4), z: z + jitter(4) }
        if (keepClear(point.x, point.z)) items[kinds[items.tree_a.length % 3]].push({ position: [point.x, 0, point.z], rotation: jitter(6), scale: 0.9 + jitter(0.3) })
      }
    }
    for (let z = bounds.minZ + 4; z < bounds.maxZ; z += 9) {
      for (const x of [bounds.minX - 4, bounds.maxX + 5]) {
        const point = { x: x + jitter(4), z: z + jitter(4) }
        if (keepClear(point.x, point.z)) items[kinds[(items.tree_b.length + 1) % 3]].push({ position: [point.x, 0, point.z], rotation: jitter(6), scale: 0.9 + jitter(0.3) })
      }
    }
    // A few trees between the car park and the department, and along the west lawn.
    ;[
      [-halfWidth - 7, halfDepth - 4],
      [-halfWidth - 6.5, -halfDepth + 2],
      [-halfWidth - 7, halfDepth + 15],
      [walkIn.inside.x + 9, halfDepth + 7],
      [halfWidth - 2, halfDepth + 7],
    ].forEach(([x, z], index) => items[kinds[index % 3]].push({ position: [x, 0, z], rotation: index, scale: 0.95 }))
    for (let x = -halfWidth + 2; x < halfWidth - 1; x += 3.2) {
      if (Math.abs(x - walkIn.inside.x) < 5) continue
      items.shrub.push({ position: [x, 0, halfDepth + 1.0], rotation: 0 })
    }
    for (let z = bounds.minZ + 6; z < roadZ - 6; z += 14) items.lamp_post.push({ position: [driveX - 4.8, 0, z], rotation: Math.PI / 2 })
    for (let x = bounds.minX; x < bounds.maxX + 20; x += 22) items.lamp_post.push({ position: [x, 0, roadZ - 5], rotation: 0 })
    for (const offset of [-2.6, -1.3, 1.3, 2.6]) items.bollard.push({ position: [walkIn.inside.x + offset, 0, halfDepth + 5.6], rotation: 0 })
    items.bench.push({ position: [walkIn.inside.x - 5.5, 0, halfDepth + 3.2], rotation: 0 }, { position: [walkIn.inside.x + 6, 0, halfDepth + 3.2], rotation: 0 })
    return items
  }, [state, bounds, driveX, roadZ, halfWidth, halfDepth, ambulanceBay, helipad, walkIn, layout])
  const plazaWidth = halfWidth * 2 + 4
  const plazaDepth = halfDepth * 2 + 4
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.center.x, -0.02, layout.center.z]} receiveShadow material={standard(PALETTE.grass, { roughness: 1 })}>
        <planeGeometry args={[900, 900]} />
      </mesh>
      <Slab minX={-halfWidth - 2} maxX={halfWidth + 2} minZ={-halfDepth - 2} maxZ={halfDepth + 2} y={0.004} material={pavingMaterial(plazaWidth, plazaDepth)} />
      <Slab minX={walkIn.inside.x - 3.6} maxX={walkIn.inside.x + 3.6} minZ={halfDepth} maxZ={roadZ - 3.9} y={0.006} material={pavingMaterial(7.2, roadZ - halfDepth)} />
      <Slab minX={-halfWidth - 8} maxX={walkIn.inside.x - 4.2} minZ={halfDepth + 4.5} maxZ={roadZ - 4.2} y={0.006} material={standard(PALETTE.asphalt, { roughness: 0.95 })} />
      <Slab minX={halfWidth + 1.5} maxX={driveX + 4} minZ={ambulanceBay.doorZ - 12} maxZ={roadZ - 4} y={0.008} material={standard(PALETTE.asphalt, { roughness: 0.95 })} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ambulanceBay.parkX - 0.2, 0.02, ambulanceBay.doorZ]} receiveShadow>
        <planeGeometry args={[8.6, 3.6]} />
        <meshStandardMaterial map={hatchTexture(PALETTE.hatch)} transparent roughness={0.8} />
      </mesh>
      {helipad && (
        <>
          <Slab minX={helipad.x - 12.5} maxX={helipad.x + 12.5} minZ={helipad.z - 11} maxZ={helipad.z + 11} y={0.006} material={pavingMaterial(25, 22)} />
          <Slab minX={helipad.x - 14} maxX={helipad.x - 11} minZ={helipad.z + 1} maxZ={ambulanceBay.doorZ - 4} y={0.007} material={pavingMaterial(3, 12)} />
          <Helipad node={nodes.helipad} position={[helipad.x, 0, helipad.z]} />
        </>
      )}
      {Object.entries(statics).map(([name, items]) => (
        <InstancedModel key={name} node={nodes[name]} items={items} />
      ))}
    </group>
  )
}

// The pad keeps its own marking but in the network's blue, not a red cross.
function Helipad({ node, position }) {
  const object = useMemo(() => {
    const clone = node.clone(true)
    const blue = new THREE.MeshStandardMaterial({ color: '#2f6fe4', roughness: 0.7 })
    clone.traverse((child) => {
      if (child.isMesh && child.material.name === 'line_red') child.material = blue
    })
    return clone
  }, [node])
  const windsock = useMemo(() => findParts(object, 'helipad_windsock')[0], [object])
  useFrame(({ clock }) => {
    if (windsock) windsock.rotation.y = 0.6 + Math.sin(clock.elapsedTime * 0.4) * 0.25
  })
  return <primitive object={object} position={position} />
}

// ---------- the department building ----------

function Building({ state, nodes }) {
  const layout = state.layout
  const { halfWidth, halfDepth, walkIn, wardDoor, ambulanceBay, rooms } = layout
  const floorNode = state.site.floor
  const accentNode = floorNode === 'floor_tile' ? 'floor_tile_alt' : 'floor_tile'
  const statics = useMemo(() => {
    const items = { floor_tile: [], floor_tile_alt: [], wall_full: [], wall_window: [], wall_low: [], wall_corner: [], seats_row4: [], triage_desk: [], checkin_kiosk: [], lab_bench: [], crash_cart: [], iv_pole: [], bed_ward: [], ct_console: [], lead_screen: [], workstation_cart: [], side_table: [], monitor_stand: [] }
    for (let x = -halfWidth + 2; x < halfWidth; x += 4) {
      for (let z = -halfDepth + 2; z < halfDepth; z += 4) {
        const corridorRow = Math.abs(z - (-halfDepth + 6)) < 0.1 || Math.abs(z - (-halfDepth + 14)) < 0.1
        items[corridorRow ? accentNode : floorNode].push({ position: [x, 0, z], rotation: 0 })
      }
    }
    let count = 0
    for (let x = -halfWidth + 2; x < halfWidth; x += 4) {
      items[count++ % 3 === 1 ? 'wall_window' : 'wall_full'].push({ position: [x, 0, -halfDepth], rotation: Math.PI })
      if (Math.abs(x - walkIn.inside.x) > 3) items.wall_low.push({ position: [x, 0, halfDepth], rotation: 0 })
    }
    for (let z = -halfDepth + 2; z < halfDepth; z += 4) {
      if (Math.abs(z - wardDoor.inside.z) > 1) items[count++ % 3 === 1 ? 'wall_window' : 'wall_full'].push({ position: [-halfWidth, 0, z], rotation: -Math.PI / 2 })
      if (Math.abs(z - ambulanceBay.doorZ) > 1) items.wall_low.push({ position: [halfWidth, 0, z], rotation: Math.PI / 2 })
    }
    for (const x of [-halfWidth, halfWidth]) for (const z of [-halfDepth, halfDepth]) items.wall_corner.push({ position: [x, 0, z], rotation: 0 })
    for (const z of [walkIn.inside.z + 1.8]) for (const x of [walkIn.inside.x - 3.75, walkIn.inside.x + 3.75]) items.wall_corner.push({ position: [x, 0, z], rotation: 0, scale: [1, 0.29, 1] })
    // Partitions: lab, and the imaging rooms off the front corridor.
    items.wall_low.push({ position: [-halfWidth + 8, 0, -halfDepth + 2], rotation: Math.PI / 2 })
    const ct = rooms.find((room) => room.kind === 'ct')
    const xray = rooms.find((room) => room.kind === 'xray')
    const between = (ct.x + xray.x) / 2 + 0.4
    for (const z of [halfDepth - 2, halfDepth - 6, halfDepth - 10]) {
      items.wall_low.push({ position: [layout.imagingLeft, 0, z], rotation: Math.PI / 2 }, { position: [between, 0, z], rotation: Math.PI / 2 })
    }
    layout.benchXs.forEach((x) => layout.seatRows.forEach((z) => items.seats_row4.push({ position: [x, 0, z], rotation: Math.PI })))
    layout.seatRows.forEach((z) => items.side_table.push({ position: [-halfWidth + 0.55, 0, z], rotation: 0 }))
    layout.triageDesks.forEach((desk) => items.triage_desk.push({ position: [desk.x, 0, desk.z], rotation: 0 }))
    items.checkin_kiosk.push({ position: [walkIn.kiosk.x + 0.62, 0, walkIn.kiosk.z], rotation: -Math.PI / 2 })
    const lab = rooms.find((room) => room.kind === 'lab')
    items.lab_bench.push({ position: [lab.x - 1.0, 0, lab.z - 0.6], rotation: 0 }, { position: [-halfWidth + 0.55, 0, -halfDepth + 3.6], rotation: Math.PI / 2 })
    layout.resus.forEach((bay) => items.crash_cart.push({ position: [bay.x - 1.45, 0, bay.z + 3.15], rotation: 0 }))
    layout.cubicles.forEach((bay, index) => {
      if (index % 2 === 0) items.iv_pole.push({ position: [bay.x - 0.85, 0, bay.z + 0.3], rotation: 0.4 })
    })
    items.bed_ward.push({ position: [-halfWidth + 4.6, 0, -halfDepth + 8.6], rotation: Math.PI / 2 }, { position: [-halfWidth + 4.6, 0, -halfDepth + 10.3], rotation: Math.PI / 2 })
    items.ct_console.push({ position: [ct.x + 2.2, 0, halfDepth - 4.2], rotation: 0 })
    items.lead_screen.push({ position: [ct.x + 0.9, 0, halfDepth - 5.2], rotation: 0 })
    items.workstation_cart.push({ position: [layout.nurseStation.x + 3.4, 0, layout.nurseStation.z - 1.9], rotation: 0.3 }, { position: [halfWidth - 1.4, 0, -halfDepth + 9.4], rotation: -0.6 })
    items.monitor_stand.push({ position: [xray.x + 2.2, 0, xray.z + 1.7], rotation: Math.PI })
    return items
  }, [halfWidth, halfDepth, walkIn, wardDoor, ambulanceBay, rooms, layout, floorNode, accentNode])

  const station = useMemo(() => flatClone(nodes.nurses_station), [nodes])
  return (
    <group>
      {Object.entries(statics).map(([name, items]) => (
        <InstancedModel key={name} node={nodes[name]} items={items} />
      ))}
      <Canopy node={nodes.ambulance_canopy} position={[ambulanceBay.canopyX, 0, ambulanceBay.doorZ]} />
      <primitive object={station} position={[layout.nurseStation.x, 0, layout.nurseStation.z]} />
      <SlidingEntrance state={state} node={nodes.entrance_walkin} position={[walkIn.inside.x, 0, halfDepth]} rotation={0} near={{ x: walkIn.inside.x, z: halfDepth + 0.6 }} travel={1.25} />
      <SlidingEntrance state={state} node={nodes.entrance_ambulance} position={[halfWidth, 0, ambulanceBay.doorZ]} rotation={Math.PI / 2} near={{ x: halfWidth + 0.5, z: ambulanceBay.doorZ }} travel={0.9} />
      <WardLink layout={layout} />
      <Sign node={nodes.sign_plate_a} position={[walkIn.inside.x + 6.4, 0, halfDepth + 4.4]} rotation={0} text="Emergency" width={2.5} />
      <Sign node={nodes.sign_plate_b} position={[halfWidth + 2.6, 0, ambulanceBay.doorZ + 6.0]} rotation={Math.PI / 2} text="Ambulances" width={1.7} />
    </group>
  )
}

function Sign({ node, position, rotation, text, width }) {
  const object = useMemo(() => flatClone(node), [node])
  const texture = textTexture(text, { color: '#ffffff', width: 512, height: 112, weight: 650, scale: 0.5 })
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={object} />
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, 2.42, side * 0.095]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[width * 0.86, width * 0.19]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// The ambulance canopy fades to a ghost when the camera comes close, so the bay under it stays readable.
function Canopy({ node, position }) {
  const { object, materials } = useMemo(() => {
    const clone = node.clone(true)
    const own = []
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = child.material.clone()
      child.material.transparent = true
      own.push({ material: child.material, emissiveIntensity: child.material.emissiveIntensity ?? 0 })
    })
    return { object: clone, materials: own }
  }, [node])
  const fade = useRef(1)
  useFrame(({ camera: view }, dt) => {
    const near = view.position.distanceTo(new THREE.Vector3(...position)) < 75
    fade.current = THREE.MathUtils.clamp(fade.current + (near ? -dt * 2 : dt * 2), 0, 1)
    for (const { material, emissiveIntensity } of materials) {
      material.opacity = fade.current
      material.depthWrite = fade.current > 0.9
      // Lamps and glass glow through the fade, so their emission fades with the body.
      material.emissiveIntensity = emissiveIntensity * fade.current
    }
    // Fully faded: hide the whole canopy so nothing is left to glow or bloom.
    object.visible = fade.current > 0.02
  })
  return <primitive object={object} position={position} rotation={[0, Math.PI / 2, 0]} />
}

// The covered link to the ward block: porters taking admitted patients disappear into it.
function WardLink({ layout }) {
  const { halfWidth, wardDoor } = layout
  const length = 11
  const centerX = -halfWidth - length / 2
  return (
    <group position={[centerX, 0, wardDoor.inside.z]}>
      <mesh position={[0, 2.1, 0]} castShadow receiveShadow material={standard(PALETTE.cladding, { roughness: 0.7 })}>
        <boxGeometry args={[length, 4.2, 4.4]} />
      </mesh>
      <mesh position={[0, 4.26, 0]} castShadow material={standard(PALETTE.roof, { roughness: 0.8 })}>
        <boxGeometry args={[length + 0.3, 0.14, 4.7]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 2.4, side * 2.21]} material={standard('#9fb8d6', { roughness: 0.15, metalness: 0.1 })}>
          <boxGeometry args={[length - 1.2, 1.1, 0.02]} />
        </mesh>
      ))}
      <mesh position={[0, 3.55, 2.23]}>
        <planeGeometry args={[3.4, 0.6]} />
        <meshBasicMaterial map={textTexture('To wards', { color: '#ffffff', background: '#2f6fe4', width: 512, height: 96, scale: 0.52 })} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

// Glass doors that slide open when anyone (or any cot) comes close.
function SlidingEntrance({ state, node, position, rotation, near, travel }) {
  const object = useMemo(() => flatClone(node, /_door_[lr]$/), [node])
  const doors = useMemo(() => ['l', 'r'].map((side) => findParts(object, `${node.name}_door_${side}`)[0]).filter(Boolean), [object, node])
  const bases = useMemo(() => doors.map((door) => door.position.x), [doors])
  const open = useRef(0)
  useFrame((_, dt) => {
    const someoneNear = state.people.some((person) => !person.hidden && !person.removed && Math.hypot(person.position.x - near.x, person.position.z - near.z) < 3.4) || state.trolleys.some((trolley) => !trolley.hidden && Math.hypot(trolley.position.x - near.x, trolley.position.z - near.z) < 3.6)
    open.current = THREE.MathUtils.clamp(open.current + (someoneNear ? dt * 1.6 : -dt * 0.9), 0, 1)
    doors.forEach((door, index) => {
      door.position.x = bases[index] + Math.sign(bases[index] || 1) * open.current * travel
    })
  })
  return <primitive object={object} position={position} rotation={[0, rotation, 0]} />
}

// ---------- bays, trolleys and patients ----------

export function useStatusLamp(object, colorOf) {
  const material = useMemo(() => {
    const own = ownMaterial(object, 'status')
    if (own) {
      own.toneMapped = false
      if (own.emissive) own.emissiveIntensity = 2.2
    }
    return own
  }, [object])
  useFrame(() => {
    if (!material) return
    const color = colorOf()
    material.color.set(color)
    material.emissive?.set(color)
  })
}

function Bay({ bed, nodes }) {
  const nodeName = bed.kind === 'resus' ? 'resus_bay' : 'cubicle'
  const object = useMemo(() => flatClone(nodes[nodeName], /_(curtain|status)$/), [nodes, nodeName])
  const curtain = useMemo(() => findParts(object, `${nodeName}_curtain`)[0], [object, nodeName])
  useStatusLamp(object, () => bedLampColor(bed))
  useFrame(() => {
    if (curtain) curtain.scale.x = 0.16 + bed.curtain * 0.4
  })
  return <primitive object={object} position={[bed.x, 0, bed.z]} rotation={[0, bed.bay.rotation, 0]} {...pointerHandlers(bed.id)} />
}

function Trolley({ trolley, nodes, state }) {
  const object = useMemo(() => flatClone(nodes[trolley.model], /_backrest$/), [nodes, trolley.model])
  const backrest = useMemo(() => findParts(object, `${trolley.model}_backrest`)[0], [object, trolley.model])
  const groupRef = useRef()
  useFrame(() => {
    const group = groupRef.current
    group.visible = !trolley.hidden
    group.position.set(trolley.position.x, 0, trolley.position.z)
    group.rotation.y = trolley.heading
    if (backrest) backrest.rotation.x = BACKREST_SIGN * (trolley.patientId ? trolley.backrest : 0)
  })
  const pickId = () => trolley.patientId ?? trolley.homeBedId
  return (
    <group ref={groupRef} onClick={(event) => pointerHandlers(pickId()).onClick(event)} onPointerOver={pointerHandlers('').onPointerOver} onPointerOut={pointerHandlers('').onPointerOut}>
      <primitive object={object} />
    </group>
  )
}

function Patient({ patient, nodes, state }) {
  const object = useMemo(() => {
    const clone = flatClone(nodes[patient.figure], /_(upper|tag)$/)
    const tag = ownMaterial(clone, 'triage')
    if (tag) {
      tag.color.set(TRIAGE[patient.level].color)
      tag.toneMapped = false
      if (tag.emissive) {
        tag.emissive.set(TRIAGE[patient.level].color)
        tag.emissiveIntensity = 0.6
      }
    }
    return clone
  }, [nodes, patient.figure, patient.level])
  const upper = useMemo(() => findParts(object, `${patient.figure}_upper`)[0], [object, patient.figure])
  const groupRef = useRef()
  useFrame(() => {
    const pose = patientPose(state, patient)
    const group = groupRef.current
    group.visible = Boolean(pose?.onFigure) && !patient.gone
    if (!group.visible) return
    group.position.set(pose.x, pose.y, pose.z)
    group.rotation.y = pose.heading
    if (upper) upper.rotation.x = BACKREST_SIGN * (pose.backrest ?? 0)
  })
  return (
    <group ref={groupRef} {...pointerHandlers(patient.id)}>
      <primitive object={object} />
    </group>
  )
}

function Patients({ state, nodes }) {
  const ids = useUiValue(() => state.patients.filter((patient) => !patient.gone).map((patient) => patient.id).join(','))
  return ids
    .split(',')
    .filter(Boolean)
    .map((id) => {
      const patient = byId(state.patients, id)
      return patient ? <Patient key={id} patient={patient} nodes={nodes} state={state} /> : null
    })
}

// ---------- people ----------

const bonePartCache = new Map()

// A person is rigid parts hung on bones; the parts on each bone are merged into one mesh.
function mergeBoneParts(root) {
  const holders = []
  root.traverse((object) => {
    if (!object.isMesh && object.children.filter((child) => child.isMesh).length > 1) holders.push(object)
  })
  for (const bone of holders) {
    const meshes = bone.children.filter((child) => child.isMesh && !child.isSkinnedMesh)
    if (meshes.length < 2) continue
    const key = meshes.map((mesh) => mesh.geometry.uuid).join(',')
    if (!bonePartCache.has(key)) {
      const parts = meshes.map((mesh) => {
        mesh.updateMatrix()
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix)
        return { geometry, material: mesh.material, castShadow: true, matrix: new THREE.Matrix4() }
      })
      bonePartCache.set(key, mergeByColor(parts))
    }
    meshes.forEach((mesh) => bone.remove(mesh))
    for (const part of bonePartCache.get(key)) bone.add(new THREE.Mesh(part.geometry, part.material))
  }
}

function Person({ person, nodes, clips }) {
  const rootName = person.model
  const { object, mixer, actions } = useMemo(() => {
    const clone = cloneSkeleton(nodes[rootName])
    const animationMixer = new THREE.AnimationMixer(clone)
    const byName = {}
    for (const clip of clips) {
      if (clip.name.startsWith(`${rootName}_`)) byName[clip.name.slice(rootName.length + 1)] = animationMixer.clipAction(clip)
    }
    mergeBoneParts(clone)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
      }
    })
    return { object: clone, mixer: animationMixer, actions: byName }
  }, [nodes, clips, rootName])
  const current = useRef(null)
  const phase = useRef((person.id.charCodeAt(person.id.length - 1) % 10) / 10)
  useEffect(() => () => mixer.stopAllAction(), [mixer])
  useFrame((_, dt) => {
    object.visible = !person.hidden && !person.removed
    if (!object.visible) return
    const action = actions[person.clip] ?? actions.idle
    if (current.current !== action) {
      action.reset()
      action.time = phase.current * action.getClip().duration
      action.fadeIn(current.current ? FADE_SECONDS : 0).play()
      if (current.current) current.current.fadeOut(FADE_SECONDS)
      current.current = action
    }
    action.timeScale = person.clipSpeed ?? 1
    mixer.update(Math.min(dt, 1 / 15))
    object.position.set(person.position.x, 0, person.position.z)
    const difference = Math.atan2(Math.sin(person.heading - object.rotation.y), Math.cos(person.heading - object.rotation.y))
    object.rotation.y += difference * Math.min(1, dt * 9)
  })
  return <primitive object={object} {...pointerHandlers(person.patientId ?? person.id)} />
}

function People({ state, nodes, clips }) {
  const ids = useUiValue(() => state.people.filter((person) => !person.removed).map((person) => person.id).join(','))
  return ids
    .split(',')
    .filter(Boolean)
    .map((id) => {
      const person = byId(state.people, id)
      return person ? <Person key={id} person={person} nodes={nodes} clips={clips} /> : null
    })
}

// ---------- vehicles ----------

function glowMaterials(root) {
  const materials = []
  root.traverse((child) => {
    if (child.isMesh && child.material.name.startsWith('glow_')) {
      child.material = child.material.clone()
      child.material.userData.base = child.material.emissiveIntensity ?? 1
      materials.push(child.material)
    }
  })
  return materials
}

function Ambulance({ vehicle, nodes, state }) {
  const parts = useMemo(() => {
    const object = flatClone(nodes[vehicle.model], /_(door_rear_l|door_rear_r|wheel_fl|wheel_fr|wheel_rl|wheel_rr|lightbar|cab_lightbar)$/)
    const part = (suffix) => findParts(object, `${vehicle.model}_${suffix}`)[0]
    const lights = [part('lightbar'), part('cab_lightbar')].filter(Boolean).flatMap(glowMaterials)
    return { object, doorLeft: part('door_rear_l'), doorRight: part('door_rear_r'), wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(part).filter(Boolean), lights }
  }, [nodes, vehicle.model])
  const groupRef = useRef()
  useFrame(({ clock }) => {
    const group = groupRef.current
    group.visible = vehicle.phase !== 'away'
    if (!group.visible) return
    group.position.set(vehicle.position.x, 0, vehicle.position.z)
    group.rotation.y = vehicle.heading
    const swing = vehicle.doors * 1.75
    if (parts.doorLeft) parts.doorLeft.rotation.y = swing
    if (parts.doorRight) parts.doorRight.rotation.y = -swing
    const spin = (vehicle.odometer ?? 0) / 0.4
    parts.wheels.forEach((wheel) => (wheel.rotation.x = vehicle.phase === 'reversing' ? spin : spin))
    const patient = vehicle.patientId && byId(state.patients, vehicle.patientId)
    const flashing = patient && patient.level <= 2 && (vehicle.phase === 'arriving' || vehicle.phase === 'reversing')
    const blink = Math.sin(clock.elapsedTime * 14) > 0 ? 1 : 0.15
    parts.lights.forEach((material, index) => {
      if ('emissiveIntensity' in material) material.emissiveIntensity = flashing ? material.userData.base * (index % 2 ? blink : 1.15 - blink) * 1.4 : material.userData.base * 0.18
    })
  })
  return (
    <group ref={groupRef} {...pointerHandlers(vehicle.id)}>
      <primitive object={parts.object} />
    </group>
  )
}

function Helicopter({ heli, nodes }) {
  const parts = useMemo(() => {
    const object = flatClone(nodes[heli.model], /_(rotor_main|rotor_tail|door_clam_l|door_clam_r)$/)
    const part = (suffix) => findParts(object, `${heli.model}_${suffix}`)[0]
    return { object, main: part('rotor_main'), tail: part('rotor_tail'), doorLeft: part('door_clam_l'), doorRight: part('door_clam_r') }
  }, [nodes, heli.model])
  const groupRef = useRef()
  useFrame(() => {
    const group = groupRef.current
    group.visible = heli.phase !== 'away'
    if (!group.visible) return
    group.position.set(heli.position.x, heli.position.y, heli.position.z)
    group.rotation.y = heli.heading
    const airborne = heli.position.y > 0.3
    group.rotation.x = airborne && heli.phase === 'approach' ? 0.08 : 0
    if (parts.main) parts.main.rotation.y = heli.rotorAngle
    if (parts.tail) parts.tail.rotation.x = heli.rotorAngle * 2.4
    if (parts.doorLeft) parts.doorLeft.rotation.y = -heli.doors * 1.6
    if (parts.doorRight) parts.doorRight.rotation.y = heli.doors * 1.6
  })
  return (
    <group ref={groupRef} {...pointerHandlers(heli.id)}>
      <primitive object={parts.object} />
    </group>
  )
}

// ---------- imaging and lab ----------

function CtRoom({ room, nodes }) {
  const object = useMemo(() => flatClone(nodes.ct_scanner, /_(table|status)$/), [nodes])
  const table = useMemo(() => findParts(object, 'ct_scanner_table')[0], [object])
  const tableZ = useMemo(() => table?.position.z ?? 0, [table])
  useStatusLamp(object, () => (room.phase === 'scanning' ? '#4aa3ff' : room.reservedBy ? '#f5a524' : '#30c27a'))
  useFrame(() => {
    if (table) table.position.z = tableZ - room.table * 1.25
  })
  return <primitive object={object} position={[room.x, 0, room.z]} rotation={[0, room.heading, 0]} {...pointerHandlers(room.id)} />
}

function XrayRoom({ room, nodes }) {
  const object = useMemo(() => flatClone(nodes.xray_room, /_(column|tube|detector)$/), [nodes])
  const column = useMemo(() => findParts(object, 'xray_room_column')[0], [object])
  const tube = useMemo(() => findParts(object, 'xray_room_tube')[0], [object])
  const base = useMemo(() => ({ column: column?.position.z ?? 0, tube: tube?.position.z ?? 0 }), [column, tube])
  useFrame(() => {
    const travel = room.phase === 'scanning' ? -0.6 * room.table : 0
    if (column) column.position.z = base.column + travel
    if (tube) tube.position.z = base.tube + travel
  })
  return <primitive object={object} position={[room.x, 0, room.z]} rotation={[0, room.heading, 0]} {...pointerHandlers(room.id)} />
}

function Lab({ room, nodes }) {
  const object = useMemo(() => flatClone(nodes.lab_analyzer, /_rotor$/), [nodes])
  const rotor = useMemo(() => findParts(object, 'lab_analyzer_rotor')[0], [object])
  useFrame(() => {
    if (rotor) rotor.rotation.y = room.rotor ?? 0
  })
  return <primitive object={object} position={[room.x + 1.9, 0, room.z - 0.65]} {...pointerHandlers(room.id)} />
}

// ---------- the whole site ----------

export function Hospital({ state, nodes, clips }) {
  const ct = state.rooms.find((room) => room.kind === 'ct')
  const xray = state.rooms.find((room) => room.kind === 'xray')
  const lab = state.rooms.find((room) => room.kind === 'lab')
  return (
    <group>
      <Grounds state={state} nodes={nodes} />
      <Building state={state} nodes={nodes} />
      {state.beds.map((bed) => (
        <Bay key={bed.id} bed={bed} nodes={nodes} />
      ))}
      {state.trolleys.map((trolley) => (
        <Trolley key={trolley.id} trolley={trolley} nodes={nodes} state={state} />
      ))}
      <Patients state={state} nodes={nodes} />
      <People state={state} nodes={nodes} clips={clips} />
      {state.vehicles.map((vehicle) => (
        <Ambulance key={vehicle.id} vehicle={vehicle} nodes={nodes} state={state} />
      ))}
      {state.helis.map((heli) => (
        <Helicopter key={heli.id} heli={heli} nodes={nodes} />
      ))}
      <CtRoom room={ct} nodes={nodes} />
      <XrayRoom room={xray} nodes={nodes} />
      <Lab room={lab} nodes={nodes} />
    </group>
  )
}
