// The documentary page (film.html): 3D scenes, slow camera moves, hard cuts, three dips to black and cinematic type.
// window.film exposes ready, duration, hits, start(at) for the recorder (tools/film.mjs life).
// In a normal browser it plays by itself once the models are loaded; ?at=<seconds> starts later in the film.
import * as THREE from 'three'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { DepthOfField } from '@react-three/postprocessing'
import { ASSETS, Effects } from '../world.jsx'
import { smoothstep } from '../anim.js'
import { clock } from './clock.js'
import { DATE_DELAY, DURATION, HITS, LINE_DELAY, SHOTS, TEXT_FADE, shotIndexAt } from './script.js'
import { SCENES } from './scenes.jsx'
import { MAP_URL, SECTION_LINES_URL } from './MapScene.jsx'

const MODEL_FILES = ['main_street', 'vehicles', 'props', 'farm', 'lights', 'tavern', 'grocery', 'terrain']

window.__footfalls = []
window.film = { ready: false, duration: DURATION, hits: HITS, start: (at = 0) => { clock.startedAt = performance.now() - at * 1000 } }

const isPortrait = () => window.innerHeight > window.innerWidth
const clamp01 = (value) => Math.min(1, Math.max(0, value))
// Camera easings by name; a move picks one with `ease` (default inOut).
const EASES = {
  inOut: (value) => value * value * (3 - 2 * value) * 0.6 + value * 0.4,
  linear: (value) => value,
  slow: (value) => (1 - Math.cos(value * Math.PI)) / 2,
  out: (value) => 1 - (1 - value) ** 3,
  in: (value) => value * value,
}

// A move: { from, to } positions and targets, or { orbit: { center, radius, height: [from, to], angles: [from, to]
// in degrees } }. Optional: ease, delay and duration in seconds (otherwise the whole shot), via: a bezier control
// { position, target } for crane and tilt arcs.
const scratch = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }

function bezier(output, from, via, to, progress) {
  scratch.a.set(...from)
  scratch.c.set(...to)
  if (!via) return output.copy(scratch.a).lerp(scratch.c, progress)
  scratch.b.set(...via)
  const rest = 1 - progress
  return output.copy(scratch.a).multiplyScalar(rest * rest).addScaledVector(scratch.b, 2 * rest * progress).addScaledVector(scratch.c, progress * progress)
}

function placeCamera(camera, lookTarget, move, local, length) {
  const delay = move.delay ?? 0
  const duration = move.duration ?? length - delay
  const progress = EASES[move.ease ?? 'inOut'](clamp01((local - delay) / duration))
  if (move.orbit) {
    const { center, radius, height, angles } = move.orbit
    const angle = THREE.MathUtils.degToRad(angles[0] + (angles[1] - angles[0]) * progress)
    const y = height[0] + (height[1] - height[0]) * progress
    camera.position.set(center[0] + Math.cos(angle) * radius, y, center[2] + Math.sin(angle) * radius)
    lookTarget.set(...center)
  } else {
    bezier(camera.position, move.from.position, move.via?.position, move.to.position, progress)
    bezier(lookTarget, move.from.target, move.via?.target, move.to.target, progress)
  }
  camera.lookAt(lookTarget)
}

// Rack focus: depth of field whose focus point slides from `from` to `to` (world points) between at and at + duration.
function RackFocus({ focus }) {
  const effect = useRef()
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!effect.current?.target) return
    const progress = smoothstep((clock.shotSeconds - focus.at) / focus.duration)
    point.set(...focus.from).lerp(scratch.a.set(...focus.to), progress)
    effect.current.target.copy(point)
  })
  return <DepthOfField ref={effect} target={focus.from} worldFocusRange={focus.range ?? 1.2} bokehScale={focus.bokeh ?? 5} />
}

// Text fades in over TEXT_FADE from `start` and is gone by `end`; script.js sizes each shot so the full hold in
// between meets the reading rule.
export function textLevel(seconds, start, end) {
  return smoothstep((seconds - start) / TEXT_FADE) * (1 - smoothstep((seconds - (end - TEXT_FADE)) / TEXT_FADE))
}

// Sets the clock, moves the camera and drives the overlay opacities once per frame, before the scenes run.
function Director({ onShot, overlay }) {
  const { camera, scene } = useThree()
  window.filmScene = scene
  const lastIndex = useRef(-1)
  const lookTarget = useRef(new THREE.Vector3())
  useFrame(() => {
    const seconds = clock.startedAt === null ? 0 : (performance.now() - clock.startedAt) / 1000
    const filmSeconds = window.filmMode ? Math.min(seconds, DURATION - 0.001) : seconds % DURATION
    const index = shotIndexAt(filmSeconds)
    let shot = SHOTS[index]
    let local = filmSeconds - shot.start
    if (index !== lastIndex.current) {
      // The new scene mounts on the next frame. Until then the old scene is still on screen, so this one frame
      // keeps the old shot's last camera and overlay instead of showing the old scene through the new camera.
      const previous = lastIndex.current
      lastIndex.current = index
      onShot(index)
      if (previous >= 0 && previous === index - 1) {
        shot = SHOTS[previous]
        local = shot.seconds - 0.001
      }
    }
    clock.filmSeconds = filmSeconds
    clock.shotStart = shot.start
    clock.shotSeconds = local
    const move = (isPortrait() && shot.portrait) || shot.camera
    placeCamera(camera, lookTarget.current, move, local, shot.seconds)

    clock.shotLength = shot.seconds
    clock.shotFadeOut = shot.fadeOut ?? 0
    // Hard cuts, except where a shot dips out (fadeOut) and the next one rises from that black (fadeIn).
    const fadeOut = shot.fadeOut ?? 0
    const rising = shot.fadeIn > 0 ? 1 - smoothstep(local / shot.fadeIn) : 0
    const falling = fadeOut > 0 ? smoothstep((local - (shot.seconds - fadeOut)) / fadeOut) : 0
    const elements = overlay.current
    elements.dip.style.opacity = String(Math.max(rising, falling))
    const captionEnd = shot.seconds - fadeOut - 0.05
    elements.date.style.opacity = String(textLevel(local, shot.fadeIn + DATE_DELAY, captionEnd))
    elements.line.style.opacity = String(textLevel(local, shot.fadeIn + LINE_DELAY, captionEnd))
    elements.card.style.opacity = String(shot.card ? textLevel(local, shot.fadeIn + shot.card.at, captionEnd) : 0)
    elements.names.forEach((name, nameIndex) => {
      // The names stay on the black after the map fades, until the very end.
      name.style.opacity = String(textLevel(local, 0.3 + nameIndex * 0.7, shot.seconds - 0.05))
    })
  })
  return null
}

function Lens() {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.fov = size.height > size.width ? 60 : 36
    camera.near = 0.1
    camera.far = 3000
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

// Renders once every model is cached, then marks the film ready.
function Preload() {
  MODEL_FILES.forEach((file) => useGLTF(`${ASSETS}/${file}.glb`, false))
  useLoader(THREE.FileLoader, [MAP_URL, SECTION_LINES_URL])
  useEffect(() => {
    window.film.ready = true
    if (!window.filmMode) {
      const at = Number(new URLSearchParams(location.search).get('at') ?? 0)
      window.film.start(at)
    }
  }, [])
  return null
}

export default function Film() {
  const [shotIndex, setShotIndex] = useState(0)
  const overlay = useRef({ names: [] })
  const shot = SHOTS[shotIndex]
  const Scene = SCENES[shot.scene]
  const portrait = isPortrait()
  return (
    <div className={`film${portrait ? ' portrait' : ''}`}>
      <Canvas
        shadows="soft"
        dpr={Math.min(2, window.devicePixelRatio || 1)}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 5, 20], fov: 36, near: 0.1, far: 3000 }}
      >
        <color attach="background" args={['#000000']} />
        <Director onShot={setShotIndex} overlay={overlay} />
        <Suspense fallback={null}>
          <Preload />
          <Scene key={shotIndex} shot={shot} />
        </Suspense>
        <Effects scale={shot.scene === 'map' ? 'county' : 'film'} extra={shot.focus ? 'focus' : ''}>
          {shot.focus ? <RackFocus focus={shot.focus} /> : null}
        </Effects>
        <Lens />
      </Canvas>
      <div className="film-dip" ref={(element) => { overlay.current.dip = element }} />
      <div className="film-card" ref={(element) => { overlay.current.card = element }}>
        <div className="film-card-name">{shot.card?.name}</div>
        <div className="film-card-detail">{shot.card?.detail}</div>
      </div>
      <div className="film-lower">
        <div className="film-date" ref={(element) => { overlay.current.date = element }}>{shot.date}</div>
        <div className="film-line" ref={(element) => { overlay.current.line = element }}>{shot.line}</div>
      </div>
      <div className="film-names">
        {[0, 1].map((index) => (
          <div key={index} className="film-name" ref={(element) => { overlay.current.names[index] = element }}>{shot.names?.[index]}</div>
        ))}
      </div>
    </div>
  )
}
