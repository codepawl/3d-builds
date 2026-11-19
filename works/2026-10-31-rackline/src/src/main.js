import { AISLE_ONE_X, AISLE_TWO_X } from './layout.js'
// The live app: renders the sim, runs the camera, and reads every dashboard number from the sim.
import * as THREE from 'three'
import { EffectComposer, EffectPass, RenderPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, HueSaturationEffect, BrightnessContrastEffect } from 'postprocessing'
import { N8AOPostPass } from 'n8ao'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { caseOffset, computeKpis, createSim, remainingPathPoints, stepSim, STEP_SECONDS } from './sim.js'
import { buildWorld, composeMatrix } from './world.js'
import { CONVEYOR_TOP, EMPTY_STACK, OUTBOUND_DROP_Z, STAND_TOP } from './layout.js'

const parameters = new URLSearchParams(location.search)
const PRE_ROLL_SECONDS = Number(parameters.get('preroll') ?? 900)

const sim = createSim(Number(parameters.get('seed') ?? 7))
for (let step = 0; step < PRE_ROLL_SECONDS / STEP_SECONDS; step++) stepSim(sim)

const canvas = document.getElementById('world')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(Number(parameters.get('dpr') ?? Math.min(window.devicePixelRatio, 1.5)))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 400)
const OVERVIEW_POSITION = new THREE.Vector3(29, 23, 40)
const OVERVIEW_TARGET = new THREE.Vector3(3.5, 1, -0.5)
camera.position.copy(OVERVIEW_POSITION)
const controls = new OrbitControls(camera, canvas)
controls.target.copy(OVERVIEW_TARGET)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 7
controls.maxDistance = 120
controls.minPolarAngle = 0.25
controls.maxPolarAngle = 1.32
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
controls.update()

// Light: warm low sun through the open side, cool LEDs from the fixtures overhead.
const sun = new THREE.DirectionalLight(0xffe2bd, 3.1)
sun.position.set(46, 30, 26)
sun.target.position.set(2, 0, -2)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.camera.left = -46
sun.shadow.camera.right = 46
sun.shadow.camera.top = 40
sun.shadow.camera.bottom = -40
sun.shadow.camera.near = 5
sun.shadow.camera.far = 120
sun.shadow.bias = -0.0002
sun.shadow.normalBias = 0.03
sun.shadow.radius = 3
scene.add(sun, sun.target)
scene.add(new THREE.HemisphereLight(0x9fb4cc, 0x2a2622, 0.42))
for (const [x, z] of [[-14, -7], [6, -8], [22, -8], [-14, 6], [6, 5], [24, 5]]) {
  const lamp = new THREE.PointLight(0xdfe9ff, 55, 24, 1.7)
  lamp.position.set(x, 7.8, z)
  scene.add(lamp)
}

const world = await buildWorld(scene, renderer, sim)

// Post: ambient occlusion, bloom on lamps, filmic tone map, a slight grade.
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))
const occlusion = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight)
occlusion.configuration.aoRadius = 1.5
occlusion.configuration.distanceFalloff = 1.2
occlusion.configuration.intensity = 3.2
occlusion.configuration.color = new THREE.Color(0x0a0f18)
occlusion.configuration.gammaCorrection = false
occlusion.setQualityMode('Medium')
composer.addPass(occlusion)
composer.addPass(new EffectPass(
  camera,
  new BloomEffect({ intensity: 0.75, luminanceThreshold: 1.05, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.7 }),
  new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
  new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.08 }),
  new HueSaturationEffect({ saturation: 0.1 }),
  new VignetteEffect({ offset: 0.3, darkness: 0.55 }),
  new SMAAEffect(),
))

// ---------- Path lines ----------

const lineMaterial = new LineMaterial({ color: 0x35d6bf, linewidth: 2.2, transparent: true, opacity: 0.5, depthTest: true, worldUnits: false })
const lineMaterialSelected = new LineMaterial({ color: 0x35d6bf, linewidth: 4.5, transparent: true, opacity: 1, depthTest: false, worldUnits: false })
lineMaterial.resolution.set(window.innerWidth, window.innerHeight)
lineMaterialSelected.resolution.set(window.innerWidth, window.innerHeight)
const pathLines = sim.forklifts.map(() => {
  const line = new Line2(new LineGeometry(), lineMaterial)
  line.frustumCulled = false
  line.renderOrder = 5
  line.visible = false
  scene.add(line)
  return line
})

function updatePathLine(line, forklift) {
  const isSelected = selected?.kind === 'forklift' && selected.unit === forklift
  const points = remainingPathPoints(forklift, 80, isSelected)
  if (points.length < 2) {
    line.visible = false
    return
  }
  const positions = []
  positions.push(forklift.x, 0.05, forklift.z)
  for (const point of points) positions.push(point[0], 0.05, point[1])
  line.geometry.dispose()
  line.geometry = new LineGeometry()
  line.geometry.setPositions(positions)
  line.material = isSelected ? lineMaterialSelected : lineMaterial
  line.visible = true
}

// ---------- State marks ----------

const ICONS = {
  overview: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5z"/></svg>',
  driving: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8 9h-5v9H9v-9H4z"/></svg>',
  running: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
  working: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z"/></svg>',
  waiting: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="8"/></svg>',
  fault: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 22h22zM11 9h2v7h-2zm0 8.5h2v2h-2z"/></svg>',
}

const marksRoot = document.getElementById('marks')
function createMark() {
  const element = document.createElement('div')
  element.className = 'mark'
  marksRoot.appendChild(element)
  return { element, state: null }
}
const forkliftMarks = sim.forklifts.map(createMark)
const lineMarks = sim.lines.map(createMark)

function updateMark(mark, state, worldPoint, isSelected) {
  if (mark.state !== state) {
    mark.state = state
    mark.element.className = `mark ${state}`
    mark.element.innerHTML = ICONS[state]
  }
  mark.element.classList.toggle('selected', isSelected)
  const projected = new THREE.Vector3(...worldPoint).project(camera)
  const hidden = projected.z > 1 || Math.abs(projected.x) > 1.05 || Math.abs(projected.y) > 1.05
  mark.element.style.display = hidden ? 'none' : 'grid'
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight
  mark.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
}

function lineState(line) {
  if (sim.time < line.jammedUntil) return 'fault'
  if (line.order || line.conveyorCases.length) return 'running'
  return 'idle'
}

// ---------- Selection ----------

let selected = null
let following = null
let flight = null
const cardElement = document.getElementById('card')

function iconRow(state, text) {
  return `<div class="status ${state}">${ICONS[state]}<span>${text}</span></div>`
}

function renderCard() {
  if (!selected) {
    cardElement.hidden = true
    return
  }
  cardElement.hidden = false
  if (selected.kind === 'forklift') {
    const forklift = selected.unit
    const job = forklift.pallet ? `${forklift.pallet.cases} cases on the forks` : 'Forks empty'
    cardElement.innerHTML = `<h2>Forklift ${forklift.id}</h2>${iconRow(forklift.state, forklift.stateLabel)}
      <dl><dt>Load</dt><dd>${job}</dd>
      <dt>Fork height</dt><dd>${(forklift.lift + 0.18).toFixed(1)} m</dd>
      <dt>Speed</dt><dd>${forklift.speed.toFixed(1)} m/s</dd>
      <dt>Pallets moved</dt><dd>${forklift.moves}</dd></dl>`
  } else if (selected.kind === 'line') {
    const line = selected.unit
    const state = lineState(line)
    const order = line.order
    const text = state === 'fault' ? `Conveyor jam, clearing in ${Math.ceil(line.jammedUntil - sim.time)} s` : order ? `Order ${order.id} is ${order.state}` : 'Waiting for the next order'
    const progress = order ? (line.packed / order.cases) * 100 : 0
    cardElement.innerHTML = `<h2>${line.id}</h2>${iconRow(state, text)}
      <dl><dt>Cases on the belt</dt><dd>${line.conveyorCases.length}</dd>
      <dt>Picked for this order</dt><dd>${order ? `${line.picked} of ${order.cases}` : 'None'}</dd>
      <dt>Packed for this order</dt><dd>${order ? `${line.packed} of ${order.cases}` : 'None'}</dd></dl>
      <div class="bar"><i style="width:${progress.toFixed(0)}%"></i></div>`
  } else if (selected.kind === 'dock') {
    const door = selected.unit
    cardElement.innerHTML = `<h2>${door.id}, outbound</h2>${iconRow(door.state === 'loading' ? 'running' : 'waiting', door.state === 'loading' ? 'Trailer at the door, loading' : 'Swapping the trailer')}
      <dl><dt>Pallets in this trailer</dt><dd>${door.loaded} of 10</dd><dt>Trailers sent</dt><dd>${door.trailersSent}</dd></dl>
      <div class="bar"><i style="width:${door.loaded * 10}%"></i></div>`
  } else if (selected.kind === 'inbound') {
    const door = selected.unit
    cardElement.innerHTML = `<h2>${door.id}, inbound</h2>${iconRow('running', `${door.pallets.length} pallets on the conveyor`)}
      <dl><dt>Pallets received</dt><dd>${door.received}</dd></dl>`
  } else if (selected.kind === 'rack') {
    const rowSlots = sim.slots.filter((slot) => slot.row === selected.unit)
    const full = rowSlots.filter((slot) => slot.pallet).length
    cardElement.innerHTML = `<h2>Rack row ${selected.unit + 1}</h2>${iconRow('running', `${full} of ${rowSlots.length} slots hold a pallet`)}
      <div class="bar"><i style="width:${(full / rowSlots.length) * 100}%"></i></div>`
  }
}

function hitTargets() {
  const targets = []
  for (const forklift of sim.forklifts) {
    const reach = 1.8
    const box = new THREE.Box3(new THREE.Vector3(forklift.x - reach, 0, forklift.z - reach), new THREE.Vector3(forklift.x + reach, 3 + forklift.lift, forklift.z + reach))
    targets.push({ box, kind: 'forklift', unit: forklift, priority: 0 })
  }
  for (const line of sim.lines) {
    targets.push({ box: new THREE.Box3(new THREE.Vector3(line.pickX - 1.5, 0, line.z - 1.5), new THREE.Vector3(line.packX + 1.5, 3.4, line.z + 1.5)), kind: 'line', unit: line, priority: 1 })
  }
  for (const door of sim.outbound) {
    targets.push({ box: new THREE.Box3(new THREE.Vector3(door.x - 1.8, 0, -16.5), new THREE.Vector3(door.x + 1.8, 4.5, OUTBOUND_DROP_Z + 1.2)), kind: 'dock', unit: door, priority: 1 })
  }
  for (const door of sim.inbound) {
    targets.push({ box: new THREE.Box3(new THREE.Vector3(-27, 0, door.z - 1.5), new THREE.Vector3(-23.5, 4, door.z + 1.5)), kind: 'inbound', unit: door, priority: 1 })
  }
  sim.slots.slice(0, 0)
  ;[-16, -6.93, 2.14].forEach((rowX, row) => {
    targets.push({ box: new THREE.Box3(new THREE.Vector3(rowX - 1.1, 0, -6), new THREE.Vector3(rowX + 1.1, 6, 6)), kind: 'rack', unit: row, priority: 2 })
  })
  return targets
}

const raycaster = new THREE.Raycaster()
function pick(clientX, clientY) {
  raycaster.setFromCamera(new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1), camera)
  let best = null
  for (const target of hitTargets()) {
    const hit = raycaster.ray.intersectBox(target.box, new THREE.Vector3())
    if (!hit) continue
    const distance = hit.distanceTo(camera.position)
    if (!best || target.priority < best.priority || (target.priority === best.priority && distance < best.distance)) {
      best = { ...target, distance }
    }
  }
  return best
}

function selectTarget(target) {
  selected = target ? { kind: target.kind, unit: target.unit } : null
  following = target?.kind === 'forklift' ? target.unit : null
  if (target) {
    const view = viewFor(target)
    startFlight(view.target, view.position)
  }
  renderCard()
}

function showOverview() {
  selectTarget(null)
  startFlight(OVERVIEW_TARGET, OVERVIEW_POSITION)
}

// Each kind of unit has the view that shows its work: down the aisle for a forklift at a rack, along the belt for a line.
function viewFor(target) {
  if (target.kind === 'forklift') {
    const forklift = target.unit
    const point = new THREE.Vector3(forklift.x, 1.4, forklift.z)
    const inAisle = Math.abs(forklift.z) < 7 && [AISLE_ONE_X, AISLE_TWO_X].some((aisleX) => Math.abs(forklift.x - aisleX) < 3)
    if (inAisle) return { target: point, position: point.clone().add(new THREE.Vector3(1.2, 3.8, 11)) }
    return { target: point, position: point.clone().add(viewDirection().multiplyScalar(18)) }
  }
  if (target.kind === 'line') {
    const center = target.box.getCenter(new THREE.Vector3())
    return { target: center, position: center.clone().add(new THREE.Vector3(-6, 5.5, 9)) }
  }
  if (target.kind === 'dock') {
    const door = target.unit
    return { target: new THREE.Vector3(door.x, 1.4, -14), position: new THREE.Vector3(door.x + 5, 5, -4) }
  }
  const center = target.box.getCenter(new THREE.Vector3())
  const distance = Math.max(20, target.box.getSize(new THREE.Vector3()).length() * 1.5)
  return { target: center, position: center.clone().add(viewDirection().multiplyScalar(distance)) }
}

function viewDirection() {
  return camera.position.clone().sub(controls.target).normalize()
}

function startFlight(targetPoint, position) {
  flight = {
    fromTarget: controls.target.clone(),
    toTarget: targetPoint.clone(),
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    elapsed: 0,
    duration: 1.1,
  }
}

let pointerDown = null
canvas.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY }
  flight = null
})
canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown) return
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
  pointerDown = null
  if (moved > 5) return
  selectTarget(pick(event.clientX, event.clientY))
})
canvas.addEventListener('pointermove', (event) => {
  if (pointerDown) return
  canvas.classList.toggle('hovering', Boolean(pick(event.clientX, event.clientY)))
})
addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    paused = !paused
    renderDock()
  }
  if (event.code === 'Escape') showOverview()
})

// ---------- Dashboard ----------

const SPEEDS = [1, 2, 5, 10]
let simSpeed = 1
let paused = false
const speedsElement = document.getElementById('speeds')
const pauseElement = document.getElementById('pause')
for (const speed of SPEEDS) {
  const button = document.createElement('button')
  button.textContent = `${speed}x`
  button.dataset.speed = speed
  button.addEventListener('click', () => {
    simSpeed = speed
    paused = false
    renderDock()
  })
  speedsElement.appendChild(button)
}
const homeElement = document.getElementById('home')
homeElement.innerHTML = ICONS.overview
homeElement.addEventListener('click', showOverview)
pauseElement.addEventListener('click', () => {
  paused = !paused
  renderDock()
})

function renderDock() {
  pauseElement.innerHTML = paused ? ICONS.running : ICONS.waiting
  for (const button of speedsElement.children) button.classList.toggle('on', Number(button.dataset.speed) === simSpeed && !paused)
}
renderDock()

function renderKpis() {
  const kpis = computeKpis(sim)
  const entries = [
    ['Orders per hour', kpis.ordersPerHour.toFixed(0), ''],
    ['Order to ship', kpis.orderToShipMinutes.toFixed(1), 'min'],
    ['Rack fill', kpis.rackFillPercent.toFixed(0), '%'],
    ['Free forklifts', kpis.freeForklifts, `of ${kpis.forkliftCount}`],
  ]
  document.getElementById('kpis').innerHTML = entries.map(([label, value, unit]) => `<div class="kpi"><label>${label}</label><strong>${value}<small>${unit}</small></strong></div>`).join('')
  const totalMinutes = Math.floor(sim.time / 60) + 8 * 60
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  document.getElementById('clock').textContent = `${hours}:${minutes}`
}

// ---------- Per-frame world update ----------

function writePallets() {
  let palletIndex = 0
  const caseIndexes = world.casePools.map(() => 0)
  const placeCase = (sku, matrix) => {
    const pool = world.casePools[sku]
    pool.setMatrix(caseIndexes[sku]++, matrix)
  }
  for (const pallet of sim.pallets) {
    const heading = pallet.heading ?? 0
    composeMatrix(pallet.x, pallet.y, pallet.z, heading, tempMatrix)
    world.palletPool.setMatrix(palletIndex++, tempMatrix)
    const sine = Math.sin(heading)
    const cosine = Math.cos(heading)
    for (let index = 0; index < pallet.cases; index++) {
      const offset = caseOffset(index)
      const worldX = pallet.x + offset.x * cosine + offset.z * sine
      const worldZ = pallet.z - offset.x * sine + offset.z * cosine
      composeMatrix(worldX, pallet.y + offset.y, worldZ, heading, tempMatrix)
      placeCase(pallet.sku, tempMatrix)
    }
  }
  for (const item of sim.cases) {
    composeMatrix(item.x, item.y, item.z, item.heading, tempMatrix)
    placeCase(item.sku, tempMatrix)
  }
  world.palletPool.setCount(palletIndex)
  world.palletPool.commit()
  world.casePools.forEach((pool, sku) => {
    pool.setCount(caseIndexes[sku])
    pool.commit()
  })
  const stackCount = Math.min(sim.emptyStack.count, 16)
  for (let index = 0; index < stackCount; index++) {
    composeMatrix(EMPTY_STACK.x, STAND_TOP + index * 0.14, EMPTY_STACK.z, Math.PI / 2 + (index % 2) * 0.02, tempMatrix)
    world.emptyStackPool.setMatrix(index, tempMatrix)
  }
  world.emptyStackPool.setCount(stackCount)
  world.emptyStackPool.commit()
}

const tempMatrix = new THREE.Matrix4()

function writeForklifts() {
  sim.forklifts.forEach((forklift, index) => {
    composeMatrix(forklift.x, 0, forklift.z, forklift.heading, tempMatrix)
    world.forkliftParts.chassis.setMatrix(index, tempMatrix)
    composeMatrix(forklift.x, forklift.lift, forklift.z, forklift.heading, tempMatrix)
    world.forkliftParts.cab.setMatrix(index, tempMatrix)
    composeMatrix(forklift.x, Math.max(0, forklift.lift * 0.52), forklift.z, forklift.heading, tempMatrix)
    world.forkliftParts.stage.setMatrix(index, tempMatrix)
  })
  for (const part of Object.values(world.forkliftParts)) {
    part.setCount(sim.forklifts.length)
    part.commit()
  }
}

function writeGantries() {
  sim.lines.forEach((line, lineIndex) => {
    const pairs = [[world.gantries[lineIndex * 2], line.pickGantry], [world.gantries[lineIndex * 2 + 1], line.packGantry]]
    for (const [model, state] of pairs) {
      model.bridge.position.x = state.x - model.group.position.x
      model.carriage.position.z = state.headZ - line.z
      const height = model.legHeight - state.y
      model.mast.scale.y = Math.max(0.05, height + 0.2)
      model.mast.position.y = state.y + (height + 0.2) / 2
      model.head.position.y = state.y
    }
  })
}

function writeTrailers() {
  sim.outbound.forEach((door, index) => {
    world.doors.outbound[index].trailer.position.z = -door.trailerOffset * 24
  })
}

function updateMarks() {
  sim.forklifts.forEach((forklift, index) => {
    const isSelected = selected?.kind === 'forklift' && selected.unit === forklift
    updateMark(forkliftMarks[index], forklift.state, [forklift.x, 3.5 + Math.max(0, forklift.lift), forklift.z], isSelected)
    updatePathLine(pathLines[index], forklift)
  })
  sim.lines.forEach((line, index) => {
    updateMark(lineMarks[index], lineState(line), [(line.conveyorStartX + line.conveyorEndX) / 2, 2.2, line.z], selected?.kind === 'line' && selected.unit === line)
  })
}

// ---------- Main loop ----------

let lastNow = performance.now()
let accumulator = 0
let framesSinceDashboard = 0

function frame(now) {
  requestAnimationFrame(frame)
  const deltaSeconds = Math.min(0.1, (now - lastNow) / 1000)
  lastNow = now
  if (!paused) {
    accumulator += deltaSeconds * simSpeed
    while (accumulator >= STEP_SECONDS) {
      stepSim(sim)
      accumulator -= STEP_SECONDS
    }
  }

  if (flight) {
    flight.elapsed += deltaSeconds
    const progress = Math.min(1, flight.elapsed / flight.duration)
    const eased = progress * progress * (3 - 2 * progress)
    const followShift = following ? new THREE.Vector3(following.x, 1.4, following.z).sub(flight.toTarget) : new THREE.Vector3()
    controls.target.copy(flight.fromTarget).lerp(flight.toTarget.clone().add(followShift), eased)
    camera.position.copy(flight.fromPosition).lerp(flight.toPosition.clone().add(followShift), eased)
    if (progress >= 1) flight = null
  } else if (following) {
    const goal = new THREE.Vector3(following.x, 1.4 + Math.max(0, following.lift) * 0.5, following.z)
    const shift = goal.sub(controls.target).multiplyScalar(1 - Math.exp(-deltaSeconds * 5))
    controls.target.add(shift)
    camera.position.add(shift)
  }
  controls.update(deltaSeconds)

  writePallets()
  writeForklifts()
  writeGantries()
  writeTrailers()
  updateMarks()
  composer.render(deltaSeconds)

  framesSinceDashboard++
  if (framesSinceDashboard >= 6) {
    framesSinceDashboard = 0
    renderKpis()
    renderCard()
  }
}
renderKpis()
requestAnimationFrame(frame)

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  lineMaterial.resolution.set(window.innerWidth, window.innerHeight)
  lineMaterialSelected.resolution.set(window.innerWidth, window.innerHeight)
})

// Hooks for the checks and the film recorder.
window.__app = {
  sim,
  camera,
  controls,
  ready: true,
  setSpeed(speed) {
    simSpeed = speed
    renderDock()
  },
  setView(position, target) {
    camera.position.set(...position)
    controls.target.set(...target)
    controls.update()
  },
  screenOf(worldPoint) {
    const projected = new THREE.Vector3(...worldPoint).project(camera)
    return { x: (projected.x * 0.5 + 0.5) * window.innerWidth, y: (-projected.y * 0.5 + 0.5) * window.innerHeight }
  },
  selected: () => selected,
  ticket: renderCard,
}
