// Interface sounds, synthesized at runtime with the Web Audio API (no files).
// A soft, deep click for every interface action and a slightly heavier low hit when the timeline reveals something
// new: the same family as the film's soft hits in tools/sound.mjs (a low sine with a fast decay and a faint bell).
// Nothing plays before the first user gesture; quiet by default; muting is remembered for the session.

const CLICK_GAIN = 0.22
const REVEAL_GAIN = 0.32

let context = null
let output = null
let muted = false
const listeners = new Set()

function ensureContext() {
  if (context || window.filmMode) return context
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  context = new AudioContextClass()
  output = context.createGain()
  output.gain.value = muted ? 0 : 1
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 2400
  output.connect(lowpass)
  lowpass.connect(context.destination)
  return context
}

// Browsers only allow audio after a gesture: the context is created on the first pointer or key press.
function unlock() {
  const audio = ensureContext()
  if (audio && audio.state === 'suspended') audio.resume()
}
window.addEventListener('pointerdown', unlock, { capture: true })
window.addEventListener('keydown', unlock, { capture: true })

// One decaying sine partial.
function partial(startTime, frequency, gain, decay) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency * 1.08, startTime)
  oscillator.frequency.exponentialRampToValueAtTime(frequency, startTime + 0.03)
  envelope.gain.setValueAtTime(0.0001, startTime)
  envelope.gain.exponentialRampToValueAtTime(gain, startTime + 0.004)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + decay)
  oscillator.connect(envelope)
  envelope.connect(output)
  oscillator.start(startTime)
  oscillator.stop(startTime + decay + 0.05)
}

function ready() {
  return context && context.state === 'running' && !muted
}

export function playClick() {
  if (!ready()) return
  const now = context.currentTime
  partial(now, 92, CLICK_GAIN, 0.16)
  partial(now, 184, CLICK_GAIN * 0.35, 0.08)
  partial(now, 1318, CLICK_GAIN * 0.025, 0.05)
}

export function playReveal(delaySeconds = 0.35) {
  if (!ready()) return
  const start = context.currentTime + delaySeconds
  partial(start, 44, REVEAL_GAIN, 0.9)
  partial(start, 88, REVEAL_GAIN * 0.4, 0.5)
  partial(start, 659, REVEAL_GAIN * 0.06, 0.6)
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  if (output) output.gain.value = muted ? 0 : 1
  listeners.forEach((listener) => listener(muted))
}

export function onMutedChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
