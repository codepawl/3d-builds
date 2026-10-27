// The film. renderAt(seconds) is pure: it draws one frame from the precomputed data/.
import { BIKE, GEAR_RATIO, LEG, PART } from "./pelican.mjs";
import { FPS, crankAngleAt, posePoints } from "./pose.mjs";
import { seededRandom } from "./tsp.mjs";
import { DOTS_START, DURATION, PEN_END, PEN_START, PHASE, RIDE_START, STAGES, phaseTime } from "./timeline.mjs";
import { buildPenPlan } from "./penplan.mjs";

const WIDTH = 1920;
const HEIGHT = 1080;
const PIVOT = { x: 960, y: 420 };
const CYAN = "#8fe9ff";
const GOLD = "#ffc861";
const SERIF = "Cambria, 'Cambria Math', 'Times New Roman', serif";
const DOT_RADIUS = [5, 3.6, 2.5, 1.7, 1.15];
const LINE_WIDTH = [2.6, 2.2, 1.8, 1.4, 1.05];

const canvas = document.getElementById("film");
const context = canvas.getContext("2d");
const makeLayer = () => {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  return layer;
};
const cyanLayer = makeLayer();
const goldLayer = makeLayer();

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const formatLength = (length) => `${(length / 1000).toFixed(1)} k px`;
const formatCount = (value) => value.toLocaleString("en-US");

// ---------- data ----------
const fetchBinary = async (name, ArrayType) => new ArrayType(await (await fetch(`data/${name}`)).arrayBuffer());
const meta = await (await fetch("data/meta.json")).json();
const stages = [];
for (const [index, stageMeta] of meta.stages.entries()) {
  const lloyd = await fetchBinary(`stage${index}_lloyd.bin`, Float32Array);
  const tours = await fetchBinary(`stage${index}_tours.bin`, Uint16Array);
  const count = stageMeta.count;
  stages.push({
    ...stageMeta,
    timing: STAGES[index],
    lloydPoints: stageMeta.lloydIterations.map((_, snapshot) => lloyd.subarray(snapshot * count * 2, (snapshot + 1) * count * 2)),
    tours: stageMeta.snapshots.map((_, snapshot) => tours.subarray(snapshot * count, (snapshot + 1) * count)),
  });
}
const finalStage = stages[stages.length - 1];
const restPoints = finalStage.lloydPoints[finalStage.lloydPoints.length - 1];
const finalTour = finalStage.tours[finalStage.tours.length - 1];
const finalLength = finalStage.snapshots[finalStage.snapshots.length - 1].length;
const labels = await fetchBinary("labels.bin", Uint8Array);
const rideTourData = await fetchBinary("ride_tours.bin", Uint16Array);
const rideTour = (frame) => rideTourData.subarray(frame * finalStage.count, (frame + 1) * finalStage.count);


const stars = (() => {
  const random = seededRandom(42);
  return Array.from({ length: 420 }, () => ({
    x: random() * WIDTH, y: random() * HEIGHT, size: 0.4 + random() * 1.3,
    depth: 0.2 + random(), phase: random() * Math.PI * 2, speed: 0.4 + random() * 1.6,
  }));
})();

// ---------- camera and projection ----------
// A plane rotated in 3D and seen in perspective: a projective map, so it keeps straight
// segments straight and cannot create crossings.
function makeProjection(zoom, yawDegrees, pitchDegrees) {
  const yaw = (yawDegrees * Math.PI) / 180;
  const pitch = (pitchDegrees * Math.PI) / 180;
  const focal = 2200;
  return (x, y) => {
    const offsetX = (x - PIVOT.x) * zoom;
    const offsetY = (y - PIVOT.y) * zoom;
    const rotatedX = offsetX * Math.cos(yaw);
    const depthAfterYaw = offsetX * Math.sin(yaw);
    const rotatedY = offsetY * Math.cos(pitch) - depthAfterYaw * Math.sin(pitch);
    const depth = offsetY * Math.sin(pitch) + depthAfterYaw * Math.cos(pitch);
    const perspective = focal / (focal + depth);
    return [PIVOT.x + rotatedX * perspective, PIVOT.y + rotatedY * perspective];
  };
}

function projectAll(points, project) {
  const projected = new Float32Array(points.length);
  for (let index = 0; index < points.length; index += 2) {
    const [x, y] = project(points[index], points[index + 1]);
    projected[index] = x;
    projected[index + 1] = y;
  }
  return projected;
}

// ---------- drawing helpers ----------
function strokeTour(layer, points, tour, edgeCount, color, width, alpha) {
  if (edgeCount <= 0 || alpha <= 0) return;
  const count = tour.length;
  layer.beginPath();
  layer.moveTo(points[2 * tour[0]], points[2 * tour[0] + 1]);
  for (let edge = 1; edge <= Math.min(edgeCount, count); edge += 1) {
    const city = tour[edge % count];
    layer.lineTo(points[2 * city], points[2 * city + 1]);
  }
  layer.strokeStyle = color;
  layer.globalAlpha = alpha;
  layer.lineWidth = width;
  layer.lineJoin = "round";
  layer.lineCap = "round";
  layer.stroke();
  layer.globalAlpha = 1;
}

function fillDots(layer, points, visibleCount, radius, color, alpha) {
  layer.beginPath();
  for (let index = 0; index < visibleCount; index += 1) {
    layer.moveTo(points[2 * index] + radius, points[2 * index + 1]);
    layer.arc(points[2 * index], points[2 * index + 1], radius, 0, Math.PI * 2);
  }
  layer.fillStyle = color;
  layer.globalAlpha = alpha;
  layer.fill();
  layer.globalAlpha = 1;
}

function markCrossings(layer, flatPoints, project, radius, alpha) {
  if (alpha <= 0) return;
  layer.beginPath();
  for (let index = 0; index < flatPoints.length; index += 2) {
    const [x, y] = project(flatPoints[index], flatPoints[index + 1]);
    layer.moveTo(x + radius, y);
    layer.arc(x, y, radius, 0, Math.PI * 2);
  }
  layer.strokeStyle = GOLD;
  layer.lineWidth = Math.max(1.2, radius * 0.45);
  layer.globalAlpha = alpha;
  layer.stroke();
  layer.globalAlpha = 1;
}

function drawBackground(seconds) {
  const gradient = context.createRadialGradient(960, 520, 80, 960, 520, 1250);
  gradient.addColorStop(0, "#0d1d3d");
  gradient.addColorStop(1, "#040a19");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of stars) {
    const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(seconds * star.speed + star.phase));
    const x = (((star.x - seconds * 3 * star.depth) % WIDTH) + WIDTH) % WIDTH;
    context.globalAlpha = twinkle * 0.55;
    context.fillStyle = "#cfe3ff";
    context.fillRect(x, star.y, star.size, star.size);
  }
  context.globalAlpha = 1;
}

// Glow: the layer blurred wide, blurred tight, then sharp, added on top of the background.
function composite(layer, wideBlur, wideAlpha) {
  context.globalCompositeOperation = "lighter";
  context.filter = `blur(${wideBlur}px)`;
  context.globalAlpha = wideAlpha;
  context.drawImage(layer, 0, 0);
  context.filter = "blur(4px)";
  context.globalAlpha = 0.85;
  context.drawImage(layer, 0, 0);
  context.filter = "none";
  context.globalAlpha = 1;
  context.drawImage(layer, 0, 0);
  context.globalCompositeOperation = "source-over";
}

// Rich text: runs of [text, colour, style] where style is "italic", "sub" or "".
function drawRuns(runs, x, y, size, align = "left") {
  const fontFor = (style) => `${style === "italic" ? "italic " : ""}${style === "sub" ? size * 0.62 : size}px ${SERIF}`;
  let width = 0;
  for (const [text, , style] of runs) {
    context.font = fontFor(style);
    width += context.measureText(text).width;
  }
  let cursor = align === "center" ? x - width / 2 : x;
  for (const [text, color, style] of runs) {
    context.font = fontFor(style);
    context.fillStyle = color;
    context.fillText(text, cursor, style === "sub" ? y + size * 0.22 : y);
    cursor += context.measureText(text).width;
  }
}

const WHITE = "#eaf2ff";
const DIM = "#8ea6c8";
const SEPARATOR = ["   ·   ", DIM, ""];

function drawReadout(bigRuns, smallText, alpha) {
  context.globalAlpha = alpha;
  context.shadowColor = "rgba(0,0,0,0.6)";
  context.shadowBlur = 12;
  drawRuns(bigRuns, 96, 100, 54);
  context.shadowBlur = 0;
  drawRuns([[smallText, DIM, ""]], 98, 140, 25);
  context.globalAlpha = 1;
}

function drawFormulas() {
  const muted = "#7f97ba";
  const accent = "#c8d8ef";
  const gold = "#e8c27a";
  drawRuns([
    ["Lloyd   ", gold, ""], ["x", accent, "italic"], ["i", accent, "sub"], [" ← ∫", accent, ""], ["V", accent, "italic"], ["i", accent, "sub"],
    [" ρ(", accent, ""], ["x", accent, "italic"], [") ", accent, ""], ["x", accent, "italic"], [" dA  /  ∫", accent, ""],
    ["V", accent, "italic"], ["i", accent, "sub"], [" ρ(", accent, ""], ["x", accent, "italic"], [") dA", accent, ""],
  ], 560, 1042, 23, "center");
  drawRuns([
    ["2-opt   ", gold, ""], ["(a,b), (c,d) → (a,c), (b,d)   if   ", accent, "italic"],
    ["|ac| + |bd|  <  |ab| + |cd|", accent, "italic"],
  ], 1350, 1042, 23, "center");
  context.fillStyle = muted;
}

const mathN = (count) => [["N", WHITE, "italic"], [" = ", WHITE, ""], [String(count), CYAN, ""]];

// ---------- the beats ----------
function lloydPointsAt(stage, iteration) {
  const iterations = stage.lloydIterations;
  let upper = iterations.findIndex((value) => value >= iteration);
  if (upper <= 0) return stage.lloydPoints[Math.max(0, upper)];
  const lower = upper - 1;
  const blend = (iteration - iterations[lower]) / (iterations[upper] - iterations[lower]);
  const from = stage.lloydPoints[lower];
  const to = stage.lloydPoints[upper];
  const points = new Float32Array(from.length);
  for (let index = 0; index < from.length; index += 1) points[index] = from[index] + (to[index] - from[index]) * blend;
  return points;
}

function renderStage(stageIndex, seconds, project) {
  const stage = stages[stageIndex];
  const timing = stage.timing;
  const progress = (seconds - timing.start) / timing.length;
  const cyan = cyanLayer.getContext("2d");
  const gold = goldLayer.getContext("2d");
  const count = stage.count;
  const lineWidth = LINE_WIDTH[stageIndex];
  const dotRadius = DOT_RADIUS[stageIndex];
  const finalPoints = stage.lloydPoints[stage.lloydPoints.length - 1];

  // The previous stage's finished line fades while the new points arrive.
  if (stageIndex > 0 && progress < 0.12) {
    const previous = stages[stageIndex - 1];
    const previousPoints = projectAll(previous.lloydPoints[previous.lloydPoints.length - 1], project);
    strokeTour(cyan, previousPoints, previous.tours[previous.tours.length - 1], previous.count,
      CYAN, LINE_WIDTH[stageIndex - 1], 0.7 * (1 - progress / 0.12));
  }

  if (progress < PHASE.tourStart) {
    const appear = smooth(progress / 0.08);
    const maxIteration = stage.lloydIterations[stage.lloydIterations.length - 1];
    const relax = smooth((progress - 0.05) / (PHASE.tourStart - 0.07));
    const iteration = relax * maxIteration;
    const points = projectAll(lloydPointsAt(stage, iteration), project);
    fillDots(cyan, points, Math.ceil(appear * count), dotRadius, CYAN, 0.95);
    return {
      big: [...mathN(count), SEPARATOR, ["Lloyd iteration ", WHITE, ""], [String(Math.round(iteration)), CYAN, ""]],
      small: `weighted stippling: each point moves to the ρ-weighted centroid of its Voronoi cell (${maxIteration} iterations)`,
    };
  }

  const points = projectAll(finalPoints, project);
  fillDots(cyan, points, count, dotRadius * 0.8, CYAN, 0.35);
  const snapshots = stage.snapshots;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  if (progress < PHASE.crossingsStart) {
    const drawn = smooth((progress - PHASE.tourStart) / (PHASE.crossingsStart - PHASE.tourStart - 0.02));
    const edgeCount = Math.floor(drawn * count);
    strokeTour(cyan, points, stage.tours[0], edgeCount, CYAN, lineWidth, 0.9);
    const head = stage.tours[0][Math.min(edgeCount, count - 1)];
    fillDots(gold, points.subarray(2 * head, 2 * head + 2), 1, 4, "#fff4d8", 1);
    return {
      big: [...mathN(count), SEPARATOR, ["nearest-neighbour tour", WHITE, ""]],
      small: `walk to the closest unvisited point, ${formatCount(edgeCount)} of ${formatCount(count)} edges`,
    };
  }

  const snapshotIndex = progress < PHASE.untangleStart
    ? 0
    : Math.min(snapshots.length - 1, Math.floor(clamp((progress - PHASE.untangleStart) / (PHASE.resolved - PHASE.untangleStart)) * (snapshots.length - 1)));
  const snapshot = snapshots[snapshotIndex];
  const resolvedAt = phaseTime(timing, PHASE.resolved);
  const flash = seconds >= resolvedAt ? Math.exp(-(seconds - resolvedAt) * 3) : 0;
  strokeTour(cyan, points, stage.tours[snapshotIndex], count, CYAN, lineWidth * (1 + flash * 0.6), Math.min(1, 0.85 + flash));
  const pulse = 0.75 + 0.25 * Math.sin(seconds * 9);
  const markerRadius = Math.max(3, 9 - stageIndex * 1.4);
  markCrossings(gold, snapshot.crossingPoints, project, markerRadius, pulse);

  const crossingColor = snapshot.crossings > 0 ? GOLD : CYAN;
  const big = [...mathN(count), SEPARATOR, ["crossings", WHITE, ""], [" = ", WHITE, ""],
    [formatCount(snapshot.crossings), crossingColor, ""], SEPARATOR,
    ["length", WHITE, ""], [" = ", WHITE, ""], [formatLength(snapshot.length), CYAN, ""]];
  let small;
  if (progress < PHASE.untangleStart) {
    small = `${formatCount(first.crossings)} self-crossings found by segment–segment intersection tests`;
  } else if (progress < PHASE.resolved) {
    small = `2-opt  ·  move ${formatCount(snapshot.moves)} of ${formatCount(stage.totalMoves)}  ·  every move shortens the line`;
  } else {
    const saving = (1 - last.length / first.length) * 100;
    small = `one line through ${formatCount(count)} points  ·  ${formatCount(stage.totalMoves)} moves  ·  ${saving.toFixed(1)} % shorter than nearest-neighbour`;
  }
  return { big, small };
}

// ---------- the pen: the final line drawn live ----------
const penPlan = buildPenPlan(restPoints, finalTour, labels, PEN_END - PEN_START);
const penOrder = penPlan.order;
const drawnLengthAt = (() => {
  const lengths = new Float64Array(penPlan.count + 1);
  for (let edge = 0; edge < penPlan.count; edge += 1) {
    const from = penOrder[edge];
    const to = penOrder[edge + 1];
    lengths[edge + 1] = lengths[edge] + Math.hypot(restPoints[2 * to] - restPoints[2 * from], restPoints[2 * to + 1] - restPoints[2 * from + 1]);
  }
  return lengths;
})();

function penPosition(edge) {
  const whole = Math.min(penPlan.count - 1, Math.floor(edge));
  const fraction = Math.min(1, edge - whole);
  const from = penOrder[whole];
  const to = penOrder[whole + 1];
  return {
    x: restPoints[2 * from] + (restPoints[2 * to] - restPoints[2 * from]) * fraction,
    y: restPoints[2 * from + 1] + (restPoints[2 * to + 1] - restPoints[2 * from + 1]) * fraction,
  };
}
const penEdgeAt = (seconds) => (seconds < PEN_START ? 0 : penPlan.edgeAtTime(seconds - PEN_START));

// The main view never zooms: it is the full scene, and the ride starts from exactly this view.
const FULL_VIEW = { centre: { x: 960, y: 420 }, screen: { x: 960, y: 420 }, zoom: 1.025 };
const projectFull = (x, y) => [
  FULL_VIEW.screen.x + (x - FULL_VIEW.centre.x) * FULL_VIEW.zoom,
  FULL_VIEW.screen.y + (y - FULL_VIEW.centre.y) * FULL_VIEW.zoom,
];

// Close-ups live in a magnifier inset in the free top-right corner. Each one follows the pen
// while it draws a chosen stretch: the eye at the start, then the stretches from the pen plan.
const INSET = { x: 1400, y: 205, width: 480, height: 300, radius: 18 };
const INSET_FADE = 0.3;
const insets = [
  { caption: "magnifier · the eye", zoom: 6, startEdge: 0, endEdge: 300 },
  ...penPlan.windows.map((window) => ({
    caption: window.caption.replace("close-up", "magnifier"), zoom: 4, startEdge: window.start - 60, endEdge: window.end,
  })),
].map((inset) => ({
  ...inset,
  start: PEN_START + penPlan.timeOfEdge(inset.startEdge),
  end: PEN_START + penPlan.timeOfEdge(inset.endEdge),
}));
const insetAlpha = (inset, seconds) =>
  smooth((seconds - inset.start) / INSET_FADE) * (1 - smooth((seconds - inset.end) / INSET_FADE));

// Where each inset looks, frame by frame: it jumps to the pen when it opens, then follows a
// little ahead of it with smoothing (a fixed table, so renderAt stays a pure function of time).
const insetCentreTable = (() => {
  const firstFrame = Math.round(PEN_START * FPS);
  const lastFrame = Math.round(RIDE_START * FPS);
  const table = [];
  let previousInset = null;
  let centre = { x: 0, y: 0 };
  for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
    const seconds = frame / FPS;
    const inset = insets.find((candidate) => seconds >= candidate.start && seconds < candidate.end + INSET_FADE) ?? null;
    if (inset) {
      const ahead = penPosition(penPlan.edgeAtTime(Math.min(PEN_END - PEN_START, seconds - PEN_START + 0.1)));
      if (inset !== previousInset) centre = { ...ahead };
      else centre = { x: centre.x + (ahead.x - centre.x) * 0.3, y: centre.y + (ahead.y - centre.y) * 0.3 };
    }
    previousInset = inset;
    table.push(inset ? { inset, centre: { ...centre } } : null);
  }
  return (seconds) => table[Math.min(table.length - 1, Math.max(0, Math.round(seconds * FPS) - firstFrame))];
})();

function formatSpeed(speed) {
  return speed < 1.5 ? "×1" : `×${Math.round(speed)}`;
}

function roundedInset(layer) {
  layer.beginPath();
  layer.roundRect(INSET.x, INSET.y, INSET.width, INSET.height, INSET.radius);
}

// The drawn part of the line, from the start of the tour to the pen, as vectors in `project`.
function strokeDrawnLine(layer, project, edge, width, color) {
  const [startX, startY] = project(restPoints[2 * penOrder[0]], restPoints[2 * penOrder[0] + 1]);
  layer.beginPath();
  layer.moveTo(startX, startY);
  for (let step = 1; step <= Math.floor(edge); step += 1) {
    const city = penOrder[step];
    const [x, y] = project(restPoints[2 * city], restPoints[2 * city + 1]);
    layer.lineTo(x, y);
  }
  const pen = penPosition(edge);
  const [penX, penY] = project(pen.x, pen.y);
  layer.lineTo(penX, penY);
  layer.strokeStyle = color;
  layer.lineWidth = width;
  layer.lineJoin = "round";
  layer.lineCap = "round";
  layer.stroke();
}

// A hot trail behind the pen, as long as about four frames of travel: motion blur at speed.
function strokePenTrail(layer, project, edge, width, headRadius) {
  const edgesPerFrame = (penPlan.baseEdgesPerSecond * penPlan.speedAtEdge(edge)) / FPS;
  const trailStart = Math.max(0, Math.floor(edge - Math.max(5, edgesPerFrame * 4)));
  layer.beginPath();
  for (let step = trailStart; step <= Math.floor(edge); step += 1) {
    const city = penOrder[step];
    const [x, y] = project(restPoints[2 * city], restPoints[2 * city + 1]);
    if (step === trailStart) layer.moveTo(x, y);
    else layer.lineTo(x, y);
  }
  const pen = penPosition(edge);
  const [penX, penY] = project(pen.x, pen.y);
  layer.lineTo(penX, penY);
  layer.strokeStyle = GOLD;
  layer.lineWidth = width;
  layer.lineCap = "round";
  layer.lineJoin = "round";
  layer.stroke();
  fillDots(layer, Float32Array.of(penX, penY), 1, headRadius, "#fff6e0", 1);
}

function drawMagnifier(seconds, edge, view) {
  const alpha = insetAlpha(view.inset, seconds);
  if (alpha <= 0) return;
  const { zoom } = view.inset;
  const cyan = cyanLayer.getContext("2d");
  const gold = goldLayer.getContext("2d");
  const projectInset = (x, y) => [
    INSET.x + INSET.width / 2 + (x - view.centre.x) * zoom,
    INSET.y + INSET.height / 2 + (y - view.centre.y) * zoom,
  ];
  // The panel: a dark backing on the frame, the main line removed under it, then the magnified line.
  context.save();
  context.globalAlpha = 0.92 * alpha;
  context.fillStyle = "#030814";
  roundedInset(context);
  context.fill();
  context.restore();
  for (const layer of [cyan, gold]) {
    layer.save();
    layer.globalCompositeOperation = "destination-out";
    layer.globalAlpha = alpha;
    roundedInset(layer);
    layer.fill();
    layer.restore();
  }
  for (const layer of [cyan, gold]) {
    layer.save();
    roundedInset(layer);
    layer.clip();
    layer.globalAlpha = alpha;
    if (layer === cyan) strokeDrawnLine(cyan, projectInset, edge, 1.05 * zoom ** 0.6, CYAN);
    else strokePenTrail(gold, projectInset, edge, 1.6 * zoom ** 0.6, 3 + 1.5 * zoom);
    layer.restore();
  }
  // Frame, the marked area on the main view, and the leader line joining them.
  const halfWidth = INSET.width / zoom / 2;
  const halfHeight = INSET.height / zoom / 2;
  const [left, top] = projectFull(view.centre.x - halfWidth, view.centre.y - halfHeight);
  const [right, bottom] = projectFull(view.centre.x + halfWidth, view.centre.y + halfHeight);
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "rgba(200,225,255,0.6)";
  context.lineWidth = 1.5;
  roundedInset(context);
  context.stroke();
  context.strokeStyle = "rgba(255,200,97,0.75)";
  context.lineWidth = 1.2;
  context.strokeRect(left, top, right - left, bottom - top);
  context.beginPath();
  context.moveTo(right, (top + bottom) / 2);
  context.lineTo(INSET.x, INSET.y + INSET.height / 2);
  context.strokeStyle = "rgba(255,200,97,0.45)";
  context.lineWidth = 1;
  context.stroke();
  context.font = `20px ${SERIF}`;
  context.fillStyle = GOLD;
  context.fillText(`${zoom}×`, INSET.x + 16, INSET.y + INSET.height - 16);
  context.restore();
}

function renderPen(seconds) {
  const cyan = cyanLayer.getContext("2d");
  const gold = goldLayer.getContext("2d");
  const count = penPlan.count;

  // The 4,096 line fades out as the pen starts; nothing of the new line is shown before it is drawn.
  const previousFade = 1 - smooth((seconds - PEN_START) / 0.7);
  if (previousFade > 0) {
    const previous = stages[stages.length - 2];
    const previousPoints = projectAll(previous.lloydPoints[previous.lloydPoints.length - 1], projectFull);
    strokeTour(cyan, previousPoints, previous.tours[previous.tours.length - 1], previous.count, CYAN, 1.3, 0.6 * previousFade);
  }

  const edge = Math.min(count, penEdgeAt(seconds));
  const closed = seconds >= PEN_END;
  const flash = closed ? Math.exp(-(seconds - PEN_END) * 3) : 0;
  const lineWidth = 1.05 * FULL_VIEW.zoom ** 0.45;
  strokeDrawnLine(cyan, projectFull, edge, lineWidth * (1 + flash * 0.6), closed ? "#d8f8ff" : CYAN);
  if (!closed) strokePenTrail(gold, projectFull, edge, lineWidth * 1.6, 4);

  const view = closed ? null : insetCentreTable(seconds);
  if (view) drawMagnifier(seconds, edge, view);

  const drawnEdges = Math.floor(edge);
  if (closed) {
    return {
      big: [...mathN(count), SEPARATOR, ["crossings", WHITE, ""], [" = ", WHITE, ""], ["0", CYAN, ""], SEPARATOR,
        ["length", WHITE, ""], [" = ", WHITE, ""], [formatLength(finalLength), CYAN, ""]],
      small: "loop closed  ·  one line through every point, never crossing itself",
    };
  }
  return {
    big: [...mathN(count), SEPARATOR, ["edge ", WHITE, ""], [formatCount(drawnEdges), CYAN, ""], [` of ${formatCount(count)}`, WHITE, ""],
      SEPARATOR, [formatSpeed(penPlan.speedAtEdge(edge)), GOLD, ""]],
    small: view && insetAlpha(view.inset, seconds) > 0.5
      ? `${view.inset.caption}  ·  ${view.inset.zoom}×  ·  drawn ${formatLength(drawnLengthAt[drawnEdges])} of ${formatLength(finalLength)}`
      : `one stroke, 0 crossings  ·  drawn ${formatLength(drawnLengthAt[drawnEdges])} of ${formatLength(finalLength)}`,
  };
}

// ---------- the ride, in 3D ----------
// The planar tour gets depth: every point takes a z from a simple 3D model (the body, neck, head
// and pouch as ellipsoid volumes bulging towards the near side, the near wing outside the body,
// the bike frame and wheels on the centre plane, crank and legs on their own side planes).
// The line stays one continuous closed stroke in 3D; seen from an angle it may overlap itself on screen.
const WORLD_PIVOT = { x: 970, y: 640 };
const GROUND_Y = 978;
const GROUND_RADIUS = 430;
const FOCAL = 2400;
const BODY_VOLUMES = [
  { x: 912, y: 455, radiusX: 150, radiusY: 100, depth: 125 },
  { x: 1020, y: 320, radiusX: 45, radiusY: 120, depth: 48 },
  { x: 1040, y: 214, radiusX: 44, radiusY: 38, depth: 48 },
  { x: 1185, y: 296, radiusX: 135, radiusY: 50, depth: 40 },
];
const NEAR_WING = [[972, 384], [1030, 400], [1070, 450], [1100, 508], [1074, 530], [1040, 500], [990, 470], [940, 448]];
const SIDE_DEPTH = {
  [PART.crank]: 12,
  [PART.nearPedal]: 62,
  [PART.farPedal]: -62,
  [PART.nearThigh]: 50,
  [PART.nearShin]: 56,
  [PART.nearFoot]: 62,
  [PART.farThigh]: -50,
  [PART.farShin]: -56,
  [PART.farFoot]: -62,
};

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const [currentX, currentY] = polygon[current];
    const [previousX, previousY] = polygon[previous];
    const crossesRay = (currentY > y) !== (previousY > y)
      && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function bodyDepth(x, y) {
  let depth = 0;
  for (const volume of BODY_VOLUMES) {
    const distance = ((x - volume.x) / volume.radiusX) ** 2 + ((y - volume.y) / volume.radiusY) ** 2;
    if (distance < 1) depth = Math.max(depth, volume.depth * Math.sqrt(1 - distance));
  }
  return insidePolygon(x, y, NEAR_WING) ? depth + 45 : depth;
}

// Half thickness of the bicycle at a rest point: paired stays spread to the rear hub, fork legs
// spread to the front hub, wide handlebars, a saddle with width, thin single tubes elsewhere.
function frameHalfWidth(x, y) {
  if (x > 1075 && y < 560) return 55;
  if (y < 562 && x < 965) return 16;
  if (x < 905 && y > 600) return 6 + 26 * clamp((905 - x) / 205);
  if (x > 1165 && y > 650) return 6 + 22 * clamp((y - 650) / 170);
  return 6;
}

// Wheels: the tyre has width, the spokes are dished from a wide hub flange to the rim.
function wheelHalfWidth(x, y, hub) {
  const radius = Math.hypot(x - hub.x, y - hub.y);
  if (radius > BIKE.rimRadius - 8) return 13;
  if (radius < 16) return 24;
  return 24 * (1 - radius / BIKE.rimRadius) + 3;
}

// Every point sits on one side of its volume. Sides alternate in runs of 80 points along the
// final tour, so each side gets about half the line and the single line passes through the
// volume between runs: one continuous stroke that covers both sides of every part.
const SIDE_RUN = 80;
const sideOf = new Int8Array(labels.length);
for (let position = 0; position < finalTour.length; position += 1) {
  sideOf[finalTour[position]] = Math.floor(position / SIDE_RUN) % 2 === 0 ? 1 : -1;
}
const pointDepth = new Float32Array(labels.length);
for (let index = 0; index < labels.length; index += 1) {
  const x = restPoints[2 * index];
  const y = restPoints[2 * index + 1];
  const label = labels[index];
  let halfWidth;
  if (label === PART.body) halfWidth = bodyDepth(x, y);
  else if (label === PART.frame || label === 0) halfWidth = frameHalfWidth(x, y);
  else if (label === PART.rearWheel) halfWidth = wheelHalfWidth(x, y, BIKE.rearHub);
  else if (label === PART.frontWheel) halfWidth = wheelHalfWidth(x, y, BIKE.frontHub);
  // Legs, feet and pedals already belong to one side; the chainring sits just right of centre.
  if (halfWidth === undefined) pointDepth[index] = SIDE_DEPTH[label] ?? 0;
  else pointDepth[index] = sideOf[index] * halfWidth;
}

// Orbit the camera by `orbit` round the vertical axis and tilt it down by `pitch` (radians).
function makeOrbitView(orbit, pitch, zoom, screenCentre) {
  const cosOrbit = Math.cos(orbit);
  const sinOrbit = Math.sin(orbit);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return (x, y, z) => {
    const worldX = x - WORLD_PIVOT.x;
    const worldY = y - WORLD_PIVOT.y;
    const turnedX = worldX * cosOrbit + z * sinOrbit;
    const turnedZ = -worldX * sinOrbit + z * cosOrbit;
    const screenY = worldY * cosPitch + turnedZ * sinPitch;
    const towardCamera = turnedZ * cosPitch - worldY * sinPitch;
    const perspective = FOCAL / (FOCAL - towardCamera);
    return [screenCentre.x + turnedX * perspective * zoom, screenCentre.y + screenY * perspective * zoom];
  };
}

function drawGround(gold, view, markerAngle, alpha) {
  gold.globalAlpha = alpha * 0.55;
  gold.strokeStyle = GOLD;
  gold.lineWidth = 1.6;
  gold.beginPath();
  for (let step = 0; step <= 120; step += 1) {
    const angle = (step / 120) * Math.PI * 2;
    const [x, y] = view(WORLD_PIVOT.x + GROUND_RADIUS * Math.cos(angle), GROUND_Y, GROUND_RADIUS * Math.sin(angle));
    if (step === 0) gold.moveTo(x, y);
    else gold.lineTo(x, y);
  }
  gold.stroke();
  // Ticks every 45 degrees, fixed to the ground, so the orbit reads as the camera moving.
  gold.beginPath();
  for (let tick = 0; tick < 8; tick += 1) {
    const angle = (tick / 8) * Math.PI * 2;
    const [innerX, innerY] = view(WORLD_PIVOT.x + (GROUND_RADIUS - 18) * Math.cos(angle), GROUND_Y, (GROUND_RADIUS - 18) * Math.sin(angle));
    const [outerX, outerY] = view(WORLD_PIVOT.x + (GROUND_RADIUS + 18) * Math.cos(angle), GROUND_Y, (GROUND_RADIUS + 18) * Math.sin(angle));
    gold.moveTo(innerX, innerY);
    gold.lineTo(outerX, outerY);
  }
  gold.stroke();
  // The marker travels round the ellipse by the distance the tyres have rolled.
  const [markerX, markerY] = view(WORLD_PIVOT.x + GROUND_RADIUS * Math.cos(markerAngle), GROUND_Y, GROUND_RADIUS * Math.sin(markerAngle));
  gold.globalAlpha = alpha;
  fillDots(gold, Float32Array.of(markerX, markerY), 1, 6, "#fff1d0", alpha);
  gold.globalAlpha = 1;
}

const formatDegrees = (radians) => `${String(Math.round((((radians * 180) / Math.PI) % 360 + 360) % 360)).padStart(3, "0")}°`;

function renderRide(seconds) {
  const rideSeconds = seconds - RIDE_START;
  const frame = Math.min(meta.ride.frames - 1, Math.max(0, Math.round(rideSeconds * FPS)));
  const crankAngle = crankAngleAt(frame / FPS);
  // Lift from the flat drawing into depth, then orbit 200 degrees with a slow rise and fall of pitch.
  const lift = smooth(rideSeconds / 1.4);
  const orbitProgress = smooth((rideSeconds - 0.8) / 12.4);
  const orbit = (200 * Math.PI / 180) * orbitProgress;
  const pitch = (Math.PI / 180) * (16 * lift - 7 * smooth((rideSeconds - 7) / 5.5));
  // At lift 0 this view equals the pen beat's camera (zoom 1.025 about (960, 420)).
  const zoom = 1.025 + (0.85 - 1.025) * lift;
  const screenCentre = {
    x: 970.25 + (960 - 970.25) * lift,
    y: 645.5 + (545 - 645.5) * lift,
  };
  const view = makeOrbitView(orbit, pitch, zoom, screenCentre);
  const posed = posePoints(restPoints, labels, crankAngle);
  const projected = new Float32Array(posed.length);
  for (let index = 0; index < labels.length; index += 1) {
    const [x, y] = view(posed[2 * index], posed[2 * index + 1], pointDepth[index] * lift);
    projected[2 * index] = x;
    projected[2 * index + 1] = y;
  }
  const cyan = cyanLayer.getContext("2d");
  const gold = goldLayer.getContext("2d");
  drawGround(gold, view, ((crankAngle - LEG.restCrankAngle) * GEAR_RATIO * 155) / GROUND_RADIUS, smooth((rideSeconds - 0.9) / 1.2));
  strokeTour(cyan, projected, rideTour(frame), finalStage.count, CYAN, 1.1, 0.95);
  const moves = meta.ride.moves[frame];
  return {
    big: [...mathN(finalStage.count), SEPARATOR, ["φ", GOLD, "italic"], [" = ", WHITE, ""], [formatDegrees(crankAngle - LEG.restCrankAngle), GOLD, ""],
      SEPARATOR, ["θ", CYAN, "italic"], [" = ", WHITE, ""], [formatDegrees(orbit), CYAN, ""]],
    small: `one stroke in 3D  ·  pitch ${(pitch * 180 / Math.PI).toFixed(0)}°  ·  wheels 2.5 φ  ·  2-opt re-thread: ${formatCount(moves)} moves`,
  };
}

// ---------- frame ----------
function cameraFor(seconds) {
  // A slow push inside each beat, so the frame is never still.
  const beat = STAGES
    .find((range) => seconds >= range.start && seconds < range.end) ?? { start: 0, end: DURATION };
  const progress = (seconds - beat.start) / (beat.end - beat.start);
  return makeProjection(1 + 0.025 * smooth(progress), 0, 0);
}

window.renderAt = (seconds) => {
  for (const layer of [cyanLayer, goldLayer]) layer.getContext("2d").clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(seconds);
  let readout;
  if (seconds < DOTS_START) {
    const stageIndex = STAGES.findIndex((stage) => seconds < stage.end);
    readout = renderStage(stageIndex, seconds, cameraFor(seconds));
  } else if (seconds < RIDE_START) readout = renderPen(seconds);
  else readout = renderRide(seconds);
  composite(cyanLayer, 14, 0.7);
  composite(goldLayer, 10, 0.9);
  // Soft dark bands keep the readout and formulas legible when a close-up fills the frame.
  const topBand = context.createLinearGradient(0, 0, 0, 215);
  topBand.addColorStop(0, "rgba(4,10,25,0.96)");
  topBand.addColorStop(0.7, "rgba(4,10,25,0.8)");
  topBand.addColorStop(1, "rgba(4,10,25,0)");
  context.fillStyle = topBand;
  context.fillRect(0, 0, WIDTH, 215);
  const bottomBand = context.createLinearGradient(0, 985, 0, HEIGHT);
  bottomBand.addColorStop(0, "rgba(4,10,25,0)");
  bottomBand.addColorStop(1, "rgba(4,10,25,0.85)");
  context.fillStyle = bottomBand;
  context.fillRect(0, 985, WIDTH, HEIGHT - 985);
  const fadeOut = 1 - smooth((seconds - (DURATION - 0.8)) / 0.8);
  drawReadout(readout.big, readout.small, (readout.alpha ?? 1) * fadeOut);
  drawFormulas();
  if (fadeOut < 1) {
    context.fillStyle = `rgba(4,10,25,${1 - fadeOut})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
};
window.ready = true;
