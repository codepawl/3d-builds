// Faceless figures in the LEMMiNO manner: solid glowing silhouettes in period clothing, one flat colour each.
// A figure faces +z. Poses are a few joint angles; walking is a sine cycle driven by distance travelled,
// so feet keep pace with the ground. Everything runs on the film clock (clock.shotSeconds).
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { clock } from './clock.js'

// Ed Gein keeps one colour at every age; family, deputies and townspeople have their own.
export const COLORS = {
  ed: '#d99a3c',
  george: '#5d8f6c',
  augusta: '#8d72b8',
  henry: '#4aa3a8',
  frank: '#e4e0d6',
  deputy: '#3f7fe6',
  town: '#8a8d92',
  judge: '#9a95ab',
  official: '#8f8579',
}

// One flat emissive colour per person, LEMMiNO style: no shading at all, so every part of a figure merges into a
// single silhouette, with no visible joints. The colour is lifted to the same brightness for everyone, just over
// the bloom threshold, which gives each figure the same soft glow.
const materials = new Map()
function materialFor(color) {
  if (!materials.has(color)) {
    const base = new THREE.Color(color)
    const luminance = Math.max(0.05, base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722)
    materials.set(color, new THREE.MeshBasicMaterial({ color: base.multiplyScalar(Math.min(0.95 / luminance, 1.6 / Math.max(base.r, base.g, base.b))), toneMapped: false }))
  }
  return materials.get(color)
}

const capsuleCache = new Map()
function capsule(radius, length) {
  const key = `${radius}-${length}`
  if (!capsuleCache.has(key)) capsuleCache.set(key, new THREE.CapsuleGeometry(radius, length, 4, 10))
  return capsuleCache.get(key)
}
const jointGeometry = new THREE.SphereGeometry(1, 12, 9)

function mesh(geometry, material, scale = 1) {
  const object = new THREE.Mesh(geometry, material)
  object.scale.setScalar(scale)
  object.castShadow = true
  return object
}

// A limb hanging down from its pivot: upper segment, joint, lower segment, end ball, one closed shape at any bend.
function buildLimb(body, upper, lower, radius, lowerRadius = radius * 0.85) {
  const root = new THREE.Group()
  const upperMesh = mesh(capsule(radius, upper), body)
  upperMesh.position.y = -upper / 2
  const middle = new THREE.Group()
  middle.position.y = -upper
  middle.add(mesh(jointGeometry, body, Math.max(radius, lowerRadius) * 1.02))
  const lowerMesh = mesh(capsule(lowerRadius, lower), body)
  lowerMesh.position.y = -lower / 2
  const end = mesh(jointGeometry, body, lowerRadius * 1.05)
  end.position.y = -lower
  middle.add(lowerMesh, end)
  root.add(mesh(jointGeometry, body, radius * 1.05), upperMesh, middle)
  return { root, middle }
}

// A garment that hangs from the waist: a lathe profile from `top` (radius) down `length` to the hem (radius).
function skirt(body, topRadius, hemRadius, length, depthScale = 0.8) {
  const points = []
  const steps = 8
  for (let index = 0; index <= steps; index++) {
    const along = index / steps
    points.push(new THREE.Vector2(topRadius + (hemRadius - topRadius) * along ** 1.3, -length * along))
  }
  points.push(new THREE.Vector2(0.001, -length))
  const garment = mesh(new THREE.LatheGeometry(points, 20), body)
  garment.scale.z = depthScale
  return garment
}

// Hats and hair sit on the head group (origin at the head centre).
const HEADWEAR = {
  // A flat cap: a low crown and a short peak in front.
  cap: (body) => {
    const group = new THREE.Group()
    const crown = mesh(jointGeometry, body)
    crown.scale.set(0.115, 0.055, 0.125)
    crown.position.set(0, 0.075, 0.01)
    const peak = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), body)
    peak.position.set(0, 0.06, 0.08)
    group.add(crown, peak)
    return group
  },
  // A fedora: a pinched crown and a round brim.
  fedora: (body) => {
    const group = new THREE.Group()
    const crown = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 16), body)
    crown.position.y = 0.12
    const brim = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 24), body)
    brim.position.y = 0.065
    group.add(crown, brim)
    return group
  },
  // A campaign hat: a peaked crown on a wide flat brim.
  campaign: (body) => {
    const group = new THREE.Group()
    const crown = mesh(new THREE.ConeGeometry(0.105, 0.17, 4), body)
    crown.rotation.y = Math.PI / 4
    crown.position.y = 0.15
    const brim = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 28), body)
    brim.position.y = 0.068
    group.add(crown, brim)
    return group
  },
  // Hair pinned up in a bun at the back.
  bun: (body) => {
    const bun = mesh(jointGeometry, body, 0.06)
    bun.position.set(0, 0.06, -0.09)
    return bun
  },
}

// Clothing by person: the coat or dress silhouette, its length, and the headwear. 1900s-1950s shapes.
function outfitFor(who, child, style) {
  if (style === 'old') return { garment: 'robe' }
  if (child) return { garment: 'shortCoat', hat: 'cap' }
  switch (who) {
    case 'augusta': return { garment: 'dress', hat: 'bun' }
    case 'george': return { garment: 'longCoat', hat: 'fedora' }
    case 'deputy': return { garment: 'jacket', hat: 'campaign' }
    case 'frank': return { garment: 'longCoat' }
    case 'town': return { garment: 'longCoat', hat: 'fedora' }
    case 'judge': return { garment: 'robe' }
    case 'official': return { garment: 'longCoat' }
    default: return { garment: 'workCoat', hat: 'cap' }
  }
}

// Hem lengths are measured down from the hip joint (about 0.92 above the ground for an adult).
const GARMENTS = {
  dress: (body) => skirt(body, 0.15, 0.3, 0.86, 0.85),
  robe: (body) => skirt(body, 0.16, 0.24, 0.62, 0.85),
  longCoat: (body) => skirt(body, 0.17, 0.235, 0.52, 0.8),
  workCoat: (body) => skirt(body, 0.17, 0.205, 0.3, 0.8),
  jacket: (body) => skirt(body, 0.165, 0.185, 0.17, 0.8),
  shortCoat: (body) => skirt(body, 0.165, 0.19, 0.22, 0.8),
}

const SHOULDER_X = 0.175
const HIP_X = 0.09
const THIGH = 0.44
const SHIN = 0.43
const ANKLE_TO_SOLE = 0.07

// Realistic proportions: about seven and a half heads tall, narrow waist under broader shoulders.
function buildFigure(color, who, child, style) {
  const body = materialFor(color)
  const outfit = outfitFor(who, child, style)
  const root = new THREE.Group()
  const hips = new THREE.Group()
  hips.position.y = 0.95
  root.add(hips)
  const pelvis = mesh(jointGeometry, body)
  pelvis.scale.set(0.16, 0.11, 0.11)
  hips.add(pelvis)
  const spine = new THREE.Group()
  hips.add(spine)
  // Chest wider than the waist: a tapered capsule pair.
  const waist = mesh(capsule(0.12, 0.16), body)
  waist.position.y = 0.12
  waist.scale.set(1.15, 1, 0.8)
  const chest = mesh(capsule(0.15, 0.16), body)
  chest.position.y = 0.33
  chest.scale.set(1.12, 1, 0.72)
  const shoulders = mesh(capsule(0.065, SHOULDER_X * 2), body)
  shoulders.rotation.z = Math.PI / 2
  shoulders.position.y = 0.45
  shoulders.scale.set(1, 1, 0.85)
  spine.add(waist, chest, shoulders)
  const neck = new THREE.Group()
  neck.position.y = 0.5
  spine.add(neck)
  const neckMesh = mesh(capsule(0.042, 0.07), body)
  neckMesh.position.y = 0.04
  const headGroup = new THREE.Group()
  headGroup.position.y = 0.16
  const head = mesh(jointGeometry, body)
  head.scale.set(0.09, 0.115, 0.1)
  headGroup.add(head)
  if (outfit.hat) headGroup.add(HEADWEAR[outfit.hat](body))
  // A child's head is larger for the body.
  if (child) headGroup.scale.setScalar(1.25)
  neck.add(neckMesh, headGroup)
  const arms = [1, -1].map((side) => {
    const limb = buildLimb(body, 0.29, 0.27, 0.047, 0.038)
    limb.root.position.set(SHOULDER_X * side, 0.45, 0)
    spine.add(limb.root)
    return limb
  })
  const legs = [1, -1].map((side) => {
    const limb = buildLimb(body, THIGH, SHIN, 0.072, 0.052)
    limb.root.position.set(HIP_X * side, -0.02, 0)
    hips.add(limb.root)
    const foot = mesh(capsule(0.042, 0.14), body)
    foot.rotation.x = Math.PI / 2
    foot.position.set(0, -SHIN - 0.03, 0.065)
    foot.scale.set(1, 1, 0.75)
    limb.middle.add(foot)
    return limb
  })
  // The garment hangs from the waist and moves with the hips, so the legs swing inside it.
  const garment = GARMENTS[outfit.garment](body)
  garment.position.y = 0.06
  hips.add(garment)
  return { root, hips, spine, neck, arms, legs }
}

// ---------- poses: forward-positive angles in radians ----------

function standingPose(seconds, seed) {
  const breath = Math.sin(seconds * 1.6 + seed) * 0.012
  return { lean: 0.02 + breath, head: 0.04, drop: 0, arms: [[0.05, 0.14, 0.08], [0.05, 0.14, 0.08]], legs: [[0, 0], [0, 0]] }
}

function walkingPose(phase, stride) {
  const swing = Math.sin(phase)
  const lift = Math.cos(phase)
  return {
    lean: 0.05,
    head: 0.02,
    drop: 0.02 * Math.cos(2 * phase) - 0.02,
    arms: [[-0.34 * swing * stride, 0.28, 0.07], [0.34 * swing * stride, 0.28, 0.07]],
    legs: [[0.42 * swing * stride, 0.08 + 0.6 * Math.max(0, lift) * stride], [-0.42 * swing * stride, 0.08 + 0.6 * Math.max(0, -lift) * stride]],
  }
}

const POSE_STYLE = {
  // Hands behind the back.
  cuffed: (pose) => ({ ...pose, head: 0.18, arms: [[-0.42, 0.75, -0.16], [-0.42, 0.75, -0.16]] }),
  // Holding a baby against the chest.
  cradle: (pose) => ({ ...pose, arms: [[0.55, 1.5, -0.22], [0.55, 1.5, -0.22]] }),
  // A deputy's hand on the arm of the man beside him.
  escort: (pose) => ({ ...pose, arms: [pose.arms[0], [0.55, 0.55, -0.12]] }),
  // Old age: stooped, head low, short steps.
  old: (pose) => ({ ...pose, lean: pose.lean + 0.3, head: pose.head + 0.22, arms: pose.arms.map(([forward, elbow, out]) => [forward * 0.5 + 0.12, elbow + 0.25, out]) }),
  // Head lifted toward something far away.
  watch: (pose) => ({ ...pose, head: -0.12 }),
  // Head bowed, hands folded in front: standing at a grave.
  mourn: (pose) => ({ ...pose, lean: pose.lean + 0.08, head: 0.42, arms: [[0.32, 0.9, -0.2], [0.32, 0.9, -0.2]] }),
  // Sitting on a chair or a bed edge, hands in the lap; the hips settle to seat height on their own.
  seated: (pose) => ({ ...pose, lean: 0.06, head: 0.05, legs: [[1.5, 1.5], [1.5, 1.5]], arms: [[0.5, 1.15, 0.1], [0.5, 1.15, 0.1]] }),
  // Seated, head bowed, forearms resting on the table.
  seatedBowed: (pose) => ({ ...pose, lean: 0.16, head: 0.5, legs: [[1.5, 1.5], [1.5, 1.5]], arms: [[0.95, 0.5, 0.1], [0.95, 0.5, 0.1]] }),
  // Shovelling snow: a slow bend and lift, both hands low on the handle.
  shovel: (pose, seconds) => {
    const lift = (1 - Math.cos(seconds * 2.4)) / 2
    return { ...pose, lean: 0.12 + 0.38 * lift, head: 0.2 + 0.15 * lift, arms: [[0.55 + 0.5 * lift, 0.35, -0.12], [0.75 + 0.5 * lift, 0.15, -0.05]] }
  },
}

// The hips sit exactly as high as the longer leg reaches, so the lower sole always rests on the ground:
// no floating, no sinking, whatever the knee bend.
function legReach([forward, knee]) {
  return THIGH * Math.cos(forward) + SHIN * Math.cos(knee - forward) + ANKLE_TO_SOLE
}

function applyPose(figure, pose, scale) {
  figure.hips.position.y = 0.02 + Math.max(legReach(pose.legs[0]), legReach(pose.legs[1]))
  figure.spine.rotation.x = pose.lean
  figure.neck.rotation.x = pose.head
  figure.arms.forEach((arm, index) => {
    const [forward, elbow, outward] = pose.arms[index]
    const side = index === 0 ? 1 : -1
    arm.root.rotation.set(-forward, 0, outward * side)
    arm.middle.rotation.x = -elbow
  })
  figure.legs.forEach((leg, index) => {
    const [forward, knee] = pose.legs[index]
    leg.root.rotation.x = -forward
    leg.middle.rotation.x = knee
  })
  figure.root.scale.setScalar(scale)
}

// path: [[seconds, x, z, heading?], ...]; between two different points the figure walks at constant speed.
function samplePath(path, seconds) {
  let travelled = 0
  let heading = path[0][3] ?? 0
  for (let index = 0; index < path.length - 1; index++) {
    const [startTime, x0, z0, faceStart] = path[index]
    const [endTime, x1, z1, faceEnd] = path[index + 1]
    const length = Math.hypot(x1 - x0, z1 - z0)
    const moving = length > 0.01
    if (faceStart !== undefined) heading = faceStart
    if (moving) heading = Math.atan2(x1 - x0, z1 - z0)
    if (seconds < endTime) {
      const progress = Math.max(0, (seconds - startTime) / (endTime - startTime))
      const walking = moving && seconds >= startTime
      return { x: x0 + (x1 - x0) * progress, z: z0 + (z1 - z0) * progress, heading, walking, travelled: travelled + length * progress }
    }
    travelled += length
    if (!moving && faceEnd !== undefined) heading = faceEnd
  }
  const last = path[path.length - 1]
  return { x: last[1], z: last[2], heading: last[3] ?? heading, walking: false, travelled }
}

// A foot lands at the end of its forward swing: phase π/2 for the first leg, 3π/2 for the other, so every half
// cycle. The film recorder reads window.__footfalls (film seconds, figure, metres from the camera) to place one
// step sound on each landing; the time is interpolated inside the frame.
function logFootfalls(previous, current, who, distance) {
  if (!previous || !window.__footfalls) return
  const landing = (phase) => Math.floor((phase - Math.PI / 2) / Math.PI)
  for (let count = landing(previous.phase) + 1; count <= landing(current.phase); count++) {
    const fraction = (Math.PI / 2 + count * Math.PI - previous.phase) / (current.phase - previous.phase)
    const shotSeconds = previous.seconds + fraction * (current.seconds - previous.seconds)
    window.__footfalls.push({ seconds: Number((clock.shotStart + shotSeconds).toFixed(4)), who, distance: Number(distance.toFixed(2)) })
  }
}

// One figure. `who` picks the colour; `scale` sets the age (child about 0.62, adult 1);
// `style` is cuffed, cradle, escort, old, watch, mourn, seated, seatedBowed or shovel; `lift` raises it (a judge's platform); `path` moves it; `hidden` lists [from, to]
// shot seconds when the figure is out of sight (indoors).
export function Mannequin({ who, scale = 1, style, path, child = false, hidden, lift = 0, children }) {
  const figure = useMemo(() => buildFigure(COLORS[who] ?? who, who, child, style), [who, child, style])
  const groupRef = useRef()
  const seed = useMemo(() => path[0][1] * 1.7 + path[0][2], [path])
  const previousStride = useRef(null)
  useFrame((state) => {
    const seconds = clock.shotSeconds
    const place = samplePath(path, seconds)
    // One walk cycle (two steps) covers what the legs actually reach at this swing, so feet do not slide.
    const strideLength = (style === 'old' ? 0.75 : 1.4) * scale
    const phase = (place.travelled / strideLength) * Math.PI * 2
    let pose = place.walking ? walkingPose(phase, style === 'old' ? 0.55 : 1) : standingPose(seconds, seed)
    if (style) pose = POSE_STYLE[style](pose, seconds)
    applyPose(figure, pose, scale)
    const isHidden = (hidden ?? []).some(([from, to]) => seconds >= from && seconds < to)
    groupRef.current.visible = !isHidden
    groupRef.current.position.set(place.x, lift, place.z)
    const stride = place.walking && !isHidden ? { phase, seconds } : null
    if (stride) logFootfalls(previousStride.current, stride, who, groupRef.current.position.distanceTo(state.camera.position))
    previousStride.current = stride
    groupRef.current.rotation.y = place.heading
  })
  return (
    <group ref={groupRef}>
      <primitive object={figure.root} />
      {children}
    </group>
  )
}
