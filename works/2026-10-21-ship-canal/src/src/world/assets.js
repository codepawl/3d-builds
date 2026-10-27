import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ASSET_FILES = ['lock_structure', 'lock_equipment', 'mules', 'ships', 'site', 'tugs']

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
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => { material.side = THREE.FrontSide })
    })
  })
  // The "on" lamp materials live on the swatch node of site.glb: take them by name, then hide the node.
  const states = {}
  const swatch = assets.site.scene.getObjectByName('state_materials')
  swatch.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => { states[material.name] = material })
  })
  swatch.visible = false
  assets.states = states
  return assets
}

export function findRoot(assets, file, name) {
  const root = assets[file].scene.getObjectByName(name)
  if (!root) throw new Error(`Missing ${name} in ${file}.glb`)
  return root
}

export function cloneRoot(assets, file, name) {
  const clone = findRoot(assets, file, name).clone(true)
  clone.position.set(0, 0, 0)
  clone.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return clone
}

export function mirrorGeometryX(geometry) {
  const mirrored = geometry.clone()
  mirrored.scale(-1, 1, 1)
  const index = mirrored.getIndex()
  if (index) {
    for (let cursor = 0; cursor < index.count; cursor += 3) {
      const second = index.getX(cursor + 1)
      index.setX(cursor + 1, index.getX(cursor + 2))
      index.setX(cursor + 2, second)
    }
    index.needsUpdate = true
  }
  return mirrored
}

const mirrorCache = new WeakMap()

// One InstancedMesh for a single-mesh GLB module placed many times.
export function instanceModule(assets, file, rootName, matrices, { mirror = false, castShadow = true, receiveShadow = true } = {}) {
  const root = findRoot(assets, file, rootName)
  let mesh = null
  root.traverse((object) => { if (object.isMesh && !mesh) mesh = object })
  let geometry = mesh.geometry
  if (mirror) {
    if (!mirrorCache.has(geometry)) mirrorCache.set(geometry, mirrorGeometryX(geometry))
    geometry = mirrorCache.get(geometry)
  }
  const instanced = new THREE.InstancedMesh(geometry, mesh.material, matrices.length)
  matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix))
  instanced.instanceMatrix.needsUpdate = true
  instanced.castShadow = castShadow
  instanced.receiveShadow = receiveShadow
  instanced.frustumCulled = false
  return instanced
}

// Pose one named clip on a clone, keeping only the tracks that target nodes inside the clone.
export function createClipPlayer(root, clips, clipName) {
  const clip = clips.find((candidate) => candidate.name === clipName)
  if (!clip) return null
  const names = new Set()
  root.traverse((object) => names.add(object.name))
  const tracks = clip.tracks.filter((track) => names.has(track.name.split('.')[0]))
  if (tracks.length === 0) return null
  const subclip = new THREE.AnimationClip(clipName, clip.duration, tracks)
  const mixer = new THREE.AnimationMixer(root)
  const action = mixer.clipAction(subclip)
  action.play()
  action.paused = true
  return {
    duration: clip.duration,
    setFraction(fraction) {
      action.time = Math.min(clip.duration * 0.9999, Math.max(0, fraction * clip.duration))
      mixer.update(0)
    },
  }
}

export function swapMaterialByNode(root, nodeName, material) {
  root.traverse((object) => {
    if (object.isMesh && object.name === nodeName) object.material = material
  })
}
