// The map under the traffic: a stylised coast with hills, sea, towns, trees and boats. Built once
// per sector from its seed; every repeated model is instanced.
import { useMemo } from 'react'
import * as THREE from 'three'
import { InstancedModel, useAssets } from './assets.jsx'
import { PALETTE } from './materials.js'
import { applyMapShader } from './mapShader.js'

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

const smoothstep = (edge0, edge1, value) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Height field shared by the mesh and everything placed on it.
export function makeTerrain(site) {
  const { extent, coast, sceneryScale } = site
  const coastZ = (x) => coast.z + coast.amplitude * (0.6 * Math.sin(x / (extent.x * 0.32) + 0.7) + 0.4 * Math.sin(x / (extent.x * 0.11) + 2.1))
  const hillHeight = 9 * sceneryScale
  // Ground near the airport and under the final approach stays flat.
  const flatness = (x, z) => {
    if (!site.hasAirport) return 1
    const scale = sceneryScale
    const airport = Math.max(Math.abs(x) - 340, Math.abs(z + 70) - 210, 0)
    const finalCorridor = x > 0 ? Math.max(Math.abs(z + 50) - 110, 0) : 1e9
    return smoothstep(0, 160 * scale, Math.min(airport, finalCorridor))
  }
  const heightAt = (x, z) => {
    const shore = coastZ(x) - z
    if (shore < 0) return Math.max(-14 * sceneryScale, shore * 0.06) - 0.6
    const rise = Math.min(1, shore / (60 * sceneryScale))
    const unit = 1 / (95 * sceneryScale)
    const ridges =
      Math.max(0, Math.sin(x * unit * 1.1 + 0.4) * Math.cos(z * unit * 0.9 - 1.1)) * 1.4 +
      Math.max(0, Math.sin(x * unit * 2.7 + z * unit * 1.3)) * 0.5 +
      Math.max(0, Math.cos(x * unit * 0.45 - z * unit * 0.6 + 2)) * 1.1
    return 0.5 * rise * flatness(x, z) + ridges * hillHeight * rise * flatness(x, z)
  }
  return { coastZ, heightAt, flatness }
}

const COLORS = {
  deep: new THREE.Color('#9cc3df'),
  shallow: new THREE.Color('#c4def0'),
  sand: new THREE.Color('#efe7d2'),
  low: new THREE.Color(PALETTE.grass),
  high: new THREE.Color('#bfd5b7'),
  top: new THREE.Color('#e6ecdf'),
}

function TerrainMesh({ site, terrain, mapUniforms }) {
  const material = useMemo(() => applyMapShader(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), mapUniforms), [mapUniforms])
  const geometry = useMemo(() => {
    const width = site.extent.x * 3.2
    const depth = site.extent.z * 3.2
    const plane = new THREE.PlaneGeometry(width, depth, 260, 190)
    plane.rotateX(-Math.PI / 2)
    const positions = plane.attributes.position
    const colors = new Float32Array(positions.count * 3)
    const color = new THREE.Color()
    const hillTop = 9 * site.sceneryScale * 2.6
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index)
      const z = positions.getZ(index)
      const height = terrain.heightAt(x, z)
      positions.setY(index, height)
      const shore = terrain.coastZ(x) - z
      if (shore < 0) color.copy(COLORS.shallow).lerp(COLORS.deep, Math.min(1, -shore / (90 * site.sceneryScale)))
      else if (shore < 12 * site.sceneryScale) color.copy(COLORS.sand)
      else {
        const t = Math.min(1, height / hillTop)
        color.copy(COLORS.low).lerp(COLORS.high, Math.min(1, t * 1.6))
        if (t > 0.62) color.lerp(COLORS.top, (t - 0.62) * 2)
      }
      color.toArray(colors, index * 3)
    }
    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    plane.computeVertexNormals()
    return plane
  }, [site, terrain])
  return (
    <mesh geometry={geometry} material={material} receiveShadow />
  )
}

function Water({ site, mapUniforms }) {
  const material = useMemo(() => applyMapShader(new THREE.MeshStandardMaterial({ color: '#b3d4ec', transparent: true, opacity: 0.72, roughness: 0.25, metalness: 0.05, depthWrite: false }), mapUniforms), [mapUniforms])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.15} material={material} receiveShadow>
      <planeGeometry args={[site.extent.x * 3.2, site.extent.z * 3.2]} />
    </mesh>
  )
}

const TOWN_MIX = [
  ['house_a', 0.26], ['house_b', 0.24], ['house_c', 0.2], ['apartment_a', 0.11], ['apartment_b', 0.09], ['warehouse', 0.06], ['factory', 0.04],
]
const ROOF_COLORS = ['#e7816b', '#d9a07a', '#8fa3c9', '#c4cbd8', '#e3b862']

function pickWeighted(random, mix) {
  let roll = random()
  for (const [name, weight] of mix) {
    roll -= weight
    if (roll <= 0) return name
  }
  return mix[0][0]
}

function insideAirport(x, z) {
  return Math.abs(x) < 360 && z > -280 && z < 120
}

function scatter(site, terrain) {
  const random = seededRandom(site.extent.x * 13 + site.extent.z)
  const scale = site.sceneryScale
  const groups = {}
  const add = (name, item) => {
    if (!groups[name]) groups[name] = []
    groups[name].push(item)
  }
  const nearTown = (x, z, padding) => site.towns.some((town) => Math.hypot(x - town.x, z - town.z) < town.radius + padding)

  site.towns.forEach((town) => {
    const grid = (random() - 0.5) * 0.6
    let placed = 0
    for (let attempt = 0; attempt < town.count * 6 && placed < town.count; attempt++) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * town.radius
      const x = town.x + Math.cos(angle) * radius
      const z = town.z + Math.sin(angle) * radius
      if (terrain.coastZ(x) - z < 14 * scale || (site.hasAirport && insideAirport(x, z))) continue
      const name = radius < town.radius * 0.4 ? pickWeighted(random, TOWN_MIX.slice(3)) : pickWeighted(random, TOWN_MIX)
      add(name, { position: [x, terrain.heightAt(x, z) - 0.2, z], rotation: grid + Math.round(random() * 3) * (Math.PI / 2), scale, color: ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)] })
      placed++
    }
    add('church', { position: [town.x, terrain.heightAt(town.x, town.z) - 0.2, town.z], rotation: grid, scale })
    const tankX = town.x + town.radius * 0.8
    add('water_tower', { position: [tankX, terrain.heightAt(tankX, town.z), town.z], rotation: 0, scale })
  })

  const treeTarget = Math.min(1600, Math.round((site.extent.x * site.extent.z) / (scale * scale * 520)))
  const trees = ['tree_conifer_a', 'tree_conifer_b', 'tree_round_a', 'tree_round_b', 'bush']
  for (let attempt = 0, placed = 0; attempt < treeTarget * 5 && placed < treeTarget; attempt++) {
    const x = (random() * 2 - 1) * site.extent.x * 1.25
    const z = (random() * 2 - 1) * site.extent.z * 1.25
    const shore = terrain.coastZ(x) - z
    if (shore < 20 * scale || nearTown(x, z, 10 * scale) || (site.hasAirport && insideAirport(x, z))) continue
    const height = terrain.heightAt(x, z)
    // Woods on the hills, a sprinkle on the lowland.
    if (height < 3 * scale && random() > 0.25) continue
    const conifer = height > 10 * scale
    const name = conifer ? trees[Math.floor(random() * 2)] : trees[2 + Math.floor(random() * 3)]
    add(name, { position: [x, height - 0.3, z], rotation: random() * Math.PI * 2, scale: scale * (0.8 + random() * 0.5) })
    placed++
  }

  for (let index = 0; index < 26; index++) {
    const x = (random() * 2 - 1) * site.extent.x * 1.1
    const z = terrain.coastZ(x) + (6 + random() * 18) * scale
    add(random() < 0.5 ? 'rock_a' : 'rock_b', { position: [x, terrain.heightAt(x, z) + 0.2, z], rotation: random() * 6, scale: scale * (0.8 + random()) })
  }
  for (let index = 0; index < 9; index++) {
    const x = (random() * 2 - 1) * site.extent.x * 0.95
    const z = terrain.coastZ(x) + (60 + random() * 260) * scale
    add(random() < 0.5 ? 'boat_fishing' : 'boat_sail', { position: [x, 0, z], rotation: random() * 6, scale })
  }
  const lighthouseX = site.extent.x * 0.55
  const lighthouseZ = terrain.coastZ(lighthouseX) - 6 * scale
  add('lighthouse', { position: [lighthouseX, terrain.heightAt(lighthouseX, lighthouseZ), lighthouseZ], rotation: 0, scale })
  return groups
}

export function Terrain({ site, terrain, mapUniforms }) {
  const nodes = useAssets()
  const groups = useMemo(() => scatter(site, terrain), [site, terrain])
  return (
    <group>
      <TerrainMesh site={site} terrain={terrain} mapUniforms={mapUniforms} />
      <Water site={site} mapUniforms={mapUniforms} />
      {Object.entries(groups).map(([name, items]) =>
        nodes[name] ? <InstancedModel key={name} node={nodes[name]} items={items} tintMaterial="none" shadows={site.id !== 'CTR'} /> : null,
      )}
    </group>
  )
}
