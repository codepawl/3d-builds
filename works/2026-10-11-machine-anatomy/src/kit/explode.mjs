// The exploded view, for any machine: which assemblies it comes apart into, where each one goes along its
// real removal axis, the staggered springs that carry them, the painter's order of the items in any frame
// of the flight and a coarse check that no solid block passes through another on the way. No DOM.
// Adapted from the Edison and Enigma figures; the order and pass-through audit is theirs unchanged.
import { createSpring, setSpringTarget, stepSpring, unitVector } from "./motion.mjs";

export const DEFAULT_SPRING = { stagger: 0.22, stiffness: 46, damping: 11.2 };
const TOUCH = 0.6;
const SCREEN_GAP = 0.4;

// `pieces`: { name: { number, name, axis: [x, y, z], distance, ride? } } or `move: [x, y, z]` instead of
// axis and distance. Pieces missing from `leaveOrder` stay where they are (the base everything leaves).
export function createExplodeKit({ pieces, leaveOrder, spring = {} }) {
  const SPRING = { ...DEFAULT_SPRING, ...spring };
  const PIECES = {};
  for (const [name, piece] of Object.entries(pieces)) {
    const move = piece.move ?? unitVector(piece.axis).map((component) => component * piece.distance);
    PIECES[name] = { ...piece, move };
  }
  const LEAVE_ORDER = leaveOrder.slice();

  function createExplode() {
    const shares = {};
    for (const name of LEAVE_ORDER) shares[name] = { spring: createSpring(SPRING), pending: null, landed: true, crossed: false };
    return { shares, apart: false, time: 0 };
  }

  function valueOf(share) {
    return share.spring.value;
  }

  function settle(share, target) {
    Object.assign(share.spring, { value: target, velocity: 0, target, settled: true });
    Object.assign(share, { pending: null, landed: true, crossed: false });
  }

  // Reschedules only the assemblies whose target changes: one that has not left yet simply stays.
  function setApart(state, apart, calm) {
    state.apart = apart;
    const target = apart ? 1 : 0;
    const order = apart ? LEAVE_ORDER : LEAVE_ORDER.slice().reverse();
    let index = 0;
    for (const name of order) {
      const share = state.shares[name];
      if (calm) {
        settle(share, target);
        continue;
      }
      if (share.pending && share.pending.value !== target) share.pending = null;
      const heading = share.pending ? share.pending.value : share.spring.target;
      if (heading === target) continue;
      share.pending = { value: target, at: state.time + index * SPRING.stagger };
      index += 1;
    }
  }

  function startPending(state, name, share, events) {
    setSpringTarget(share.spring, share.pending.value);
    share.pending = null;
    share.landed = false;
    share.crossed = false;
    events.push({ name: share.spring.target === 1 ? "leave" : "return", piece: name, at: state.time });
  }

  function stepShare(state, name, dt, events) {
    const share = state.shares[name];
    if (share.pending && state.time >= share.pending.at - 1e-9) startPending(state, name, share, events);
    if (share.landed) return;
    const before = valueOf(share) - share.spring.target;
    stepSpring(share.spring, dt);
    const after = valueOf(share) - share.spring.target;
    if (!share.crossed && before * after <= 0) {
      share.crossed = true;
      events.push({ name: share.spring.target === 1 ? "arrive" : "land", piece: name, at: state.time });
    }
    if (share.spring.settled) share.landed = true;
  }

  // Advances every spring by `seconds` and returns what happened: leave, arrive, return, land.
  function stepExplode(state, seconds) {
    const events = [];
    const steps = Math.max(4, Math.ceil(seconds * 120));
    const dt = seconds / steps;
    for (let step = 0; step < steps; step++) {
      state.time += dt;
      for (const name of LEAVE_ORDER) stepShare(state, name, dt, events);
    }
    return events;
  }

  function isResting(state) {
    return LEAVE_ORDER.every((name) => state.shares[name].landed && !state.shares[name].pending);
  }

  function maxShare(state) {
    return Math.max(...LEAVE_ORDER.map((name) => valueOf(state.shares[name])));
  }

  function leastShare(state) {
    return Math.min(...LEAVE_ORDER.map((name) => valueOf(state.shares[name])));
  }

  function shareOf(state, piece) {
    const share = state.shares[piece];
    return share ? valueOf(share) : 0;
  }

  function isFixed(piece) {
    return !LEAVE_ORDER.includes(piece);
  }

  function displacementOf(state, piece) {
    const part = PIECES[piece];
    const own = shareOf(state, piece);
    const shift = part.move.map((component) => component * own);
    if (!part.ride) return shift;
    const carried = displacementOf(state, part.ride);
    return shift.map((component, axis) => component + carried[axis]);
  }

  function shiftsOf(state) {
    const shifts = {};
    for (const name of Object.keys(PIECES)) shifts[name] = displacementOf(state, name);
    return shifts;
  }

  function fullShifts() {
    const state = createExplode();
    setApart(state, true, true);
    return shiftsOf(state);
  }

  // Plays a list of commands [{ at, apart }] at 60 frames a second until every spring has landed.
  function replay(commands, visit) {
    const state = createExplode();
    const frame = 1 / 60;
    let next = 0;
    for (let step = 0; step < 60 * 40; step++) {
      const now = step * frame;
      while (next < commands.length && commands[next].at <= now + 1e-9) {
        setApart(state, commands[next].apart, false);
        next += 1;
      }
      stepExplode(state, frame);
      visit(state, now + frame);
      if (next >= commands.length && isResting(state)) return;
    }
  }

  function flights() {
    const settled = SPRING.stagger * LEAVE_ORDER.length + 3;
    const list = [{ label: "opening and closing", commands: [{ at: 0, apart: true }, { at: settled, apart: false }] }];
    for (let boundary = 1; boundary <= LEAVE_ORDER.length; boundary++) {
      for (const side of [-0.008, 0.008]) {
        const at = boundary * SPRING.stagger + side;
        list.push({ label: `reversal at ${at.toFixed(3)} s`, commands: [{ at: 0, apart: true }, { at, apart: false }] });
        list.push({ label: `re-opening at ${at.toFixed(3)} s`, commands: [{ at: 0, apart: true }, { at: settled, apart: false }, { at: settled + at, apart: true }] });
      }
    }
    return list;
  }

  function restOrder(items, axes) {
    const measured = items.map((item, index) => ({ ...item, piece: `measure-${index}` }));
    const shifts = {};
    measured.forEach((item, index) => {
      shifts[item.piece] = index === 0 ? [0, 0, 0] : [0, 0, 1e-3 * index];
    });
    return paintOrder(measured, shifts, axes);
  }

  // The audit the build runs with --audit: hand-set order against measured depth at rest, order cycles
  // and block pass-through in every frame of the springs, opening, closing and reversing at every stagger.
  function auditExplode(items, axes) {
    const contradictions = restContradictions(items, axes);
    const atRest = blockDepths(items, shiftsOf(createExplode()));
    const through = new Map();
    const loops = new Map();
    const tally = { frames: 0, cycles: 0, worstCycle: "" };
    for (const flight of flights()) {
      replay(flight.commands, (state, seconds) => auditFrame(items, axes, shiftsOf(state), `${flight.label} at ${seconds.toFixed(3)} s`, { atRest, through, loops, tally }));
    }
    const apart = blockDepths(items, fullShifts());
    const sunkApart = Array.from(apart).filter(([pair, depth]) => depth > (atRest.get(pair) ?? 0) + TOUCH);
    return { contradictions, through, sunkApart, cycles: tally.cycles, worstCycle: tally.worstCycle, loops, frames: tally.frames, flights: flights().length };
  }

  return { SPRING, PIECES, LEAVE_ORDER, createExplode, setApart, stepExplode, isResting, maxShare, leastShare, shareOf, isFixed, displacementOf, shiftsOf, fullShifts, movedBox, paintOrder, restOrder, auditExplode, replay };
}

function auditFrame(items, axes, shifts, where, record) {
  record.tally.frames += 1;
  const painted = paintOrder(items, shifts, axes);
  if (painted.cycles > 0) {
    record.tally.cycles += 1;
    record.tally.worstCycle = where;
    const ring = painted.loop.map((index) => items[index].label).sort().join(" | ");
    record.loops.set(ring, (record.loops.get(ring) ?? 0) + 1);
  }
  for (const [pair, depth] of blockDepths(items, shifts)) {
    const allowed = (record.atRest.get(pair) ?? 0) + TOUCH;
    if (depth <= allowed) continue;
    const known = record.through.get(pair);
    if (!known || depth > known.depth) record.through.set(pair, { depth, where });
  }
}

export function movedBox(bounds, shift) {
  return [bounds[0] + shift[0], bounds[1] + shift[0], bounds[2] + shift[1], bounds[3] + shift[1], bounds[4] + shift[2], bounds[5] + shift[2]];
}

// The silhouette of an axis-aligned box in this camera is a hexagon whose edges run along the three
// projected axes, so two silhouettes overlap exactly when their extents overlap across each axis.
function silhouetteOf(box, axes) {
  const bands = [];
  for (let across = 0; across < 3; across++) {
    const normal = [-axes[across][1], axes[across][0]];
    let low = 0;
    let high = 0;
    for (let axis = 0; axis < 3; axis++) {
      if (axis === across) continue;
      const weight = axes[axis][0] * normal[0] + axes[axis][1] * normal[1];
      const first = box[axis * 2] * weight;
      const second = box[axis * 2 + 1] * weight;
      low += Math.min(first, second);
      high += Math.max(first, second);
    }
    bands.push(low, high);
  }
  return bands;
}

function silhouettesOverlap(first, second) {
  for (let band = 0; band < 6; band += 2) {
    if (first[band] >= second[band + 1] - SCREEN_GAP || second[band] >= first[band + 1] - SCREEN_GAP) return false;
  }
  return true;
}

// Every axis points towards the viewer in this camera, so a box that ends before another begins, along
// any axis, is behind it wherever the two overlap on screen.
function endsBefore(first, second) {
  return first[1] <= second[0] + TOUCH || first[3] <= second[2] + TOUCH || first[5] <= second[4] + TOUCH;
}

function crossingDeclared(first, second) {
  return first.crosses === second.piece || second.crosses === first.piece;
}

function sameShift(first, second) {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) + Math.abs(first[2] - second[2]) < 1e-6;
}

function orderedPair(items, boxes, shifts, first, second) {
  const moved = !sameShift(shifts[items[first].piece], shifts[items[second].piece]);
  if (!moved) return [first, second];
  const firstBehind = endsBefore(boxes[first], boxes[second]);
  const secondBehind = endsBefore(boxes[second], boxes[first]);
  // Apart along two axes the other way round, the two only overlap as boxes, not as shapes.
  if (firstBehind && secondBehind) return null;
  return secondBehind ? [second, first] : [first, second];
}

// The painter's order of the items for one set of shifts. Items keep their listed rank unless two that
// have moved relative to each other overlap on screen with one measurably behind the other.
export function paintOrder(items, shifts, axes) {
  const count = items.length;
  const boxes = items.map((item) => (item.bounds ? movedBox(item.bounds, shifts[item.piece]) : null));
  const outlines = boxes.map((box) => (box ? silhouetteOf(box, axes) : null));
  const followers = items.map(() => []);
  const blockers = items.map(() => []);
  const waiting = new Array(count).fill(0);
  for (let first = 0; first < count; first++) {
    if (!boxes[first]) continue;
    for (let second = first + 1; second < count; second++) {
      if (!boxes[second] || crossingDeclared(items[first], items[second])) continue;
      if (!silhouettesOverlap(outlines[first], outlines[second])) continue;
      const pair = orderedPair(items, boxes, shifts, first, second);
      if (!pair) continue;
      followers[pair[0]].push(pair[1]);
      blockers[pair[1]].push(pair[0]);
      waiting[pair[1]] += 1;
    }
  }
  return sortByWaiting(count, followers, blockers, waiting);
}

function sortByWaiting(count, followers, blockers, waiting) {
  const order = [];
  const placed = new Array(count).fill(false);
  let cycles = 0;
  let loop = null;
  for (let step = 0; step < count; step++) {
    let pick = -1;
    for (let index = 0; index < count && pick < 0; index++) {
      if (!placed[index] && waiting[index] === 0) pick = index;
    }
    if (pick < 0) {
      cycles += 1;
      pick = placed.indexOf(false);
      if (!loop) loop = loopFrom(pick, blockers, placed);
    }
    placed[pick] = true;
    order.push(pick);
    for (const next of followers[pick]) waiting[next] -= 1;
  }
  return { order, cycles, loop };
}

function loopFrom(start, blockers, placed) {
  const seen = [];
  let node = start;
  while (!seen.includes(node)) {
    seen.push(node);
    const blocker = blockers[node].find((index) => !placed[index]);
    if (blocker === undefined) return seen;
    node = blocker;
  }
  return seen.slice(seen.indexOf(node));
}

function restContradictions(items, axes) {
  const found = [];
  const outlines = items.map((item) => (item.bounds ? silhouetteOf(item.bounds, axes) : null));
  for (let first = 0; first < items.length; first++) {
    for (let second = first + 1; second < items.length; second++) {
      const a = items[first];
      const b = items[second];
      if (!a.bounds || !b.bounds || a.piece === b.piece || crossingDeclared(a, b)) continue;
      if (!silhouettesOverlap(outlines[first], outlines[second])) continue;
      if (endsBefore(b.bounds, a.bounds) && !endsBefore(a.bounds, b.bounds)) found.push(`${a.label} is drawn before ${b.label} but is in front of it`);
    }
  }
  return found;
}

function depthInside(first, second) {
  const x = Math.min(first[1], second[1]) - Math.max(first[0], second[0]);
  const y = Math.min(first[3], second[3]) - Math.max(first[2], second[2]);
  const z = Math.min(first[5], second[5]) - Math.max(first[4], second[4]);
  return Math.min(x, y, z);
}

function blockDepths(items, shifts) {
  const depths = new Map();
  const blocks = items.filter((item) => item.block && item.bounds);
  for (let first = 0; first < blocks.length; first++) {
    for (let second = first + 1; second < blocks.length; second++) {
      const a = blocks[first];
      const b = blocks[second];
      if (a.piece === b.piece) continue;
      const depth = depthInside(movedBox(a.bounds, shifts[a.piece]), movedBox(b.bounds, shifts[b.piece]));
      if (depth > 0) depths.set(`${a.label} × ${b.label}`, depth);
    }
  }
  return depths;
}
