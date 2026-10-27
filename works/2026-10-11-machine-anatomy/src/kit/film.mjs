// The owner's approved film shape as configurable defaults (references/film.md), and the frame layouts
// of the three formats. A machine's film config overrides any of these; its `story(spec)` returns the
// timed actions, written against the phase times below so a retimed spec moves the story with it.

export const DEFAULT_FILM = {
  seconds: 30,
  fps: 30,
  // 0 to slow.from: already working at normal speed, no zoom frame, no step labels.
  // slow: one slow labelled run; the zoom frame is born as it reaches the part.
  slow: { from: 4.6, to: 12, speed: 0.3 },
  // From slow.to to apart.open: normal running with one contrast moment.
  // apart: the zoom frame fades, the assemblies leave one by one, hold, go back together.
  apart: { open: 19.6, close: 25 },
  stepsFade: { in: 0.3, out: 0.4 },
  posterAt: 15.7,
  minimum: { opening: 4.5, normal: 6, apartHold: 1.5 },
};

// Where things sit in each format. `figure` is the region the machine is fitted into (with `pad`),
// `zoom` the one magnified frame, `margin` how much room the apart pose keeps from the edges.
export const FORMATS = {
  "16:9": {
    width: 1920,
    height: 1080,
    figure: { x: -34, y: -64, width: 1920, height: 1080, pad: 122 },
    zoom: { x: 1466, y: 110, width: 372, height: 560, corner: 14 },
    margin: { x: 150, y: 250, lift: 50 },
    steps: { left: 44, top: 108, size: 25, width: 0 },
    trace: { bottom: 64, size: 30 },
    legend: { bottom: 44, columns: 3, size: 21 },
  },
  "9:16": {
    width: 1080,
    height: 1920,
    figure: { x: 0, y: 130, width: 1080, height: 1120, pad: 70 },
    zoom: { x: 652, y: 1250, width: 380, height: 440, corner: 14 },
    margin: { x: 90, y: 420, lift: -40 },
    steps: { left: 44, top: 1268, size: 25, width: 580 },
    trace: { bottom: 70, size: 30 },
    legend: { bottom: 110, columns: 2, size: 23 },
  },
  "1:1": {
    width: 1080,
    height: 1080,
    figure: { x: -40, y: -30, width: 860, height: 860, pad: 60 },
    zoom: { x: 790, y: 112, width: 250, height: 400, corner: 12 },
    margin: { x: 90, y: 260, lift: 40 },
    steps: { left: 36, top: 720, size: 18, width: 700 },
    trace: { bottom: 100, size: 22 },
    legend: { bottom: 110, columns: 3, size: 18 },
  },
};

export const FORMAT_ALIASES = { "16x9": "16:9", landscape: "16:9", "9x16": "9:16", portrait: "9:16", vertical: "9:16", square: "1:1", "1x1": "1:1" };

export function formatOf(name = "16:9") {
  const key = FORMAT_ALIASES[name] ?? name;
  const format = FORMATS[key];
  if (!format) throw new Error(`unknown format "${name}": use 16:9, 9:16 or square`);
  return { name: key, ...format };
}

export function formatSuffix(name) {
  const key = FORMAT_ALIASES[name] ?? name;
  return key === "16:9" ? "" : key === "9:16" ? "-vertical" : "-square";
}

export function filmSpecOf(machineFilm = {}) {
  return {
    ...DEFAULT_FILM,
    ...machineFilm,
    slow: { ...DEFAULT_FILM.slow, ...(machineFilm.slow ?? {}) },
    apart: { ...DEFAULT_FILM.apart, ...(machineFilm.apart ?? {}) },
    minimum: { ...DEFAULT_FILM.minimum, ...(machineFilm.minimum ?? {}) },
  };
}

function smooth(share) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

// The numbered steps show during the slow run, or during `spec.steps` ({ from, to }) when a machine sets it.
export function stepsAt(spec, time) {
  const window = spec.steps ?? spec.slow;
  const rising = smooth((time - (window.from - spec.stepsFade.in)) / spec.stepsFade.in);
  const falling = 1 - smooth((time - (window.to + 0.1)) / spec.stepsFade.out);
  return rising * falling;
}

// With `slow.ease` (seconds) the speed eases down into the slow run and back up out of it, so the
// viewer sees time slow; without it the change is a cut, as in the approved default.
export function speedAt(spec, time) {
  const { from, to, speed, ease = 0 } = spec.slow;
  if (time < from - 1e-9 || time >= to - 1e-9) return 1;
  if (!ease) return speed;
  const share = Math.min(smooth((time - from) / ease), smooth((to - time) / ease));
  return 1 + (speed - 1) * share;
}

// The "in-motion" variant: the machine is dissected while it keeps running, inside the slow run. In
// place of normal running between the slow run and the take-apart it checks that the whole take-apart
// happens at reduced speed with the machine working, and that normal speed follows it for long enough.
function inMotionProblems(spec, events, states) {
  const problems = [];
  const fps = spec.fps;
  const open = events.find((event) => event.name === "apart-open");
  const seated = events.find((event) => event.name === "apart-seated");
  if (!open || !seated) return ["the film never takes the machine apart and puts it back"];
  if (open.at < spec.slow.from || seated.at > spec.slow.to) problems.push(`the take-apart (${open.at.toFixed(2)} to ${seated.at.toFixed(2)} s) is not inside the slow run (${spec.slow.from} to ${spec.slow.to} s)`);
  const during = states.slice(Math.ceil(open.at * fps), Math.floor(seated.at * fps));
  if (during.some((state) => !state.working)) problems.push("the machine stops working while it is apart");
  if (during.some((state) => speedAt(spec, state.time ?? 0) >= 1)) problems.push("time is not slowed for the whole take-apart");
  const normal = spec.seconds - spec.slow.to;
  if (normal < spec.minimum.normal) problems.push(`normal speed after the dissection lasts ${normal.toFixed(1)} s, under ${spec.minimum.normal} s`);
  return problems;
}

// Checks a recording against the approved shape: returns the failures as plain sentences.
export function filmShapeProblems(spec, events, states) {
  const problems = [];
  const fps = spec.fps;
  const inMotion = spec.variant === "in-motion";
  if (inMotion) problems.push(...inMotionProblems(spec, events, states));
  const bornFrame = states.findIndex((state) => state.zoomAge >= 0);
  const bornAt = bornFrame / fps;
  if (bornFrame >= 0 && bornAt < spec.minimum.opening) problems.push(`the zoom frame is born at ${bornAt.toFixed(2)} s, before ${spec.minimum.opening} s of plain running`);
  const workingEarly = states.slice(0, Math.round(fps * 1.2)).some((state) => state.working);
  if (!workingEarly) problems.push("the machine is not working within the first 1.2 s");
  const normal = spec.apart.open - spec.slow.to;
  if (!inMotion && normal < spec.minimum.normal) problems.push(`normal running lasts ${normal.toFixed(1)} s, under ${spec.minimum.normal} s`);
  const hold = events.find((event) => event.name === "apart-hold");
  const close = events.find((event) => event.name === "apart-close");
  if (!hold || !close) problems.push("the film never holds apart and closes again");
  else if (close.at - hold.at < spec.minimum.apartHold) problems.push(`apart is held ${(close.at - hold.at).toFixed(2)} s, under ${spec.minimum.apartHold} s`);
  const last = states[states.length - 1];
  if (!last.working || last.open > 0.001) problems.push("the film does not end assembled and working");
  return problems;
}
