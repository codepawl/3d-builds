import { useEffect, useMemo, useRef, useState } from 'react';
import { Scene, lookAtOverview, OVERVIEW_TARGET } from './Scene.jsx';
import { notify, select, switchSpace, useWorldVersion, world } from './store.js';
import { activeSpace, API_RUNTIMES, findObject, findRoom, selectionPosition, STAGES } from './world.js';
import { orgletStatus, resolveApproval } from './simulation.js';
import {
  BoltIcon, CheckCircleIcon, ChevronDownIcon, ClipboardIcon, HomeIcon, HourglassIcon, InboxIcon, LogoMark,
  MinusIcon, MoonIcon, OctagonIcon, PlusIcon, RoomIcon, RotateIcon, SearchIcon, ShieldIcon, WalkIcon,
} from './icons.jsx';

const SESSION_START = Date.now();

const STATUS = {
  working: { label: 'Working', tone: 'green', Icon: BoltIcon },
  walking: { label: 'Moving', tone: 'blue', Icon: WalkIcon },
  waiting: { label: 'Held for approval', tone: 'amber', Icon: HourglassIcon },
  planning: { label: 'Planning', tone: 'violet', Icon: ClipboardIcon },
  idle: { label: 'Idle', tone: 'grey', Icon: MoonIcon },
  requested: { label: 'Requested', tone: 'grey', Icon: InboxIcon },
  planned: { label: 'Planned', tone: 'violet', Icon: ClipboardIcon },
  approval: { label: 'Approval', tone: 'amber', Icon: HourglassIcon },
  reported: { label: 'Reported', tone: 'green', Icon: CheckCircleIcon },
  blocked: { label: 'Blocked', tone: 'red', Icon: OctagonIcon },
  allowed: { label: 'Allowed', tone: 'green', Icon: ShieldIcon },
  refused: { label: 'Refused', tone: 'red', Icon: OctagonIcon },
};

const TASK_STATUS_BY_STAGE = ['requested', 'planned', 'working', 'approval', 'reported'];
const FOCUS_DISTANCE = 15;
const OVERVIEW_DISTANCE = 46;

function StatusChip({ status, label }) {
  const meta = STATUS[status];
  return (
    <span className={`chip tone-${meta.tone}`}>
      <meta.Icon size={14} />
      {label ?? meta.label}
    </span>
  );
}

function StatusIcon({ status }) {
  const meta = STATUS[status];
  return (
    <span className={`status-icon tone-${meta.tone}`} title={meta.label}>
      <meta.Icon size={15} />
    </span>
  );
}

function formatTokens(tokens) {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  return `${Math.round(tokens / 1000)}k`;
}

function formatClock(date, withSeconds) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined });
}

function wallClock(simulationSeconds) {
  return formatClock(new Date(SESSION_START + simulationSeconds * 1000), false);
}

function taskStatus(task) {
  if (task.blocked) {
    return 'blocked';
  }
  return task.stage === 3 && !task.isHeld ? 'working' : TASK_STATUS_BY_STAGE[task.stage];
}

function phaseText(orglet, space) {
  const room = orglet.roomId ? findRoom(space, orglet.roomId) : null;
  switch (orglet.phase) {
    case 'toLead':
      return 'Going to the lead desk';
    case 'pickup':
      return 'Picking up a task card';
    case 'toWork':
      return `Going to the ${room?.label.toLowerCase() ?? 'work room'}`;
    case 'toApproval':
      return 'Going to an approval station';
    case 'toReview':
      return 'Bringing the result to review';
    case 'reporting':
      return 'Reporting back to the channel';
    default:
      return orglet.tool ?? 'Waiting for the next task';
  }
}

function flyTo(selection, distance = FOCUS_DISTANCE) {
  const position = selectionPosition(world, selection);
  if (position) {
    world.cameraRequest = { x: position.x, z: position.z, distance, follow: selection.type === 'orglet' ? selection : null };
  }
  select(selection);
}

function TopBar({ space }) {
  const [query, setQuery] = useState('');
  const [isSpaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const searchInput = useRef();
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const orglets = space.orglets
      .filter((orglet) => `${orglet.name} ${orglet.role} ${orglet.runtime}`.toLowerCase().includes(needle))
      .map((orglet) => ({ selection: { type: 'orglet', id: orglet.id }, title: orglet.name, detail: `${orglet.role} · ${orglet.runtime}` }));
    const tasks = space.tasks
      .filter((task) => `${task.code} ${task.title} ${task.channel}`.toLowerCase().includes(needle))
      .map((task) => ({ selection: { type: 'task', id: task.id }, title: task.code, detail: task.title }));
    const rooms = space.rooms
      .filter((spaceRoom) => spaceRoom.label.toLowerCase().includes(needle))
      .map((spaceRoom) => ({ selection: { type: 'room', id: spaceRoom.id }, title: spaceRoom.label, detail: 'Room' }));
    return [...orglets, ...tasks, ...rooms].slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, space, world.version]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function choose(result) {
    flyTo(result.selection);
    setQuery('');
    searchInput.current?.blur();
  }

  const waitingCount = (candidate) => candidate.approvals.filter((approval) => approval.status === 'waiting').length;

  return (
    <header className="top-bar panel">
      <div className="brand">
        <LogoMark />
        <span className="brand-name">Orglet Office</span>
      </div>
      <div className="search">
        <SearchIcon />
        <input
          ref={searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) {
              choose(results[0]);
            }
            if (event.key === 'Escape') {
              setQuery('');
            }
          }}
          placeholder="Search orglets, tasks, rooms"
          aria-label="Search orglets, tasks and rooms"
        />
        <kbd>Ctrl K</kbd>
        {results.length > 0 && (
          <ul className="search-results panel">
            {results.map((result) => (
              <li key={`${result.selection.type}-${result.selection.id}`}>
                <button onClick={() => choose(result)}>
                  <strong>{result.title}</strong>
                  <span>{result.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-switcher">
        <button className="space-button" onClick={() => setSpaceMenuOpen(!isSpaceMenuOpen)} aria-expanded={isSpaceMenuOpen}>
          <span className="space-badge">{space.name.slice(0, 2).toUpperCase()}</span>
          <span className="space-text">
            <strong>{space.name}</strong>
            <span>{space.note}</span>
          </span>
          <ChevronDownIcon />
        </button>
        {isSpaceMenuOpen && (
          <ul className="space-menu panel">
            {world.spaces.map((candidate) => (
              <li key={candidate.id}>
                <button
                  className={candidate.id === space.id ? 'is-active' : ''}
                  onClick={() => {
                    setSpaceMenuOpen(false);
                    switchSpace(candidate.id);
                    world.cameraRequest = { x: OVERVIEW_TARGET.x, z: OVERVIEW_TARGET.z, distance: OVERVIEW_DISTANCE };
                    notify();
                  }}
                >
                  <span className="space-badge">{candidate.name.slice(0, 2).toUpperCase()}</span>
                  <span className="space-text">
                    <strong>{candidate.name}</strong>
                    <span>
                      {candidate.orglets.length} orglets · {waitingCount(candidate)} waiting on you
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="live">
        <span className="live-dot" />
        Live <span className="clock">{formatClock(new Date(), true)}</span>
      </div>
      <div className="user">
        <span className="avatar">Y</span>
        <span className="space-text">
          <strong>You</strong>
          <span>Approval mode · Auto</span>
        </span>
      </div>
    </header>
  );
}

function KpiCards({ space }) {
  const statuses = space.orglets.map(orgletStatus);
  const working = statuses.filter((status) => status === 'working' || status === 'planning').length;
  const moving = statuses.filter((status) => status === 'walking').length;
  const waitingApprovals = space.approvals.filter((approval) => approval.status === 'waiting');
  const risky = waitingApprovals.filter((approval) => approval.risk === 'high').length;
  const tokens = space.orglets.reduce((total, orglet) => total + orglet.tokensToday, 0);
  const openTasks = space.tasks.filter((task) => task.stage < 4).length;
  const spendShare = Math.min(1, space.apiSpendDollars / space.apiCapDollars);
  return (
    <section className="kpis" aria-label="Space summary">
      <div className="kpi panel">
        <span className="kpi-icon tone-green"><BoltIcon /></span>
        <div>
          <span className="kpi-label">Orglets working</span>
          <strong className="kpi-value">{working}<small> / {space.orglets.length}</small></strong>
          <span className="kpi-sub">{moving} moving between rooms</span>
        </div>
      </div>
      <div className="kpi panel">
        <span className="kpi-icon tone-amber"><HourglassIcon /></span>
        <div>
          <span className="kpi-label">Waiting on you</span>
          <strong className="kpi-value">{waitingApprovals.length}</strong>
          <span className="kpi-sub">{risky} risky · rest on Auto</span>
        </div>
      </div>
      <div className="kpi panel">
        <span className="kpi-icon tone-violet"><CheckCircleIcon /></span>
        <div>
          <span className="kpi-label">Reported today</span>
          <strong className="kpi-value">{space.reportedToday}</strong>
          <span className="kpi-sub">{openTasks} tasks open</span>
        </div>
      </div>
      <div className="kpi panel">
        <span className="kpi-icon tone-blue"><InboxIcon /></span>
        <div>
          <span className="kpi-label">Tokens today</span>
          <strong className="kpi-value">{formatTokens(tokens)}</strong>
          <span className="kpi-sub">API ${space.apiSpendDollars.toFixed(2)} of ${space.apiCapDollars} cap</span>
          <span className="meter"><span style={{ width: `${spendShare * 100}%` }} /></span>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function Progress({ value, tone = 'violet' }) {
  return (
    <span className={`progress tone-${tone}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${value * 100}%` }} />
    </span>
  );
}

function ApprovalButtons({ space, approval }) {
  const resolve = (decision) => {
    resolveApproval(space, approval.id, decision, world.time);
    notify();
  };
  return (
    <div className="approval-buttons">
      <button className="primary" onClick={() => resolve('once')}>Allow once</button>
      <button onClick={() => resolve('always')}>Always this tool</button>
      <button onClick={() => resolve('refuse')}>Refuse</button>
    </div>
  );
}

function OrgletCard({ space, orglet }) {
  const status = orgletStatus(orglet);
  const task = space.tasks.find((candidate) => candidate.id === orglet.taskId);
  const approval = task?.approvalId ? space.approvals.find((candidate) => candidate.id === task.approvalId) : null;
  const room = orglet.roomId ? findRoom(space, orglet.roomId) : null;
  const billing = API_RUNTIMES.has(orglet.runtime) ? `Pay per use · ${orglet.runtime}` : `Your ${orglet.runtime} plan`;
  return (
    <>
      <div className="card-head">
        <span className="unit-avatar" style={{ background: orglet.color }}>{orglet.name[0]}</span>
        <div>
          <h2>{orglet.name}</h2>
          <p>{orglet.role} · runs on {orglet.runtime}</p>
        </div>
      </div>
      <div className="card-status">
        <StatusChip status={status} />
        <span className="muted">{orglet.lead ? 'Splits work for the channel' : phaseText(orglet, space)}</span>
      </div>
      {task && (
        <div className="task-box">
          <div className="task-title">
            <span className="code">{task.code}</span>
            <span>{task.channel}</span>
          </div>
          <p>{task.title}</p>
          <div className="progress-row">
            <Progress value={task.progress} tone={status === 'waiting' ? 'amber' : 'violet'} />
            <span className="tabular">{Math.round(task.progress * 100)}%</span>
          </div>
        </div>
      )}
      {approval?.status === 'waiting' && (
        <div className="held">
          <div className="held-line">
            <StatusIcon status="approval" />
            <span>{approval.action}</span>
          </div>
          <ApprovalButtons space={space} approval={approval} />
        </div>
      )}
      <div className="fields">
        <Field label="Tool in use">{orglet.tool ?? 'None'}</Field>
        <Field label="Room">{room?.label ?? 'Corridor'}</Field>
        <Field label="Tokens today"><span className="tabular">{orglet.tokensToday.toLocaleString('en-US')}</span></Field>
        <Field label="Billing">{billing}</Field>
        <Field label="Reported today"><span className="tabular">{orglet.tasksDone}</span></Field>
      </div>
      {orglet.log.length > 0 && (
        <ol className="activity">
          {orglet.log.slice(0, 3).map((entry, index) => (
            <li key={`${entry.time}-${index}`}>
              <span className="tabular muted">{wallClock(entry.time)}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function RoomCard({ space, spaceRoom }) {
  const inside = space.orglets.filter((orglet) => orglet.roomId === spaceRoom.id && orglet.path.length === 0);
  const descriptions = {
    lead: 'New requests land here. The lead plans each one, splits it and hands out the cards.',
    research: 'Orglets read pages in their own browser, search the web and read the files you attach.',
    code: 'Edits happen in a private copy of the folder you granted, never in your folder directly.',
    review: 'Results come back here. A code change waits as a diff you review before your folder changes.',
    approvals: 'An action that sends, pays or deletes is held here until it is allowed or refused.',
    routines: 'Requests that repeat daily, weekly or every few hours while the app is open.',
  };
  return (
    <>
      <div className="card-head">
        <span className="unit-avatar room-avatar"><RoomIcon size={18} /></span>
        <div>
          <h2>{spaceRoom.label}</h2>
          <p>{space.name}</p>
        </div>
      </div>
      <p className="description">{descriptions[spaceRoom.kind]}</p>
      <div className="fields">
        <Field label="Orglets here"><span className="tabular">{inside.length}</span></Field>
        <Field label="Stations"><span className="tabular">{spaceRoom.slots.length}</span></Field>
      </div>
      <ul className="mini-list">
        {inside.map((orglet) => (
          <li key={orglet.id}>
            <button onClick={() => flyTo({ type: 'orglet', id: orglet.id })}>
              <StatusIcon status={orgletStatus(orglet)} />
              <strong>{orglet.name}</strong>
              <span className="muted">{orglet.tool ?? orglet.role}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function TaskCard({ space, task }) {
  const assignee = space.orglets.find((orglet) => orglet.id === task.assigneeId);
  return (
    <>
      <div className="card-head">
        <span className="unit-avatar room-avatar"><ClipboardIcon size={18} /></span>
        <div>
          <h2>{task.code}</h2>
          <p>{task.channel}</p>
        </div>
      </div>
      <p className="description">{task.title}</p>
      <div className="card-status"><StatusChip status={taskStatus(task)} /></div>
      <div className="progress-row">
        <Progress value={task.progress} />
        <span className="tabular">{Math.round(task.progress * 100)}%</span>
      </div>
      <div className="fields">
        <Field label="Assigned to">{assignee ? `${assignee.name} · ${assignee.role}` : 'Waiting for the lead'}</Field>
        <Field label="Arrived"><span className="tabular">{wallClock(task.createdAt)}</span></Field>
      </div>
    </>
  );
}

function ApprovalCard({ space, approval }) {
  const orglet = space.orglets.find((candidate) => candidate.id === approval.orgletId);
  const task = space.tasks.find((candidate) => candidate.id === approval.taskId);
  const status = approval.status === 'waiting' ? 'approval' : approval.status;
  const resolvedText = { auto: 'Auto mode allowed it', once: 'Allowed once', always: 'Always allowed for this tool', refuse: 'Refused' };
  return (
    <>
      <div className="card-head">
        <span className="unit-avatar room-avatar"><HourglassIcon size={18} /></span>
        <div>
          <h2>{approval.action}</h2>
          <p>{approval.code} · held by {orglet?.name}</p>
        </div>
      </div>
      <div className="card-status">
        <StatusChip status={status} label={approval.status === 'waiting' ? 'Waiting' : resolvedText[approval.resolvedBy]} />
        <span className="muted">{approval.risk === 'high' ? 'Risky: needs your answer' : 'Low risk'}</span>
      </div>
      <div className="fields">
        <Field label="Task">{task ? `${task.code} · ${task.channel}` : 'Finished'}</Field>
        <Field label="Held since"><span className="tabular">{wallClock(approval.createdAt)}</span></Field>
      </div>
      {approval.status === 'waiting' && <ApprovalButtons space={space} approval={approval} />}
    </>
  );
}

function DetailCard({ space }) {
  const selection = world.selection;
  const target = findObject(world, selection);
  if (!target) {
    return null;
  }
  return (
    <aside className="detail panel" aria-label="Details">
      {selection.type === 'orglet' && <OrgletCard space={space} orglet={target} />}
      {selection.type === 'room' && <RoomCard space={space} spaceRoom={target} />}
      {selection.type === 'task' && <TaskCard space={space} task={target} />}
      {selection.type === 'approval' && <ApprovalCard space={space} approval={target} />}
    </aside>
  );
}

function focusedTask(space) {
  const selection = world.selection;
  const target = findObject(world, selection);
  if (selection?.type === 'task') {
    return target;
  }
  if (selection?.type === 'orglet' && target?.taskId) {
    return space.tasks.find((task) => task.id === target.taskId);
  }
  if (selection?.type === 'approval' && target) {
    return space.tasks.find((task) => task.id === target.taskId);
  }
  return space.tasks.find((task) => task.stage >= 2 && task.stage < 4) ?? space.tasks[0];
}

function Timeline({ space }) {
  const task = focusedTask(space);
  if (!task) {
    return null;
  }
  const assignee = space.orglets.find((orglet) => orglet.id === task.assigneeId);
  const secondsLeft = Math.max(0, Math.round((1 - task.progress) * task.durationSeconds));
  return (
    <section className="timeline panel" aria-label="Task timeline">
      <div className="timeline-head">
        <strong>{task.code}</strong>
        <span className="timeline-title">{task.title}</span>
        <span className="muted">{task.channel}</span>
      </div>
      <div className="timeline-body">
        <ol className="stages">
          {STAGES.map((stage, index) => {
            const approvalSettled = index === 3 && task.approvalId && !task.isHeld;
            const isDone = task.stage > index || approvalSettled || (task.stage === 4 && index === 4);
            const isCurrent = task.stage === index && !isDone;
            const skipped = index === 3 && !task.approvalId && task.stage >= 3;
            return (
              <li key={stage} className={`${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${skipped ? 'is-skipped' : ''}`}>
                <span className="stage-dot">{isDone && !skipped ? <CheckCircleIcon size={18} /> : isCurrent ? <BoltIcon size={12} /> : null}</span>
                <span className="stage-name">{skipped ? 'No approval' : stage}</span>
                <span className="stage-time tabular">{task.stageTimes[index] != null ? wallClock(task.stageTimes[index]) : '—'}</span>
              </li>
            );
          })}
        </ol>
        <button className="timeline-assignee" onClick={() => assignee && flyTo({ type: 'orglet', id: assignee.id })} disabled={!assignee}>
          {assignee ? (
            <>
              <span className="unit-avatar small" style={{ background: assignee.color }}>{assignee.name[0]}</span>
              <span className="space-text">
                <strong>{assignee.name}</strong>
                <span>{task.stage === 4 ? 'Reported' : `About ${secondsLeft} s of work left`}</span>
              </span>
            </>
          ) : (
            <span className="space-text">
              <strong>Not assigned yet</strong>
              <span>The lead is planning it</span>
            </span>
          )}
        </button>
      </div>
    </section>
  );
}

function Lists({ space }) {
  const [tab, setTab] = useState('orglets');
  const waiting = space.approvals.filter((approval) => approval.status === 'waiting');
  const tabs = [
    ['orglets', `Orglets ${space.orglets.length}`],
    ['tasks', `Tasks ${space.tasks.filter((task) => task.stage < 4).length}`],
    ['approvals', `Approvals ${waiting.length}`],
  ];
  const isSelected = (type, id) => world.selection?.type === type && world.selection.id === id;
  let rows = [];
  if (tab === 'orglets') {
    rows = space.orglets.map((orglet) => ({
      key: orglet.id,
      selection: { type: 'orglet', id: orglet.id },
      status: orgletStatus(orglet),
      title: orglet.name,
      detail: orglet.lead ? 'Lead · planning' : phaseText(orglet, space),
      right: formatTokens(orglet.tokensToday),
    }));
  } else if (tab === 'tasks') {
    rows = space.tasks.slice(0, 8).map((task) => ({
      key: task.id,
      selection: { type: 'task', id: task.id },
      status: taskStatus(task),
      title: task.code,
      detail: task.title,
      right: `${Math.round(task.progress * 100)}%`,
    }));
  } else {
    rows = space.approvals.slice(0, 8).map((approval) => ({
      key: approval.id,
      selection: { type: 'approval', id: approval.id },
      status: approval.status === 'waiting' ? 'approval' : approval.status,
      title: approval.action,
      detail: `${space.orglets.find((orglet) => orglet.id === approval.orgletId)?.name} · ${approval.risk === 'high' ? 'risky' : 'low risk'}`,
      right: approval.status === 'waiting' ? 'Waiting' : approval.resolvedBy === 'auto' ? 'Auto' : approval.status === 'refused' ? 'Refused' : 'Allowed',
    }));
  }
  return (
    <section className="lists panel" aria-label="Lists">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <span className="muted tabs-space">{space.name}</span>
      </div>
      <ul className="rows">
        {rows.length === 0 && <li className="empty">Nothing here yet.</li>}
        {rows.map((row) => (
          <li key={row.key}>
            <button className={isSelected(row.selection.type, row.selection.id) ? 'is-selected' : ''} onClick={() => flyTo(row.selection)}>
              <StatusIcon status={row.status} />
              <strong>{row.title}</strong>
              <span className="row-detail">{row.detail}</span>
              <span className="row-right tabular">{row.right}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CameraButtons({ controlsRef }) {
  const controls = () => controlsRef.current;
  return (
    <div className="camera-buttons panel" role="toolbar" aria-label="Camera">
      <button aria-label="Zoom in" title="Zoom in" onClick={() => controls()?.dolly(5, true)}><PlusIcon /></button>
      <button aria-label="Zoom out" title="Zoom out" onClick={() => controls()?.dolly(-5, true)}><MinusIcon /></button>
      <button aria-label="Rotate" title="Rotate" onClick={() => controls()?.rotate(Math.PI / 4, 0, true)}><RotateIcon /></button>
      <button
        aria-label="Whole space"
        title="Whole space"
        onClick={() => lookAtOverview(controls(), true)}
      >
        <HomeIcon />
      </button>
    </div>
  );
}

export function App() {
  useWorldVersion();
  const controlsRef = useRef();
  const space = activeSpace(world);
  const selectionKey = world.selection ? `${world.selection.type}:${world.selection.id}` : '';
  return (
    <div
      className="app"
      onPointerDown={(event) => {
        window.__pointerStart = { x: event.clientX, y: event.clientY };
        window.__pointerTravel = 0;
      }}
      onPointerUp={(event) => {
        const start = window.__pointerStart ?? { x: event.clientX, y: event.clientY };
        window.__pointerTravel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      }}
    >
      <div className="stage">
        <Scene controlsRef={controlsRef} spaceId={space.id} selectionKey={selectionKey} />
      </div>
      <TopBar space={space} />
      <KpiCards space={space} />
      <DetailCard space={space} />
      <CameraButtons controlsRef={controlsRef} />
      <Timeline space={space} />
      <Lists space={space} />
    </div>
  );
}
