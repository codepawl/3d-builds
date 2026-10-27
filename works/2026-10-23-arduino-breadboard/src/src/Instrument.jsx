// The small instrument card: a scope or gauge that shows what the pin is doing, drawn on a 2D canvas.
import { useEffect, useRef } from 'react'
import { IconHigh, IconLow, IconWalk, IconStop, IconBolt } from './Icons.jsx'

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function drawGrid(g, width, height) {
  g.strokeStyle = css('--grid')
  g.lineWidth = 1
  for (let x = 0; x <= width; x += width / 10) {
    g.beginPath()
    g.moveTo(Math.round(x) + 0.5, 0)
    g.lineTo(Math.round(x) + 0.5, height)
    g.stroke()
  }
}

function trace(g, samples, width, top, bottom, colour) {
  g.strokeStyle = colour
  g.lineWidth = 3
  g.lineJoin = 'round'
  g.beginPath()
  samples.forEach((value, index) => {
    const x = width - ((samples.length - 1 - index) / 399) * width
    const y = value ? top : bottom
    if (index === 0) g.moveTo(x, y)
    else {
      const previous = samples[index - 1] ? top : bottom
      if (previous !== y) g.lineTo(x, previous)
      g.lineTo(x, y)
    }
  })
  g.stroke()
}

function draw(canvas, lessonId, r, c, step) {
  const g = canvas.getContext('2d')
  const { width, height } = canvas
  g.clearRect(0, 0, width, height)
  const accent = css('--accent')
  const ink = css('--ink')
  const muted = css('--muted')
  g.font = '600 14px "Bahnschrift", "Segoe UI", sans-serif'
  g.textBaseline = 'middle'
  drawGrid(g, width, height)

  const wave = (periods, duty, phaseFraction, label) => {
    const top = 26
    const bottom = height - 28
    g.strokeStyle = accent
    g.lineWidth = 3.5
    g.lineJoin = 'round'
    g.beginPath()
    const periodWidth = width / periods
    for (let index = 0; index < periods; index += 1) {
      const x0 = index * periodWidth
      const x1 = x0 + periodWidth * duty
      if (index === 0) g.moveTo(x0, duty > 0 ? top : bottom)
      else g.lineTo(x0, duty > 0 ? top : bottom)
      if (duty > 0) g.lineTo(x0, top)
      if (duty > 0 && duty < 1) {
        g.lineTo(x1, top)
        g.lineTo(x1, bottom)
        g.lineTo(x0 + periodWidth, bottom)
      } else g.lineTo(x0 + periodWidth, duty > 0 ? top : bottom)
    }
    g.stroke()
    if (phaseFraction !== undefined) {
      g.strokeStyle = ink
      g.globalAlpha = 0.5
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(phaseFraction * width, 6)
      g.lineTo(phaseFraction * width, height - 6)
      g.stroke()
      g.globalAlpha = 1
    }
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText('5 V', 6, top - 12 + 2)
    g.fillText('0 V', 6, bottom + 16)
    if (label) {
      g.fillStyle = ink
      g.textAlign = 'right'
      g.fillText(label, width - 8, height - 10)
    }
  }

  if (lessonId === 'blink') {
    const half = r.half ?? 0.5
    const windowSeconds = 4
    const top = 26
    const bottom = height - 28
    g.strokeStyle = accent
    g.lineWidth = 3.5
    g.lineJoin = 'round'
    g.beginPath()
    let previousHigh = null
    for (let x = 0; x <= width; x += 2) {
      const time = (x / width) * windowSeconds
      const high = time % (2 * half) < half
      const y = high ? top : bottom
      if (previousHigh === null) g.moveTo(x, y)
      else {
        if (high !== previousHigh) g.lineTo(x, previousHigh ? top : bottom)
        g.lineTo(x, y)
      }
      previousHigh = high
    }
    g.stroke()
    const cursor = (((r.t ?? 0) % windowSeconds) / windowSeconds) * width
    g.strokeStyle = ink
    g.globalAlpha = 0.55
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cursor, 6)
    g.lineTo(cursor, height - 6)
    g.stroke()
    g.globalAlpha = 1
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText('5 V', 6, top - 10)
    g.fillText('0 V', 6, bottom + 16)
    g.fillStyle = ink
    g.textAlign = 'right'
    g.fillText(`4 s across · ${Math.round(half * 2000)} ms per blink`, width - 8, height - 10)
  } else if (lessonId === 'button') {
    const rawTop = 30
    const rawBottom = 74
    const debTop = 112
    const debBottom = 156
    trace(g, r.raw ?? [], width, rawTop, rawBottom, accent)
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText('raw pin 2', 8, 14)
    if (c.debounce && step >= 3) {
      trace(g, r.deb ?? [], width, debTop, debBottom, css('--good'))
      g.fillStyle = muted
      g.fillText('after 20 ms debounce', 8, 98)
    }
    g.textAlign = 'right'
    g.fillStyle = ink
    g.fillText('40 ms across, slowed 50x', width - 8, height - 10)
  } else if (lessonId === 'fade') {
    wave(3, (r.duty ?? 0.5) >= 1 ? 1 : r.duty ?? 0.5, undefined, `${Math.round((r.duty ?? 0) * 100)} % duty · 490 Hz`)
  } else if (lessonId === 'pot') {
    const fraction = (r.reading ?? 0) / 1023
    const trackY = height / 2 - 6
    g.fillStyle = css('--soft-2')
    g.beginPath()
    g.roundRect(12, trackY - 14, width - 24, 28, 14)
    g.fill()
    g.fillStyle = accent
    g.beginPath()
    g.roundRect(12, trackY - 14, Math.max(28, (width - 24) * fraction), 28, 14)
    g.fill()
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText('0 V', 12, trackY + 36)
    g.textAlign = 'right'
    g.fillText('5 V', width - 12, trackY + 36)
    g.textAlign = 'center'
    g.fillStyle = ink
    g.fillText(`A0 = ${(r.volts ?? 0).toFixed(2)} V`, width / 2, trackY + 36)
  } else if (lessonId === 'servo') {
    const frame = 2.5 // zoomed on the first 2.5 ms of the 20 ms frame so the 1 to 2 ms pulse is wide enough to read
    const pulse = r.pulse ?? 1.5
    const left = 14
    const usable = width - 28
    const top = 38
    const bottom = height - 44
    g.strokeStyle = accent
    g.lineWidth = 3.5
    g.beginPath()
    g.moveTo(left, bottom)
    g.lineTo(left, top)
    g.lineTo(left + (pulse / frame) * usable, top)
    g.lineTo(left + (pulse / frame) * usable, bottom)
    g.lineTo(left + usable, bottom)
    g.stroke()
    g.strokeStyle = muted
    g.setLineDash([4, 5])
    g.lineWidth = 1.5
    ;[1, 2].forEach((ms) => {
      g.beginPath()
      g.moveTo(left + (ms / frame) * usable, top - 12)
      g.lineTo(left + (ms / frame) * usable, bottom + 10)
      g.stroke()
    })
    g.setLineDash([])
    g.fillStyle = muted
    g.textAlign = 'center'
    g.fillText('1 ms', left + (1 / frame) * usable, bottom + 24)
    g.fillText('2 ms', left + (2 / frame) * usable, bottom + 24)
    g.textAlign = 'right'
    g.fillText('first 2.5 ms of each 20 ms frame', width - 8, 16)
    g.textAlign = 'left'
    g.fillStyle = ink
    g.font = '700 20px "Bahnschrift", "Segoe UI", sans-serif'
    g.fillText(`${pulse.toFixed(2)} ms`, left + (pulse / frame) * usable + 12, top + 18)
  } else if (lessonId === 'traffic') {
    const phases = [['green', 4, css('--green')], ['yellow', 1.5, css('--yellow')], ['red', 4.5, css('--red')]]
    const total = 10
    let x = 12
    const usable = width - 24
    const y = 50
    phases.forEach(([name, length, colour]) => {
      const w = (length / total) * usable
      g.fillStyle = colour
      g.globalAlpha = r.phase === name ? 1 : 0.28
      g.beginPath()
      g.roundRect(x, y, w - 4, 36, 10)
      g.fill()
      g.globalAlpha = 1
      x += w
    })
    // progress marker inside the active phase
    let start = 12
    for (const [name, length] of phases) {
      const w = (length / total) * usable
      if (name === r.phase) {
        const done = 1 - (r.left ?? 0) / (r.length ?? length)
        const markerX = start + done * (w - 4)
        g.fillStyle = css('--ink')
        g.beginPath()
        g.moveTo(markerX, y - 6)
        g.lineTo(markerX - 7, y - 18)
        g.lineTo(markerX + 7, y - 18)
        g.fill()
      }
      start += w
    }
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText('green 4 s', 14, y + 60)
    g.fillText('yellow 1.5 s', 14 + usable * 0.4, y + 60)
    g.textAlign = 'right'
    g.fillText('red 4.5 s', width - 14, y + 60)
  }
}

export default function Instrument({ lesson, step, readouts, controls }) {
  const canvasRef = useRef()
  useEffect(() => {
    draw(canvasRef.current, lesson.id, readouts, controls, step)
  })
  const r = readouts
  let title = 'Pin 13'
  let chips = []
  if (lesson.id === 'blink') {
    title = 'Pin 13 over time'
    chips = [
      r.high ? { icon: <IconHigh />, text: 'HIGH 5 V', on: true } : { icon: <IconLow />, text: 'LOW 0 V' },
      { icon: <IconBolt />, text: `${(r.current ?? 0).toFixed(1)} mA` },
    ]
  } else if (lesson.id === 'button') {
    title = 'Button on pin 2'
    chips = [
      r.pressed ? { icon: <IconHigh />, text: 'pin 2 HIGH', on: true } : { icon: <IconLow />, text: 'pin 2 LOW' },
      { text: `raw presses ${r.rawCount ?? 0}` },
      ...(controls.debounce && step >= 3 ? [{ text: `debounced ${r.debCount ?? 0}`, on: true }] : []),
    ]
  } else if (lesson.id === 'fade') {
    title = 'Pin 9 (PWM)'
    chips = [{ text: `duty ${Math.round((r.duty ?? 0) * 100)} %` }, { icon: <IconBolt />, text: `average ${(r.average ?? 0).toFixed(2)} V` }]
  } else if (lesson.id === 'pot') {
    title = 'Voltage on A0'
    chips = [{ icon: <IconBolt />, text: `${(r.volts ?? 0).toFixed(2)} V` }, { text: `analogRead ${r.reading ?? 0}` }, { text: `brightness ${r.brightness ?? 0}` }]
  } else if (lesson.id === 'servo') {
    title = 'Pulse on pin 9'
    chips = [{ text: `${r.angle ?? 90}°` }, { icon: <IconBolt />, text: `${(r.pulse ?? 1.5).toFixed(2)} ms pulse` }]
  } else if (lesson.id === 'traffic') {
    title = 'The sequence'
    chips = [
      { text: r.phase ? `${r.phase} ${(r.left ?? 0).toFixed(1)} s` : '', on: true },
      r.walk ? { icon: <IconWalk />, text: 'WALK', on: true } : r.pending ? { icon: <IconWalk />, text: 'walk requested' } : { icon: <IconStop />, text: "DON'T WALK" },
    ]
  }
  const tall = lesson.id === 'button' ? 170 : lesson.id === 'blink' || lesson.id === 'fade' ? 110 : 132
  return (
    <section className="instrument" aria-label={title}>
      <div className="instrument-title">{title}</div>
      <canvas ref={canvasRef} width={420} height={tall} style={{ height: tall }} />
      <div className="chips">
        {chips.map((chip, index) => (
          <span key={index} className={`chip${chip.on ? ' on' : ''}`}>{chip.icon}{chip.text}</span>
        ))}
      </div>
    </section>
  )
}
