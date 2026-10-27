// Things on the map that are not traffic: navigation fixes with their names, the drifting storm
// cell, scattered cloud and a flock of gulls over the shore.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { selectEntity, setUi, useUiValue } from '../store.js'
import { InstancedModel, findParts, useAssets } from './assets.jsx'

const FIX_SCALE = { TWR: 1.6, APP: 4.5, CTR: 10 }

function Fix({ fix, site, terrain, nodes, selected }) {
  const scale = FIX_SCALE[site.id]
  const object = useMemo(() => {
    const clone = nodes[fix.kind].clone(true)
    clone.position.set(0, 0, 0)
    return clone
  }, [nodes, fix.kind])
  const rings = useMemo(() => findParts(object, `${fix.kind}_ring`), [object, fix.kind])
  const sweeps = useMemo(() => findParts(object, `${fix.kind}_sweep`), [object, fix.kind])
  const labelHeight = useMemo(() => {
    const anchor = findParts(object, `${fix.kind}_label`)[0]
    return anchor ? anchor.position.y : 8
  }, [object, fix.kind])
  useFrame(({ clock }, dt) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.08
    rings.forEach((ring) => ring.scale.set(pulse, 1, pulse))
    sweeps.forEach((sweep) => {
      sweep.rotation.y += dt * 2
    })
  })
  const ground = Math.max(0, terrain.heightAt(fix.x, fix.z))
  return (
    <group position={[fix.x, ground, fix.z]}>
      <primitive object={object} scale={scale} onClick={(event) => selectEntity(event, `fix-${fix.id}`)} />
      <Html position={[0, labelHeight * scale + 2, 0]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <button
          className={selected ? 'fix-label selected' : 'fix-label'}
          onClick={(event) => {
            event.stopPropagation()
            setUi({ selectedId: `fix-${fix.id}` })
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M5 1l4 8H1z" fill="currentColor" />
          </svg>
          {fix.id}
        </button>
      </Html>
    </group>
  )
}

export function Fixes({ site, terrain }) {
  const nodes = useAssets()
  const selectedId = useUiValue((ui) => ui.selectedId)
  return site.fixes.map((fix) => (
    <Fix key={fix.id} fix={fix} site={site} terrain={terrain} nodes={nodes} selected={selectedId === `fix-${fix.id}`} />
  ))
}

// Storm tops near FL350; the model's 68 m height is stretched to that on each sector's scale.
export function Weather({ state }) {
  const nodes = useAssets()
  const weather = state.weather
  const groupRef = useRef()
  const object = useMemo(() => {
    const clone = nodes.storm_cell_a.clone(true)
    clone.position.set(0, 0, 0)
    // The anvil stays solid; the dark base and rain shaft become translucent so traffic and the
    // map read through them.
    clone.traverse((part) => {
      if (!part.isMesh) return
      const name = part.material.name
      if (name.startsWith('storm_dark') || part.name.includes('_core')) {
        part.material = part.material.clone()
        part.material.color.set(part.name.includes('_core') ? '#8f9cb8' : '#7c8bab')
        part.material.transparent = true
        part.material.opacity = part.name.includes('_core') ? 0.32 : 0.58
        part.material.depthWrite = false
        part.castShadow = false
      }
    })
    return clone
  }, [nodes])
  const bolts = useMemo(() => [findParts(object, 'storm_cell_a_lightning0'), findParts(object, 'storm_cell_a_lightning1')], [object])
  // Drawn shorter than its FL350 top (the label carries the real figure) so it does not wall off the map.
  const height = Math.min(35000 * state.site.altitudeScale, 210) / 68
  useFrame(({ clock }) => {
    groupRef.current.position.set(weather.x, 0, weather.z)
    groupRef.current.rotation.y = clock.elapsedTime * 0.03
    bolts.forEach((parts, side) => {
      const on = weather.flash > 0.35 && weather.flashSide === side
      parts.forEach((part) => {
        part.visible = on
      })
    })
  })
  const horizontal = weather.radius / 30
  return (
    <group ref={groupRef}>
      <primitive object={object} scale={[horizontal, height, horizontal]} onClick={(event) => selectEntity(event, 'weather')} />
      <Html position={[0, 68 * height + 6, 0]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <button
          className="weather-label"
          onClick={(event) => {
            event.stopPropagation()
            setUi({ selectedId: 'weather' })
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 16a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17.5 16M12.5 12l-2 4h3l-2 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Storm cell · tops FL350
        </button>
      </Html>
    </group>
  )
}

export function Clouds({ site }) {
  const nodes = useAssets()
  const groups = useMemo(() => {
    const scale = site.sceneryScale * 2.2
    const height = 4500 * site.altitudeScale
    const spots = [
      [-0.85, -0.75], [0.9, -0.85], [-0.95, 0.55], [0.15, -1.1], [0.8, 0.95], [-0.4, 1.05],
    ]
    const result = { cloud_a: [], cloud_b: [], cloud_c: [] }
    spots.forEach(([u, v], index) => {
      const name = ['cloud_a', 'cloud_b', 'cloud_c'][index % 3]
      result[name].push({ position: [u * site.extent.x, height + (index % 2) * height * 0.3, v * site.extent.z], rotation: index * 1.3, scale })
    })
    return result
  }, [site])
  return Object.entries(groups).map(([name, items]) => <InstancedModel key={name} node={nodes[name]} items={items} shadows={false} />)
}

function Gull({ nodes, clip, offset, flock, scale }) {
  const ref = useRef()
  const { object, mixer } = useMemo(() => {
    const bird = cloneSkinned(nodes.bird_gull)
    bird.position.set(0, 0, 0)
    return { object: bird, mixer: new THREE.AnimationMixer(bird) }
  }, [nodes])
  useEffect(() => {
    const action = mixer.clipAction(clip)
    action.time = offset * clip.duration
    action.play()
    return () => mixer.stopAllAction()
  }, [mixer, clip, offset])
  useFrame(({ clock }, dt) => {
    mixer.update(dt)
    const angle = clock.elapsedTime * 0.12 + offset * Math.PI * 2
    const radius = flock.radius * (0.55 + 0.45 * Math.sin(offset * 9))
    ref.current.position.set(flock.x + Math.cos(angle) * radius, flock.height + Math.sin(angle * 2 + offset * 5) * flock.height * 0.15, flock.z + Math.sin(angle) * radius)
    // Facing along the circle (counter-clockwise seen from above).
    ref.current.rotation.y = -angle
  })
  return (
    <group ref={ref} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

export function Birds({ site }) {
  const nodes = useAssets()
  const clips = nodes.animations.birds
  const flap = clips.find((clip) => clip.name.includes('gull_flap'))
  const glide = clips.find((clip) => clip.name.includes('gull_glide'))
  if (!site.birds || !flap) return null
  const scale = site.sceneryScale * 4
  const flock = { ...site.birds, height: 30 * site.sceneryScale }
  return Array.from({ length: 12 }, (_, index) => (
    <Gull key={index} nodes={nodes} clip={index % 3 === 0 && glide ? glide : flap} offset={index / 12} flock={flock} scale={scale} />
  ))
}
