// Loads the seven GLB families once and offers two ways to draw a node: instanced (static repeats) or cloned
// (anything with moving parts).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const FILES = ['cars', 'crew', 'pitgear', 'pitlane', 'paddock', 'track', 'roadcars']
FILES.forEach((file) => useGLTF.preload(`/assets/${file}.glb`))

let library = null

export function useAssets() {
  const loaded = FILES.map((file) => useGLTF(`/assets/${file}.glb`))
  if (!library) {
    const nodes = {}
    const materials = {}
    const animations = []
    for (const gltf of loaded) {
      gltf.scene.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true
          object.receiveShadow = true
        }
      })
      for (const child of gltf.scene.children) nodes[child.name] = child
      Object.assign(materials, gltf.materials)
      animations.push(...gltf.animations)
    }
    library = { nodes, materials, animations, parts: {} }
  }
  return library
}

// Every mesh under a root with its matrix relative to the root, cached per node name.
export function partsOf(assets, name) {
  if (assets.parts[name]) return assets.parts[name]
  const root = assets.nodes[name]
  if (!root) throw new Error(`Missing GLB node ${name}`)
  root.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const parts = []
  root.traverse((object) => {
    if (object.isMesh) parts.push({ geometry: object.geometry, material: object.material, matrix: new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld) })
  })
  // Static repeats are drawn per material, not per part: parts sharing a material are baked into one geometry.
  const byMaterial = new Map()
  for (const part of parts) {
    if (!byMaterial.has(part.material)) byMaterial.set(part.material, [])
    byMaterial.get(part.material).push(part)
  }
  const merged = []
  for (const [material, group] of byMaterial) {
    if (group.length === 1) {
      merged.push(group[0])
      continue
    }
    const baked = group.map((part) => {
      const geometry = part.geometry.clone().applyMatrix4(part.matrix)
      for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key)
      return geometry.index ? geometry : geometry.setIndex([...Array(geometry.attributes.position.count).keys()])
    })
    const geometry = mergeGeometries(baked)
    if (geometry) merged.push({ geometry, material, matrix: new THREE.Matrix4() })
    else merged.push(...group)
  }
  assets.parts[name] = merged
  return merged
}

const placement = new THREE.Matrix4()
const rotation = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)

export function placementMatrix(item, target = placement) {
  rotation.setFromAxisAngle(up, item.heading ?? 0)
  const scale = item.scale ?? 1
  return target.compose(new THREE.Vector3(item.x, item.y ?? 0, item.z), rotation, new THREE.Vector3(scale, scale, scale))
}

// Draws `items` copies of a node as one InstancedMesh per part. `onPick(item)` receives the clicked item.
export function Instanced({ name, items, onPick, castShadow = true }) {
  const assets = useAssets()
  const parts = partsOf(assets, name)
  return parts.map((part, index) => <InstancedPart key={index} part={part} items={items} onPick={onPick} castShadow={castShadow} />)
}

function InstancedPart({ part, items, onPick, castShadow }) {
  const meshRef = useRef()
  useLayoutEffect(() => {
    const mesh = meshRef.current
    const matrix = new THREE.Matrix4()
    items.forEach((item, index) => {
      placementMatrix(item, matrix)
      matrix.multiply(part.matrix)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, part])
  const handleClick = onPick
    ? (event) => {
        const item = items[event.instanceId]
        if (item) onPick(event, item)
      }
    : undefined
  return <instancedMesh ref={meshRef} args={[part.geometry, part.material, items.length]} castShadow={castShadow} receiveShadow onClick={handleClick} />
}

// A deep clone of a node with optional material recolouring (`recolor` maps a material-name test to a colour).
export function useClone(name, recolor) {
  const assets = useAssets()
  return useMemo(() => {
    const clone = assets.nodes[name].clone(true)
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    if (recolor) {
      const swapped = new Map()
      clone.traverse((object) => {
        if (!object.isMesh) return
        const color = recolor(object.material.name)
        if (!color) return
        if (!swapped.has(object.material)) {
          const material = object.material.clone()
          material.color.set(color)
          swapped.set(object.material, material)
        }
        object.material = swapped.get(object.material)
      })
    }
    return clone
  }, [assets, name, recolor])
}

export function findChild(root, suffix) {
  let found = null
  root.traverse((object) => {
    if (!found && object.name.endsWith(suffix)) found = object
  })
  return found
}

export function clipsFor(assets, model) {
  const clips = {}
  for (const clip of assets.animations) {
    if (clip.name.startsWith(`${model}_`)) clips[clip.name.slice(model.length + 1)] = clip
  }
  return clips
}
