// The canvas: lights, desk mat, camera moves between steps, the lesson's parts and the simulation tick.
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { LESSONS } from './lessons.js'
import { labelNodes, live, publish, SceneContext, setLabelEntries } from './live.js'
import { BB, holePos, place, PITCH } from './layout.js'
import { Breadboard, Flow, HoleMarks, Led, Potentiometer, PushButton, Resistor, Servo, Tray, TRAY, traySpot, UnoBoard, Wire, wireCurve } from './parts.jsx'
import SandboxScene from './SandboxScene.jsx'
import { ledLabelText, useSandbox } from './sandbox.js'
import { makeMatTexture } from './textures.js'

export const THEMES = {
  daylight: { id: 'daylight', label: 'Daylight', background: '#dbe5ec', mat: '#c9d6df', matLine: '#b9c8d3', matMajor: '#a9bbc8', key: 3.1, ambient: 0.7, env: 0.9, accentColor: '#4f46e5', bloom: 0.35 },
  night: { id: 'night', label: 'Night bench', background: '#0b0f13', mat: '#1c242c', matLine: '#26313b', matMajor: '#34424f', key: 2.4, ambient: 0.28, env: 0.5, accentColor: '#c6ff3d', bloom: 0.9 },
  solder: { id: 'solder', label: 'Solder green', background: '#083128', mat: '#0f5444', matLine: '#17695a', matMajor: '#238273', key: 2.7, ambient: 0.4, env: 0.65, accentColor: '#ffbe3b', bloom: 0.75 },
}

const LEFT_PANEL = 280
const RIGHT_PANEL = 512

const cameraPose = (goal) => {
  const azimuth = THREE.MathUtils.degToRad(goal.az)
  const elevation = THREE.MathUtils.degToRad(goal.el)
  const target = new THREE.Vector3(...goal.t)
  const position = target.clone().add(new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(goal.d))
  return { position, target }
}

function CameraRig({ goal, resetCount, lessonIndex }) {
  const { camera, scene, size } = useThree()
  const controls = useRef()
  const flight = useRef({ progress: 1 })
  const interacting = useRef(false)
  const shown = useRef(lessonIndex)
  const offset = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const { position: toPosition, target: toTarget } = cameraPose(goal)
    let fromPosition = camera.position.clone()
    let fromTarget = orbit.target.clone()
    if (shown.current !== lessonIndex) {
      shown.current = lessonIndex
    }
    flight.current = { progress: 0, fromPosition, fromTarget, toPosition, toTarget }
  }, [goal, resetCount, camera, lessonIndex])

  useEffect(() => {
    window.__camera = { camera, controls, scene }
  }, [camera, scene])

  useFrame((state, delta) => {
    const orbit = controls.current
    if (!orbit) return
    const dt = Math.min(delta, 0.1)
    orbit.enabled = !live.hover
    const shift = size.width >= 1100 ? (RIGHT_PANEL - LEFT_PANEL) / 2 : 0
    camera.setViewOffset(size.width, size.height, shift, 0, size.width, size.height)
    const move = flight.current
    if (move.progress < 1) {
      move.progress = Math.min(1, move.progress + dt / 1.1)
      const eased = move.progress < 0.5 ? 4 * move.progress ** 3 : 1 - (-2 * move.progress + 2) ** 3 / 2
      camera.position.lerpVectors(move.fromPosition, move.toPosition, eased)
      orbit.target.lerpVectors(move.fromTarget, move.toTarget, eased)
      orbit.update()
    } else if (!interacting.current && !live.hover) {
      offset.copy(camera.position).sub(orbit.target)
      offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.035 * dt)
      camera.position.copy(orbit.target).add(offset)
      orbit.update()
    }
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={40}
      maxPolarAngle={Math.PI * 0.47}
      onStart={() => { interacting.current = true }}
      onEnd={() => { interacting.current = false }}
    />
  )
}

function Lights({ theme }) {
  return (
    <>
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight args={['#ffffff', theme.mat, 0.45]} />
      <directionalLight
        castShadow
        position={[7, 20, 14]}
        intensity={theme.key}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <Environment resolution={128} environmentIntensity={theme.env}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 5]} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[-6, 3, -2]} scale={[6, 4, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="ring" intensity={0.8} position={[4, 3, -5]} scale={4} />
      </Environment>
    </>
  )
}

function DeskMat({ theme }) {
  const texture = useMemo(() => {
    const result = makeMatTexture(theme.mat, theme.matLine, theme.matMajor)
    result.repeat.set(48 / 16, 40 / 16)
    return result
  }, [theme])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color={theme.background} roughness={1} />
      </mesh>
      <mesh position={[0.6, -0.12, 3.6]} receiveShadow>
        <boxGeometry args={[48.4, 0.24, 40.4]} />
        <meshStandardMaterial color={theme.matMajor} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.6, 0.002, 3.6]} receiveShadow>
        <planeGeometry args={[48, 40]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  )
}

function holesOf(spec) {
  const list = []
  if (spec.type === 'resistor') list.push(spec.a, spec.b)
  if (spec.type === 'led') list.push(spec.anode, spec.cathode)
  if (spec.type === 'button') spec.cols.forEach((col) => ['e', 'f'].forEach((row) => list.push([col, row])))
  if (spec.type === 'pot') [-2, 0, 2].forEach((offset) => list.push([spec.col + offset, 'e']))
  if (spec.type === 'servo') spec.plugCols.forEach((col) => list.push([col, spec.row]))
  if (spec.from && spec.to) list.push(spec.from, spec.to)
  return list.map((ref) => place(ref))
}

// The polyline a flow's dots follow, and the fraction of it where the LED sits (red before, blue after).
function buildFlowPath(flow, curves) {
  const points = []
  let ledIndex = -1
  flow.items.forEach((item) => {
    if (item.wire) {
      const samples = curves[item.wire].getPoints(70)
      if (item.rev) samples.reverse()
      points.push(...samples)
    } else {
      if (item.at && Math.abs(item.at[1] - (BB.h + 0.75)) < 0.01) ledIndex = points.length
      points.push(new THREE.Vector3(...place(item, 0)))
    }
  })
  let along = 0
  let ledAlong = -1
  points.forEach((point, index) => {
    if (index > 0) along += point.distanceTo(points[index - 1])
    if (index === ledIndex) ledAlong = along
  })
  return { points, split: ledIndex >= 0 ? ledAlong / along : 2, ledPoint: ledIndex >= 0 ? points[ledIndex] : null }
}

// Milliamps through a flow, from the resistor it passes (LED branch) or the pull-down (button branch).
function flowCurrent(flow, lesson) {
  const resistor = lesson.parts.find((part) => part.type === 'resistor' && flow.needs.includes(part.id))
  const hasLed = flow.needs.some((id) => lesson.parts.find((part) => part.id === id)?.type === 'led')
  if (!hasLed) return { ma: 0.5, label: null }
  if (!resistor) return { ma: 14, label: null }
  const ma = ((5 - 2) / resistor.ohms) * 1000
  return { ma, ohms: resistor.ohms, label: ledLabelText(ma, resistor.ohms) }
}

function Callouts({ step }) {
  const { labels } = useContext(SceneContext)
  useEffect(() => {
    const entries = labels ? (step.labels ?? []).map((entry, index) => ({ key: `${entry.text}-${index}`, text: entry.text, position: place(entry.ref, entry.lift ?? 0.6), dx: entry.dx ?? 0, dy: entry.dy ?? 0 })) : []
    setLabelEntries(entries)
    return () => setLabelEntries([])
  }, [labels, step])
  return null
}

const projected = new THREE.Vector3()
export function LabelProjector() {
  const { camera, size } = useThree()
  useFrame(() => {
    labelNodes.forEach((node, key) => {
      const entry = node.__entry
      if (!entry) return
      projected.set(...entry.position).project(camera)
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      node.style.transform = `translate(${x + entry.dx}px, ${y + entry.dy}px) translate(-50%, -100%)`
      node.style.opacity = projected.z < 1 ? 1 : 0
    })
  })
  return null
}

// Where a part waits on the bench tray before it is picked up, as an offset from its final spot.
function restOf(spec, index) {
  let centre
  if (spec.type === 'resistor') centre = [(holePos(spec.a[0], spec.a[1])[0] + holePos(spec.b[0], spec.b[1])[0]) / 2, holePos(spec.a[0], spec.a[1])[2]]
  else if (spec.type === 'led') centre = [(holePos(spec.anode[0], spec.anode[1])[0] + holePos(spec.cathode[0], spec.cathode[1])[0]) / 2, holePos(spec.anode[0], spec.anode[1])[2]]
  else if (spec.type === 'button') centre = [(holePos(spec.cols[0], 'e')[0] + holePos(spec.cols[1], 'e')[0]) / 2, 0]
  else if (spec.type === 'pot') centre = [holePos(spec.col, 'e')[0], holePos(spec.col, 'e')[2] - 0.5]
  else return undefined
  const spot = traySpot(index)
  return [spot[0] - centre[0], TRAY.top - BB.h, spot[2] - centre[1]]
}

function LessonScene({ lessonIndex, stepIndex }) {
  const lesson = LESSONS[lessonIndex]
  const step = lesson.steps[stepIndex]
  const startStep = useRef(stepIndex).current
  const curves = useMemo(() => Object.fromEntries(lesson.wires.map((wire) => [wire.id, wireCurve(wire)])), [lesson])
  const flowPaths = useMemo(() => lesson.flows.map((flow) => buildFlowPath(flow, curves)), [lesson, curves])
  const flowCurrents = useMemo(() => lesson.flows.map((flow) => flowCurrent(flow, lesson)), [lesson])
  const { current } = useContext(SceneContext)
  useEffect(() => {
    const found = lesson.flows.flatMap((flow, index) => (flowCurrents[index].label && flowPaths[index].ledPoint ? [index] : []))
    let entries = []
    if (current && found.length === 1) {
      const spot = flowPaths[found[0]].ledPoint
      entries = [{ key: 'ma-0', text: flowCurrents[found[0]].label, position: [spot.x, spot.y + 0.5, spot.z], dx: 0, dy: -10 }]
    } else if (current && found.length > 1) {
      // Several LEDs share one label, lifted clear of them.
      const spots = found.map((index) => flowPaths[index].ledPoint)
      const centre = spots.reduce((sum, spot) => [sum[0] + spot.x / spots.length, sum[1] + spot.y / spots.length, sum[2] + spot.z / spots.length], [0, 0, 0])
      const first = flowCurrents[found[0]]
      entries = [{ key: 'ma-all', text: `${found.length} LEDs, each ~ ${Math.round(first.ma)} mA at ${first.ohms} \u03a9`, position: [centre[0], centre[1] + 0.5, centre[2]], dx: 0, dy: -64 }]
    }
    setLabelEntries(entries, 'current')
    return () => setLabelEntries([], 'current')
  }, [current, lesson, flowPaths, flowCurrents])
  const visible = new Set([...lesson.parts, ...lesson.wires].filter((spec) => spec.step <= stepIndex).map((spec) => spec.id))
  const ordinal = {}
  const delayOf = (spec) => {
    if (spec.step !== stepIndex) return 0
    ordinal[stepIndex] = (ordinal[stepIndex] ?? -1) + 1
    return 0.1 + ordinal[stepIndex] * 0.22
  }
  const newSpecs = [...lesson.parts, ...lesson.wires].filter((spec) => spec.step === stepIndex)
  const markHoles = newSpecs.flatMap(holesOf)
  const markKey = `${lessonIndex}-${stepIndex}`
  const readyFor = (needs) => needs.every((id) => visible.has(id))

  return (
    <>
      <Tray />
      {lesson.parts.map((spec) => {
        const show = visible.has(spec.id)
        const delay = delayOf(spec)
        const rest = restOf(spec, lesson.parts.indexOf(spec) - 1)
        const placed = spec.step < startStep || (spec.type === 'breadboard' && lessonIndex > 0)
        switch (spec.type) {
          case 'breadboard': return <Breadboard key={spec.id} show={show} delay={delay} placed={placed} />
          case 'resistor': return <Resistor key={spec.id} spec={spec} show={show} delay={delay} rest={rest} placed={placed} />
          case 'led': return <Led key={spec.id} spec={spec} show={show} delay={delay} ready={readyFor(spec.needs)} rest={rest} placed={placed} />
          case 'button': return <PushButton key={spec.id} spec={spec} show={show} delay={delay} rest={rest} placed={placed} />
          case 'pot': return <Potentiometer key={spec.id} spec={spec} show={show} delay={delay} rest={rest} placed={placed} />
          case 'servo': return <Servo key={spec.id} spec={spec} show={show} delay={delay} />
          default: return null
        }
      })}
      {lesson.wires.map((spec, index) => <Wire key={spec.id} spec={spec} slot={lesson.wires.length - 1 - index} show={visible.has(spec.id)} delay={delayOf(spec)} instant={spec.step < startStep} />)}
      {lesson.flows.map((flow, index) => <Flow key={index} path={flowPaths[index].points} drive={flow.drive} ready={readyFor(flow.needs)} ma={flowCurrents[index].ma} split={flowPaths[index].split} />)}
      <HoleMarks key={markKey} holes={markHoles} show delay={1.5} />
      <Callouts step={step} />
    </>
  )
}

function Simulation({ lessonIndex, stepIndex, controlsRef }) {
  const memory = useRef({})
  const clock = useRef(0)
  const lastPublish = useRef(-1)
  const stepRef = useRef(stepIndex)
  stepRef.current = stepIndex
  useEffect(() => {
    memory.current = {}
    clock.current = 0
    live.drive = {}
    lastPublish.current = -1
  }, [lessonIndex])
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    clock.current += dt
    const lesson = LESSONS[lessonIndex]
    const out = lesson.sim(clock.current, dt, controlsRef.current, memory.current, stepRef.current)
    live.lastOut = out
    if (state.clock.elapsedTime - lastPublish.current > 0.05) {
      lastPublish.current = state.clock.elapsedTime
      publish({ ...out, lessonIndex, simStep: stepRef.current })
    }
  })
  return null
}

export default function Stage({ lessonIndex, stepIndex, themeId, labels, current, resetCount, controlsRef }) {
  const sandboxState = useSandbox()
  const lesson = LESSONS[lessonIndex]
  const theme = THEMES[themeId]
  const goal = lesson.steps[stepIndex].cam
  const context = useMemo(() => ({ theme, labels, current, sandbox: Boolean(lesson.sandbox), curves: {} }), [theme, labels, current, lesson])
  const wireSpecs = lesson.sandbox ? sandboxState.wires : lesson.wires
  const curves = useMemo(() => Object.fromEntries(wireSpecs.map((wire) => [wire.id, wireCurve(wire)])), [wireSpecs])
  const fullContext = useMemo(() => ({ ...context, curves }), [context, curves])
  const initial = cameraPose(goal)
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 30, near: 0.5, far: 300, position: initial.position.toArray() }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, 60, 140]} />
      <SceneContext.Provider value={fullContext}>
        <Lights theme={theme} />
        <DeskMat theme={theme} />
        <UnoBoard />
        {lesson.sandbox ? <SandboxScene key="sandbox" /> : <LessonScene key={lessonIndex} lessonIndex={lessonIndex} stepIndex={stepIndex} />}
        {lesson.sandbox ? null : <Simulation lessonIndex={lessonIndex} stepIndex={stepIndex} controlsRef={controlsRef} />}
        <LabelProjector />
        <CameraRig goal={goal} resetCount={resetCount} lessonIndex={lessonIndex} />
      </SceneContext.Provider>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO aoRadius={0.9} distanceFalloff={0.8} intensity={2.2} quality="medium" halfRes />
        <Bloom intensity={theme.bloom} luminanceThreshold={1.0} luminanceSmoothing={0.25} mipmapBlur radius={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
