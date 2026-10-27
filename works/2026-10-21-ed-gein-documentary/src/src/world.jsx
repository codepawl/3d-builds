// The 3D side of the case file: one canvas, three worlds (county map, village, farm) plus the opening
// panorama. What is lit, who stands where and the time of day all follow the selected timeline event.
import * as THREE from 'three'
import { useEffect, useId, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Stars, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, N8AO } from '@react-three/postprocessing'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { PLACES, placeById, toLocal, eventById, EVENTS, visibleAt } from './data.js'
import { layoutLabels, registerLabel, registerObstacle } from './labels.js'
import { easeInOut, smoothstep } from './anim.js'

const RED = '#e0262b'
const ASSETS = '/assets'
const MAP_LINE_HEIGHT = 9

// Shared registry of anchor points so the UI and the film can find a place on screen.
export const anchors = new Map()

function eventIndex(eventId) {
  return EVENTS.findIndex((event) => event.id === eventId)
}

function isAtOrAfter(eventId, referenceId) {
  if (!eventId) return true
  return eventIndex(eventId) >= eventIndex(referenceId)
}

function localPosition(place) {
  const [x, z] = toLocal(place.latLon[0], place.latLon[1])
  return [x, 0, z]
}

// Off-map places sit on the map edge in their direction, with an arrow.
const EXTENT = { west: -20540, east: 19322, north: -31840, south: 23725 }
function edgePoint([x, , z]) {
  const margin = 2600
  const scaleX = x > 0 ? (EXTENT.east - margin) / x : (EXTENT.west + margin) / x
  const scaleZ = z > 0 ? (EXTENT.south - margin) / z : (EXTENT.north + margin) / z
  const scale = Math.min(scaleX, scaleZ)
  return [x * scale, 0, z * scale]
}

export function placePosition(placeId) {
  const place = placeById(placeId)
  if (!place) return [0, 0, 0]
  const position = localPosition(place)
  return place.kind === 'offmap' ? edgePoint(position) : position
}

let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

function useClickGuard(handler) {
  return (event) => {
    if (event.delta > 5) return
    event.stopPropagation()
    handler(event)
  }
}

// ---------- labels ----------

// Labels register an anchor with the screen-space layout (labels.js) instead of drawing their own box.
// Priorities: red crime tags first, then people and vehicles, places, town names, county names.
function useLabel(position, label) {
  const ref = useRef()
  const key = useId()
  const { text: labelText, sub, red, kind, priority } = label
  useEffect(() => registerLabel(key, { object: ref.current, text: labelText, sub, red, kind, priority }), [key, labelText, sub, red, kind, priority])
  return <object3D ref={ref} position={position} />
}

function Tag({ position, text, red = false, sub = null, priority }) {
  return useLabel(position, { text, sub, red, kind: 'tag', priority: priority ?? (red ? 90 : 70) })
}

const NAME_PRIORITY = { large: 40, normal: 30, street: 30, county: 10 }
function MapName({ position, text, size = 'normal' }) {
  return useLabel(position, { text, sub: null, red: false, kind: size, priority: NAME_PRIORITY[size] ?? 30 })
}

// ---------- county map ----------

function segmentLines(segments, height, color, opacity, width) {
  const positions = new Float32Array((segments.length / 2) * 3)
  for (let index = 0, out = 0; index < segments.length; index += 2, out += 3) {
    positions[out] = segments[index]
    positions[out + 1] = height
    positions[out + 2] = segments[index + 1]
  }
  if (!width) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    return new THREE.LineSegments(geometry, material)
  }
  const geometry = new LineSegmentsGeometry()
  geometry.setPositions(positions)
  const material = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false })
  return new LineSegments2(geometry, material)
}

function polylineSegments(points) {
  const segments = []
  for (let index = 1; index < points.length; index++) segments.push(...points[index - 1], ...points[index])
  return segments
}

function XMark({ position, lit, faded, size, onSelect }) {
  const groupRef = useRef()
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#300607', emissive: RED, emissiveIntensity: 1, toneMapped: false, transparent: true }), [])
  const glowRef = useRef()
  const handleClick = useClickGuard(onSelect)
  useFrame(({ camera }, delta) => {
    groupRef.current.scale.setScalar(Math.min(4.5, Math.max(0.45, camera.position.y / 5200)))
    const target = faded ? 0.15 : lit ? 5.5 : 1.1
    material.emissiveIntensity += (target - material.emissiveIntensity) * Math.min(1, delta * 2.5)
    material.opacity += ((faded ? 0.35 : 1) - material.opacity) * Math.min(1, delta * 2.5)
    const glow = glowRef.current
    glow.material.opacity += ((lit && !faded ? 0.5 : 0.14) - glow.material.opacity) * Math.min(1, delta * 2.5)
  })
  const bar = size * 0.14
  return (
    <group ref={groupRef} position={[position[0], MAP_LINE_HEIGHT + 4, position[2]]}>
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[size, bar * 0.4, bar]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[size, bar * 0.4, bar]} />
        <primitive object={material} attach="material" />
      </mesh>
      <sprite ref={glowRef} scale={[size * 2.4, size * 2.4, 1]} position={[0, 2, 0]} renderOrder={-1}>
        <spriteMaterial map={getGlowTexture()} color={RED} transparent opacity={0.2} depthWrite={false} depthTest={false} toneMapped={false} />
      </sprite>
      <mesh onClick={handleClick} visible={false}>
        <sphereGeometry args={[size * 1.3, 8, 8]} />
      </mesh>
    </group>
  )
}

function AreaRing({ position, radius, lit }) {
  const ring = useMemo(() => {
    const points = []
    const steps = 96
    for (let index = 0; index <= steps; index++) {
      const angle = (index / steps) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineDashedMaterial({ color: RED, dashSize: radius * 0.06, gapSize: radius * 0.05, transparent: true, opacity: 0.5, toneMapped: false })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return line
  }, [radius])
  useFrame((_, delta) => {
    ring.material.opacity += ((lit ? 0.95 : 0.35) - ring.material.opacity) * Math.min(1, delta * 2)
  })
  return <primitive object={ring} position={[position[0], MAP_LINE_HEIGHT + 2, position[2]]} />
}

function OffMapArrow({ position, from }) {
  const angle = Math.atan2(position[2] - from[2], position[0] - from[0])
  return (
    <group position={[position[0], MAP_LINE_HEIGHT + 3, position[2]]} rotation={[0, -angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <coneGeometry args={[420, 900, 3]} />
        <meshBasicMaterial color="#8d8f94" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

const MAP_NAMES = [
  { text: 'PLAINFIELD', latLon: [44.2135, -89.4923], offset: [1400, 0, -1700], size: 'large' },
  { text: 'WEST PLAINFIELD', latLon: [44.2141, -89.5527], offset: [-1900, 0, 1500] },
  { text: 'WAUTOMA', latLon: [44.07371, -89.2899], offset: [0, 0, -1500], size: 'large' },
  { text: 'HANCOCK', latLon: [44.1149, -89.5419], offset: [0, 0, 1300] },
  { text: 'PINE GROVE', latLon: [44.2915, -89.5473], offset: [0, 0, -2300] },
  { text: 'WAUSHARA COUNTY', latLon: [44.17, -89.38], offset: [0, 0, 0], size: 'county' },
  { text: 'PORTAGE COUNTY', latLon: [44.325, -89.36], offset: [0, 0, 0], size: 'county' },
]

const END_ID = 'end'
const NO_SELECT = () => {}

// Seconds since the current shot started: every animation below runs on it, so a moment replays when selected.
function shotSeconds(state) {
  return (performance.now() - state.shotStartedAt) / 1000
}

// Measures a polyline once, so a point at any distance along it is cheap.
function measureRoute(points) {
  const lengths = [0]
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]))
  }
  const total = lengths[lengths.length - 1]
  const pointAt = (distance) => {
    const clamped = Math.min(total, Math.max(0, distance))
    let index = 1
    while (index < lengths.length - 1 && lengths[index] < clamped) index++
    const span = lengths[index] - lengths[index - 1] || 1
    const fraction = (clamped - lengths[index - 1]) / span
    return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * fraction, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * fraction]
  }
  return { total, pointAt, segmentCount: points.length - 1 }
}

// A glowing dot on the county map that keeps the same size on screen; `track(seconds)` gives [x, z] or null.
function MapDot({ color, track, state, scale = 0.011, blink = false }) {
  const ref = useRef()
  useFrame(({ camera }) => {
    const sprite = ref.current
    const seconds = shotSeconds(state)
    const point = track(seconds)
    sprite.visible = Boolean(point)
    if (!point) return
    sprite.position.set(point[0], MAP_LINE_HEIGHT + 40, point[1])
    const size = camera.position.distanceTo(sprite.position) * scale
    sprite.scale.set(size, size, 1)
    sprite.material.opacity = blink ? 0.65 + 0.35 * Math.sin(seconds * 14) ** 2 : 1
  })
  return (
    <sprite ref={ref} renderOrder={2}>
      <spriteMaterial map={getGlowTexture()} color={color} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </sprite>
  )
}

// A square outline that lights around a place: the courthouse once the car has arrived.
function PlaceOutline({ position, size, track, state }) {
  const outline = useMemo(() => {
    const half = size / 2
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]]
    const segments = []
    corners.forEach((corner, index) => segments.push(position[0] + corner[0], position[2] + corner[1], position[0] + corners[(index + 1) % 4][0], position[2] + corners[(index + 1) % 4][1]))
    const line = segmentLines(segments, MAP_LINE_HEIGHT + 3, '#f0f0f2', 0, 2.6)
    line.material.toneMapped = false
    return line
  }, [position, size])
  useFrame(() => {
    outline.material.opacity = track(shotSeconds(state))
  })
  return <primitive object={outline} />
}

function County({ map, state }) {
  const terrain = useGLTF(`${ASSETS}/terrain.glb`, false)
  const terrainScene = useMemo(() => {
    const scene = terrain.scene.clone(true)
    scene.traverse((object) => {
      if (object.isMesh) object.material = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 1, metalness: 0 })
    })
    scene.scale.set(1, 0.25, 1)
    return scene
  }, [terrain])
  const layers = useMemo(() => {
    const roads = segmentLines(map.roads, MAP_LINE_HEIGHT, '#a7a9ad', 0.4, 1.3)
    const highways = segmentLines(map.highways, MAP_LINE_HEIGHT + 0.5, '#d4d6da', 0.66, 1.8)
    const streams = segmentLines(map.streams, MAP_LINE_HEIGHT - 0.5, '#7d828a', 0.5)
    const route = segmentLines(polylineSegments(map.route), MAP_LINE_HEIGHT + 2, RED, 0.95, 3.4)
    route.material.toneMapped = false
    const pointsGeometry = new THREE.BufferGeometry()
    const pointPositions = new Float32Array((map.buildings.length / 2) * 3)
    for (let index = 0, out = 0; index < map.buildings.length; index += 2, out += 3) {
      pointPositions[out] = map.buildings[index]
      pointPositions[out + 1] = MAP_LINE_HEIGHT
      pointPositions[out + 2] = map.buildings[index + 1]
    }
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
    const buildings = new THREE.Points(pointsGeometry, new THREE.PointsMaterial({ color: '#b3b5b9', size: 2.4 * Math.min(2, window.devicePixelRatio || 1), sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false }))
    const waterGroup = new THREE.Group()
    const waterFill = new THREE.MeshBasicMaterial({ color: '#1f2125' })
    const waterEdge = new THREE.LineBasicMaterial({ color: '#8b9097', transparent: true, opacity: 0.6 })
    for (const ring of map.water) {
      const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)))
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), waterFill)
      fill.rotation.x = -Math.PI / 2
      fill.position.y = MAP_LINE_HEIGHT - 1
      waterGroup.add(fill)
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring.map(([x, z]) => new THREE.Vector3(x, MAP_LINE_HEIGHT, z))), waterEdge)
      waterGroup.add(edge)
    }
    return { roads, highways, streams, route, buildings, waterGroup }
  }, [map])
  const route = useMemo(() => measureRoute(map.route), [map])

  const moment = state.eventId
  const event = eventById(moment)
  const drawing = moment === 'eslip'
  const routeShown = drawing || moment === 'enight' || moment === END_ID

  // The evening: the lead draws itself along the traced road, from the store out to the farm.
  const drawFraction = (seconds) => (drawing ? easeInOut((seconds - 0.3) / 2.2) : 1)
  useFrame(() => {
    const segments = Math.max(1, Math.round(drawFraction(shotSeconds(state)) * route.segmentCount))
    layers.route.geometry.instanceCount = segments
  })

  // That night: three police cars drive the same road, blue lights and headlights, a beat apart.
  const policeTrack = (delay, ahead = 0) => (seconds) => {
    if (moment !== 'enight') return null
    const progress = easeInOut((seconds - delay) / 2.4)
    if (progress <= 0 || progress >= 1) return null
    return route.pointAt(progress * route.total + ahead)
  }
  // 21 Nov: a car drives from Plainfield to the courthouse at Wautoma.
  const courthouse = placePosition('courthouse')
  const courtProgress = (seconds) => easeInOut((seconds - 0.2) / 1.5)
  const courtTrack = (seconds) => {
    if (moment !== 'e1121') return null
    const progress = courtProgress(seconds)
    return progress >= 1 ? null : [courthouse[0] * progress, courthouse[2] * progress]
  }
  // 25 Nov: small lamps come on around the cemetery mark, one by one. No graves are shown.
  const cemetery = placePosition('cemetery')
  const lampTracks = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 + 0.3
    const radius = 260 + (index % 2) * 90
    return (seconds) => (seconds > 0.3 + index * 0.14 ? [cemetery[0] + Math.cos(angle) * radius, cemetery[2] + Math.sin(angle) * radius] : null)
  }), [cemetery])

  const lit = (place) => {
    if (moment === END_ID) return place.kind !== 'offmap'
    if (moment === 'eslip' || moment === 'enight') return place.id === 'store' || place.id === 'farm' || (moment === 'enight' && place.id === 'westplainfield')
    return event?.place === place.id
  }
  const markSize = 300

  return (
    <group>
      <primitive object={terrainScene} />
      <primitive object={layers.waterGroup} />
      <primitive object={layers.roads} />
      <primitive object={layers.highways} />
      <primitive object={layers.streams} />
      <primitive object={layers.buildings} />
      <primitive object={layers.route} visible={routeShown} />
      {MAP_NAMES.map((name) => {
        const [x, z] = toLocal(name.latLon[0], name.latLon[1])
        return <MapName key={name.text} text={name.text} size={name.size} position={[x + name.offset[0], MAP_LINE_HEIGHT, z + name.offset[2]]} />
      })}
      {PLACES.map((place) => {
        if (!visibleAt(place, moment)) return null
        const position = placePosition(place.id)
        const placeLit = lit(place)
        const faded = place.id === 'farm' && isAtOrAfter(moment, 'e1958fire')
        if (place.kind === 'offmap') {
          return (
            <group key={place.id}>
              <OffMapArrow position={position} from={[0, 0, 0]} />
              <XMark position={[position[0], 0, position[2] - 1100]} size={markSize * 0.7} lit={placeLit} onSelect={NO_SELECT} />
              {placeLit ? <Tag position={[position[0], MAP_LINE_HEIGHT, position[2] - 1100]} text={place.name.toUpperCase()} sub="off this map" red priority={85} /> : null}
            </group>
          )
        }
        return (
          <group key={place.id}>
            {place.area ? <AreaRing position={position} radius={1700} lit={placeLit} /> : null}
            <XMark position={position} size={markSize} lit={placeLit} faded={faded} onSelect={NO_SELECT} />
            {placeLit ? (
              <Tag
                position={[position[0], MAP_LINE_HEIGHT, position[2]]}
                text={(faded ? 'Gein farm, house burned' : place.name).toUpperCase()}
                sub={place.confidence === 'SEC' ? 'later sources' : place.area ? 'area marker, lot unknown' : place.id === 'westplainfield' && moment === 'enight' ? 'that night: taken into custody' : null}
                red={place.kind === 'crime' || moment !== END_ID}
                priority={place.kind === 'crime' ? 88 : 60}
              />
            ) : null}
          </group>
        )
      })}
      {drawing ? <MapDot color="#ff4a4f" state={state} scale={0.016} track={(seconds) => (drawFraction(seconds) < 1 ? route.pointAt(drawFraction(seconds) * route.total) : null)} /> : null}
      {[0, 0.35, 0.7].map((delay) => (
        <group key={delay}>
          <MapDot color="#4f9bff" state={state} scale={0.022} blink track={policeTrack(delay)} />
          <MapDot color="#fff6dc" state={state} scale={0.012} track={policeTrack(delay, 220)} />
        </group>
      ))}
      <MapDot color="#f4f4f4" state={state} scale={0.012} track={courtTrack} />
      {moment === 'e1121' ? <PlaceOutline position={courthouse} size={1100} state={state} track={(seconds) => 0.9 * smoothstep((seconds - 1.5) / 0.5)} /> : null}
      {moment === 'e1125' ? lampTracks.map((track, index) => <MapDot key={index} color="#ffc977" state={state} scale={0.013} track={track} />) : null}
      {moment === 'e1954' ? <Tag position={placePosition('pinegrove')} text="MARY HOGAN" sub="tavern keeper, 8 Dec 1954" red priority={99} /> : null}
      {moment === END_ID ? (
        <>
          <Tag position={placePosition('pinegrove')} text="MARY HOGAN, 1954" sub="tavern keeper, Town of Pine Grove" red priority={99} />
          <Tag position={placePosition('store')} text="BERNICE WORDEN, 1957" sub="store owner, Plainfield" red priority={99} />
        </>
      ) : null}
      <ambientLight intensity={0.5} />
      <directionalLight position={[-20000, 30000, -10000]} intensity={1.2} />
    </group>
  )
}

// ---------- shared model helpers ----------

function cloneNode(gltf, name, { tint, materialOverride } = {}) {
  const source = gltf.scene.getObjectByName(name)
  const copy = source.clone(true)
  copy.position.set(0, 0, 0)
  copy.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    if (materialOverride) object.material = materialOverride
    else {
      object.material = object.material.clone()
      if (tint && object.material.color) {
        const color = object.material.color
        if (color.r > color.g * 1.4 && color.r > 0.08) object.material.color.set(tint)
      }
    }
  })
  return copy
}

const SILHOUETTE_COLORS = { white: '#f1f1f1', blue: '#3f8fe6', grey: '#8a8d92' }
const silhouetteMaterials = {}
function silhouetteMaterial(tint) {
  silhouetteMaterials[tint] ??= new THREE.MeshBasicMaterial({
    color: SILHOUETTE_COLORS[tint],
    toneMapped: false,
    transparent: tint === 'grey',
    opacity: tint === 'grey' ? 0.8 : 1,
  })
  return silhouetteMaterials[tint]
}

function Figure({ people, pose, tint, position, rotation = 0, walk }) {
  const object = useMemo(() => cloneNode(people, pose, { materialOverride: silhouetteMaterial(tint) }), [people, pose, tint])
  const groupRef = useRef()
  useFrame(() => {
    if (!walk || !groupRef.current) return
    const seconds = performance.now() / 1000
    const travel = ((seconds * walk.speed) % walk.length) - walk.length / 2
    groupRef.current.position.set(position[0] + Math.cos(rotation) * travel, 0, position[2] - Math.sin(rotation) * travel)
  })
  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      <primitive object={object} />
    </group>
  )
}

// A silhouette that follows a path in shot time: `track(seconds)` gives { x, z, heading, moving, visible }.
// Walking shows the walking pose with a slight step bob; standing shows `standPose`.
function Actor({ people, tint, standPose, track, state, children }) {
  const walking = useMemo(() => cloneNode(people, 'townsperson_walking', { materialOverride: silhouetteMaterial(tint) }), [people, tint])
  const standing = useMemo(() => cloneNode(people, standPose, { materialOverride: silhouetteMaterial(tint) }), [people, standPose, tint])
  const groupRef = useRef()
  useFrame(() => {
    const group = groupRef.current
    const seconds = shotSeconds(state)
    const pose = track(seconds)
    group.visible = pose.visible !== false
    group.position.set(pose.x, pose.moving ? Math.abs(Math.sin(seconds * 8)) * 0.05 : 0, pose.z)
    group.rotation.y = pose.heading
    walking.visible = pose.moving
    standing.visible = !pose.moving
  })
  return (
    <group ref={groupRef}>
      <primitive object={walking} />
      <primitive object={standing} />
      {children}
    </group>
  )
}

// A straight walk from one point to another between two shot times, then standing at the end.
function walkPath(from, to, start, end, { hideAfter = Infinity, finalHeading } = {}) {
  const heading = Math.atan2(-(to[1] - from[1]), to[0] - from[0])
  return (seconds) => {
    const progress = Math.min(1, Math.max(0, (seconds - start) / (end - start)))
    return {
      x: from[0] + (to[0] - from[0]) * progress,
      z: from[1] + (to[1] - from[1]) * progress,
      heading: progress >= 1 && finalHeading !== undefined ? finalHeading : heading,
      moving: progress > 0 && progress < 1,
      visible: seconds < hideAfter,
    }
  }
}

// A vehicle that drives a straight lane in shot time, wheels turning; `track(seconds)` gives { x, z, heading } or null.
function Vehicle({ vehicles, name, tint, track, state, children }) {
  const object = useMemo(() => cloneNode(vehicles, name, { tint }), [vehicles, name, tint])
  const wheels = useMemo(() => {
    const found = []
    object.traverse((child) => {
      if (child.name.includes('wheel')) found.push(child)
    })
    return found
  }, [object])
  const groupRef = useRef()
  useFrame(() => {
    const group = groupRef.current
    const pose = track(shotSeconds(state))
    group.visible = Boolean(pose)
    if (!pose) return
    group.position.set(pose.x, 0, pose.z)
    group.rotation.y = pose.heading
    for (const wheel of wheels) wheel.rotation.y = -(pose.travel ?? 0) / 0.37
  })
  return (
    <group ref={groupRef}>
      <primitive object={object} />
      {children}
    </group>
  )
}

function laneTrack({ x, fromZ, toZ, start, duration }) {
  const heading = toZ > fromZ ? -Math.PI / 2 : Math.PI / 2
  return (seconds) => {
    const progress = (seconds - start) / duration
    if (progress < 0 || progress > 1) return null
    return { x, z: fromZ + (toZ - fromZ) * progress, heading, travel: Math.abs(toZ - fromZ) * progress }
  }
}

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function Trees({ props, spots }) {
  const trees = useMemo(() => {
    const kinds = ['tree_bare_elm', 'tree_bare_oak', 'tree_bare_small']
    return spots.map(([x, z, kind, turn], index) => {
      const object = cloneNode(props, kinds[kind % 3])
      object.position.set(x, 0, z)
      object.rotation.y = turn
      object.name = `tree_${index}`
      return object
    })
  }, [props, spots])
  return trees.map((tree) => <primitive key={tree.name} object={tree} />)
}

// Falling snow over a box of the scene: slow, sparse flakes, so a held shot keeps moving.
function Snow({ box, count = 1600 }) {
  const points = useMemo(() => {
    const random = seededRandom(1116)
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index++) {
      positions[index * 3] = box[0] + random() * (box[1] - box[0])
      positions[index * 3 + 1] = random() * 40
      positions[index * 3 + 2] = box[2] + random() * (box[3] - box[2])
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({ color: '#f2f4f8', size: 0.32, transparent: true, opacity: 0.75, depthWrite: false })
    return new THREE.Points(geometry, material)
  }, [box, count])
  useFrame((_, delta) => {
    const positions = points.geometry.attributes.position
    const seconds = performance.now() / 1000
    for (let index = 0; index < count; index++) {
      let height = positions.getY(index) - delta * 1.6
      if (height < 0) height += 40
      positions.setY(index, height)
      positions.setX(index, positions.getX(index) + Math.sin(seconds * 0.7 + index) * delta * 0.3)
    }
    positions.needsUpdate = true
  })
  return <primitive object={points} />
}

// A small paper sales slip, drawn once on a canvas.
let slipTexture = null
function getSlipTexture() {
  if (slipTexture) return slipTexture
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 256
  const context = canvas.getContext('2d')
  context.fillStyle = '#ece6d6'
  context.fillRect(0, 0, 192, 256)
  context.fillStyle = '#2a2a2a'
  context.font = 'bold 22px Georgia, serif'
  context.textAlign = 'center'
  context.fillText('SALES SLIP', 96, 46)
  context.font = '20px Georgia, serif'
  context.fillText('Antifreeze', 96, 112)
  context.fillStyle = 'rgba(40,40,40,0.35)'
  for (let line = 140; line < 236; line += 22) context.fillRect(22, line, 148, 2)
  slipTexture = new THREE.CanvasTexture(canvas)
  slipTexture.colorSpace = THREE.SRGBColorSpace
  return slipTexture
}

// ---------- lighting by time of day ----------

const LIGHTING = {
  morning: { background: '#2e3136', hemisphereSky: '#9aa0aa', hemisphereGround: '#2c2c30', hemisphere: 1.1, sunColor: '#d6dae2', sun: 1.5, sunPosition: [70, 45, 90], window: 0.35, fogNear: 120, fogFar: 460 },
  dusk: { background: '#121419', hemisphereSky: '#4a5366', hemisphereGround: '#121214', hemisphere: 0.75, sunColor: '#8d93a6', sun: 0.5, sunPosition: [-90, 22, 50], window: 0.85, fogNear: 120, fogFar: 460 },
  night: { background: '#08090b', hemisphereSky: '#243048', hemisphereGround: '#050506', hemisphere: 0.32, sunColor: '#8494b8', sun: 0.36, sunPosition: [-40, 80, -30], window: 1.1, fogNear: 90, fogFar: 380 },
  day: { background: '#1c1d21', hemisphereSky: '#8b9099', hemisphereGround: '#1b1b1d', hemisphere: 0.8, sunColor: '#d0d3d9', sun: 1.3, sunPosition: [70, 60, 90], window: 0.4, fogNear: 160, fogFar: 600 },
}

function TimeOfDay({ light, shadowSize = 90 }) {
  const preset = LIGHTING[light] ?? LIGHTING.dusk
  const { scene } = useThree()
  const sunRef = useRef()
  const hemisphereRef = useRef()
  const current = useRef(null)
  useFrame((_, delta) => {
    const blend = Math.min(1, delta * 1.6)
    if (!current.current) {
      current.current = { background: new THREE.Color(preset.background), sun: preset.sun, hemisphere: preset.hemisphere }
    }
    const state = current.current
    state.background.lerp(new THREE.Color(preset.background), blend)
    state.sun += (preset.sun - state.sun) * blend
    state.hemisphere += (preset.hemisphere - state.hemisphere) * blend
    scene.background = state.background
    if (!scene.fog) scene.fog = new THREE.Fog(state.background, preset.fogNear, preset.fogFar)
    scene.fog.color.copy(state.background)
    scene.fog.near = preset.fogNear
    scene.fog.far = preset.fogFar
    sunRef.current.intensity = state.sun
    sunRef.current.color.lerp(new THREE.Color(preset.sunColor), blend)
    sunRef.current.position.lerp(new THREE.Vector3(...preset.sunPosition), blend)
    hemisphereRef.current.intensity = state.hemisphere
    hemisphereRef.current.color.lerp(new THREE.Color(preset.hemisphereSky), blend)
    hemisphereRef.current.groundColor.lerp(new THREE.Color(preset.hemisphereGround), blend)
  })
  useEffect(() => () => {
    scene.fog = null
  }, [scene])
  return (
    <>
      <hemisphereLight ref={hemisphereRef} args={[preset.hemisphereSky, preset.hemisphereGround, preset.hemisphere]} />
      <directionalLight
        ref={sunRef}
        position={preset.sunPosition}
        intensity={preset.sun}
        color={preset.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={6}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={500}
      />
    </>
  )
}

// ---------- village ----------

const VILLAGE_TREE_SPOTS = (() => {
  const random = seededRandom(1957)
  const spots = []
  const candidates = [
    [-48, 60], [-52, 95], [-40, 120], [48, 95], [62, 110], [56, 70], [-60, -30], [-75, -60], [-30, -80],
    [52, -40], [70, -70], [88, -20], [-95, 30], [-100, 80], [100, 40], [110, 90], [-20, 140], [30, 135],
    [-110, -40], [95, -95], [-70, 140], [75, 150], [-130, 110], [130, 10],
  ]
  for (const [x, z] of candidates) spots.push([x + (random() - 0.5) * 6, z + (random() - 0.5) * 6, Math.floor(random() * 3), random() * Math.PI * 2])
  return spots
})()

const DAY_MOMENTS = ['e1957morning', 'e0930', 'e1700', 'eslip']
const SNOW_BOX = [-90, 110, -40, 160]
const WINDOW_WARM = new THREE.Color('#ffcf8a')
const WINDOW_RED = new THREE.Color('#ff2a2f')

function Village({ state, engraved }) {
  const street = useGLTF(`${ASSETS}/main_street.glb`, false)
  const vehicles = useGLTF(`${ASSETS}/vehicles.glb`, false)
  const people = useGLTF(`${ASSETS}/people.glb`, false)
  const props = useGLTF(`${ASSETS}/props.glb`, false)

  const village = useMemo(() => {
    const scene = street.scene.clone(true)
    const windows = []
    const outline = []
    const roofs = []
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
      const name = object.material.name
      if (name.startsWith('window_warm')) {
        object.material.toneMapped = false
        windows.push(object.material)
      }
      if (name.startsWith('red_glow')) {
        object.material.toneMapped = false
        object.castShadow = false
        outline.push(object)
      }
      if (name.includes('roof')) roofs.push({ material: object.material, color: object.material.color.clone() })
    })
    scene.updateMatrixWorld(true)
    const body = scene.getObjectByName('hardware_store_body')
    const pool = scene.getObjectByName('hardware_store_light_pool')
    const poolMaterial = new THREE.MeshBasicMaterial({ color: '#ff2a2f', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
    pool.traverse((object) => {
      if (object.isMesh) object.material = poolMaterial
    })
    const storeWindows = []
    body.parent.traverse((object) => {
      if (object.isMesh && object.material.name?.startsWith('window_warm')) {
        object.material.color.set('#2b2724')
        storeWindows.push(object.material)
      }
    })
    const frontDoor = scene.getObjectByName('hardware_store_door')
    const rearLot = new THREE.Vector3()
    scene.getObjectByName('hardware_store_rear_lot').getWorldPosition(rearLot)
    const storeBox = new THREE.Box3().setFromObject(body)
    const storeCentre = storeBox.getCenter(new THREE.Vector3())
    if (engraved) {
      const fill = new THREE.MeshBasicMaterial({ color: '#0b0b0c' })
      const lineMaterial = new THREE.LineBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0.85 })
      const meshes = []
      scene.traverse((object) => {
        if (object.isMesh) meshes.push(object)
      })
      for (const mesh of meshes) {
        const isWindow = mesh.material.name?.startsWith('window_warm')
        mesh.material = isWindow ? new THREE.MeshBasicMaterial({ color: '#f0e6d0', toneMapped: false }) : fill
        if (!isWindow) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), lineMaterial))
      }
      outline.forEach((object) => {
        object.visible = false
      })
      pool.visible = false
    }
    return { scene, windows, outline, roofs, pool, frontDoor, rearLot, storeBox, storeCentre, storeWindows }
  }, [street, engraved])

  // Labels keep clear of the store's red outline; their leader lines reach in to it.
  useEffect(() => (engraved ? undefined : registerObstacle('store', () => village.storeBox)), [village, engraved])

  useEffect(() => {
    anchors.set('store', village.storeCentre.clone().setY(village.storeBox.max.y))
    anchors.set('store_rear', village.rearLot.clone())
    return () => {
      anchors.delete('store')
      anchors.delete('store_rear')
    }
  }, [village])

  const parkedCars = useMemo(() => {
    const spots = [
      { position: [-7.2, 0, 26], rotation: Math.PI / 2, tint: '#3d3e42' },
      { position: [7.4, 0, 62], rotation: -Math.PI / 2, tint: '#4b4842' },
      { position: [-7.2, 0, 70], rotation: Math.PI / 2, tint: '#2f3338' },
      { position: [7.4, 0, -22], rotation: -Math.PI / 2, tint: '#44464b' },
      { position: [-30, 0, -6.8], rotation: 0, tint: '#3a3936' },
    ]
    return spots.map((spot, index) => {
      const object = cloneNode(vehicles, 'ford49_sedan', { tint: spot.tint })
      object.position.set(...spot.position)
      object.rotation.y = spot.rotation
      object.name = `parked_${index}`
      return object
    })
  }, [vehicles])

  const event = engraved ? null : state.eventId
  const snowy = DAY_MOMENTS.includes(event)
  const storeKnown = !engraved && visibleAt(placeById('store'), event)
  const crimeMoment = event === 'e1700' || event === 'eslip'
  const light = engraved ? 'night' : state.light
  const frontX = village.storeBox.min.x
  const storeZ = village.storeCentre.z
  const storeTop = village.storeBox.max.y
  const door = [frontX - 0.8, storeZ + 0.5]

  // 5:00 PM: Frank Worden walks up to the front door; it opens; the red shows inside, from the street only.
  const doorOpenAt = event === 'e1700' ? 2.5 : -10
  const redAt = event === 'e1700' ? 2.9 : -10
  const slipRef = useRef()

  useFrame((_, delta) => {
    const seconds = shotSeconds(state)
    const preset = LIGHTING[light] ?? LIGHTING.dusk
    const red = crimeMoment ? smoothstep((seconds - redAt) / 0.9) : 0
    for (const material of village.windows) {
      const isStore = village.storeWindows.includes(material)
      if (isStore && red > 0) {
        material.emissive.copy(WINDOW_WARM).lerp(WINDOW_RED, red)
        material.emissiveIntensity = 0.3 + 1.6 * red
        continue
      }
      if (isStore) material.emissive.copy(WINDOW_WARM)
      const goal = preset.window * (engraved ? 0.6 : 1)
      material.emissiveIntensity += (goal - material.emissiveIntensity) * Math.min(1, delta * 1.5)
    }
    for (const roof of village.roofs) {
      roof.material.color.copy(roof.color)
      if (snowy) roof.material.color.lerp(new THREE.Color('#c4c8cf'), 0.55)
    }
    for (const object of village.outline) {
      if (object.name.includes('light_pool')) continue
      object.visible = storeKnown
      object.material.emissiveIntensity = crimeMoment ? 2.4 : 1.3
    }
    village.pool.visible = red > 0.05
    village.frontDoor.rotation.y = crimeMoment ? -1.2 * smoothstep((seconds - doorOpenAt) / 0.6) : 0
    const slip = slipRef.current
    if (slip) {
      const rise = easeInOut((seconds - 0.2) / 1.5)
      slip.position.set(village.storeCentre.x - 2, 1.2 + (storeTop + 4.5 - 1.2) * rise + Math.sin(seconds * 1.8) * 0.15, storeZ)
      slip.material.opacity = smoothstep(seconds / 0.4)
    }
  })

  const truckTrack = (seconds) => {
    if (!storeKnown) return null
    if (event === 'e0930') {
      const travel = 34 * easeInOut((seconds - 0.5) / 2.6)
      return { x: village.rearLot.x + 3 + travel, z: village.rearLot.z, heading: 0, travel }
    }
    // Before 9:30 the truck stands at the rear lot; after it the lot is empty.
    return event === 'e1957morning' ? { x: village.rearLot.x + 3, z: village.rearLot.z, heading: 0, travel: 0 } : null
  }
  const frankTrack = walkPath([frontX - 15, storeZ + 7], door, 0.1, 2.4, { finalHeading: 0 })
  const showDeputies = event === 'eslip'

  return (
    <group>
      {engraved ? null : <TimeOfDay light={light} shadowSize={110} />}
      {engraved ? <Stars radius={260} depth={60} count={2600} factor={5} saturation={0} fade speed={0} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color={engraved ? '#0b0b0c' : snowy ? '#43464c' : '#1a1b1e'} roughness={1} />
      </mesh>
      <primitive object={village.scene} />
      {parkedCars.map((car) => <primitive key={car.name} object={car} />)}
      <Trees props={props} spots={VILLAGE_TREE_SPOTS} />
      {snowy ? <Snow box={SNOW_BOX} /> : null}
      {engraved ? null : (
        <Vehicle vehicles={vehicles} name="pickup_generic" track={truckTrack} state={state}>
          {event === 'e0930' ? <Tag position={[0, 2.2, 0]} text="STORE TRUCK" sub="generic pickup, make unknown" priority={80} /> : null}
        </Vehicle>
      )}
      {event === 'e1957morning' ? (
        <>
          <Vehicle vehicles={vehicles} name="pickup_generic" tint="#3b4636" state={state} track={laneTrack({ x: 2.4, fromZ: -30, toZ: 130, start: 0, duration: 4.2 })}>
            <Tag position={[0, 2.4, 0]} text="DEER SEASON" sub="opening day" priority={70} />
          </Vehicle>
          <Vehicle vehicles={vehicles} name="ford49_sedan" tint="#5a2b28" state={state} track={laneTrack({ x: -2.4, fromZ: 140, toZ: -30, start: 0.6, duration: 4.4 })} />
        </>
      ) : null}
      {crimeMoment ? (
        <Actor people={people} tint="white" standPose="man_entering_doorway" state={state} track={event === 'e1700' ? frankTrack : () => ({ x: door[0], z: door[1], heading: 0, moving: false })}>
          <Tag position={[0, 1.9, 0]} text="FRANK WORDEN" sub="her son, a deputy" priority={92} />
        </Actor>
      ) : null}
      {crimeMoment ? <pointLight position={[village.storeCentre.x - 2, 1.4, storeZ]} color="#ff2a2f" intensity={event === 'eslip' ? 30 : 0} distance={16} decay={1.6} /> : null}
      {showDeputies ? (
        <>
          <Actor people={people} tint="blue" standPose="police_hands_on_hips" state={state} track={walkPath([frontX - 20, storeZ - 10], [frontX - 6, storeZ - 4], 0, 1.8, { finalHeading: 0.3 })} />
          <Actor people={people} tint="blue" standPose="police_standing" state={state} track={walkPath([frontX - 22, storeZ + 12], [frontX - 5, storeZ + 5], 0.3, 2.1, { finalHeading: -0.4 })}>
            <Tag position={[0, 1.9, 0]} text="DEPUTIES" priority={70} />
          </Actor>
          <sprite ref={slipRef} scale={[2.4, 3.2, 1]} renderOrder={3}>
            <spriteMaterial map={getSlipTexture()} transparent depthTest={false} toneMapped={false} />
          </sprite>
          <SlipTag slipRef={slipRef} />
        </>
      ) : null}
      {(event === 'e1957morning' || event === 'e0930') && storeKnown ? (
        <Tag position={[village.storeCentre.x, storeTop + 1.5, storeZ]} text="BERNICE WORDEN" sub="store owner, 58, Worden Hardware" red priority={90} />
      ) : null}
      {crimeMoment ? <Tag position={[village.storeCentre.x, storeTop + 1.5, storeZ + 3]} text="WORDEN HARDWARE" sub="seen from the street" red priority={88} /> : null}
      {engraved ? null : <MapName position={[-2, 0.4, 90]} text="MAIN STREET" size="street" />}
    </group>
  )
}

// The slip's tag follows the floating paper.
function SlipTag({ slipRef }) {
  const groupRef = useRef()
  useFrame(() => {
    if (slipRef.current && groupRef.current) groupRef.current.position.copy(slipRef.current.position)
  })
  return (
    <group ref={groupRef}>
      <Tag position={[0, 1.8, 0]} text="SALES SLIP" sub="antifreeze, the last receipt" red priority={96} />
    </group>
  )
}

// ---------- farm ----------

const FARM_TREE_SPOTS = (() => {
  const random = seededRandom(1958)
  const spots = []
  const candidates = [[-30, -10], [-34, 14], [28, -40], [34, 6], [-26, -38], [-40, 30], [40, 34], [22, 46], [-18, 50], [46, -18], [-48, -24], [10, -52]]
  for (const [x, z] of candidates) spots.push([x + (random() - 0.5) * 5, z + (random() - 0.5) * 5, Math.floor(random() * 3), random() * Math.PI * 2])
  return spots
})()

const POLICE_CARS = [
  { final: [9, 0, 14], start: [70, 0, 14], rotation: Math.PI, delay: 0 },
  { final: [13, 0, 2], start: [76, 0, 2], rotation: Math.PI + 0.2, delay: 0.5 },
  { final: [16, 0, -8], start: [80, 0, -8], rotation: Math.PI - 0.15, delay: 0.9 },
]

// Generator flood lamps, switched on one by one once the cars are in.
const LAMP_RIGS = [
  { position: [9, 0, 9], aim: [0, 2, 0], rotation: -2.3, on: 0.9 },
  { position: [-11, 0, -9], aim: [-2, 1.5, -16], rotation: 0.6, on: 1.4 },
  { position: [-12, 0, 12], aim: [-3, 1.5, 2], rotation: 2.4, on: 1.9 },
  { position: [12, 0, -14], aim: [2, 2, -10], rotation: -0.9, on: 2.3 },
]

function Farm({ state }) {
  const farm = useGLTF(`${ASSETS}/farm.glb`, false)
  const vehicles = useGLTF(`${ASSETS}/vehicles.glb`, false)
  const people = useGLTF(`${ASSETS}/people.glb`, false)
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const lights = useGLTF(`${ASSETS}/lights.glb`, false)

  const farmScene = useMemo(() => {
    const scene = farm.scene.clone(true)
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
    })
    scene.updateMatrixWorld(true)
    const house = scene.getObjectByName('farmhouse')
    const houseMaterials = []
    house.traverse((object) => {
      if (object.isMesh) {
        object.material.transparent = true
        houseMaterials.push(object.material)
      }
    })
    const box = new THREE.Box3().setFromObject(house)
    const footprint = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(box.min.x, 0.06, box.min.z), new THREE.Vector3(box.max.x, 0.06, box.min.z),
        new THREE.Vector3(box.max.x, 0.06, box.max.z), new THREE.Vector3(box.min.x, 0.06, box.max.z),
      ]),
      new THREE.LineBasicMaterial({ color: '#b9bcc2', transparent: true, opacity: 0 }),
    )
    const ashes = new THREE.Mesh(
      new THREE.PlaneGeometry(box.max.x - box.min.x, box.max.z - box.min.z),
      new THREE.MeshBasicMaterial({ color: '#ff5a1a', map: getGlowTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    ashes.rotation.x = -Math.PI / 2
    ashes.position.set((box.min.x + box.max.x) / 2, 0.05, (box.min.z + box.max.z) / 2)
    return { scene, house, houseMaterials, footprint, ashes, centre: box.getCenter(new THREE.Vector3()), top: box.max.y }
  }, [farm])

  const ford = useMemo(() => {
    const object = cloneNode(vehicles, 'ford49_sedan')
    object.position.set(-14, 0, 4)
    object.rotation.y = 0.5
    return object
  }, [vehicles])
  const policeCars = useMemo(() => POLICE_CARS.map(() => cloneNode(vehicles, 'police_car_generic')), [vehicles])
  const roofLamps = useMemo(() => policeCars.map((car) => {
    let lamp = null
    car.traverse((object) => {
      if (object.isMesh && object.material.name?.startsWith('police_blue')) {
        object.material.toneMapped = false
        lamp = object.material
      }
    })
    return lamp
  }), [policeCars])
  const lampRigs = useMemo(() => LAMP_RIGS.map((rig) => {
    const object = lights.scene.getObjectByName('lights').clone(true)
    object.position.set(...rig.position)
    object.rotation.y = rig.rotation
    const glass = []
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.material = child.material.clone()
        if (child.material.name?.startsWith('lamp_warm')) {
          child.material.toneMapped = false
          glass.push(child.material)
        }
      }
    })
    object.updateMatrixWorld(true)
    const head = object.getObjectByName('flood_lamp_head')
    const headPosition = head.getWorldPosition(new THREE.Vector3())
    const target = new THREE.Object3D()
    target.position.set(...rig.aim)
    return { object, headPosition, target, glass, on: rig.on }
  }), [lights])

  useEffect(() => {
    anchors.set('farm', new THREE.Vector3(0, 10, -6))
    return () => anchors.delete('farm')
  }, [])

  const event = state.eventId
  const search = event === 'enight'
  const fire = event === 'e1958fire'
  const carRefs = useRef([])
  const spotRefs = useRef([])
  const fireLightRef = useRef()

  useFrame(() => {
    const seconds = shotSeconds(state)
    POLICE_CARS.forEach((plan, index) => {
      const car = carRefs.current[index]
      if (!car) return
      const progress = search ? easeInOut((seconds - plan.delay) / 1.8) : 0
      car.position.set(plan.start[0] + (plan.final[0] - plan.start[0]) * progress, 0, plan.start[2] + (plan.final[2] - plan.start[2]) * progress)
      car.visible = search
    })
    roofLamps.forEach((material, index) => {
      if (material) material.emissiveIntensity = search ? 2.5 + 2.5 * Math.sin(seconds * 6 + index * 1.7) ** 2 : 0
    })
    // Each lamp switches on with a short flicker.
    lampRigs.forEach((rig, index) => {
      const since = seconds - rig.on
      const flicker = since > 0 && since < 0.3 ? (Math.sin(since * 70) > 0 ? 1 : 0.2) : 1
      const level = search && since > 0 ? flicker : 0
      if (spotRefs.current[index]) spotRefs.current[index].intensity = 240 * level
      for (const material of rig.glass) material.emissiveIntensity = 0.2 + 4 * level
    })
    // 20 Mar 1958: the house flickers orange, then fades to its footprint.
    const glow = fire ? smoothstep(seconds / 0.5) * (1 - smoothstep((seconds - 1.9) / 0.8)) : 0
    const flicker = 0.7 + 0.3 * Math.sin(seconds * 23) * Math.sin(seconds * 7.3)
    const opacity = fire ? 1 - smoothstep((seconds - 1.6) / 0.9) : 1
    for (const material of farmScene.houseMaterials) {
      material.emissive.set('#ff6a1a')
      material.emissiveIntensity = glow * flicker * 1.4
      material.opacity = opacity
      material.depthWrite = opacity > 0.9
    }
    farmScene.house.visible = opacity > 0.01
    farmScene.footprint.material.opacity = fire ? 0.85 * smoothstep((seconds - 2.0) / 0.5) : 0
    // What is left glows faintly where the house stood, so the end of the beat is not an empty frame.
    const embers = fire ? smoothstep((seconds - 1.4) / 0.8) * (0.55 + 0.15 * Math.sin(seconds * 5)) : 0
    farmScene.ashes.material.opacity = embers
    if (fireLightRef.current) fireLightRef.current.intensity = glow * flicker * 160 + embers * 40
  })

  return (
    <group>
      <TimeOfDay light="night" shadowSize={70} />
      {fire ? <hemisphereLight args={['#3a4660', '#0a0a0c', 0.6]} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#1b1c1f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 40]} receiveShadow>
        <planeGeometry args={[900, 7]} />
        <meshStandardMaterial color="#232427" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.012, 30]} receiveShadow>
        <planeGeometry args={[4, 22]} />
        <meshStandardMaterial color="#222326" roughness={1} />
      </mesh>
      <primitive object={farmScene.scene} />
      <primitive object={farmScene.footprint} />
      <primitive object={farmScene.ashes} />
      {fire ? null : <primitive object={ford} />}
      <Trees props={props} spots={FARM_TREE_SPOTS} />
      <pointLight ref={fireLightRef} position={[farmScene.centre.x, farmScene.top * 0.6, farmScene.centre.z]} color="#ff7a2a" intensity={0} distance={50} decay={1.4} />
      {policeCars.map((car, index) => (
        <group key={index} ref={(element) => (carRefs.current[index] = element)} rotation={[0, POLICE_CARS[index].rotation, 0]}>
          <primitive object={car} />
          {search ? <pointLight position={[-0.35, 2.2, 0]} color="#3f7fe0" intensity={14} distance={18} decay={1.5} /> : null}
          {search ? <pointLight position={[3, 0.8, 0]} color="#fff2d0" intensity={10} distance={14} decay={1.6} /> : null}
        </group>
      ))}
      {search
        ? lampRigs.map((rig, index) => (
            <group key={index}>
              <primitive object={rig.object} />
              <primitive object={rig.target} />
              <spotLight
                ref={(element) => (spotRefs.current[index] = element)}
                position={rig.headPosition}
                target={rig.target}
                color="#ffd9a0"
                intensity={0}
                distance={60}
                angle={0.62}
                penumbra={0.7}
                decay={1.8}
                castShadow={index === 0}
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0005}
              />
            </group>
          ))
        : null}
      {search ? (
        <>
          <Actor people={people} tint="blue" standPose="police_flashlight" state={state} track={walkPath([20, 16], [-6, 9], 0.8, 3.2, { finalHeading: Math.PI / 2 + 0.2 })} />
          <Actor people={people} tint="blue" standPose="police_standing" state={state} track={walkPath([18, 6], [2, 12], 1.0, 3.0, { finalHeading: Math.PI / 2 })}>
            <Tag position={[0, 1.9, 0]} text="SHERIFF'S DEPUTIES" priority={75} />
          </Actor>
          <Actor people={people} tint="blue" standPose="police_hands_on_hips" state={state} track={walkPath([16, -6], [-12, -3], 1.2, 3.6, { finalHeading: 0.4 })} />
          <Actor people={people} tint="blue" standPose="police_flashlight" state={state} track={walkPath([14, 2], [8, 5], 1.4, 2.4, { finalHeading: 2.2 })} />
          <Figure people={people} pose="police_walking" tint="blue" position={[-1, 0, 18]} rotation={0} walk={{ speed: 1.2, length: 16 }} />
          <Tag position={[0, 11, -4]} text="GEIN FARM, THAT NIGHT" sub="seen from outside only" red priority={95} />
        </>
      ) : (
        <Tag position={[0, fire ? 4 : 11, -4]} text={fire ? 'FARMHOUSE BURNED, 20 MAR 1958' : 'GEIN FARM'} sub={fire ? 'arson suspected, never proven' : 'map point only, private land'} red priority={95} />
      )}
    </group>
  )
}

// ---------- generic buildings: the Pine Grove tavern and the West Plainfield grocery ----------
// Both lots are unknown: each is a generic building on a dark ground, labelled as such.

const VIGNETTE_TREE_SPOTS = (() => {
  const random = seededRandom(1954)
  const candidates = [[-16, -4], [-20, 10], [16, -16], [22, -2], [-12, -22], [26, 18], [-26, 24], [8, -28]]
  return candidates.map(([x, z]) => [x + (random() - 0.5) * 4, z + (random() - 0.5) * 4, Math.floor(random() * 3), random() * Math.PI * 2])
})()

function useBuilding(file, doorName) {
  const gltf = useGLTF(`${ASSETS}/${file}.glb`, false)
  return useMemo(() => {
    const scene = gltf.scene.clone(true)
    const windows = []
    const glows = []
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
      if (object.material.name.startsWith('window_warm')) {
        object.material.toneMapped = false
        windows.push(object.material)
      }
      if (object.material.name.startsWith('red_glow')) {
        object.material.toneMapped = false
        glows.push(object)
      }
    })
    scene.updateMatrixWorld(true)
    const door = scene.getObjectByName(doorName)
    const doorPosition = door.getWorldPosition(new THREE.Vector3())
    const box = new THREE.Box3().setFromObject(scene)
    return { scene, windows, glows, door, doorPosition, box }
  }, [gltf, doorName])
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial color="#1b1c1f" roughness={1} />
    </mesh>
  )
}

// 8 Dec 1954: a customer's car pulls up, a grey silhouette walks to the door, it opens on an empty, red-lit room.
function Tavern({ state }) {
  const building = useBuilding('tavern', 'tavern_door')
  const vehicles = useGLTF(`${ASSETS}/vehicles.glb`, false)
  const people = useGLTF(`${ASSETS}/people.glb`, false)
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const doorX = building.doorPosition.x
  const front = building.box.max.z
  const redLightRef = useRef()
  useFrame(() => {
    const seconds = shotSeconds(state)
    building.door.rotation.y = -1.2 * smoothstep((seconds - 2.0) / 0.6)
    const red = smoothstep((seconds - 2.3) / 0.8)
    for (const material of building.windows) {
      material.emissive.copy(WINDOW_WARM).lerp(WINDOW_RED, red)
      material.emissiveIntensity = 0.5 + 1.2 * red
    }
    for (const glow of building.glows) glow.visible = red > 0.05
    if (redLightRef.current) redLightRef.current.intensity = 26 * red
  })
  const carTrack = (seconds) => {
    const progress = easeInOut(seconds / 1.2)
    return { x: 26 - 14 * progress, z: front + 6.5, heading: Math.PI, travel: 14 * progress }
  }
  return (
    <group>
      <TimeOfDay light="dusk" shadowSize={50} />
      <Ground />
      <primitive object={building.scene} />
      <Trees props={props} spots={VIGNETTE_TREE_SPOTS} />
      <pointLight ref={redLightRef} position={[doorX, 1.4, front - 2.5]} color="#ff2a2f" intensity={0} distance={14} decay={1.6} />
      <Vehicle vehicles={vehicles} name="ford49_sedan" tint="#3a3936" state={state} track={carTrack} />
      <Actor people={people} tint="grey" standPose="townsperson_standing" state={state} track={walkPath([10.5, front + 5], [doorX, front + 1.2], 1.0, 2.2, { finalHeading: Math.PI / 2 })} />
      <Tag position={[0, building.box.max.y + 1, building.box.getCenter(new THREE.Vector3()).z]} text="MARY HOGAN" sub="tavern keeper, 8 Dec 1954" red priority={99} />
      <Tag position={[building.box.min.x, 2.5, front]} text="TAVERN, TOWN OF PINE GROVE" sub="generic building, lot unknown" priority={80} />
    </group>
  )
}

// That night: a grey silhouette is walked from the door to a police car, which closes on him. Lot unknown.
function Grocery({ state }) {
  const building = useBuilding('grocery', 'grocery_door')
  const vehicles = useGLTF(`${ASSETS}/vehicles.glb`, false)
  const people = useGLTF(`${ASSETS}/people.glb`, false)
  const props = useGLTF(`${ASSETS}/props.glb`, false)
  const front = building.box.max.z
  const doorX = building.doorPosition.x
  const car = useMemo(() => {
    const object = cloneNode(vehicles, 'police_car_generic')
    object.position.set(6.8, 0, front + 6.5)
    let lamp = null
    let rearDoor = null
    object.traverse((child) => {
      if (child.isMesh && child.material.name?.startsWith('police_blue')) {
        child.material.toneMapped = false
        lamp = child.material
      }
      if (child.name === 'police_car_door_rear_left') rearDoor = child
    })
    return { object, lamp, rearDoor }
  }, [vehicles, front])
  const carDoor = [6.8 - 0.4, front + 5.2]
  useFrame(() => {
    const seconds = shotSeconds(state)
    if (car.lamp) car.lamp.emissiveIntensity = 2.5 + 2.5 * Math.sin(seconds * 6) ** 2
    const open = smoothstep((seconds - 0.6) / 0.4) * (1 - smoothstep((seconds - 1.9) / 0.35))
    if (car.rearDoor) car.rearDoor.rotation.y = 1.1 * open
    for (const material of building.windows) material.emissiveIntensity = 1.1
  })
  return (
    <group>
      <TimeOfDay light="night" shadowSize={50} />
      <Ground />
      <primitive object={building.scene} />
      <Trees props={props} spots={VIGNETTE_TREE_SPOTS} />
      <primitive object={car.object} />
      <pointLight position={[6.4, 2.3, front + 6.5]} color="#3f7fe0" intensity={18} distance={18} decay={1.5} />
      <pointLight position={[doorX, 2.6, front + 1.5]} color="#ffd29a" intensity={8} distance={10} decay={1.6} />
      <Actor people={people} tint="grey" standPose="townsperson_standing" state={state} track={walkPath([doorX, front + 1.3], [carDoor[0] - 0.6, carDoor[1] - 0.7], 0.1, 1.5, { hideAfter: 1.8 })}>
        <Tag position={[0, 1.9, 0]} text="EDWARD GEIN" sub="taken into custody, that night" priority={95} />
      </Actor>
      <Actor people={people} tint="blue" standPose="police_standing" state={state} track={walkPath([doorX + 1.2, front + 0.8], [carDoor[0] + 0.8, carDoor[1] - 1.2], 0.1, 1.5, { finalHeading: Math.PI / 2 })} />
      <Tag position={[building.box.min.x, 2.5, front]} text="WEST PLAINFIELD" sub="Hill grocery or the Hills' home; generic building" red priority={85} />
    </group>
  )
}

// ---------- opening panorama ----------

function Opening() {
  return <Village state={{ eventId: null, light: 'night', shotStartedAt: 0 }} engraved />
}

// ---------- camera ----------

const ORBIT_SPEED = { county: 0.03, village: 0.035, farm: 0.08, tavern: 0.07, grocery: 0.07 }

function CameraRig({ view, scale, intro }) {
  const controlsRef = useRef()
  const { camera } = useThree()

  useEffect(() => {
    const county = scale === 'county'
    camera.near = county ? 20 : 0.3
    camera.far = county ? 160000 : 2500
    camera.updateProjectionMatrix()
    const controls = controlsRef.current
    controls.minDistance = county ? 800 : 6
    controls.maxDistance = county ? 60000 : 420
    controls.maxPolarAngle = Math.PI * 0.46
  }, [scale, camera])

  useEffect(() => {
    if (!view) return
    const controls = controlsRef.current
    controls.smoothTime = view.instant ? 0 : view.smoothTime ?? 1.25
    controls.setLookAt(...view.position, ...view.target, !view.instant)
  }, [view])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (intro === 'title') controls.azimuthAngle += delta * (window.filmMode ? 0.03 : 0.018)
    // A very slow orbit keeps every held shot alive.
    else controls.rotate(delta * (ORBIT_SPEED[scale] ?? 0.03), 0, true)
  })

  return <CameraControls ref={controlsRef} makeDefault smoothTime={1.25} draggingSmoothTime={0.25} dollySpeed={0.4} />
}

// ---------- effects ----------

function Effects({ scale, extra = '', children = null }) {
  // No ambient occlusion on the county map or in portrait: under the portrait view offset it produced stray NaN
  // pixels that bloom spread into an all-black frame.
  const withAmbientOcclusion = scale !== 'county' && window.innerHeight <= window.innerWidth
  return (
    // Keyed on the pass list: a composer whose passes change in place kept showing its last frame.
    <EffectComposer key={(withAmbientOcclusion ? 'ao' : 'plain') + extra} multisampling={4} enableNormalPass={false}>
      {children}
      {withAmbientOcclusion ? <N8AO aoRadius={2.4} intensity={2.2} distanceFalloff={1} halfRes quality="medium" /> : null}
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.8} luminanceSmoothing={0.2} radius={0.72} />
      <Noise opacity={0.075} premultiply={false} />
      <Vignette offset={0.22} darkness={0.78} />
    </EffectComposer>
  )
}

function Projector() {
  const { camera, size, scene } = useThree()
  window.appScene = scene
  useEffect(() => {
    window.appCamera = camera
    window.appProject = (key) => {
      const anchor = anchors.get(key) ?? (placeById(key) ? new THREE.Vector3(...placePosition(key)).setY(MAP_LINE_HEIGHT) : null)
      if (!anchor) return null
      const projected = anchor.clone().project(camera)
      return { x: (projected.x * 0.5 + 0.5) * size.width, y: (-projected.y * 0.5 + 0.5) * size.height }
    }
  }, [camera, size])
  return null
}

// Portrait: a wider lens; the projection centre sits a little low, in the middle of the band between the
// timeline and the caption.
const PORTRAIT_FOV = 58
const LANDSCAPE_FOV = 38
const PORTRAIT_CENTRE_SHIFT = -0.03

// The opening panorama in portrait: a longer lens with the street just under the title, so it fills the frame.
const PORTRAIT_OPENING_FOV = 30
const PORTRAIT_OPENING_SHIFT = -0.02

function PortraitLens({ opening }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (size.height > size.width) {
      const shift = opening ? PORTRAIT_OPENING_SHIFT : PORTRAIT_CENTRE_SHIFT
      camera.fov = opening ? PORTRAIT_OPENING_FOV : PORTRAIT_FOV
      camera.setViewOffset(size.width, size.height, 0, Math.round(size.height * shift), size.width, size.height)
    } else {
      camera.fov = LANDSCAPE_FOV
      camera.clearViewOffset()
    }
    camera.updateProjectionMatrix()
  }, [camera, size, opening])
  return null
}

function LabelProjector() {
  const { camera, size } = useThree()
  useFrame((_, delta) => layoutLabels(camera, size.width, size.height, delta))
  return null
}

function FpsProbe() {
  const frames = useRef([])
  useFrame(() => {
    frames.current.push(performance.now())
    if (frames.current.length > 240) frames.current.shift()
    window.appFrameTimes = frames.current
  })
  return null
}

export function World({ map, state, view }) {
  const live = state.intro === 'done'
  const scale = live ? state.scale : 'village'
  return (
    <Canvas
      shadows="soft"
      dpr={Math.min(2, window.devicePixelRatio || 1)}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      camera={{ position: [-120, 14, 130], fov: 38, near: 0.3, far: 2500 }}
    >
      <color attach="background" args={['#0b0b0c']} />
      {state.intro === 'title' ? <Opening /> : null}
      {live && scale === 'county' && map ? <County map={map} state={state} /> : null}
      {live && scale === 'county' ? <CountyBackground /> : null}
      {live && scale === 'village' ? <Village state={state} /> : null}
      {live && scale === 'farm' ? <Farm state={state} /> : null}
      {live && scale === 'tavern' ? <Tavern state={state} /> : null}
      {live && scale === 'grocery' ? <Grocery state={state} /> : null}
      <CameraRig view={view} scale={scale} intro={state.intro} />
      <Effects scale={scale} />
      <PortraitLens opening={state.intro === 'title'} />
      <Projector />
      <LabelProjector />
      <FpsProbe />
    </Canvas>
  )
}

function CountyBackground() {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color('#0d0d0f')
    scene.fog = null
  }, [scene])
  return null
}

for (const file of ['terrain', 'main_street', 'vehicles', 'people', 'props', 'farm', 'lights', 'tavern', 'grocery']) useGLTF.preload(`${ASSETS}/${file}.glb`, false)

export { smoothstep, eventById }

// Shared with the documentary film page (src/film).
export {
  ASSETS, TimeOfDay, Trees, Snow, useBuilding, cloneNode, getSlipTexture, getGlowTexture, seededRandom, Effects,
  VIGNETTE_TREE_SPOTS, VILLAGE_TREE_SPOTS, FARM_TREE_SPOTS, POLICE_CARS, LAMP_RIGS,
}
