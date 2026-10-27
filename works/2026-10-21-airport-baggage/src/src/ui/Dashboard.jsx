import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AIRPORT, sim } from '../appContext.js';
import { getState, setState, useStore } from '../store.js';
import { computeKpis, describeBag, describeUnit, formatClock, SITES, statusLabel, TIMELINE_STEPS, unitPins } from '../model.js';
import { FLIGHTS } from '../sim/simulation.js';
import { pinRegistry } from '../pins.js';
import { FOLLOW_DISTANCES, plantRef, resetView, rig, selectBag, selectUnit, startFollow, stopFollow, switchSite, zoomBy } from '../runtime.js';
import { STAGES, bagStageAt } from '../stages.js';
import { SPEED_STEPS } from '../sim/simulation.js';
import { nextStage, pickStage, previousStage, setSlowAtEvents, setSpeed, startTour, stepOnce, stopTour, togglePause } from '../playback.js';
import { Icon, Logo, StatusIcon } from './icons.jsx';

// Re-render the dashboard a few times per simulated second, driven by the same clock as the 3D view.
function useSimulationTick(intervalSeconds = 0.25) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let last = -1;
    let frame;
    const loop = () => {
      if (Math.abs(sim.time - last) >= intervalSeconds) {
        last = sim.time;
        setVersion((value) => value + 1);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [intervalSeconds]);
}

function TopBar() {
  const siteId = useStore((state) => state.siteId);
  const search = useStore((state) => state.search);
  return (
    <header className="top-bar card">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <strong>Bagline</strong>
          <span>{AIRPORT.name} ({AIRPORT.code})</span>
        </div>
      </div>
      <nav className="site-switcher" aria-label="Sites">
        {SITES.map((site) => (
          <button key={site.id} type="button" className={`quiet-button${site.id === siteId ? ' active' : ''}`} data-site={site.id} onClick={() => switchSite(site.id)}>
            {site.short}
          </button>
        ))}
      </nav>
      <label className="search">
        <Icon name="magnifier" size={16} />
        <input
          type="search"
          placeholder="Search bag tag, flight or destination"
          value={search}
          onChange={(event) => setState({ search: event.target.value, tab: event.target.value ? 'bags' : getState().tab })}
        />
      </label>
      <div className="clock tabular" title="Local time">
        <Icon name="clock" size={16} />
        <span id="live-clock">{formatClock(AIRPORT.clockStart + sim.time)}</span>
      </div>
      <div className="user">
        <span className="avatar"><Icon name="user" size={16} /></span>
        <div>
          <strong>R. Hale</strong>
          <span>Shift lead</span>
        </div>
      </div>
    </header>
  );
}

function KpiCards() {
  const kpis = computeKpis(sim);
  const icons = { rate: 'bag', read: 'tag', loaded: 'plane', mishandled: 'alert' };
  return (
    <section className="kpi-grid" aria-label="Key figures">
      {kpis.map((kpi) => (
        <article key={kpi.id} className="card kpi">
          <div className="kpi-label"><Icon name={icons[kpi.id]} size={16} /><span>{kpi.label}</span></div>
          <div className="kpi-value tabular">{kpi.value}</div>
          <div className={`kpi-delta ${kpi.trend}`}>
            <Icon name={kpi.trend === 'up' ? 'up' : kpi.trend === 'flat' ? 'flat' : 'down'} size={14} />
            <span>{kpi.delta}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

// Which stage the selected thing is in and how long it has been there.
function StageRow({ selection, description }) {
  if (selection.kind === 'bag') {
    const { index, since } = bagStageAt(sim.planById(selection.planId), sim.time);
    return (
      <div className="stage-row tabular" data-stage-row>
        <Icon name="scan" size={16} />
        <span>Stage {STAGES[index].key} of {STAGES.length}: {STAGES[index].name}</span>
        <span className="stage-since">{since.toFixed(0)} s in it</span>
      </div>
    );
  }
  const stageIndex = STAGES.findIndex((stage) => stage.unitId === selection.unitId);
  if (stageIndex < 0) return null;
  return (
    <div className="stage-row" data-stage-row>
      <Icon name="scan" size={16} />
      <span>Stage {STAGES[stageIndex].key} of {STAGES.length}: {STAGES[stageIndex].name}</span>
    </div>
  );
}

function FollowControls() {
  const following = useStore((state) => state.following);
  const distance = useStore((state) => state.followDistance);
  return (
    <div className="follow-controls" aria-label="Follow">
      <button type="button" className={`quiet-button${following ? ' active' : ''}`} data-follow="toggle" onClick={() => (following ? stopFollow() : startFollow(distance))}>
        <Icon name={following ? 'scan' : 'ring'} size={16} />
        <span>Follow</span>
      </button>
      {Object.keys(FOLLOW_DISTANCES).map((name) => (
        <button key={name} type="button" className={`quiet-button${following && distance === name ? ' active' : ''}`} data-follow={name} onClick={() => startFollow(name)}>
          {name[0].toUpperCase() + name.slice(1)}
        </button>
      ))}
    </div>
  );
}

function DetailCard() {
  const selection = useStore((state) => state.selection);
  if (!selection) return null;
  let description;
  if (selection.kind === 'bag') {
    const plan = sim.planById(selection.planId);
    if (!plan) return null;
    description = describeBag(sim, plan, sim.time);
  } else {
    description = describeUnit(sim, selection.unitId);
  }
  return (
    <aside className="card detail-card" aria-label="Details">
      <div className="detail-head">
        <span className="detail-icon"><Icon name={selection.kind === 'bag' ? 'bag' : 'site'} size={22} /></span>
        <div>
          <h2>{description.title}</h2>
          <p>{description.subtitle}</p>
        </div>
      </div>
      <div className="status-row">
        <StatusIcon status={description.status} size={20} />
        <strong>{description.statusText}</strong>
      </div>
      <StageRow selection={selection} description={description} />
      <FollowControls />
      <div className="progress-block">
        <div className="progress-label"><span>{description.progressLabel}</span><span className="tabular">{Math.round(description.progress * 100)}%</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(description.progress * 100)}%` }} /></div>
      </div>
      <dl className="fields">
        {description.fields.map(([label, value]) => (
          <div key={label} className="field">
            <dt>{label}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function PlaybackControls() {
  const speed = useStore((state) => state.speed);
  const paused = useStore((state) => state.paused);
  const slowed = useStore((state) => state.slowed);
  const slowAtEvents = useStore((state) => state.slowAtEvents);
  const status = paused
    ? { icon: 'pause', text: 'Paused', tone: 'paused' }
    : slowed
      ? { icon: 'hourglass', text: 'Slowed at event', tone: 'slowed' }
      : { icon: 'play', text: `Playing at ${speed}x`, tone: 'playing' };
  return (
    <div className="playback" data-keeps-tour aria-label="Playback">
      <span className={`playback-state ${status.tone}`} role="status" data-playback-state={status.tone}><Icon name={status.icon} size={16} /><span>{status.text}</span></span>
      <button type="button" className="quiet-button" data-playback="toggle" title="Pause or play (Space)" onClick={togglePause}>
        <Icon name={paused ? 'play' : 'pause'} size={16} />
        <span>{paused ? 'Play' : 'Pause'}</span>
      </button>
      <button type="button" className="quiet-button" data-playback="step" title="One fixed step while paused" disabled={!paused} onClick={stepOnce}>
        <Icon name="stepForward" size={16} />
        <span>Step</span>
      </button>
      <span className="speed-group" role="group" aria-label="Speed">
        {SPEED_STEPS.map((value) => (
          <button key={value} type="button" className={`quiet-button tabular${speed === value ? ' active' : ''}`} data-speed={value} title="Speed (keys - and +)" onClick={() => setSpeed(value)}>
            {value}x
          </button>
        ))}
      </span>
      <button type="button" className={`quiet-button${slowAtEvents ? ' active' : ''}`} data-playback="slow" title="Ease to 0.25x around each stage's event in the tour" onClick={() => setSlowAtEvents(!slowAtEvents)}>
        <Icon name={slowAtEvents ? 'scan' : 'ring'} size={16} />
        <span>Slow down at events</span>
      </button>
    </div>
  );
}

function StageBar() {
  const stageIndex = useStore((state) => state.stageIndex);
  const touring = useStore((state) => state.touring);
  const tourIndex = useStore((state) => state.tourIndex);
  const current = touring ? tourIndex : stageIndex;
  return (
    <nav className="stage-bar card" aria-label="Stages">
      <button type="button" className="quiet-button icon-only" data-stage-step="previous" title="Previous stage" aria-label="Previous stage" onClick={previousStage}><Icon name="previous" size={16} /></button>
      {STAGES.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          className={`quiet-button stage-button${index === current ? ' active' : ''}`}
          data-stage={stage.id}
          title={`${stage.name}: ${stage.does} (key ${stage.key})`}
          onClick={() => pickStage(index)}
        >
          <span className="stage-key tabular">{stage.key}</span>
          <span>{stage.short}</span>
        </button>
      ))}
      <button type="button" className="quiet-button icon-only" data-stage-step="next" title="Next stage" aria-label="Next stage" onClick={nextStage}><Icon name="next" size={16} /></button>
      <button type="button" className={`quiet-button tour-button${touring ? ' active' : ''}`} data-keeps-tour data-tour onClick={() => (touring ? stopTour() : startTour())}>
        <Icon name={touring ? 'pause' : 'route'} size={16} />
        <span>{touring ? `Tour ${tourIndex + 1} of ${STAGES.length}` : 'Tour'}</span>
      </button>
    </nav>
  );
}

function Timeline() {
  const selection = useStore((state) => state.selection);
  const plan = selection?.kind === 'bag' ? sim.planById(selection.planId) : sim.heroPlan;
  if (!plan) return null;
  const description = describeBag(sim, plan, sim.time);
  const flight = FLIGHTS[plan.flight];
  const elapsed = Math.max(0, sim.time - plan.t0);
  return (
    <section className="card timeline" aria-label="Bag timeline">
      <div className="timeline-head">
        <span className="timeline-title"><Icon name="bag" size={16} /> Following bag <strong className="tabular">{plan.tag}</strong></span>
        <PlaybackControls />
        <span className="timeline-meta tabular">{flight.code} to {flight.destination}, {elapsed.toFixed(0)} s since check-in</span>
      </div>
      <ol className="steps">
        {TIMELINE_STEPS.map((step, index) => {
          const done = index < description.stage;
          const current = index === description.stage;
          return (
            <li key={step} className={`step${done ? ' done' : ''}${current ? ' current' : ''}`}>
              <span className="step-mark">{done ? <Icon name="check" size={18} /> : current ? <Icon name="scan" size={18} /> : <span className="step-dot" />}</span>
              <span className="step-name">{step}</span>
            </li>
          );
        })}
      </ol>
      <div className="progress-track slim"><div className="progress-fill" style={{ width: `${Math.round(description.progress * 100)}%` }} /></div>
    </section>
  );
}

function BagRows() {
  const search = useStore((state) => state.search).trim().toLowerCase();
  const selection = useStore((state) => state.selection);
  const rows = sim.state.active
    .filter((plan) => !plan.flagged || sim.time < plan.clearedTime)
    .filter((plan) => sim.time >= plan.archTime)
    .filter((plan) => {
      if (!search) return true;
      const flight = FLIGHTS[plan.flight];
      return `${plan.tag} ${flight.code} ${flight.destination}`.toLowerCase().includes(search);
    })
    .sort((first, second) => (second.hero ? 1 : 0) - (first.hero ? 1 : 0) || second.id - first.id)
    .slice(0, 8);
  return rows.map((plan) => {
    const flight = FLIGHTS[plan.flight];
    const status = sim.bagStatus(plan, sim.time);
    const selected = selection?.kind === 'bag' && selection.planId === plan.id;
    return (
      <button key={plan.id} type="button" className={`row${selected ? ' selected' : ''}`} data-row="bag" onClick={() => selectBag(plan.id)}>
        <StatusIcon status={status} size={18} />
        <span className="row-main"><strong className="tabular">{plan.tag}</strong><small>{flight.code} to {flight.destination}</small></span>
        <span className="row-side">{plan.hero ? 'Tracked' : statusLabel(status)}</span>
      </button>
    );
  });
}

function FlightRows() {
  const search = useStore((state) => state.search).trim().toLowerCase();
  return FLIGHTS.map((flight, index) => ({ flight, index }))
    .filter(({ flight }) => !search || `${flight.code} ${flight.destination}`.toLowerCase().includes(search))
    .map(({ flight, index }) => {
      const loaded = sim.signals.flightLoaded[index];
      const share = Math.min(1, loaded / flight.expected);
      return (
        <button key={flight.code} type="button" className="row" data-row="flight" data-flight={flight.code} onClick={() => selectUnit(`chute-${sim.world.chutes[index].id}`, { fly: true })}>
          <StatusIcon status={index === 6 ? 'closed' : 'open'} size={18} />
          <span className="row-main"><strong>{flight.code} to {flight.destination}</strong><small>Gate {flight.gate}, departs in {flight.departsInMinutes} min</small></span>
          <span className="row-side tabular">
            {loaded}/{flight.expected}
            <span className="mini-track"><span style={{ width: `${share * 100}%` }} /></span>
          </span>
        </button>
      );
    });
}

function AlertRows() {
  const entries = [...sim.state.log].reverse().slice(0, 8);
  if (!entries.length) return <p className="empty">No alerts</p>;
  return entries.map((entry, index) => (
    <button key={`${entry.time}-${index}`} type="button" className="row" onClick={() => entry.bagId && selectBag(entry.bagId)}>
      <StatusIcon status={entry.level === 'alarm' ? 'alarm' : entry.level === 'warning' ? 'warning' : 'ok'} size={18} />
      <span className="row-main"><strong>{entry.text}</strong><small className="tabular">{formatClock(AIRPORT.clockStart + entry.time)}</small></span>
    </button>
  ));
}

function ListPanel() {
  const tab = useStore((state) => state.tab);
  const tabs = [['bags', 'Bags'], ['flights', 'Flights'], ['alerts', 'Alerts']];
  return (
    <section className="card list-panel" aria-label="Lists">
      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={`quiet-button${tab === id ? ' active' : ''}`} data-tab={id} onClick={() => setState({ tab: id })}>
            {label}
          </button>
        ))}
      </div>
      <div className="rows">
        {tab === 'bags' && <BagRows />}
        {tab === 'flights' && <FlightRows />}
        {tab === 'alerts' && <AlertRows />}
      </div>
    </section>
  );
}

function CameraButtons() {
  const orbiting = useStore((state) => state.orbiting);
  return (
    <div className="camera-buttons card" aria-label="Camera">
      <button type="button" title="Zoom in" data-camera="zoom-in" onClick={() => zoomBy(0.8)}><Icon name="plus" /></button>
      <button type="button" title="Zoom out" data-camera="zoom-out" onClick={() => zoomBy(1.25)}><Icon name="minus" /></button>
      <button type="button" title="Overview" data-camera="home" onClick={() => resetView()}><Icon name="home" /></button>
      <button
        type="button"
        title="Slow orbit"
        data-camera="orbit"
        className={orbiting ? 'on' : ''}
        onClick={() => {
          rig.orbitRate = orbiting ? 0 : 0.035;
          setState({ orbiting: !orbiting });
        }}
      >
        <Icon name="orbit" />
      </button>
      <button type="button" title="Follow the tracked bag" data-camera="follow" onClick={() => sim.heroPlan && selectBag(sim.heroPlan.id)}><Icon name="target" /></button>
    </div>
  );
}

function Pin({ id, label, icon, getPosition, tone }) {
  const reference = useRef();
  useEffect(() => {
    pinRegistry.set(id, { element: reference.current, getPosition });
    return () => pinRegistry.delete(id);
  }, [id, getPosition]);
  return (
    <div ref={reference} className={`pin ${tone ?? ''}`}>
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </div>
  );
}

function Pins() {
  const siteId = useStore((state) => state.siteId);
  const selection = useStore((state) => state.selection);
  const pins = unitPins(siteId);
  const vector = useRef(new THREE.Vector3());
  return (
    <div className="pin-layer">
      {pins.map((pin) => (
        <Pin
          key={`${siteId}-${pin.unitId}`}
          id={`${siteId}-${pin.unitId}`}
          label={pin.label}
          icon={pin.icon}
          getPosition={() => {
            const bounds = plantRef.current?.boundsOfUnit(pin.unitId);
            if (!bounds) return null;
            return vector.current.set(bounds.centre.x, bounds.centre.y + bounds.size.y / 2 + 0.6, bounds.centre.z).clone();
          }}
        />
      ))}
      {siteId === 'hall' && sim.heroPlan && !(selection?.kind === 'bag') && (
        <Pin
          id="hero"
          label={`Bag ${sim.heroPlan.tag}`}
          icon="bag"
          tone="hero"
          getPosition={() => {
            const position = plantRef.current?.positionOfBag(sim.heroPlan.id);
            return position ? position.clone().setY(position.y + 1.1) : null;
          }}
        />
      )}
    </div>
  );
}

function Caption() {
  const caption = useStore((state) => state.caption);
  if (!caption) return null;
  return <div className="caption" role="status">{caption}</div>;
}

function FilmCursor() {
  const reference = useRef();
  useEffect(() => {
    const onMove = (event) => {
      reference.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      reference.current.style.opacity = '1';
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <svg ref={reference} className="film-cursor" width="28" height="28" viewBox="0 0 24 24" style={{ opacity: 0 }}>
      <path d="M4 2l15 9.2-6.4 1.5 3.6 6.6-2.8 1.5-3.6-6.6L5.4 19z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  useSimulationTick(0.25);
  const showCursor = new URLSearchParams(window.location.search).has('film');
  return (
    <div className="dashboard">
      <TopBar />
      <KpiCards />
      <StageBar />
      <DetailCard />
      <CameraButtons />
      <Pins />
      <Caption />
      <Timeline />
      <ListPanel />
      {showCursor && <FilmCursor />}
    </div>
  );
}
