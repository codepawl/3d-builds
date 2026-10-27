import { API_RUNTIMES, findRoom, pickHeldAction, pickTool } from './world.js';

const WALK_SPEED = 1.7;
const PLAN_SECONDS = 2.2;
const PICKUP_SECONDS = 1.2;
const REPORT_SECONDS = 2.4;
const MAX_KEPT_TASKS = 14;
const API_DOLLARS_PER_TOKEN = 3 / 1_000_000;

function logEvent(space, time, text, icon) {
  space.events.unshift({ time, text, icon });
  space.events.length = Math.min(space.events.length, 30);
}

function addOrgletLog(orglet, time, text) {
  orglet.log.unshift({ time, text });
  orglet.log.length = Math.min(orglet.log.length, 6);
}

function releaseSlot(orglet) {
  if (orglet.slot && orglet.slot.taken === orglet.id) {
    orglet.slot.taken = null;
  }
  orglet.slot = null;
}

function claimSlot(space, spaceRoom, orglet) {
  const freeSlots = spaceRoom.slots.filter((slot) => !slot.taken);
  if (freeSlots.length === 0) {
    // Room is full: stand near the door instead of on top of someone.
    const offset = (space.random() - 0.5) * (spaceRoom.width - 2);
    return { x: spaceRoom.x + offset, z: spaceRoom.doorZ + (spaceRoom.row === 'back' ? -1.4 : 1.4), facing: 0, taken: null };
  }
  const slot = freeSlots[Math.floor(space.random() * freeSlots.length)];
  slot.taken = orglet.id;
  return slot;
}

// Paths leave the current room by its door, follow the corridor and enter the target room by its door.
function walkTo(space, orglet, roomId) {
  const fromRoom = orglet.roomId ? findRoom(space, orglet.roomId) : null;
  const toRoom = findRoom(space, roomId);
  releaseSlot(orglet);
  const slot = claimSlot(space, toRoom, orglet);
  orglet.slot = slot.taken ? slot : null;
  const lane = (space.random() - 0.5) * 1.6;
  const path = [];
  if (fromRoom && fromRoom.id !== toRoom.id) {
    path.push({ x: orglet.position.x, z: fromRoom.doorZ });
    path.push({ x: orglet.position.x, z: lane });
  }
  if (!fromRoom || fromRoom.id !== toRoom.id) {
    path.push({ x: toRoom.x + lane, z: lane });
    path.push({ x: toRoom.x + lane, z: toRoom.doorZ });
  }
  path.push({ x: slot.x, z: slot.z });
  orglet.path = path;
  orglet.roomId = toRoom.id;
  orglet.facing = slot.facing;
}

function stepAlongPath(orglet, deltaSeconds) {
  let remaining = WALK_SPEED * deltaSeconds;
  while (remaining > 0 && orglet.path.length > 0) {
    const target = orglet.path[0];
    const deltaX = target.x - orglet.position.x;
    const deltaZ = target.z - orglet.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance < 1e-4) {
      orglet.path.shift();
      continue;
    }
    orglet.heading = Math.atan2(deltaX, deltaZ);
    const step = Math.min(remaining, distance);
    orglet.position.x += (deltaX / distance) * step;
    orglet.position.z += (deltaZ / distance) * step;
    remaining -= step;
    if (step >= distance) {
      orglet.path.shift();
    }
  }
  return orglet.path.length === 0;
}

function setStage(task, stageIndex, time) {
  task.stage = stageIndex;
  task.stageTimes[stageIndex] = time;
}

function spawnTask(space, time, fromRoutine) {
  const [kind, title, channel] = space.taskTemplates[space.nextTemplate % space.taskTemplates.length];
  space.nextTemplate += 1;
  const task = {
    id: `${space.id}-task-${space.nextTaskNumber}`,
    type: 'task',
    code: `T-${space.nextTaskNumber}`,
    title: fromRoutine ? `Routine · ${title}` : title,
    kind,
    channel,
    stage: 0,
    stageTimes: [time, null, null, null, null],
    assigneeId: null,
    progress: 0,
    durationSeconds: 14 + space.random() * 10,
    needsApproval: space.random() < 0.65,
    approvalId: null,
    blocked: false,
    createdAt: time,
  };
  space.nextTaskNumber += 1;
  space.tasks.unshift(task);
  const keptOpen = space.tasks.filter((candidate) => candidate.stage < 4);
  const keptDone = space.tasks.filter((candidate) => candidate.stage === 4).slice(0, Math.max(0, MAX_KEPT_TASKS - keptOpen.length));
  space.tasks = space.tasks.filter((candidate) => keptOpen.includes(candidate) || keptDone.includes(candidate));
  logEvent(space, time, `${task.code} arrived in ${channel}`, 'arrive');
  return task;
}

function createApproval(space, orglet, task, time) {
  const held = pickHeldAction(space, task.kind);
  const approval = {
    id: `${space.id}-approval-${space.nextApprovalNumber}`,
    type: 'approval',
    code: `A-${space.nextApprovalNumber}`,
    action: held.action,
    risk: held.risk,
    orgletId: orglet.id,
    taskId: task.id,
    status: 'waiting',
    createdAt: time,
    // Auto mode settles low-risk actions; a risky one waits for the person.
    settleAt: time + (held.risk === 'low' ? 3 + space.random() * 2 : 15 + space.random() * 10),
    resolvedBy: null,
  };
  space.nextApprovalNumber += 1;
  space.approvals.unshift(approval);
  space.approvals.length = Math.min(space.approvals.length, 12);
  task.approvalId = approval.id;
  task.isHeld = true;
  setStage(task, 3, time);
  logEvent(space, time, `${orglet.name} is holding “${held.action}”`, 'held');
  return approval;
}

export function resolveApproval(space, approvalId, decision, time) {
  const approval = space.approvals.find((candidate) => candidate.id === approvalId);
  if (!approval || approval.status !== 'waiting') {
    return;
  }
  approval.status = decision === 'refuse' ? 'refused' : 'allowed';
  approval.resolvedBy = decision;
  approval.resolvedAt = time;
  const heldTask = space.tasks.find((candidate) => candidate.id === approval.taskId);
  if (heldTask) {
    heldTask.isHeld = false;
  }
  const orglet = space.orglets.find((candidate) => candidate.id === approval.orgletId);
  const labels = { auto: 'Auto mode allowed', once: 'Allowed once', always: 'Always allowed this tool', refuse: 'Refused' };
  logEvent(space, time, `${labels[decision]}: ${approval.action}`, decision === 'refuse' ? 'refused' : 'allowed');
  if (orglet) {
    addOrgletLog(orglet, time, `${labels[decision]} · ${approval.action}`);
  }
}

function addTokens(space, orglet, tokens) {
  orglet.tokensToday += Math.round(tokens);
  if (API_RUNTIMES.has(orglet.runtime)) {
    space.apiSpendDollars += tokens * API_DOLLARS_PER_TOKEN;
  }
}

function stepOrglet(space, orglet, deltaSeconds, time) {
  orglet.timer -= deltaSeconds;
  const task = orglet.taskId ? space.tasks.find((candidate) => candidate.id === orglet.taskId) : null;

  if (orglet.lead) {
    addTokens(space, orglet, deltaSeconds * 55);
    const waiting = space.tasks.find((candidate) => candidate.stage === 0 && time - candidate.createdAt > PLAN_SECONDS);
    if (waiting) {
      setStage(waiting, 1, time);
      addOrgletLog(orglet, time, `Planned ${waiting.code} and split the work`);
    }
    return;
  }

  switch (orglet.phase) {
    case 'idle': {
      if (orglet.timer > 0) {
        return;
      }
      const next = space.tasks
        .filter((candidate) => candidate.stage === 1 && !candidate.assigneeId)
        .sort((first, second) => first.createdAt - second.createdAt)[0];
      if (next) {
        next.assigneeId = orglet.id;
        orglet.taskId = next.id;
        orglet.phase = 'toLead';
        orglet.tool = null;
        walkTo(space, orglet, 'lead');
        addOrgletLog(orglet, time, `Took ${next.code} from the lead`);
      }
      return;
    }
    case 'toLead':
      if (stepAlongPath(orglet, deltaSeconds)) {
        orglet.phase = 'pickup';
        orglet.timer = PICKUP_SECONDS;
      }
      return;
    case 'pickup':
      if (orglet.timer <= 0 && task) {
        orglet.phase = 'toWork';
        walkTo(space, orglet, task.kind);
      }
      return;
    case 'toWork':
      if (stepAlongPath(orglet, deltaSeconds) && task) {
        orglet.phase = 'working';
        orglet.tool = pickTool(space, task.kind);
        if (task.stage < 2) {
          setStage(task, 2, time);
        }
        addOrgletLog(orglet, time, orglet.tool);
      }
      return;
    case 'working': {
      if (!task) {
        orglet.phase = 'idle';
        return;
      }
      task.progress = Math.min(1, task.progress + deltaSeconds / task.durationSeconds);
      addTokens(space, orglet, deltaSeconds * (180 + 60 * Math.sin(time * 0.7 + orglet.walkCycle)));
      if (task.needsApproval && !task.approvalId && task.progress > 0.45) {
        createApproval(space, orglet, task, time);
        orglet.phase = 'toApproval';
        orglet.tool = 'Held action · waiting';
        walkTo(space, orglet, 'approvals');
        return;
      }
      if (task.progress >= 1) {
        orglet.phase = 'toReview';
        orglet.tool = task.kind === 'code' ? 'Diff ready for review' : 'Writing the report';
        walkTo(space, orglet, 'review');
      }
      return;
    }
    case 'toApproval':
      if (stepAlongPath(orglet, deltaSeconds)) {
        orglet.phase = 'waiting';
      }
      return;
    case 'waiting': {
      const approval = space.approvals.find((candidate) => candidate.id === task?.approvalId);
      if (approval && approval.status === 'waiting' && time >= approval.settleAt) {
        resolveApproval(space, approval.id, approval.risk === 'low' ? 'auto' : 'once', time);
      }
      if (!approval || approval.status !== 'waiting') {
        if (approval?.status === 'refused') {
          task.blocked = true;
          task.progress = 1;
        } else {
          // Stays at the Approval stage while it finishes the work.
        }
        orglet.phase = 'toWork';
        orglet.tool = 'Back to work';
        walkTo(space, orglet, task.blocked ? 'review' : task.kind);
        if (task.blocked) {
          orglet.phase = 'toReview';
          orglet.tool = 'Reporting a blocker';
        }
      }
      return;
    }
    case 'toReview':
      if (stepAlongPath(orglet, deltaSeconds)) {
        orglet.phase = 'reporting';
        orglet.timer = REPORT_SECONDS;
      }
      return;
    case 'reporting':
      if (orglet.timer <= 0 && task) {
        setStage(task, 4, time);
        space.reportedToday += 1;
        orglet.tasksDone += 1;
        orglet.taskId = null;
        orglet.tool = null;
        orglet.phase = 'idle';
        orglet.timer = 1.5 + space.random() * 2;
        addOrgletLog(orglet, time, task.blocked ? `Reported ${task.code} as blocked` : `Reported ${task.code}`);
        logEvent(space, time, `${orglet.name} reported ${task.code}`, task.blocked ? 'blocked' : 'done');
      }
      return;
    default:
      return;
  }
}

export function stepSpace(space, deltaSeconds, time) {
  space.spawnTimer -= deltaSeconds;
  space.routineTimer -= deltaSeconds;
  const queued = space.tasks.filter((task) => task.stage < 2 && !task.assigneeId).length;
  if (space.spawnTimer <= 0 && queued < 4) {
    spawnTask(space, time, false);
    space.spawnTimer = 3 + space.random() * 3;
  }
  if (space.routineTimer <= 0) {
    spawnTask(space, time, true);
    space.routineTimer = 32 + space.random() * 12;
    space.routineFiredAt = time;
  }
  for (const orglet of space.orglets) {
    stepOrglet(space, orglet, deltaSeconds, time);
  }
}

export function stepWorld(world, deltaSeconds) {
  const clamped = Math.min(deltaSeconds, 0.1);
  world.time += clamped;
  for (const space of world.spaces) {
    stepSpace(space, clamped, world.time);
  }
}

export function orgletStatus(orglet) {
  if (orglet.lead) {
    return 'planning';
  }
  if (orglet.phase === 'waiting' || orglet.phase === 'toApproval') {
    return 'waiting';
  }
  if (orglet.phase === 'working' || orglet.phase === 'reporting') {
    return 'working';
  }
  if (orglet.phase === 'idle') {
    return 'idle';
  }
  return 'walking';
}
