import * as THREE from 'three'
import {
  lines, stations, lineById, stationById, depotLayout, GROUND_CELL, LANE_OFFSET, CAR_CENTRES, CAR_KINDS,
  trainDoorCentres, PSD_UNIT_WIDTH, PSD_WALL_HALF_LENGTH,
  PLATFORM_HALF_LENGTH, PIER_SCALE, VIADUCT_DECK_Y, TRAIN_HALF_LENGTH,
} from '../data/network.js'
import { smoothstep } from '../sim/path.js'
import { STATION_GEOMETRY } from '../sim/simulation.js'
import {
  takeRoot, extractParts, InstancedAssembly, staticAssembly, classifyTrainPart, classifyStationPart, classifyWashPart,
} from './assets.js'
import { buildViaductDeck } from './viaduct.js'
import { makeAsphaltTexture, makeConcreteTexture, makeMovementAuthorityTexture, makePavingTexture, makeSoilTexture, makeStrataTexture } from './textures.js'

const GROUND_SCALE_Y = 32 / 22
const SHED_CENTRE_Z = 40.5
const WORKSHOP_CENTRE_Z = -23.5
const MODULE_LENGTH = 9.8
const MODULE_COUNT = 13
const PSD_PLANE = 5.3

const tempEuler = new THREE.Euler()
const tempQuaternion = new THREE.Quaternion()
const tempPosition = new THREE.Vector3()
const tempScale = new THREE.Vector3()

export function compose(x, y, z, yaw = 0, scaleX = 1, scaleY = 1, scaleZ = 1, pitch = 0) {
  tempEuler.set(0, yaw, pitch, 'YXZ')
  tempQuaternion.setFromEuler(tempEuler)
  tempPosition.set(x, y, z)
  tempScale.set(scaleX, scaleY, scaleZ)
  return new THREE.Matrix4().compose(tempPosition, tempQuaternion, tempScale)
}

function hashNoise(i, j, salt = 0) {
  let h = Math.imul(i * 374761393 + j * 668265263 + salt * 2147483647, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function laneOffsetFor(dir) {
  return -LANE_OFFSET * dir
}

export function crossoverOffset(crossover, s) {
  const t = (s - crossover.sx0) / (crossover.sx1 - crossover.sx0)
  return crossover.fromOff + (crossover.toOff - crossover.fromOff) * smoothstep(t)
}

function insideBounds(x, z, bounds, margin = 0) {
  return x >= bounds.minX - margin && x <= bounds.maxX + margin && z >= bounds.minZ - margin && z <= bounds.maxZ + margin
}

// Point on a line at distance s, shifted sideways by `offset` along the left normal.
export function linePoint(line, s, offset) {
  const sample = line.path.at(s)
  const normalX = sample.tz
  const normalZ = -sample.tx
  return { x: sample.x + normalX * offset, z: sample.z + normalZ * offset, tx: sample.tx, tz: sample.tz }
}

function stationYaw(pose) {
  return Math.atan2(-pose.tz, pose.tx)
}

export function buildSite({ site, assets, simulation }) {
  const group = new THREE.Group()
  group.name = `site-${site.id}`
  const dynamic = []
  const proxies = []
  const statics = []
  const heightGrid = new Map()
  const sunShadowTargets = []

  const siteLines = lines.filter((line) => site.lineIds.includes(line.id))
  const siteStations = stations.filter((station) => {
    if (!site.lineIds.includes(station.lineId)) return false
    const line = lineById[station.lineId]
    const sample = line.path.at(station.s)
    return insideBounds(sample.x, sample.z, site.bounds, 60)
  })

  // ---------------------------------------------------------------- ground and city
  const openCells = new Map()
  siteLines.filter((line) => line.buried).forEach((line) => {
    for (let s = 0; s <= line.path.length; s += 6) {
      const sample = line.path.at(s)
      const i = Math.round(sample.x / GROUND_CELL)
      const j = Math.round(sample.z / GROUND_CELL)
      const key = `${i},${j}`
      const floor = line.railY - 3.2
      openCells.set(key, Math.min(openCells.get(key) ?? 0, floor))
    }
  })
  // Dollhouse cut: one more cell row on the camera side is dug as a soil slope, so the near lip never hides the near lane
  // and the cut has no empty floor.
  const slopeCells = new Map()
  const viewVector = new THREE.Vector2(site.viewSide[0], site.viewSide[2]).normalize()
  siteLines.filter((line) => line.buried).forEach((line) => {
    for (let s = 0; s <= line.path.length; s += 6) {
      const sample = line.path.at(s)
      const normalX = sample.tz
      const normalZ = -sample.tx
      const towardCamera = normalX * viewVector.x + normalZ * viewVector.y > 0 ? 1 : -1
      const i = Math.round((sample.x + normalX * towardCamera * GROUND_CELL) / GROUND_CELL)
      const j = Math.round((sample.z + normalZ * towardCamera * GROUND_CELL) / GROUND_CELL)
      const key = `${i},${j}`
      if (!openCells.has(key)) slopeCells.set(key, { floorY: line.railY - 3.2, dirX: normalX * towardCamera, dirZ: normalZ * towardCamera })
    }
  })
  // A slope cell is never also a flat open cell.
  openCells.forEach((_, key) => slopeCells.delete(key))
  const cellMinI = Math.ceil(site.bounds.minX / GROUND_CELL)
  const cellMaxI = Math.floor(site.bounds.maxX / GROUND_CELL)
  const cellMinJ = Math.ceil(site.bounds.minZ / GROUND_CELL)
  const cellMaxJ = Math.floor(site.bounds.maxZ / GROUND_CELL)
  const isDepot = site.id === 'depot'
  const soilTexture = makeSoilTexture()
  const soilMaterial = new THREE.MeshStandardMaterial({ map: soilTexture, roughness: 0.97 })
  const slopeMaterial = new THREE.MeshStandardMaterial({ map: makeStrataTexture(), roughness: 0.97 })
  const capMaterial = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), roughness: 0.85 })
  const pavingMaterial = new THREE.MeshStandardMaterial({ map: makePavingTexture(), roughness: 0.92 })
  const pavingMatrices = []

  const groundMatrices = { Ground_grass: [], Ground_road_x: [], Ground_cross: [] }
  const trenchBoxes = []
  const slopeBuilders = []
  const buildingCells = []
  const propSpots = { trees: [], lamps: [] }
  const lineProbe = []
  siteLines.forEach((line) => {
    for (let s = 0; s <= line.path.length; s += 20) {
      const sample = line.path.at(s)
      lineProbe.push({ x: sample.x, z: sample.z, y: line.railY })
    }
  })
  const view = new THREE.Vector2(site.viewSide[0], site.viewSide[2]).normalize()

  for (let i = cellMinI; i <= cellMaxI; i += 1) {
    for (let j = cellMinJ; j <= cellMaxJ; j += 1) {
      const cx = i * GROUND_CELL
      const cz = j * GROUND_CELL
      const key = `${i},${j}`
      if (openCells.has(key)) {
        const floorY = openCells.get(key)
        trenchBoxes.push(compose(cx, (floorY - 32) / 2, cz, 0, GROUND_CELL, floorY + 32, GROUND_CELL))
        continue
      }
      if (slopeCells.has(key)) {
        slopeBuilders.push({ cx, cz, ...slopeCells.get(key) })
        continue
      }
      const roadAlongX = !isDepot && j % 3 === 0
      const roadAlongZ = !isDepot && i % 3 === 0
      let type = 'Ground_grass'
      let yaw = 0
      if (roadAlongX && roadAlongZ) type = 'Ground_cross'
      else if (roadAlongX) type = 'Ground_road_x'
      else if (roadAlongZ) {
        type = 'Ground_road_x'
        yaw = Math.PI / 2
      }
      groundMatrices[type].push(compose(cx, 0, cz, yaw, 1, GROUND_SCALE_Y, 1))
      if (type === 'Ground_grass') buildingCells.push({ i, j, cx, cz })
      if (type !== 'Ground_grass' && !(roadAlongX && roadAlongZ)) {
        // Lamps along the road edge, every other cell.
        if ((i + j) % 2 === 0) propSpots.lamps.push({ x: cx + (roadAlongX ? 0 : 12.5), z: cz + (roadAlongX ? 12.5 : 0), yaw: roadAlongX ? 0 : Math.PI / 2 })
      }
    }
  }
  // The road tiles stack pavement, asphalt (+2.9 cm) and lane paint (+5.1 cm) in one model. Seen from hundreds of metres
  // away those gaps are inside the depth precision and the layers flickered, so each upper layer is pulled toward the
  // camera in depth as well.
  const depthBiasByMaterial = { Asphalt: 2, LanePaint: 4 }
  Object.entries(groundMatrices).forEach(([name, matrices]) => {
    if (matrices.length === 0) return
    const assembly = staticAssembly(takeRoot(assets, 'city', name), matrices, { castShadow: false, receiveShadow: true })
    assembly.group.traverse((child) => {
      if (!child.isMesh) return
      const bias = depthBiasByMaterial[child.material.name]
      if (!bias) return
      child.material = child.material.clone()
      child.material.polygonOffset = true
      child.material.polygonOffsetFactor = -bias
      child.material.polygonOffsetUnits = -bias * 2
    })
    group.add(assembly.group)
  })
  if (trenchBoxes.length > 0) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), soilMaterial, trenchBoxes.length)
    trenchBoxes.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    group.add(mesh)
  }
  // Soil slope: a triangular prism rising from the cut floor to street level on the camera side.
  slopeBuilders.forEach(({ cx, cz, floorY, dirX, dirZ }) => {
    const half = GROUND_CELL / 2
    const profile = new THREE.Shape()
    profile.moveTo(-half, floorY)
    profile.lineTo(half, floorY)
    profile.lineTo(half, 0)
    profile.closePath()
    const geometry = new THREE.ExtrudeGeometry(profile, { depth: GROUND_CELL, bevelEnabled: false })
    geometry.translate(0, 0, -half)
    // Strata run by depth: v is 0 at the cut floor and 1 at street level, u follows the cut.
    const positions = geometry.attributes.position
    const strataUv = new Float32Array(positions.count * 2)
    for (let index = 0; index < positions.count; index += 1) {
      strataUv[index * 2] = positions.getZ(index) / GROUND_CELL
      strataUv[index * 2 + 1] = 1 - (positions.getY(index) - floorY) / -floorY
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(strataUv, 2))
    const slope = new THREE.Mesh(geometry, slopeMaterial)
    slope.position.set(cx, 0, cz)
    slope.rotation.y = Math.atan2(-dirZ, dirX)
    slope.receiveShadow = true
    group.add(slope)
    // Top edge of the retaining wall: a concrete capping beam where the cut face meets the street.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, GROUND_CELL), capMaterial)
    cap.position.set(cx + Math.cos(slope.rotation.y) * (half - 0.8), 0.35, cz - Math.sin(slope.rotation.y) * (half - 0.8))
    cap.rotation.y = slope.rotation.y
    cap.castShadow = true
    cap.receiveShadow = true
    group.add(cap)
  })

  // Buildings: skip any spot that would hide the line from the default camera.
  const buildingTypes = [
    ['Building_Low_A', 19], ['Building_Low_B', 23], ['Building_Mid_A', 41], ['Building_Mid_B', 48], ['Building_Tower_A', 72], ['Building_Tower_B', 85],
  ]
  const buildingMatrices = Object.fromEntries(buildingTypes.map(([name]) => [name, []]))
  const treeMatrices = [[], [], []]
  const hasBuriedLine = siteLines.some((line) => line.buried)
  // Distance from a cell to the nearest line probe, and whether that cell sits on the camera side of it.
  const lineRelation = (cx, cz) => {
    let nearest = { distance: Infinity, cameraSide: false }
    lineProbe.forEach((probe) => {
      const dx = cx - probe.x
      const dz = cz - probe.z
      const distance = Math.hypot(dx, dz)
      if (distance < nearest.distance) nearest = { distance, cameraSide: dx * view.x + dz * view.y > 0 }
    })
    return nearest
  }
  buildingCells.forEach(({ i, j, cx, cz }) => {
    if (isDepot) {
      const nearYard = cz > -75 && cz < 140
      if (nearYard) return
    }
    const relation = lineRelation(cx, cz)
    if (hasBuriedLine && relation.cameraSide && relation.distance <= 140) {
      pavingMatrices.push(compose(cx, 0.06, cz, 0, GROUND_CELL, 0.12, GROUND_CELL))
      return
    }
    const roll = hashNoise(i, j)
    const tall = hashNoise(i, j, 3)
    let typeIndex = roll < 0.28 ? 0 : roll < 0.5 ? 1 : roll < 0.68 ? 2 : roll < 0.8 ? 3 : tall < 0.5 ? 4 : 5
    // Cutaway: the camera side within 80 m of a tunnel is clean paving (no buildings), and the rest of that side stays low
    // so the camera can sit close and look down into the cut. The ring site keeps its towers off the viaduct.
    if (hasBuriedLine && relation.cameraSide) {
      if (relation.distance <= 220) typeIndex = Math.min(typeIndex, 1)
    }
    if (!hasBuriedLine && !isDepot) {
      typeIndex = Math.min(typeIndex, 3)
      if (relation.distance < 80) typeIndex = Math.min(typeIndex, 1)
      else if (relation.distance < 150) typeIndex = Math.min(typeIndex, 3)
    }
    // Park cells: trees only.
    const park = hashNoise(i, j, 9) < 0.14
    // Shrink or drop buildings that sit between the line and the camera.
    for (; typeIndex >= 0; typeIndex -= 1) {
      const height = buildingTypes[typeIndex][1]
      const blocked = lineProbe.some((probe) => {
        const dx = probe.x - cx
        const dz = probe.z - cz
        const along = -(dx * view.x + dz * view.y)
        const across = Math.abs(dx * view.y - dz * view.x)
        return along > -4 && along < height * 1.25 + 16 && across < 16
      })
      if (!blocked) break
    }
    const spread = [[-5, -4], [5, 5], [-4, 6], [6, -5]]
    if (park || typeIndex < 0) {
      for (let tree = 0; tree < 3; tree += 1) {
        const offset = spread[(((tree + i + j) % 4) + 4) % 4]
        const choice = Math.floor(hashNoise(i + tree, j, 5) * 3)
        treeMatrices[choice].push(compose(cx + offset[0] * 1.4, 0, cz + offset[1] * 1.3, hashNoise(i, j + tree, 6) * 6.28, 1.3, 1.3, 1.3))
      }
      return
    }
    const yaw = Math.floor(hashNoise(i, j, 4) * 4) * (Math.PI / 2)
    const [name, height] = buildingTypes[typeIndex]
    buildingMatrices[name].push(compose(cx, 0, cz, yaw))
    heightGrid.set(`${i},${j}`, height)
    if (hashNoise(i, j, 7) < 0.6) {
      const choice = Math.floor(hashNoise(i, j, 8) * 3)
      treeMatrices[choice].push(compose(cx + 11, 0, cz + 11, hashNoise(i, j, 2) * 6.28, 1.2, 1.2, 1.2))
    }
  })
  if (pavingMatrices.length > 0) {
    const pavingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pavingMaterial, pavingMatrices.length)
    pavingMatrices.forEach((matrix, index) => pavingMesh.setMatrixAt(index, matrix))
    pavingMesh.receiveShadow = true
    pavingMesh.frustumCulled = false
    group.add(pavingMesh)
  }
  buildingTypes.forEach(([name]) => {
    if (buildingMatrices[name].length === 0) return
    const assembly = staticAssembly(takeRoot(assets, 'city', name), buildingMatrices[name], { castShadow: true, receiveShadow: true })
    group.add(assembly.group)
  })
  treeMatrices.forEach((matrices, index) => {
    if (matrices.length === 0) return
    group.add(staticAssembly(takeRoot(assets, 'city', `Tree_${index}`), matrices, { castShadow: true, receiveShadow: false }).group)
  })
  if (propSpots.lamps.length > 0) {
    const lampMatrices = propSpots.lamps.map((spot) => compose(spot.x, 0.15, spot.z, spot.yaw))
    group.add(staticAssembly(takeRoot(assets, 'city', 'Street_Lamp'), lampMatrices, { castShadow: false, receiveShadow: false }).group)
  }

  // ---------------------------------------------------------------- lines: track, tunnels, viaducts, signals
  const trackMatrices = []
  const tunnelMatrices = []
  const pierMatrices = []
  const bufferMatrices = []
  const accessPointMatrices = []
  const signalMasts = []
  const crossoverFloors = []

  const addTrackChord = (line, s0, s1, offsetA, offsetB, withTunnel, y) => {
    const a = linePoint(line, s0, offsetA)
    const b = linePoint(line, s1, offsetB)
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    const yaw = Math.atan2(-dz, dx)
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    // Neighbouring chords overlap in a wedge on the inside of a curve; alternate a 1 cm lift so their coplanar tops never fight.
    const lift = (trackMatrices.length % 2) * 0.012
    const matrix = compose(midX, y + lift, midZ, yaw, length / 9.8, 1, 1)
    trackMatrices.push(matrix)
    if (withTunnel) {
      const open = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw))
      const flip = open.dot(view) < 0 ? Math.PI : 0
      tunnelMatrices.push(compose(midX, y + lift, midZ, yaw + flip, length / 9.8, 1, 1))
    }
    return { midX, midZ, yaw, length }
  }

  const stationRanges = (line) => stations.filter((station) => station.lineId === line.id).map((station) => [station.s - 68.8, station.s + 68.8])
  const inRanges = (s, ranges) => ranges.some(([from, to]) => s >= from && s <= to)

  siteLines.forEach((line) => {
    const length = line.path.length
    const ranges = stationRanges(line)
    const trackY = line.railY
    ;[1, -1].forEach((dir) => {
      const offset = laneOffsetFor(dir)
      let sFrom = 0
      let sTo = length
      if (line.kind === 'linear') {
        if (dir > 0) sFrom = 180
        else sTo = length - 180
      }
      // Loop curves use 3.27 m chords so the polygonal track has no visible kinks.
      const step = line.kind === 'loop' ? 9.8 / 3 : 9.8
      const sampleStart = line.kind === 'loop' ? 0 : sFrom
      const sampleEnd = line.kind === 'loop' ? length - step * 0.5 : sTo
      for (let s = sampleStart; s < sampleEnd; s += step) {
        const probe = linePoint(line, s + step / 2, offset)
        if (!insideBounds(probe.x, probe.z, site.bounds, 12)) continue
        const s1 = Math.min(s + step, length + 0.01)
        const inStation = inRanges(s + step / 2, ranges)
        const inCrossover = line.kind === 'linear' && ((s + step / 2 > 130 && s + step / 2 < 180) || (s + step / 2 < length - 130 && s + step / 2 > length - 180))
        const bore = line.buried && !inStation && !inCrossover
        addTrackChord(line, s, line.kind === 'loop' ? s + step : s1, offset, offset, bore, trackY)
        if (!line.buried && !inStation) {
          // Viaduct decks are laid below.
        }
      }
      if (line.kind === 'linear') {
        // Tail lane that exists only on the arrival side: extend to the buffer stop.
      }
    })

    if (line.kind === 'linear') {
      // Crossovers (west and east) and the tail bores that carry only the arrival lane.
      const crossovers = [
        { sx0: 130, sx1: 180, fromOff: laneOffsetFor(-1), toOff: laneOffsetFor(1), outward: -1 },
        { sx0: length - 130, sx1: length - 180, fromOff: laneOffsetFor(1), toOff: laneOffsetFor(-1), outward: 1 },
      ]
      crossovers.forEach((crossover) => {
        const low = Math.min(crossover.sx0, crossover.sx1)
        const high = Math.max(crossover.sx0, crossover.sx1)
        for (let s = low; s < high; s += 9.8) {
          const s1 = Math.min(high, s + 9.8)
          const offsetA = crossoverOffset(crossover, s)
          const offsetB = crossoverOffset(crossover, s1)
          const probe = linePoint(line, s, offsetA)
          if (!insideBounds(probe.x, probe.z, site.bounds, 12)) continue
          addTrackChord(line, s, s1, offsetA, offsetB, false, trackY)
        }
        // Invert slab under the junction so the diagonal road is not floating.
        const centre = linePoint(line, (low + high) / 2, 0)
        if (insideBounds(centre.x, centre.z, site.bounds, 0)) {
          crossoverFloors.push({ x: centre.x, z: centre.z, yaw: Math.atan2(-centre.tz, centre.tx), length: high - low + 6, y: trackY - 1.0 })
        }
        // Buffer stops at the end of the arrival lane.
        const bufferS = crossover.outward < 0 ? -1.6 : length + 1.6
        const arrivalOffset = laneOffsetFor(crossover.outward)
        const bufferPoint = linePoint(line, bufferS, arrivalOffset)
        if (insideBounds(bufferPoint.x, bufferPoint.z, site.bounds, 20)) {
          bufferMatrices.push(compose(bufferPoint.x, trackY, bufferPoint.z, Math.atan2(-bufferPoint.tz, bufferPoint.tx) + (crossover.outward < 0 ? 0 : Math.PI)))
        }
      })
      // Tail track beyond the station on the arrival lane runs to s = 0 or s = length (already sampled from 0 / to length).
      const extra = [[0, 180, -1], [length - 180, length, 1]]
      extra.forEach(([from, to, dir]) => {
        const offset = laneOffsetFor(dir)
        for (let s = from; s < to; s += 9.8) {
          const probe = linePoint(line, s + 4.9, offset)
          if (!insideBounds(probe.x, probe.z, site.bounds, 12)) continue
          // Only fill the part not already laid by the main loop (arrival lane covers the tail fully).
        }
      })
    }

    if (!line.buried) {
      // Viaduct: one continuous swept deck per lane; piers every 30 m on straights and 15 m in curves.
      const deckMaterials = {}
      extractParts(takeRoot(assets, 'structures', 'Viaduct_Span')).forEach((part) => { deckMaterials[part.material.name] = part.material })
      ;[1, -1].forEach((dir) => {
        const offset = laneOffsetFor(dir)
        group.add(buildViaductDeck({ path: line.path, offset, deckY: VIADUCT_DECK_Y, materials: deckMaterials }))
        let s = 0
        while (s < length - 0.5) {
          const probeA = line.path.at(s)
          const probeB = line.path.at(s + 30)
          const turn = Math.abs(probeA.tx * probeB.tz - probeA.tz * probeB.tx)
          const spanLength = turn > 0.05 ? 15 : 30
          const a = linePoint(line, s, offset)
          const b = linePoint(line, Math.min(length, s + spanLength), offset)
          const midX = (a.x + b.x) / 2
          const midZ = (a.z + b.z) / 2
          if (insideBounds(midX, midZ, site.bounds, 0)) {
            const dx = b.x - a.x
            const dz = b.z - a.z
            const yaw = Math.atan2(-dz, dx)
            pierMatrices.push(compose(a.x, 0, a.z, yaw, 1, PIER_SCALE, 1))
          }
          s += spanLength
        }
      })
    }

    // Signal masts and trackside radio posts every 130 m for each direction.
    ;[1, -1].forEach((dir) => {
      const offset = laneOffsetFor(dir)
      for (let s = 40; s < length - 20; s += 130) {
        if (inRanges(s, ranges)) continue
        const side = offset + (-dir) * 2.3
        const point = linePoint(line, s, side)
        if (!insideBounds(point.x, point.z, site.bounds, 0)) continue
        signalMasts.push({ lineId: line.id, dir, s, x: point.x, z: point.z, y: line.railY, yaw: Math.atan2(-point.tz, point.tx) + (dir > 0 ? Math.PI : 0), scale: line.buried ? 0.5 : 1, id: `SIG-${line.short}${dir > 0 ? 'E' : 'W'}${Math.round(s)}` })
        const radio = linePoint(line, s + 65, offset + (-dir) * 2.1)
        if (insideBounds(radio.x, radio.z, site.bounds, 0)) accessPointMatrices.push(compose(radio.x, line.railY, radio.z, Math.atan2(-radio.tz, radio.tx)))
      }
    })
  })

  const addStatic = (rootFile, rootName, matrices, options) => {
    if (matrices.length === 0) return null
    const assembly = staticAssembly(takeRoot(assets, rootFile, rootName), matrices, options)
    group.add(assembly.group)
    statics.push(assembly)
    return assembly
  }
  addStatic('track', 'Track_Slab', trackMatrices, { castShadow: false })
  addStatic('track', 'Track_Ballast', trackMatrices, { castShadow: false })
  addStatic('tunnel', 'Tunnel_Cut', tunnelMatrices)
  addStatic('structures', 'Viaduct_Pier', pierMatrices)
  addStatic('track', 'Buffer_Stop', bufferMatrices)
  addStatic('track', 'Cbtc_AccessPoint', accessPointMatrices)

  if (crossoverFloors.length > 0) {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#8c9096', roughness: 0.9 })
    crossoverFloors.forEach((floor) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(floor.length, 0.6, 24), floorMaterial)
      mesh.position.set(floor.x, floor.y, floor.z)
      mesh.rotation.y = floor.yaw
      mesh.receiveShadow = true
      group.add(mesh)
    })
  }

  // Signals: one assembly, aspect decided each refresh.
  let signalAssembly = null
  if (signalMasts.length > 0) {
    const parts = extractParts(takeRoot(assets, 'track', 'Signal_Mast'))
    parts.forEach((part) => {
      if (part.material.name === 'SignalRed') part.lamp = 'red'
      if (part.material.name === 'SignalYellow') part.lamp = 'yellow'
      if (part.material.name === 'SignalGreen') part.lamp = 'green'
    })
    signalAssembly = new InstancedAssembly(parts, signalMasts.length)
    group.add(signalAssembly.group)
  }
  const signalMatrices = signalMasts.map((mast) => compose(mast.x, mast.y, mast.z, mast.yaw, mast.scale, mast.scale, mast.scale))
  signalMasts.forEach((mast, index) => {
    const proxy = makeProxy({ type: 'signal', id: mast.id }, 3.2, 5.2, 3.2, 3)
    proxy.position.set(mast.x, mast.y + 2.5, mast.z)
    group.add(proxy)
    proxies.push(proxy)
    mast.proxy = proxy
    mast.index = index
  })
  let signalTimer = 99
  const refreshSignals = (dt) => {
    if (!signalAssembly) return
    signalTimer += dt
    if (signalTimer < 0.25) return
    signalTimer = 0
    signalAssembly.begin()
    signalMasts.forEach((mast, index) => {
      mast.aspect = simulation.signalAspect(mast.lineId, mast.dir, mast.s)
      signalAssembly.add(signalMatrices[index], { aspect: mast.aspect })
    })
    signalAssembly.end()
  }

  // ---------------------------------------------------------------- stations
  const stationFrames = {}
  const platformModuleParts = extractParts(takeRoot(assets, 'station', 'Station_Module'), classifyStationPart)
  const stationModules = new InstancedAssembly(platformModuleParts, siteStations.length * MODULE_COUNT + 2)
  group.add(stationModules.group)
  const psdUnitParts = extractParts(takeRoot(assets, 'station', 'Psd_DoorUnit'), classifyStationPart)
  const psdUnits = new InstancedAssembly(psdUnitParts, siteStations.length * 2 * 24 + 2)
  group.add(psdUnits.group)
  const psdUnitInstances = []
  const psdPanelMatrices = []
  const psdEndPostMatrices = []
  const psdLayouts = {}
  const escalatorParts = extractParts(takeRoot(assets, 'station', 'Escalator'), classifyStationPart)
  const escalators = new InstancedAssembly(escalatorParts, siteStations.length * 2 + 2)
  group.add(escalators.group)

  const stationStatic = {
    floor: [], wall: [], mezz: [], gate: [], stairs: [], entrance: [], bench: [], sign: [], kiosk: [],
  }
  const escalatorInstances = []
  const moduleInstances = []

  siteStations.forEach((station) => {
    const line = lineById[station.lineId]
    const sample = line.path.at(station.s)
    const yaw = stationYaw(sample)
    const frame = { x: sample.x, z: sample.z, y: line.railY, yaw, line, tx: sample.tx, tz: sample.tz }
    stationFrames[station.id] = frame
    const base = compose(sample.x, line.railY, sample.z, yaw)
    const farSide = sample.tz * view.x - sample.tx * view.y > 0 ? -1 : 1
    simulation.stationStates[station.id].entranceSide = farSide
    const local = (u, y, v, extraYaw = 0, sx = 1, sy = 1, sz = 1) => {
      const placed = compose(u, y, -v, extraYaw, sx, sy, sz)
      return new THREE.Matrix4().multiplyMatrices(base, placed)
    }
    for (let k = 0; k < MODULE_COUNT; k += 1) {
      const u = (k - 6) * MODULE_LENGTH
      moduleInstances.push({ stationId: station.id, matrix: local(u, 0, 0), lineId: line.id })
      stationStatic.floor.push(local(u, 0, 0))
      if (line.buried) {
        // Dollhouse cut: keep only the wall on the side away from the camera.
        const leftNearCamera = sample.tz * view.x - sample.tx * view.y > 0
        if (leftNearCamera) stationStatic.wall.push(local(u, 0, 0))
        else stationStatic.wall.push(local(u, 0, 0, Math.PI))
      }
      // Concourse slab: only the gateline band on the far side of the island (v -1.9..3.7), opaque, so the near half of the
      // platform and the trains stay visible without a stacked translucent layer.
      if (line.buried && k >= 4 && k <= 8) stationStatic.mezz.push(local(u, 0, farSide * 0.9, 0, 1, 1, 5.6 / 23))
    }
    // Screen-door wall per face: a door unit on every train door for a train stopped on its mark, fixed panels between.
    // dir +1 trains stop on the south (+z) road, dir -1 on the north road; the unit's track side is its +Y, so the south face turns half a turn.
    psdLayouts[station.id] = {}
    ;[1, -1].forEach((dir) => {
      const planeV = dir === 1 ? -PSD_PLANE : PSD_PLANE
      const faceYaw = dir === 1 ? Math.PI : 0
      const doorCentres = trainDoorCentres(dir)
      const panels = []
      let cursor = -PSD_WALL_HALF_LENGTH
      doorCentres.forEach((centre) => {
        psdUnitInstances.push({ stationId: station.id, dir, matrix: local(centre, 0, planeV, faceYaw) })
        const panelEnd = centre - PSD_UNIT_WIDTH / 2
        panels.push([cursor, panelEnd])
        cursor = centre + PSD_UNIT_WIDTH / 2
      })
      panels.push([cursor, PSD_WALL_HALF_LENGTH])
      panels.forEach(([from, to]) => psdPanelMatrices.push(local((from + to) / 2, 0, planeV, faceYaw, to - from, 1, 1)))
      psdEndPostMatrices.push(local(-PSD_WALL_HALF_LENGTH + 0.05, 0, planeV, faceYaw), local(PSD_WALL_HALF_LENGTH - 0.05, 0, planeV, faceYaw))
      psdLayouts[station.id][dir] = { doorCentres, panels }
    })
    for (let k = 0; k < 4; k += 1) {
      stationStatic.bench.push(local(-30 + k * 20, 1.1, 0))
    }
    stationStatic.sign.push(local(-26, 5.3, 0), local(26, 5.3, 0))
    if (line.buried) {
      const g = STATION_GEOMETRY
      escalatorInstances.push(
        { stationId: station.id, matrix: local(-g.escalatorU, 6.6, farSide * g.escalatorV, farSide * (Math.PI / 2)), phaseSign: 1 },
        { stationId: station.id, matrix: local(g.escalatorU, 6.6, farSide * g.escalatorV, farSide * (Math.PI / 2)), phaseSign: 1 },
      )
      stationStatic.gate.push(local(-g.escalatorU, 6.6, farSide * g.gateV, farSide * (Math.PI / 2)), local(g.escalatorU, 6.6, farSide * g.gateV, farSide * (Math.PI / 2)))
      stationStatic.stairs.push(local(-g.stairsBottomU, 1.1, -farSide * g.stairsV, 0), local(g.stairsBottomU, 1.1, farSide * g.stairsV, Math.PI))
      stationStatic.entrance.push(local(-g.escalatorU, -line.railY, farSide * 17.2, farSide > 0 ? 0 : Math.PI), local(g.escalatorU, -line.railY, farSide * 17.2, farSide > 0 ? 0 : Math.PI))
      stationStatic.kiosk.push(local(0, 6.6, farSide * 0.9, 0))
    } else {
      const g = STATION_GEOMETRY
      const slopeY = (line.railY + 1.1) / 5.5
      const slopeX = 18.5 / 12.7
      escalatorInstances.push(
        { stationId: station.id, matrix: local(-20, -line.railY + 0.05, g.elevatedEscalatorLowerV, -Math.PI / 2, slopeX, slopeY, 1), phaseSign: 1 },
        { stationId: station.id, matrix: local(20, -line.railY + 0.05, -g.elevatedEscalatorLowerV, Math.PI / 2, slopeX, slopeY, 1), phaseSign: 1 },
      )
      stationStatic.gate.push(local(-20, 1.1, 10.2, Math.PI / 2), local(20, 1.1, -10.2, -Math.PI / 2))
      stationStatic.entrance.push(local(-20, -line.railY, g.elevatedEscalatorLowerV + 2.4, Math.PI / 2), local(20, -line.railY, -g.elevatedEscalatorLowerV - 2.4, Math.PI / 2))
    }

    const box = line.buried ? { w: 132, h: 24, d: 27, y: line.railY + 6 } : { w: 132, h: 14, d: 26, y: line.railY + 4 }
    const proxy = makeProxy({ type: 'station', id: station.id }, box.w, box.h, box.d, 1)
    proxy.position.set(sample.x, box.y, sample.z)
    proxy.rotation.y = yaw
    group.add(proxy)
    proxies.push(proxy)
  })

  const psdPanels = addStatic('station', 'Psd_Panel', psdPanelMatrices, { castShadow: false })
  const psdEndPosts = addStatic('station', 'Psd_EndPost', psdEndPostMatrices, { castShadow: false })
  addStatic('station', 'Station_Floor', stationStatic.floor, { castShadow: false })
  addStatic('station', 'Station_Wall', stationStatic.wall)
  if (stationStatic.mezz.length > 0) {
    const mezzParts = extractParts(takeRoot(assets, 'station', 'Mezzanine_Module'))
    const mezzAssembly = new InstancedAssembly(mezzParts, stationStatic.mezz.length, { castShadow: true, receiveShadow: true })
    mezzAssembly.begin()
    stationStatic.mezz.forEach((matrix) => mezzAssembly.add(matrix))
    mezzAssembly.end()
    group.add(mezzAssembly.group)
  }
  addStatic('station', 'Gateline', stationStatic.gate)
  addStatic('station', 'Stairs', stationStatic.stairs)
  addStatic('station', 'Street_Entrance', stationStatic.entrance)
  addStatic('station', 'Bench', stationStatic.bench, { castShadow: false })
  addStatic('station', 'Hanging_Sign', stationStatic.sign, { castShadow: false })
  addStatic('station', 'Service_Kiosk', stationStatic.kiosk)

  // ---------------------------------------------------------------- trains
  const trainAssemblies = {}
  const trainRoots = { Cab: 'Car_Cab', Motor: 'Car_Motor', Trailer: 'Car_Trailer', MotorPanto: 'Car_MotorPanto' }
  Object.entries(trainRoots).forEach(([kind, rootName]) => {
    const parts = extractParts(takeRoot(assets, 'trains', rootName), classifyTrainPart)
    const assembly = new InstancedAssembly(parts, 40)
    assembly.enableColour('LineStripe')
    trainAssemblies[kind] = assembly
    group.add(assembly.group)
  })
  const stripeColour = new THREE.Color()
  const trainProxies = new Map()
  const authorityTexture = makeMovementAuthorityTexture()
  const authorityMaterial = new THREE.MeshBasicMaterial({ map: authorityTexture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 })
  authorityMaterial.color = new THREE.Color('#ffffff')
  const authorityBars = []
  const authorityGeometry = new THREE.PlaneGeometry(1, 1)
  authorityGeometry.rotateX(-Math.PI / 2)
  for (let index = 0; index < 24; index += 1) {
    const material = authorityMaterial.clone()
    const bar = new THREE.Mesh(authorityGeometry, material)
    bar.visible = false
    bar.renderOrder = 4
    group.add(bar)
    authorityBars.push(bar)
  }

  const carMatrix = new THREE.Matrix4()
  const carStates = { doorsLeft: 0, doorsRight: 0, wheelAngle: 0 }

  const placeTrain = (poseOfCar, train, isDepot, bodyKinds, lineColor, doorOpen, platformDir, wheelAngle) => {
    for (let k = 0; k < CAR_KINDS.length; k += 1) {
      const pose = poseOfCar(k)
      const kind = bodyKinds[k]
      const facingAlongPath = k === 0 ? -1 : 1
      const facing = k === 0 ? -1 : k === 5 ? 1 : platformDir
      let yaw = pose.yaw
      if (facing !== pose.pathSign) yaw += Math.PI
      carMatrix.copy(compose(pose.x, pose.y, pose.z, yaw, 1, 1, 1, pose.pitch ?? 0))
      carStates.doorsLeft = 0
      carStates.doorsRight = 0
      if (doorOpen > 0.001) {
        const platformIsLeft = facing === platformDir
        if (platformIsLeft) carStates.doorsLeft = doorOpen
        else carStates.doorsRight = doorOpen
      }
      carStates.wheelAngle = -(wheelAngle ?? 0) * (isDepot ? 1 : platformDir) * (facing === pose.pathSign ? 1 : -1)
      const assembly = trainAssemblies[kind]
      const index = assembly.count
      assembly.add(carMatrix, carStates)
      stripeColour.set(lineColor)
      assembly.setColour(index, stripeColour)
    }
  }

  // ---------------------------------------------------------------- depot
  let washParts = null
  let washAssembly = null
  if (isDepot) {
    const layout = depotLayout
    const shedMatrices = []
    const workshopMatrices = []
    for (let k = 0; k < 13; k += 1) {
      shedMatrices.push(compose(layout.stableCentreX + (k - 6) * MODULE_LENGTH, 0, SHED_CENTRE_Z, 0))
    }
    for (let k = 0; k < 13; k += 1) {
      workshopMatrices.push(compose(layout.stableCentreX + (k - 6) * MODULE_LENGTH, 0, WORKSHOP_CENTRE_Z, 0))
    }
    const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 5.2)]
    const makeClipped = (rootName, matrices) => {
      const parts = extractParts(takeRoot(assets, 'structures', rootName))
      parts.forEach((part) => {
        part.material = part.material.clone()
        part.material.clippingPlanes = clip
        part.material.clipShadows = true
        part.material.side = THREE.DoubleSide
      })
      const assembly = new InstancedAssembly(parts, matrices.length)
      assembly.begin()
      matrices.forEach((matrix) => assembly.add(matrix))
      assembly.end()
      group.add(assembly.group)
    }
    makeClipped('Shed_Module', shedMatrices)
    makeClipped('Workshop_Module', workshopMatrices)

    // Wash plant with spinning brushes.
    washParts = extractParts(takeRoot(assets, 'structures', 'Wash_Plant'), classifyWashPart)
    washAssembly = new InstancedAssembly(washParts, 1)
    group.add(washAssembly.group)
    const washBase = compose(layout.washX - 2, 0, 0, 0)

    addStatic('structures', 'Control_Centre', [compose(layout.controlCentre[0], 0, layout.controlCentre[1], Math.PI)])
    addStatic('structures', 'Substation', [compose(layout.substation[0], 0, layout.substation[1], 0)])

    // Tracks: the lead, west fans, stabling straights and east fans.
    const depotTrack = []
    const pushPolyline = (points) => {
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index]
        const b = points[index + 1]
        const dx = b[0] - a[0]
        const dz = b[1] - a[1]
        depotTrack.push(compose((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, Math.atan2(-dz, dx), Math.hypot(dx, dz) / 9.8, 1, 1))
      }
    }
    const straight = (x0, x1, z) => {
      const points = []
      const pieces = Math.ceil(Math.abs(x1 - x0) / 9.8)
      for (let index = 0; index <= pieces; index += 1) points.push([x0 + ((x1 - x0) * index) / pieces, z])
      return points
    }
    const fan = (xa, xb, za, zb) => {
      const points = []
      const pieces = Math.max(6, Math.ceil((xb - xa) / 9.8))
      for (let index = 0; index <= pieces; index += 1) {
        const t = index / pieces
        points.push([xa + (xb - xa) * t, za + (zb - za) * smoothstep(t)])
      }
      return points
    }
    pushPolyline(straight(layout.leadStart, layout.leadEnd, 0))
    ;[...layout.stablingZ, ...layout.workshopZ].forEach((z) => {
      pushPolyline(fan(layout.westFan[0], layout.westFan[1], 0, z))
      pushPolyline(straight(layout.westFan[1], layout.eastFan[0], z))
      pushPolyline(fan(layout.eastFan[0], layout.eastFan[1], z, 0))
    })
    addStatic('track', 'Track_Slab', depotTrack, { castShadow: false })
    addStatic('track', 'Track_Ballast', depotTrack, { castShadow: false })
    const bufferEnds = [...layout.stablingZ, ...layout.workshopZ].map(() => null)

    // Yard hardstanding so the ground reads as a working surface, not bare grass.
    const concrete = makeConcreteTexture()
    concrete.repeat.set(30, 8)
    const yardMaterial = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 })
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(780, 230), yardMaterial)
    yard.rotation.x = -Math.PI / 2
    yard.position.set(0, 0.03, 20)
    yard.receiveShadow = true
    group.add(yard)

    washProxyBase(washBase)
    function washProxyBase(matrix) {
      const proxy = makeProxy({ type: 'facility', id: 'wash' }, 46, 8, 11, 1)
      proxy.position.set(layout.washX, 3.5, 0)
      group.add(proxy)
      proxies.push(proxy)
      const wash = { base: matrix }
      washAssembly.userBase = wash.base
    }
    ;[
      ['shed', 'Stabling shed', layout.stableCentreX, SHED_CENTRE_Z, 130, 6, 32],
      ['workshop', 'Maintenance workshop', layout.stableCentreX, WORKSHOP_CENTRE_Z, 130, 8, 31],
      ['control', 'Control centre', layout.controlCentre[0], layout.controlCentre[1], 46, 26, 29],
      ['substation', 'Substation', layout.substation[0], layout.substation[1], 20, 8, 25],
    ].forEach(([id, , x, z, w, h, d]) => {
      const proxy = makeProxy({ type: 'facility', id }, w, h, d, 1)
      proxy.position.set(x, h / 2, id === 'substation' ? z + 4 : z)
      group.add(proxy)
      proxies.push(proxy)
    })
  }

  // ---------------------------------------------------------------- crowd
  const figureNames = ['Figure_Adult_Rig', 'Figure_Child_Rig', 'Figure_Backpack_Rig']
  const figureAssemblies = figureNames.map((name) => {
    const parts = extractParts(takeRoot(assets, 'people', name))
    const assembly = new InstancedAssembly(parts, 260, { castShadow: true, receiveShadow: false })
    assembly.enableColour('FigureShirt')
    group.add(assembly.group)
    return assembly
  })
  const lowDensity = new THREE.Color('#2ec4b6')
  const midDensity = new THREE.Color('#ffc247')
  const highDensity = new THREE.Color('#ef476f')
  const shirtColour = new THREE.Color()

  // ---------------------------------------------------------------- per-frame update
  const worldPositionOfTrain = new Map()
  const trainProxy = (train) => {
    let proxy = trainProxies.get(train.id)
    if (!proxy) {
      proxy = makeProxy({ type: 'train', id: train.id }, 126, 5.2, 4.6, 5)
      group.add(proxy)
      proxies.push(proxy)
      trainProxies.set(train.id, proxy)
    }
    proxy.visible = false
    return proxy
  }

  const depotWashFrame = { angle: 0 }
  let stepTime = 0

  const update = (dt, elapsed) => {
    stepTime = elapsed
    refreshSignals(dt)

    // Platform doors and escalator steps.
    stationModules.begin()
    const doorStateByStation = {}
    simulation.trains.forEach((train) => {
      if (train.ghost) return
      if ((train.state === 'dwell' || train.state === 'fault') && train.atStationId) {
        doorStateByStation[train.atStationId] ??= {}
        doorStateByStation[train.atStationId][train.dir] = simulation.blend(train, 'doorOpen')
      }
    })
    moduleInstances.forEach((instance) => stationModules.add(instance.matrix))
    stationModules.end()
    // Screen-door leaves follow the same door-open value as the train doors of the train on that face.
    psdUnits.begin()
    psdUnitInstances.forEach((instance) => {
      psdUnits.add(instance.matrix, { psdOpen: doorStateByStation[instance.stationId]?.[instance.dir] ?? 0 })
    })
    psdUnits.end()

    escalators.begin()
    const stepPhase = (elapsed * 1.18) % 1
    escalatorInstances.forEach((instance) => escalators.add(instance.matrix, { stepPhase }))
    escalators.end()

    // Trains.
    Object.values(trainAssemblies).forEach((assembly) => assembly.begin())
    let barIndex = 0
    authorityBars.forEach((bar) => { bar.visible = false })
    trainProxies.forEach((proxy) => { proxy.userData.active = false })

    simulation.trains.forEach((train) => {
      if (train.ghost) return
      const line = lineById[train.lineId]
      if (!siteLines.some((candidate) => candidate.id === line.id)) return
      const bodyKinds = CAR_KINDS.map((kind) => (kind === 'Motor' && line.power === 'overhead pantograph' ? 'MotorPanto' : kind))
      const trainS = simulation.blend(train, 's', 8)
      const length = line.path.length
      const carPose = (k) => {
        const sCar = trainS + CAR_CENTRES[k]
        const offsetAt = (value) => (train.xover ? crossoverOffset(train.xover, value) : laneOffsetFor(train.dir))
        const a = linePoint(line, sCar - 4, offsetAt(sCar - 4))
        const b = linePoint(line, sCar + 4, offsetAt(sCar + 4))
        const centre = linePoint(line, sCar, offsetAt(sCar))
        return { x: centre.x, y: line.railY, z: centre.z, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), pathSign: 1 }
      }
      const head = carPose(2)
      const tail = carPose(3)
      if (!insideBounds(head.x, head.z, site.bounds, 80) && !insideBounds(tail.x, tail.z, site.bounds, 80)) return
      const doorOpen = train.state === 'dwell' || train.state === 'fault' ? simulation.blend(train, 'doorOpen') : 0
      placeTrain(carPose, train, false, bodyKinds, line.color, doorOpen, train.dir, simulation.blend(train, 'wheelAngle'))

      const centrePose = linePoint(line, trainS, train.xover ? crossoverOffset(train.xover, trainS) : laneOffsetFor(train.dir))
      const proxy = trainProxy(train)
      proxy.position.set(centrePose.x, line.railY + 2.2, centrePose.z)
      proxy.rotation.y = Math.atan2(-centrePose.tz, centrePose.tx)
      proxy.visible = false
      proxy.userData.active = true
      worldPositionOfTrain.set(train.id, { x: centrePose.x, y: line.railY, z: centrePose.z, yaw: proxy.rotation.y })

      // Movement authority: soft bar ahead of the front cab.
      if (train.speed > 0.4 && train.authority > 5 && barIndex < authorityBars.length) {
        const bar = authorityBars[barIndex]
        barIndex += 1
        const frontS = trainS + train.dir * (TRAIN_HALF_LENGTH + 2)
        const reachS = frontS + train.dir * train.authority
        const offset = train.xover ? crossoverOffset(train.xover, frontS) : laneOffsetFor(train.dir)
        const frontPoint = linePoint(line, frontS, offset)
        const reachPoint = linePoint(line, reachS, train.xover ? crossoverOffset(train.xover, reachS) : laneOffsetFor(train.dir))
        const dx = reachPoint.x - frontPoint.x
        const dz = reachPoint.z - frontPoint.z
        const barLength = Math.max(1, Math.hypot(dx, dz))
        bar.position.set((frontPoint.x + reachPoint.x) / 2, line.railY + 0.35, (frontPoint.z + reachPoint.z) / 2)
        bar.rotation.set(0, Math.atan2(-dz, dx), 0)
        bar.scale.set(barLength, 1, 3.4)
        bar.material.color.set(line.color)
        bar.visible = true
      }
    })

    if (isDepot) {
      simulation.depot.trains.forEach((train) => {
        const proxy = trainProxy(train)
        proxy.visible = false
        if (train.stage === 'gone') return
        const slot = simulation.depot.slots[train.slotIndex]
        const bodyKinds = CAR_KINDS.slice()
        const depotS = simulation.blend(train, 's', 8)
        let poseOfCar
        if (train.route && (train.stage === 'departing' || train.stage === 'arriving')) {
          const route = train.route
          poseOfCar = (k) => {
            const sCar = depotS + CAR_CENTRES[k]
            const a = route.at(sCar - 4)
            const b = route.at(sCar + 4)
            const centre = route.at(sCar)
            return { x: centre.x, y: 0, z: centre.z, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), pathSign: 1 }
          }
        } else {
          poseOfCar = (k) => ({ x: depotLayout.stableCentreX + CAR_CENTRES[k], y: 0, z: slot.z, yaw: 0, pathSign: 1 })
        }
        const lineColor = train.stage === 'maintenance' ? '#f5b301' : '#16b8a6'
        placeTrain(poseOfCar, train, true, bodyKinds, lineColor, 0, 1, simulation.blend(train, 'wheelAngle'))
        const centreX = simulation.blend(train, 'centreX', 8)
        const centreZ = simulation.blend(train, 'centreZ', 8)
        proxy.position.set(centreX, 2.2, centreZ)
        const heading = train.route ? train.route.at(depotS) : { tx: 1, tz: 0 }
        proxy.rotation.y = Math.atan2(-heading.tz, heading.tx)
        worldPositionOfTrain.set(train.id, { x: centreX, y: 0, z: centreZ, yaw: proxy.rotation.y })
        proxy.userData.active = true
      })
      if (washAssembly) {
        washAssembly.begin()
        washAssembly.add(washAssembly.userBase, { brushAngle: simulation.depot.brushAngle })
        washAssembly.end()
      }
    }
    Object.values(trainAssemblies).forEach((assembly) => {
      assembly.end()
      assembly.endColours()
    })

    // Passengers.
    figureAssemblies.forEach((assembly) => assembly.begin())
    simulation.agents.forEach((agent) => {
      const frame = stationFrames[agent.stationId]
      if (!frame) return
      const station = stationById[agent.stationId]
      const crowding = simulation.stationStates[agent.stationId].crowding
      const walking = !agent.waiting && agent.wait <= 0
      const bob = walking ? Math.abs(Math.sin(elapsed * 9 + agent.phase)) * 0.06 : 0
      let heading = agent.heading
      if (!walking && agent.travelDirection) heading = (-agent.travelDirection) * (Math.PI / 2)
      const cosine = Math.cos(frame.yaw)
      const sine = Math.sin(frame.yaw)
      const localX = simulation.blend(agent, 'u', 2)
      const localZ = -simulation.blend(agent, 'v', 2)
      const worldX = frame.x + localX * cosine + localZ * sine
      const worldZ = frame.z - localX * sine + localZ * cosine
      const worldY = frame.y + simulation.blend(agent, 'y', 2) + bob
      const assembly = figureAssemblies[agent.variant]
      const matrix = compose(worldX, worldY, worldZ, frame.yaw + heading, 1.08, 1.08, 1.08)
      const index = assembly.count
      assembly.add(matrix)
      const density = Math.min(1, crowding)
      if (density < 0.5) shirtColour.copy(lowDensity).lerp(midDensity, density * 2)
      else shirtColour.copy(midDensity).lerp(highDensity, (density - 0.5) * 2)
      assembly.setColour(index, shirtColour)
      void station
    })
    figureAssemblies.forEach((assembly) => {
      assembly.end()
      assembly.endColours()
    })
  }

  signalMasts.forEach((mast) => {
    worldPositionOfTrain.set(mast.id, { x: mast.x, y: mast.y, z: mast.z, yaw: 0 })
  })

  // Pose of any selectable object, for the selection ring, pins and the camera.
  const poseOf = (ref) => {
    if (!ref) return null
    if (ref.type === 'train') {
      const pose = worldPositionOfTrain.get(ref.id)
      return pose ? { ...pose, ring: { rx: 66, rz: 2.6, power: 4 }, height: 4.3 } : null
    }
    if (ref.type === 'station') {
      const frame = stationFrames[ref.id]
      return frame ? { x: frame.x, y: frame.y, z: frame.z, yaw: frame.yaw, ring: { rx: 69, rz: frame.line.buried ? 14 : 13, power: 4 }, height: 10 } : null
    }
    if (ref.type === 'signal') {
      const pose = worldPositionOfTrain.get(ref.id)
      return pose ? { ...pose, ring: { rx: 1.6, rz: 1.6, power: 2 }, height: 4.5 } : null
    }
    if (ref.type === 'facility') {
      const layout = depotLayout
      const table = {
        wash: { x: layout.washX, z: 0, rx: 25, rz: 6.5, height: 6 },
        shed: { x: layout.stableCentreX, z: SHED_CENTRE_Z, rx: 68, rz: 17, height: 8 },
        workshop: { x: layout.stableCentreX, z: WORKSHOP_CENTRE_Z, rx: 68, rz: 16.5, height: 10 },
        control: { x: layout.controlCentre[0], z: layout.controlCentre[1], rx: 25, rz: 16, height: 24 },
        substation: { x: layout.substation[0], z: layout.substation[1] + 2, rx: 11, rz: 10.5, height: 7 },
      }
      const item = table[ref.id]
      return item ? { x: item.x, y: 0, z: item.z, yaw: 0, ring: { rx: item.rx, rz: item.rz, power: 4 }, height: item.height } : null
    }
    return null
  }

  const heightAt = (x, z) => {
    const i = Math.round(x / GROUND_CELL)
    const j = Math.round(z / GROUND_CELL)
    return heightGrid.get(`${i},${j}`) ?? 0
  }

  return { group, update, proxies, poseOf, heightAt, stationFrames, signalMasts, siteStations, psdLayouts, psdUnits, psdPanels, psdEndPosts, trainAssemblies }
}

function makeProxy(ref, width, height, depth, priority) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial({ visible: false }))
  mesh.userData.ref = ref
  mesh.userData.priority = priority
  mesh.visible = false
  return mesh
}
