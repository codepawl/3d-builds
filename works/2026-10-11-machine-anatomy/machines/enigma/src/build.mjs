// Builds the Enigma figure as one standalone page.
//   node build.mjs            light page (the shareable one)
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder (add --dark for a dark film)
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves or changes is an empty slot
// that live.js fills from the pure model (model.mjs) and the size table (layout.mjs). Every drawn thing
// is an item that belongs to one assembly, so the exploded view (explode.mjs, apart.js) can move and
// re-sort them. Same recipe as ../jacquard-loom-anatomy.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import * as G from "../../../src/anatomy-kit/kit/lathe.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { EnigmaApi as Enigma } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createLayout } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 460;
const Layout = createLayout(Enigma.KEY_ROWS);
const SIZES = Layout.sizes;
const STACK = SIZES.stack;
const ROTOR_PIECES = ["left", "middle", "right"];
const ROTOR_LABELS = ["Left rotor", "Middle rotor", "Right rotor"];
const LETTER_SLOTS = 11;

const P = k.fitProjection(k.boxCorners({ x: -95, y: -112, w: 190, d: 230, r: 0 }, 0, 108), WIDTH, HEIGHT, { pad: film ? 155 : 30 });

const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const number = (value) => (Math.round(value * 1000) / 1000).toString();

function box(x0, x1, y0, y1, z0, z1, style = {}) {
  const corner = style.r ?? 0.6;
  const paths = k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: corner }, z0, z1 - z0, P, 2, style.bevel ?? 0.4);
  return S(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
}

// A turned part on the spindle's line, from x0 to x1.
function round(x0, x1, radius, style = {}) {
  const frame = G.frameAlong([x0, STACK.y, STACK.z], [1, 0, 0]);
  return S(G.disc(0, x1 - x0, radius, frame, P), { tone: style.tone ?? "mid", inner: style.inner });
}

function circleOnTop(x, y, radius, z) {
  return k.planOutline({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2, r: radius }, z, P, 6);
}

// A circle drawn on a face that looks at the operator (constant y), or round the spindle (constant x).
function circleOn(axis, centre, radius) {
  const points = [];
  for (let step = 0; step < 24; step++) {
    const angle = (step / 24) * Math.PI * 2;
    const across = radius * Math.cos(angle);
    const up = radius * Math.sin(angle);
    const point = axis === "y" ? [centre[0] + across, centre[1], centre[2] + up] : [centre[0], centre[1] + across, centre[2] + up];
    points.push(k.iso(point, P));
  }
  return k.pathOf(points, true);
}

// Text lying in a plane of the machine: `along` is the reading direction and `down` the direction of
// the letter's foot, both as world vectors of length one unit.
function textAt(point, along, down, letter, size, extra = "") {
  const origin = k.iso(point, P);
  const right = k.iso([point[0] + along[0], point[1] + along[1], point[2] + along[2]], P);
  const below = k.iso([point[0] + down[0], point[1] + down[1], point[2] + down[2]], P);
  const matrix = [right[0] - origin[0], right[1] - origin[1], below[0] - origin[0], below[1] - origin[1], origin[0], origin[1]].map(number).join(" ");
  return `<text class="en-text"${extra} transform="matrix(${matrix})" font-size="${size}" dy="0.36em">${letter}</text>`;
}

const ON_TOP = [[1, 0, 0], [0, 1, 0]];
const ON_FRONT = [[1, 0, 0], [0, 0, -1]];

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

function turned(piece, label, x0, x1, radius, style) {
  put(piece, label, round(x0, x1, radius, style), [x0, x1, STACK.y - radius, STACK.y + radius, STACK.z - radius, STACK.z + radius], true);
}

function cornerScrews(x0, x1, y0, y1, z, inset) {
  const points = [];
  for (const x of [x0 + inset, x1 - inset]) {
    for (const y of [y0 + inset, y1 - inset]) points.push(at(x, y, z));
  }
  return D(points, { size: 0.5 });
}

function contactDots(x, size = 0.75, tone = "hi") {
  const points = Layout.letters.map((_, contact) => k.iso(Layout.contactPoint(x, contact), P));
  return D(points, { size, tone });
}

// A circle round the spindle on the face at `x`: the edge of a contact plate or of a hub.
function faceRing(x, radius, tone = "lo") {
  return Ln(circleOn("x", [x, STACK.y, STACK.z], radius), { tone });
}

function contactPlate(x, size, tone) {
  return faceRing(x, STACK.pinPlate[0]) + faceRing(x, STACK.pinPlate[1]) + contactDots(x, size, tone);
}

// The reflector's 13 wires, each joining one contact to its partner, read from the model.
function reflectorWires(x) {
  const wiring = Enigma.REFLECTORS.B;
  let d = "";
  for (let contact = 0; contact < Enigma.LETTERS; contact++) {
    const partner = Enigma.indexOf(wiring[contact]);
    if (partner > contact) d += k.pathOf(Layout.reflectorWire(x, contact, partner).map((point) => k.iso(point, P)), false);
  }
  return Ln(d, { tone: "mid" });
}

// The wooden box: a finger joint down the corner the viewer sees, as a comb of short lines on each face.
function fingerJoint(C) {
  const inset = 4;
  let d = k.segment([C.x1, C.y1 - inset, 0], [C.x1, C.y1 - inset, C.z1], P) + k.segment([C.x1 - inset, C.y1, 0], [C.x1 - inset, C.y1, C.z1], P);
  for (let z = 5.75; z < C.z1 - 1; z += 5.75) {
    d += k.segment([C.x1, C.y1 - inset, z], [C.x1, C.y1, z], P) + k.segment([C.x1 - inset, C.y1, z], [C.x1, C.y1, z], P);
  }
  return Ln(d, { tone: "lo" });
}

function caseAndCradle() {
  const C = SIZES.case;
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: C.x0, y: C.y0, w: C.x1 - C.x0, d: C.y1 - C.y0, r: 2 }, 0, 1, P)}"/>`;
  put("case", "case", `${halo}<g class="en-wood">${box(C.x0, C.x1, C.y0, C.y1, 0, C.z1, { tone: "lo", bevel: 0.8, r: 0.8 })}${fingerJoint(C)}</g>`, [C.x0, C.x1, C.y0, C.y1, 0, C.z1], true);
  const plate = [[C.x1, -34, 30], [C.x1, 6, 30], [C.x1, 6, 16], [C.x1, -34, 16]].map((point) => k.iso(point, P));
  const rules = [26, 22.5, 19].map((z, index) => k.segment([C.x1, -30, z], [C.x1, index === 2 ? -10 : 2, z], P)).join("");
  also(Ln(k.pathOf(plate, true), { tone: "lo" }) + Ln(rules, { tone: "lo", free: true }));
  also(D([at(C.x1, -32, 28), at(C.x1, 4, 28), at(C.x1, -32, 18), at(C.x1, 4, 18)], { size: 0.4 }));
  also(D([-102, 102].flatMap((y) => [at(C.x1, y, 6), at(C.x1, y, 40)]), { size: 0.5 }));
  also(D([-88.5, 88.5].flatMap((x) => [at(x, C.y1, 6), at(x, C.y1, 40)]), { size: 0.5 }));
  slab("case", "case rim", C.x0 - C.lip, C.x1 + C.lip, C.y0 - C.lip, C.y1 + C.lip, C.z1, C.rim, { tone: "lo", bevel: 0.5, r: 2.5 });

  const R = SIZES.cradle;
  slab("case", "rotor cradle", R.x0, R.x1, R.y0, R.y1, R.z0, R.z1, { bevel: 0.5 });
  also(cornerScrews(R.x0, R.x1, R.y0, R.y1, R.z1, 3));

  const B = SIZES.battery;
  slab("case", "battery box", B.x0, B.x1, B.y0, B.y1, B.z0, B.z1, { bevel: 0.8, r: 1.2 });
  also(Ln(k.lineOnTop([B.x0, B.y0 + 5], [B.x1, B.y0 + 5], B.z1, P), { tone: "lo" }));
  also(D([at((B.x0 + B.x1) / 2, B.y1, B.z1 - 7)], { size: 0.9, tone: "hi" }) + cornerScrews(B.x0, B.x1, B.y0 + 5, B.y1, B.z1, 2.4));

  const W = SIZES.switch;
  const base = S(k.cylinder(W.x, W.y, W.r, SIZES.case.rim, 2.4, P, 16), { tone: "mid" });
  const knob = S(k.cylinder(W.x, W.y, W.r - 1.4, SIZES.case.rim + 2.4, 3.2, P, 14, 0.4), { tone: "hi" });
  const mark = Ln(k.lineOnTop([W.x - 2, W.y], [W.x + 2, W.y], SIZES.case.rim + 5.6, P), { tone: "mid" });
  put("case", "power switch", base + knob + mark, [W.x - W.r, W.x + W.r, W.y - W.r, W.y + W.r, SIZES.case.rim, SIZES.case.rim + 5.6]);
}

function windowStrip() {
  const T = SIZES.strip;
  const middleY = (T.y0 + T.y1) / 2;
  slab("case", "window strip", T.x0, T.x1, T.y0, T.y1, SIZES.cradle.z1, T.z1, { bevel: 0.3 });
  ROTOR_PIECES.forEach((_, rotor) => {
    const tyre = Layout.rotorParts(rotor).tyre;
    const x = (tyre.x0 + tyre.x1) / 2;
    const half = T.window / 2;
    also(Ln(k.planOutline({ x: x - half, y: middleY - half, w: T.window, d: T.window, r: 1 }, T.z1, P, 2), { tone: "mid" }));
    also(textAt([x, middleY, T.z1], ...ON_TOP, "01", 3.3, ` data-dyn="window" data-rotor="${rotor}" data-tone="hi"`));
  });
}

function steppingPawls() {
  const W = SIZES.pawls;
  slab("pawls", "pawl bar", W.bar.x0, W.bar.x1, W.bar.y0, W.bar.y1, W.bar.z0, W.bar.z1, { bevel: 0.4 });
  also(D([at(W.bar.x0 + 2, W.bar.y1 - 1.6, W.bar.z1), at(W.bar.x1 - 2, W.bar.y1 - 1.6, W.bar.z1)], { size: 0.45 }));
  ROTOR_PIECES.forEach((_, rotor) => {
    const [x0, x1] = Layout.pawlSpan(rotor);
    const pawl = box(x0, x1, W.y0, W.y1, W.bar.z1, W.top, { tone: "hi", bevel: 0.4 });
    // A line across the tip where the pawl passes from its own rotor's ratchet to the next rotor's notched ring.
    const ratchetEnd = Layout.rotorParts(rotor).ratchet.x1;
    const seam = rotor === 2 ? "" : Ln(k.lineOnTop([ratchetEnd, W.y0], [ratchetEnd, W.y1], W.top, P), { tone: "mid" });
    put("pawls", `pawl of the ${ROTOR_PIECES[rotor]} rotor`, `<g data-dyn="pawl" data-rotor="${rotor}">${pawl}${seam}</g>`, [x0, x1, W.y0, W.y1, W.bar.z1, W.top], true);
  });
}

function wheelOnFoot(piece, label, wheel) {
  const F = STACK.foot;
  slab(piece, `${label} foot`, wheel.x0, wheel.x1, STACK.y - F.halfDepth, STACK.y + F.halfDepth, F.z0, F.z1, { bevel: 0.4 });
  turned(piece, label, wheel.x0, wheel.x1, wheel.r);
}

function rotorHit(rotor, wheel) {
  const label = `${ROTOR_LABELS[rotor]}. Enter or arrow up turns it one letter on, arrow down one letter back.`;
  const ring = circleOn("x", [wheel.x1 + 0.2, STACK.y, STACK.z], wheel.r);
  return `<path class="en-hit" data-hit="rotor" data-rotor="${rotor}" tabindex="0" role="button" aria-label="${label}" d="${ring}"/>`;
}

function rotor(rotor) {
  const piece = ROTOR_PIECES[rotor];
  const parts = Layout.rotorParts(rotor);
  const slot = (name, tone) => `<path class="iso-line" data-tone="${tone}" data-dyn="${name}" data-rotor="${rotor}" d=""/>`;
  const letters = Array.from({ length: LETTER_SLOTS }, () => `<text class="en-text" data-tone="hi" font-size="3.5" dy="0.36em"></text>`).join("");
  // The right rotor comes apart in two halves when the machine is taken apart, so its wires can be seen.
  const opens = rotor === 2;
  const pinHalf = opens ? "cap" : piece;
  turned(piece, `${piece} rotor notched ring`, parts.notchRing.x0, parts.notchRing.x1, parts.notchRing.r);
  also(`<path class="en-notch" data-dyn="notch" data-rotor="${rotor}" d=""/>`);
  turned(piece, `${piece} rotor number ring`, parts.tyre.x0, parts.tyre.x1, parts.tyre.r, { tone: "hi" });
  also(slot("tyre-ticks", "lo") + `<g data-dyn="tyre-letters" data-rotor="${rotor}">${letters}</g>`);
  if (opens) {
    // Inside the ring half: the backs of the 26 flat contacts, where the wires end.
    also(contactPlate(parts.tyre.x1, 0.9, "mid") + faceRing(parts.tyre.x1, STACK.spindle.r + 1.6));
    const reach = STACK.contactRadius;
    put(piece, "right rotor wiring", `<path class="en-wires" data-dyn="wires" d=""/>`, [parts.tyre.x1, parts.tyre.x1 + 0.3, STACK.y - reach, STACK.y + reach, STACK.z - reach, STACK.z + reach]);
  }
  turned(pinHalf, `${piece} rotor finger wheel`, parts.fingerWheel.x0, parts.fingerWheel.x1, parts.fingerWheel.r);
  also(slot("wheel-grips", "mid"));
  turned(pinHalf, `${piece} rotor ratchet`, parts.ratchet.x0, parts.ratchet.x1, parts.ratchet.r);
  // The right face: 26 ratchet teeth round the rim, and the plate of 26 sprung pins.
  also(slot("ratchet-teeth", "mid") + contactPlate(parts.ratchet.x1, 0.75, "hi") + faceRing(parts.ratchet.x1, STACK.spindle.r + 1.6) + rotorHit(rotor, parts.fingerWheel));
}

function rotorStack() {
  const U = STACK.reflector;
  const E = STACK.entry;
  wheelOnFoot("reflector", "reflector", U);
  also(reflectorWires(U.x1) + contactPlate(U.x1, 0.8, "hi") + faceRing(U.x1, STACK.spindle.r + 1.6));
  turned("middle", "spindle", STACK.spindle.x0, STACK.spindle.x1, STACK.spindle.r, { tone: "hi" });
  ROTOR_PIECES.forEach((_, index) => rotor(index));
  wheelOnFoot("entry", "entry wheel", E);
  // The outer face of the entry wheel: the 26 terminals where the wires from the plugboard arrive.
  also(contactPlate(E.x1, 0.6, "mid") + round(E.x1, E.x1 + 1.2, 4, { tone: "hi" }));
}

function lampPanel() {
  const M = SIZES.lamps;
  slab("lamps", "lamp panel", M.x0, M.x1, M.y0, M.y1, M.z0, M.z1, { bevel: 0.6 });
  also(cornerScrews(M.x0, M.x1, M.y0, M.y1, M.z1, 3));
  for (const letter of Layout.letters) {
    const [x, y, z] = Layout.lampPoint(letter);
    also(`<path class="en-lamp" data-dyn="lamp" data-letter="${letter}" d="${circleOnTop(x, y, M.radius - 0.7, z)}"/>`);
    also(Ln(circleOnTop(x, y, M.radius, z), { tone: "mid" }) + textAt([x, y, z], ...ON_TOP, letter, 5.2, ` data-dyn="lamp-letter" data-letter="${letter}"`));
  }
}

function keyboard() {
  const K = SIZES.keyboard;
  slab("keyboard", "keyboard base", K.x0, K.x1, K.y0, K.y1, K.z0, K.z1, { bevel: 0.5 });
  also(cornerScrews(K.x0, K.x1, K.y0, K.y1, K.z1, 3));
  for (const letter of Layout.letters) {
    const [x, y] = Layout.keyPoint(letter);
    const stem = S(k.cylinder(x, y, K.stemRadius, K.z1, K.stemTop - K.z1, P, 10), { tone: "mid", crease: "none" });
    const cap = S(k.cylinder(x, y, K.capRadius, K.stemTop, K.capTop - K.stemTop, P, 22, 0.5), { tone: "hi" });
    const inset = Ln(circleOnTop(x, y, K.capRadius - 0.8, K.capTop), { tone: "lo" });
    const text = textAt([x, y, K.capTop], ...ON_TOP, letter, 5.4, ' data-tone="hi"');
    const hit = `<path class="en-hit" data-hit="key" data-letter="${letter}" tabindex="0" role="button" aria-label="Key ${letter}" d="${circleOnTop(x, y, K.capRadius, K.capTop)}"/>`;
    const bounds = [x - K.capRadius, x + K.capRadius, y - K.capRadius, y + K.capRadius, K.z1, K.capTop];
    put("keyboard", `key ${letter}`, `<g data-dyn="key" data-letter="${letter}">${stem}${cap}${inset}${text}${hit}</g>`, bounds, true);
  }
}

function plugboard() {
  const B = SIZES.plugboard;
  slab("plugboard", "plugboard", B.x0, B.x1, B.y0, B.y1, B.z0, B.z1, { bevel: 0.5 });
  also(D([B.x0 + 3, B.x1 - 3].flatMap((x) => [at(x, B.y1, B.z0 + 3), at(x, B.y1, B.z1 - 3)]), { size: 0.5 }));
  for (const letter of Layout.letters) {
    const [x, y, z] = Layout.socketPoint(letter);
    also(Ln(circleOn("y", [x, y, z], 3.5), { tone: "lo" }) + D([at(x, y, z + B.spread), at(x, y, z - B.spread)], { size: B.hole, tone: "hi" }));
    also(textAt([x - 6.6, y, z], ...ON_FRONT, letter, 4.8));
  }
  const reach = B.y1 + B.plugLength + B.bow;
  put("plugboard", "cables", `<g data-dyn="cables"></g>`, [B.x0, B.x1, B.y1, reach, B.z0 - 12, B.z1]);
  let hits = "";
  for (const letter of Layout.letters) {
    const [x, y, z] = Layout.socketPoint(letter);
    hits += `<path class="en-hit" data-hit="socket" data-dyn="socket" data-letter="${letter}" tabindex="0" role="button" aria-label="Plugboard socket ${letter}" d="${circleOn("y", [x, y + B.plugLength, z], 4.6)}"/>`;
  }
  put("plugboard", "socket hit areas", hits, [B.x0, B.x1, reach, reach + 0.2, B.z0, B.z1]);
}

function currentPath() {
  const segments = Enigma.PATH_SEGMENTS.map((name, index) => `<path class="en-path" data-dyn="segment" data-segment="${name}"${index >= Enigma.RETURN_FROM ? " data-return" : ""} d=""/>`);
  put("case", "current path", segments.join(""));
}

caseAndCradle();
windowStrip();
steppingPawls();
rotorStack();
lampPanel();
keyboard();
plugboard();
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

// Where each assembly carries its number while apart: a point on a face that stays in view.
function rotorAnchor(rotor) {
  const wheel = Layout.rotorParts(rotor).fingerWheel;
  return [wheel.x1, STACK.y, STACK.z + wheel.r];
}

const ANCHORS = {
  lamps: [SIZES.lamps.x0 + 4, SIZES.lamps.y1 - 4, SIZES.lamps.z1],
  reflector: [STACK.reflector.x1, STACK.y, STACK.z + STACK.reflector.r],
  left: rotorAnchor(0),
  middle: rotorAnchor(1),
  right: [Layout.rotorParts(2).tyre.x1, STACK.y, STACK.z + Layout.rotorParts(2).tyre.r],
  cap: rotorAnchor(2),
  entry: [STACK.entry.x1, STACK.y, STACK.z + STACK.entry.r],
  pawls: [SIZES.pawls.bar.x1 - 3, SIZES.pawls.bar.y1 - 2, SIZES.pawls.bar.z1],
  keyboard: [SIZES.keyboard.x0 + 4, SIZES.keyboard.y1 - 4, SIZES.keyboard.z1],
  plugboard: [SIZES.plugboard.x0 + 4, SIZES.plugboard.y1, SIZES.plugboard.z1 - 4],
  case: [SIZES.case.x1 - 2, SIZES.case.y1 - 2, SIZES.case.rim],
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

const scene = `<g id="en-scene" data-dyn="world">${items.map((item) => `<g class="en-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;

// The film's detail window: a second, enlarged view of the same live drawing, held on the rotor stack,
// with a matching outline on the machine that shows where it looks.
const DETAIL = { x: 1100, y: 96, width: 770, height: 690, scale: 2.1, focus: [-20, STACK.y, STACK.z + 2] };

function detailWindow() {
  const focus = k.iso(DETAIL.focus, P);
  const frame = `x="${DETAIL.x}" y="${DETAIL.y}" width="${DETAIL.width}" height="${DETAIL.height}" rx="14"`;
  const place = `translate(${DETAIL.x + DETAIL.width / 2} ${DETAIL.y + DETAIL.height / 2}) scale(${DETAIL.scale}) translate(${-focus[0]} ${-focus[1]})`;
  return `<g class="en-detail"><clipPath id="en-detail-clip"><rect ${frame}/></clipPath><rect class="en-detail-paper" ${frame}/><g clip-path="url(#en-detail-clip)"><use href="#en-scene" transform="${place}"/></g><rect class="en-detail-edge" ${frame}/></g>`;
}

function detailLocator() {
  const focus = k.iso(DETAIL.focus, P);
  const width = DETAIL.width / DETAIL.scale;
  const height = DETAIL.height / DETAIL.scale;
  return `<rect class="en-detail-edge en-locator" x="${focus[0] - width / 2}" y="${focus[1] - height / 2}" width="${width}" height="${height}" rx="7"/>`;
}

const world = `<g data-dyn="lens">${scene}${film ? detailLocator() : ""}</g>${film ? detailWindow() : ""}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A three-rotor Enigma I drawn as an isometric machine with its cover off. At the back, three rotors sit on a spindle between the reflector on the left and the entry wheel on the right, with three stepping pawls behind them. In front of the rotors are the lamp panel, then the keyboard, and on the front of the case the plugboard with its cables. Pressing a key steps the rotors, then a lit line in two colours shows the current running from the key through the plugboard, the entry wheel, the three rotors, the reflector, back through the rotors and the plugboard to one lamp. The machine can be taken apart into eleven numbered assemblies; the right rotor then opens in two halves to show its 26 wires.",
  body: world,
});

const CSS = `
.iso[data-theme="light"]{--anatomy-weight:.9px;--anatomy-lit:#d9480f;--en-lamp:#f5b83d;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--en-cable:#3a3a40;--en-in:#d9480f;--en-back:#1864ab}
.iso[data-theme="light"] .en-wood{--anatomy-shade-0:#d6c9b2;--anatomy-shade-1:#e0d4be;--anatomy-shade-2:#e9dfcb;--anatomy-shade-3:#f0e7d6;--anatomy-top:#f5efe2;--anatomy-lo:#8f8472}
.iso[data-theme="dark"]{--anatomy-weight:.9px;--anatomy-lit:#ff9f43;--en-lamp:#ffd166;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--en-cable:#c9c9d0;--en-in:#ff9f43;--en-back:#74c0fc}
.iso[data-theme="dark"] .en-wood{--anatomy-shade-0:#221c15;--anatomy-shade-1:#28211a;--anatomy-shade-2:#2f271e;--anatomy-shade-3:#362d23;--anatomy-top:#3d3328;--anatomy-lo:#8a7c66}
.en-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-weight:600;text-anchor:middle;pointer-events:none;user-select:none;-webkit-user-select:none}
.en-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.en-path{--glow:0;fill:none;stroke:var(--en-in);stroke-width:calc(var(--anatomy-weight)*2.4);stroke-linecap:round;stroke-linejoin:round;opacity:var(--glow);pointer-events:none}
.en-path[data-return]{stroke:var(--en-back);stroke-dasharray:calc(var(--anatomy-weight)*5.5) calc(var(--anatomy-weight)*2.6)}
.en-wires{--wires:0;fill:none;stroke:var(--anatomy-mid);stroke-width:calc(var(--anatomy-weight)*.85);stroke-linecap:round;stroke-linejoin:round;opacity:var(--wires);pointer-events:none}
.en-tracebox{margin-top:12px;user-select:none;-webkit-user-select:none}
.en-trace{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:6px 2px;font-family:var(--anatomy-mono)}
.en-chip{--glow:0;display:grid;justify-items:center;gap:3px;min-width:38px;color:var(--en-in);opacity:calc(.3 + .7*var(--glow))}
.en-chip[data-back]{color:var(--en-back)}
.en-chip-place{font-size:9px;line-height:1;color:var(--anatomy-muted);white-space:nowrap}
.en-chip-letter{font-size:18px;font-weight:700;line-height:1}
.en-chip-arrow{color:var(--anatomy-lo);font-size:12px;line-height:18px}
.en-pathkey{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 20px;margin-top:10px;font-size:12px;color:var(--anatomy-muted)}
.en-pathkey span{display:flex;align-items:center;gap:8px;white-space:nowrap}
.en-swatch{display:block;width:24px;border-top:3px solid var(--en-in)}
.en-swatch[data-back]{border-top:3px dashed var(--en-back)}
.en-steps,.en-stepmark{display:none}
.en-lamp{--glow:0;fill:var(--en-lamp);stroke:var(--en-lamp);stroke-width:calc(var(--anatomy-weight)*5);stroke-opacity:.4;stroke-linejoin:round;opacity:var(--glow)}
.en-notch{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*3);stroke-linecap:butt}
.en-cable{fill:none;stroke:var(--en-cable);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.en-plug{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*2.6);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.en-hit{fill:#000;fill-opacity:0;stroke:none;cursor:pointer;outline:none}
.iso[data-theme="dark"] .en-hit{fill:#fff}
.en-hit:hover,.en-hit:focus-visible{fill-opacity:.16}
.en-hit[data-picked]{fill:var(--anatomy-lit);fill-opacity:.4}
.iso-stage[data-open] .en-hit{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.en-badges{position:absolute;inset:0;pointer-events:none}
.en-badge,.en-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.en-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.en-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.en-parts li{display:flex;align-items:center;gap:8px}
.en-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.en-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.en-controls button:hover{color:var(--anatomy-strong)}
.en-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.en-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.en-controls [data-step]{margin-left:auto}
.en-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.en-film-legend{display:none}
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
.iso-legend,.en-sr{display:none!important}
.en-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.en-film-legend{display:grid;grid-template-columns:repeat(4,auto);justify-content:center;gap:12px 34px;position:absolute;left:0;right:0;bottom:84px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--en-apart,0)}
.en-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.en-film-legend .en-num{width:30px;height:30px;font-size:17px}
.en-detail,.en-locator{opacity:var(--en-detail,0)}
.en-tracebox{position:absolute;left:0;right:0;bottom:92px;margin:0;z-index:3;opacity:calc(1 - var(--en-apart,0))}
.en-trace{gap:0 6px}
.en-chip{min-width:98px;gap:8px}
.en-chip-place{font-size:18px}
.en-chip-letter{font-size:44px}
.en-chip-arrow{font-size:26px;line-height:44px}
.en-pathkey{font-size:20px;gap:0 44px;margin-top:16px}
.en-pathkey span{gap:12px}
.en-swatch{width:44px;border-top-width:5px!important}
.en-steps{display:grid;gap:12px;position:absolute;left:44px;top:104px;margin:0;padding:0;list-style:none;font-size:25px;color:var(--anatomy-strong);z-index:3;opacity:var(--en-steps,0)}
.en-steps li{--glow:0;display:flex;align-items:center;gap:13px;white-space:nowrap;opacity:var(--glow)}
.en-steps .en-num{width:34px;height:34px;font-size:19px}
.en-stepmark{display:grid;background:var(--en-in)}
.en-stepmark[data-back]{background:var(--en-back)}
.en-detail-paper{fill:var(--anatomy-card)}
.en-detail-edge{fill:none;stroke:var(--anatomy-lo);stroke-width:1.6px}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  lamps: "Lamp panel",
  reflector: "Reflector B: 13 wire pairs",
  left: "Left rotor (I)",
  middle: "Middle rotor (II), spindle",
  right: "Rotor III, ring half: contacts",
  entry: "Entry wheel",
  pawls: "Three stepping pawls",
  keyboard: "Keyboard",
  plugboard: "Plugboard, two-pin cables",
  case: "Wooden case, deck, battery",
  cap: "Rotor III, pin half: its 26 wires",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="en-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const STEP_BACK_FROM = 4;
const stepMarks = film ? Enigma.STEPS.map((_, index) => `<span class="en-badge en-stepmark" data-stepmark="${index}"${index >= STEP_BACK_FROM ? " data-back" : ""}>${index + 1}</span>`).join("") : "";
const badges = `<div class="en-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="en-badge" data-badge="${name}">${piece.number}</span>`).join("")}${stepMarks}</div>`;
const stepList = `<ol class="en-steps" aria-hidden="true">${Enigma.STEPS.map((step, index) => `<li data-step-item="${index}"><span class="en-num">${index + 1}</span>${step.label}</li>`).join("")}</ol>`;

// The letter trace: one chip per stage of the current, filled in by live.js for every key.
const TRACE_STAGES = 11;
const TRACE_BACK_FROM = 5;
const chips = Array.from({ length: TRACE_STAGES }, (_, index) => `<span class="en-chip" data-trace="${index}"${index >= TRACE_BACK_FROM ? " data-back" : ""}><span class="en-chip-place">·</span><span class="en-chip-letter">·</span></span>`);
const pathKey = `<div class="en-pathkey"><span><i class="en-swatch"></i>way in: key to reflector</span><span><i class="en-swatch" data-back></i>way back: reflector to lamp</span></div>`;
const traceBox = `<div class="en-tracebox" aria-hidden="true"><div class="en-trace">${chips.join('<span class="en-chip-arrow">→</span>')}</div>${pathKey}</div>`;

const controls = `<span class="en-controls" role="group" aria-label="Enigma controls"><button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-reset>Rotors to AAA</button><button type="button" data-clear>Pull the cables</button><button type="button" data-step>Type next letter</button></span>`;

const stageLabel = "Enigma machine. Letter keys type on it, Space types the next letter of the demonstration, Shift and E take the machine apart and put it back together. Tab reaches each key, each rotor (Enter or arrow keys turn it) and each plugboard socket (Enter on two sockets joins them with a cable, Enter on a plugged socket pulls its cable).";

const plate = k.plateHtml({
  fig: "Fig 2",
  title: "Enigma I, three rotors",
  hint: "Type A–Z · tap rotors, sockets · Shift+E: apart",
  readout: "windows 01 01 01 · type a letter",
  keys: [{ mark: "raised", label: "Rotors, reflector, entry wheel, pawls, lamp panel, keyboard, plugboard" }],
  caption:
    "An Enigma I with rotors I, II and III and reflector B, drawn with its lid off and the rotors lifted clear of the deck. Pressing a key first pushes three pawls, which step the rotors, and only then closes the circuit. The current leaves the key, passes the plugboard (where a cable swaps two letters), enters the entry wheel and crosses the three rotors: in each one it goes in at a sprung pin, follows one of 26 wires and leaves at a flat contact for a different letter. The reflector joins the contacts in 13 pairs and sends the current back through the rotors by another route, through the plugboard again and to a lamp, never the lamp of the key that was pressed. Because a rotor steps before every letter, the same key lights a different lamp next time. The strip under the figure names the letter after each stage; the rings carry numbers, 01 for A to 26 for Z. Wires inside the case and inside the rotors are drawn where they run, as if seen through the parts. With no cables, all rings at 01 and the windows at 01 01 01, typing AAAAA lights BDZGO. Taken apart, the numbers mark eleven assemblies and the right rotor opens to show its wiring.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}">${svg}${badges}</div>${traceBox}${film ? stepList + partsList("en-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("en-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="en-sr" data-announce aria-live="polite"></span>`;

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
};

const read = (name) => readFileSync(join(HERE, name), "utf8").replace(/^export /gm, "");
const script = `${kitScript()}\nlet Enigma;\n{\n${read("model.mjs")}\nEnigma = EnigmaApi;\n}\nlet Layout;\n{\n${read("layout.mjs")}\nLayout = createLayout(Enigma.KEY_ROWS);\n}\nlet Explode;\n{\n${read("explode.mjs")}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("live.js")}\n${read("apart.js")}\n}\n`;

const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `enigma-anatomy${suffix}.html`;
const html = k.pageHtml({ title: "Enigma Machine Anatomy", theme, body, script, width: 650 });
writeFileSync(join(HERE, file), html);
const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)} · order cycles assembled ${measured.cycles}`);
