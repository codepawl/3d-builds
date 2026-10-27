// KPI cards, the detail card of the selected object and the camera buttons.
import { Color } from 'three'
import { siteMetrics } from '../sim.js'
import { activeWorld, selectedEntity, useModelVersion } from '../store.js'
import { describeEntity, formatInteger, formatTokens } from '../describe.js'
import { entityPosition } from '../world.js'
import { flyHome, flyTo, rotateBy, zoomBy } from '../cameraRig.js'
import { temperatureColor } from '../scene/palette.js'
import { Icon, StatusIcon } from './icons.jsx'

function Delta({ value, previous, lowerIsBetter = false, format }) {
  const difference = value - previous
  const flat = Math.abs(difference) < Math.abs(previous) * 0.002
  const better = lowerIsBetter ? difference < 0 : difference > 0
  const className = flat ? 'delta flat' : better ? 'delta good' : 'delta bad'
  const arrow = flat ? '→' : difference > 0 ? '↑' : '↓'
  return <span className={className}>{arrow} {format(Math.abs(difference))}</span>
}

export function Kpis() {
  useModelVersion()
  const world = activeWorld()
  const metrics = siteMetrics(world)
  const trend = world.trend ?? metrics
  const cards = [
    { icon: 'tokens', label: 'Tokens per second', value: formatTokens(metrics.tokensPerSecond), note: 'all jobs',
      delta: <Delta value={metrics.tokensPerSecond} previous={trend.tokensPerSecond} format={formatTokens} /> },
    { icon: 'chip', label: 'GPUs busy', value: formatInteger(metrics.gpusBusy), note: `of ${formatInteger(metrics.gpusTotal)}`,
      delta: <Delta value={metrics.gpusBusy} previous={trend.gpusBusy} format={formatInteger} /> },
    { icon: 'gauge', label: 'PUE', value: metrics.powerUsageEffectiveness.toFixed(3), note: 'target 1.15',
      delta: <Delta value={metrics.powerUsageEffectiveness} previous={trend.powerUsageEffectiveness} lowerIsBetter format={(value) => value.toFixed(3)} /> },
    { icon: 'bolt', label: 'Power', value: `${metrics.powerMegawatts.toFixed(2)} MW`, note: 'hall total',
      delta: <Delta value={metrics.powerMegawatts} previous={trend.powerMegawatts} lowerIsBetter format={(value) => value.toFixed(2)} /> },
  ]
  return (
    <section className="kpis" aria-label="Hall numbers">
      {cards.map((card) => (
        <div key={card.label} className="kpi panel">
          <span className="kpi-icon"><Icon name={card.icon} size={18} /></span>
          <div>
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-value">{card.value}</div>
            <div className="kpi-note">{card.delta}<span>{card.note}</span></div>
          </div>
        </div>
      ))}
    </section>
  )
}

const scratchColor = new Color()

function trayCss(temperature) {
  temperatureColor(temperature, scratchColor, 1)
  return `#${scratchColor.getHexString()}`
}

function TrayStrip({ trays }) {
  return (
    <div className="trays">
      <div className="trays-label">GPU trays, bottom to top</div>
      <div className="trays-row">
        {trays.map((tray, index) => (
          <div key={index} className={tray.failed ? 'tray failed' : 'tray'}>
            <span className="tray-bar" style={{ background: tray.failed ? 'var(--critical)' : trayCss(tray.temperature) }} />
            <small>{tray.temperature.toFixed(0)}°</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailCard() {
  useModelVersion()
  const world = activeWorld()
  const entity = selectedEntity()
  if (!entity) return null
  const card = describeEntity(entity, world)
  return (
    <aside className="detail panel" aria-label={`${card.title} details`} data-testid="detail-card">
      <div className="detail-head">
        <span className="detail-icon"><Icon name={card.icon} size={22} /></span>
        <div className="detail-title">
          <h2>{card.title}</h2>
          <p>{card.subtitle}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Fly to it" title="Fly to it" onClick={() => flyTo(entityPosition(world, entity), 14)}>
          <Icon name="pin" size={16} />
        </button>
      </div>
      <div className={`status-row tone-${card.status.tone}`}>
        <StatusIcon tone={card.status.tone} size={15} />
        <strong>{card.status.label}</strong>
        <span>{card.statusNote}</span>
      </div>
      {card.progress && (
        <div className="progress-block">
          <div className="progress-text">
            <span>{card.progress.label}</span>
            <strong>{card.progress.right}</strong>
          </div>
          <div className="bar"><span style={{ width: `${Math.min(100, Math.max(0, card.progress.value * 100))}%` }} /></div>
        </div>
      )}
      {card.trays && <TrayStrip trays={card.trays} />}
      <dl className="fields">
        {card.fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

export function CameraButtons() {
  const buttons = [
    { icon: 'plus', label: 'Zoom in', action: () => zoomBy(0.7) },
    { icon: 'minus', label: 'Zoom out', action: () => zoomBy(1.4) },
    { icon: 'rotateLeft', label: 'Turn left', action: () => rotateBy(Math.PI / 4) },
    { icon: 'rotateRight', label: 'Turn right', action: () => rotateBy(-Math.PI / 4) },
    { icon: 'home', label: 'Whole hall', action: () => flyHome(activeWorld()) },
  ]
  return (
    <nav className="camera-buttons panel" aria-label="Camera">
      {buttons.map((button) => (
        <button key={button.icon} type="button" className="icon-button" aria-label={button.label} title={button.label} onClick={button.action} data-testid={`camera-${button.icon}`}>
          <Icon name={button.icon} size={17} />
        </button>
      ))}
    </nav>
  )
}
