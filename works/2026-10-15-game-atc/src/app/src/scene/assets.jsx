// The Blender-built GLB assets (see ../../blender/ASSETS.md) and helpers to place them: cloning for
// things that move, instancing for things repeated many times.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { AIRLINES } from '../data.js'

const NAMES = ['aircraft', 'airport_buildings', 'airport_props', 'nav', 'town', 'nature', 'weather', 'birds']
const FILES = NAMES.map((name) => `${import.meta.env.BASE_URL}assets/${name}.glb`)
FILES.forEach((file) => useGLTF.preload(file))

// Below this bounding radius a part's shadow is too small to read from the map camera.
const SHADOW_MIN_RADIUS = 0.9

// Lamps (`glow_*`) bloom: they skip tone mapping so their emissive strength stays above 1.
function prepare(scene) {
  if (scene.userData.prepared) return
  scene.userData.prepared = true
  scene.traverse((object) => {
    if (!object.isMesh) return
    object.geometry.computeBoundingSphere()
    const glows = object.material.name.startsWith('glow_')
    object.castShadow = !glows && object.geometry.boundingSphere.radius > SHADOW_MIN_RADIUS
    object.receiveShadow = !glows
    if (glows) object.material.toneMapped = false
  })
}

export function useAssets() {
  const gltfs = useGLTF(FILES)
  return useMemo(() => {
    const nodes = { animations: {} }
    gltfs.forEach((gltf, index) => {
      prepare(gltf.scene)
      Object.assign(nodes, gltf.nodes)
      nodes.animations[NAMES[index]] = gltf.animations
    })
    return nodes
  }, [gltfs])
}

// Parts of a model by name prefix. GLTFLoader drops the dots of Blender's ".001" suffixes, so a
// prefix match finds every copy.
export function findParts(root, prefix) {
  const parts = []
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) parts.push(object)
  })
  return parts
}

const cache = new Map()

export function cached(key, create) {
  if (!cache.has(key)) cache.set(key, create())
  return cache.get(key)
}

function tinted(base, color) {
  return cached(`tint:${base.uuid}:${color}`, () => {
    const material = base.clone()
    material.color.set(color)
    return material
  })
}

// One aircraft model per variant and airline, painted in the airline's livery. Flights clone it,
// sharing its geometry and materials.
export function aircraftModel(nodes, variant, airlineCode) {
  return cached(`aircraft:${variant}:${airlineCode}`, () => {
    const airline = AIRLINES[airlineCode]
    const model = nodes[variant].clone(true)
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)
    model.traverse((object) => {
      if (!object.isMesh) return
      if (object.material.name === 'livery') object.material = tinted(object.material, airline.color)
      if (object.material.name === 'livery_accent') object.material = tinted(object.material, airline.accent)
    })
    return model
  })
}

// A static model repeated at many places, one instanced mesh per part. `color` tints parts whose
// material name starts with `tintMaterial`.
export function InstancedModel({ node, items, tintMaterial = 'paint', shadows = true }) {
  const parts = useMemo(() => {
    node.updateWorldMatrix(true, true)
    const toNode = new THREE.Matrix4().copy(node.matrixWorld).invert()
    const list = []
    node.traverse((object) => {
      if (!object.isMesh) return
      list.push({ geometry: object.geometry, material: object.material, matrix: new THREE.Matrix4().multiplyMatrices(toNode, object.matrixWorld) })
    })
    return list
  }, [node])
  if (!items.length) return null
  return parts.map((part, index) => (
    <InstancedPart key={`${index}:${items.length}`} part={part} items={items} tintMaterial={tintMaterial} shadows={shadows} />
  ))
}

function InstancedPart({ part, items, tintMaterial, shadows }) {
  const meshRef = useRef()
  const glows = part.material.name.startsWith('glow_')
  useLayoutEffect(() => {
    const mesh = meshRef.current
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const color = new THREE.Color()
    items.forEach((item, index) => {
      rotation.setFromAxisAngle(up, item.rotation ?? 0)
      const scale = item.scale ?? 1
      matrix.compose(new THREE.Vector3(...item.position), rotation, new THREE.Vector3(scale, scale, scale))
      matrix.multiply(part.matrix)
      mesh.setMatrixAt(index, matrix)
      if (item.color && part.material.name.startsWith(tintMaterial)) mesh.setColorAt(index, color.set(item.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, part, tintMaterial])
  return <instancedMesh ref={meshRef} args={[part.geometry, part.material, items.length]} castShadow={shadows && !glows} receiveShadow={shadows && !glows} />
}

// A clone of one GLB node, placed like any three.js object through props.
export function Model({ node, ...props }) {
  const object = useMemo(() => {
    const clone = node.clone(true)
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    return clone
  }, [node])
  return <primitive object={object} {...props} />
}
