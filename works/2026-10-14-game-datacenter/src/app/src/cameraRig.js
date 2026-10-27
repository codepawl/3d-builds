// Camera moves shared by the 3D view, the dashboard buttons and list rows.
import { Vector3 } from 'three'

const rig = { controls: null, camera: null, size: null }
const HOME_AZIMUTH = Math.PI * 0.2
const HOME_POLAR = 0.92

export function attachRig(controls, camera, size) {
  rig.controls = controls
  rig.camera = camera
  rig.size = size
}

export function homeDistance(world) {
  return Math.max(world.layout.wallX, world.layout.wallZ) * 3.7 + 19
}

export function flyHome(world, animate = true) {
  if (!rig.controls) return
  const distance = homeDistance(world)
  const targetX = 5
  const targetZ = 2.5
  const x = targetX + distance * Math.sin(HOME_POLAR) * Math.sin(HOME_AZIMUTH)
  const y = distance * Math.cos(HOME_POLAR)
  const z = targetZ + distance * Math.sin(HOME_POLAR) * Math.cos(HOME_AZIMUTH)
  rig.controls.setLookAt(x, y, z, targetX, 0, targetZ, animate)
}

export function flyTo(position, distance = 17) {
  if (!rig.controls) return
  rig.controls.moveTo(position.x, 0.8, position.z, true)
  rig.controls.dollyTo(distance, true)
}

export function zoomBy(factor) {
  if (!rig.controls) return
  rig.controls.dollyTo(rig.controls.distance * factor, true)
}

export function rotateBy(radians) {
  rig.controls?.rotate(radians, 0, true)
}

// Screen position of a world point, used by the film script to click on moving things.
export function projectToScreen(x, y, z) {
  if (!rig.camera) return null
  const point = new Vector3(x, y, z).project(rig.camera)
  return { x: ((point.x + 1) / 2) * rig.size.width, y: ((1 - point.y) / 2) * rig.size.height }
}

// Places the camera at once; used by the close-up screenshot script.
export function lookFrom(eye, target) {
  rig.controls?.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false)
}
