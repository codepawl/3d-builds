// Builds the Morse telegraph figure as one standalone page.
//   node build.mjs            light page (the shareable one) and publish/morse-telegraph-anatomy.html
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves or changes is a slot that
// live.js fills from the pure model (model.mjs) and the size table (layout.mjs). Every drawn thing is an
// item that belongs to one assembly, so the exploded view (explode.mjs, apart.js) can move and re-sort
// them. Same recipe as ../enigma-anatomy.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import * as G from "../../../src/anatomy-kit/kit/lathe.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { MorseApi as Morse } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createLayout } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 400;
const Layout = createLayout();
const SIZES = Layout.sizes;
const DECK = SIZES.deck;
const BENCH_TOP = SIZES.benchTop;

// The camera is fitted to the outermost real points of the model, not to one box round all of it.
const FIT_POINTS = [
  ...k.boxCorners({ x: -150, y: -42, w: 88, d: 88 }, 0, 8),
  ...k.boxCorners({ x: 56, y: -42, w: 102, d: 88 }, 0, 8),
  ...k.boxCorners({ x: -147, y: -36, w: 35, d: 31 }, 8, 34),
  ...k.boxCorners({ x: -43, y: -37, w: 84, d: 26 }, 84, 94),
  ...k.boxCorners({ x: 123.5, y: 27.5, w: 11.5, d: 51.5 }, 34, 38),
  ...k.boxCorners({ x: 112, y: -35, w: 26, d: 73 }, 8, 48),
];
const P = k.fitProjection(FIT_POINTS, WIDTH, HEIGHT, { pad: film ? 190 : 22 });

const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const trace = (points, closed = false) => k.pathOf(points.map((point) => k.iso(point, P)), closed);

function box(x0, x1, y0, y1, z0, z1, style = {}) {
  const paths = k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: style.r ?? 0.5 }, z0, z1 - z0, P, 2, style.bevel ?? 0.3);
  return S(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner, className: style.className });
}

// An upright round part.
function can(x, y, radius, z0, z1, style = {}) {
  return S(k.cylinder(x, y, radius, z0, z1 - z0, P, style.steps ?? 20, style.bevel ?? 0), { tone: style.tone ?? "mid", className: style.className, crease: style.crease });
}

// A turned part lying along x: a roller, a reel, a gear wheel.
function alongX(x0, x1, y, z, radius, style = {}) {
  const frame = G.frameAlong([x0, y, z], [1, 0, 0]);
  return S(G.disc(0, x1 - x0, radius, frame, P), { tone: style.tone ?? "mid", className: style.className });
}

function circleOnTop(x, y, radius, z) {
  return k.planOutline({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2, r: radius }, z, P, 6);
}

// A circle on a face that looks along x.
function circleFacingX(x, y, z, radius) {
  const points = [];
  for (let step = 0; step < 28; step++) {
    const angle = (step / 28) * Math.PI * 2;
    points.push([x, y + radius * Math.cos(angle), z + radius * Math.sin(angle)]);
  }
  return trace(points, true);
}

function wire(points, className = "mt-wire") {
  return `<path class="${className}" d="${trace(points)}"/>`;
}

function boundsOf(points, pad = 0.3) {
  const low = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])) - pad);
  const high = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])) + pad);
  return [low[0], high[0], low[1], high[1], low[2], high[2]];
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

function slab(piece, label, x0, x1, y0, y1, z0, z1, style) {
  put(piece, label, box(x0, x1, y0, y1, z0, z1, style), [x0, x1, y0, y1, z0, z1], true);
}

function round(piece, label, x, y, radius, z0, z1, style) {
  put(piece, label, can(x, y, radius, z0, z1, style), [x - radius, x + radius, y - radius, y + radius, z0, z1], false);
}

function roller(piece, label, x0, x1, y, z, radius, style) {
  put(piece, label, alongX(x0, x1, y, z, radius, style), [x0, x1, y - radius, y + radius, z - radius, z + radius], false);
}

function cornerScrews(x0, x1, y0, y1, z, inset) {
  const points = [];
  for (const x of [x0 + inset, x1 - inset]) {
    for (const y of [y0 + inset, y1 - inset]) points.push(at(x, y, z));
  }
  return D(points, { size: 0.5 });
}

function terminalScrews(spots, z) {
  return D(spots.map(([x, y]) => at(x, y, z)), { size: 0.9, tone: "hi" });
}

function bench(side, label) {
  const B = SIZES[side];
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: B.x0, y: B.y0, w: B.x1 - B.x0, d: B.y1 - B.y0, r: 2 }, 0, 1, P)}"/>`;
  let planks = "";
  for (let y = B.y0 + 22; y < B.y1 - 4; y += 22) planks += k.lineOnTop([B.x0, y], [B.x1, y], BENCH_TOP, P);
  const body = box(B.x0, B.x1, B.y0, B.y1, 0, BENCH_TOP, { tone: "lo", bevel: 0.8, r: 0.8, inner: Ln(planks, { tone: "faint" }) });
  put("bench", label, `${halo}<g class="mt-wood">${body}</g>`, [B.x0, B.x1, B.y0, B.y1, 0, BENCH_TOP], true);
  also(cornerScrews(B.x0, B.x1, B.y0, B.y1, BENCH_TOP, 3));
}

function benchWiring(side, names) {
  const wires = Layout.benchWires();
  const B = SIZES[side];
  const markup = names.map((name) => wire(wires[name])).join("");
  const ends = names.flatMap((name) => [wires[name][0], wires[name][wires[name].length - 1]]);
  put("bench", `${side} bench wiring`, markup + D(ends.map((point) => k.iso(point, P)), { size: 0.8, tone: "hi" }), [B.x0, B.x1, B.y0, B.y1, BENCH_TOP, SIZES.wireLevel + 0.1]);
}

function bindingPost(label, [x, y]) {
  const radius = SIZES.postRadius;
  const stem = can(x, y, radius, BENCH_TOP, SIZES.postTop - 1.3, { tone: "mid", className: "mt-brass", steps: 12 });
  const cap = can(x, y, radius + 0.5, SIZES.postTop - 1.3, SIZES.postTop, { tone: "hi", className: "mt-brass", steps: 14, bevel: 0.3 });
  put("bench", label, stem + cap + D([at(x, y, SIZES.postTop)], { size: 0.5, tone: "hi" }), [x - radius - 0.5, x + radius + 0.5, y - radius - 0.5, y + radius + 0.5, BENCH_TOP, SIZES.postTop]);
}

function earthPlate(side) {
  const E = SIZES.earthPlate[side];
  const top = SIZES.earthPlate.top;
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: E.x0, y: E.y0, w: E.x1 - E.x0, d: E.y1 - E.y0, r: 1 }, 0, 1, P)}"/>`;
  put("bench", `${side} earth plate`, halo + box(E.x0, E.x1, E.y0, E.y1, 0, top, { tone: "mid", className: "mt-brass", bevel: 0.2 }), [E.x0, E.x1, E.y0, E.y1, 0, top], true);
  const lead = Layout.earthLead(side);
  put("bench", `${side} earth lead`, wire(lead) + D([k.iso(lead[lead.length - 1], P)], { size: 0.9, tone: "hi" }), boundsOf(lead));
}

function batteryOf(piece, battery, label) {
  const T = battery.tray;
  const C = SIZES.cell;
  slab(piece, `${label} tray`, T.x0, T.x1, T.y0, T.y1, BENCH_TOP, DECK, { className: "mt-wood", tone: "lo" });
  const cells = battery.cells.slice().sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [x, y] of cells) {
    const jarTop = DECK + C.height;
    const jar = can(x, y, C.radius, DECK, jarTop, { tone: "lo", className: "mt-glass", steps: 26 });
    const rim = Ln(circleOnTop(x, y, C.radius - 1, jarTop), { tone: "faint" });
    const cap = can(x, y, C.capRadius, jarTop, jarTop + C.capHeight, { tone: "mid", steps: 16, bevel: 0.3 });
    const terminals = D(Layout.cellTerminals([x, y]).map((point) => k.iso(point, P)), { size: 0.7, tone: "hi" });
    put(piece, `${label} cell`, jar + rim + cap + terminals, [x - C.radius, x + C.radius, y - C.radius, y + C.radius, DECK, jarTop + C.capHeight], true);
  }
  const straps = Layout.batteryStraps(battery);
  put(piece, `${label} straps`, straps.map((strap) => wire(strap, "mt-wire mt-strap")).join(""), boundsOf(straps.flat()));
}

// A pivoted lever between two posts: far post, lever (a slot the page tilts), near post.
function leverBetweenPosts(postPiece, leverPiece, name, part, leverMarkup, leverBounds, front = null) {
  const X = part.posts;
  const [farFrom, farTo] = X.far;
  const [nearFrom, nearTo] = X.near;
  slab(postPiece, `${name} far pivot post`, X.x0, X.x1, farFrom, farTo, DECK, X.top, { className: "mt-brass" });
  put(leverPiece, `${name} lever`, `<g data-dyn="tilt" data-lever="${name}">${leverMarkup}</g>`, leverBounds, true);
  slab(postPiece, `${name} near pivot post`, X.x0, X.x1, nearFrom, nearTo, DECK, X.top, { className: "mt-brass" });
  also(D([at(part.pivot[0], nearTo, part.pivot[2])], { size: 0.7, tone: "hi" }));
  // The part of a lever that reaches over its magnet is drawn after the coils and the near post.
  if (front) put(leverPiece, `${name} lever over the magnet`, `<g data-dyn="tilt" data-lever="${name}">${front.markup}</g>`, front.bounds, true);
}

function springItem(piece, label, x, y, radius, z0, z1, turns) {
  const points = Layout.helix(x, y, radius, z0, z1, turns);
  put(piece, label, wire(points, "mt-spring"), [x - radius, x + radius, y - radius, y + radius, z0, z1]);
}

function sendingKey() {
  const K = SIZES.key;
  const B = K.base;
  const L = K.lever;
  const y = K.pivot[1];
  slab("key", "key base", B.x0, B.x1, B.y0, B.y1, BENCH_TOP, DECK, { className: "mt-wood", tone: "lo", bevel: 0.5 });
  also(cornerScrews(B.x0, B.x1, B.y0, B.y1, DECK, 2.2) + terminalScrews([K.rear, K.front], DECK));
  round("key", "key back stop", K.stop.x, y, K.stop.radius, DECK, L.z0, { className: "mt-brass", steps: 12 });
  round("key", "key anvil contact", K.anvil.x, y, K.anvil.radius, DECK, K.anvil.top, { className: "mt-brass", tone: "hi", steps: 14 });
  also(D([at(K.anvil.x, y, K.anvil.top)], { size: 0.6, tone: "hi" }));
  springItem("key", "key spring", K.spring.x, y, K.spring.radius, DECK, L.z0, K.spring.turns);
  const bar = box(L.x0, L.x1, L.y0, L.y1, L.z0, L.z1, { className: "mt-brass", tone: "hi" });
  const stud = can(K.anvil.x, y, 1.1, K.stud.z0, L.z0, { className: "mt-brass", tone: "hi", steps: 10 });
  const stem = can(K.knob.x, y, 1.3, L.z1, K.knob.stemTop, { tone: "mid", steps: 10 });
  const knob = can(K.knob.x, y, K.knob.radius, K.knob.stemTop, K.knob.top, { tone: "hi", steps: 24, bevel: 0.7, className: "mt-knob" });
  const dish = Ln(circleOnTop(K.knob.x, y, K.knob.radius - 1.5, K.knob.top), { tone: "lo" });
  const hit = `<path class="mt-hit" data-hit="key" tabindex="0" role="button" aria-label="Telegraph key. Hold it down for a dash, tap it for a dot." d="${circleOnTop(K.knob.x, y, K.knob.radius + 2.5, K.knob.top)}"/>`;
  leverBetweenPosts("key", "lever", "key", K, stud + bar + stem + knob + dish + hit, [L.x0, L.x1, L.y0, L.y1, K.stud.z0, K.knob.top]);
}

function pole(index) {
  const O = SIZES.poles;
  const x = O.xs[index];
  const name = index === 0 ? "sending" : "receiving";
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: x - O.half, y: O.y - O.half, w: O.half * 2, d: O.half * 2, r: 1 }, 0, 1, P)}"/>`;
  put("line", `${name} pole`, `${halo}<g class="mt-wood">${box(x - O.half, x + O.half, O.y - O.half, O.y + O.half, 0, O.top, { tone: "lo" })}</g>`, [x - O.half, x + O.half, O.y - O.half, O.y + O.half, 0, O.top], true);
  put("line", `${name} cross arm`, `<g class="mt-wood">${box(x - O.arm.half, x + O.arm.half, O.arm.y0, O.arm.y1, O.top, O.arm.top, { tone: "lo" })}</g>`, [x - O.arm.half, x + O.arm.half, O.arm.y0, O.arm.y1, O.top, O.arm.top], true);
  also(D([at(x + O.arm.half, O.y - 1, O.top + 1.5), at(x + O.arm.half, O.y + 1, O.top + 1.5)], { size: 0.45 }));
  const pin = can(x, O.y, 0.8, O.arm.top, O.pinTop, { tone: "mid", steps: 8 });
  const bell = can(x, O.y, O.bellRadius, O.pinTop, O.bellTop, { tone: "hi", className: "mt-glass", steps: 18, bevel: 1 });
  const groove = Ln(k.sideArc(x, O.y, O.bellRadius, O.tie, P), { tone: "mid" });
  put("line", `${name} insulator`, pin + bell + groove, [x - O.bellRadius, x + O.bellRadius, O.y - O.bellRadius, O.y + O.bellRadius, O.arm.top, O.bellTop]);
}

// The two cut ends of the line carry a pair of short strokes: the drawing's sign for "many miles left out".
function breakMark([x, y, z]) {
  let d = "";
  for (const shift of [-0.9, 0.9]) d += trace([[x + shift - 0.9, y, z - 2.6], [x + shift + 0.9, y, z + 2.6]]);
  return `<path class="mt-wire mt-break" d="${d}"/>`;
}

function lineWire() {
  const [first, second] = Layout.lineSpans();
  const marks = breakMark(first[first.length - 1]) + breakMark(second[0]);
  put("line", "line wire", wire(first, "mt-wire mt-linewire") + wire(second, "mt-wire mt-linewire") + marks, boundsOf([...first, ...second]));
  for (const side of ["send", "receive"]) {
    const drop = Layout.dropWire(side);
    put("line", `${side} drop wire`, wire(drop, "mt-wire mt-linewire"), boundsOf(drop));
  }
}

function coilOf(piece, label, [x, y], coil) {
  const lower = can(x, y, coil.flange, DECK, coil.z0, { className: "mt-brass", steps: 22 });
  const body = can(x, y, coil.radius, coil.z0, coil.z1, { className: "mt-coil", steps: 24 });
  let windings = "";
  for (let z = coil.z0 + 1.4; z < coil.z1 - 0.6; z += 1.5) windings += k.sideArc(x, y, coil.radius, z, P);
  const upper = can(x, y, coil.flange, coil.z1, coil.flangeTop, { className: "mt-brass", steps: 22 });
  const core = can(x, y, coil.coreRadius, coil.flangeTop, coil.coreTop, { tone: "hi", steps: 12 });
  put(piece, label, lower + body + Ln(windings, { tone: "lo" }) + upper + core, [x - coil.flange, x + coil.flange, y - coil.flange, y + coil.flange, DECK, coil.coreTop], true);
}

function relay() {
  const R = SIZES.relay;
  const B = R.base;
  const L = R.lever;
  const y = R.pivot[1];
  slab("relay", "relay base", B.x0, B.x1, B.y0, B.y1, BENCH_TOP, DECK, { className: "mt-wood", tone: "lo", bevel: 0.5 });
  also(cornerScrews(B.x0, B.x1, B.y0, B.y1, DECK, 2.2) + terminalScrews([R.coilIn, R.coilOut, R.arm, R.point], DECK));
  R.coils.forEach((spot, index) => coilOf("relay", `relay coil ${index + 1}`, spot, R.coil));
  round("relay", "relay contact post", R.contact.x, y, R.contact.radius, DECK, R.contact.top, { className: "mt-brass", tone: "hi", steps: 12 });
  also(D([at(R.contact.x, y, R.contact.top)], { size: 0.6, tone: "hi" }));
  springItem("relay", "relay return spring", R.spring.x, y, R.spring.radius, DECK, L.z0, R.spring.turns);
  const pad = box(R.pad.x0, R.pad.x1, R.pad.y0, R.pad.y1, R.pad.z0, L.z0, { tone: "mid" });
  const bar = box(L.x0, L.x1, L.y0, L.y1, L.z0, L.z1, { className: "mt-brass", tone: "hi" });
  const stud = can(R.contact.x, y, 0.8, R.stud.z0, L.z0, { tone: "hi", steps: 10 });
  leverBetweenPosts("relay", "relay", "relay", R, stud + pad + bar, [L.x0, L.x1, R.pad.y0, R.pad.y1, R.pad.z0, L.z1]);
}

function registerMagnet() {
  const R = SIZES.register;
  const B = R.base;
  const L = R.lever;
  const y = R.pivot[1];
  slab("magnet", "register base", B.x0, B.x1, B.y0, B.y1, BENCH_TOP, DECK, { className: "mt-wood", tone: "lo", bevel: 0.5 });
  also(cornerScrews(B.x0, B.x1, B.y0, B.y1, DECK, 2.2) + terminalScrews([R.coilIn, R.coilOut], DECK));
  R.coils.forEach((spot, index) => coilOf("magnet", `register coil ${index + 1}`, spot, R.coil));
  springItem("magnet", "register return spring", R.spring.x, y, R.spring.radius, DECK, L.z0, R.spring.turns);
  const pad = box(R.pad.x0, R.pad.x1, R.pad.y0, R.pad.y1, R.pad.z0, L.z0, { tone: "mid" });
  const split = R.posts.x1 + 0.5;
  const bar = box(L.x0, split, L.y0, L.y1, L.z0, L.z1, { className: "mt-brass", tone: "hi" });
  const overMagnet = box(split, L.x1, L.y0, L.y1, L.z0, L.z1, { className: "mt-brass", tone: "hi" });
  const shank = can(R.stylus.x, y, R.stylus.radius, L.z1, R.stylus.top - 0.9, { tone: "hi", steps: 10 });
  const tip = can(R.stylus.x, y, 0.35, R.stylus.top - 0.9, R.stylus.top, { tone: "hi", steps: 8 });
  leverBetweenPosts("magnet", "magnet", "register", R, bar + shank + tip, [L.x0, split, L.y0, L.y1, L.z0, R.stylus.top], { markup: pad + overMagnet, bounds: [split, L.x1, R.pad.y0, R.pad.y1, R.pad.z0, L.z1] });
}

// The stylus works under the tape, where it cannot be seen. This draws it again over everything, as a
// dark pin with its point at the tape, so the zoom frame shows it rising into the paper at each mark.
function stylusGhost() {
  const R = SIZES.register;
  const y = R.pivot[1];
  const top = R.stylus.top;
  const pin = `<path class="mt-ghost" d="${trace([[R.stylus.x, y, R.lever.z1], [R.stylus.x, y, top - 2.4]])}"/>`;
  const point = `<path class="mt-ghost-tip" d="${trace([[R.stylus.x, y - 1.5, top - 2.4], [R.stylus.x, y + 1.5, top - 2.4], [R.stylus.x, y, top]], true)}"/>`;
  put("magnet", "stylus seen through the tape", `<g data-dyn="tilt" data-lever="register">${pin}${point}</g>`);
}

function clockwork() {
  const R = SIZES.register;
  const A = R.plate;
  const O = R.rollers;
  slab("clockwork", "clockwork plate", A.x0, A.x1, A.y0, A.y1, DECK, A.top, { className: "mt-brass", bevel: 0.2 });
  also(D([at(A.x1, A.y0 + 2, A.top - 2), at(A.x1, A.y1 - 2, A.top - 2), at(A.x1, A.y0 + 2, DECK + 2), at(A.x1, A.y1 - 2, DECK + 2)], { size: 0.5 }));
  R.gears.wheels.forEach((wheel, index) => {
    const face = R.gears.x1 + 0.05;
    roller("clockwork", `gear wheel ${index + 1}`, R.gears.x0, R.gears.x1, wheel.y, wheel.z, wheel.r, { className: "mt-brass" });
    also(Ln(circleFacingX(face, wheel.y, wheel.z, wheel.r - 1), { tone: "lo" }) + `<path class="mt-spoke" data-dyn="spokes" data-wheel="${index}" d=""/>` + D([at(face, wheel.y, wheel.z)], { size: 0.8, tone: "hi" }));
  });
  roller("clockwork", "lower feed roller", O.x0, O.x1, O.feedBottom[0], O.feedBottom[1], O.radius, { tone: "mid" });
  also(D([at(O.x1, O.feedBottom[0], O.feedBottom[1])], { size: 0.6, tone: "hi" }));
  const K = R.bracket;
  slab("clockwork", "shelf bracket", K.x0, K.x1, K.y0, K.y1, DECK, R.shelf.z0, { className: "mt-brass" });
  slab("clockwork", "reading shelf", R.shelf.x0, R.shelf.x1, R.shelf.y0, R.shelf.y1, R.shelf.z0, R.shelf.z1, { className: "mt-wood", tone: "lo" });
  for (const [name, spot] of [["grooved roller", O.grooved], ["upper feed roller", O.feedTop]]) {
    roller("clockwork", name, O.x0, O.x1, spot[0], spot[1], O.radius, { tone: "hi", className: "mt-brass" });
    also(Ln(circleFacingX(O.x1 + 0.05, spot[0], spot[1], 1.1), { tone: "lo" }) + D([at(O.x1, spot[0], spot[1])], { size: 0.5, tone: "hi" }));
  }
}

function tapeQuad(points) {
  return `<path class="mt-paper" d="${trace(points, true)}"/>`;
}

function reelAndTape() {
  const E = SIZES.reel;
  const T = SIZES.tape;
  const F = E.foot;
  slab("reel", "reel foot", F.x0, F.x1, F.y0, F.y1, BENCH_TOP, F.top, { className: "mt-wood", tone: "lo" });
  const upright = (name, [x0, x1]) => slab("reel", `${name} reel upright`, x0, x1, E.stand.y0, E.stand.y1, F.top, E.stand.top, { className: "mt-wood", tone: "lo" });
  upright("far", E.stand.far);
  roller("reel", "far reel flange", E.x0 - 1.2, E.x0, E.y, E.z, E.flange, { className: "mt-brass" });
  roller("reel", "paper roll", E.x0, E.x1, E.y, E.z, E.radius, { tone: "hi", className: "mt-paper-roll" });
  put("reel", "tape from the reel", tapeQuad([[T.x0, T.reelTop[0], T.reelTop[1]], [T.x1, T.reelTop[0], T.reelTop[1]], [T.x1, T.flatFrom, T.level], [T.x0, T.flatFrom, T.level]]), [T.x0, T.x1, T.reelTop[0], T.flatFrom, T.level, T.reelTop[1]]);
  roller("reel", "near reel flange", E.x1, E.x1 + 1.2, E.y, E.z, E.flange, { className: "mt-brass" });
  also(Ln(circleFacingX(E.x1 + 1.25, E.y, E.z, 3), { tone: "lo" }));
  upright("near", E.stand.near);
  also(D([at(E.stand.near[1], E.y, E.z)], { size: 0.9, tone: "hi" }));
  const flat = tapeQuad([[T.x0, T.flatFrom, T.level], [T.x1, T.flatFrom, T.level], [T.x1, T.end, T.level], [T.x0, T.end, T.level]]);
  put("reel", "tape under the stylus", `${flat}<path class="mt-marks" data-dyn="marks" d=""/>`, [T.x0, T.x1, T.flatFrom, T.end, T.level - 0.1, T.level + 0.1]);
  const curl = [[T.end, T.level], ...T.curl];
  const edge = (x) => curl.map(([y, z]) => [x, y, z]);
  put("reel", "tape end", tapeQuad([...edge(T.x0), ...edge(T.x1).reverse()]), [T.x0, T.x1, T.end, T.curl[T.curl.length - 1][0], T.curl[T.curl.length - 1][1], T.level + 0.1]);
}

// A run of the lit path cut into the stretches that lie on a bench top and the stretches that do not.
function stretchesOf(run) {
  const onBench = (point) => Math.abs(point[2] - SIZES.wireLevel) < 0.01;
  const stretches = [];
  for (let index = 1; index < run.length; index++) {
    const low = onBench(run[index - 1]) && onBench(run[index]);
    const last = stretches[stretches.length - 1];
    if (last && last.low === low) last.points.push(run[index]);
    else stretches.push({ low, points: [run[index - 1], run[index]] });
  }
  return stretches;
}

function litSegments(low) {
  const routes = Layout.pathRoutes();
  return Morse.PATH_SEGMENTS.map((name, index) => {
    const stretches = routes[name].flatMap((run) => stretchesOf(run)).filter((stretch) => stretch.low === low);
    const d = stretches.map((stretch) => trace(stretch.points)).join("");
    const kind = index >= Morse.LOCAL_FROM ? " data-local" : "";
    return `<path class="mt-path" data-dyn="segment" data-segment="${name}"${kind} d="${d}"/>`;
  }).join("");
}

// The lit path is drawn in two layers: the wires lying on the benches go under the instruments, as the
// wires themselves do; the rest (through coils, levers, the line, the earth) is drawn over everything.
function litWiresOnBenches() {
  put("bench", "lit wires on the benches", litSegments(true), [SIZES.send.x0, SIZES.receive.x1, SIZES.send.y0, SIZES.send.y1, BENCH_TOP, SIZES.wireLevel + 0.1]);
}

function currentPath() {
  put("bench", "current path", litSegments(false));
}

bench("send", "sending bench");
bench("receive", "receiving bench");
benchWiring("send", ["batteryToKey", "keyToLine", "earthToBattery"]);
benchWiring("receive", ["lineToRelay", "relayToEarth", "localToRelay", "relayToRegister", "registerToLocal"]);
litWiresOnBenches();
earthPlate("send");
earthPlate("receive");
bindingPost("line post, sending", SIZES.linePost.send);
bindingPost("earth post, sending", SIZES.earthPost.send);
bindingPost("battery minus post", SIZES.battery.minus);
bindingPost("battery plus post", SIZES.battery.plus);
bindingPost("line post, receiving", SIZES.linePost.receive);
bindingPost("earth post, receiving", SIZES.earthPost.receive);
bindingPost("local battery minus post", SIZES.localBattery.minus);
bindingPost("local battery plus post", SIZES.localBattery.plus);
batteryOf("battery", SIZES.battery, "line battery");
sendingKey();
pole(0);
pole(1);
lineWire();
relay();
batteryOf("local", SIZES.localBattery, "local battery");
registerMagnet();
clockwork();
reelAndTape();
currentPath();
stylusGhost();

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
  battery: [SIZES.battery.cells[3][0], SIZES.battery.cells[3][1], Layout.cellTop()],
  key: [SIZES.key.base.x0 + 4, SIZES.key.base.y1 - 4, DECK],
  lever: [SIZES.key.lever.x0 + 4, SIZES.key.pivot[1], SIZES.key.lever.z1],
  line: [SIZES.poles.xs[0], SIZES.poles.y, SIZES.poles.bellTop + 3],
  relay: [SIZES.relay.base.x1 - 4, SIZES.relay.base.y1 - 4, DECK],
  local: [SIZES.localBattery.cells[1][0], SIZES.localBattery.cells[1][1], Layout.cellTop()],
  magnet: [SIZES.register.base.x1 - 4, SIZES.register.base.y0 + 4, DECK],
  clockwork: [SIZES.register.plate.x1, SIZES.register.plate.y1 - 4, SIZES.register.plate.top - 4],
  reel: [SIZES.reel.stand.near[1], SIZES.reel.y, SIZES.reel.stand.top - 3],
  bench: [SIZES.send.x1 - 5, SIZES.send.y1 - 5, BENCH_TOP],
};

function apartView() {
  const shifts = Explode.fullShifts();
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

const scene = `<g id="mt-scene" data-dyn="world">${items.map((item) => `<g class="mt-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;

// The zoom frame: one enlarged view of the same live drawing, held on the stylus and the rollers. It is
// born from a source rectangle on the model (live.js places every part of it), so nothing of it is fixed
// here but its final place, its size and how far it magnifies.
const INSET = film
  ? { x: 1392, y: 92, width: 480, height: 350, scale: 2.1, radius: 14, weight: 0.85, focus: [131, 27, 33] }
  : { x: 424, y: 26, width: 150, height: 110, scale: 1.5, radius: 5, weight: 0.6, focus: [131, 27, 33] };

function insetMarkup() {
  const ties = '<line class="mt-inset-tie" data-inset="tie"/>'.repeat(4);
  const clip = '<clipPath id="mt-inset-clip"><rect data-inset="clip"/></clipPath>';
  const view = '<g clip-path="url(#mt-inset-clip)"><use href="#mt-scene" data-inset="view"/></g>';
  const frame = `<g data-inset="frame">${clip}<rect class="mt-inset-paper" data-inset="paper"/>${view}<rect class="mt-inset-edge" data-inset="edge"/></g>`;
  return `<g class="mt-inset" data-inset="all" opacity="0"><rect class="mt-inset-source" data-inset="source"/>${ties}${frame}</g>`;
}

const world = `<g data-dyn="lens">${scene}</g>${insetMarkup()}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A Morse telegraph of the 1840s drawn as an isometric model on two benches. On the left bench are a battery of four cells and the key: a brass lever on a pivot with a knob, a spring and a contact. A wire climbs from the key to a glass insulator on a pole, crosses to a second pole with most of its length left out, and comes down to the right bench. There it passes through the two coils of a relay and returns through earth plates on the floor. The relay's armature closes a second circuit from a local battery through the two coils of the register, whose lever carries a stylus under a paper tape. Clockwork pulls the tape from a reel, under a grooved roller and out along a shelf, where the embossed dots and dashes can be read. Pressing the key lights the path of the current through both circuits and marks the tape. The model can be taken apart into ten numbered assemblies.",
  body: world,
});

// The materials: four side tones and a top tone each, per theme. The classes only point at variables set
// on the page's root, so they also hold inside the zoom frame, which is a <use> copy.
const TINTS = {
  wood: { light: ["#cbb894", "#d6c5a4", "#e0d1b4", "#e9dcc3", "#f1e7d2"], dark: ["#221c15", "#28211a", "#2f271e", "#362d23", "#3d3328"] },
  brass: { light: ["#cdbb7e", "#d9c88d", "#e4d49d", "#eddfae", "#f5eac0"], dark: ["#2a2415", "#322b19", "#3b331e", "#443b23", "#4e4428"] },
  glass: { light: ["#bfced2", "#cddadd", "#dae5e7", "#e6eeef", "#f0f6f6"], dark: ["#1c2326", "#232b2f", "#2a3438", "#323d41", "#3b474b"] },
  coil: { light: ["#cbc9a9", "#d7d5b7", "#e2e0c6", "#ebe9d4", "#f3f2e2"], dark: ["#23231a", "#2a2a20", "#323226", "#3a3a2d", "#434334"] },
  knob: { light: ["#3c3c42", "#4a4a51", "#5a5a61", "#6a6a72", "#7b7b83"], dark: ["#0c0c0e", "#121214", "#18181b", "#1f1f23", "#27272b"] },
  "paper-roll": { light: ["#e2ddc9", "#ebe6d4", "#f3efdf", "#f9f6e9", "#fffdf4"], dark: ["#3a3a35", "#42423c", "#4a4a44", "#52524b", "#5b5b53"] },
};
const TONE_NAMES = ["--anatomy-shade-0", "--anatomy-shade-1", "--anatomy-shade-2", "--anatomy-shade-3", "--anatomy-top"];

function tintVariables(themeName) {
  const lines = [];
  for (const [name, sets] of Object.entries(TINTS)) {
    sets[themeName].forEach((colour, index) => lines.push(`--mt-${name}-${index}:${colour}`));
  }
  return `.iso[data-theme="${themeName}"]{${lines.join(";")}}`;
}

function tintRule(name) {
  return `.mt-${name}{${TONE_NAMES.map((tone, index) => `${tone}:var(--mt-${name}-${index})`).join(";")}}`;
}

const TINT_CSS = [tintVariables("light"), tintVariables("dark"), ...Object.keys(TINTS).map(tintRule), '.iso[data-theme="light"]{--mt-wood-lo:#8a7b62}', '.iso[data-theme="dark"]{--mt-wood-lo:#8a7c66}', ".mt-wood{--anatomy-lo:var(--mt-wood-lo)}"].join("\n");

const CSS = `
${TINT_CSS}
.iso[data-theme="light"]{--anatomy-weight:.9px;--anatomy-lit:#d9480f;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--mt-wire:#3a3a40;--mt-line:#d9480f;--mt-local:#1864ab;--mt-paper:#fffdf4;--mt-ink:#1a1a1e}
.iso[data-theme="dark"]{--anatomy-weight:.9px;--anatomy-lit:#ff9f43;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--mt-wire:#c9c9d0;--mt-line:#ff9f43;--mt-local:#74c0fc;--mt-paper:#55554e;--mt-ink:#f4f4f6}
.mt-wire{fill:none;stroke:var(--mt-wire);stroke-width:calc(var(--anatomy-weight)*1.25);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.mt-linewire{stroke-width:calc(var(--anatomy-weight)*1.5)}
.mt-strap{stroke-width:calc(var(--anatomy-weight)*1.7)}
.mt-break{stroke-width:calc(var(--anatomy-weight)*1.3)}
.mt-spring{fill:none;stroke:var(--anatomy-mid);stroke-width:calc(var(--anatomy-weight)*.9);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.mt-spoke{fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linecap:round;pointer-events:none}
.mt-paper{fill:var(--mt-paper);stroke:var(--anatomy-mid);stroke-width:calc(var(--anatomy-weight)*.8);stroke-linejoin:round}
.mt-marks{fill:none;stroke:var(--mt-ink);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round;pointer-events:none}
.mt-path{--glow:0;fill:none;stroke:var(--mt-line);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round;stroke-linejoin:round;opacity:var(--glow);pointer-events:none}
.mt-path[data-local]{stroke:var(--mt-local)}
.mt-path[data-segment="earth"]{stroke-dasharray:calc(var(--anatomy-weight)*5.5) calc(var(--anatomy-weight)*3.4)}
.mt-tracebox{margin-top:12px;user-select:none;-webkit-user-select:none}
.mt-trace{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:8px 10px;font-family:var(--anatomy-mono)}
.mt-cell{display:grid;justify-items:center;gap:5px}
.mt-cell-label{font-size:9.5px;line-height:1;color:var(--anatomy-muted);white-space:nowrap}
.mt-letter{display:grid;place-items:center;min-width:34px;height:34px;font-size:24px;font-weight:700;line-height:1;color:var(--anatomy-strong)}
.mt-code{display:flex;align-items:center;justify-content:center;gap:5px;min-width:96px;height:34px}
.mt-element{--glow:0;display:block;height:8px;border-radius:4px;background:var(--mt-line);opacity:calc(.22 + .78*var(--glow))}
.mt-element[data-kind="."]{width:8px}
.mt-element[data-kind="-"]{width:22px}
.mt-element[data-kind="="]{width:36px}
.mt-element[data-kind="#"]{width:50px}
.mt-element[data-kind=" "]{width:7px;background:none}
.mt-arrow{color:var(--anatomy-lo);font-size:13px;line-height:34px}
.mt-strip{display:block;width:min(300px,78vw);height:auto}
.mt-strip-paper{fill:var(--mt-paper);stroke:var(--anatomy-lo);stroke-width:.8}
.mt-strip-mark{fill:var(--mt-ink)}
.mt-strip-stylus{fill:var(--mt-local)}
.mt-strip-text{fill:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:11px;font-weight:700;text-anchor:middle}
.mt-pathkey{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 20px;margin-top:10px;font-size:12px;color:var(--anatomy-muted)}
.mt-pathkey span{display:flex;align-items:center;gap:8px;white-space:nowrap}
.mt-swatch{display:block;width:24px;border-top:3px solid var(--mt-line)}
.mt-swatch[data-local]{border-top-color:var(--mt-local)}
.mt-steps,.mt-stepmark{display:none}
.mt-hit{fill:#000;fill-opacity:0;stroke:none;cursor:pointer;outline:none}
.iso[data-theme="dark"] .mt-hit{fill:#fff}
.mt-hit:hover,.mt-hit:focus-visible{fill-opacity:.14}
.iso-stage[data-open] .mt-hit{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none;cursor:pointer}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.mt-badges{position:absolute;inset:0;pointer-events:none}
.mt-badge,.mt-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.mt-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.mt-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.mt-parts li{display:flex;align-items:flex-start;gap:8px}
.mt-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.mt-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.mt-controls button:hover{color:var(--anatomy-strong)}
.mt-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.mt-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.mt-controls [data-step]{margin-left:auto}
.mt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.mt-film-legend{display:none}
.mt-inset{pointer-events:none}
.mt-inset-paper{fill:var(--anatomy-card)}
.mt-inset-edge,.mt-inset-source{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.mt-inset-tie{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-dasharray:calc(var(--anatomy-weight)*4) calc(var(--anatomy-weight)*3.6);stroke-linecap:round}
.mt-ghost{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.5);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.mt-ghost-tip{fill:var(--anatomy-hi);stroke:var(--anatomy-card);stroke-width:calc(var(--anatomy-weight)*.5);pointer-events:none}
html,body{overflow-x:hidden}
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
.iso-legend,.mt-sr{display:none!important}
.mt-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.mt-film-legend{display:grid;grid-template-columns:repeat(5,auto);justify-content:center;gap:12px 34px;position:absolute;left:0;right:0;bottom:84px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--mt-apart,0)}
.mt-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.mt-film-legend .mt-num{width:30px;height:30px;font-size:17px}
.mt-tracebox{position:absolute;left:0;right:0;bottom:84px;margin:0;z-index:3;opacity:calc(1 - var(--mt-leaving,0))}
.mt-trace{gap:0 30px;align-items:flex-end}
.mt-cell{gap:12px}
.mt-cell-label{font-size:19px}
.mt-letter{min-width:76px;height:76px;font-size:60px}
.mt-code{min-width:230px;height:76px;gap:12px}
.mt-element{height:18px;border-radius:9px}
.mt-element[data-kind="."]{width:18px}
.mt-element[data-kind="-"]{width:50px}
.mt-element[data-kind="="]{width:82px}
.mt-element[data-kind="#"]{width:114px}
.mt-element[data-kind=" "]{width:16px}
.mt-arrow{font-size:30px;line-height:76px}
.mt-strip{width:760px}
.mt-pathkey{font-size:20px;gap:0 44px;margin-top:18px}
.mt-pathkey span{gap:12px}
.mt-swatch{width:44px;border-top-width:5px!important}
.mt-steps{display:grid;gap:12px;position:absolute;left:44px;top:560px;margin:0;padding:0;list-style:none;font-size:25px;color:var(--anatomy-strong);z-index:3;opacity:var(--mt-steps,0)}
.mt-steps li{--glow:0;display:flex;align-items:center;gap:13px;white-space:nowrap;opacity:var(--glow)}
.mt-steps .mt-num{width:34px;height:34px;font-size:19px}
.mt-stepmark{display:grid;background:var(--mt-line)}
.mt-stepmark[data-local]{background:var(--mt-local)}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  battery: "Line battery",
  key: "Key base, contact, spring",
  lever: "Key lever and knob",
  line: "Line wire, poles, insulators",
  relay: "Relay",
  local: "Local battery",
  magnet: "Register magnet, lever, stylus",
  clockwork: "Clockwork and rollers",
  reel: "Paper reel and tape",
  bench: "Benches, wiring, earth plates",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="mt-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const STEP_LOCAL_FROM = 4;
const stepMarks = film ? Morse.STEPS.map((_, index) => `<span class="mt-badge mt-stepmark" data-stepmark="${index}"${index >= STEP_LOCAL_FROM ? " data-local" : ""}>${index + 1}</span>`).join("") : "";
const badges = `<div class="mt-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="mt-badge" data-badge="${name}">${piece.number}</span>`).join("")}${stepMarks}</div>`;
const stepList = `<ol class="mt-steps" aria-hidden="true">${Morse.STEPS.map((step, index) => `<li data-step-item="${index}"><span class="mt-num">${index + 1}</span>${step.label}</li>`).join("")}</ol>`;

// The trace under the figure: the letter, its dots and dashes, and the tape as the stylus leaves it.
const strip = `<svg class="mt-strip" viewBox="0 0 300 46" data-trace="strip"><rect class="mt-strip-paper" x="1" y="20" width="298" height="16" rx="2"/><g data-trace="marks"></g><g data-trace="reads"></g><path class="mt-strip-stylus" d="M278 45l4-7 4 7z"/></svg>`;
const cell = (label, content) => `<span class="mt-cell"><span class="mt-cell-label">${label}</span>${content}</span>`;
const arrow = '<span class="mt-arrow">→</span>';
const traceRow = `${cell("letter", '<span class="mt-letter" data-trace="letter">·</span>')}${arrow}${cell("dots and dashes", '<span class="mt-code" data-trace="code"></span>')}${arrow}${cell("marks on the tape, read back", strip)}`;
const pathKey = `<div class="mt-pathkey"><span><i class="mt-swatch"></i>line circuit: battery, key, wire, relay, earth</span><span><i class="mt-swatch" data-local></i>local circuit: relay contact, register</span></div>`;
const traceBox = `<div class="mt-tracebox" aria-hidden="true"><div class="mt-trace">${traceRow}</div>${pathKey}</div>`;

const controls = `<span class="mt-controls" role="group" aria-label="Telegraph controls"><button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-clear>Clear the tape</button><button type="button" data-step>Send next letter</button></span>`;

const stageLabel = "Morse telegraph. Hold the space bar or press on the figure to hold the key down: a short press makes a dot, a longer one a dash. Letter and number keys send that character in the 1844 Morse code. Shift and E take the model apart and put it back together.";

const plate = k.plateHtml({
  fig: "Fig 3",
  title: "Morse telegraph, 1840s",
  hint: film ? "Hold Space or press: key · type A–Z · Shift+E: apart" : "Hold Space: key · type A–Z · Shift+E: apart",
  readout: "key up · tape blank",
  keys: [{ mark: "raised", label: "Battery, key, line, relay, local battery, register, paper tape" }],
  caption:
    "A Morse telegraph of the kind Samuel Morse and Alfred Vail built in the mid-1840s, with most of the line left out between the two poles. Pressing the key closes a circuit: from the battery through the key, along the single line wire to the far office, through the two coils of the relay and back through the ground between two buried metal plates. That earth return is how single-wire lines were worked; the first line of 1844 was itself strung with two wires. The relay answers the weak line current: its electromagnet pulls an armature, and the armature closes a second, local circuit with a battery of its own. That circuit feeds the electromagnet of the register, Vail's recording instrument. It pulls one end of a lever, and a stylus at the other end presses into a paper tape that clockwork pulls past, embossing a dot for a short press and a dash for a longer one. The code is the original Morse code, now called American Morse: O is dot, gap, dot, and L is one long dash. The first public message on the Washington to Baltimore line, on 24 May 1844, was \"What hath God wrought\". The lit line is drawn reaching each part in turn so the eye can follow it, and the exact lengths of the marks and gaps are this figure's own. Taken apart, the numbers mark ten assemblies.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}">${svg}${badges}</div>${traceBox}${film ? stepList + partsList("mt-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("mt-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="mt-sr" data-announce aria-live="polite"></span>`;

const config = {
  projection: P,
  explode: {
    film,
    width: WIDTH,
    height: HEIGHT,
    items: items.map((item) => ({ piece: item.piece, bounds: item.bounds, crosses: item.crosses })),
    anchors: ANCHORS,
    apart: apartView(),
  },
  inset: { ...INSET, focus: k.iso(INSET.focus, P), lineWeight: film ? 1.7 : 0.9 },
};

const read = (name) => readFileSync(join(HERE, name), "utf8").replace(/^export /gm, "");
// The kit carries its own page builder, which is not used in the page and whose text holds document tags.
const kitSource = kitScript().replace(/return `<!doctype html>[\s\S]*?<\/html>`;/, 'return "";');
const script = `${kitSource}\nlet Morse;\n{\n${read("model.mjs")}\nMorse = MorseApi;\n}\nlet Layout;\n{\n${read("layout.mjs")}\nLayout = createLayout();\n}\nlet Explode;\n{\n${read("explode.mjs")}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("live.js")}\n${read("apart.js")}\n}\n`;

const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `morse-telegraph-anatomy${suffix}.html`;
const html = k.pageHtml({ title: "Morse Telegraph Anatomy", theme, body, script, width: 650 });
writeFileSync(join(HERE, file), html);

// The copy for publishing: no document tags, the title and styles first, then the fixed light theme.
function publishCopy(page) {
  const title = /<title>[\s\S]*?<\/title>/.exec(page)[0];
  const headStyle = /<head>[\s\S]*?(<style>[\s\S]*?<\/style>)<\/head>/.exec(page)[1];
  const inner = /<body[^>]*>([\s\S]*)<\/body>/.exec(page)[1];
  const fixed = '<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>';
  return `${title}${headStyle}${fixed}${inner}`;
}

if (!film && theme === "light") {
  mkdirSync(join(HERE, "publish"), { recursive: true });
  writeFileSync(join(HERE, "publish", file), publishCopy(html));
}

const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)} · order cycles assembled ${measured.cycles}`);
