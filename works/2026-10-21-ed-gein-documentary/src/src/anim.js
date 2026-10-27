// Small animation helpers on requestAnimationFrame and performance.now, so the film's virtual clock
// drives every fade and delay. CSS transitions and setTimeout run on wall time and would not.

export function later(milliseconds, callback) {
  const start = performance.now()
  const tick = () => {
    if (performance.now() - start >= milliseconds) callback()
    else requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function tween(milliseconds, onUpdate, onDone) {
  const start = performance.now()
  const tick = () => {
    const progress = Math.min(1, (performance.now() - start) / milliseconds)
    onUpdate(progress)
    if (progress < 1) requestAnimationFrame(tick)
    else onDone?.()
  }
  requestAnimationFrame(tick)
}

export const smoothstep = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export const easeInOut = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}
