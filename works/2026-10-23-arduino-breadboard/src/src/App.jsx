// Hookup: a lesson list, a full-bleed 3D bench, one step card with the sketch, one control, one instrument.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Stage, { THEMES } from './Stage.jsx'
import Instrument from './Instrument.jsx'
import { DEFAULT_CONTROLS, LESSONS } from './lessons.js'
import { labelNodes, live, useLabelEntries, useReadouts } from './live.js'
import { BB, colX, PITCH, place } from './layout.js'
import SandboxPanel from './SandboxPanel.jsx'
import { IconArrowLeft, IconArrowRight, IconCheck, IconChip, IconClock, IconCurrent, IconEye, IconHand, IconKnob, IconLabels, IconNext, IconReset, IconServo, IconTheme, IconWalk, IconWave } from './Icons.jsx'
import * as THREE from 'three'

const THEME_ORDER = ['daylight', 'night', 'solder']
const CONTROL_ICONS = { clock: IconClock, wave: IconWave, knob: IconKnob, servo: IconServo }
const KEYWORDS = /\b(void|int|const|unsigned|long|for|if|Servo|include)\b/g
const CONSTANTS = /\b(HIGH|LOW|OUTPUT|INPUT|A0)\b/g

function highlightCode(text) {
  const commentAt = text.indexOf('//')
  const code = commentAt >= 0 ? text.slice(0, commentAt) : text
  const comment = commentAt >= 0 ? text.slice(commentAt) : ''
  const parts = []
  let rest = code
  const pattern = /(\b(?:void|int|const|unsigned|long|for|if|Servo)\b)|(\b(?:HIGH|LOW|OUTPUT|INPUT|A0)\b)|(\b\d+\b)|(#include <\w+\.h>)|(\b\w+(?=\())/g
  let last = 0
  let match
  while ((match = pattern.exec(rest)) !== null) {
    if (match.index > last) parts.push(rest.slice(last, match.index))
    const kind = match[1] ? 'kw' : match[2] ? 'const' : match[3] ? 'num' : match[4] ? 'kw' : 'fn'
    parts.push(<span key={match.index} className={`tok-${kind}`}>{match[0]}</span>)
    last = match.index + match[0].length
  }
  if (last < rest.length) parts.push(rest.slice(last))
  if (comment) parts.push(<span key="c" className="tok-comment">{comment}</span>)
  return parts
}
void KEYWORDS
void CONSTANTS

function CodePanel({ lines, active }) {
  return (
    <div className="code" role="img" aria-label="Arduino sketch">
      {lines.map((text, index) => (
        <div key={index} className={`code-line${index === active ? ' now' : ''}`}>
          <span className="code-no">{index === active ? '▶' : index + 1}</span>
          <span className="code-text">{highlightCode(text) || ' '}</span>
        </div>
      ))}
    </div>
  )
}

function LabelLayer() {
  const entries = useLabelEntries()
  return (
    <div className="label-layer">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="pin"
          ref={(node) => {
            if (node) {
              node.__entry = entry
              labelNodes.set(entry.key, node)
            } else labelNodes.delete(entry.key)
          }}
        >
          <i />{entry.text}
        </div>
      ))}
    </div>
  )
}

function SliderControl({ spec, value, displayValue, onChange, onGrab, auto }) {
  const Icon = CONTROL_ICONS[spec.icon] ?? IconWave
  const shown = displayValue ?? value
  const fraction = (shown - spec.min) / (spec.max - spec.min)
  return (
    <div className="slider-control">
      <div className="slider-head">
        <Icon />
        <span>{spec.label}</span>
        {auto && <span className="auto-tag"><IconCurrent /> auto</span>}
        <span className="slider-value">{shown}{spec.unit}</span>
      </div>
      <input
        className="big-range"
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={shown}
        style={{ '--fill': `${fraction * 100}%` }}
        onPointerDown={() => onGrab(shown)}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={spec.label}
      />
    </div>
  )
}

function PressControl({ spec, controls, setControl, stepIndex, lessonId, pressed }) {
  const press = (down) => () => { live.pressed = down }
  return (
    <div className="press-control">
      <button
        className={`press-button${pressed ? ' down' : ''}`}
        onPointerDown={press(true)}
        onPointerUp={press(false)}
        onPointerLeave={press(false)}
        aria-pressed={pressed}
      >
        {lessonId === 'traffic' ? <IconWalk /> : <IconHand />}
        {spec.label}
      </button>
      {spec.toggleLabel && stepIndex >= 3 && (
        <button className={`switch${controls.debounce ? ' on' : ''}`} onClick={() => setControl('debounce', !controls.debounce)} role="switch" aria-checked={controls.debounce}>
          <span className="switch-track"><span className="switch-knob" /></span>
          {spec.toggleLabel}
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [labels, setLabels] = useState(true)
  const [current, setCurrent] = useState(false)
  const [themeId, setThemeId] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('hookup-theme') : null
    return saved && THEMES[saved] ? saved : 'daylight'
  })
  const [controls, setControls] = useState(DEFAULT_CONTROLS)
  const [finished, setFinished] = useState(() => new Set())
  const [resetCount, setResetCount] = useState(0)
  const [direction, setDirection] = useState(1)
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const readouts = useReadouts()

  const lesson = LESSONS[lessonIndex]
  const step = lesson.steps[stepIndex]
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(themeId) + 1) % THEME_ORDER.length]
  const r = readouts.lessonIndex === lessonIndex ? readouts : {}

  useEffect(() => {
    document.documentElement.dataset.theme = themeId
    try { localStorage.setItem('hookup-theme', themeId) } catch (error) { void error }
  }, [themeId])

  const setControl = useCallback((key, value) => setControls((current) => ({ ...current, [key]: value })), [])
  const sandboxMode = Boolean(LESSONS[lessonIndex].sandbox)
  useEffect(() => {
    live.callbacks.setPot = sandboxMode ? (angle) => { live.potAngle = angle } : (angle) => setControl('pot', angle)
  }, [setControl, sandboxMode])

  const goTo = useCallback((nextLesson, nextStep) => {
    const target = LESSONS[nextLesson].steps[nextStep]
    setDirection(nextLesson * 10 + nextStep >= lessonIndex * 10 + stepIndex ? 1 : -1)
    if (nextLesson !== lessonIndex && stepIndex > 0) setFinished((current) => new Set(current).add(lessonIndex))
    setLessonIndex(nextLesson)
    setStepIndex(nextStep)
    live.pressed = false
    setControls((current) => ({ ...current, auto: Boolean(target.set?.auto) }))
    if (nextStep === LESSONS[nextLesson].steps.length - 1) setFinished((current) => new Set(current).add(nextLesson))
  }, [lessonIndex, stepIndex])

  const isLastStep = stepIndex === lesson.steps.length - 1
  const isLastEver = isLastStep && lessonIndex === LESSONS.length - 1
  const goNext = () => {
    if (!isLastStep) goTo(lessonIndex, stepIndex + 1)
    else if (!isLastEver) goTo(lessonIndex + 1, 0)
    else goTo(0, 0)
  }
  const goBack = () => {
    if (stepIndex > 0) goTo(lessonIndex, stepIndex - 1)
    else if (lessonIndex > 0) goTo(lessonIndex - 1, LESSONS[lessonIndex - 1].steps.length - 1)
  }

  // Screen position of a point in the scene, for the recorded film's real mouse input.
  const screenOf = useCallback((point) => {
    const { camera } = window.__camera
    const vector = new THREE.Vector3(...point).project(camera)
    return { x: ((vector.x + 1) / 2) * window.innerWidth, y: ((1 - vector.y) / 2) * window.innerHeight }
  }, [])
  useEffect(() => {
    window.__app = {
      go: goTo,
      setControl,
      setTheme: setThemeId,
      setCurrent,
      at: (ref) => screenOf(place(ref)),
      screenOf,
      get state() {
        return { lessonIndex, stepIndex, controls: controlsRef.current, themeId }
      },
      targets: {
        button: (cols) => [(colX(cols[0]) + colX(cols[1])) / 2, BB.h + 0.85, 0],
        potKnob: (col) => [colX(col), BB.h + 1.82, -0.12],
      },
    }
  })

  const lines = useMemo(() => lesson.code(controls, r, stepIndex), [lesson, controls, r, stepIndex])
  const auto = controls.auto && Boolean(step.set?.auto)
  const sliderValue = lesson.control.type === 'slider' ? controls[lesson.control.key] : 0
  const liveValue = auto ? (lesson.id === 'fade' ? r.value : lesson.id === 'servo' ? r.angle : undefined) : undefined

  return (
    <div className="app">
      <div className="bench">
        <Stage lessonIndex={lessonIndex} stepIndex={stepIndex} themeId={themeId} labels={labels} current={current} resetCount={resetCount} controlsRef={controlsRef} />
        <LabelLayer />
      </div>

      <nav className="lessons-panel" aria-label="Lessons">
        <div className="brand">
          <IconChip />
          <div>
            <div className="brand-name">Hookup</div>
            <div className="brand-line">Arduino, one circuit at a time</div>
          </div>
        </div>
        <ol className="lessons">
          {LESSONS.map((entry, index) => {
            const state = index === lessonIndex ? 'current' : finished.has(index) ? 'done' : 'upcoming'
            const StateIcon = state === 'current' ? IconCurrent : state === 'done' ? IconCheck : IconNext
            return (
              <li key={entry.id}>
                <button className={`lesson ${state}`} onClick={() => goTo(index, 0)} aria-current={state === 'current'}>
                  <StateIcon />
                  <span className="lesson-text">
                    <span className="lesson-title">{index + 1}. {entry.title}</span>
                    <span className="lesson-short">{entry.short}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="progress">{finished.size} of {LESSONS.length} lessons done</div>
      </nav>

      <div className="toolbar">
        <button className={`quiet${labels ? ' on' : ''}`} onClick={() => setLabels(!labels)} aria-pressed={labels}><IconLabels /> Labels</button>
        <button className="quiet" onClick={() => setResetCount(resetCount + 1)}><IconReset /> Reset view</button>
        <button className="quiet theme-button" onClick={() => setThemeId(nextTheme)} aria-label={`Theme: ${THEMES[themeId].label}. Switch.`}><IconTheme /> {THEMES[themeId].label}</button>
      </div>

      {sandboxMode ? null : <div className="control">
        {lesson.control.type === 'slider' ? (
          <SliderControl
            spec={lesson.control}
            value={sliderValue}
            displayValue={liveValue}
            auto={auto}
            onGrab={(shown) => setControls((current) => ({ ...current, auto: false, [lesson.control.key]: shown }))}
            onChange={(value) => setControl(lesson.control.key, value)}
          />
        ) : (
          <PressControl spec={lesson.control} controls={controls} setControl={setControl} stepIndex={stepIndex} lessonId={lesson.id} pressed={Boolean(r.pressed)} />
        )}
      </div>}

      {sandboxMode ? <SandboxPanel CodePanel={CodePanel} current={current} onToggleCurrent={() => setCurrent(!current)} /> : <aside className="card">
        <div className="card-body" key={`${lessonIndex}-${stepIndex}`} data-direction={direction}>
          <h1>{step.title}</h1>
          <p>{step.body}</p>
          <div className="watch"><IconEye /><span>{step.watch}</span></div>
          <button className={`switch current-switch${current ? ' on' : ''}`} onClick={() => setCurrent(!current)} role="switch" aria-checked={current}>
            <span className="switch-track"><span className="switch-knob" /></span>
            Show current
          </button>
          <CodePanel lines={lines} active={r.line} />
          <Instrument lesson={lesson} step={stepIndex} readouts={r} controls={controls} />
        </div>
        <div className="card-foot">
          <div className="dots" role="tablist" aria-label="Steps">
            {lesson.steps.map((entry, index) => (
              <button key={entry.title} className={`dot${index === stepIndex ? ' on' : index < stepIndex ? ' past' : ''}`} onClick={() => goTo(lessonIndex, index)} aria-label={`Step ${index + 1}`} aria-selected={index === stepIndex} />
            ))}
            <span className="step-count">Step {stepIndex + 1} of {lesson.steps.length}</span>
          </div>
          <div className="nav">
            <button className="back" onClick={goBack} disabled={lessonIndex === 0 && stepIndex === 0}><IconArrowLeft /> Back</button>
            <button className="next" onClick={goNext}>{isLastEver ? 'Start again' : isLastStep ? 'Next lesson' : 'Next step'} <IconArrowRight /></button>
          </div>
        </div>
      </aside>}
    </div>
  )
}
void PITCH
