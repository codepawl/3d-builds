// The card for "Build your own": parts tray, selection actions, the sketch with Run/Stop, the circuit check and reset.
import { resistorBands } from './layout.js'
import { IconPlay, IconReset, IconStop } from './Icons.jsx'
import {
  deleteSelected, PRESETS, resetSandbox, rotateSelected, setSandbox, sketchLines, TRAY_ITEMS, useSandbox,
} from './sandbox.js'

const LED_SWATCH = { red: '#ff4d4d', yellow: '#ffd23f', green: '#3ddc84' }
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', width: 18, height: 18, viewBox: '0 0 24 24' }
const STATUS_ICONS = {
  ok: <svg {...stroke}><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path d="M8 12.5l2.6 2.6L16 9.5" stroke="var(--on-fill)" /></svg>,
  warn: <svg {...stroke}><path d="M12 3.5l9 16H3z" fill="currentColor" stroke="none" /><path d="M12 10v4M12 16.8v.4" stroke="var(--on-fill)" /></svg>,
  bad: <svg {...stroke}><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" stroke="none" /><path d="M9 9l6 6M15 9l-6 6" stroke="var(--on-fill)" /></svg>,
  idle: <svg {...stroke}><circle cx="12" cy="12" r="8.5" strokeDasharray="3 3.2" /></svg>,
}

function Swatch({ item }) {
  if (item.kind === 'led') return <span className="swatch led" style={{ background: LED_SWATCH[item.color] }} />
  if (item.kind === 'resistor') {
    const bands = resistorBands(item.ohms)
    return <span className="swatch resistor">{bands.map((colour, index) => <i key={index} style={{ background: colour }} />)}</span>
  }
  if (item.kind === 'button') return <span className="swatch button"><i /></span>
  if (item.kind === 'pot') return <span className="swatch pot"><i /></span>
  return <span className="swatch servo"><i /></span>
}

export default function SandboxPanel({ CodePanel, current, onToggleCurrent }) {
  const state = useSandbox()
  const lines = sketchLines(state.preset, state.pin)
  const preset = PRESETS.find((entry) => entry.id === state.preset)
  const startDrag = (item) => (event) => {
    event.preventDefault()
    setSandbox({ drag: { item, x: event.clientX, y: event.clientY, snap: null }, selected: null })
  }
  const drag = state.drag
  return (
    <aside className="card sandbox-card">
      <div className="card-body">
        <h1>Build your own</h1>
        <p>Drag a part onto the board. Drag from any hole or header pin to draw a wire. Click a part to rotate or delete it.</p>

        <div className="tray-grid" role="list" aria-label="Parts tray">
          {TRAY_ITEMS.map((item) => (
            <div key={item.id} role="listitem" className="tray-chip" data-item={item.id} onPointerDown={startDrag(item)}>
              <Swatch item={item} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="sandbox-row">
          <button className="quiet" onClick={rotateSelected} disabled={!state.selected || state.selected.kind !== 'part'}>Rotate</button>
          <button className="quiet" onClick={deleteSelected} disabled={!state.selected}>Delete</button>
          <button className="quiet" onClick={resetSandbox}><IconReset /> Reset</button>
          <button className={`switch${current ? ' on' : ''}`} onClick={onToggleCurrent} role="switch" aria-checked={current}>
            <span className="switch-track"><span className="switch-knob" /></span>
            Show current
          </button>
        </div>

        <div className="chips preset-row">
          {PRESETS.map((entry) => (
            <button key={entry.id} className={`chip${entry.id === state.preset ? ' on' : ''}`} onClick={() => setSandbox({ preset: entry.id })}>{entry.label}</button>
          ))}
        </div>
        {CodePanel ? <CodePanel lines={lines} active={-1} /> : null}
        <div className="sandbox-row run-row">
          <label className="pin-field">
            {preset.pinLabel}
            <input type="number" min="2" max="13" value={state.pin} onChange={(event) => setSandbox({ pin: Math.min(13, Math.max(2, Number(event.target.value) || 13)) })} aria-label={preset.pinLabel} />
          </label>
          <button className={`run-button${state.running ? ' stop' : ''}`} onClick={() => setSandbox({ running: !state.running })}>
            {state.running ? <IconStop /> : <IconPlay />}
            {state.running ? 'Stop' : 'Run'}
          </button>
        </div>

        <ul className="messages" aria-live="polite">
          {state.messages.map((message, index) => (
            <li key={index} className={`message ${message.kind}`}>
              {STATUS_ICONS[message.kind]}
              <span>{message.text}</span>
            </li>
          ))}
        </ul>
      </div>
      {drag ? (
        <div className={`drag-ghost${drag.snap ? ' fits' : ''}`} style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -120%)` }}>
          <Swatch item={drag.item} />
          {drag.item.label}
        </div>
      ) : null}
    </aside>
  )
}
