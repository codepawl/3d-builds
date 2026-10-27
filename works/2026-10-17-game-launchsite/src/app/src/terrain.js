// Procedural coast heightmap (no elevation download): beach, dunes, tidal flats, a lagoon, a causeway.
// Heights are in metres, already exaggerated about 2x so the low coast reads in the dot cloud.
export const GROUND = 2

export function createRandom(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function hash(ix, iz, seed) {
  let value = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 982451653)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  value ^= value >>> 16
  return (value >>> 0) / 4294967295
}

const smooth = (value) => value * value * (3 - 2 * value)

function valueNoise(x, z, seed) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz, seed)
  const b = hash(ix + 1, iz, seed)
  const c = hash(ix, iz + 1, seed)
  const d = hash(ix + 1, iz + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

export function fbm(x, z, seed, octaves = 4) {
  let total = 0
  let amplitude = 0.5
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < octaves; octave++) {
    total += valueNoise(x * frequency, z * frequency, seed + octave * 17) * amplitude
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return total / norm
}

export function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function distanceToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

export function distanceToPolyline(x, z, points) {
  let best = Infinity
  for (let index = 0; index < points.length - 1; index++) {
    const [ax, az] = points[index]
    const [bx, bz] = points[index + 1]
    best = Math.min(best, distanceToSegment(x, z, ax, az, bx, bz))
  }
  return best
}

function signedRectDistance(x, z, rect) {
  const dx = Math.max(rect.x0 - x, 0, x - rect.x1)
  const dz = Math.max(rect.z0 - z, 0, z - rect.z1)
  return Math.hypot(dx, dz)
}

// Returns { height(x, z), isPaved(x, z) } for one site's terrain description.
export function createTerrain(site) {
  const terrain = site.terrain
  const seed = terrain.seed

  function naturalHeight(x, z) {
    let height = GROUND + 0.6 + (fbm(x / 150, z / 150, seed) - 0.45) * 8 + (fbm(x / 36, z / 36, seed + 5) - 0.5) * 2.2
    if (terrain.coastX !== undefined) {
      const shore = terrain.coastX + (fbm(z / 160, 3.3, seed + 9) - 0.5) * 70
      const inland = shore - x
      if (inland < 0) return -1.5 + Math.max(-2, inland * 0.02)
      if (inland < 34) return -0.25 + (inland / 34) * 2.0 + (fbm(x / 12, z / 30, seed + 2) - 0.5) * 0.25
      if (inland < 130) {
        const envelope = Math.sin(Math.PI * Math.min(1, (inland - 34) / 96))
        const ridges = 1 - Math.abs(fbm(x / 24, z / 55, seed + 11) * 2 - 1)
        const dune = 1.75 + envelope * (ridges * ridges * 15 + fbm(x / 9, z / 9, seed + 13) * 2)
        const blend = smoothstep(100, 130, inland)
        height = dune * (1 - blend) + height * blend
      }
    }
    if (terrain.lagoon) {
      const lagoon = terrain.lagoon
      const wobble = (fbm(x / 70, z / 70, seed + 21) - 0.5) * 0.5
      const ellipse = ((x - lagoon.x) / lagoon.rx) ** 2 + ((z - lagoon.z) / lagoon.rz) ** 2 + wobble
      if (ellipse < 1.15) {
        const depth = smoothstep(1.15, 0.55, ellipse)
        const flats = -1.4 + (fbm(x / 18, z / 18, seed + 23) - 0.5) * 0.9
        height = height * (1 - depth) + flats * depth
      }
    }
    return height
  }

  function height(x, z) {
    let value = naturalHeight(x, z)
    for (const rect of site.paved) {
      const weight = 1 - smoothstep(0, rect.edge ?? 18, signedRectDistance(x, z, rect))
      if (weight > 0) value = value * (1 - weight) + GROUND * weight
    }
    for (const road of site.roads) {
      const distance = distanceToPolyline(x, z, road.points)
      const half = road.width / 2 + 3
      if (distance < half + 16) {
        const weight = 1 - smoothstep(half, half + 16, distance)
        value = value * (1 - weight) + GROUND * weight
      }
    }
    return value
  }

  function isPaved(x, z) {
    for (const rect of site.paved) {
      if (x > rect.x0 && x < rect.x1 && z > rect.z0 && z < rect.z1) return true
    }
    for (const road of site.roads) {
      if (distanceToPolyline(x, z, road.points) < road.width / 2 + 0.6) return true
    }
    return false
  }

  return { height, isPaved }
}

// Dot positions for the terrain cloud: a jittered grid, skipping water and paved ground.
export const RELIEF = 1.8

export function buildDots(site, spacing = 1.3) {
  const { height, isPaved } = createTerrain(site)
  const random = createRandom(site.terrain.seed * 7 + 1)
  const extent = site.terrain.extent
  const positions = []
  for (let x = extent.x0; x <= extent.x1; x += spacing) {
    for (let z = extent.z0; z <= extent.z1; z += spacing) {
      const jx = x + (random() - 0.5) * spacing * 0.7
      const jz = z + (random() - 0.5) * spacing * 0.7
      const value = height(jx, jz)
      if (value < 0.08) continue
      if (isPaved(jx, jz)) continue
      // Relief above the pad level is stretched so dunes and lagoon banks read as landforms.
      const exaggerated = value > GROUND ? GROUND + (value - GROUND) * RELIEF : value
      positions.push(jx, exaggerated - 0.42, jz)
    }
  }
  return new Float32Array(positions)
}
