// The Blender-built GLB pack (see ../blender/ASSETS.md) and helpers to place it: instancing for
// static repeats, clones for parts the simulation moves.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const NAMES = ['tools', 'oht', 'stocker', 'cleanroom', 'subfab', 'people', 'campus', 'trucks']
const FILES = NAMES.map((name) => `${import.meta.env.BASE_URL}assets/${name}.glb`)
FILES.forEach((file) => useGLTF.preload(file))

// Below this bounding radius a part's shadow is too small to read from the ops camera, and
// skipping it keeps the shadow pass's draw calls (wheels, lamps, bolts, handles) down.
const SHADOW_MIN_RADIUS = 0.35

// Lamps (`glow_*`) bloom: they skip tone mapping and get pushed above 1 so the bloom pass sees them.
function prepare(scene) {
  if (scene.userData.prepared) return
  scene.userData.prepared = true
  scene.traverse((object) => {
    if (!object.isMesh) return
    object.geometry.computeBoundingSphere()
    const name = object.material.name
    const glows = name.startsWith('glow_')
    object.castShadow = !glows && name !== 'glass' && object.geometry.boundingSphere.radius > SHADOW_MIN_RADIUS
    object.receiveShadow = !glows
    if (glows && !object.material.userData.boosted) {
      object.material.userData.boosted = true
      object.material.toneMapped = false
      object.material.emissiveIntensity = Math.max(object.material.emissiveIntensity, 1) * 2.2
    }
    if (name === 'glass') {
      object.material.depthWrite = false
      object.material.envMapIntensity = 1.4
    }
  })
}

export function useAssets() {
  const gltfs = useGLTF(FILES)
  return useMemo(() => {
    const nodes = {}
    const clips = []
    for (const gltf of gltfs) {
      prepare(gltf.scene)
      Object.assign(nodes, gltf.nodes)
      clips.push(...gltf.animations)
    }
    return { nodes, clips }
  }, [gltfs])
}

// Parts of a model by name prefix. GLTFLoader drops the dots of Blender's ".001" suffixes,
// so a prefix match finds every copy.
export function findParts(root, prefix) {
  const parts = []
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) parts.push(object)
  })
  return parts
}

// Meshes of `node` relative to it, skipping subtrees whose name matches `exclude`, merged into
// one geometry per material so a tool with twenty parts costs a handful of draw calls.
function collectParts(node, exclude) {
  node.updateWorldMatrix(true, true)
  const toNode = new THREE.Matrix4().copy(node.matrixWorld).invert()
  const byMaterial = new Map()
  const visit = (object) => {
    if (object !== node && exclude && exclude.test(object.name)) return
    if (object.isMesh) {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      for (const name of Object.keys(geometry.attributes)) {
        if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
      }
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toNode, object.matrixWorld))
      const entry = byMaterial.get(object.material) ?? { geometries: [], castShadow: false }
      entry.geometries.push(geometry)
      entry.castShadow ||= object.castShadow
      byMaterial.set(object.material, entry)
    }
    object.children.forEach(visit)
  }
  visit(node)
  return [...byMaterial].map(([material, entry]) => ({
    geometry: entry.geometries.length === 1 ? entry.geometries[0] : mergeGeometries(entry.geometries),
    material,
    castShadow: entry.castShadow,
    matrix: new THREE.Matrix4(),
  }))
}

// A static model repeated at many places, one instanced mesh per part. Items carry
// position, rotation (about y), optional scale (number or [x, y, z]) and optional id for picking.
export function InstancedModel({ node, items, exclude = null, shadows = true, onPick = null }) {
  const parts = useMemo(() => collectParts(node, exclude), [node, exclude])
  if (!items.length) return null
  return parts.map((part, index) => <InstancedPart key={`${index}:${items.length}`} part={part} items={items} shadows={shadows} onPick={onPick} />)
}

function InstancedPart({ part, items, shadows, onPick }) {
  const meshRef = useRef()
  useLayoutEffect(() => {
    const mesh = meshRef.current
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3()
    items.forEach((item, index) => {
      rotation.setFromAxisAngle(up, item.rotation ?? 0)
      if (Array.isArray(item.scale)) scale.set(...item.scale)
      else scale.setScalar(item.scale ?? 1)
      matrix.compose(new THREE.Vector3(...item.position), rotation, scale)
      matrix.multiply(part.matrix)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }, [items, part])
  const handlers = onPick
    ? {
        onClick: (event) => onPick(event, items[event.instanceId]),
        onPointerOver: (event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        },
        onPointerOut: () => {
          document.body.style.cursor = ''
        },
      }
    : { raycast: () => null }
  return <instancedMesh ref={meshRef} args={[part.geometry, part.material, items.length]} castShadow={shadows && part.castShadow} receiveShadow {...handlers} />
}

// A clone of one GLB node, placed like any three.js object through props.
export function Model({ node, ...props }) {
  const object = useMemo(() => node.clone(true), [node])
  return <primitive object={object} {...props} />
}

// Parts the simulation moves, cloned out of a model and parented at their pivots.
export function cloneChild(nodes, rootName, suffix) {
  const source = nodes[`${rootName}_${suffix}`]
  return source ? source.clone(true) : null
}

// A per-instance copy of the materials under `object` named `materialName`.
export function ownMaterial(object, materialName) {
  let material = null
  object.traverse((child) => {
    if (!child.isMesh || child.material.name !== materialName) return
    if (!material) material = child.material.clone()
    child.material = material
  })
  return material
}
