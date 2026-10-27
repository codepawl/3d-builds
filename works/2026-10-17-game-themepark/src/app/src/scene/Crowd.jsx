// Guests as instanced crowds. Each character's walk, idle and wave clips are baked once into
// per-part matrices (24 per second); every frame each guest picks its frame by its own phase.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const FRAMES_PER_SECOND = 24
const CLIPS = ['walk', 'idle', 'wave']

function bake(nodes, clips, name) {
  const root = nodes[name].clone(true)
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  const meshes = []
  root.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  const mixer = new THREE.AnimationMixer(root)
  const tables = {}
  for (const clipName of CLIPS) {
    const clip = clips.find((candidate) => candidate.name === `${name}_${clipName}`)
    if (!clip) continue
    mixer.stopAllAction()
    const action = mixer.clipAction(clip)
    action.reset().play()
    const frameCount = Math.max(1, Math.round(clip.duration * FRAMES_PER_SECOND))
    const frames = []
    for (let frame = 0; frame < frameCount; frame++) {
      mixer.setTime(frame / FRAMES_PER_SECOND)
      root.updateMatrixWorld(true)
      frames.push(meshes.map((mesh) => mesh.matrixWorld.clone()))
    }
    tables[clipName] = frames
  }
  mixer.stopAllAction()
  return {
    parts: meshes.map((mesh) => {
      mesh.geometry.computeBoundingSphere()
      return { geometry: mesh.geometry, material: mesh.material, castShadow: mesh.geometry.boundingSphere.radius > 0.12 }
    }),
    tables,
  }
}

function Variant({ name, guests, nodes, clips }) {
  const baked = useMemo(() => bake(nodes, clips, name), [nodes, clips, name])
  const meshes = useRef([])
  const base = useMemo(() => new THREE.Matrix4(), [])
  const result = useMemo(() => new THREE.Matrix4(), [])
  const rotation = useMemo(() => new THREE.Quaternion(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const unitScale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  useFrame(() => {
    const walk = baked.tables.walk
    const idle = baked.tables.idle ?? walk
    const wave = baked.tables.wave ?? idle
    guests.forEach((guest, index) => {
      const table = guest.moving ? walk : guest.clip === 'wave' ? wave : idle
      const frame = table[Math.floor(guest.phase * table.length) % table.length]
      position.set(guest.x, 0, guest.z)
      rotation.setFromAxisAngle(axis, guest.heading)
      base.compose(position, rotation, unitScale)
      for (let part = 0; part < baked.parts.length; part++) {
        const mesh = meshes.current[part]
        if (!mesh) continue
        result.multiplyMatrices(base, frame[part])
        mesh.setMatrixAt(index, result)
      }
    })
    for (const mesh of meshes.current) {
      if (!mesh) continue
      mesh.count = guests.length
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return baked.parts.map((part, index) => (
    <instancedMesh key={index} ref={(mesh) => (meshes.current[index] = mesh)} args={[part.geometry, part.material, Math.max(1, guests.length)]} castShadow={part.castShadow} receiveShadow frustumCulled={false} raycast={() => null} />
  ))
}

export function Crowd({ state, nodes, clips }) {
  const groups = useMemo(() => {
    const byVariant = new Map()
    for (const guest of state.guests) {
      if (!byVariant.has(guest.variant)) byVariant.set(guest.variant, [])
      byVariant.get(guest.variant).push(guest)
    }
    return [...byVariant]
  }, [state])
  return groups.map(([name, guests]) => <Variant key={name} name={name} guests={guests} nodes={nodes} clips={clips} />)
}
