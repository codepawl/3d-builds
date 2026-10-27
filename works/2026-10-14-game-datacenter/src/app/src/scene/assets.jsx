// Blender-built assets (blender/*.py -> public/assets/*.glb): loading, instancing parts and per-object clones.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { DoubleSide, Euler, Matrix4, Quaternion, Vector3 } from 'three'

const ASSET_URLS = {
  hall: '/assets/hall.glb',
  cooling: '/assets/cooling.glb',
  power: '/assets/power.glb',
  units: '/assets/units.glb',
  campus: '/assets/campus.glb',
}

for (const url of Object.values(ASSET_URLS)) useGLTF.preload(url)

const preparedScenes = new WeakSet()

// The GPU tray honeycomb is a high-contrast pattern that shimmers once its holes shrink below a pixel. Past FADE_NEAR it eases
// to the pattern's average tone, which is flat at FADE_FAR, so far shots show a calm dark faceplate instead of crawling noise.
const HONEYCOMB_FADE_NEAR = 9
const HONEYCOMB_FADE_FAR = 22
const HONEYCOMB_AVERAGE_TONE = 'vec3(0.2, 0.2, 0.23)'

function fadeHoneycombWithDistance(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float honeycombFade = smoothstep(${HONEYCOMB_FADE_NEAR.toFixed(1)}, ${HONEYCOMB_FADE_FAR.toFixed(1)}, length(vViewPosition));
      diffuseColor.rgb = mix(diffuseColor.rgb, ${HONEYCOMB_AVERAGE_TONE}, honeycombFade);`,
    )
  }
  material.customProgramCacheKey = () => 'honeycomb-fade'
  material.needsUpdate = true
}

// One-time fix-ups after loading: shadows on every mesh, sharp textures at a slant, the honeycomb fading at distance,
// and the chain-link fence drawn with an alpha test instead of blending.
function prepare(scene) {
  if (preparedScenes.has(scene)) return
  preparedScenes.add(scene)
  scene.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    if (object.material.map) object.material.map.anisotropy = 16
    if (object.material.name === 'tray_face') fadeHoneycombWithDistance(object.material)
    if (object.material.name === 'fence_mesh') {
      object.material.transparent = false
      object.material.depthWrite = true
      object.material.alphaTest = 0.5
      object.material.side = DoubleSide
      object.castShadow = false
    }
  })
}

function useAssetScene(file) {
  const { scene } = useGLTF(ASSET_URLS[file])
  prepare(scene)
  return scene
}

// The meshes under one named node with their transforms baked into the node's space: what an instanced asset draws.
export function useInstanceParts(file, nodeName) {
  const scene = useAssetScene(file)
  return useMemo(() => {
    const root = scene.getObjectByName(nodeName)
    root.updateWorldMatrix(true, true)
    const rootInverse = root.matrixWorld.clone().invert()
    const parts = []
    root.traverse((object) => {
      if (!object.isMesh) return
      const toRoot = new Matrix4().multiplyMatrices(rootInverse, object.matrixWorld)
      parts.push({ geometry: object.geometry.clone().applyMatrix4(toRoot), material: object.material })
    })
    return parts
  }, [scene, nodeName])
}

// Same parts with some materials recoloured, for example the rack paint that differs per hall.
export function recolorParts(parts, colorsByMaterialName) {
  return parts.map((part) => {
    const color = colorsByMaterialName[part.material.name]
    if (!color) return part
    const material = part.material.clone()
    material.color.set(color)
    return { ...part, material }
  })
}

// A private copy of a named node for assets that move or animate on their own (units, fans).
export function useAssetClone(file, nodeName) {
  const scene = useAssetScene(file)
  return useMemo(() => scene.getObjectByName(nodeName).clone(true), [scene, nodeName])
}

export function findRotors(object) {
  const rotors = []
  object.traverse((child) => {
    if (child.name.endsWith('_rotor')) rotors.push(child)
  })
  return rotors
}

export function findChild(object, suffix) {
  let found = null
  object.traverse((child) => {
    if (!found && child.name.endsWith(suffix)) found = child
  })
  return found
}

const scratchQuaternion = new Quaternion()
const scratchEuler = new Euler()

// A transform matrix from a position, a turn about the vertical axis and a scale (number or [x, y, z]).
export function placement(x, y, z, rotationY = 0, scale = 1) {
  const scaleVector = Array.isArray(scale) ? new Vector3(...scale) : new Vector3(scale, scale, scale)
  scratchQuaternion.setFromEuler(scratchEuler.set(0, rotationY, 0))
  return new Matrix4().compose(new Vector3(x, y, z), scratchQuaternion, scaleVector)
}

// Evenly spaced pieces of a module `moduleLength` long that exactly fill `length`, stretched slightly along their own X.
export function fillRun(length, moduleLength) {
  const count = Math.max(1, Math.round(length / moduleLength))
  const stretch = length / (count * moduleLength)
  const offsets = Array.from({ length: count }, (_, index) => -length / 2 + (index + 0.5) * moduleLength * stretch)
  return { offsets, stretch }
}

function InstancedPart({ part, matrices, castShadow, receiveShadow, onClick }) {
  const meshRef = useRef()
  useLayoutEffect(() => {
    matrices.forEach((matrix, index) => meshRef.current.setMatrixAt(index, matrix))
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.computeBoundingSphere()
  }, [matrices])
  return (
    <instancedMesh
      ref={meshRef}
      args={[part.geometry, part.material, matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    />
  )
}

// Draws every part of an asset once per matrix, one instanced draw per part.
export function InstancedAsset({ parts, matrices, castShadow = true, receiveShadow = true, onClick }) {
  if (matrices.length === 0) return null
  return parts.map((part, index) => (
    <InstancedPart
      key={`${index}-${matrices.length}`}
      part={part}
      matrices={matrices}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    />
  ))
}
