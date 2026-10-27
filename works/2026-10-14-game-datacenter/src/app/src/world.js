// Builds one data hall: its layout and the entities the sim and the views read.
// All numbers and names are made up.

export const SITES = [
  { id: 'h1', code: 'H1', name: 'Hall 1 North', purpose: 'Training', rows: 6, racksPerRow: 12, chillers: 6, robots: 3, techs: 2, seed: 11, rackColor: '#30354a',
    run: { name: 'Cobalt-7', size: '140B params', stage: 1, step: 41280, totalSteps: 60000, loss: 1.932 } },
  { id: 'h2', code: 'H2', name: 'Hall 2 South', purpose: 'Training', rows: 8, racksPerRow: 10, chillers: 8, robots: 4, techs: 2, seed: 23, rackColor: '#2b2d5c',
    run: { name: 'Saffron-3', size: '62B params', stage: 3, step: 18400, totalSteps: 24000, loss: 1.611 } },
  { id: 'h3', code: 'H3', name: 'Hall 3 East', purpose: 'Inference', rows: 4, racksPerRow: 14, chillers: 4, robots: 2, techs: 2, seed: 37, rackColor: '#e8ebf3',
    run: { name: 'Tern-12', size: '9B params', stage: 4, step: 5120, totalSteps: 8000, loss: 1.284 } },
]

export const RUN_STAGES = ['Data mix', 'Pretrain', 'Checkpoint', 'Evals', 'Fine-tune', 'Release']

export const RACK = { width: 0.78, depth: 1.2, height: 2.2, pitchX: 0.86, pitchZ: 3, trays: 8, gpusPerTray: 4 }

const TECH_CALLSIGNS = ['Juno', 'Rook', 'Pike', 'Vale']
const TRAINING_NAMES = { h1: ['Cobalt-7 pretrain', 'Cobalt-7 shadow eval'], h2: ['Saffron-3 evals', 'Saffron-3 ablation B'], h3: ['Tern-12 fine-tune'] }
const INFERENCE_NAMES = ['Chat pool east', 'Code assist pool', 'Embedding pool', 'Batch summaries', 'Search rerank pool']

export function createRandom(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function computeLayout(site) {
  const halfSpanX = (site.racksPerRow * RACK.pitchX) / 2
  const halfSpanZ = (site.rows * RACK.pitchZ) / 2
  const corridorX = halfSpanX + 1.6
  const wallX = halfSpanX + 4.4
  const wallZ = halfSpanZ + 1.4
  return { halfSpanX, halfSpanZ, corridorX, wallX, wallZ }
}

function rowZ(site, rowIndex) {
  return (rowIndex - (site.rows - 1) / 2) * RACK.pitchZ
}

function buildRacks(site, random) {
  const racks = []
  for (let row = 0; row < site.rows; row++) {
    // Rows face each other across cold aisles: even rows face +z, odd rows face -z.
    const facing = row % 2 === 0 ? 1 : -1
    for (let column = 0; column < site.racksPerRow; column++) {
      const code = String.fromCharCode(65 + row) + String(column + 1).padStart(2, '0')
      racks.push({
        id: `${site.code}-${code}`,
        kind: 'rack',
        name: `Rack ${code}`,
        row,
        column,
        x: (column - (site.racksPerRow - 1) / 2) * RACK.pitchX,
        z: rowZ(site, row),
        facing,
        aisleZ: rowZ(site, row) + facing * (RACK.pitchZ / 2),
        load: 0.2,
        temperature: 48 + random() * 6,
        trayTemperatures: Array.from({ length: RACK.trays }, () => 48 + random() * 6),
        powerKw: 30,
        jobId: null,
        failedTray: null,
      })
    }
  }
  return racks
}

function assignJobs(site, racks, random) {
  const jobs = []
  const trainingNames = TRAINING_NAMES[site.id]
  const trainingShare = site.purpose === 'Training' ? 0.7 : 0.25
  const trainingRackCount = Math.round(racks.length * trainingShare)
  const perTrainingJob = Math.ceil(trainingRackCount / trainingNames.length)
  let cursor = 0
  trainingNames.forEach((name, index) => {
    const jobRacks = racks.slice(cursor, cursor + perTrainingJob)
    cursor += perTrainingJob
    jobs.push({
      id: `${site.code}-J${index + 1}`,
      kind: 'job',
      jobType: 'training',
      name,
      rackIds: jobRacks.map((rack) => rack.id),
      progress: 0.35 + random() * 0.4,
      progressRate: 0.0009 + random() * 0.0006,
      tokensPerGpu: 2600 + random() * 900,
      tokensPerSecond: 0,
      gpus: 0,
      targetLoad: 0.88 + random() * 0.08,
    })
  })
  const remaining = racks.slice(cursor)
  const poolCount = site.purpose === 'Inference' ? 4 : 2
  const perPool = Math.ceil(remaining.length / poolCount)
  for (let index = 0; index < poolCount; index++) {
    const jobRacks = remaining.slice(index * perPool, (index + 1) * perPool)
    if (jobRacks.length === 0) continue
    jobs.push({
      id: `${site.code}-P${index + 1}`,
      kind: 'job',
      jobType: 'inference',
      name: INFERENCE_NAMES[(index + site.seed) % INFERENCE_NAMES.length],
      rackIds: jobRacks.map((rack) => rack.id),
      progress: random(),
      progressRate: 0.004 + random() * 0.004,
      tokensPerGpu: 5200 + random() * 2400,
      tokensPerSecond: 0,
      gpus: 0,
      targetLoad: 0.45 + random() * 0.35,
    })
  }
  for (const job of jobs) {
    for (const rackId of job.rackIds) racks.find((rack) => rack.id === rackId).jobId = job.id
  }
  return jobs
}

function buildEquipment(site, layout, random) {
  const equipment = []
  const pairCount = Math.ceil(site.rows / 2)
  let crahNumber = 1
  for (const side of [-1, 1]) {
    for (let pair = 0; pair < pairCount; pair++) {
      const centerZ = (rowZ(site, pair * 2) + rowZ(site, Math.min(pair * 2 + 1, site.rows - 1))) / 2
      equipment.push({
        id: `${site.code}-CRAH${crahNumber}`, kind: 'crah', name: `Cooling unit CRAH-${crahNumber}`,
        x: side * (layout.wallX - 0.75), z: centerZ, side, health: 0.94 + random() * 0.05,
        supplyTemperature: 21, fanSpeed: 0.7,
      })
      crahNumber += 1
    }
  }
  const chillerX = layout.wallX + 5
  const columns = 2
  const perColumn = Math.ceil(site.chillers / columns)
  for (let index = 0; index < site.chillers; index++) {
    const column = Math.floor(index / perColumn)
    const position = index % perColumn
    equipment.push({
      id: `${site.code}-CH${index + 1}`, kind: 'chiller', name: `Chiller CH-${index + 1}`,
      x: chillerX + column * 3.4, z: (position - (perColumn - 1) / 2) * 3.6,
      health: 0.93 + random() * 0.06, load: 0.6, waterTemperature: 14,
    })
  }
  equipment.push({
    id: `${site.code}-SUB`, kind: 'substation', name: `Substation ${site.code}-S`,
    x: -2, z: -(layout.wallZ + 6.5), health: 1, megawatts: 0,
  })
  equipment.push({
    id: `${site.code}-BAT`, kind: 'battery', name: `Battery room ${site.code}-B`,
    x: -(layout.wallX + 5.2), z: -3, health: 1, charge: 0.97,
  })
  return equipment
}

function buildUnits(site, layout, random) {
  const units = []
  for (let index = 0; index < site.robots; index++) {
    const z = -layout.wallZ + 1.2 + index * 1.4
    units.push({
      id: `${site.code}-RC${index + 1}`, kind: 'robot', name: `Swap cart RC-${index + 1}`,
      x: -layout.corridorX, z, heading: 0, speed: 0, maxSpeed: 1.5,
      state: 'idle', task: 'Docked', path: [], routeLength: 0, ticketId: null,
      battery: 0.7 + random() * 0.28, carrying: null, waitUntil: 0.5 + index * 0.9, workProgress: 0,
      home: { x: -layout.corridorX, z },
    })
  }
  for (let index = 0; index < site.techs; index++) {
    const callsign = TECH_CALLSIGNS[(index + site.seed) % TECH_CALLSIGNS.length]
    const z = layout.wallZ - 1.4 - index * 1.2
    units.push({
      id: `${site.code}-T${index + 1}`, kind: 'tech', name: `Technician ${callsign}`,
      x: layout.corridorX, z, heading: Math.PI, speed: 0, maxSpeed: 1.05,
      state: 'idle', task: 'At the floor desk', path: [], routeLength: 0, ticketId: null,
      waitUntil: 1 + index * 1.3, workProgress: 0, shiftHours: 3 + index * 2.5,
      home: { x: layout.corridorX, z },
    })
  }
  return units
}

export function buildWorld(site) {
  const random = createRandom(site.seed)
  const layout = computeLayout(site)
  const racks = buildRacks(site, random)
  const jobs = assignJobs(site, racks, random)
  const equipment = buildEquipment(site, layout, random)
  const units = buildUnits(site, layout, random)
  const world = {
    site, layout, random, racks, jobs, equipment, units,
    alerts: [], tickets: [],
    run: { ...site.run, stages: RUN_STAGES },
    time: 0,
    nextIncidentAt: 2.2,
    incidentCount: 0,
    counters: { alert: 1040 + site.seed * 3, ticket: 310 + site.seed },
    index: new Map(),
  }
  for (const entity of [...racks, ...jobs, ...equipment, ...units]) world.index.set(entity.id, entity)
  return world
}

// Where an entity sits on the ground, for camera moves, rings and pins.
export function entityPosition(world, entity) {
  if (entity.kind === 'job') {
    const jobRacks = entity.rackIds.map((id) => world.index.get(id))
    const x = jobRacks.reduce((sum, rack) => sum + rack.x, 0) / jobRacks.length
    const z = jobRacks.reduce((sum, rack) => sum + rack.z, 0) / jobRacks.length
    return { x, z }
  }
  if (entity.kind === 'alert' || entity.kind === 'ticket') return entityPosition(world, world.index.get(entity.targetId))
  return { x: entity.x, z: entity.z }
}
