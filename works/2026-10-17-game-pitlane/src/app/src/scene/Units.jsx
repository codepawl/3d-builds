// Everything that moves or changes state: cars, crews, mechanics, marshals, jacks, release lights, flag panels,
// the safety car, plus selection rings and pins. All of it is driven from the simulation state every frame.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TEAMS, OUR_TEAM } from '../data.js'
import { findEntity, selectEntity, useUiValue } from '../store.js'
import { clipsFor, findChild, useAssets, useClone } from './assets.jsx'
import { surfaces } from './materials.js'

const SABLE_RECOLOR = (name) => (name.startsWith('ostrava_primary') ? '#e8b81c' : name.startsWith('ostrava_secondary') ? '#2b2f36' : null)
const recolorFor = (person) => (person.recolor ? SABLE_RECOLOR : null)

const hover = {
  onPointerOver: (event) => {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
  },
  onPointerOut: () => {
    document.body.style.cursor = ''
  },
}

// Bakes every mesh under a rigid node into one mesh per material, so a car body is a handful of draw calls.
function mergeStaticMeshes(node) {
  if (!node) return
  node.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(node.matrixWorld).invert()
  const byMaterial = new Map()
  const meshes = []
  node.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld))
    for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key)
    if (!geometry.index) geometry.setIndex([...Array(geometry.attributes.position.count).keys()])
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, [])
    byMaterial.get(mesh.material).push(geometry)
  }
  const merged = []
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries)
    if (!geometry) return
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    merged.push(mesh)
  }
  for (const mesh of meshes) if (mesh !== node) mesh.removeFromParent()
  for (const mesh of merged) node.add(mesh)
  // The node itself may have been a mesh; it now only groups the merged meshes.
  if (node.isMesh) node.geometry = new THREE.BufferGeometry()
}

function Car({ car }) {
  const assets = useAssets()
  const root = useClone(car.model)
  const groupRef = useRef()
  useMemo(() => mergeStaticMeshes(root.getObjectByName(`${car.model}_body`)), [root, car.model])
  const parts = useMemo(() => {
    const prefix = car.model
    const wheels = ['fl', 'fr', 'rl', 'rr'].map((corner) => {
      const wheel = root.getObjectByName(`${prefix}_wheel_${corner}`)
      const bands = []
      wheel.traverse((object) => {
        if (object.isMesh && object.material.name.startsWith('compound_')) bands.push(object)
      })
      return { wheel, baseX: wheel.rotation.x, bands }
    })
    return {
      wheels,
      steer: ['fl', 'fr'].map((corner) => root.getObjectByName(`${prefix}_steer_${corner}`)),
      drs: root.getObjectByName(`${prefix}_drs_flap`),
      drsBase: root.getObjectByName(`${prefix}_drs_flap`)?.rotation.x ?? 0,
      compound: null,
    }
  }, [root, car.model])
  useFrame(() => {
    const group = groupRef.current
    group.position.set(car.position.x, car.lift, car.position.z)
    group.rotation.y = car.heading
    for (const { wheel, baseX } of parts.wheels) {
      wheel.rotation.x = baseX + car.wheelSpin
      wheel.visible = !car.wheelsOff
    }
    for (const steer of parts.steer) steer.rotation.y = car.steer
    if (parts.drs) parts.drs.rotation.x = parts.drsBase + (car.drs ? -0.3 : 0)
    if (parts.compound !== car.compound) {
      parts.compound = car.compound
      const material = assets.materials[`compound_${car.compound}`]
      if (material) for (const { bands } of parts.wheels) for (const band of bands) band.material = material
    }
  })
  const ours = car.team === OUR_TEAM
  return (
    <group ref={groupRef} onClick={(event) => selectEntity(event, car.id)} {...hover}>
      <primitive object={root} />
      <Html position={[0, 2.3, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div className={`pin ${ours ? 'pin-ours' : ''}`} style={{ '--team': TEAMS[car.team].color }}>
          <span className="pin-number">{car.number}</span>
          <span className="pin-position">P{car.racePosition}</span>
        </div>
      </Html>
    </group>
  )
}

function makeTyres(assets, parent) {
  // One tyre per compound hung on a grip anchor; the person shows the one they carry.
  const result = {}
  for (const compound of ['soft', 'medium', 'hard', 'inter', 'wet']) {
    const tyre = assets.nodes[`tyre_${compound}`].clone(true)
    tyre.position.set(0, -0.36, 0.02)
    tyre.rotation.set(0, Math.PI / 2, 0)
    tyre.visible = false
    parent.add(tyre)
    result[compound] = tyre
  }
  return result
}


// Path of child indices from a root down to a node, so the same node can be found in a clone.
function childPath(root, node) {
  const path = []
  let current = node
  while (current && current !== root) {
    path.unshift(current.parent.children.indexOf(current))
    current = current.parent
  }
  return path
}

const followPath = (root, path) => path.reduce((node, index) => node.children[index], root)

// Everyone wearing the same model is drawn as one InstancedMesh per body part. Each person keeps a bones-only rig
// that the clip poses; every frame the part matrices are copied from the posed bones into the instance buffers.
function Crowd({ model, people, recolor }) {
  const assets = useAssets()
  const template = useClone(model, recolor)
  const parts = useMemo(() => {
    const result = []
    template.updateMatrixWorld(true)
    template.traverse((object) => {
      if (object.isMesh) result.push({ geometry: object.geometry, material: object.material, local: object.matrix.clone(), parentPath: childPath(template, object.parent), meshPath: childPath(template, object) })
    })
    return result
  }, [template])
  const rigs = useMemo(() => {
    const clips = clipsFor(assets, model)
    return people.map((person) => {
      const rig = assets.nodes[model].clone(true)
      rig.position.set(0, 0, 0)
      const parents = parts.map((part) => followPath(rig, part.parentPath))
      const meshes = parts.map((part) => followPath(rig, part.meshPath))
      for (const mesh of meshes) mesh.removeFromParent()
      const grip = findChild(rig, '_grip_R')
      const carryAnchor = findChild(rig, '_grip_carry')
      let gun = null
      if (person.role === 'gun' && grip) {
        gun = assets.nodes.wheel_gun.clone(true)
        gun.position.set(0, 0, 0)
        grip.add(gun)
      }
      const tyres = carryAnchor && (['tyre_on', 'tyre_off'].includes(person.role) || person.runner) ? makeTyres(assets, carryAnchor) : null
      rig.matrixWorldAutoUpdate = false
      return { person, rig, parents, mixer: new THREE.AnimationMixer(rig), clips, active: null, activeName: null, gun, tyres }
    })
  }, [assets, model, people, parts])
  const meshRefs = useRef([])
  useEffect(() => () => rigs.forEach((rig) => rig.mixer.stopAllAction()), [rigs])
  useEffect(() => {
    for (const mesh of meshRefs.current) {
      if (mesh) mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4000)
    }
  }, [parts])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    rigs.forEach((entry, index) => {
      const { person, rig } = entry
      rig.position.set(person.position.x, 0, person.position.z)
      rig.rotation.y = person.heading
      const clipName = entry.clips[person.clip] ? person.clip : 'idle'
      if (entry.activeName !== clipName) {
        entry.mixer.stopAllAction()
        entry.active = entry.mixer.clipAction(entry.clips[clipName])
        entry.active.play()
        entry.activeName = clipName
      }
      entry.active.time = Math.min(person.clipTime, entry.clips[clipName].duration - 0.001)
      entry.mixer.update(0)
      rig.matrixWorldAutoUpdate = true
      rig.updateMatrixWorld(true)
      rig.matrixWorldAutoUpdate = false
      if (entry.gun) entry.gun.visible = person.tool === 'gun'
      if (entry.tyres) for (const [compound, tyre] of Object.entries(entry.tyres)) tyre.visible = person.carry === compound
      parts.forEach((part, partIndex) => {
        const mesh = meshRefs.current[partIndex]
        if (!mesh) return
        matrix.multiplyMatrices(entry.parents[partIndex].matrixWorld, part.local)
        mesh.setMatrixAt(index, matrix)
      })
    })
    for (const mesh of meshRefs.current) if (mesh) mesh.instanceMatrix.needsUpdate = true
  })
  const pick = (event) => {
    const entry = rigs[event.instanceId]
    if (entry) selectEntity(event, entry.person.id)
  }
  return (
    <group>
      {rigs.map((entry) => (
        <primitive key={entry.person.id} object={entry.rig} />
      ))}
      {parts.map((part, index) => (
        <instancedMesh key={index} ref={(mesh) => (meshRefs.current[index] = mesh)} args={[part.geometry, part.material, people.length]} castShadow receiveShadow frustumCulled={false} onClick={pick} {...hover} />
      ))}
    </group>
  )
}

function Crowds({ state }) {
  const groups = useMemo(() => {
    const result = {}
    for (const person of state.people) {
      const key = `${person.model}${person.recolor ? ':recolor' : ''}`
      ;(result[key] ??= { model: person.model, recolor: recolorFor(person), people: [] }).people.push(person)
    }
    return Object.entries(result)
  }, [state])
  return groups.map(([key, group]) => <Crowd key={key} model={group.model} people={group.people} recolor={group.recolor} />)
}

function Gantry({ item, state }) {
  const root = useClone('release_gantry')
  const lamps = useMemo(() => ({ red: findChild(root, '_red'), amber: findChild(root, '_amber'), green: findChild(root, '_green') }), [root])
  const box = state.boxes.find((candidate) => candidate.id === item.boxId)
  useFrame(() => {
    if (lamps.red) lamps.red.visible = box.gantry === 'red'
    if (lamps.green) lamps.green.visible = box.gantry === 'green'
    if (lamps.amber) lamps.amber.visible = box.phase === 'ready'
  })
  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.heading} onClick={(event) => selectEntity(event, item.id)} {...hover}>
      <primitive object={root} />
    </group>
  )
}

function Jack({ item, state }) {
  const root = useClone(item.node)
  const groupRef = useRef()
  const lever = useMemo(() => findChild(root, '_lever'), [root])
  const box = state.boxes.find((candidate) => candidate.id === item.boxId)
  const operator = state.people.find((person) => person.boxId === box.id && person.role === (item.end === 'front' ? 'jack_front' : 'jack_rear'))
  useFrame(() => {
    const car = box.carId && state.cars.find((candidate) => candidate.id === box.carId)
    const lift = car && box.phase === 'stop' ? car.lift / 0.075 : 0
    if (lever) lever.rotation.x = lift * 0.12
    const group = groupRef.current
    // The front jack is pulled clear by its operator before the release, so it follows them while out in the box.
    const out = operator && (box.phase === 'stop' || box.phase === 'released' || box.phase === 'ready')
    if (out && item.end === 'front') group.position.set(operator.position.x - 1.95, 0, operator.position.z)
    else group.position.set(item.x, 0, item.z)
  })
  return (
    <group ref={groupRef} rotation-y={item.heading} onClick={(event) => selectEntity(event, item.id)} {...hover}>
      <primitive object={root} />
    </group>
  )
}

function MarshalPost({ item }) {
  const root = useClone('marshal_post')
  const panel = useMemo(() => {
    const object = findChild(root, '_panel')
    const meshes = []
    object?.traverse((child) => {
      if (child.isMesh) meshes.push(child)
    })
    const material = meshes[0]?.material.clone()
    for (const mesh of meshes) mesh.material = material
    return material
  }, [root])
  useFrame(({ clock }) => {
    if (!panel) return
    const yellow = item.flag === 'yellow'
    const on = !yellow || Math.floor(clock.elapsedTime * 2.5) % 2 === 0
    panel.color.set(yellow ? '#ffc21a' : '#3ddc84')
    panel.emissive.set(yellow ? '#ffb000' : '#22c46a')
    panel.emissiveIntensity = on ? 2.2 : 0.2
  })
  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.heading} onClick={(event) => selectEntity(event, item.id)} {...hover}>
      <primitive object={root} />
    </group>
  )
}

function RoadCar({ item }) {
  const root = useClone(item.node)
  const lights = useMemo(() => ({ amber: findChild(root, '_lightbar_amber'), green: findChild(root, '_lightbar_green') }), [root])
  useFrame(({ clock }) => {
    const flash = Math.floor(clock.elapsedTime * 3) % 2 === 0
    if (lights.amber) lights.amber.visible = flash
    if (lights.green) lights.green.visible = !flash
  })
  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.heading} onClick={(event) => selectEntity(event, item.id)} {...hover}>
      <primitive object={root} />
    </group>
  )
}

function SpareCar({ spare }) {
  const assets = useAssets()
  const root = useClone('car_halvard_22')
  const stands = useMemo(() => {
    const front = assets.nodes.car_stand_front.clone(true)
    front.position.set(0, 0, 1.7)
    const rear = assets.nodes.car_stand_rear.clone(true)
    rear.position.set(0, 0, -1.7)
    return [front, rear]
  }, [assets])
  return (
    <group position={[spare.x, 0, spare.z]} rotation-y={spare.heading} onClick={(event) => selectEntity(event, 'spare')} {...hover}>
      <primitive object={root} position-y={0.12} />
      {stands.map((stand, index) => (
        <primitive key={index} object={stand} />
      ))}
    </group>
  )
}

// A flat ellipse fitted to the selected object's footprint; it follows moving things.
function SelectionRing({ state }) {
  const selectedId = useUiValue((ui) => ui.selectedId)
  const groupRef = useRef()
  const geometry = useMemo(() => {
    const ring = new THREE.RingGeometry(0.93, 1, 72)
    ring.rotateX(-Math.PI / 2)
    return ring
  }, [])
  const material = surfaces()
  useFrame(({ clock }) => {
    const group = groupRef.current
    const entity = selectedId && findEntity(selectedId, state)
    group.visible = Boolean(entity)
    if (!entity) return
    const [halfX, halfZ] = entity.footprint
    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.025
    const marginX = Math.max(halfX * 1.25, halfX + 0.25)
    const marginZ = Math.max(halfZ * 1.2, halfZ + 0.25)
    group.position.set(entity.position.x, 0.09, entity.position.z)
    group.rotation.y = entity.heading ?? 0
    group.scale.set(marginX * pulse, 1, marginZ * pulse)
  })
  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={geometry} material={material.ring} renderOrder={5} />
    </group>
  )
}

export function Units({ state }) {
  const cloned = state.statics.filter((item) => item.type === 'gantry' || item.type === 'jack' || item.type === 'post' || item.type === 'roadcar')
  return (
    <group>
      {state.cars.map((car) => (
        <Car key={car.id} car={car} />
      ))}
      <Crowds state={state} />
      {cloned.map((item) => {
        if (item.type === 'gantry') return <Gantry key={item.id} item={item} state={state} />
        if (item.type === 'jack') return <Jack key={item.id} item={item} state={state} />
        if (item.type === 'post') return <MarshalPost key={item.id} item={item} />
        return <RoadCar key={item.id} item={item} />
      })}
      <SpareCar spare={state.spareCar} />
      <SelectionRing state={state} />
    </group>
  )
}
