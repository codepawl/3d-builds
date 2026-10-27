// Builds the first-transistor figure as one standalone page.
//   node build.mjs            light page (the shareable one) and publish/first-transistor-anatomy.html
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves or changes is a slot that
// live.js drives from the pure model (model.mjs). Every drawn thing is an item that belongs to one
// assembly, so the exploded view (explode.mjs, apart.js) can move and re-sort them.
// Same recipe as ../enigma-anatomy.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { TransistorApi as Transistor } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { LayoutApi as Layout } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 400;
// The box of the scene's corners is larger than the drawing, so the figure is fitted into a box larger
// than its place and then moved: these numbers put the drawing itself where the card wants it.
const FIGURE = film ? { width: 1254, height: 758, left: 94, top: 43, pad: 0 } : { width: 754, height: 520, left: -87, top: -84, pad: 34 };
const L = Layout;

const sceneCorners = k.boxCorners({ x: L.BOARD.x0, y: L.BOARD.y0, w: L.BOARD.x1 - L.BOARD.x0, d: L.BOARD.y1 - L.BOARD.y0, r: 0 }, 0, L.POST.z1 + 4);
const P = k.fitProjection(sceneCorners, FIGURE.width, FIGURE.height, { pad: FIGURE.pad });
P.origin = [P.origin[0] + FIGURE.left, P.origin[1] + FIGURE.top];

const camera = k.cameraOf(P);
const VIEW = [camera.cosA * camera.cosE, camera.sinA * camera.cosE, camera.sinE];
const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const number = (value) => (Math.round(value * 100) / 100).toString();
const trace = (points, closed = false) => k.pathOf(points.map((point) => k.iso(point, P)), closed);

function box(B, style = {}) {
  const paths = k.slabOf({ x: B.x0, y: B.y0, w: B.x1 - B.x0, d: B.y1 - B.y0, r: style.r ?? 0.6 }, B.z0, B.z1 - B.z0, P, 2, style.bevel ?? 0.4);
  return S(paths, { tone: style.tone ?? "mid", inner: style.inner, className: style.className });
}

function boundsOf(B) {
  return [B.x0, B.x1, B.y0, B.y1, B.z0, B.z1];
}

function signedArea(profile) {
  let sum = 0;
  profile.forEach(([x, z], index) => {
    const [nextX, nextZ] = profile[(index + 1) % profile.length];
    sum += x * nextZ - nextX * z;
  });
  return sum / 2;
}

// A solid with the same outline (`profile`, as [x, z] points) all the way from y0 to y1: the wedge and
// its strips of foil. It returns the same paths the kit's own solids have, shaded by the kit's rule.
function prismAlongY(profile, y0, y1) {
  const ring = signedArea(profile) > 0 ? profile : profile.slice().reverse();
  const count = ring.length;
  const front = ring.map(([x, z]) => at(x, y1, z));
  const back = ring.map(([x, z]) => at(x, y0, z));
  const shades = [[], [], [], []];
  const tops = [];
  const outline = [];
  const crease = [];
  const fill = [k.pathOf(front, true)];
  const visible = [];
  shades[3].push(k.pathOf(front, true));
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    const across = ring[next][0] - ring[index][0];
    const up = ring[next][1] - ring[index][1];
    const length = Math.hypot(across, up) || 1;
    const normal = [up / length, -across / length];
    visible.push(normal[0] * VIEW[0] + normal[1] * VIEW[2] > 1e-9);
    if (!visible[index]) {
      outline.push(k.pathOf([front[index], front[next]]));
      continue;
    }
    const quad = k.pathOf([front[index], front[next], back[next], back[index]], true);
    fill.push(quad);
    crease.push(k.pathOf([front[index], front[next]]));
    outline.push(k.pathOf([back[index], back[next]]));
    if (normal[1] > 0.95) tops.push(quad);
    else shades[normal[1] > 0.3 ? 1 : 0].push(quad);
  }
  for (let index = 0; index < count; index++) {
    const before = visible[(index + count - 1) % count];
    if (before !== visible[index]) outline.push(k.pathOf([front[index], back[index]]));
    else if (before) crease.push(k.pathOf([front[index], back[index]]));
  }
  return { fill: fill.join(""), outline: outline.join(""), crease: crease.join(""), top: tops.join(""), shades: shades.map((list) => list.join("")) };
}

function profileBounds(profile, y0, y1) {
  const xs = profile.map(([x]) => x);
  const zs = profile.map(([, z]) => z);
  return [Math.min(...xs), Math.max(...xs), y0, y1, Math.min(...zs), Math.max(...zs)];
}

function routeBounds(points, margin = 0.6) {
  const span = (axis) => [Math.min(...points.map((point) => point[axis])) - margin, Math.max(...points.map((point) => point[axis])) + margin];
  return [...span(0), ...span(1), ...span(2)];
}

// A soft curve through the given points (Catmull-Rom), as many short straight pieces.
function curveThrough(points, perSpan = 12) {
  const curve = [];
  for (let span = 0; span < points.length - 1; span++) {
    const before = points[Math.max(0, span - 1)];
    const from = points[span];
    const to = points[span + 1];
    const after = points[Math.min(points.length - 1, span + 2)];
    for (let step = 0; step < perSpan; step++) {
      const t = step / perSpan;
      curve.push(from.map((_, axis) => 0.5 * (2 * from[axis] + (to[axis] - before[axis]) * t + (2 * before[axis] - 5 * from[axis] + 4 * to[axis] - after[axis]) * t * t + (3 * from[axis] - before[axis] - 3 * to[axis] + after[axis]) * t * t * t)));
    }
  }
  curve.push(points[points.length - 1]);
  return curve;
}

function shifted(points, by) {
  return points.map((point) => [point[0] + by[0], point[1] + by[1], point[2] + by[2]]);
}

// A bare wire: a dark stroke with a lighter core, so it reads as a round wire and not as a line.
function wire(points, className = "") {
  const d = trace(points);
  return `<path class="tr-wire ${className}" d="${d}"/><path class="tr-wire-core ${className}" d="${d}"/>`;
}

function circleOnTop(x, y, radius, z) {
  return k.planOutline({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2, r: radius }, z, P, 6);
}

// Text lying on top of a part, read from the front.
function textOnTop(point, text, size, extra = "") {
  const origin = k.iso(point, P);
  const right = k.iso([point[0] + 1, point[1], point[2]], P);
  const below = k.iso([point[0], point[1] + 1, point[2]], P);
  const matrix = [right[0] - origin[0], right[1] - origin[1], below[0] - origin[0], below[1] - origin[1], origin[0], origin[1]].map(number).join(" ");
  return `<text class="tr-text"${extra} transform="matrix(${matrix})" font-size="${size}" dy="0.36em">${text}</text>`;
}

// ---- items ---------------------------------------------------------------------------------------------
// One item is one thing in painter's order: its assembly, its markup and the world box it fills
// ([x0, x1, y0, y1, z0, z1]). `block` marks a thick solid that the audit tests for pass-through.

const listed = [];

function put(piece, label, markup, bounds = null, block = false) {
  listed.push({ piece, label, markup, bounds, block });
}

function also(markup) {
  listed[listed.length - 1].markup += markup;
}

function slab(piece, label, B, style) {
  put(piece, label, box(B, style), boundsOf(B), true);
}

function cornerScrews(B, inset, size = 0.5) {
  const points = [];
  for (const x of [B.x0 + inset, B.x1 - inset]) {
    for (const y of [B.y0 + inset, B.y1 - inset]) points.push(at(x, y, B.z1));
  }
  return D(points, { size });
}

function boardAndWires() {
  const B = L.BOARD;
  const plan = { x: B.x0, y: B.y0, w: B.x1 - B.x0, d: B.y1 - B.y0, r: 1.5 };
  const halo = `<path class="iso-halo" d="${k.haloOf(plan, 0, 1, P)}"/>`;
  put("stand", "board", `${halo}<g class="tr-wood">${box(B, { tone: "lo", bevel: 0.8, r: 1.5 })}</g>`, boundsOf(B), true);
  also(Ln(k.planOutline(k.insetPlan(plan, 3.5), B.z1, P, 2), { tone: "faint" }) + cornerScrews(B, 7, 0.6));
  const ends = [];
  let wires = "";
  for (const route of Object.values(L.BOARD_WIRES)) {
    wires += trace(route);
    ends.push(k.iso(route[0], P), k.iso(route[route.length - 1], P));
  }
  also(Ln(wires, { tone: "mid", className: "tr-board-wire" }) + D(ends, { size: 0.7, tone: "hi" }));
}

function postAndArm() {
  slab("stand", "post", L.POST, { bevel: 0.5 });
  also(D([at(L.POST.x1, L.POST.y1 - 4, 10), at(L.POST.x0 + 4, L.POST.y1, 10)], { size: 0.5 }));
  slab("stand", "arm", L.ARM, { bevel: 0.4 });
  also(D([at(0, L.POST.y0 + 4, L.ARM.z1), at(0, -10, L.ARM.z1)], { size: 0.5 }));
  const screw = { x: 0, y: -2, radius: 2.2, z0: L.ARM.z1, z1: L.ARM.z1 + 3 };
  const knob = S(k.cylinder(screw.x, screw.y, screw.radius, screw.z0, screw.z1 - screw.z0, P, 14, 0.3), { tone: "hi" });
  const grip = Ln(k.knurl(screw.x, screw.y, screw.radius, screw.z0, screw.z1, 14, P, 0), { tone: "lo" });
  put("stand", "spring clamp screw", knob + grip, [-screw.radius, screw.radius, screw.y - screw.radius, screw.y + screw.radius, screw.z0, screw.z1]);
}

function terminal(name) {
  const [x, y] = L.TERMINALS[name];
  const T = L.TERMINAL;
  const foot = S(k.cylinder(x, y, T.radius + 1, T.z0, 1.4, P, 16), { tone: "mid" });
  const stem = S(k.cylinder(x, y, T.radius - 1.2, T.z0 + 1.4, T.z1 - T.z0 - 1.4, P, 12), { tone: "mid", crease: "none" });
  const washer = S(k.cylinder(x, y, T.radius + 0.7, T.z1 - 6, 1, P, 16), { tone: "mid" });
  const nut = S(k.cylinder(x, y, T.radius, T.z1 - 5, 5, P, 16, 0.4), { tone: "hi" });
  const grip = Ln(k.knurl(x, y, T.radius, T.z1 - 5, T.z1, 14, P, 0), { tone: "lo" });
  const cap = S(k.cylinder(x, y, 1.1, T.z1, T.cap - T.z1, P, 10), { tone: "hi" });
  put("stand", `${name} terminal`, foot + stem + washer + nut + grip + cap, [x - T.radius, x + T.radius, y - T.radius, y + T.radius, T.z0, T.cap]);
}

function ribsOnTop(B, count) {
  let d = "";
  for (let index = 1; index <= count; index++) {
    const y = B.y0 + ((B.y1 - B.y0) * index) / (count + 1);
    d += k.lineOnTop([B.x0, y], [B.x1, y], B.z1, P);
  }
  return Ln(d, { tone: "lo" });
}

function circuitParts() {
  const source = L.SOURCE;
  slab("stand", "signal source", source, { bevel: 0.6, r: 1 });
  const middle = [(source.x0 + source.x1) / 2, (source.y0 + source.y1) / 2];
  also(Ln(circleOnTop(middle[0], middle[1], 6.5, source.z1), { tone: "mid" }) + textOnTop([middle[0], middle[1], source.z1], "~", 12, ' data-tone="hi"'));
  also(cornerScrews(source, 2.2, 0.45));

  const cell = L.EMITTER_CELL;
  const can = S(k.cylinder(cell.x, cell.y, cell.radius, cell.z0, cell.z1 - cell.z0, P, 22, 0.5), { tone: "mid" });
  const stud = S(k.cylinder(cell.x, cell.y, 1.6, cell.z1, 1.6, P, 10), { tone: "hi" });
  const seam = Ln(k.sideArc(cell.x, cell.y, cell.radius, cell.z0 + 3, P), { tone: "lo" });
  put("stand", "emitter cell", can + seam + stud, [cell.x - cell.radius, cell.x + cell.radius, cell.y - cell.radius, cell.y + cell.radius, cell.z0, cell.z1 + 1.6], true);

  const battery = L.COLLECTOR_BATTERY;
  slab("stand", "collector battery", battery, { bevel: 0.6, r: 1 });
  let seams = "";
  for (const share of [1 / 3, 2 / 3]) {
    const x = battery.x0 + (battery.x1 - battery.x0) * share;
    seams += k.lineOnTop([x, battery.y0], [x, battery.y1], battery.z1, P);
  }
  also(Ln(seams, { tone: "lo" }));
  const studs = [battery.x0 + 3.7, (battery.x0 + battery.x1) / 2, battery.x1 - 3.7].map((x) => S(k.cylinder(x, (battery.y0 + battery.y1) / 2, 1.6, battery.z1, 1.6, P, 10), { tone: "hi" }));
  also(studs.join(""));

  const load = L.LOAD;
  slab("stand", "load", load, { bevel: 0.5, r: 1 });
  also(ribsOnTop(load, 5) + D([at(load.x0 + 2, load.y1 - 2, load.z1), at(load.x1 - 2, load.y0 + 2, load.z1)], { size: 0.5 }));
}

function biasSwitch() {
  const W = L.SWITCH;
  const y = (W.y0 + W.y1) / 2;
  const pivot = [W.x0 + 2.5, y, W.z1];
  const closed = [W.x1 - 2.5, y, W.z1 + 0.6];
  const open = [W.x0 + 2.5 + W.lever * 0.62, y, W.z1 + W.lever * 0.78];
  const lever = (name, tip) => `<g data-dyn="lever-${name}"><path class="tr-lever" d="${trace([pivot, tip])}"/>${D([k.iso(tip, P)], { size: 1.3, tone: "hi" })}</g>`;
  const contacts = D([k.iso(pivot, P), k.iso([W.x1 - 2.5, y, W.z1], P)], { size: 0.9, tone: "hi" });
  const hit = `<path class="tr-hit" data-hit="bias" tabindex="0" role="button" aria-label="Bias switch. Enter connects or disconnects the two batteries." d="${circleOnTop((W.x0 + W.x1) / 2, y, 9, W.z1 + 3)}"/>`;
  put("stand", "bias switch", box(W, { bevel: 0.3 }) + contacts + lever("on", closed) + lever("off", open) + hit, [W.x0, W.x1, W.y0, W.y1, W.z0, W.z1 + W.lever]);
}

function metalBase() {
  slab("base", "metal base", L.BASE, { bevel: 0.6, r: 1 });
  also(cornerScrews(L.BASE, 3, 0.55));
  const lug = { x0: L.BASE.x1, x1: L.BASE.x1 + 4, y0: L.BASE_LUG[1] - 2.2, y1: L.BASE_LUG[1] + 2.2, z0: L.BASE_LUG[2] - 1, z1: L.BASE_LUG[2] + 0.4 };
  put("base", "base lug", box(lug, { tone: "hi", bevel: 0.2, r: 0.4 }) + D([at(lug.x0 + 2, L.BASE_LUG[1], lug.z1)], { size: 0.6, tone: "hi" }), boundsOf(lug));
}

function germaniumSlab() {
  const B = L.GERMANIUM;
  slab("germanium", "germanium slab", B, { tone: "hi", bevel: 0.4, r: 0.5, className: "tr-germanium" });
  also(D([k.iso(L.contactPoint(-1), P), k.iso(L.contactPoint(1), P)], { size: 0.45, tone: "hi" }));
}

function wedgeAndFoil() {
  const W = L.WEDGE;
  const profile = L.wedgeProfile();
  const hole = [];
  for (let step = 0; step < 16; step++) {
    const angle = (step / 16) * Math.PI * 2;
    hole.push([Math.cos(angle) * 2.2, W.y1, W.top - 7 + Math.sin(angle) * 2.2]);
  }
  const foil = (side, name) => {
    const strip = L.foilProfile(side);
    put("foil", name, S(prismAlongY(strip, W.y0, W.y1), { tone: "hi", className: "tr-gold" }), profileBounds(strip, W.y0, W.y1));
  };
  // The emitter's strip lies on the far slope: listed before the wedge, the wedge covers all but its edge.
  foil(-1, "emitter foil");
  put("wedge", "plastic wedge", S(prismAlongY(profile, W.y0, W.y1), { tone: "mid", className: "tr-plastic", inner: Ln(trace(hole, true), { tone: "lo" }) }), profileBounds(profile, W.y0, W.y1), true);
  foil(1, "collector foil");
}

function springWire() {
  const R = L.SPRING;
  const zigzag = [[0, R.y, R.top], [0, R.y, R.top - 3]];
  const turns = 4;
  const span = R.top - 3 - (R.bottom + 2);
  for (let turn = 0; turn < turns; turn++) {
    const side = turn % 2 === 0 ? -1 : 1;
    zigzag.push([side * R.halfWidth, R.y, R.top - 3 - (span * (turn + 0.5)) / turns]);
  }
  zigzag.push([0, R.y, R.bottom + 2], [0, R.y, R.bottom]);
  const foot = D([k.iso([0, R.y, R.bottom], P)], { size: 0.9, tone: "hi" });
  put("spring", "spring", wire(zigzag, "tr-spring") + foot, [-R.halfWidth, R.halfWidth, R.y - 1, R.y + 1, R.bottom, R.top]);
}

function leads() {
  for (const name of ["emitter", "collector", "base"]) {
    const route = curveThrough(L.leadRoute(name));
    const ends = D([k.iso(route[0], P), k.iso(route[route.length - 1], P)], { size: 0.9, tone: "hi" });
    put("leads", `${name} lead`, wire(route) + ends, routeBounds(route));
    // On its way to the right the emitter lead has to pass the place where the spring hangs.
    if (name === "emitter") listed[listed.length - 1].crosses = "spring";
  }
}

// The two currents, drawn over the wires they run in. Each loop is a list of runs, every run in the
// direction the current flows, so that the moving dashes all travel the right way round.
function currentLoops() {
  const emitterLead = curveThrough(L.leadRoute("emitter")).reverse();
  const collectorLead = curveThrough(L.leadRoute("collector"));
  const baseLead = curveThrough(L.leadRoute("base"));
  const side = [0, 1.1, 0];
  const other = [0, -1.1, 0];
  // On the wedge each current runs down or up the front edge of its strip of foil.
  const foilRun = (sign) => [[sign * (L.WEDGE.halfWidth - 0.4), L.WEDGE.y1, L.WEDGE.top - 1.5], [L.contactPoint(sign)[0], L.WEDGE.y1, L.WEDGE.tip]];
  const onBoardIn = [L.BOARD_WIRES.sourceToCell, L.BOARD_WIRES.cellToSwitch, L.BOARD_WIRES.switchToEmitter, L.BOARD_WIRES.baseToSource];
  const aboveIn = [[...emitterLead, ...foilRun(-1)], shifted(baseLead, side)];
  const onBoardOut = [L.BOARD_WIRES.collectorToBattery, L.BOARD_WIRES.batteryToLoad, L.BOARD_WIRES.loadToBase];
  const aboveOut = [[...foilRun(1).reverse(), ...collectorLead], shifted(baseLead.slice().reverse(), other)];
  const pathOfRuns = (runs) => runs.map((run) => trace(run)).join("");
  const pathFor = (name, runs) => `<path class="tr-path"${name === "out" ? ' data-side="out"' : ""} data-dyn="path-${name}" d="${pathOfRuns(runs)}"/>`;
  // The runs that lie on the board are painted with the board, under every part that stands on it;
  // the runs in the leads and on the foil are painted last.
  listed[0].markup += pathFor("in", onBoardIn) + pathFor("out", onBoardOut);
  put("stand", "currents", pathFor("in", aboveIn) + pathFor("out", aboveOut));
}

boardAndWires();
postAndArm();
for (const name of ["emitter", "collector", "base"]) terminal(name);
circuitParts();
biasSwitch();
metalBase();
germaniumSlab();
wedgeAndFoil();
springWire();
leads();
currentLoops();

// ---- the exploded view ---------------------------------------------------------------------------------

const origin = k.iso([0, 0, 0], P);
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
  const tip = k.iso(axis, P);
  return [tip[0] - origin[0], tip[1] - origin[1]];
});

// The assembled painter's order is measured from the items' boxes, not set by hand.
const measured = Explode.restOrder(listed, AXES);
const items = measured.order.map((index) => listed[index]);

// Where each assembly carries its number while apart: a point on a face that stays in view.
const ANCHORS = {
  spring: [L.SPRING.halfWidth, 0, (L.SPRING.top + L.SPRING.bottom) / 2 + 6],
  wedge: [-10, L.WEDGE.y1, L.WEDGE.top - 6],
  foil: [L.WEDGE.halfWidth + 3, L.WEDGE.y1, L.WEDGE.top - 4],
  germanium: [L.GERMANIUM.x1 - 3, L.GERMANIUM.y1 - 3, L.GERMANIUM.z1],
  base: [L.BASE.x0 + 5, L.BASE.y1 - 4, L.BASE.z1],
  leads: [-38, 11, 52],
  stand: [L.BOARD.x1 - 8, L.BOARD.y1 - 8, L.BOARD.z1],
};

// The box on the drawing that the items fill when every assembly is moved by `shifts`.
function viewOf(shifts) {
  const xs = [];
  const ys = [];
  for (const item of items) {
    if (!item.bounds) continue;
    const moved = Explode.movedBox(item.bounds, shifts[item.piece]);
    for (const x of [moved[0], moved[1]]) {
      for (const y of [moved[2], moved[3]]) {
        for (const z of [moved[4], moved[5]]) {
          const point = k.iso([x, y, z], P);
          xs.push(point[0]);
          ys.push(point[1]);
        }
      }
    }
  }
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  return { x: (left + right) / 2, y: (up + down) / 2, width: right - left, height: down - up };
}

function apartView() {
  return viewOf(Explode.fullShifts());
}

function restView() {
  const unmoved = {};
  for (const name of Object.keys(Explode.PIECES)) unmoved[name] = [0, 0, 0];
  return viewOf(unmoved);
}

function runAudit() {
  const result = Explode.auditExplode(items, AXES);
  const blocks = items.filter((item) => item.block).length;
  console.log(`order cycles assembled: ${measured.cycles}${measured.loop ? ` (${measured.loop.map((index) => listed[index].label).join(" | ")})` : ""}`);
  console.log(`depth order at rest: ${result.contradictions.length} pairs of different assemblies drawn the wrong way round`);
  result.contradictions.slice(0, 20).forEach((line) => console.log(`  ${line}`));
  console.log(`order cycles in flight: ${result.cycles} frames${result.worstCycle ? ` (last: ${result.worstCycle})` : ""}`);
  for (const [ring, count] of Array.from(result.loops).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${count} frames · ${ring}`);
  console.log(`blocks through blocks in flight: ${result.through.size} pairs`);
  for (const [pair, worst] of result.through) console.log(`  ${pair}  ${worst.depth.toFixed(2)} deep · ${worst.where}`);
  console.log(`blocks sunk apart: ${result.sunkApart.length} pairs`);
  result.sunkApart.forEach(([pair, depth]) => console.log(`  ${pair}  ${depth.toFixed(2)} deep`));
  console.log(`explode audit · ${items.length} items · ${blocks} blocks · ${result.flights} flights · ${result.frames} frames`);
  const problems = measured.cycles + result.contradictions.length + result.cycles + result.through.size + result.sunkApart.length;
  console.log(problems ? `explode audit failed: ${problems} problems` : "explode audit passed");
  process.exit(problems ? 1 : 0);
}

if (audit) runAudit();

const scene = `<g data-dyn="world">${items.map((item) => `<g class="tr-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;

// The place on the model that the magnified view shows: the point of the wedge on the germanium.
// Nothing is drawn there for good; the page shows a thin rectangle only while the magnified view is born.
function sourceBox() {
  const centre = k.iso([0, L.WEDGE.y1, L.WEDGE.tip + 1], P);
  const width = P.scale * 17;
  return { x: centre[0], y: centre[1], width, height: (width * INSET.height) / INSET.width };
}

const STEP_BACK_FROM = 3;

function stepMark(index, centre, radius) {
  const side = index >= STEP_BACK_FROM ? ' data-side="out"' : "";
  return `<g class="tr-mark" data-stepmark="${index}"${side} transform="translate(${number(centre[0])} ${number(centre[1])})"><circle r="${radius}"/><text font-size="${number(radius * 1.15)}" dy="0.36em">${index + 1}</text></g>`;
}

function stageMarks() {
  if (!film) return "";
  const first = k.iso([-56, 24, 36], P);
  const fourth = k.iso([52, 16, 46], P);
  return stepMark(0, first, 18) + stepMark(3, fourth, 18);
}

const world = `<g data-dyn="lens">${scene}${stageMarks()}</g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The first transistor, drawn as an isometric model on a wooden board. A plastic triangle hangs point down from a bent wire spring under a short arm. A strip of gold foil runs down each sloping edge of the triangle; the two strips end a hair apart at the point, pressed onto a small slab of germanium that lies on a metal base. Three leads go from the two strips and from the base to terminals on the board. On the board to the left are a signal source, a small cell and a switch, wired to the emitter; to the right a larger battery and a load, wired to the collector. A thin orange line shows the small input current and a thick blue line the larger output current.",
  body: world,
});

// ---- the magnified view --------------------------------------------------------------------------------
// A flat cut through the point of the wedge, not to scale: the two foil tips on the germanium surface.

const INSET = {
  width: 240,
  height: 200,
  surface: 112,
  layer: 13,
  baseTop: 172,
  baseBottom: 187,
  left: 14,
  right: 226,
  emitterTip: [96.5, 112],
  collectorTip: [143.5, 112],
};

function insetSvg() {
  const I = INSET;
  const polygon = (points, className) => `<polygon class="${className}" points="${points.map((point) => point.join(",")).join(" ")}"/>`;
  const mirror = (points) => points.map(([x, y]) => [I.width - x, y]);
  const leftFoil = [[43, 6], [52, 6], [102, 106], [103, I.surface], [90, I.surface], [93, 106]];
  const wedge = [[52, 6], [188, 6], [138, 106], [102, 106]];
  const label = (x, y, text, anchor = "middle", extra = "") => `<text class="tr-in-label"${extra} x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
  const parts = [
    `<rect class="tr-in-germanium" x="${I.left}" y="${I.surface}" width="${I.right - I.left}" height="${I.baseTop - I.surface}"/>`,
    `<rect class="tr-in-layer" x="${I.left}" y="${I.surface}" width="${I.right - I.left}" height="${I.layer}"/>`,
    `<rect class="tr-in-metal" x="${I.left}" y="${I.baseTop}" width="${I.right - I.left}" height="${I.baseBottom - I.baseTop}"/>`,
    polygon(wedge, "tr-in-plastic"),
    polygon(leftFoil, "tr-in-gold"),
    polygon(mirror(leftFoil), "tr-in-gold"),
    `<path class="tr-in-edge" d="M${I.left} ${I.surface}H${I.right}M${I.left} ${I.baseTop}H${I.right}"/>`,
    `<g data-dyn="inflow"></g><g data-dyn="outflow"></g>`,
    label(60, 62, "emitter", "end", ' data-side="in"'),
    label(180, 62, "collector", "start", ' data-side="out"'),
    label(120, 36, "plastic wedge"),
    label(120, 101, "slit"),
    label(22, 163, "germanium", "start"),
    label(120, 182.5, "metal base"),
    `<g class="tr-mark" data-stepmark="1" transform="translate(74 128)"><circle r="8"/><text font-size="9.2" dy="0.36em">2</text></g>`,
    `<g class="tr-mark" data-stepmark="2" transform="translate(120 146)"><circle r="8"/><text font-size="9.2" dy="0.36em">3</text></g>`,
    `<rect class="tr-in-frame" x="0.75" y="0.75" width="${I.width - 1.5}" height="${I.height - 1.5}" rx="5"/>`,
  ];
  const text = "Magnified view of the point of the wedge: the two gold foil tips, emitter on the left and collector on the right, touch the germanium a slit apart. Charges enter at the emitter, cross just under the surface and reach the collector, where a larger current flows up from the metal base.";
  return `<svg class="tr-inset" viewBox="0 0 ${I.width} ${I.height}" role="img" aria-label="${text}"><clipPath id="tr-inset-clip"><rect x="0.75" y="0.75" width="${I.width - 1.5}" height="${I.height - 1.5}" rx="5"/></clipPath><g clip-path="url(#tr-inset-clip)">${parts.join("")}</g></svg>`;
}

const SCOPE = { width: 200, height: 84, fullVolts: 1.9, seconds: 4 };

function scopeHtml(side, title) {
  const middle = SCOPE.height / 2;
  const frame = `<rect class="tr-scope-frame" x="0.75" y="0.75" width="${SCOPE.width - 1.5}" height="${SCOPE.height - 1.5}" rx="5"/>`;
  const zero = `<path class="tr-scope-zero" d="M4 ${middle}H${SCOPE.width - 4}"/>`;
  const mark = side === "out" ? `<span class="tr-num tr-scope-mark" data-stepmark="4" data-side="out">5</span>` : "";
  return `<div class="tr-scope" data-side="${side}"><svg viewBox="0 0 ${SCOPE.width} ${SCOPE.height}" aria-hidden="true">${frame}${zero}<path class="tr-wave" data-dyn="wave-${side}" d=""/></svg><span class="tr-scope-label">${mark}<span data-dyn="label-${side}">${title}</span></span></div>`;
}

// ---- the page ------------------------------------------------------------------------------------------

const CSS = `
.iso[data-theme="light"]{--anatomy-weight:.9px;--anatomy-lit:#d9480f;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--tr-in:#d9480f;--tr-out:#1864ab;--tr-gold:#d9a514;--tr-gold-edge:#8a6508;--tr-wire:#4a4a50;--tr-wire-core:#c9c9cf;--tr-germanium:#aab4c0;--tr-layer:#f3c9b6;--tr-plastic:#e2eff2;--tr-metal:#c4c4c8}
.iso[data-theme="light"] .tr-wood{--anatomy-shade-0:#d6c9b2;--anatomy-shade-1:#e0d4be;--anatomy-shade-2:#e9dfcb;--anatomy-shade-3:#f0e7d6;--anatomy-top:#f5efe2;--anatomy-lo:#8f8472}
.iso[data-theme="light"] .tr-gold{--anatomy-shade-0:#c99a12;--anatomy-shade-1:#d9aa1c;--anatomy-shade-2:#e6ba30;--anatomy-shade-3:#efc94a;--anatomy-top:#f6d968;--anatomy-hi:#7a5a06;--anatomy-faint:#a57c10}
.iso[data-theme="light"] .tr-germanium{--anatomy-shade-0:#8f9aa8;--anatomy-shade-1:#a0abb8;--anatomy-shade-2:#b2bcc8;--anatomy-shade-3:#c0c9d3;--anatomy-top:#d3dae2;--anatomy-faint:#7d8896}
.iso[data-theme="light"] .tr-plastic{--anatomy-shade-0:#b9d3da;--anatomy-shade-1:#c8dde3;--anatomy-shade-2:#d6e7eb;--anatomy-shade-3:#e2eff2;--anatomy-top:#f1f8f9;--anatomy-mid:#4d6168}
.iso[data-theme="dark"] .tr-plastic{--anatomy-shade-0:#24353b;--anatomy-shade-1:#2b3f46;--anatomy-shade-2:#334a52;--anatomy-shade-3:#3b555e;--anatomy-top:#46626c}
.iso[data-theme="dark"]{--anatomy-weight:.9px;--anatomy-lit:#ff9f43;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--tr-in:#ff9f43;--tr-out:#74c0fc;--tr-gold:#c9971a;--tr-gold-edge:#f0cf6a;--tr-wire:#c9c9d0;--tr-wire-core:#55555c;--tr-germanium:#4a5562;--tr-layer:#6b4336;--tr-plastic:#334a52;--tr-metal:#2c2c31}
.iso[data-theme="dark"] .tr-wood{--anatomy-shade-0:#221c15;--anatomy-shade-1:#28211a;--anatomy-shade-2:#2f271e;--anatomy-shade-3:#362d23;--anatomy-top:#3d3328;--anatomy-lo:#8a7c66}
.iso[data-theme="dark"] .tr-gold{--anatomy-shade-0:#7c5c0c;--anatomy-shade-1:#8f6b10;--anatomy-shade-2:#a47c16;--anatomy-shade-3:#b98e1e;--anatomy-top:#cfa22a;--anatomy-hi:#f0cf6a}
.iso[data-theme="dark"] .tr-germanium{--anatomy-shade-0:#333c47;--anatomy-shade-1:#3c4652;--anatomy-shade-2:#46515e;--anatomy-shade-3:#515d6b;--anatomy-top:#5f6c7b}
.tr-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-weight:600;text-anchor:middle;pointer-events:none}
.tr-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.tr-wire{fill:none;stroke:var(--tr-wire);stroke-width:calc(var(--anatomy-weight)*2.5);stroke-linecap:round;stroke-linejoin:round}
.tr-wire-core{fill:none;stroke:var(--tr-wire-core);stroke-width:calc(var(--anatomy-weight)*.8);stroke-linecap:round;stroke-linejoin:round}
.tr-wire.tr-spring{stroke-width:calc(var(--anatomy-weight)*3.4)}
.tr-board-wire{stroke-width:calc(var(--anatomy-weight)*1.5)}
.tr-lever{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round}
.iso-stage[data-power="on"] [data-dyn="lever-off"],.iso-stage[data-power="off"] [data-dyn="lever-on"]{display:none}
.tr-path{--glow:0;fill:none;stroke:var(--tr-in);stroke-width:calc(var(--anatomy-weight)*2);stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:calc(var(--anatomy-weight)*5) calc(var(--anatomy-weight)*4);opacity:var(--glow);pointer-events:none}
.tr-path[data-side="out"]{stroke:var(--tr-out);stroke-width:calc(var(--anatomy-weight)*4.4);stroke-dasharray:calc(var(--anatomy-weight)*8) calc(var(--anatomy-weight)*5)}
.tr-birth{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:1}
.tr-birth-source{fill:none;stroke:var(--anatomy-mid);stroke-width:1.1;opacity:0}
.tr-birth-lines{fill:none;stroke:var(--anatomy-mid);stroke-width:.9;stroke-dasharray:4 3;opacity:0}
.tr-hit{fill:#000;fill-opacity:0;stroke:none;cursor:pointer;outline:none}
.iso[data-theme="dark"] .tr-hit{fill:#fff}
.tr-hit:hover,.tr-hit:focus-visible{fill-opacity:.14}
.iso-stage[data-open] .tr-hit{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.tr-mark{opacity:0;pointer-events:none}
.tr-mark circle{fill:var(--tr-in)}
.tr-mark[data-side="out"] circle{fill:var(--tr-out)}
.tr-mark text{fill:var(--anatomy-card);font-family:var(--anatomy-mono);font-weight:600;text-anchor:middle}
.tr-under{position:relative;display:grid;grid-template-columns:minmax(0,236px) minmax(0,1fr);gap:12px 16px;align-items:center;margin-top:10px;user-select:none;-webkit-user-select:none}
.tr-inset{display:block;width:100%;height:auto;transform-origin:0 0;background:var(--anatomy-card);border-radius:2.1%/2.5%}
.tr-detail{position:relative;z-index:2}
.tr-in-germanium{fill:var(--tr-germanium)}
.tr-in-layer{fill:var(--tr-layer)}
.tr-in-metal{fill:var(--tr-metal)}
.tr-in-plastic{fill:var(--tr-plastic);stroke:var(--anatomy-lo);stroke-width:.8;stroke-linejoin:round}
.tr-in-gold{fill:var(--tr-gold);stroke:var(--tr-gold-edge);stroke-width:.8;stroke-linejoin:round}
.tr-in-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:.9}
.tr-in-frame,.tr-scope-frame{fill:none;stroke:var(--anatomy-faint);stroke-width:1.5}
.tr-in-label{fill:var(--anatomy-text);font-family:var(--anatomy-mono);font-size:9px;font-weight:600}
.tr-in-label[data-side="in"]{fill:var(--tr-in)}
.tr-in-label[data-side="out"]{fill:var(--tr-out)}
.tr-charge{fill:var(--anatomy-card);stroke:var(--tr-in);stroke-width:1.5}
.tr-charge[data-side="out"]{fill:var(--tr-out);stroke:none}
.tr-tracebox{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;align-items:start}
.tr-scope{display:grid;gap:3px;min-width:0}
.tr-scope svg{display:block;width:100%;height:auto}
.tr-scope-zero{fill:none;stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:3 3}
.tr-wave{fill:none;stroke:var(--tr-in);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.tr-scope[data-side="out"] .tr-wave{stroke:var(--tr-out);stroke-width:2.4}
.tr-scope-label{display:flex;align-items:center;gap:6px;font-family:var(--anatomy-mono);font-size:11px;line-height:1.3;color:var(--tr-in);white-space:nowrap}
.tr-scope[data-side="out"] .tr-scope-label{color:var(--tr-out)}
.tr-scope-mark{display:none}
.tr-trace{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px;font-size:12.5px;line-height:1.3}
.tr-chip{--glow:1;font-weight:600;color:var(--tr-in);opacity:calc(.3 + .7*var(--glow))}
.tr-chip[data-side="out"]{color:var(--tr-out)}
.tr-chip-arrow{color:var(--anatomy-lo)}
.tr-badges{position:absolute;inset:0;pointer-events:none}
.tr-badge,.tr-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.tr-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.tr-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.tr-parts li{display:flex;align-items:center;gap:8px}
.tr-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.tr-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.tr-controls button:hover{color:var(--anatomy-strong)}
.tr-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.tr-controls button:focus-visible,.tr-controls input:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.tr-level{display:flex;align-items:center;gap:8px;margin-left:auto;padding:0 10px;font-size:13px;color:var(--anatomy-muted)}
.tr-level input{width:120px;accent-color:var(--tr-in)}
.tr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.tr-film-legend,.tr-steps{display:none}
html,body{overflow-x:hidden}
@media (max-width:540px){.tr-under{grid-template-columns:minmax(0,1fr)}.tr-detail{width:min(100%,280px);margin:0 auto}.tr-level{margin-left:0}}
`;

const FILM_CSS = `
html,body{margin:0!important;overflow:hidden!important;background:var(--anatomy-card)!important}
.iso{--anatomy-weight:1.7px}
.iso-page{width:1920px!important;margin:0!important}
.iso-figure{margin:0!important}
.iso-plate{width:1920px;height:1080px;padding:0!important;overflow:hidden;box-shadow:none!important;box-sizing:border-box}
.iso-plate-corners{inset:34px 44px!important;z-index:3}
.iso-plate-corner{font-size:21px!important;background:var(--anatomy-card);padding:8px 12px;margin:-8px -12px;border-radius:6px}
.iso-plate-corner[data-corner="hint"]{bottom:0!important}
.iso-legend,.tr-sr{display:none!important}
.tr-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.tr-film-legend{display:grid;grid-template-columns:repeat(4,auto);justify-content:center;gap:12px 34px;position:absolute;left:0;right:0;bottom:92px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--tr-apart,0)}
.tr-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.tr-film-legend .tr-num{width:30px;height:30px;font-size:17px}
.tr-under{position:static;display:block;margin:0}
.tr-detail{position:absolute;left:1236px;top:104px;width:640px;margin:0;z-index:2;opacity:var(--tr-detail,1)}
.tr-birth-source{stroke-width:2}
.tr-birth-lines{stroke-width:1.8;stroke-dasharray:9 7}
.tr-in-frame{stroke-width:.6}
.tr-tracebox{position:absolute;left:44px;right:44px;bottom:84px;display:flex;align-items:center;justify-content:center;gap:36px;z-index:3;opacity:calc(1 - var(--tr-apart,0))}
.tr-scope{width:400px;gap:8px}
.tr-scope-label{font-size:21px;gap:10px}
.tr-scope-mark{display:grid;width:30px;height:30px;font-size:17px;background:var(--tr-out);opacity:0}
.tr-trace{flex-wrap:nowrap;gap:0 16px;font-size:25px;white-space:nowrap}
.tr-chip-arrow{font-size:26px}
.tr-steps{display:grid;gap:12px;position:absolute;left:44px;top:104px;margin:0;padding:0;list-style:none;font-size:24px;color:var(--anatomy-strong);z-index:3;opacity:var(--tr-steps,0)}
.tr-steps li{--glow:0;display:flex;align-items:center;gap:13px;white-space:nowrap;opacity:var(--glow)}
.tr-steps .tr-num{width:34px;height:34px;font-size:19px;background:var(--tr-in)}
.tr-steps li[data-side="out"] .tr-num{background:var(--tr-out)}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  spring: "Spring",
  wedge: "Plastic wedge",
  foil: "Gold foil: emitter, collector",
  germanium: "Germanium slab",
  base: "Metal base",
  leads: "Leads",
  stand: "Stand and test circuit",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="tr-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const badges = `<div class="tr-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="tr-badge" data-badge="${name}">${piece.number}</span>`).join("")}</div>`;
const stepList = `<ol class="tr-steps" aria-hidden="true">${Transistor.STEPS.map((step, index) => `<li data-step-item="${index}" data-side="${step.side}"><span class="tr-num">${index + 1}</span>${step.label}</li>`).join("")}</ol>`;

const chips = [
  `<span class="tr-chip" data-chip="0">small signal in</span>`,
  `<span class="tr-chip" data-chip="1">charges cross the germanium</span>`,
  `<span class="tr-chip" data-chip="2" data-side="out">big signal out</span>`,
];
const traceBox = `<div class="tr-tracebox" aria-hidden="true">${scopeHtml("in", "input")}<div class="tr-trace">${chips.join('<span class="tr-chip-arrow">→</span>')}</div>${scopeHtml("out", "output")}</div>`;
// The layer the birth of the magnified view is drawn on: its source rectangle and four corner lines.
const birthLayer = `<svg class="tr-birth" data-dyn="birth-layer" aria-hidden="true"><rect class="tr-birth-source" data-dyn="birth-source"/><path class="tr-birth-lines" data-dyn="birth-lines" d=""/></svg>`;
const under = `<div class="tr-under"><div class="tr-detail">${insetSvg()}</div>${traceBox}${birthLayer}</div>`;

const levelControl = `<label class="tr-level">Input level<input type="range" data-level min="0" max="100" step="1" value="${Math.round(Transistor.DEFAULTS.inputLevel * 100)}" aria-label="Input signal level"></label>`;
const controls = `<span class="tr-controls" role="group" aria-label="Transistor controls"><button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-bias aria-pressed="true">Bias on</button>${levelControl}</span>`;

const stageLabel = "The first transistor. B or Enter on the switch connects or disconnects the two batteries, the left and right arrow keys lower and raise the input signal, Shift and E take the device apart and put it back together.";

const plate = k.plateHtml({
  fig: "Fig 3",
  title: "Point-contact transistor, 1947",
  hint: "B: bias · ← →: input · Shift+E: apart",
  readout: Transistor.describe(Transistor.createParameters()),
  keys: [
    { mark: "line", label: "Thin orange: the small input current" },
    { mark: "line", label: "Thick blue: the larger output current" },
  ],
  caption:
    "The first transistor, made by John Bardeen and Walter Brattain at Bell Laboratories in December 1947: the key experiment was on 16 December, and on 23 December it was shown to the laboratory's managers, working as a speech amplifier with a power gain of 18. A strip of gold foil lies over the point of a plastic triangle and is sliced through at the tip with a razor blade, which leaves two gold contacts very close together. A spring presses them lightly onto a block of germanium that sits on a metal base. A small current into one contact, the emitter, puts positive charges into the surface of the germanium (\"holes\", places where an electron is missing). They are gathered by the other contact, the collector, and there a larger current flows between the collector and the base. So a small change at the emitter makes a bigger change at the collector, and the extra power comes from the battery. What moves here is a simplified model, not a measurement: the collector current is the emitter current times 2.2 and flows through a larger resistance, with values chosen to land near that power gain of 18; push the input too far and the output clips. With the batteries switched off nothing is amplified. The parts are not to scale, and the slit is drawn far wider than the real one, which Brattain's notebook puts at about 0.04 mm. Bardeen, Brattain and William Shockley shared the 1956 Nobel Prize in Physics.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}" data-power="on">${svg}${badges}</div>${under}${film ? stepList + partsList("tr-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("tr-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="tr-sr" data-announce aria-live="polite"></span>`;

const config = {
  projection: P,
  inset: INSET,
  source: sourceBox(),
  scope: SCOPE,
  explode: {
    film,
    width: WIDTH,
    height: HEIGHT,
    items: items.map((item) => ({ piece: item.piece, bounds: item.bounds, crosses: item.crosses })),
    anchors: ANCHORS,
    apart: apartView(),
    rest: restView(),
  },
};

const read = (name) => readFileSync(join(HERE, name), "utf8").replace(/^export /gm, "");
// The kit's own page builder is not used in the page; its template would put the tags of a whole
// document (doctype, html, head, meta, body) into the script, which the publishable copy must not contain.
const leanKit = kitScript().replace(/return `<!doctype html>[\s\S]*?<\/html>`;/, 'return "";');
const script = `${leanKit}\nlet Transistor;\n{\n${read("model.mjs")}\nTransistor = TransistorApi;\n}\nlet Explode;\n{\n${read("explode.mjs")}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("live.js")}\n${read("apart.js")}\n}\n`;

const TITLE = "First Transistor Anatomy";
const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `first-transistor-anatomy${suffix}.html`;
const html = k.pageHtml({ title: TITLE, theme, body, script, width: 650 });
writeFileSync(join(HERE, file), html);

// The publishable copy: the same page without doctype, html, head, meta and body tags.
function publishCopy() {
  const styles = /<style>[\s\S]*?<\/style>/.exec(html)[0];
  const content = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)[1];
  const lightStart = `<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>`;
  mkdirSync(join(HERE, "publish"), { recursive: true });
  writeFileSync(join(HERE, "publish", "first-transistor-anatomy.html"), `<title>${TITLE}</title>${styles}${lightStart}${content}`);
}

if (!film && theme === "light") publishCopy();

const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)} · order cycles assembled ${measured.cycles}`);
