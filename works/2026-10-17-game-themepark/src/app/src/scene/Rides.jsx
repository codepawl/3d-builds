// Everything that moves: coaster trains, log boats, the Ferris wheel and carousel, the monorail,
// trams, service carts, parade floats and staff. Each reads its pose from the simulation every frame.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COASTER_TRACK, FLUME_TRACK, makePath, samplePath, sampleTrack } from '../paths.js'
import { MONORAIL_HEIGHT } from '../sim.js'
import { RIDE_COLORS } from '../status.js'
import { findParts, flatClone, InstancedModel, ownMaterial } from './assets.jsx'
import { pointerHandlers } from './Markers.jsx'

// A flattened copy of a GLB root that keeps the root's own placement in its file.
function flatRoot(node, keep = null) {
  const group = flatClone(node, keep)
  group.position.copy(node.position)
  group.quaternion.copy(node.quaternion)
  group.scale.copy(node.scale)
  return group
}

function useStatusLamp(object, ride) {
  const material = useMemo(() => {
    const own = ownMaterial(object, 'status')
    if (own) own.toneMapped = false
    return own
  }, [object])
  useFrame(() => {
    if (!material) return
    material.color.set(RIDE_COLORS[ride.state]).multiplyScalar(2.2)
    material.emissive?.set(RIDE_COLORS[ride.state])
  })
}

const basis = new THREE.Matrix4()
const forward = new THREE.Vector3()
const upward = new THREE.Vector3()
const right = new THREE.Vector3()

// Orients an object on a track sample: +z along the tangent, +y along the banked up vector.
function poseOnTrack(object, sample, offset) {
  forward.fromArray(sample.tangent).normalize()
  upward.fromArray(sample.up)
  right.crossVectors(upward, forward).normalize()
  upward.crossVectors(forward, right).normalize()
  basis.makeBasis(right, upward, forward)
  basis.setPosition(sample.position[0] + offset[0], sample.position[1] + offset[1], sample.position[2] + offset[2])
  object.matrix.copy(basis)
}

// ---------- coaster ----------

function Coaster({ state, nodes }) {
  const offset = state.layout.coaster.offset
  const ride = state.rides.find((candidate) => candidate.id === 'riptide')
  const structure = useMemo(() => {
    const group = new THREE.Group()
    for (const name of ['coaster_track', 'coaster_supports', 'coaster_lift', 'coaster_brakes', 'coaster_station']) group.add(flatRoot(nodes[name]))
    return group
  }, [nodes])
  useStatusLamp(structure, ride)
  const trains = state.units.filter((unit) => unit.kind === 'train')
  const cars = useMemo(
    () =>
      trains.map((train) =>
        [1, 2, 3, 4, 5].map((number) => {
          const car = flatClone(nodes[`${train.node}_car_${number}`])
          car.matrixAutoUpdate = false
          return car
        }),
      ),
    [nodes, trains],
  )
  const sample = useMemo(() => ({ position: [0, 0, 0], tangent: [0, 0, 1], up: [0, 1, 0] }), [])
  useFrame(() => {
    trains.forEach((train, trainIndex) => {
      cars[trainIndex].forEach((car, carIndex) => {
        sampleTrack(COASTER_TRACK, train.along - carIndex * COASTER_TRACK.carPitch, sample)
        poseOnTrack(car, sample, offset)
      })
    })
  })
  return (
    <group>
      <group position={offset} {...pointerHandlers('riptide')}>
        <primitive object={structure} />
      </group>
      {trains.map((train, trainIndex) => (
        <group key={train.id} {...pointerHandlers(train.id)}>
          {cars[trainIndex].map((car, carIndex) => (
            <primitive key={carIndex} object={car} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- log flume ----------

function Flume({ state, nodes }) {
  const offset = state.layout.flume.offset
  const ride = state.rides.find((candidate) => candidate.id === 'kalua')
  const { structure, splash } = useMemo(() => {
    const group = new THREE.Group()
    for (const name of ['flume_channel', 'flume_lift', 'flume_station']) group.add(flatRoot(nodes[name]))
    const pool = flatRoot(nodes.flume_pool, /^flume_splash/)
    group.add(pool)
    const splashObject = pool.children.find((child) => child.name.startsWith('flume_splash'))
    if (splashObject) splashObject.userData.base = splashObject.scale.clone()
    return { structure: group, splash: splashObject }
  }, [nodes])
  useStatusLamp(structure, ride)
  const boats = state.units.filter((unit) => unit.kind === 'boat')
  const boatObjects = useMemo(
    () =>
      boats.map((boat) => {
        const object = flatClone(nodes[boat.node])
        object.matrixAutoUpdate = false
        return object
      }),
    [nodes, boats],
  )
  const sample = useMemo(() => ({ position: [0, 0, 0], tangent: [0, 0, 1], up: [0, 1, 0] }), [])
  useFrame(() => {
    boats.forEach((boat, index) => {
      sampleTrack(FLUME_TRACK, boat.along, sample)
      poseOnTrack(boatObjects[index], sample, offset)
    })
    if (splash) {
      const age = state.splash?.age
      splash.visible = age !== undefined
      if (age !== undefined) {
        const grow = Math.sin(Math.min(1, age / 1.6) * Math.PI)
        splash.scale.copy(splash.userData.base).multiplyScalar(0.4 + grow * 1.1)
        splash.scale.y = splash.userData.base.y * (0.3 + grow * 1.5)
      }
    }
  })
  return (
    <group>
      <group position={offset} {...pointerHandlers('kalua')}>
        <primitive object={structure} />
      </group>
      {boats.map((boat, index) => (
        <group key={boat.id} {...pointerHandlers(boat.id)}>
          <primitive object={boatObjects[index]} />
        </group>
      ))}
    </group>
  )
}

// ---------- Ferris wheel ----------

const xAxis = new THREE.Vector3(1, 0, 0)
const yAxis = new THREE.Vector3(0, 1, 0)
const turn = new THREE.Quaternion()

function FerrisWheel({ state, nodes, spec, rideId }) {
  const ride = state.rides.find((candidate) => candidate.id === rideId)
  const { root, rotor, gondolas } = useMemo(() => {
    const source = nodes.ferris_wheel
    const group = flatClone(source, /^ferris_rotor|^ferris_status/)
    const flatRotor = group.children.find((child) => child.name.startsWith('ferris_rotor'))
    group.remove(flatRotor)
    const rotorSource = findParts(source, 'ferris_rotor')[0]
    const spinning = flatClone(rotorSource, /^gondola/)
    spinning.position.copy(rotorSource.position)
    spinning.quaternion.copy(rotorSource.quaternion)
    spinning.userData.base = rotorSource.quaternion.clone()
    group.add(spinning)
    const cabins = spinning.children.filter((child) => child.name.startsWith('gondola'))
    cabins.forEach((cabin) => (cabin.userData.base = cabin.quaternion.clone()))
    return { root: group, rotor: spinning, gondolas: cabins }
  }, [nodes])
  useStatusLamp(root, ride)
  useFrame(() => {
    const angle = state.ferrisAngle
    rotor.quaternion.copy(rotor.userData.base).multiply(turn.setFromAxisAngle(xAxis, angle))
    for (const cabin of gondolas) cabin.quaternion.copy(cabin.userData.base).multiply(turn.setFromAxisAngle(xAxis, -angle))
  })
  return (
    <group position={spec.position} rotation={[0, spec.rotation, 0]} {...pointerHandlers(rideId)}>
      <primitive object={root} />
    </group>
  )
}

// ---------- carousel ----------

function Carousel({ state, nodes, spec }) {
  const ride = state.rides.find((candidate) => candidate.id === 'gallop')
  const { root, rotor, horses } = useMemo(() => {
    const source = nodes.carousel
    const group = flatClone(source, /^carousel_rotor|^carousel_status/)
    const flatRotor = group.children.find((child) => child.name.startsWith('carousel_rotor'))
    group.remove(flatRotor)
    const rotorSource = findParts(source, 'carousel_rotor')[0]
    const spinning = flatClone(rotorSource, /^horse_|^chariot_/)
    spinning.position.copy(rotorSource.position)
    spinning.userData.base = rotorSource.quaternion.clone()
    group.add(spinning)
    const riders = spinning.children.filter((child) => child.name.startsWith('horse_'))
    riders.forEach((horse, index) => {
      horse.userData.baseY = horse.position.y
      horse.userData.phase = index * 1.37
    })
    return { root: group, rotor: spinning, horses: riders }
  }, [nodes])
  useStatusLamp(root, ride)
  useFrame(() => {
    const angle = state.carouselAngle
    rotor.quaternion.copy(rotor.userData.base).multiply(turn.setFromAxisAngle(yAxis, angle))
    for (const horse of horses) horse.position.y = horse.userData.baseY + (Math.sin(angle * 3 + horse.userData.phase) + 1) * 0.175
  })
  return (
    <group position={spec.position} {...pointerHandlers('gallop')}>
      <primitive object={root} />
    </group>
  )
}

// ---------- monorail ----------

function MonorailTrack({ nodes, layout }) {
  const { beams, pylons } = useMemo(() => {
    const path = makePath(layout.monorail.points, true)
    const point = {}
    const beamItems = []
    const pylonItems = []
    const segments = Math.round(path.length / 4)
    const step = path.length / segments
    for (let index = 0; index < segments; index++) {
      samplePath(path, (index + 0.5) * step, point)
      beamItems.push({ position: [point.x, MONORAIL_HEIGHT, point.z], rotation: point.heading, scale: [1, 1, step / 4 + 0.02] })
    }
    const station = layout.monorail.station.position
    for (let s = 0; s < path.length; s += 20) {
      samplePath(path, s, point)
      if (Math.abs(point.x - station[0]) < 4 && Math.abs(point.z - station[2]) < 17) continue
      pylonItems.push({ position: [point.x, 0, point.z], rotation: point.heading })
    }
    return { beams: beamItems, pylons: pylonItems }
  }, [layout])
  const station = layout.monorail.station
  return (
    <group>
      <InstancedModel node={nodes.monorail_beam} items={beams} />
      <InstancedModel node={nodes.monorail_pylon} items={pylons} />
      <group position={station.position} rotation={[0, station.rotation, 0]} {...pointerHandlers(layout.monorailRideId ?? null)}>
        <primitive object={useMemo(() => flatClone(nodes.monorail_station), [nodes])} />
      </group>
    </group>
  )
}

const CAR_GAPS = { monorail_car_lead: 0, monorail_car_mid: 13.2, monorail_car_tail: 23.8 }

function Monorail({ state, nodes, unit }) {
  const cars = useMemo(
    () =>
      Object.keys(CAR_GAPS).map((name) => {
        const car = flatClone(nodes[name], /_door_/)
        const doors = car.children.filter((child) => /_door_/.test(child.name))
        doors.forEach((door) => (door.userData.baseZ = door.position.z))
        return { car, doors, gap: CAR_GAPS[name] }
      }),
    [nodes],
  )
  const point = useMemo(() => ({}), [])
  useFrame(() => {
    for (const { car, doors, gap } of cars) {
      samplePath(unit.path, unit.s - gap, point)
      car.position.set(point.x, MONORAIL_HEIGHT, point.z)
      car.rotation.y = point.heading
      for (const door of doors) door.position.z = door.userData.baseZ + (/[LR]1/.test(door.name) ? -0.9 : 0.9) * unit.doors
    }
  })
  return (
    <group {...pointerHandlers(unit.id)}>
      {cars.map(({ car }, index) => (
        <primitive key={index} object={car} />
      ))}
    </group>
  )
}

// ---------- vehicles on paths ----------

function PathVehicle({ nodes, unit, parts }) {
  const objects = useMemo(() => parts.map(([node]) => flatClone(nodes[node])), [nodes, parts])
  const point = useMemo(() => ({}), [])
  useFrame(() => {
    parts.forEach(([, gap], index) => {
      samplePath(unit.path, unit.s - gap, point)
      objects[index].position.set(point.x, 0, point.z)
      objects[index].rotation.y = point.heading
    })
  })
  return (
    <group {...pointerHandlers(unit.id)}>
      {objects.map((object, index) => (
        <primitive key={index} object={object} />
      ))}
    </group>
  )
}

const TRAM_PARTS = [
  ['tram_tractor', 0],
  ['tram_trailer', 6.0],
  ['tram_trailer', 13.0],
]

// ---------- staff ----------

function Staff({ unit, nodes, clips }) {
  const { object, mixer } = useMemo(() => {
    const clone = nodes[unit.node].clone(true)
    clone.position.set(0, 0, 0)
    const animationMixer = new THREE.AnimationMixer(clone)
    const clip = clips.find((candidate) => candidate.name === `${unit.node}_${unit.clip}`)
    if (clip) animationMixer.clipAction(clip).play()
    animationMixer.setTime(unit.shift * 2)
    return { object: clone, mixer: animationMixer }
  }, [nodes, clips, unit])
  useEffect(() => () => mixer.stopAllAction(), [mixer])
  const groupRef = useRef()
  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.1))
    groupRef.current.position.set(unit.position.x, 0, unit.position.z)
    groupRef.current.rotation.y = unit.heading
  })
  return (
    <group ref={groupRef} {...pointerHandlers(unit.id)}>
      <primitive object={object} />
    </group>
  )
}

export function Rides({ state, nodes, clips }) {
  const layout = state.layout
  const monorailUnit = state.units.find((unit) => unit.kind === 'monorail')
  return (
    <group>
      {layout.coaster && <Coaster state={state} nodes={nodes} />}
      {layout.flume && <Flume state={state} nodes={nodes} />}
      {layout.ferris && <FerrisWheel state={state} nodes={nodes} spec={layout.ferris} rideId={layout.ferris.rideId ?? 'sunspoke'} />}
      {layout.carousel && <Carousel state={state} nodes={nodes} spec={layout.carousel} />}
      {layout.monorail && <MonorailTrack nodes={nodes} layout={layout} />}
      {monorailUnit && <Monorail state={state} nodes={nodes} unit={monorailUnit} />}
      {state.units
        .filter((unit) => unit.kind === 'tram')
        .map((unit) => (
          <PathVehicle key={unit.id} nodes={nodes} unit={unit} parts={TRAM_PARTS} />
        ))}
      {state.units
        .filter((unit) => unit.kind === 'cart' || unit.kind === 'float')
        .map((unit) => (
          <PathVehicle key={unit.id} nodes={nodes} unit={unit} parts={[[unit.node, 0]]} />
        ))}
      {state.units
        .filter((unit) => unit.kind === 'staff')
        .map((unit) => (
          <Staff key={unit.id} unit={unit} nodes={nodes} clips={clips} />
        ))}
    </group>
  )
}
