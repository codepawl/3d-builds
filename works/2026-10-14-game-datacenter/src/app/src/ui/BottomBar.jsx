// The training run timeline and the tabbed lists.
import { useState } from 'react'
import { activeWorld, model, useModelVersion } from '../store.js'
import { formatDuration, formatInteger, listRows, openCount } from '../describe.js'
import { Icon, StatusIcon } from './icons.jsx'
import { focusEntity } from './TopBar.jsx'

function StageNode({ state, progress }) {
  if (state === 'done') {
    return (
      <span className="stage-node done">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    )
  }
  if (state === 'current') {
    const circumference = 2 * Math.PI * 13
    return (
      <span className="stage-node current">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="13" fill="none" stroke="var(--brand-soft)" strokeWidth="4" />
          <circle cx="17" cy="17" r="13" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`} transform="rotate(-90 17 17)" />
          <circle cx="17" cy="17" r="5" fill="var(--brand)" />
        </svg>
      </span>
    )
  }
  return <span className="stage-node next" />
}

export function RunTimeline() {
  useModelVersion()
  const run = activeWorld().run
  const stageProgress = run.step / run.totalSteps
  const remainingSeconds = (run.totalSteps - run.step) / run.stepsPerSecond
  return (
    <section className="timeline panel" aria-label="Training run">
      <div className="timeline-main">
        <div className="timeline-head">
          <Icon name="spark" size={17} />
          <h3>Training run {run.name}</h3>
          <span>{run.size}</span>
        </div>
        <ol className="stages">
          {run.stages.map((stage, index) => {
            const state = index < run.stage ? 'done' : index === run.stage ? 'current' : 'next'
            return (
              <li key={stage} className={`stage ${state}`}>
                <StageNode state={state} progress={stageProgress} />
                <strong>{stage}</strong>
                <small>{state === 'done' ? 'Done' : state === 'current' ? `${(stageProgress * 100).toFixed(1)}%` : 'Queued'}</small>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="run-card">
        <div className="run-step">
          <small>Step</small>
          <strong>{formatInteger(run.step)}</strong>
          <span>of {formatInteger(run.totalSteps)}</span>
        </div>
        <div className="bar"><span style={{ width: `${stageProgress * 100}%` }} /></div>
        <div className="run-meta">
          <span>Loss <strong>{run.loss.toFixed(3)}</strong></span>
          <span>Ends in <strong>{formatDuration(remainingSeconds)}</strong></span>
        </div>
      </div>
    </section>
  )
}

const TABS = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'fleet', label: 'Fleet' },
]

export function ListTabs() {
  useModelVersion()
  const [tab, setTab] = useState('jobs')
  const world = activeWorld()
  const rows = listRows(tab, world)
  return (
    <section className="lists panel" aria-label="Lists">
      <div className="tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'tab is-active' : 'tab'} onClick={() => setTab(id)} data-tab={id}>
            {label} <span>{openCount(id, world)}</span>
          </button>
        ))}
        <span className="tabs-site">{world.site.name}</span>
      </div>
      <ul className="rows">
        {rows.length === 0 && <li className="empty">Nothing here right now</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={row.targetId === model.selectedId ? 'row is-selected' : 'row'}
              data-row={row.id}
              onClick={() => {
                const entity = world.index.get(row.targetId)
                if (entity) focusEntity(world, entity)
              }}
            >
              <StatusIcon tone={row.tone} size={15} />
              <span className="row-text">
                <strong>{row.title}</strong>
                <small>{row.meta}</small>
              </span>
              {row.progress !== undefined && row.progress !== null && (
                <span className="mini-bar"><span style={{ width: `${row.progress * 100}%` }} /></span>
              )}
              <span className="row-right">{row.right}</span>
              <Icon name="chevronRight" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
