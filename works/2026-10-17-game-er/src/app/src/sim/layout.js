// Floor plan of one emergency department, built from the numbers in data.js. Metres, y up, the
// building centred on the origin with its front (walk-in entrance) towards +z and the ambulance
// bay on the east (+x) side. Headings: 0 faces +z, a heading h faces (sin h, cos h).

export function buildLayout(site) {
  const halfWidth = site.width / 2
  const halfDepth = site.depth / 2
  const backZ = -halfDepth + 6.5
  const frontZ = -halfDepth + 13.5
  const spines = [-halfWidth + 9, 4.5]
  const ambulanceDoorZ = -halfDepth + 6
  const driveX = halfWidth + 16
  const roadZ = halfDepth + 18
  const walkInX = -halfWidth + 12

  // A bay opens towards +z (out = 1, back row against the back wall) or -z (out = -1, the middle row).
  const makeCubicle = (number, x, z, out) => ({ id: `C${String(number).padStart(2, '0')}`, kind: 'cubicle', name: `Cubicle ${number}`, x, z, out, rotation: out > 0 ? 0 : Math.PI, bedAt: { x, z: z - 0.15 * out, heading: out > 0 ? Math.PI : 0 }, front: { x, z: z + 2.0 * out }, nurseSpot: { x: x + 0.75, z: z + 0.55 * out } })
  const cubicles = Array.from({ length: site.cubicles }, (_, index) => makeCubicle(index + 1, -halfWidth + 10.4 + 2.7 * index, -halfDepth + 1.6, 1))
  for (let x = -halfWidth + 10.4; x + 1.3 < -2.6; x += 2.7) cubicles.push(makeCubicle(cubicles.length + 1, x, -halfDepth + 10.6, -1))
  const resus = Array.from({ length: site.resus }, (_, index) => {
    const x = halfWidth - 2.1 - 3.8 * index
    const z = -halfDepth + 2.1
    return { id: `R${index + 1}`, kind: 'resus', name: `Resus ${index + 1}`, x, z, out: 1, rotation: 0, bedAt: { x: x + 0.2, z: z - 0.1, heading: Math.PI }, front: { x: x + 0.2, z: z + 2.6 }, nurseSpot: { x: x + 1.15, z: z + 0.2 } }
  })

  const seatRows = Array.from({ length: site.seatRows }, (_, row) => halfDepth - 4.5 - row * 3)
  const benchXs = [-halfWidth + 2.6, -halfWidth + 5.2]
  const seats = []
  seatRows.forEach((rowZ, row) => {
    benchXs.forEach((benchX, bench) => {
      for (let place = 0; place < 4; place++) {
        seats.push({ id: `S${row}${bench}${place}`, x: benchX + (1.5 - place) * 0.58, z: rowZ + 0.05, rowZ, heading: Math.PI })
      }
    })
  })
  const seatAisleX = -halfWidth + 7.4

  const triageDesks = [-3.5, 0.5].map((x, index) => ({
    id: `T${index + 1}`,
    name: `Triage ${index + 1}`,
    x,
    z: halfDepth - 8,
    nurseSpot: { x, z: halfDepth - 8 - 0.75, heading: 0 },
    patientSpot: { x, z: halfDepth - 8 + 0.85, heading: Math.PI },
  }))

  const imagingLeft = 6
  const ctX = imagingLeft + (halfWidth - imagingLeft) * 0.3
  const xrayX = imagingLeft + (halfWidth - imagingLeft) * 0.76
  const imagingZ = frontZ + 3
  const rooms = [
    { id: 'CT1', kind: 'ct', name: 'CT 1', x: ctX, z: imagingZ, heading: 0, parkAt: { x: ctX - 1.75, z: imagingZ + 2.2, heading: Math.PI }, staffSpot: { x: ctX + 2.2, z: halfDepth - 3.0, heading: Math.PI } },
    { id: 'XR1', kind: 'xray', name: 'X-ray 1', x: xrayX, z: imagingZ + 1.6, heading: 0, parkAt: { x: xrayX - 2.6, z: imagingZ + 1.4, heading: Math.PI }, staffSpot: { x: xrayX + 2.2, z: imagingZ + 4.4, heading: Math.PI } },
    { id: 'LAB', kind: 'lab', name: 'Laboratory', x: -halfWidth + 3.6, z: -halfDepth + 1.2, heading: 0, staffSpot: { x: -halfWidth + 2.6, z: -halfDepth + 2.1, heading: Math.PI } },
  ]

  const nurseStation = { x: 0, z: -halfDepth + 11.2 }
  const stationSpots = [
    { x: -1.2, z: nurseStation.z - 1.0, heading: Math.PI },
    { x: 0.4, z: nurseStation.z - 1.0, heading: Math.PI },
    { x: 2.0, z: nurseStation.z - 1.0, heading: Math.PI },
    { x: 3.6, z: nurseStation.z + 0.2, heading: -Math.PI / 2 },
    { x: -2.6, z: nurseStation.z + 1.1, heading: 0.4 },
    { x: 1.0, z: nurseStation.z + 1.2, heading: 0 },
  ]
  const porterBase = [6.4, 7.8, 9.2, 10.6].map((x) => ({ x, z: -halfDepth + 10.4, heading: -Math.PI / 2 }))

  const wardDoor = { inside: { x: -halfWidth + 1.2, z: -halfDepth + 10 }, outside: { x: -halfWidth - 9, z: -halfDepth + 10 } }
  const walkIn = { inside: { x: walkInX, z: halfDepth - 1.8 }, outside: { x: walkInX, z: halfDepth + 6 }, street: { x: walkInX, z: roadZ - 6.5 }, kiosk: { x: walkInX + 3.2, z: halfDepth - 3.2, heading: Math.PI / 2 } }

  const ambulanceBay = {
    doorZ: ambulanceDoorZ,
    parkX: halfWidth + 8.8,
    canopyX: halfWidth + 7.3,
    rearOutside: { x: halfWidth + 2.6, z: ambulanceDoorZ },
    inside: { x: halfWidth - 1.6, z: ambulanceDoorZ },
    waitSpot: { x: halfWidth - 2.4, z: ambulanceDoorZ + 2.6 },
  }
  const helipad = site.helipad ? { x: driveX + 19, z: -halfDepth - 9 } : null

  const minX = -halfWidth - 12
  const maxX = helipad ? helipad.x + 11 : driveX + 7
  const minZ = helipad ? helipad.z - 10 : -halfDepth - 8
  const maxZ = roadZ + 5
  const layout = {
    halfWidth,
    halfDepth,
    backZ,
    frontZ,
    spines,
    cubicles,
    resus,
    beds: [...resus, ...cubicles],
    seats,
    seatRows,
    benchXs,
    seatAisleX,
    triageDesks,
    rooms,
    nurseStation,
    stationSpots,
    porterBase,
    wardDoor,
    walkIn,
    ambulanceBay,
    driveX,
    roadZ,
    helipad,
    imagingLeft,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    width: maxX - minX,
    bounds: { minX, maxX, minZ, maxZ },
  }
  layout.vehiclePaths = vehiclePaths(layout)
  return layout
}

// ---------- walking routes ----------

function corridorFor(layout, z) {
  return z < (layout.backZ + layout.frontZ) / 2 ? layout.backZ : layout.frontZ
}

// Approach points into a waiting-room seat: along the side aisle, then along the front of the row.
export function seatApproach(layout, seat) {
  return [
    { x: layout.seatAisleX, z: layout.frontZ },
    { x: layout.seatAisleX, z: seat.rowZ - 0.7 },
    { x: seat.x, z: seat.rowZ - 0.7 },
  ]
}

// A walking route inside the department: out along the corridor nearest each end, switching
// corridors on the spine closest to the two ends.
export function route(layout, from, to, { exit = [], approach = [] } = {}) {
  const points = [...exit]
  const start = exit.length ? exit[exit.length - 1] : from
  const goal = approach.length ? approach[0] : to
  const startCorridor = corridorFor(layout, start.z)
  const goalCorridor = corridorFor(layout, goal.z)
  points.push({ x: start.x, z: startCorridor })
  if (startCorridor !== goalCorridor) {
    const spine = layout.spines.reduce((best, x) => (Math.abs(start.x - x) + Math.abs(goal.x - x) < Math.abs(start.x - best) + Math.abs(goal.x - best) ? x : best))
    points.push({ x: spine, z: startCorridor }, { x: spine, z: goalCorridor })
  }
  points.push({ x: goal.x, z: goalCorridor })
  points.push(...approach, { x: to.x, z: to.z })
  return simplify([from, ...points]).slice(1)
}

function simplify(points) {
  const result = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (last && Math.hypot(last.x - point.x, last.z - point.z) < 0.05) continue
    result.push({ x: point.x, z: point.z })
  }
  return result
}

// ---------- vehicles ----------

function bezier(p0, p1, p2, p3, steps = 16) {
  const points = []
  for (let index = 1; index <= steps; index++) {
    const t = index / steps
    const u = 1 - t
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      z: u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z,
    })
  }
  return points
}

// Arrive along the road from the east, turn up the drive, stop past the bay, reverse in under the
// canopy, and later drive out the same way. Each path is a list of points with a speed.
function vehiclePaths(layout) {
  const { driveX, roadZ, ambulanceBay } = layout
  const doorZ = ambulanceBay.doorZ
  const parked = { x: ambulanceBay.parkX, z: doorZ }
  const stopPoint = { x: driveX, z: doorZ - 7.5 }
  const arrive = [
    { x: driveX + 150, z: roadZ - 2 },
    { x: driveX + 9, z: roadZ - 2 },
    ...bezier({ x: driveX + 9, z: roadZ - 2 }, { x: driveX + 1, z: roadZ - 2 }, { x: driveX, z: roadZ - 4 }, { x: driveX, z: roadZ - 10 }),
    stopPoint,
  ]
  const reverse = [stopPoint, ...bezier(stopPoint, { x: driveX, z: doorZ }, { x: driveX - 4.5, z: doorZ }, parked, 20)]
  const depart = [
    parked,
    { x: driveX - 3.5, z: doorZ },
    ...bezier({ x: driveX - 3.5, z: doorZ }, { x: driveX + 0.5, z: doorZ }, { x: driveX + 1.5, z: doorZ + 3 }, { x: driveX + 1.5, z: doorZ + 7 }),
    { x: driveX + 1.5, z: roadZ - 9 },
    ...bezier({ x: driveX + 1.5, z: roadZ - 9 }, { x: driveX + 1.5, z: roadZ - 3 }, { x: driveX + 5, z: roadZ + 2 }, { x: driveX + 11, z: roadZ + 2 }),
    { x: driveX + 160, z: roadZ + 2 },
  ]
  return { arrive, reverse, depart, parked }
}

export function pathLength(points, from = null) {
  let total = 0
  let previous = from ?? points[0]
  for (const point of points) {
    total += Math.hypot(point.x - previous.x, point.z - previous.z)
    previous = point
  }
  return total
}
