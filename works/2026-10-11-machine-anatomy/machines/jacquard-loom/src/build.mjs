// Builds the Jacquard loom figure as one standalone page.
//   node build.mjs            light page (the shareable one)
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder (add --dark for a dark film)
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves is an empty slot in painter's
// order that live.js fills from the pure model (model.mjs) and the size table (layout.mjs). Every drawn
// thing is an item that belongs to one assembly, so the exploded view (explode.mjs, apart.js) can move
// and re-sort them.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import * as G from "../../../src/anatomy-kit/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../src/anatomy-kit/kit/tube.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { LoomApi as Loom } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { LAYOUT as L, MECHANISM, PRESSED_CENTRE, hookY, warpY } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 650;
const LANES = Array.from({ length: L.lanes }, (_, lane) => lane);

const P = k.fitProjection(k.boxCorners({ x: -117, y: -58.5, w: 228, d: 117, r: 0 }, 0, 252), WIDTH, HEIGHT, { pad: film ? 50 : 20, azimuth: 58 });

const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const each = (make) => LANES.map(make).join("");

function box(x0, x1, y0, y1, z0, z1, style = {}) {
  const corner = style.r ?? 0.6;
  const paths = k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: corner }, z0, z1 - z0, P, 2, style.bevel ?? 0.4);
  return S(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
}

function round(x, z, radius, y0, y1, style = {}) {
  const frame = G.frameAlong([x, y0, z], [0, 1, 0]);
  return S(G.disc(0, y1 - y0, radius, frame, P), { tone: style.tone ?? "mid", inner: style.inner });
}

function wire(name, lane, free) {
  return `<path class="iso-line jq-wire" data-tone="mid" data-dyn="${name}" data-lane="${lane}"${free ? ` data-free="${free}"` : ""} d=""/>`;
}

function group(name, content = "") {
  return `<g data-dyn="${name}">${content}</g>`;
}

function endDots(name) {
  return `<g class="iso-dots" data-tone="hi">${each((lane) => `<circle data-dyn="${name}" data-lane="${lane}" r="0"/>`)}</g>`;
}

// ---- items ---------------------------------------------------------------------------------------------
// One item is one thing in painter's order: its assembly, its markup and the world box it fills
// ([x0, x1, y0, y1, z0, z1]). `block` marks a thick solid that the audit tests for pass-through.

const items = [];

function put(piece, label, markup, bounds = null, block = false) {
  items.push({ piece, label, markup, bounds, block });
}

function also(markup) {
  items[items.length - 1].markup += markup;
}

function slab(piece, label, x0, x1, y0, y1, z0, z1, style) {
  put(piece, label, box(x0, x1, y0, y1, z0, z1, style), [x0, x1, y0, y1, z0, z1], true);
}

function turned(piece, label, x, z, radius, y0, y1, style) {
  put(piece, label, round(x, z, radius, y0, y1, style), [x - radius, x + radius, y0, y1, z - radius, z + radius], true);
}

const RAIL = L.rails;
const FAR = [-RAIL.y - RAIL.half, -RAIL.y + RAIL.half];
const NEAR = [RAIL.y - RAIL.half, RAIL.y + RAIL.half];
const INNER = RAIL.y - RAIL.half;
const POST = L.posts;
const TOP = RAIL.top[0];
const ROLLER = [PRESSED_CENTRE[0] - L.card.half - L.card.pitch * 0.55, PRESSED_CENTRE[1] + L.card.half - L.roller.r - 0.15];
const CLEAT = [L.bottomBoard.x1 - 5, L.bottomBoard.x1];
const YOKE = { half: 12.5, riserY: 8.5 };
const CHAIN_BOX = [-101, -51.9, -38, 38, 138.6, 172.8];

function post(label, x, side, top) {
  slab("frame", label, x - 2.5, x + 2.5, side[0], side[1], 5, top, { bevel: 0.5, tone: "lo" });
}

function sideRail(label, x0, x1, side, level) {
  slab("frame", label, x0, x1, side[0], side[1], level[0], level[1], { tone: "lo" });
}

function sill(label, side) {
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: -114, y: side[0], w: 224, d: 5, r: 1 }, 0, 1, P)}"/>`;
  put("frame", label, halo + box(-114, 110, side[0], side[1], 0, 5, { tone: "lo", bevel: 0.6 }), [-114, 110, side[0], side[1], 0, 5], true);
}

// A knee brace under the cantilevered upper rail, seen side-on: one face in the rail's own plane.
function brace(label, side) {
  const y = side[1] - 0.8;
  const from = [POST.mid + 2.5, 116];
  const to = [-20, RAIL.upper[0]];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const across = [(-(to[1] - from[1]) / length) * 1.8, ((to[0] - from[0]) / length) * 1.8];
  const corners = [
    [from[0] + across[0], y, from[1] + across[1]],
    [to[0] + across[0], y, to[1] + across[1]],
    [to[0] - across[0], y, to[1] - across[1]],
    [from[0] - across[0], y, from[1] - across[1]],
  ];
  const d = k.pathOf(corners.map((corner) => k.iso(corner, P)), true);
  const markup = `<g class="iso-solid"><path class="iso-fill" d="${d}"/><path class="iso-shade" data-shade="3" d="${d}"/><path class="iso-line iso-edge" data-tone="lo" d="${d}"/></g>`;
  put("frame", label, markup, [from[0], to[0], side[0], side[1], 114.5, RAIL.upper[0] + 1.5]);
}

function frameFar() {
  sill("far sill", FAR);
  post("far rear post", POST.rear, FAR, TOP);
  put("frame", "lever cord", `<path class="iso-line" data-tone="mid" data-dyn="lever-cord" d=""/>`, [L.lever.rearX + 1, L.lever.rearX + 2, 3.6, 4.6, 30, 238]);
  items[items.length - 1].crosses = "warp";
  slab("frame", "rear cross rail", POST.rear - 2.5, POST.rear + 2.5, -INNER, INNER, RAIL.upper[0], RAIL.upper[1], { tone: "lo" });
  sideRail("far low rail, rear", POST.rear + 2.5, POST.mid - 2.5, FAR, RAIL.low);
  sideRail("far upper rail, rear", POST.rear + 2.5, POST.mid - 2.5, FAR, RAIL.upper);
  post("far mid post", POST.mid, FAR, TOP);
  sideRail("far low rail, front", POST.mid + 2.5, POST.front - 2.5, FAR, RAIL.low);
  brace("far brace", FAR);
  sideRail("far upper rail, front", POST.mid + 2.5, POST.upperEnd, FAR, RAIL.upper);
  post("far front post", POST.front, FAR, POST.frontTop);
  slab("grate", "far board cleat", CLEAT[0], CLEAT[1], -INNER, -L.bottomBoard.halfWidth, L.bottomBoard.z0, RAIL.upper[1]);
  slab("harness", "far comber hanger", L.hook.x - 2, L.hook.x + 2, -INNER, -L.comber.halfWidth, L.comber.z1, RAIL.upper[0]);
  slab("frame", "far roller post", ROLLER[0] - 2.2, ROLLER[0] + 2.2, FAR[0], FAR[1], RAIL.upper[1], ROLLER[1] + 2);
  slab("warp", "far beam bearing", L.beam.x - 7.5, L.beam.x + 5, -INNER, -46, L.beam.z - 5, L.beam.z + 5);
  slab("cloth", "far roller bearing", 86, POST.front - 2.5, -INNER, -46, 34, 44);
}

function treadle() {
  const D2 = L.treadle;
  slab("frame", "treadle block", D2.pivotX - 3, D2.pivotX + 3, D2.y0 - 1, D2.y1 + 1, 0, D2.pivotZ - D2.thick / 2, { tone: "lo" });
  put("frame", "treadle", group("treadle"), [D2.rearX, D2.pivotX, D2.y0, D2.y1, 5, 21.5]);
  slab("frame", "front cross rail", POST.front - 2.5, POST.front + 2.5, -INNER, INNER, 20, 25, { tone: "lo" });
}

function warpBeam() {
  const B = L.beam;
  const frame = G.frameAlong([B.x, -42, B.z], [0, 1, 0]);
  const windings = [14, 28, 42, 56, 70].map((s) => G.arcOf(frame, s, B.r, P)).join("");
  const flange = G.frameAlong([B.x, 42, B.z], [0, 1, 0]);
  turned("warp", "far beam stub", B.x, B.z, 2, -46.5, -44);
  turned("warp", "far beam flange", B.x, B.z, 12.5, -44, -42);
  turned("warp", "warp beam", B.x, B.z, B.r, -42, 42, { tone: "hi", inner: Ln(windings, { tone: "faint" }) });
  turned("warp", "near beam flange", B.x, B.z, 12.5, 42, 44);
  also(D(G.dotsOf(flange, 2, 9.4, 8, P, { all: true }), { size: 0.5 }));
  turned("warp", "near beam stub", B.x, B.z, 2, 44, 46.5);
  slab("warp", "near beam bearing", B.x - 7.5, B.x + 5, 46, INNER, B.z - 5, B.z + 5);
  also(D([at(B.x - 5, 49.7, B.z + 5), at(B.x + 2.5, 49.7, B.z + 5)], { size: 0.45 }));
}

function lanesLow() {
  for (const lane of LANES) {
    const y = warpY(lane);
    const weight = S(k.cylinder(L.hook.x, y, L.lingoe.r, L.lingoe.top - L.lingoe.length, L.lingoe.length, P, 10), { tone: "mid" });
    const harness = wire("harness-low", lane) + `<g data-dyn="lingoe" data-lane="${lane}">${weight}</g>`;
    put("harness", `harness ${lane + 1}`, harness, [L.hook.x - 1.3, L.hook.x + 1.3, y - 1.3, y + 1.3, L.lingoe.top - L.lingoe.length, L.comber.z0 + 1.5]);
    put("warp", `warp thread ${lane + 1}`, wire("thread-rear", lane), [L.beam.x - L.beam.r, L.reed.rest, y - 0.3, y + 0.3, L.beam.z + 6.5, L.warpZ + 0.3]);
  }
}

function frameNearLow() {
  sill("near sill", NEAR);
  also(box(18, 44, 54.5, 57.5, 5, 5.5, { tone: "lo", crease: "none", bevel: 0 }));
  also(Ln(k.lineOnTop([21, 55.5], [38, 55.5], 5.5, P) + k.lineOnTop([21, 56.6], [32, 56.6], 5.5, P), { tone: "lo", free: true }));
  also(D([at(19.4, 56, 5.5), at(42.6, 56, 5.5)], { size: 0.4 }));
  post("near rear post", POST.rear, NEAR, TOP);
  sideRail("near low rail, rear", POST.rear + 2.5, POST.mid - 2.5, NEAR, RAIL.low);
}

function comberBoard() {
  const C = L.comber;
  const holes = LANES.map((lane) => at(L.hook.x, warpY(lane), C.z1));
  const pegs = [-1, 1].flatMap((side) => [at(C.x0 + 2.5, side * (C.halfWidth - 2.2), C.z1), at(C.x1 - 2.5, side * (C.halfWidth - 2.2), C.z1)]);
  slab("harness", "comber board", C.x0, C.x1, -C.halfWidth, C.halfWidth, C.z0, C.z1, { bevel: 0.5 });
  also(D(holes, { size: 0.7, tone: "hi" }) + D(pegs, { size: 0.45 }));
}

function battenBack() {
  const R = L.reed;
  const x = R.rest;
  const wires = [];
  for (let y = -41.25; y <= 41.3; y += 2.5) wires.push(k.segment([x, y, R.raceTop], [x, y, R.capZ + 0.6], P));
  const out = [];
  out.push(box(x + 1, x + 8, FAR[0], -R.halfWidth + 1, RAIL.low[1], R.raceBottom));
  out.push(box(x, x + R.raceDepth, -R.halfWidth, R.halfWidth, R.raceBottom, R.raceTop, { bevel: 0.5 }));
  out.push(box(x + 1, x + 8, -R.halfWidth, -R.halfWidth + 3, R.raceTop, R.raceTop + 4.8));
  out.push(box(x - 1.5, x + 1.5, -46, -43.5, R.raceTop, R.capZ));
  out.push(Ln(wires.join(""), { tone: "mid" }));
  out.push(box(x - 1.5, x + 1.5, -46, 46, R.capZ, R.capTop, { bevel: 0.5 }));
  out.push(box(x - 1.8, x + 1.8, -5, 5, R.capTop, R.capTop + 1.6, { bevel: 0.3 }));
  put("batten", "batten and reed", group("batten-back", out.join("")), [x - 1.8, x + R.raceDepth, FAR[0], R.halfWidth, RAIL.low[1], R.capTop + 1.6], true);
}

function battenFront() {
  const R = L.reed;
  const x = R.rest;
  const out = [];
  out.push(box(x - 1.5, x + 1.5, 43.5, 46, R.raceTop, R.capZ));
  out.push(box(x + 1, x + 8, R.halfWidth - 3, R.halfWidth, R.raceTop, R.raceTop + 4.8));
  out.push(box(x + 1, x + 8, R.halfWidth - 1, NEAR[1], RAIL.low[1], R.raceBottom));
  put("batten", "batten near sword", group("batten-front", out.join("")), [x - 1.5, x + 8, R.halfWidth - 3, NEAR[1], RAIL.low[1], R.capZ], true);
}

function shed() {
  const U = L.shuttle;
  const x = L.reed.rest + U.offsetX;
  const ring = [[x - 2.2, -5], [x, -U.halfLength], [x + 2.2, -5], [x + 2.2, 5], [x, U.halfLength], [x - 2.2, 5]];
  const boat = S(k.extrude(ring, U.z, U.height, P, { bevel: 0.4 }), { tone: "hi" });
  const well = Ln(k.planOutline({ x: x - 0.9, y: -3.4, w: 1.8, d: 6.8, r: 0.8 }, U.z + U.height, P, 3), { tone: "mid" });
  const span = [L.reed.rest, L.fell, -35.3, 35.3, L.warpZ - 0.3, L.warpZ + 0.3];
  put("warp", "front threads, lower", each((lane) => wire("thread-front-low", lane)), span);
  put("batten", "weft", `<path class="iso-line jq-wire" data-tone="mid" data-dyn="weft" d=""/>`, [L.reed.rest, L.fell, -40, 40, U.z, U.z + 0.2]);
  put("batten", "shuttle", group("shuttle", boat + well), [x - 2.2, x + 2.2, -48, 48, U.z, U.z + U.height]);
  put("warp", "front threads, upper", each((lane) => wire("thread-front-high", lane)) + endDots("fell-end"), [span[0], span[1], span[2], span[3], span[4], L.warpZ + L.griffe.rise]);
}

function clothAndBeams() {
  const ratchet = G.frameAlong([89.8, 42, L.cloth.dropTo], [0, 1, 0]);
  const teeth = G.ribsOf(ratchet, 0, 2, 9, 20, P);
  const teethPath = typeof teeth === "string" ? teeth : teeth.map((rib) => rib.d ?? rib).join("");
  turned("cloth", "cloth roller", 89.8, L.cloth.dropTo, 6.8, -42, 42, { tone: "hi" });
  turned("cloth", "ratchet", 89.8, L.cloth.dropTo, 9, 42, 44);
  also(Ln(teethPath, { tone: "lo" }));
  turned("cloth", "roller stub", 89.8, L.cloth.dropTo, 2, 44, 46.5);
  slab("cloth", "near roller bearing", 86, POST.front - 2.5, 46, INNER, 34, 44);
  also(D([at(88, 49.7, 44), at(98, 49.7, 44)], { size: 0.45 }));
  sideRail("near low rail, front", POST.mid + 2.5, POST.front - 2.5, NEAR, RAIL.low);
  slab("frame", "breast beam", 90, 96, FAR[0], NEAR[1], RAIL.low[1], 69.7, { bevel: 0.6 });
  const cloth = `<path class="iso-top" data-dyn="cloth-top" d=""/><path class="iso-shade" data-shade="0" data-dyn="cloth-drop" d=""/><path class="jq-ink" data-dyn="cloth-ink" d=""/><path class="jq-new" data-dyn="cloth-new" d=""/><path class="iso-line" data-tone="faint" data-dyn="cloth-rows" d=""/><path class="iso-line iso-edge" data-tone="hi" data-dyn="cloth-edge" d=""/>`;
  put("cloth", "cloth", group("cloth", cloth), [L.fell, L.cloth.cornerX + 0.1, -L.cloth.halfWidth, L.cloth.halfWidth, L.cloth.z - 0.3, L.cloth.z + 0.1]);
}

function chainSlots(name) {
  let out = "";
  for (let slot = 0; slot < Loom.CARDS; slot++) out += `<g data-dyn="${name}" data-slot="${slot}"></g>`;
  return out;
}

function cardSide() {
  const arm = L.swing.armY;
  const armBox = (y) => [PRESSED_CENTRE[0] - 2.2, PRESSED_CENTRE[0] + 2.2, y - 1.2, y + 1.2, L.swing.pivotZ - 1.3, PRESSED_CENTRE[1] + 1.3];
  const reach = L.card.half * Math.SQRT2;
  for (const y of [-24, 24]) {
    const route = G.fillet([[POST.rear + 2.5, y, 150.5], [-95.5, y, 150.5], [-89, y, 140.6], [-67.5, y, 138.5], [-64.2, y, 144.2]], 4);
    const tube = tubePieces(route, 0.8, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
    put("chain", `cradle rail at y ${y}`, tube + D([at(-64.2, y, 144.2)], { size: 1.3, tone: "hi" }), [POST.rear + 2.5, -63.4, y - 0.8, y + 0.8, 137.7, 151.3]);
  }
  turned("frame", "swing pivot rod", PRESSED_CENTRE[0], L.swing.pivotZ, 1.2, FAR[1], NEAR[0]);
  put("cylinder", "far swing arm", group("arm-far"), armBox(-arm), true);
  turned("frame", "guide roller", ROLLER[0], ROLLER[1], L.roller.r, FAR[0], NEAR[1], { tone: "mid" });
  put("chain", "cards behind the cylinder", chainSlots("chain-back"), CHAIN_BOX);
  put("cylinder", "cylinder", group("cylinder"), [PRESSED_CENTRE[0] - reach, PRESSED_CENTRE[0] + reach, -L.card.length / 2 - 0.8, L.card.length / 2 + 0.8, PRESSED_CENTRE[1] - reach, PRESSED_CENTRE[1] + reach], true);
  put("chain", "cards over the cylinder", chainSlots("chain-front") + `<path class="jq-card-lit" data-dyn="card-lit" d=""/>`, CHAIN_BOX);
  put("cylinder", "near swing arm", group("arm-near"), armBox(arm), true);
}

function headLower() {
  const B = L.bottomBoard;
  const T = L.grate;
  const knots = `<g class="iso-dots" data-tone="hi">${each((lane) => `<circle data-dyn="knot" data-lane="${lane}" r="0.9"/>`)}</g>`;
  put("harness", "harness cords", each((lane) => wire("harness-high", lane)) + endDots("cord-end"), [L.hook.x - 0.3, L.neckX + 0.3, -35.3, 35.3, L.comber.z1, L.knotZ]);
  put("grate", "neck cords", each((lane) => wire("neck", lane)) + knots, [L.neckX - 0.3, L.neckX + 0.3, -30, 30, L.knotZ - 1, B.z0 + 1.5]);
  slab("grate", "bottom board", B.x0, B.x1, -B.halfWidth, B.halfWidth, B.z0, B.z1, { bevel: 0.5 });
  also(D(LANES.map((lane) => at(L.neckX, hookY(lane), B.z1)), { size: 0.6, tone: "hi" }));
  also(D([-1, 1].flatMap((side) => [at(B.x0 + 2.5, side * (B.halfWidth - 2.2), B.z1), at(B.x1 - 2.5, side * (B.halfWidth - 2.2), B.z1)]), { size: 0.45 }));
  put("hooks", "hook feet", each((lane) => wire("hook-low", lane)), [L.hook.x - 0.3, L.hook.x + L.hook.doubled + 0.3, -30, 30, L.hook.foot - 0.7, T.z1]);
  slab("grate", "grate", T.x0, T.x1, -T.halfWidth, T.halfWidth, T.z0, T.z1, { bevel: 0 });
  also(Ln(LANES.map((lane) => k.planOutline({ x: L.hook.x - 1.4, y: hookY(lane) - 0.7, w: 5.6, d: 1.4, r: 0.6 }, T.z1, P, 2)).join(""), { tone: "lo" }));
  slab("grate", "near board cleat", CLEAT[0], CLEAT[1], B.halfWidth, INNER, B.z0, RAIL.upper[1]);
  slab("harness", "near comber hanger", L.hook.x - 2, L.hook.x + 2, L.comber.halfWidth, INNER, L.comber.z1, RAIL.upper[0]);
  sideRail("near upper rail, rear", POST.rear + 2.5, POST.mid - 2.5, NEAR, RAIL.upper);
  post("near mid post", POST.mid, NEAR, TOP);
  brace("near brace", NEAR);
  sideRail("near upper rail, front", POST.mid + 2.5, POST.upperEnd, NEAR, RAIL.upper);
  slab("frame", "near roller post", ROLLER[0] - 2.2, ROLLER[0] + 2.2, NEAR[0], NEAR[1], RAIL.upper[1], ROLLER[1] + 2);
  also(D([-90, -30, 12].map((x) => at(x, NEAR[1], (RAIL.upper[0] + RAIL.upper[1]) / 2)), { size: 0.45 }));
}

// The griffe is a knife on two slim end shoes, lifted by a yoke over its middle: two risers between the
// centre hooks and a short crosshead. Nothing of it stands in front of the card that is being read.
function headUpper() {
  const N = L.needle;
  const K = L.knife;
  const bed = RAIL.upper[1];
  const holesAt = (x) => LANES.map((lane) => at(x, hookY(lane), N.z));
  const shoe = (y0, y1) => box(K.x0 - 0.8, K.x1 + 0.8, y0, y1, K.z0 - 0.8, K.z1 + 0.8);
  const riser = (y) => S(k.cylinder(L.lever.rodX, y, 0.8, K.z1, 22, P, 10), { tone: "mid", crease: "none" });
  const knife = shoe(-K.halfWidth - 1.6, -K.halfWidth + 0.4) + box(K.x0, K.x1, -K.halfWidth, K.halfWidth, K.z0, K.z1, { tone: "hi", bevel: 0.3 });
  const yoke = shoe(K.halfWidth - 0.4, K.halfWidth + 1.6) + riser(-YOKE.riserY) + riser(YOKE.riserY) + box(K.x0 - 0.8, K.x1 + 0.8, -YOKE.half, YOKE.half, K.z1 + 22, K.z1 + 25, { bevel: 0.4 });
  const lanes = [-30, 30];
  slab("needles", "needle board rest", N.boardBack - 1.5, N.boardFront + 1.5, FAR[0], NEAR[1], bed, N.boardBottom);
  put("needles", "needle heads", each((lane) => wire("needle-head", lane, "start")), [N.headX, N.boardBack, ...lanes, N.z - 0.2, N.z + 0.2]);
  slab("needles", "needle board", N.boardBack, N.boardFront, -N.halfWidth, N.halfWidth, N.boardBottom, N.boardTop, { bevel: 0.3 });
  also(D(holesAt(N.boardFront), { size: 0.6, tone: "hi" }));
  put("hooks", "hook shafts", each((lane) => wire("hook-mid", lane) + wire("hook-double", lane, "end")), [L.hook.x - 0.3, L.hook.x + 2.5, ...lanes, L.grate.z1 - 0.4, L.hook.loop]);
  put("needles", "needle bodies", each((lane) => wire("needle-body", lane)), [N.boardFront, N.plateFront, ...lanes, N.z - N.loopR, N.z + N.loopR]);
  put("hooks", "griffe knife", group("griffe-back", knife), [K.x0 - 0.8, K.x1 + 0.8, -K.halfWidth - 1.6, K.halfWidth, K.z0 - 0.8, K.z1 + 0.8], true);
  put("hooks", "hook tops", each((lane) => wire("hook-top", lane, "end")), [L.hook.x - L.hook.beak - 0.2, L.hook.x + 0.3, ...lanes, L.hook.loop, L.hook.top + 0.2]);
  put("hooks", "griffe yoke", group("griffe-front", yoke), [K.x0 - 0.8, K.x1 + 0.8, -YOKE.half, K.halfWidth + 1.6, K.z0 - 0.8, K.z1 + 25], true);
  slab("needles", "spring box rest", N.plateFront - 1.4, N.plateBackEnd + 1.4, FAR[0], NEAR[1], bed, N.boardBottom);
  slab("needles", "spring box front plate", N.plateFront, N.plateFrontEnd, -N.halfWidth, N.halfWidth, N.boardBottom, N.boardTop, { bevel: 0.3 });
  also(D(holesAt(N.plateFrontEnd), { size: 0.5, tone: "hi" }));
  const springs = each((lane) => wire("needle-spring", lane) + `<g class="iso-dots" data-tone="hi"><circle data-dyn="collar" data-lane="${lane}" r="1.5"/></g>`);
  put("needles", "needle springs", springs, [N.plateFrontEnd, N.plateBack + 1, -31.5, 31.5, N.z - 1.5, N.z + 1.5]);
  slab("needles", "spring box back plate", N.plateBack, N.plateBackEnd, -N.halfWidth, N.halfWidth, N.boardBottom, N.boardTop, { bevel: 0.3 });
  also(D(holesAt(N.plateBackEnd), { size: 0.5, tone: "hi" }));
  put("needles", "needle tails", each((lane) => wire("needle-tail", lane, "end")), [N.plateBackEnd, N.tailX, ...lanes, N.z - 0.2, N.z + 0.2]);
}

function frameNearTop() {
  const V = L.lever;
  const K = L.knife;
  const rodY = (V.y0 + V.y1) / 2;
  post("near front post", POST.front, NEAR, POST.frontTop);
  const joints = [
    [POST.rear, RAIL.low],
    [POST.rear, RAIL.upper],
    [POST.mid, RAIL.low],
    [POST.mid, RAIL.upper],
    [POST.front, RAIL.low],
  ];
  also(D(joints.flatMap(([x, level]) => [at(x - 1.2, NEAR[1], (level[0] + level[1]) / 2), at(x + 1.2, NEAR[1], (level[0] + level[1]) / 2)]), { size: 0.42 }));
  also(D([POST.rear, POST.mid].map((x) => at(x, NEAR[1] - 2.5, RAIL.top[1])), { size: 0.45 }));
  slab("frame", "rear top rail", POST.rear - 2.5, POST.rear + 2.5, FAR[0], NEAR[1], RAIL.top[0], RAIL.top[1], { bevel: 0.5, tone: "lo" });
  slab("frame", "mid top rail", POST.mid - 2.5, POST.mid + 2.5, FAR[0], NEAR[1], RAIL.top[0], RAIL.top[1], { bevel: 0.5, tone: "lo" });
  slab("frame", "ridge", POST.rear - 2.5, POST.ridgeEnd, -2.5, 2.5, RAIL.top[1], RAIL.top[1] + 5, { bevel: 0.5, tone: "lo" });
  slab("frame", "lever post", V.pivotX - 2.5, V.pivotX + 2.5, -2.5, 2.5, RAIL.top[1] + 5, V.z + 2.5);
  const rod = S(k.cylinder(V.rodX, rodY, 0.9, K.z1 + 25, V.z - V.thick / 2 - K.z1 - 25, P, 10), { tone: "mid", crease: "none" });
  put("frame", "lift rod", group("griffe-rod", rod + D([at(V.rodX, rodY, K.z1 + 25)], { size: 0.9, tone: "hi" })), [V.rodX - 0.9, V.rodX + 0.9, rodY - 0.9, rodY + 0.9, K.z1 + 25, V.z - V.thick / 2], true);
  put("frame", "lever", group("lever"), [V.rearX, V.rodX + 2.5, V.y0, V.y1, V.z - V.thick / 2, V.z + V.thick / 2]);
  also(D([at(V.pivotX, V.y1, V.z)], { size: 0.7, tone: "hi" }));
}

function hits() {
  let out = "";
  for (let which = 0; which < 2; which++) {
    for (const lane of LANES) out += `<path class="jq-hit" data-dyn="hit" data-position="${lane}" tabindex="0" role="button" d=""/>`;
  }
  put("chain", "hit areas", out);
}

frameFar();
treadle();
warpBeam();
lanesLow();
frameNearLow();
comberBoard();
battenBack();
shed();
clothAndBeams();
battenFront();
cardSide();
headLower();
headUpper();
frameNearTop();
hits();

// ---- the exploded view ---------------------------------------------------------------------------------

const origin = k.iso([0, 0, 0], P);
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
  const tip = k.iso(axis, P);
  return [tip[0] - origin[0], tip[1] - origin[1]];
});

// Where each assembly carries its number while apart: a point on a face that stays in view.
const ANCHORS = {
  chain: [-77, 32, 173.4],
  cylinder: [PRESSED_CENTRE[0], L.swing.armY + 1.2, 150],
  needles: [11, 34, 166.4],
  hooks: [L.lever.rodX, 10, 207.5],
  grate: [-20, 47, 129.5],
  harness: [-20, 47, 101.5],
  warp: [L.beam.x, 44.5, 71],
  batten: [L.reed.rest, 42, 93.6],
  cloth: [78, 34, 70.6],
  frame: [POST.rear, NEAR[1], 196],
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
  console.log(`depth order at rest: ${result.contradictions.length} pairs of different assemblies drawn the wrong way round`);
  result.contradictions.slice(0, 20).forEach((line) => console.log(`  ${line}`));
  console.log(`order cycles in flight: ${result.cycles} frames${result.worstCycle ? ` (last: ${result.worstCycle})` : ""}`);
  for (const [ring, count] of Array.from(result.loops).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${count} frames · ${ring}`);
  console.log(`blocks through blocks in flight: ${result.through.size} pairs`);
  for (const [pair, worst] of result.through) console.log(`  ${pair}  ${worst.depth.toFixed(2)} deep · ${worst.where}`);
  console.log(`blocks sunk apart: ${result.sunkApart.length} pairs`);
  result.sunkApart.forEach(([pair, depth]) => console.log(`  ${pair}  ${depth.toFixed(2)} deep`));
  console.log(`explode audit · ${items.length} items · ${blocks} blocks · ${result.flights} flights · ${result.frames} frames`);
  const problems = result.contradictions.length + result.cycles + result.through.size + result.sunkApart.length;
  console.log(problems ? `explode audit failed: ${problems} problems` : "explode audit passed");
  process.exit(problems ? 1 : 0);
}

if (audit) runAudit();

const scene = `<g id="jq-scene" data-dyn="world">${items.map((item) => `<g class="jq-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;

// The film's detail window: a second, enlarged view of the same live drawing, held on the reading head,
// with a matching outline on the loom that shows where it looks.
const DETAIL = { x: 1050, y: 150, width: 800, height: 760, scale: 1.9, focus: [-30, 0, 172] };

function detailWindow() {
  const focus = k.iso(DETAIL.focus, P);
  const frame = `x="${DETAIL.x}" y="${DETAIL.y}" width="${DETAIL.width}" height="${DETAIL.height}" rx="14"`;
  const place = `translate(${DETAIL.x + DETAIL.width / 2} ${DETAIL.y + DETAIL.height / 2}) scale(${DETAIL.scale}) translate(${-focus[0]} ${-focus[1]})`;
  return `<g class="jq-detail"><clipPath id="jq-detail-clip"><rect ${frame}/></clipPath><rect class="jq-detail-paper" ${frame}/><g clip-path="url(#jq-detail-clip)"><use href="#jq-scene" transform="${place}"/></g><rect class="jq-detail-edge" ${frame}/></g>`;
}

function detailLocator() {
  const focus = k.iso(DETAIL.focus, P);
  const width = DETAIL.width / DETAIL.scale;
  const height = DETAIL.height / DETAIL.scale;
  return `<rect class="jq-detail-edge jq-locator" x="${focus[0] - width / 2}" y="${focus[1] - height / 2}" width="${width}" height="${height}" rx="7"/>`;
}

const world = `<g data-dyn="lens">${scene}${film ? detailLocator() : ""}</g>${film ? detailWindow() : ""}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A small Jacquard loom drawn as an isometric machine. A chain of eight punched cards runs over a square cylinder at the top; the card facing the needle board presses eight needles, each looped round a hook. Hooks whose needle found a hole stay over the griffe's knife and are lifted, pulling a cord, a mail and one warp thread up to open the shed; the shuttle crosses, the reed beats the weft in, and the cloth shows a new row whose marked cells match the card's holes. The loom can be taken apart into ten numbered assemblies.",
  body: world,
});

const CSS = `
.iso[data-theme="light"]{--anatomy-weight:.9px;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--jq-ink:#63636a;--jq-hole:#8d8d94;--jq-wire:#66666d}
.iso[data-theme="light"] .jq-item[data-piece="frame"]{--anatomy-shade-0:#e0e0db;--anatomy-shade-1:#e7e7e2;--anatomy-shade-2:#eeeee9;--anatomy-shade-3:#f3f3ef;--anatomy-top:#fafaf8}
.iso[data-theme="dark"]{--anatomy-weight:.9px;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--jq-ink:#a0a0a9;--jq-hole:#060607;--jq-wire:#b4b4bc}
.iso[data-theme="dark"] .jq-item[data-piece="frame"]{--anatomy-shade-0:#17171a;--anatomy-shade-1:#1c1c20;--anatomy-shade-2:#222227;--anatomy-shade-3:#28282e;--anatomy-top:#303037}
.iso-line.jq-wire[data-dyn]{--glow:0;stroke:color-mix(in srgb,var(--anatomy-lit) calc(var(--glow)*100%),var(--jq-wire));stroke-width:calc(var(--anatomy-weight)*1.1 + var(--glow)*var(--anatomy-weight)*1.5)}
.jq-hole{fill:var(--jq-hole);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);stroke-linejoin:round}
.jq-blank{fill:var(--anatomy-lo);stroke:none}
.jq-lace{fill:var(--anatomy-mid);stroke:none}
.jq-card-lit{--glow:0;fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:calc(var(--anatomy-weight)*2);stroke-linejoin:round;opacity:var(--glow)}
.jq-ink{fill:var(--jq-ink);stroke:none}
.jq-new{--glow:0;fill:color-mix(in srgb,var(--anatomy-lit) calc(var(--glow)*100%),var(--jq-ink));stroke:none}
.jq-hit{fill:#fff;fill-opacity:0;stroke:none;cursor:pointer;outline:none}
.iso[data-theme="light"] .jq-hit{fill:#000}
.jq-hit:hover,.jq-hit:focus-visible{fill-opacity:.22}
.iso-stage[data-open] .jq-hit{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.jq-badges{position:absolute;inset:0;pointer-events:none}
.jq-badge,.jq-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.jq-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.jq-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.jq-parts li{display:flex;align-items:center;gap:8px}
.jq-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.jq-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.jq-controls button:hover{color:var(--anatomy-strong)}
.jq-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.jq-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.jq-controls [data-step]{margin-left:auto}
.jq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.jq-film-legend{display:none}
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
.iso-legend,.jq-sr{display:none!important}
.jq-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.jq-film-legend{display:grid;grid-template-columns:repeat(5,auto);justify-content:center;gap:12px 34px;position:absolute;left:0;right:0;bottom:84px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--jq-apart,0)}
.jq-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.jq-film-legend .jq-num{width:30px;height:30px;font-size:17px}
.jq-detail,.jq-locator{opacity:var(--jq-detail,0)}
.jq-detail-paper{fill:var(--anatomy-card)}
.jq-detail-edge{fill:none;stroke:var(--anatomy-lo);stroke-width:1.6px}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  chain: "Card chain and cradle",
  cylinder: "Cylinder and arms",
  needles: "Needles and spring box",
  hooks: "Hooks and griffe",
  grate: "Grate and bottom board",
  harness: "Comber board and harness",
  warp: "Warp beam and threads",
  batten: "Batten, reed, shuttle",
  cloth: "Cloth and roller",
  frame: "Frame, treadle, lever",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="jq-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const badges = `<div class="jq-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="jq-badge" data-badge="${name}">${piece.number}</span>`).join("")}</div>`;

const controls = `<span class="jq-controls" role="group" aria-label="Loom controls">${Loom.MOTIF_NAMES.map(
  (name) => `<button type="button" data-motif="${name}" aria-pressed="${name === "diamond"}">${name[0].toUpperCase()}${name.slice(1)}</button>`,
).join("")}<button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-step>Weave one pick</button></span>`;

const stageLabel = "Jacquard loom. Space weaves one pick, E takes the loom apart and puts it back together, keys 1 to 3 change the motif, and Tab reaches each hole position on the two cards about to be read, to punch or patch it.";

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Jacquard loom, 1804",
  hint: "Tap a hole · Space: one pick · E: apart",
  readout: "card 8 of 8 · 00011000 · 8 picks",
  keys: [
    { mark: "lit", label: "The row being woven: hole, needle, hook, cord, warp thread, cloth" },
    { mark: "raised", label: "Card chain on the cylinder, griffe, comber board, reed" },
  ],
  caption:
    "A Jacquard loom of around 1804: each card laced into the chain is one row of the pattern, and wherever the card has a hole the needle passes, its hook stays over the griffe's knife and is lifted with its warp thread, so the weft is woven under exactly those threads (eight hooks here; a working machine has 400 or more). Taken apart, the numbers mark its ten assemblies.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}">${svg}${badges}</div>${film ? partsList("jq-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("jq-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="jq-sr" data-announce aria-live="polite"></span>`;

const limb = Math.atan2(k.cameraOf(P).cosA * k.cameraOf(P).cosE, -k.cameraOf(P).sinE);
const beamArcs = LANES.map((lane) => {
  const points = [];
  for (let step = 0; step <= 6; step++) {
    const angle = limb + (Math.PI / 2 - limb) * (step / 6);
    points.push([L.beam.x + (L.beam.r + 0.15) * Math.cos(angle), warpY(lane), L.beam.z + (L.beam.r + 0.15) * Math.sin(angle)]);
  }
  return points;
});

const config = {
  projection: P,
  layout: L,
  mechanism: MECHANISM,
  pressedCentre: PRESSED_CENTRE,
  chainShape: Loom.chainShape(PRESSED_CENTRE, L.card.half, L.card.pitch),
  beamArcs,
  explode: {
    film,
    width: WIDTH,
    height: HEIGHT,
    items: items.map((item) => ({ piece: item.piece, bounds: item.bounds, crosses: item.crosses })),
    anchors: ANCHORS,
    apart: apartView(),
  },
};

const read = (name) => readFileSync(join(HERE, name), "utf8");
const modelSource = read("model.mjs").replace(/^export /gm, "");
const explodeSource = read("explode.mjs").replace(/^export /gm, "");
const script = `${kitScript()}\nlet Loom;\n{\n${modelSource}\nLoom = LoomApi;\n}\nlet Explode;\n{\n${explodeSource}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("live.js")}\n${read("apart.js")}\n}\n`;

const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `jacquard-loom-anatomy${suffix}.html`;
const html = k.pageHtml({ title: "Jacquard Loom Anatomy", theme, body, script, width: 650 });
writeFileSync(join(HERE, file), html);
const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)}`);
