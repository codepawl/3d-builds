import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ASSET_FILES = ['trains', 'track', 'tunnel', 'station', 'structures', 'city', 'people']
const EMISSIVE_BOOST = {
  Headlight: 4, Taillight: 3, DestinationSign: 2.6, TunnelLight: 2.4, VideoWall: 2.2, LampLight: 3, WallLamp: 2.2,
  ApLight: 3, SignalRed: 3.5, SignalYellow: 3.5, SignalGreen: 3.5, GateDisplay: 2, PsdIndicator: 2.4, KioskSign: 1.8, SignPlate: 1.2,
}

export async function loadAssets() {
  const loader = new GLTFLoader()
  const entries = await Promise.all(
    ASSET_FILES.map(async (name) => {
      const gltf = await loader.loadAsync(`/assets/${name}.glb`)
      return [name, gltf]
    }),
  )
  const assets = {}
  entries.forEach(([name, gltf]) => {
    assets[name] = { scene: gltf.scene, animations: gltf.animations }
    tuneMaterials(gltf.scene)
  })
  return assets
}

function tuneMaterials(scene) {
  scene.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      const boost = EMISSIVE_BOOST[material.name]
      if (boost && 'emissiveIntensity' in material) material.emissiveIntensity = boost
      material.side = THREE.FrontSide
      if (/glass|Glass|Window/.test(material.name)) {
        material.transparent = true
        material.opacity = Math.min(material.opacity ?? 1, 0.55)
        material.depthWrite = false
      }
    })
  })
}

export function takeRoot(assets, file, name) {
  const root = assets[file].scene.getObjectByName(name)
  if (!root) throw new Error(`Missing root ${name} in ${file}.glb`)
  root.position.set(0, 0, 0)
  root.updateMatrixWorld(true)
  return root
}

const tempMatrix = new THREE.Matrix4()
const tempPivot = new THREE.Matrix4()
const tempRotation = new THREE.Matrix4()
const tempTranslation = new THREE.Matrix4()
const zeroScale = new THREE.Matrix4().makeScale(0, 0, 0)

// Flattens a root into mesh parts, remembering which animated ancestor (door leaf, wheelset...) each part belongs to.
export function extractParts(root, classify = () => null) {
  root.updateMatrixWorld(true)
  const rootInverse = root.matrixWorld.clone().invert()
  const parts = []
  root.traverse((object) => {
    if (!object.isMesh) return
    const rest = new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld)
    let animation = null
    let node = object
    while (node) {
      const found = classify(node.name)
      if (found) {
        const pivot = new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld)
        animation = { ...found, pivot, pivotInverse: pivot.clone().invert() }
        break
      }
      if (node === root) break
      node = node.parent
    }
    parts.push({ name: object.name, geometry: object.geometry, material: object.material, rest, animation })
  })
  return parts
}

export function classifyTrainPart(name) {
  let match = /Door_([LR])\d_([ab])$/.exec(name)
  if (match) return { type: 'door', side: match[1], sign: match[2] === 'a' ? -1 : 1, travel: 0.7 }
  if (/Wheelset/.test(name)) return { type: 'wheel' }
  return null
}

export function classifyStationPart(name) {
  const match = /^Psd_Leaf_([ab])$/.exec(name)
  if (match) return { type: 'psd', sign: match[1] === 'a' ? -1 : 1, travel: 1.0 }
  if (name === 'Escalator_Steps') return { type: 'steps' }
  return null
}

export function classifySignalPart(name) {
  return null
}

export function classifyWashPart(name) {
  if (/^Brush_N|^Brush_S/.test(name)) return { type: 'brushVertical', phase: name.endsWith('B') ? 1 : 0 }
  if (name === 'Brush_Top') return { type: 'brushTop' }
  return null
}

// An assembly turns one GLB root into one InstancedMesh per part. Each instance is a base matrix plus an animation state.
export class InstancedAssembly {
  constructor(parts, capacity, { castShadow = true, receiveShadow = true } = {}) {
    this.parts = parts
    this.capacity = capacity
    this.count = 0
    this.group = new THREE.Group()
    this.meshes = parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity)
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.castShadow = castShadow
      mesh.receiveShadow = receiveShadow
      this.group.add(mesh)
      return mesh
    })
  }

  begin() {
    this.count = 0
  }

  add(baseMatrix, state = null) {
    if (this.count >= this.capacity) return
    const index = this.count
    this.count += 1
    for (let partIndex = 0; partIndex < this.parts.length; partIndex += 1) {
      const part = this.parts[partIndex]
      const target = tempMatrix
      if (part.lamp && state && state.aspect !== part.lamp) {
        this.meshes[partIndex].setMatrixAt(index, zeroScale)
        continue
      }
      if (!part.animation || !state) {
        target.multiplyMatrices(baseMatrix, part.rest)
      } else {
        this.animatedMatrix(target, baseMatrix, part, state)
      }
      this.meshes[partIndex].setMatrixAt(index, target)
    }
  }

  animatedMatrix(target, baseMatrix, part, state) {
    const animation = part.animation
    switch (animation.type) {
      case 'door': {
        const open = animation.side === 'L' ? state.doorsLeft ?? 0 : state.doorsRight ?? 0
        tempTranslation.makeTranslation(animation.sign * animation.travel * open, 0, 0)
        tempRotation.multiplyMatrices(baseMatrix, tempTranslation)
        target.multiplyMatrices(tempRotation, part.rest)
        break
      }
      case 'psd': {
        const open = state.psdOpen ?? 0
        tempTranslation.makeTranslation(animation.sign * animation.travel * open, 0, 0)
        tempRotation.multiplyMatrices(baseMatrix, tempTranslation)
        target.multiplyMatrices(tempRotation, part.rest)
        break
      }
      case 'wheel': {
        tempRotation.makeRotationZ(state.wheelAngle ?? 0)
        tempPivot.multiplyMatrices(animation.pivot, tempRotation)
        tempPivot.multiply(animation.pivotInverse)
        tempPivot.premultiply(baseMatrix)
        target.multiplyMatrices(tempPivot, part.rest)
        break
      }
      case 'steps': {
        const phase = (state.stepPhase ?? 0) % 1
        tempTranslation.makeTranslation(0.366 * phase, 0.2115 * phase, 0)
        tempRotation.multiplyMatrices(baseMatrix, tempTranslation)
        target.multiplyMatrices(tempRotation, part.rest)
        break
      }
      case 'brushVertical': {
        tempRotation.makeRotationY(state.brushAngle ?? 0)
        tempPivot.multiplyMatrices(animation.pivot, tempRotation)
        tempPivot.multiply(animation.pivotInverse)
        tempPivot.premultiply(baseMatrix)
        target.multiplyMatrices(tempPivot, part.rest)
        break
      }
      case 'brushTop': {
        tempRotation.makeRotationZ(state.brushAngle ?? 0)
        tempPivot.multiplyMatrices(animation.pivot, tempRotation)
        tempPivot.multiply(animation.pivotInverse)
        tempPivot.premultiply(baseMatrix)
        target.multiplyMatrices(tempPivot, part.rest)
        break
      }
      default:
        target.multiplyMatrices(baseMatrix, part.rest)
    }
  }

  end() {
    this.meshes.forEach((mesh) => {
      mesh.count = this.count
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  // Applies a per-instance colour only to parts whose material matches (for example the figures' shirts).
  enableColour(materialName) {
    this.meshes.forEach((mesh, index) => {
      if (this.parts[index].material.name === materialName) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3)
        mesh.userData.colourable = true
      }
    })
  }

  setColour(index, color) {
    this.meshes.forEach((mesh) => {
      if (mesh.userData.colourable) mesh.setColorAt(index, color)
    })
  }

  endColours() {
    this.meshes.forEach((mesh) => {
      if (mesh.userData.colourable && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }
}

// options.opacity below 1 draws a ghost: cloned transparent materials that do not write depth.
export function staticAssembly(root, matrices, options = {}) {
  const parts = extractParts(root)
  if (options.opacity !== undefined && options.opacity < 1) {
    parts.forEach((part) => {
      part.material = part.material.clone()
      part.material.transparent = true
      part.material.opacity = options.opacity
      part.material.depthWrite = false
    })
  }
  const assembly = new InstancedAssembly(parts, Math.max(1, matrices.length), options)
  assembly.begin()
  matrices.forEach((matrix) => assembly.add(matrix))
  assembly.end()
  return assembly
}

export const zeroMatrix = zeroScale
