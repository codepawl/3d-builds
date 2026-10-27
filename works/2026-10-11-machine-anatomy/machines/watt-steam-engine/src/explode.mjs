// Pure model of the exploded view: which assemblies the engine comes apart into, where each one goes,
// the staggered springs that carry them, the painter's order of the items in any frame of the flight
// and a coarse check that no solid block passes through another on the way.
// No DOM in here; the build, the page and the audit all read this one file.
// Adapted from the Enigma figure (../enigma-anatomy/explode.mjs).

const SPRING = { stagger: 0.34, stiffness: 46, damping: 11.2, substeps: 4 };

// `move` is in world units (x along the beam towards the flywheel, y towards the viewer, z up).
// A piece with `ride` is carried by that piece's spring as well as its own: the piston leaves with the
// cylinder and then lifts out of it.
const PIECES = {
  beam: { number: 1, name: "Beam with Watt's parallel motion", move: [0, 0, 64] },
  piston: { number: 2, name: "Piston and piston rod", move: [0, 0, 56], ride: "cylinder" },
  cylinder: { number: 3, name: "Cylinder, cut open, on its pedestal", move: [0, 34, 0] },
  valves: { number: 4, name: "Valve chests, steam pipe, eduction pipe and plug rod", move: [26, 30, 0] },
  steam: { number: 5, name: "Steam pipe from the boiler, with the throttle valve", move: [-70, 0, 0] },
  condenser: { number: 6, name: "Separate condenser and air pump in the cold-water cistern", move: [16, 100, 0] },
  rod: { number: 7, name: "Connecting rod with the planet gear", move: [22, 0, 40] },
  flywheel: { number: 8, name: "Sun gear, shaft and flywheel", move: [50, 0, 0] },
  governor: { number: 9, name: "Centrifugal governor with its belt and throttle rod", move: [6, -70, 0] },
  base: { number: 10, name: "Bed, column and frame", move: [0, 0, 0] },
};

// Whoever is outside leaves first; closing runs the same list backwards.
const LEAVE_ORDER = ["governor", "condenser", "valves", "steam", "beam", "rod", "cylinder", "piston", "flywheel"];

const TOUCH = 0.6;
const SCREEN_GAP = 0.4;

function createExplode() {
  const shares = {};
  for (const name of LEAVE_ORDER) shares[name] = { x: 0, v: 0, target: 0, pending: null, landed: true, crossed: false };
  return { shares, apart: false, time: 0 };
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
      Object.assign(share, { x: target, v: 0, target, pending: null, landed: true, crossed: false });
      continue;
    }
    if (share.pending && share.pending.value !== target) share.pending = null;
    const heading = share.pending ? share.pending.value : share.target;
    if (heading === target) continue;
    share.pending = { value: target, at: state.time + index * SPRING.stagger };
    index += 1;
  }
}

function stepShare(state, name, dt, events) {
  const share = state.shares[name];
  if (share.pending && state.time >= share.pending.at - 1e-9) {
    share.target = share.pending.value;
    share.pending = null;
    share.landed = false;
    share.crossed = false;
    events.push({ name: share.target === 1 ? "leave" : "return", piece: name, at: state.time });
  }
  if (share.landed) return;
  const before = share.x - share.target;
  share.v += (SPRING.stiffness * (share.target - share.x) - SPRING.damping * share.v) * dt;
  share.x += share.v * dt;
  const after = share.x - share.target;
  if (!share.crossed && before * after <= 0) {
    share.crossed = true;
    events.push({ name: share.target === 1 ? "arrive" : "land", piece: name, at: state.time });
  }
  if (Math.abs(after) < 0.0005 && Math.abs(share.v) < 0.004) {
    share.x = share.target;
    share.v = 0;
    share.landed = true;
  }
}

// Advances every spring by `seconds` and returns what happened: leave, arrive, return, land.
function stepExplode(state, seconds) {
  const events = [];
  // Never a step longer than 1/120 s, so a long jump of the clock cannot shake the springs loose.
  const steps = Math.max(SPRING.substeps, Math.ceil(seconds * 120));
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
  return Math.max(...LEAVE_ORDER.map((name) => state.shares[name].x));
}

function shareOf(state, piece) {
  return piece === "base" ? 0 : state.shares[piece].x;
}

function displacementOf(state, piece) {
  const part = PIECES[piece];
  const own = shareOf(state, piece);
  const shift = [part.move[0] * own, part.move[1] * own, part.move[2] * own];
  // A carrier may itself be carried: the pin half rides on the right rotor, which rides on the spindle.
  if (part.ride) {
    const carried = displacementOf(state, part.ride);
    for (let axis = 0; axis < 3; axis++) shift[axis] += carried[axis];
  }
  return shift;
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

function movedBox(bounds, shift) {
  return [bounds[0] + shift[0], bounds[1] + shift[0], bounds[2] + shift[1], bounds[3] + shift[1], bounds[4] + shift[2], bounds[5] + shift[2]];
}

// The silhouette of an axis-aligned box in this camera is a hexagon whose edges run along the three
// projected axes, so two silhouettes overlap exactly when their extents overlap across each axis.
// `axes` holds the screen direction of world x, y and z.
function silhouetteOf(box, axes) {
  const bands = [];
  for (let across = 0; across < 3; across++) {
    const normal = [-axes[across][1], axes[across][0]];
    let low = 0;
    let high = 0;
    for (let axis = 0; axis < 3; axis++) {
      if (axis === across) continue;
      const weight = axes[axis][0] * normal[0] + axes[axis][1] * normal[1];
      const a = box[axis * 2] * weight;
      const b = box[axis * 2 + 1] * weight;
      low += Math.min(a, b);
      high += Math.max(a, b);
    }
    bands.push(low, high);
  }
  return bands;
}

function silhouettesOverlap(a, b) {
  for (let band = 0; band < 6; band += 2) {
    if (a[band] >= b[band + 1] - SCREEN_GAP || b[band] >= a[band + 1] - SCREEN_GAP) return false;
  }
  return true;
}

// Every axis points towards the viewer in this camera, so a box that ends before another begins,
// along any axis, is behind it wherever the two overlap on screen.
function endsBefore(a, b) {
  return a[1] <= b[0] + TOUCH || a[3] <= b[2] + TOUCH || a[5] <= b[4] + TOUCH;
}

// A rod that an assembly's path has to cross is declared on its item (`crosses`): no order is measured
// between the two. `crosses: "all"` is for a long thin rod that fades out as soon as the engine opens:
// it keeps its listed place against every other assembly.
function crossingDeclared(a, b) {
  if (a.crosses === "all" || b.crosses === "all") return a.piece !== b.piece;
  return a.crosses === b.piece || b.crosses === a.piece;
}

function sameShift(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-6;
}

// The painter's order of the items for one set of shifts. Items keep their hand-set rank unless two
// that have moved relative to each other overlap on screen with one measurably behind the other.
function paintOrder(items, shifts, axes) {
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
      let back = first;
      let front = second;
      const moved = !sameShift(shifts[items[first].piece], shifts[items[second].piece]);
      if (moved) {
        const firstBehind = endsBefore(boxes[first], boxes[second]);
        const secondBehind = endsBefore(boxes[second], boxes[first]);
        // Apart along two axes the other way round, the two only overlap as boxes, not as shapes.
        if (firstBehind && secondBehind) continue;
        if (secondBehind) {
          back = second;
          front = first;
        }
      }
      followers[back].push(front);
      blockers[front].push(back);
      waiting[front] += 1;
    }
  }
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
  // Items without a box (the flow lines) are drawn through everything else, so they are painted last.
  const boxed = order.filter((index) => boxes[index]);
  const loose = order.filter((index) => !boxes[index]);
  return { order: boxed.concat(loose), cycles, loop };
}

// The assembled order, measured: every pair that overlaps on screen is ordered by depth, and pairs
// that cannot be told apart keep the order they were listed in. The build paints the items in this order.
function restOrder(items, axes) {
  const still = {};
  for (const name of Object.keys(PIECES)) still[name] = [0, 0, 0];
  const measured = items.map((item, index) => ({ ...item, piece: `measure-${index}` }));
  const shifts = {};
  measured.forEach((item, index) => {
    shifts[item.piece] = index === 0 ? [0, 0, 0] : [0, 0, 1e-3 * index];
  });
  return paintOrder(measured, shifts, axes);
}

// One ring of items that each wait for the next, found by walking back through what blocks them.
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

// Pairs of different assemblies the hand-set order draws the wrong way round at rest: each would pop
// in the first frame of the flight.
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

function depthInside(a, b) {
  const x = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  const y = Math.min(a[3], b[3]) - Math.max(a[2], b[2]);
  const z = Math.min(a[5], b[5]) - Math.max(a[4], b[4]);
  return Math.min(x, y, z);
}

// How deep each pair of solid blocks from different assemblies sits inside each other for these shifts.
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

// Plays a list of commands [{ at, apart }] at 60 frames a second until every spring has landed,
// calling visit(state, seconds) once per frame.
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

// The audit the build runs with --audit: the hand-set order against measured depth at rest, order
// cycles and block pass-through in every frame of the springs, opening, closing and reversing at
// every stagger boundary.
function auditExplode(items, axes) {
  const contradictions = restContradictions(items, axes);
  const atRest = blockDepths(items, shiftsOf(createExplode()));
  const through = new Map();
  let frames = 0;
  let cycles = 0;
  let worstCycle = "";
  const loops = new Map();
  for (const flight of flights()) {
    replay(flight.commands, (state, seconds) => {
      frames += 1;
      const shifts = shiftsOf(state);
      const painted = paintOrder(items, shifts, axes);
      if (painted.cycles > 0) {
        cycles += 1;
        worstCycle = `${flight.label} at ${seconds.toFixed(3)} s`;
        const ring = painted.loop.map((index) => items[index].label).sort().join(" | ");
        loops.set(ring, (loops.get(ring) ?? 0) + 1);
      }
      for (const [pair, depth] of blockDepths(items, shifts)) {
        const allowed = (atRest.get(pair) ?? 0) + TOUCH;
        if (depth <= allowed) continue;
        const known = through.get(pair);
        if (!known || depth > known.depth) through.set(pair, { depth, where: `${flight.label} at ${seconds.toFixed(3)} s` });
      }
    });
  }
  const apart = blockDepths(items, fullShifts());
  const sunkApart = Array.from(apart).filter(([pair, depth]) => depth > (atRest.get(pair) ?? 0) + TOUCH);
  return { contradictions, through, sunkApart, cycles, worstCycle, loops, frames, flights: flights().length };
}

export const ExplodeApi = {
  SPRING,
  PIECES,
  LEAVE_ORDER,
  createExplode,
  setApart,
  stepExplode,
  isResting,
  maxShare,
  shareOf,
  displacementOf,
  shiftsOf,
  fullShifts,
  movedBox,
  paintOrder,
  restOrder,
  auditExplode,
};
