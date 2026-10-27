// The film's map: the app's traced county map (roads, streams, water, section lines, relief) on near-black,
// red X marks with a soft glow, letter-spaced place names and a red line drawn along each move.
// Places and distances come only from ed-gein-facts.md section 1. One map unit is 100 m: x east, z south,
// origin at the Worden store point (the app's frame divided by 100). Outside the county the map holds only a
// faint latitude/longitude grid, so the state-scale views claim nothing about roads they do not show.
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { ASSETS, getGlowTexture } from '../world.jsx'
import { toLocal } from '../data.js'
import { easeInOut, smoothstep } from '../anim.js'
import { clock } from './clock.js'

import { LINE_LABELS, NAME_LABELS, PLACE_LABELS } from './mapLabels.js'
import { TEXT_FADE } from './script.js'

export const MAP_URL = '/data/map.json'
export const SECTION_LINES_URL = `${ASSETS}/map/section_lines.geojson`
const SCALE = 0.01
const LINE_HEIGHT = 1
const RED = new THREE.Color('#ff2a2f')
const FONT = "'Bahnschrift', 'DIN Alternate', 'Segoe UI', sans-serif"

const mapPoint = (lat, lon) => {
  const [x, z] = toLocal(lat, lon)
  return [x * SCALE, z * SCALE]
}

// Section 1 coordinates.
const PLACES = {
  store: { point: mapPoint(44.21349, -89.49233), ...PLACE_LABELS.store },
  farm: { point: mapPoint(44.1851, -89.5828), ...PLACE_LABELS.farm },
  westPlainfield: { point: mapPoint(44.2141, -89.5527), ...PLACE_LABELS.westPlainfield, left: true },
  pineGrove: { point: mapPoint(44.2915, -89.5473), ...PLACE_LABELS.pineGrove, area: 22 },
  wautoma: { point: mapPoint(44.07371, -89.2899), ...PLACE_LABELS.wautoma, away: [-1, 0, 0.7] },
}
// Waupun and Madison lie far off the county patch: only their direction from Wautoma is drawn, as an arrow.
const WAUPUN = mapPoint(43.6204, -88.7425)
const MADISON = mapPoint(43.13, -89.401)
const ARROW_LENGTH = 62

// An arrow from a little past `from` toward `toward`, ARROW_LENGTH long, ending in the black past the patch.
function arrowPath(from, toward) {
  const dx = toward[0] - from[0]
  const dz = toward[1] - from[1]
  const length = Math.hypot(dx, dz)
  const start = [from[0] + (dx / length) * 9, from[1] + (dz / length) * 9]
  const end = [from[0] + (dx / length) * ARROW_LENGTH, from[1] + (dz / length) * ARROW_LENGTH]
  return subdivide(start, end, 60)
}

// Names without a mark. La Crosse County has no coordinates in the fact file, so its name sits at the start
// of a line that comes in from the west, marked as off this map.
const NAMES = {
  plainfield: { point: mapPoint(44.2135, -89.4923), ...NAME_LABELS.plainfield, away: [0.35, 0, -1], gap: 0.06, leader: true },
  laCrosse: { point: [-235, -14], ...NAME_LABELS.laCrosse },
}

const subdivide = (from, to, steps = 120) => Array.from({ length: steps + 1 }, (_, index) => [from[0] + ((to[0] - from[0]) * index) / steps, from[1] + ((to[1] - from[1]) * index) / steps])

// Lines: a path in map units, a distance label (section 1 figures only), dashed for a plain distance.
function buildLines(map) {
  return {
    move: { path: subdivide([-330, 30], PLACES.farm.point) },
    farmPineGrove: { path: subdivide(PLACES.farm.point, PLACES.pineGrove.point), label: LINE_LABELS.farmPineGrove, dashed: true },
    storeFarm: { path: map.route.map(([x, z]) => [x * SCALE, z * SCALE]), label: LINE_LABELS.storeFarm },
    storeWautoma: { path: subdivide(PLACES.store.point, PLACES.wautoma.point), label: LINE_LABELS.storeWautoma },
    toWaupun: { path: arrowPath(PLACES.wautoma.point, WAUPUN), label: LINE_LABELS.toWaupun, arrow: true },
    toMadison: { path: arrowPath(PLACES.wautoma.point, MADISON), label: LINE_LABELS.toMadison, arrow: true, left: true },
  }
}

function flatSegments(flat, height, color, opacity) {
  const positions = new Float32Array((flat.length / 2) * 3)
  for (let index = 0, out = 0; index < flat.length; index += 2, out += 3) {
    positions[out] = flat[index] * SCALE
    positions[out + 1] = height
    positions[out + 2] = flat[index + 1] * SCALE
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
}

function sectionLineSegments(geojson) {
  const flat = []
  for (const feature of geojson.features) {
    const geometry = feature.geometry
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : []
    for (const line of lines) {
      for (let index = 1; index < line.length; index++) {
        flat.push(...toLocal(line[index - 1][1], line[index - 1][0]), ...toLocal(line[index][1], line[index][0]))
      }
    }
  }
  return flat
}

// The county data ends in a rectangle. A black veil with a soft rounded hole over it fades every edge into the
// background, so the patch reads as a lit region of a larger dark map rather than a tile.
const PATCH_CENTRE = [-6, -40]
const PATCH_HALF = [205, 285]
function featherVeil() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  // The plane is twice the patch on each axis, so the patch is the middle 256 pixels. Black everywhere, then a
  // blurred rounded hole a little inside the patch edge: a soft falloff on every side, corners included.
  context.fillStyle = '#000'
  context.fillRect(0, 0, 512, 512)
  context.globalCompositeOperation = 'destination-out'
  context.filter = 'blur(14px)'
  context.beginPath()
  context.roundRect(128 + 26, 128 + 26, 256 - 52, 256 - 52, 40)
  context.fill()
  const texture = new THREE.CanvasTexture(canvas)
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(PATCH_HALF[0] * 4, PATCH_HALF[1] * 4),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  )
  veil.rotation.x = -Math.PI / 2
  veil.position.set(PATCH_CENTRE[0], LINE_HEIGHT + 0.3, PATCH_CENTRE[1])
  veil.renderOrder = 5
  return veil
}

function useMapLayers() {
  // The same key as the film's preload, so the map never suspends mid-film.
  const [mapText, sectionsText] = useLoader(THREE.FileLoader, [MAP_URL, SECTION_LINES_URL])
  const map = JSON.parse(mapText)
  const sections = JSON.parse(sectionsText)
  const terrain = useGLTF(`${ASSETS}/terrain.glb`, false)
  return useMemo(() => {
    const group = new THREE.Group()
    const relief = terrain.scene.clone(true)
    relief.traverse((object) => {
      if (object.isMesh) object.material = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 1, metalness: 0 })
    })
    relief.scale.set(SCALE, SCALE * 2.5, SCALE)
    group.add(relief)
    const waterFill = new THREE.MeshBasicMaterial({ color: '#1d2024' })
    const waterEdge = new THREE.LineBasicMaterial({ color: '#7b8088', transparent: true, opacity: 0.5 })
    for (const ring of map.water) {
      const scaled = ring.map(([x, z]) => [x * SCALE, z * SCALE])
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(scaled.map(([x, z]) => new THREE.Vector2(x, -z)))), waterFill)
      fill.rotation.x = -Math.PI / 2
      fill.position.y = LINE_HEIGHT - 0.1
      group.add(fill)
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(scaled.map(([x, z]) => new THREE.Vector3(x, LINE_HEIGHT, z))), waterEdge))
    }
    group.add(flatSegments(sectionLineSegments(sections), LINE_HEIGHT - 0.05, '#6a6e75', 0.22))
    group.add(flatSegments(map.streams, LINE_HEIGHT, '#7f8790', 0.55))
    group.add(flatSegments(map.roads, LINE_HEIGHT + 0.02, '#9b9ea3', 0.3))
    group.add(flatSegments(map.highways, LINE_HEIGHT + 0.04, '#c9cbcf', 0.5))
    group.add(featherVeil())
    return { group, lines: buildLines(map) }
  }, [map, sections, terrain])
}

// A letter-spaced label on a LEMMiNO plate, drawn once into a canvas: a near-black box at 85% with a thin light
// border, a name and an optional smaller second line.
const labelCache = new Map()
const PLATE_PAD_X = 26
const PLATE_PAD_Y = 16
function labelTexture(name, sub, color) {
  const key = `${name}|${sub}|${color}`
  if (labelCache.has(key)) return labelCache.get(key)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const nameFont = `500 64px ${FONT}`
  const subFont = `400 38px ${FONT}`
  context.font = nameFont
  context.letterSpacing = '0.22em'
  const nameWidth = context.measureText(name).width
  context.font = subFont
  context.letterSpacing = '0.26em'
  const subWidth = sub ? context.measureText(sub).width : 0
  canvas.width = Math.ceil(Math.max(nameWidth, subWidth)) + PLATE_PAD_X * 2
  canvas.height = (sub ? 128 : 72) + PLATE_PAD_Y * 2
  context.fillStyle = 'rgba(8, 8, 10, 0.85)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = 'rgba(205, 207, 211, 0.8)'
  context.lineWidth = 3
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3)
  context.font = nameFont
  context.letterSpacing = '0.22em'
  context.fillStyle = color
  context.textBaseline = 'top'
  context.fillText(name, PLATE_PAD_X, PLATE_PAD_Y + 6)
  if (sub) {
    context.font = subFont
    context.letterSpacing = '0.26em'
    context.fillStyle = 'rgba(205, 207, 211, 0.9)'
    context.fillText(sub, PLATE_PAD_X, PLATE_PAD_Y + 80)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const entry = { texture, aspect: canvas.width / canvas.height, rows: canvas.height / 86 }
  labelCache.set(key, entry)
  return entry
}

// Screen-constant size: the world size that covers `fraction` of the shorter side of the frame at `distance`.
function worldSize(camera, size, distance, fraction) {
  const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  return viewHeight * fraction * (Math.min(size.width, size.height) / size.height)
}

// A plate placed `gap` (a fraction of the frame) from `anchor` in the world direction `away`, with the corner that
// faces the anchor pinned there, so the plate always grows away from its mark and the line it labels. `leader` draws
// a thin line from the anchor to the plate. Used on the map and in the 3D scenes.
const projectedAnchor = new THREE.Vector3()
const projectedAway = new THREE.Vector3()
export function Plate({ anchor, away = [0, 0, 0], gap = 0.022, name, sub, at, color = '#ecebe8', scale = 1, leader = false }) {
  const spriteRef = useRef()
  const label = useMemo(() => labelTexture(name, sub, color), [name, sub, color])
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    const material = new THREE.LineBasicMaterial({ color: '#cdcfd3', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })
    const object = new THREE.Line(geometry, material)
    object.renderOrder = 19
    object.frustumCulled = false
    return object
  }, [])
  useFrame(({ camera, size }) => {
    const sprite = spriteRef.current
    const end = clock.shotLength - clock.shotFadeOut - 0.05
    const level = smoothstep((clock.shotSeconds - at) / TEXT_FADE) * (1 - smoothstep((clock.shotSeconds - (end - TEXT_FADE)) / TEXT_FADE))
    sprite.material.opacity = level
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.034 * scale * label.rows * (Math.min(size.width, size.height) / size.height)
    sprite.scale.set(height * label.aspect, height, 1)
    const awayLength = Math.hypot(away[0], away[1], away[2])
    const distance = camera.position.distanceTo(projectedAnchor.set(...anchor))
    const shift = awayLength > 0 ? worldSize(camera, size, distance, gap) / awayLength : 0
    sprite.position.set(anchor[0] + away[0] * shift, anchor[1] + away[1] * shift, anchor[2] + away[2] * shift)
    // Which way `away` points on screen picks the pinned corner.
    projectedAnchor.set(...anchor).project(camera)
    projectedAway.copy(sprite.position).project(camera).sub(projectedAnchor)
    const screenX = projectedAway.x * size.width
    const screenY = projectedAway.y * size.height
    const screenLength = Math.hypot(screenX, screenY)
    const centreX = screenLength < 1e-6 || Math.abs(screenX) < 0.35 * screenLength ? 0.5 : screenX > 0 ? 0 : 1
    const centreY = screenLength < 1e-6 || Math.abs(screenY) < 0.35 * screenLength ? 0.5 : screenY > 0 ? 0 : 1
    sprite.center.set(centreX, centreY)
    line.visible = leader
    line.material.opacity = 0.7 * level
    const positions = line.geometry.attributes.position
    positions.setXYZ(0, anchor[0], anchor[1], anchor[2])
    positions.setXYZ(1, sprite.position.x, sprite.position.y, sprite.position.z)
    positions.needsUpdate = true
  })
  return (
    <>
      <primitive object={line} />
      <sprite ref={spriteRef} renderOrder={20}>
        <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} opacity={0} sizeAttenuation={false} />
      </sprite>
    </>
  )
}

// A plate on the map: anchored just above the map surface at `point` ([x, z] in map units).
function Label({ point, away = [1, 0, -0.6], gap = 0.024, ...rest }) {
  return <Plate anchor={[point[0], LINE_HEIGHT + 2, point[1]]} away={away} gap={gap} {...rest} />
}

// A red X lying on the map with a soft glow; it pops in at `at` and keeps one size on screen.
const markMaterial = new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(2.2), toneMapped: false, transparent: true, depthWrite: false })
function XMark({ point, at }) {
  const groupRef = useRef()
  const glowRef = useRef()
  const material = useMemo(() => markMaterial.clone(), [])
  useFrame(({ camera, size }) => {
    const group = groupRef.current
    const level = smoothstep((clock.shotSeconds - at) / 0.35)
    const distance = camera.position.distanceTo(group.position)
    const markSize = worldSize(camera, size, distance, 0.036) * (0.6 + 0.4 * level)
    group.scale.setScalar(markSize)
    material.opacity = level
    glowRef.current.material.opacity = level * 0.32
  })
  return (
    <group ref={groupRef} position={[point[0], LINE_HEIGHT + 1.5, point[1]]}>
      {[Math.PI / 4, -Math.PI / 4].map((angle) => (
        <mesh key={angle} rotation={[-Math.PI / 2, 0, angle]} material={material} renderOrder={12}>
          <planeGeometry args={[1, 0.2]} />
        </mesh>
      ))}
      <sprite ref={glowRef} scale={[4, 4, 1]} renderOrder={11}>
        <spriteMaterial map={getGlowTexture()} color={RED} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

function AreaRing({ point, radius, at }) {
  const ring = useMemo(() => {
    const points = Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    })
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: RED.clone().multiplyScalar(1.4), dashSize: radius * 0.08, gapSize: radius * 0.06, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }))
    line.computeLineDistances()
    return line
  }, [radius])
  useFrame(() => {
    ring.material.opacity = 0.85 * smoothstep((clock.shotSeconds - at) / 0.6)
  })
  return <primitive object={ring} position={[point[0], LINE_HEIGHT + 0.8, point[1]]} />
}

// A red line drawn along a path from `start` over `duration` seconds (0 = already drawn), as fat lines.
function RouteLine({ line, start, duration, labelled = true }) {
  const object = useMemo(() => {
    const positions = []
    for (let index = 1; index < line.path.length; index++) {
      positions.push(line.path[index - 1][0], LINE_HEIGHT + 0.6, line.path[index - 1][1], line.path[index][0], LINE_HEIGHT + 0.6, line.path[index][1])
    }
    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(positions)
    const material = line.dashed
      ? new LineMaterial({ color: '#e8e6e2', linewidth: 1.6, dashed: true, dashSize: 2.2, gapSize: 1.6, transparent: true, depthWrite: false })
      : new LineMaterial({ color: RED.clone().multiplyScalar(1.8), linewidth: 3.2, transparent: true, depthWrite: false, toneMapped: false })
    const segments = new LineSegments2(geometry, material)
    if (line.dashed) segments.computeLineDistances()
    segments.renderOrder = 10
    return segments
  }, [line])
  const count = line.path.length - 1
  useFrame(({ size }) => {
    object.material.resolution.set(size.width, size.height)
    const progress = duration === 0 ? (clock.shotSeconds >= start ? 1 : 0) : easeInOut((clock.shotSeconds - start) / duration)
    object.geometry.instanceCount = Math.round(progress * count)
    object.visible = progress > 0
  })
  const middleIndex = Math.floor(line.path.length / 2)
  const middle = line.path[middleIndex]
  const before = line.path[Math.max(0, middleIndex - 2)]
  const after = line.path[Math.min(line.path.length - 1, middleIndex + 2)]
  const along = [after[0] - before[0], after[1] - before[1]]
  // Of the two sides, the one further north and east.
  const side = along[0] + along[1] >= 0 ? [along[1], -along[0]] : [-along[1], along[0]]
  const lastStep = [line.path[line.path.length - 1][0] - line.path[line.path.length - 2][0], line.path[line.path.length - 1][1] - line.path[line.path.length - 2][1]]
  const tip = line.path[line.path.length - 1]
  const showLabel = labelled && line.label && (duration > 0 || line.arrow)
  return (
    <>
      <primitive object={object} />
      {line.arrow ? <ArrowHead path={line.path} start={start} duration={duration} /> : null}
      {showLabel ? (
        line.arrow
          ? <Label point={tip} away={[-0.3, 0, 1]} gap={0.014} name={line.label.name} sub={line.label.sub} at={start + duration + 0.1} scale={1.05} color="#ff8a8c" />
          : <Label point={middle} away={[side[0], 0, side[1]]} gap={0.035} leader name={line.label.name} sub={line.label.sub} at={start + duration + 0.1} scale={0.8} color={line.dashed ? '#ecebe8' : '#ff8a8c'} />
      ) : null}
    </>
  )
}

// A red arrow head at the end of a path, shown once the line has reached it; it keeps one size on screen.
const arrowShape = new THREE.Shape([new THREE.Vector2(0, 0.6), new THREE.Vector2(-0.45, -0.4), new THREE.Vector2(0.45, -0.4)])
const arrowGeometry = new THREE.ShapeGeometry(arrowShape)
function ArrowHead({ path, start, duration }) {
  const ref = useRef()
  const material = useMemo(() => markMaterial.clone(), [])
  const tip = path[path.length - 1]
  const before = path[path.length - 2]
  const angle = Math.atan2(tip[0] - before[0], tip[1] - before[1])
  useFrame(({ camera, size }) => {
    const reached = duration === 0 ? (clock.shotSeconds >= start ? 1 : 0) : smoothstep((clock.shotSeconds - start - duration * 0.92) / 0.12)
    const mesh = ref.current
    const distance = camera.position.distanceTo(mesh.position)
    mesh.scale.setScalar(worldSize(camera, size, distance, 0.03))
    material.opacity = reached
  })
  return (
    <group position={[tip[0], LINE_HEIGHT + 0.7, tip[1]]} rotation={[0, angle + Math.PI, 0]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} geometry={arrowGeometry} material={material} renderOrder={12} />
    </group>
  )
}

// shot.map: { marks: [[id, at, label = true]], lines: [[id, start, duration, label = true]], names: [[id, at, away?]] }
// The map is seen from up to 2 km of map units away: a deeper near plane keeps depth (and the AO) clean.
function MapLens() {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    // The scene before may have left its sky colour as the background.
    scene.background = new THREE.Color('#000000')
    scene.fog = null
    camera.near = 2
    camera.far = 8000
    camera.updateProjectionMatrix()
    return () => {
      camera.near = 0.1
      camera.far = 3000
      camera.updateProjectionMatrix()
    }
  }, [camera, scene])
  return null
}

export function MapScene({ shot }) {
  const layers = useMapLayers()
  const config = shot.map
  return (
    <group>
      <MapLens />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-300, 400, -200]} intensity={0.8} />
      <primitive object={layers.group} />
      {(config.lines ?? []).map(([id, start, duration, labelled = true]) => <RouteLine key={id} line={layers.lines[id]} start={start} duration={duration} labelled={labelled} />)}
      {(config.marks ?? []).map(([id, at, labelled = true]) => {
        const place = PLACES[id]
        return (
          <group key={id}>
            {place.area ? <AreaRing point={place.point} radius={place.area} at={at} /> : <XMark point={place.point} at={at} />}
            {labelled ? <Label point={place.point} away={place.away ?? (place.left ? [-1, 0, -1] : [1, 0, -1])} gap={0.028} name={place.name} sub={place.sub} at={at + 0.15} /> : null}
          </group>
        )
      })}
      {(config.names ?? []).map(([id, at, away]) => {
        const name = NAMES[id]
        return <Label key={id} point={name.point} away={away ?? name.away ?? [0, 0, 0]} gap={name.gap} leader={name.leader} name={name.name} sub={name.sub} at={at} scale={0.9} />
      })}
    </group>
  )
}
