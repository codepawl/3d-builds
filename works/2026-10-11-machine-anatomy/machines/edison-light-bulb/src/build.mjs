// Builds the light bulb figure as one standalone page.
//   node build.mjs            light page (the shareable one) and publish/edison-light-bulb-anatomy.html
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves or changes is an empty slot
// that live.js fills from the pure model (model.mjs) and the size table (layout.mjs). Every drawn thing
// is an item that belongs to one assembly, so the exploded view (explode.mjs, apart.js) can move and
// re-sort them. Same recipe as ../enigma-anatomy.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import * as G from "../../../src/anatomy-kit/kit/lathe.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { LampApi as Lamp } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createLayout } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 460;
const AZIMUTH = 62;
const Layout = createLayout();
const SIZES = Layout.sizes;
const LAMP = Layout.lamp;
const NAME = "edison-light-bulb-anatomy";

// The figure is fitted to the card and then moved a little, to leave room for the zoom frame on the
// right and, in the film, for the trace under it.
const NUDGE = film ? [-34, -64] : [-36, 4];
const fitted = k.fitProjection(k.boxCorners({ x: -84, y: -30, w: 144, d: 60 }, -3, 93), WIDTH, HEIGHT, { pad: film ? 122 : 36, azimuth: AZIMUTH });
const P = { ...fitted, origin: [fitted.origin[0] + NUDGE[0], fitted.origin[1] + NUDGE[1]] };
const camera = k.cameraOf(P);
const AZIMUTH_ANGLE = (AZIMUTH * Math.PI) / 180;
const ELEVATION_ANGLE = Math.asin(camera.sinE);

const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const trace = (points, closed = false) => k.pathOf(points.map((point) => k.iso(point, P)), closed);

function box(x0, x1, y0, y1, z0, z1, style = {}) {
  const corner = style.r ?? 0.6;
  const paths = k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: corner }, z0, z1 - z0, P, 2, style.bevel ?? 0.4);
  return S(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
}

function post(x, y, radius, z0, z1, style = {}) {
  return S(k.cylinder(x, y, radius, z0, z1 - z0, P, style.steps ?? 28, style.bevel ?? 0), { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
}

// A turned part lying along a horizontal axis: `axis` is its direction, `start` where it begins.
function lying(start, axis, length, radius, style = {}) {
  return S(G.disc(0, length, radius, G.frameAlong(start, axis), P), { tone: style.tone ?? "mid" });
}

// The half of a ring that faces the viewer, round an upright axis through (x, y).
function frontArc(x, y, radius, z) {
  const points = [];
  for (let index = 0; index <= 20; index++) {
    const angle = AZIMUTH_ANGLE - Math.PI / 2 + (Math.PI * index) / 20;
    points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle), z]);
  }
  return trace(points);
}

function circleOnTop(x, y, radius, z) {
  return k.planOutline({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2, r: radius }, z, P, 6);
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

function upright(piece, label, x, y, radius, z0, z1, style) {
  put(piece, label, post(x, y, radius, z0, z1, style), [x - radius, x + radius, y - radius, y + radius, z0, z1], true);
}

function cornerScrews(x0, x1, y0, y1, z, inset) {
  const points = [];
  for (const x of [x0 + inset, x1 - inset]) {
    for (const y of [y0 + inset, y1 - inset]) points.push(at(x, y, z));
  }
  return D(points, { size: 0.5 });
}

const glowCentre = at(LAMP.x, LAMP.y, 70);
const circleAt = (className, name, radius) => `<circle class="${className}" data-dyn="${name}" cx="${glowCentre[0].toFixed(1)}" cy="${glowCentre[1].toFixed(1)}" r="${(radius * camera.k).toFixed(1)}"/>`;

function boardAndFeet() {
  const B = SIZES.board;
  // The warm light the lit bulb throws round itself, under everything else.
  put("circuit", "light round the bulb", circleAt("lb-ambient", "ambient", 58));
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: B.x0, y: B.y0, w: B.x1 - B.x0, d: B.y1 - B.y0, r: 2 }, -B.foot, 1, P)}"/>`;
  for (const x of [B.x0 + 4, B.x1 - 14]) {
    for (const y of [B.y0 + 4, B.y1 - 14]) slab("circuit", "board foot", x, x + 10, y, y + 10, -B.foot, 0, { tone: "lo" });
  }
  put("circuit", "board", `${halo}<g class="lb-wood">${box(B.x0, B.x1, B.y0, B.y1, B.z0, B.z1, { tone: "lo", bevel: 0.7, r: 1.4 })}</g>`, [B.x0, B.x1, B.y0, B.y1, B.z0, B.z1], true);
  const rules = [-22, -19.5, -17].map((y, index) => k.lineOnTop([-6, y], [index === 2 ? 4 : 10, y], B.z1, P)).join("");
  also(Ln(k.planOutline({ x: -9, y: -25, w: 22, d: 11, r: 0.8 }, B.z1, P, 2), { tone: "lo" }) + Ln(rules, { tone: "lo", free: true }));
  also(cornerScrews(B.x0, B.x1, B.y0, B.y1, B.z1, 3) + D([at(-8, -24, B.z1), at(12, -24, B.z1), at(-8, -15, B.z1), at(12, -15, B.z1)], { size: 0.4 }));
}

// The supply, in outline only: a two-pole generator of the period, with tall field coils over the armature.
function generator() {
  const N = SIZES.generator;
  slab("circuit", "generator bed", N.bed.x0, N.bed.x1, N.bed.y0, N.bed.y1, N.bed.z0, N.bed.z1, { tone: "lo", bevel: 0.5 });
  also(cornerScrews(N.bed.x0, N.bed.x1, N.bed.y0, N.bed.y1, N.bed.z1, 2));
  slab("circuit", "generator pole pieces", N.poles.x0, N.poles.x1, N.poles.y0, N.poles.y1, N.poles.z0, N.poles.z1, { tone: "lo", bevel: 0.5 });
  const face = N.poles.y1;
  const plate = lying([N.shaft.x, face, N.shaft.z], [0, 1, 0], 1.6, N.shaft.plate, { tone: "lo" });
  const pulley = lying([N.shaft.x, face + 1.6, N.shaft.z], [0, 1, 0], 3.4, N.shaft.pulley, { tone: "lo" });
  const axle = lying([N.shaft.x, face + 5, N.shaft.z], [0, 1, 0], 1.6, 0.9, { tone: "lo" });
  put("circuit", "armature end and pulley", plate + pulley + axle, [N.shaft.x - N.shaft.plate, N.shaft.x + N.shaft.plate, face, face + 6.6, N.shaft.z - N.shaft.plate, N.shaft.z + N.shaft.plate]);
  for (const x of N.coils) {
    upright("circuit", "field coil", x, 0, N.coilRadius, N.poles.z1, N.coilTop, { tone: "lo" });
    let windings = "";
    for (let z = N.poles.z1 + 2; z < N.coilTop - 1; z += 2) windings += frontArc(x, 0, N.coilRadius, z);
    also(`<path class="lb-rib" d="${windings}"/>`);
  }
  slab("circuit", "generator yoke", N.yoke.x0, N.yoke.x1, N.yoke.y0, N.yoke.y1, N.yoke.z0, N.yoke.z1, { tone: "lo", bevel: 0.6 });
  also(D(N.coils.map((x) => at(x, 0, N.yoke.z1)), { size: 0.6 }));
  for (const y of [-N.terminalY, N.terminalY]) {
    upright("circuit", "generator terminal", N.terminalX, y, N.terminalRadius, SIZES.board.z1, N.terminalTop, { tone: "mid", steps: 14 });
    also(D([at(N.terminalX, y, N.terminalTop)], { size: 0.6, tone: "hi" }));
    // The short strap from the machine to its terminal, lying on the board.
    also(Ln(k.lineOnTop([N.bed.x1, y * 0.8], [N.terminalX - N.terminalRadius, y], SIZES.board.z1, P), { tone: "mid" }));
  }
}

function wires(routes) {
  const W = SIZES.wire;
  const S0 = SIZES.socket;
  const N = SIZES.generator;
  for (const [name, y] of [["wireBack", -S0.postY], ["wireOut", S0.postY]]) {
    put("circuit", name === "wireOut" ? "wire to the lamp" : "wire back", `<path class="lb-wire" d="${trace(routes[name])}"/>`, [N.terminalX, S0.postX, y - 1, y + 1, W.level - 0.5, W.post + 0.5]);
  }
}

function socket() {
  const K = SIZES.socket;
  const F = K.foot;
  put("socket", "socket foot", `<g class="lb-wood">${box(F.x0, F.x1, F.y0, F.y1, F.z0, F.z1, { tone: "mid", bevel: 0.6, r: 2 })}</g>`, [F.x0, F.x1, F.y0, F.y1, F.z0, F.z1], true);
  also(D([at(F.x1 - 3, F.y0 + 3, F.z1), at(F.x1 - 3, F.y1 - 3, F.z1), at(F.x0 + 3, 0, F.z1)], { size: 0.5 }));
  for (const y of [-K.postY, K.postY]) {
    upright("socket", "binding post", K.postX, y, K.postRadius, F.z1, K.postTop, { tone: "hi", steps: 14 });
    also(D([at(K.postX, y, K.postTop)], { size: 0.55, tone: "hi" }));
  }
}

function socketBody() {
  const K = SIZES.socket;
  put("socket", "socket body", `<g class="lb-wood">${post(LAMP.x, LAMP.y, K.radius, K.z0, K.z1, { tone: "mid", bevel: 0.5 })}</g>`, [LAMP.x - K.radius, LAMP.x + K.radius, LAMP.y - K.radius, LAMP.y + K.radius, K.z0, K.z1], true);
  also(`<path class="lb-rib" d="${frontArc(LAMP.x, LAMP.y, K.radius, K.z0 + 2.2)}${frontArc(LAMP.x, LAMP.y, K.radius, K.z1 - 2.2)}"/>`);
  upright("socket", "socket collar", LAMP.x, LAMP.y, K.collar, K.z1, K.top, { tone: "hi", bevel: 0.4 });
  also(Ln(circleOnTop(LAMP.x, LAMP.y, SIZES.base.radius + 0.5, K.top), { tone: "mid" }));
}

function keySwitch() {
  const K = SIZES.key;
  const shaft = lying([K.x0 - 0.5, LAMP.y, K.z], [1, 0, 0], K.shaft - K.x0 + 0.5, K.radius, { tone: "hi" });
  const boss = lying([K.x0 - 0.2, LAMP.y, K.z], [1, 0, 0], 1.8, 2.6, { tone: "mid" });
  const paddle = `<path class="lb-paddle" data-dyn="paddle" d=""/>`;
  const reach = K.half + 1.5;
  const centre = at((K.shaft + K.x1) / 2, LAMP.y, K.z);
  const hit = `<circle class="lb-hit" data-hit="switch" tabindex="0" role="button" aria-label="Key switch. Enter or Space turns it." cx="${centre[0].toFixed(1)}" cy="${centre[1].toFixed(1)}" r="${(reach * camera.k * 1.25).toFixed(1)}"/>`;
  put("switch", "key switch", boss + shaft + paddle + hit, [K.x0 - 0.5, K.x1, LAMP.y - K.half, LAMP.y + K.half, K.z - K.half, K.z + K.half]);
}

function lampBase() {
  const B = SIZES.base;
  put("base", "screw shell", `<g class="lb-brass">${post(LAMP.x, LAMP.y, B.radius, B.z0, B.z1, { tone: "hi" })}</g>`, [LAMP.x - B.radius, LAMP.x + B.radius, LAMP.y - B.radius, LAMP.y + B.radius, B.z0, B.z1], true);
  let threads = "";
  for (let index = 0; index < B.threads; index++) threads += frontArc(LAMP.x, LAMP.y, B.radius, B.z0 + 2 + index * 2);
  also(`<path class="lb-rib" data-tone="mid" d="${threads}"/>`);
  put("base", "insulating filler", `<g class="lb-plaster">${post(LAMP.x, LAMP.y, B.collar, B.z1, B.top, { tone: "mid" })}</g>`, [LAMP.x - B.collar, LAMP.x + B.collar, LAMP.y - B.collar, LAMP.y + B.collar, B.z1, B.top], true);
}

function outlineOf(radiusAt, z0, z1, count) {
  return trace(Layout.turnedOutline(Layout.profileSamples(radiusAt, z0, z1, count), AZIMUTH_ANGLE, ELEVATION_ANGLE), true);
}

const BULB_BOUNDS = [LAMP.x - 19, LAMP.x + 19, LAMP.y - 19, LAMP.y + 19, SIZES.bulb.z0, 92];

// Air let into the bulb is drawn as a scatter of small dots inside the globe.
function airDots() {
  const points = [];
  for (let index = 0; index < 26; index++) {
    const angle = index * 2.399963;
    const reach = 3 + ((index * 7) % 11);
    const height = 50 + ((index * 13) % 31);
    const limit = Math.max(1, Layout.bulbRadius(height) - 2.5);
    points.push(at(LAMP.x + Math.min(reach, limit) * Math.cos(angle), LAMP.y, height + Math.min(reach, limit) * 0.2 * Math.sin(angle)));
  }
  return `<g class="lb-air" data-dyn="air">${D(points, { size: 0.5, tone: "mid" })}</g>`;
}

function bulbBack() {
  const body = outlineOf(Layout.bulbRadius, SIZES.bulb.z0, Layout.bulbTop - 0.02, 96);
  put("bulb", "bulb glass", `<path class="lb-glass-fill" d="${body}"/><path class="lb-glass-warm" data-dyn="glass-warm" d="${body}"/>`, BULB_BOUNDS);
}

function bulbFront() {
  const U = SIZES.bulb;
  const body = outlineOf(Layout.bulbRadius, U.z0, Layout.bulbTop - 0.02, 96);
  const tip = outlineOf(Layout.tipRadius, U.tip[0][0], U.tip[U.tip.length - 1][0], 12);
  const neckRing = trace(Layout.ring(U.neck, U.z0 + 0.2, AZIMUTH_ANGLE - Math.PI / 2, AZIMUTH_ANGLE + Math.PI / 2));
  const longShine = trace(Layout.meridian(Layout.bulbRadius, AZIMUTH_ANGLE + 0.95, 50, 79, 24));
  const shortShine = trace(Layout.meridian(Layout.bulbRadius, AZIMUTH_ANGLE - 1.05, 62, 74, 12));
  const glass = `<path class="lb-glass" d="${body}"/><path class="lb-glass lb-tip" d="${tip}"/><path class="lb-shine" d="${neckRing}"/><path class="lb-shine" d="${longShine}${shortShine}"/>`;
  put("bulb", "bulb outline", airDots() + glass, BULB_BOUNDS);
}

function glassStem() {
  const table = SIZES.stem;
  const top = table[table.length - 1][0];
  const body = outlineOf(Layout.stemRadius, table[0][0], top, 40);
  const press = trace(Layout.ring(table[table.length - 1][1], top, 0, Math.PI * 2, 20), true);
  const flare = trace(Layout.ring(table[0][1], table[0][0] + 0.2, AZIMUTH_ANGLE - Math.PI / 2, AZIMUTH_ANGLE + Math.PI / 2));
  put("stem", "glass stem", `<path class="lb-glass lb-stem" d="${body}"/><path class="lb-shine" d="${press}${flare}"/>`, [LAMP.x - 5.6, LAMP.x + 5.6, LAMP.y - 5.6, LAMP.y + 5.6, table[0][0], top]);
}

function leadWires() {
  const L = SIZES.leads;
  const d = trace(Layout.leadPoints(-1)) + trace(Layout.leadPoints(1));
  const seals = D([at(LAMP.x - L.inner, LAMP.y, L.stemTop), at(LAMP.x + L.inner, LAMP.y, L.stemTop)], { size: 0.45, tone: "hi" });
  put("leads", "lead-in wires", `<path class="lb-lead" d="${d}"/>${seals}`, [LAMP.x - L.outer, LAMP.x + L.outer, LAMP.y - 0.4, LAMP.y + 0.4, L.z0, L.top]);
}

function filamentClamps() {
  const C = SIZES.clamps;
  const L = SIZES.leads;
  let markup = "";
  for (const side of [-1, 1]) {
    const x = LAMP.x + side * L.outer;
    markup += box(x - C.halfX, x + C.halfX, LAMP.y - C.halfY, LAMP.y + C.halfY, C.z0, C.z1, { tone: "hi", bevel: 0.2, r: 0.3 });
    markup += D([at(x, LAMP.y + C.halfY, (C.z0 + C.z1) / 2)], { size: 0.32, tone: "hi" });
  }
  put("clamps", "filament clamps", markup, [LAMP.x - L.outer - C.halfX, LAMP.x + L.outer + C.halfX, LAMP.y - C.halfY, LAMP.y + C.halfY, C.z0, C.z1]);
}

function filament() {
  const F = SIZES.filament;
  const L = SIZES.leads;
  const glow = `${circleAt("lb-halo", "halo", 27)}<path class="lb-bloom" data-dyn="bloom" d=""/><path class="lb-rim" data-dyn="rim" d=""/><path class="lb-filament" data-dyn="filament" d=""/>`;
  put("filament", "carbon filament", glow, [LAMP.x - L.outer, LAMP.x + L.outer, LAMP.y - 0.3, LAMP.y + 0.3, SIZES.clamps.z1, F.legTop + F.radius]);
}

function currentPath() {
  const segments = Lamp.PATH_SEGMENTS.map((name) => `<path class="lb-path" data-dyn="segment" data-segment="${name}" d="${trace(ROUTES[name])}"/>`);
  put("circuit", "current path", segments.join(""));
}

const ROUTES = Layout.pathRoutes();
boardAndFeet();
generator();
socket();
wires(ROUTES);
socketBody();
keySwitch();
lampBase();
bulbBack();
glassStem();
leadWires();
filamentClamps();
filament();
bulbFront();
currentPath();

// ---- the exploded view ---------------------------------------------------------------------------------

const origin = k.iso([0, 0, 0], P);
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
  const tip = k.iso(axis, P);
  return [tip[0] - origin[0], tip[1] - origin[1]];
});

// The assembled painter's order is measured from the items' boxes, not set by hand.
const measured = Explode.restOrder(listed, AXES);
const items = measured.order.map((index) => listed[index]);

// Where each assembly carries its number while apart: a point beside it that stays in view.
const ANCHORS = {
  bulb: [LAMP.x - 21, LAMP.y, 74],
  filament: [LAMP.x - 9, LAMP.y, 74],
  clamps: [LAMP.x - 10, LAMP.y, 59],
  leads: [LAMP.x - 9, LAMP.y, 46],
  stem: [LAMP.x - 9, LAMP.y, 44],
  base: [LAMP.x - 11, LAMP.y, 29],
  socket: [LAMP.x - 14, LAMP.y + 6, 15],
  switch: [SIZES.key.x1 + 4, LAMP.y, SIZES.key.z + 1],
  circuit: [SIZES.generator.yoke.x0 + 3, 0, SIZES.generator.yoke.z1 + 5],
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

// ---- the zoom frame ------------------------------------------------------------------------------------
// One magnified view of the same live drawing, on the filament and its clamps. It is born from a thin
// rectangle on the lamp (live.js, drawZoom): the frame grows out of that rectangle to this place.

const FRAME = film ? { x: 1466, y: 110, width: 372, height: 560, corner: 14 } : { x: 462, y: 40, width: 104, height: 156, corner: 6 };

function zoomSource() {
  const Z = SIZES.zoom;
  const corners = [at(Z.x0, LAMP.y, Z.z0), at(Z.x1, LAMP.y, Z.z0), at(Z.x0, LAMP.y, Z.z1), at(Z.x1, LAMP.y, Z.z1)];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  const wide = Math.max(...xs) - Math.min(...xs);
  const tall = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(FRAME.width / (wide * 1.12), FRAME.height / (tall * 1.08));
  return { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, width: FRAME.width / scale, height: FRAME.height / scale, scale };
}

const SOURCE = zoomSource();
const defs = `<defs><radialGradient id="lb-halo-fill"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".78"/><stop offset=".28" stop-color="#ffcb52" stop-opacity=".62"/><stop offset=".55" stop-color="#ff9f36" stop-opacity=".36"/><stop offset=".8" stop-color="#ff8f24" stop-opacity=".1"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></radialGradient><radialGradient id="lb-ambient-fill"><stop offset="0" stop-color="#ffb23f" stop-opacity=".55"/><stop offset=".4" stop-color="#ffb23f" stop-opacity=".3"/><stop offset=".72" stop-color="#ffb23f" stop-opacity=".08"/><stop offset="1" stop-color="#ffb23f" stop-opacity="0"/></radialGradient><filter id="lb-bloom-blur" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="${(camera.k * 0.9).toFixed(2)}"/></filter></defs>`;
const scene = `<g id="lb-scene" data-dyn="world">${items.map((item) => `<g class="lb-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;
const sourceMark = `<rect class="lb-zoom-source" data-dyn="zoom-source" x="${(SOURCE.x - SOURCE.width / 2).toFixed(1)}" y="${(SOURCE.y - SOURCE.height / 2).toFixed(1)}" width="${SOURCE.width.toFixed(1)}" height="${SOURCE.height.toFixed(1)}" rx="${(FRAME.corner / SOURCE.scale).toFixed(1)}"/>`;
const zoomFrame = `<path class="lb-zoom-ties" data-dyn="zoom-ties" d=""/><g class="lb-zoom" data-dyn="zoom"><clipPath id="lb-zoom-clip"><rect data-dyn="zoom-clip"/></clipPath><rect class="lb-zoom-paper" data-dyn="zoom-paper"/><g clip-path="url(#lb-zoom-clip)"><use href="#lb-scene" data-dyn="zoom-use"/></g><rect class="lb-zoom-edge" data-dyn="zoom-edge"/></g>`;
const world = `${defs}<g data-dyn="lens">${scene}${sourceMark}</g>${zoomFrame}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Edison's carbon-filament incandescent lamp of 1879 to 1880 drawn as an isometric figure on a wooden board. On the right the lamp stands in its socket: a brass screw base, a clear glass bulb sealed at a tip on top, and inside it a glass stem carrying two platinum lead-in wires, two small clamps and a thin horseshoe of carbon. A key switch sticks out of the socket. On the left a generator is drawn in outline, joined to the socket by two wires. When the switch is turned, a coloured line shows the current running from the generator along one wire, through the switch and the base, up one lead-in wire, through the filament and back, and the filament goes from dark grey through red and orange to a bright yellow-white glow. A magnified frame shows the filament and its clamps. The lamp can be taken apart into nine numbered assemblies.",
  body: world,
});

const CSS = `
.iso[data-theme="light"]{--anatomy-weight:.9px;--anatomy-lit:#d9480f;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--lb-current:#1971c2;--lb-wire:#3a3a40;--lb-glass:#6f7f8c;--lb-glass-fill:rgba(214,228,238,.3);--lb-blend:multiply}
.iso[data-theme="light"] .lb-wood{--anatomy-shade-0:#d6c9b2;--anatomy-shade-1:#e0d4be;--anatomy-shade-2:#e9dfcb;--anatomy-shade-3:#f0e7d6;--anatomy-top:#f5efe2;--anatomy-lo:#8f8472;--anatomy-mid:#7a6f5d}
.iso[data-theme="light"] .lb-brass{--anatomy-shade-0:#cdbb86;--anatomy-shade-1:#d9c995;--anatomy-shade-2:#e4d6a6;--anatomy-shade-3:#ecdfb6;--anatomy-top:#f3e9c8;--anatomy-hi:#5c4d1e}
.iso[data-theme="light"] .lb-plaster{--anatomy-shade-0:#deded8;--anatomy-shade-1:#e8e8e2;--anatomy-shade-2:#f0f0eb;--anatomy-shade-3:#f6f6f2;--anatomy-top:#fbfbf8}
.iso[data-theme="dark"]{--anatomy-weight:.9px;--anatomy-lit:#ff9f43;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--lb-current:#74c0fc;--lb-wire:#c9c9d0;--lb-glass:#9fb2c2;--lb-glass-fill:rgba(160,190,214,.1);--lb-blend:screen}
.iso[data-theme="dark"] .lb-wood{--anatomy-shade-0:#221c15;--anatomy-shade-1:#28211a;--anatomy-shade-2:#2f271e;--anatomy-shade-3:#362d23;--anatomy-top:#3d3328;--anatomy-lo:#8a7c66}
.iso[data-theme="dark"] .lb-brass{--anatomy-shade-0:#2b2513;--anatomy-shade-1:#342c17;--anatomy-shade-2:#3d341b;--anatomy-shade-3:#463c20;--anatomy-top:#514626}
.lb-glass{fill:none;stroke:var(--lb-glass);stroke-width:calc(var(--anatomy-weight)*1.25);stroke-linejoin:round}
.lb-stem{fill:var(--lb-glass-fill);stroke-width:var(--anatomy-weight)}
.lb-tip{fill:var(--anatomy-card)}
.lb-glass-fill{fill:var(--lb-glass-fill);stroke:none}
.lb-glass-warm{--glow:0;fill:#ffe08a;stroke:none;opacity:calc(var(--glow)*.5)}
.lb-shine{fill:none;stroke:var(--lb-glass);stroke-width:calc(var(--anatomy-weight)*.8);stroke-linecap:round;opacity:.6}
.lb-rib{fill:none;stroke:var(--anatomy-lo);stroke-width:calc(var(--anatomy-weight)*.8);stroke-linecap:butt}
.lb-rib[data-tone="mid"]{stroke:var(--anatomy-hi);opacity:.55}
.lb-wire{fill:none;stroke:var(--lb-wire);stroke-width:calc(var(--anatomy-weight)*2.2);stroke-linecap:round;stroke-linejoin:round}
.lb-lead{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.1);stroke-linecap:round;stroke-linejoin:round}
.lb-paddle{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);stroke-linejoin:round}
.lb-filament{--hot:0;fill:none;stroke:#46464c;stroke-width:calc(var(--anatomy-weight)*(1.25 + var(--hot)*1.1));stroke-linecap:round;stroke-linejoin:round}
.lb-bloom{--glow:0;fill:none;stroke:#ff8a1f;stroke-width:calc(var(--anatomy-weight)*7);stroke-linecap:round;stroke-linejoin:round;filter:url(#lb-bloom-blur);opacity:var(--glow)}
.lb-rim{--glow:0;--hot:0;fill:none;stroke:#e8590c;stroke-width:calc(var(--anatomy-weight)*(2.6 + var(--hot)*1.9));stroke-linecap:round;stroke-linejoin:round;opacity:var(--glow)}
.lb-halo{--glow:0;fill:url(#lb-halo-fill);opacity:var(--glow);pointer-events:none}
.lb-ambient{--glow:0;fill:url(#lb-ambient-fill);opacity:var(--glow);pointer-events:none}
.lb-air{--glow:0;opacity:var(--glow)}
.lb-path{--glow:0;fill:none;stroke:var(--lb-current);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round;stroke-linejoin:round;opacity:var(--glow);pointer-events:none}
.lb-zoom-source{--glow:0;fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);opacity:var(--glow);pointer-events:none}
.lb-zoom-ties{--glow:0;fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-dasharray:calc(var(--anatomy-weight)*4) calc(var(--anatomy-weight)*3.4);opacity:var(--glow);pointer-events:none}
.lb-zoom{--glow:0;opacity:var(--glow);pointer-events:none}
.lb-zoom-paper{fill:var(--anatomy-card)}
.lb-zoom-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:calc(var(--anatomy-weight)*1.2)}
.lb-tracebox{margin-top:12px;user-select:none;-webkit-user-select:none}
.lb-trace{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 8px;font-size:12.5px}
.lb-chip{--glow:0;color:var(--anatomy-strong);opacity:calc(.32 + .68*var(--glow));white-space:nowrap}
.lb-chip[data-trace="1"]{color:var(--lb-current);font-weight:600}
.lb-chip[data-trace="2"],.lb-chip[data-trace="3"]{color:#c2410c;font-weight:600}
.iso[data-theme="dark"] .lb-chip[data-trace="2"],.iso[data-theme="dark"] .lb-chip[data-trace="3"]{color:#ffb35c}
.lb-chip-arrow{color:var(--anatomy-lo)}
.lb-pathkey{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 20px;margin-top:8px;font-size:12px;color:var(--anatomy-muted)}
.lb-pathkey span{display:flex;align-items:center;gap:8px;white-space:nowrap}
.lb-swatch{display:block;width:24px;height:3px;border-radius:2px;background:var(--lb-current)}
.lb-swatch[data-hot]{background:linear-gradient(90deg,#7a1e12,#d03e10,#f0840c,#ffc42e,#ffe278)}
.lb-steps,.lb-stepmark{display:none}
.lb-hit{fill:#000;fill-opacity:0;stroke:none;cursor:pointer;outline:none}
.iso[data-theme="dark"] .lb-hit{fill:#fff}
.lb-hit:hover,.lb-hit:focus-visible{fill-opacity:.12}
.iso-stage[data-open] .lb-hit{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;cursor:pointer;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.lb-badges{position:absolute;inset:0;pointer-events:none}
.lb-badge,.lb-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.lb-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.lb-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.lb-parts li{display:flex;align-items:center;gap:8px}
.lb-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.lb-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.lb-controls button:hover{color:var(--anatomy-strong)}
.lb-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.lb-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.lb-controls button:disabled{opacity:.45;cursor:default}
.lb-volts{display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:13px;color:var(--anatomy-muted);white-space:nowrap}
.lb-volts input{width:120px;accent-color:#e8590c}
.lb-volts output{min-width:44px;color:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:12px}
.lb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lb-film-legend{display:none}
html,body{overflow-x:hidden}
@media (max-width:520px){.iso-plate-corner[data-corner="hint"]{display:none}.iso-plate-corner[data-corner="readout"]{max-width:100%;white-space:normal;text-align:right}}
`;

const FILM_CSS = `
html,body{margin:0!important;overflow:hidden!important;background:var(--anatomy-card)!important}
.iso{--anatomy-weight:1.7px}
.iso-page{width:1920px!important;margin:0!important}
.iso-figure{margin:0!important}
.iso-plate{width:1920px;height:1080px;padding:0!important;overflow:hidden;box-shadow:none!important;box-sizing:border-box}
.iso-plate-corners{inset:34px 44px!important;z-index:3}
.iso-plate-corner{font-size:21px!important;background:var(--anatomy-card);padding:8px 12px;margin:-8px -12px;border-radius:6px}
.iso-plate-corner[data-corner="hint"]{display:none}
.iso-legend,.lb-sr{display:none!important}
.lb-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.lb-film-legend{display:grid;grid-template-columns:repeat(3,auto);justify-content:center;gap:12px 40px;position:absolute;left:0;right:0;bottom:44px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--lb-apart,0)}
.lb-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.lb-film-legend .lb-num{width:30px;height:30px;font-size:17px}
.lb-tracebox{position:absolute;left:0;right:0;bottom:64px;margin:0;z-index:3;opacity:calc(1 - var(--lb-apart,0))}
.lb-trace{font-size:30px;gap:0 20px}
.lb-pathkey{font-size:20px;gap:0 44px;margin-top:18px}
.lb-pathkey span{gap:12px}
.lb-swatch{width:44px;height:5px}
.lb-steps{display:grid;gap:13px;position:absolute;left:44px;top:108px;margin:0;padding:0;list-style:none;font-size:25px;color:var(--anatomy-strong);z-index:3;opacity:var(--lb-steps,0)}
.lb-steps li{--glow:0;display:flex;align-items:center;gap:13px;white-space:nowrap;opacity:calc(.16 + .84*var(--glow))}
.lb-steps .lb-num{width:34px;height:34px;font-size:19px}
.lb-stepmark{display:grid;background:#e8590c}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  bulb: "Glass bulb, sealed tip",
  filament: "Carbon filament",
  clamps: "Clamps",
  leads: "Platinum lead-in wires",
  stem: "Glass stem",
  base: "Base: screw shell",
  socket: "Socket",
  switch: "Key switch",
  circuit: "Supply: generator, wires",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="lb-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const stepMarks = film ? Lamp.STEPS.map((_, index) => `<span class="lb-badge lb-stepmark" data-stepmark="${index}">${index + 1}</span>`).join("") : "";
const badges = `<div class="lb-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="lb-badge" data-badge="${name}">${piece.number}</span>`).join("")}${stepMarks}</div>`;
const stepList = `<ol class="lb-steps" aria-hidden="true">${Lamp.STEPS.map((step, index) => `<li data-step-item="${index}"><span class="lb-num">${index + 1}</span>${step.label}</li>`).join("")}</ol>`;

const chips = Lamp.TRACE.map((text, index) => `<span class="lb-chip" data-trace="${index}">${text}</span>`);
const pathKey = `<div class="lb-pathkey"><span><i class="lb-swatch"></i>where the current runs</span><span><i class="lb-swatch" data-hot></i>filament, cold to white hot</span></div>`;
const traceBox = `<div class="lb-tracebox" aria-hidden="true"><div class="lb-trace">${chips.join('<span class="lb-chip-arrow">→</span>')}</div>${pathKey}</div>`;

const controls = `<span class="lb-controls" role="group" aria-label="Lamp controls"><button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-switch aria-pressed="false">Switch on</button><button type="button" data-air>Let air in</button><button type="button" data-mend>New filament</button><label class="lb-volts">Voltage<input type="range" data-volts min="${Lamp.MIN_VOLTS}" max="${Lamp.MAX_VOLTS}" step="1" value="${Lamp.NOMINAL_VOLTS}" aria-label="Supply voltage"><output data-volts-text>${Lamp.NOMINAL_VOLTS} V</output></label></span>`;

const stageLabel = "Edison lamp. Enter or Space turns the key switch, arrow up and down change the voltage, A lets air into the bulb, N fits a new filament, Shift and E take the lamp apart and put it back together.";

// Where each of the film's five step numbers sits: beside the part that step is about.
const STEP_POINTS = [
  [SIZES.key.x1 + 5, LAMP.y, SIZES.key.z + 7],
  [LAMP.x - 12, LAMP.y, 45],
  [LAMP.x - 24, LAMP.y, 64],
  [LAMP.x + 24, LAMP.y, 72],
  [LAMP.x + 9, LAMP.y, 95],
];

const plate = k.plateHtml({
  fig: "Fig 7",
  title: "Edison's carbon-filament lamp, 1879–80",
  hint: "Click: switch · Shift+E: apart",
  readout: "off",
  keys: [{ mark: "raised", label: "Bulb, filament, clamps, lead-in wires, stem, base, socket, key switch, supply" }],
  caption:
    "Thomas Edison's incandescent lamp, US patent 223,898 “Electric-Lamp” (filed 4 November 1879, granted 27 January 1880). Turning the key switch closes the circuit: the generator drives a current along one wire, up one platinum lead-in wire sealed through the glass, through the thin carbon filament and back down the other. The patent asks for a carbon filament of high resistance, 100 to 500 ohms, so nearly all the electrical energy turns to heat in the filament, and it glows. The bulb is one piece of glass, pumped out (the patent says to one-millionth of an atmosphere) and sealed at the tip: with no air round it the hot carbon cannot burn. “Let air in” shows what the vacuum is for; “New filament” mends the lamp. Edison's first successful test of a carbon-filament lamp, on 22 October 1879, lasted 13.5 hours; a carbonized bamboo filament later lasted more than 1,200 hours. Edison was not the only one: Joseph Swan showed a working carbon lamp in Newcastle in early 1879 and lit houses and a London theatre with his lamps in 1881. Simplified here: the patent draws the filament as a coil and this figure as a plain horseshoe loop; the screw base is the form Edison patented in 1881; the generator is only an outline; the base is drawn standing on the socket, not screwed down into it. The volts, amperes, temperatures and timings come from a small model with round, chosen values, and the current's arrival is drawn as a short sweep, although in a real circuit it starts everywhere at once.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}">${svg}${badges}</div>${traceBox}${film ? stepList + partsList("lb-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("lb-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="lb-sr" data-announce aria-live="polite"></span>`;

const config = {
  projection: P,
  zoom: { source: SOURCE, frame: FRAME },
  stepPoints: STEP_POINTS,
  explode: {
    film,
    width: WIDTH,
    height: HEIGHT,
    margin: film ? { x: 150, y: 250, lift: 50 } : { x: 44, y: 44, lift: 0 },
    items: items.map((item) => ({ piece: item.piece, bounds: item.bounds, crosses: item.crosses })),
    anchors: ANCHORS,
    apart: apartView(),
  },
};

const read = (name) => readFileSync(join(HERE, name), "utf8").replace(/^export /gm, "");
const script = `${kitScript()}\nlet Lamp;\n{\n${read("model.mjs")}\nLamp = LampApi;\n}\nlet Layout;\n{\n${read("layout.mjs")}\nLayout = createLayout();\n}\nlet Explode;\n{\n${read("explode.mjs")}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("live.js")}\n${read("apart.js")}\n}\n`;

// The inlined kit carries a page template of its own. Its tag names are written with an escaped first
// letter, so the finished page holds no second doctype, html, head, meta or body tag, even inside a string.
const BACKSLASH = String.fromCharCode(92);
const ESCAPED = { h: `${BACKSLASH}x68`, m: `${BACKSLASH}x6d`, b: `${BACKSLASH}x62` };
const TAG_NAMES = /<(\/?)(h)(tml|ead)|<(\/?)(m)(eta)|<(\/?)(b)(ody)/gi;
const escapeTags = (source) => source.replace(/<!doctype/gi, `<${BACKSLASH}x21doctype`).replace(TAG_NAMES, (...found) => {
  const slash = found[1] ?? found[4] ?? found[7] ?? "";
  const letter = (found[2] ?? found[5] ?? found[8]).toLowerCase();
  const rest = found[3] ?? found[6] ?? found[9];
  return `<${slash}${ESCAPED[letter]}${rest}`;
});

const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `${NAME}${suffix}.html`;
const html = k.pageHtml({ title: "Edison Light Bulb Anatomy", theme, body, script: escapeTags(script), width: 650 });
writeFileSync(join(HERE, file), html);

// The page for publishing: no doctype, html, head, meta or body tags; the title and the styles first,
// then the light page colours and the two body attributes, then the body's content.
function publishPage() {
  const title = /<title>[\s\S]*?<\/title>/.exec(html)[0];
  const headStyles = /<\/title>([\s\S]*?)<\/head>/.exec(html)[1];
  const content = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)[1];
  const light = `<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>`;
  mkdirSync(join(HERE, "publish"), { recursive: true });
  writeFileSync(join(HERE, "publish", `${NAME}.html`), `${title}${headStyles}${light}${content}`);
}

if (!film && theme === "light") publishPage();
const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)} · order cycles assembled ${measured.cycles}`);
