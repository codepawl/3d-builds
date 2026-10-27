// Builds the Watt engine figure as one standalone page.
//   node build.mjs            light page (the shareable one) and publish/watt-steam-engine-anatomy.html
//   node build.mjs --dark     dark page
//   node build.mjs --film     landscape 1920 x 1080 card for the recorder
//   node build.mjs --audit    replays the exploded view and checks order and pass-through
// Static parts are drawn here with the Anatomy kit; everything that moves is an empty slot that live.js
// fills from the pure model (model.mjs) and the size table (layout.mjs). Every drawn thing is an item that
// belongs to one assembly, so the exploded view (explode.mjs, apart.js) can move and re-sort them.
// Same recipe as ../enigma-anatomy.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../src/anatomy-kit/kit/iso-kit.mjs";
import * as G from "../../../src/anatomy-kit/kit/lathe.mjs";
import { kitScript } from "../../../src/anatomy-kit/scripts/inline-kit.mjs";
import { EngineApi as Engine } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createDraw, createLayout } from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const film = process.argv.includes("--film");
const audit = process.argv.includes("--audit");
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = film ? 1920 : 580;
const HEIGHT = film ? 1080 : 500;
const AZIMUTH = 62;
const Layout = createLayout(Engine);
const SIZES = Layout.sizes;
const SHAFT = Engine.GEOMETRY.shaft;
const PIVOT = Engine.GEOMETRY.beamPivot;

// The points that reach furthest on screen: the bed's corners, the boiler, the beam's ends and the flywheel.
const REACH = [[-192, -62, -8], [-192, 30, -8], [166, -62, -8], [166, 30, -8], [-184, -40, 112], [-106, 0, 262], [106, 4, 262], [158, -13, 70], [100, -24, 128]];
const P = k.fitProjection(REACH, WIDTH, HEIGHT, { pad: film ? 150 : 22, azimuth: AZIMUTH });
const Draw = createDraw({ iso: k.iso, pathOf: k.pathOf, cameraOf: k.cameraOf }, P);

const at = (x, y, z) => k.iso([x, y, z], P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

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

function slab(piece, label, x0, x1, y0, y1, z0, z1, style = {}) {
  const paths = k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: style.r ?? 0.5 }, z0, z1 - z0, P, 2, style.bevel ?? 0.3);
  put(piece, label, S(paths, { tone: style.tone ?? "mid", halo: style.halo }), [x0, x1, y0, y1, z0, z1], style.block ?? true);
}

// A round part standing upright: a column, a vertical pipe.
function upright(piece, label, x, y, radius, z0, z1, style = {}) {
  const paths = k.cylinder(x, y, radius, z0, z1 - z0, P, radius > 4 ? 28 : 14, style.bevel ?? 0);
  put(piece, label, S(paths, { tone: style.tone ?? "mid" }), [x - radius, x + radius, y - radius, y + radius, z0, z1], style.block ?? true);
}

// The back half of an upright round part, cut open along the plane y = 0.
function halfUpright(piece, label, x, radius, z0, z1, style = {}) {
  const ring = [];
  for (let step = 0; step <= 18; step++) {
    const angle = Math.PI + (step / 18) * Math.PI;
    ring.push([x + radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  const paths = k.extrude(ring, z0, z1 - z0, P, { convex: true });
  put(piece, label, S(paths, { tone: style.tone ?? "mid" }), [x - radius, x + radius, -radius, 0, z0, z1], style.block ?? true);
}

// A round part lying along y: a shaft, a wheel, a pulley, a gear blank.
function acrossY(piece, label, x, z, radius, y0, y1, style = {}) {
  const frame = G.frameAlong([x, y0, z], [0, 1, 0]);
  const paths = style.inner ? G.ringBand(0, y1 - y0, style.inner, radius, frame, P) : G.disc(0, y1 - y0, radius, frame, P);
  put(piece, label, S(paths, { tone: style.tone ?? "mid" }), [x - radius, x + radius, y0, y1, z - radius, z + radius], style.block ?? true);
}

// A round part lying along x: the steam main.
function alongX(piece, label, y, z, radius, x0, x1, style = {}) {
  const frame = G.frameAlong([x0, y, z], [1, 0, 0]);
  put(piece, label, S(G.disc(0, x1 - x0, radius, frame, P), { tone: style.tone ?? "mid" }), [x0, x1, y - radius, y + radius, z - radius, z + radius], style.block ?? true);
}

// An empty slot that live.js fills on every frame.
function live(piece, label, name, bounds, inside = "") {
  put(piece, label, `<g data-dyn="${name}">${inside}</g>`, bounds);
}

function crossing(piece) {
  listed[listed.length - 1].crosses = piece;
}

function faceCircle(x, z, radius, y, tone = "lo") {
  return Ln(Draw.onPlane(Draw.circlePoints([x, z], radius), y), { tone });
}

function bed() {
  const F = SIZES.floor;
  const halo = `<path class="iso-halo" d="${k.haloOf({ x: F.x0, y: F.y0, w: F.x1 - F.x0, d: F.y1 - F.y0, r: 2 }, F.z0, 1, P)}"/>`;
  slab("base", "bed", F.x0, F.x1, F.y0, F.y1, F.z0, 0, { tone: "lo", bevel: 0.8, r: 1.5 });
  listed[listed.length - 1].markup = halo + listed[listed.length - 1].markup;
  // The joints of the stone bed, each running from edge to edge.
  let joints = "";
  for (const x of [-120, -48, 24, 96]) joints += k.lineOnTop([x, F.y0], [x, F.y1], 0, P);
  joints += k.lineOnTop([F.x0, -16], [F.x1, -16], 0, P);
  also(Ln(joints, { tone: "faint" }));
}

function column() {
  const C = SIZES.column;
  slab("base", "column foot", -C.base, C.base, -C.base, C.base, 0, C.baseTop, { bevel: 0.6 });
  upright("base", "column", PIVOT[0], 0, C.r, C.baseTop, C.capFrom);
  for (const z of [C.baseTop + 5, C.capFrom - 6]) also(Ln(k.sideArc(PIVOT[0], 0, C.r, z, P), { tone: "lo" }));
  slab("base", "column capital", -C.cap, C.cap, -C.cap, C.cap, C.capFrom, C.capTo, { bevel: 0.6 });
  slab("base", "back bearing cheek", -C.cheekHalf, C.cheekHalf, -C.cap, -5, C.capTo, C.cheekTop, { bevel: 0.4 });
  slab("base", "front bearing cheek", -C.cheekHalf, C.cheekHalf, 5, C.cap, C.capTo, C.cheekTop, { bevel: 0.4 });
  also(faceCircle(PIVOT[0], PIVOT[1], 2.6, C.cap, "mid") + D([at(PIVOT[0], C.cap, PIVOT[1])], { size: 0.7, tone: "hi" }));
}

// The fixed frame that holds the anchor of the radius rods beside the piston rod's line.
function springBeam() {
  const F = SIZES.frame;
  slab("base", "frame post", F.x0, F.x0 + F.post, F.y0, F.y1, 0, F.z0);
  slab("base", "spring beam", F.x0, F.x1, F.y0, F.y1, F.z0, F.z1);
  const anchor = Engine.GEOMETRY.radiusAnchor;
  also(D([at(anchor[0], F.y1, anchor[1])], { size: 0.8, tone: "hi" }) + D([at(F.x0 + 1.5, F.y1, F.z0 + 3), at(F.x1 - 2, F.y1, F.z0 + 3)], { size: 0.45 }));
}

function cylinder() {
  const Y = SIZES.cylinder;
  const E = SIZES.pedestal;
  slab("cylinder", "cylinder pedestal", E.x0, E.x1, E.y0, 0, 0, E.z1, { tone: "lo", bevel: 0.5 });
  let courses = "";
  for (let z = 14; z < SIZES.cistern.z1 - 2; z += 14) courses += k.segment([E.x0, 0, z], [E.x1, 0, z], P);
  also(Ln(courses, { tone: "faint" }));
  halfUpright("cylinder", "cylinder bottom", Y.x, Y.flange, Y.bottom - Y.cover, Y.bottom);
  halfUpright("cylinder", "cylinder", Y.x, Y.wall, Y.bottom, Y.top);
  halfUpright("cylinder", "cylinder cover", Y.x, Y.flange, Y.top, Y.top + Y.cover);
  halfUpright("cylinder", "piston rod gland", Y.x, Y.gland, Y.top + Y.cover, Y.top + Y.cover + Y.glandHeight, { block: false });
  // The cut face: the bore, and the four fills that show what is above and below the piston.
  const bore = Draw.rectangle(Y.x - Y.bore, Y.x + Y.bore, Y.bottom, Y.top);
  const fills = ["top-steam", "top-exhaust", "bottom-steam", "bottom-exhaust"].map((name) => `<path class="we-fill" data-kind="${name.split("-")[1]}" data-dyn="fill" data-fill="${name}" d=""/>`).join("");
  const ports = SIZES.ports;
  const portMarks = [ports.top, ports.bottom].map((z) => k.segment([Y.x + Y.bore, 0, z - 2.5], [Y.x + Y.bore, 0, z + 2.5], P)).join("");
  const section = `<path class="we-bore" d="${Draw.onPlane(bore, 0)}"/>${fills}${Ln(Draw.onPlane(bore, 0), { tone: "mid" })}<path class="we-port" d="${portMarks}"/>`;
  put("cylinder", "cylinder section", section, [Y.x - Y.bore, Y.x + Y.bore, 0, 0.3, Y.bottom, Y.top]);
  live("piston", "piston", "piston", [Y.x - Y.bore, Y.x + Y.bore, 0.3, 1, Y.bottom, Y.top]);
  live("piston", "piston rod", "piston-rod", [Y.x - 1.5, Y.x + 1.5, 0.3, 1, Y.bottom, 228]);
}

function valveChests() {
  const B = SIZES.boxes;
  const T = SIZES.pipes;
  const K = SIZES.condenser;
  slab("valves", "lower valve chest", B.x0, B.x1, B.y0, 0, B.lower[0], B.lower[1], { bevel: 0.5 });
  also(D([at(B.x0 + 2.5, 0, B.lower[0] + 2.5), at(B.x1 - 2.5, 0, B.lower[0] + 2.5), at(B.x0 + 2.5, 0, B.lower[1] - 2.5), at(B.x1 - 2.5, 0, B.lower[1] - 2.5)], { size: 0.5 }));
  upright("valves", "eduction pipe to the condenser", T.x, T.exhaustY, T.r, K.z1, B.lower[0], { block: false });
  upright("valves", "steam pipe between the chests", T.x, T.steamY, T.r, B.lower[1], B.upper[0]);
  upright("valves", "eduction pipe between the chests", T.x, T.exhaustY, T.r, B.lower[1], B.upper[0]);
  slab("valves", "upper valve chest", B.x0, B.x1, B.y0, 0, B.upper[0], B.upper[1], { bevel: 0.5 });
  also(D([at(B.x0 + 2.5, 0, B.upper[0] + 2.5), at(B.x1 - 2.5, 0, B.upper[0] + 2.5), at(B.x0 + 2.5, 0, B.upper[1] - 2.5), at(B.x1 - 2.5, 0, B.upper[1] - 2.5)], { size: 0.5 }));
  upright("valves", "steam pipe into the upper chest", T.x, T.steamY, T.r, B.upper[1], T.mainZ + T.r);
  live("valves", "valve handles", "handles", [B.x1, B.x1 + B.handle + 1, B.y0, 0, B.lower[0], B.upper[1]]);
  const U = SIZES.plug;
  let rod = k.segment([U.x, U.y, U.bottom], [U.x, U.y, U.top], P);
  for (const z of U.pegs) rod += k.segment([U.x, U.y - U.pegHalf, z], [U.x, U.y + U.pegHalf, z], P);
  const ends = U.pegs.flatMap((z) => [at(U.x, U.y - U.pegHalf, z), at(U.x, U.y + U.pegHalf, z)]);
  const shape = `<path class="we-rod" d="${rod}"/>${D([...ends, at(U.x, U.y, U.bottom), at(U.x, U.y, U.top)], { size: 0.7, tone: "hi" })}`;
  live("valves", "plug rod", "plug", [U.x - 1, U.x + 1, U.y - U.pegHalf, U.y + U.pegHalf, U.bottom - 18, U.top + 18], shape);
  // The plug rod hangs from the beam, which lifts away over it.
  crossing("beam");
}

function steamMain() {
  const T = SIZES.pipes;
  const B = SIZES.boiler;
  // The boiler is only outlined: a dome-topped vessel, front and back, and the pipe that rises from it.
  const profile = [[B.x0, 0], [B.x0, B.z1]];
  for (let step = 1; step < 12; step++) {
    const angle = Math.PI - (step / 12) * Math.PI;
    profile.push([(B.x0 + B.x1) / 2 + ((B.x1 - B.x0) / 2) * Math.cos(angle), B.z1 + B.dome * Math.sin(angle)]);
  }
  profile.push([B.x1, B.z1], [B.x1, 0]);
  let outline = Draw.onPlane(profile, B.y0) + Draw.onPlane(profile, B.y1);
  for (const [x, z] of [profile[1], profile[7], profile[profile.length - 2]]) outline += k.segment([x, B.y0, z], [x, B.y1, z], P);
  const riser = Draw.through([[-170, T.steamY, B.z1 + B.dome], [-170, T.steamY, T.mainZ], [T.mainFrom, T.steamY, T.mainZ]]);
  put("steam", "boiler, in outline", `<path class="we-outline" d="${outline}"/><path class="we-outline" d="${riser}"/>${D([at(-170, T.steamY, B.z1 + B.dome)], { size: 0.8, tone: "hi" })}`, [B.x0, B.x1, B.y0, B.y1, 0, B.z1 + B.dome]);
  alongX("steam", "steam pipe", T.steamY, T.mainZ, T.r, T.mainFrom, T.x + T.r);
  alongX("steam", "throttle valve", T.steamY, T.mainZ, T.throttleR, T.throttleX - T.throttleHalf, T.throttleX + T.throttleHalf);
  acrossY("steam", "throttle dial", T.throttleX, T.mainZ, 4.4, T.steamY + T.r, T.steamY + T.throttleR + 1, { tone: "hi", block: false });
  also(`<path class="we-throttle" data-dyn="throttle" d=""/>`);
}

function condenser() {
  const N = SIZES.cistern;
  const K = SIZES.condenser;
  const U = SIZES.pump;
  const H = SIZES.hotWell;
  slab("condenser", "cistern floor", N.x0, N.x1, N.y0, 0, 0, N.wall, { tone: "lo" });
  slab("condenser", "cistern back wall", N.x0, N.x1, N.y0, N.y0 + N.wall, N.wall, N.z1, { tone: "lo" });
  slab("condenser", "cistern left wall", N.x0, N.x0 + N.wall, N.y0 + N.wall, 0, N.wall, N.z1, { tone: "lo" });
  slab("condenser", "cistern right wall", N.x1 - N.wall, N.x1, N.y0 + N.wall, 0, N.wall, N.z1, { tone: "lo" });
  const water = Draw.rectangle(N.x0 + N.wall, N.x1 - N.wall, N.wall, N.water);
  put("condenser", "cold water", `<path class="we-water" d="${Draw.onPlane(water, N.y0 + N.wall)}"/>`, [N.x0 + N.wall, N.x1 - N.wall, N.y0 + N.wall, N.y0 + N.wall + 0.2, N.wall, N.water]);
  slab("condenser", "condenser foot", K.x - 5, K.x + 5, -6, 0, N.wall, K.z0, { tone: "lo", block: false });
  slab("condenser", "air pump foot", U.x - 5, U.x + 5, -6, 0, N.wall, U.z0, { tone: "lo", block: false });
  halfUpright("condenser", "condenser", K.x, K.r, K.z0, K.z1);
  slab("condenser", "foot valve passage", K.x + K.r - 1, U.x - U.r + 1, -4, 0, K.z0 + 1, K.z0 + 7, { block: false });
  halfUpright("condenser", "air pump barrel", U.x, U.r, U.z0, U.z1);
  slab("condenser", "delivery spout", U.x + U.r - 1, H.x0, -3, 0, U.z1 - 7, U.z1 - 3, { block: false });
  slab("condenser", "hot well", H.x0, H.x1, H.y0, 0, H.z0, H.z1, { block: false });
  // The cut faces: the condenser with its jet of cold water, the pump barrel with the water under the bucket.
  const inside = Draw.rectangle(K.x - K.r + 1.5, K.x + K.r - 1.5, K.z0 + 2, K.z1 - 2);
  const barrel = Draw.rectangle(U.x - U.r + 1.5, U.x + U.r - 1.5, U.z0 + 2, U.z1 - 2);
  const jet = [1.2, -0.4, -2, -3.6].map((drop, index) => k.segment([K.x - K.r + 2.2, 0, K.z1 - 12 + drop * 0.3], [K.x + 1 + (index % 2) * 2.4, 0, K.z1 - 12.5 + drop * 2.6], P)).join("");
  const cock = D([at(K.x - K.r + 1.5, 0, K.z1 - 12)], { size: 0.8, tone: "hi" });
  const section = `<path class="we-fill" data-kind="exhaust" data-dyn="condenser-fill" d="${Draw.onPlane(inside, 0)}"/>${Ln(Draw.onPlane(inside, 0), { tone: "mid" })}<path class="we-jet" d="${jet}"/>${cock}<path class="we-bore" d="${Draw.onPlane(barrel, 0)}"/><path class="we-fill" data-kind="exhaust" data-dyn="pump-fill" d=""/>${Ln(Draw.onPlane(barrel, 0), { tone: "mid" })}`;
  put("condenser", "condenser and pump sections", section, [K.x - K.r, U.x + U.r, 0, 0.3, K.z0, U.z1]);
  live("condenser", "air pump rod and bucket", "pump", [U.x - U.r, U.x + U.r, 0.3, 1, U.z0, 226]);
}

function flywheel() {
  const F = SIZES.flywheel;
  const H = SIZES.shaft;
  const E = SIZES.pedestals;
  const R = SIZES.gears;
  const [x, z] = SHAFT;
  slab("flywheel", "rear shaft pedestal", E.x0, E.x1, E.rearY[0], E.rearY[1], 0, E.z1, { bevel: 0.5 });
  acrossY("flywheel", "rear bearing", x, z, E.cap, E.rearY[0], E.rearY[1]);
  acrossY("flywheel", "shaft, rear", x, z, H.r, H.rearY[0], H.rearY[1], { block: false });
  acrossY("flywheel", "belt pulley on the shaft", x, z, H.pulleyR, H.pulleyY[0], H.pulleyY[1], { block: false });
  belt();
  acrossY("flywheel", "flywheel rim", x, z, F.r, F.y0, F.y1, { inner: F.inner, tone: "hi" });
  acrossY("flywheel", "flywheel hub", x, z, F.hub, F.y0 - 1, F.y1, { block: false });
  live("flywheel", "flywheel spokes", "spokes", [x - F.inner, x + F.inner, F.y1, F.y1 + 0.2, z - F.inner, z + F.inner]);
  acrossY("flywheel", "hub boss", x, z, 4.6, F.y1 + 0.2, F.y1 + 2, { block: false });
  slab("flywheel", "front shaft pedestal", E.x0, E.x1, E.frontY[0], E.frontY[1], 0, E.z1, { bevel: 0.5 });
  acrossY("flywheel", "front bearing", x, z, E.cap, E.frontY[0], E.frontY[1]);
  acrossY("flywheel", "shaft, front", x, z, H.r, E.frontY[1], R.y0, { block: false });
  const root = Engine.GEOMETRY.sunRadius - R.root;
  acrossY("flywheel", "sun gear", x, z, root, R.y0, R.y1, { block: false });
  also(`<g data-dyn="sun-face"></g>`);
}

function rodAndPlanet() {
  const R = SIZES.gears;
  const reach = Engine.GEOMETRY.sunRadius + Engine.GEOMETRY.planetRadius;
  const rest = Engine.planetCentre(0, Engine.GEOMETRY);
  const frame = G.frameAlong([rest[0], R.y0, rest[1]], [0, 1, 0]);
  const blank = S(G.disc(0, R.y1 - R.y0, Engine.GEOMETRY.planetRadius - R.root, frame, P), { tone: "mid" });
  const sweep = reach + Engine.GEOMETRY.planetRadius + 1;
  put("rod", "planet gear", `<g data-dyn="planet">${blank}<g data-dyn="planet-face"></g></g>`, [SHAFT[0] - sweep, SHAFT[0] + sweep, R.y0, R.y1 + 0.2, SHAFT[1] - sweep, SHAFT[1] + sweep]);
  live("rod", "connecting rod", "rod", [SHAFT[0] - reach - 6, SHAFT[0] + reach + 6, R.rodY[0], R.rodY[1], SHAFT[1] - reach - 6, PIVOT[1] + 36]);
  live("rod", "link from the shaft to the planet gear", "link", [SHAFT[0] - reach - 3, SHAFT[0] + reach + 3, R.linkY[0], R.linkY[1], SHAFT[1] - reach - 3, SHAFT[1] + reach + 3]);
}

function beamAndMotion() {
  const M = SIZES.motion;
  const B = SIZES.beam;
  const anchor = Engine.GEOMETRY.radiusAnchor;
  live("beam", "radius rod", "radius", [anchor[0] - 3, -44, M.radiusY[0], M.radiusY[1], 176, 212]);
  live("beam", "beam", "beam", [-106, 106, B.y0, B.y1, 180, 260]);
  live("beam", "parallel motion links", "links", [-104, -44, M.linkY[0], M.barY[1], 160, 258]);
}

function governor() {
  const V = SIZES.governor;
  const H = SIZES.shaft;
  slab("governor", "governor base", V.base[0], V.base[1], V.base[2], V.base[3], V.base[4], V.base[5], { tone: "lo" });
  slab("governor", "governor stand", V.x - 4, V.x + 4, V.y - 4, V.y + 4, V.base[5], V.case[4], { bevel: 0.4 });
  slab("governor", "bevel gear case", V.case[0], V.case[1], V.case[2], V.case[3], V.case[4], V.case[5], { bevel: 0.5 });
  also(D([at(V.case[0] + 2, V.case[3], V.case[4] + 2), at(V.case[1] - 2, V.case[3], V.case[5] - 2)], { size: 0.45 }));
  acrossY("governor", "governor pulley", V.x, V.pulleyZ, V.pulleyR, H.pulleyY[0], H.pulleyY[1], { block: false });
  slab("governor", "bell crank post", V.crank.x - 1.5, V.crank.x + 1.5, V.y - 1.5, V.y + 1.5, V.base[5], Layout.sleeveRest + 1, { block: false });
}

function belt() {
  const V = SIZES.governor;
  const H = SIZES.shaft;
  // The belt: two straight runs between the pulley on the flywheel shaft and the governor's pulley.
  const beltY = (H.pulleyY[0] + H.pulleyY[1]) / 2;
  const across = [SHAFT[0] - V.x, SHAFT[1] - V.pulleyZ];
  const length = Math.hypot(across[0], across[1]);
  const normal = [-across[1] / length, across[0] / length];
  let belt = "";
  for (const side of [1, -1]) {
    belt += k.segment([V.x + normal[0] * V.pulleyR * side, beltY, V.pulleyZ + normal[1] * V.pulleyR * side], [SHAFT[0] + normal[0] * H.pulleyR * side, beltY, SHAFT[1] + normal[1] * H.pulleyR * side], P);
  }
  put("flywheel", "belt from the flywheel shaft", `<path class="we-belt" data-dyn="belt" d="${belt}"/>`, [V.x, SHAFT[0], beltY - 0.3, beltY + 0.3, V.pulleyZ - V.pulleyR, SHAFT[1] + H.pulleyR]);
}

function governorLive() {
  const V = SIZES.governor;
  upright("governor", "governor spindle", V.x, V.y, V.spindle, V.case[5], V.top + 2, { block: false, tone: "hi" });
  live("governor", "bell crank", "bell-crank", [V.crank.x - 24, V.x + 2, V.y - 0.6, V.y + 0.6, Layout.sleeveRest - 3, Layout.sleeveRest + 30]);
  live("governor", "governor balls", "governor", [V.x - 26, V.x + 26, V.y - 26, V.y + 26, V.top - 30, V.top + 3]);
}

function flows() {
  const names = Object.keys(Layout.routes);
  const kindOf = (name) => (name.startsWith("steam") ? "steam" : "exhaust");
  const paths = names.map((name) => `<path class="we-flow" data-kind="${kindOf(name)}" data-dyn="flow" data-flow="${name}" d="${Draw.through(Layout.routes[name])}"/>`);
  put("base", "steam and exhaust", paths.join(""));
}

// The governor's long rod runs behind the whole engine, so it is listed first and keeps that place.
function throttleRod() {
  const V = SIZES.governor;
  live("governor", "throttle rod", "throttle-rod", [SIZES.pipes.throttleX - 16, V.crank.x, V.y - 0.6, V.y + 0.6, 140, 170]);
  crossing("all");
}

bed();
throttleRod();
springBeam();
column();
steamMain();
cylinder();
valveChests();
condenser();
governor();
governorLive();
flywheel();
rodAndPlanet();
beamAndMotion();
flows();

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
  beam: [34, SIZES.beam.y1, PIVOT[1] + 9],
  piston: [Layout.axis + 6, 1, 188],
  cylinder: [Layout.axis - 12, 0, 120],
  valves: [SIZES.boxes.x1 - 4, 0, SIZES.boxes.upper[1] - 4],
  steam: [SIZES.pipes.throttleX + 14, SIZES.pipes.steamY + 3, SIZES.pipes.mainZ + 6],
  condenser: [SIZES.cistern.x1 - 2, 0, SIZES.cistern.z1],
  rod: [SHAFT[0] + 4, SIZES.gears.rodY[1], 168],
  flywheel: [SHAFT[0] + 44, SIZES.flywheel.y1, SHAFT[1] + 34],
  governor: [SIZES.governor.x, SIZES.governor.y, SIZES.governor.top + 8],
  base: [SIZES.floor.x1 - 8, SIZES.floor.y1 - 6, 0],
};

// Where the six step numbers of the film sit: beside the part each step is about.
const STEP_POINTS = [
  [SIZES.boxes.x1 + 9, 0, SIZES.boxes.upper[1] + 6],
  [Layout.axis - 26, 0, 120],
  [-28, 4, PIVOT[1] + 22],
  [SHAFT[0] + 36, 8, SHAFT[1] + 40],
  [SIZES.cistern.x0 - 7, 0, 34],
  [SIZES.governor.x + 4, SIZES.governor.y, SIZES.governor.top + 14],
];

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
  for (const item of items.filter((entry) => entry.crosses)) console.log(`declared crossing: ${item.label} (${item.piece}) is not ordered against ${item.crosses === "all" ? "other assemblies" : `the ${item.crosses} assembly`}`);
  console.log(`explode audit · ${items.length} items · ${blocks} blocks · ${result.flights} flights · ${result.frames} frames`);
  const problems = measured.cycles + result.contradictions.length + result.cycles + result.through.size + result.sunkApart.length;
  console.log(problems ? `explode audit failed: ${problems} problems` : "explode audit passed");
  process.exit(problems ? 1 : 0);
}

if (audit) runAudit();

const scene = `<g id="we-scene" data-dyn="world">${items.map((item) => `<g class="we-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;

// The one zoom frame: a second, enlarged view of the same live drawing, held on the cylinder, the valve
// chests and the condenser. It is born from a source rectangle on the engine (live.js draws the birth), so
// nothing of it is drawn here but empty elements. `frame` is where it ends up on the stage, `scale` how
// much it enlarges the drawing, `nudge` moves the source on the stage, and `room` is the view the page
// takes to make room for it (the film moves its own camera).
const INSET_FOCUS = [-76, 0, 90];
const INSET = film
  ? { frame: { x: 44, y: 92, width: 660, height: 800, radius: 14 }, scale: 2.05, nudge: [22, 0], room: null }
  : { frame: { x: 384, y: 46, width: 190, height: 396, radius: 6 }, scale: 1.45, nudge: [-5, 0], room: { x: 433, y: 280, zoom: 0.7 } };

function insetSource() {
  const focus = k.iso(INSET_FOCUS, P);
  const width = INSET.frame.width / INSET.scale;
  const height = INSET.frame.height / INSET.scale;
  return { x: focus[0] + INSET.nudge[0] - width / 2, y: focus[1] + INSET.nudge[1] - height / 2, width, height };
}

function insetMarkup() {
  const view = `<g clip-path="url(#we-inset-clip)"><use href="#we-scene" data-inset="view"/></g>`;
  const frame = `<g data-inset="group" opacity="0"><clipPath id="we-inset-clip"><rect data-inset="clip"/></clipPath><rect class="we-inset-paper" data-inset="paper"/>${view}<rect class="we-inset-edge" data-inset="edge"/></g>`;
  const guides = `<g data-inset="guides" opacity="0"><rect class="we-inset-edge" data-inset="source"/><path class="we-inset-guide" data-inset="lines"/></g>`;
  return frame + guides;
}

const world = `<g data-dyn="lens">${scene}</g>${insetMarkup()}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A Boulton and Watt double-acting rotative beam engine drawn as an isometric machine. On the left a cylinder, cut open, with its piston; beside it two valve chests, a steam pipe from the boiler with a throttle valve, and below them a cistern holding the separate condenser and the air pump. A beam rocks on a column in the middle; Watt's parallel motion joins its left end to the piston rod. On the right a connecting rod carries a planet gear round a sun gear on the flywheel shaft. A centrifugal governor between the column and the flywheel is driven by a belt and linked by a rod to the throttle valve. Steam is drawn in orange and used steam and water in blue. The engine can be taken apart into ten numbered assemblies.",
  body: world,
});

const CSS = `
.iso[data-theme="light"]{--anatomy-weight:.85px;--anatomy-lit:#d9480f;--anatomy-lo:#85858c;--anatomy-mid:#55555c;--anatomy-hi:#1a1a1e;--anatomy-faint:#bcbcc1;--anatomy-muted:#6c6c72;--anatomy-text:#3f3f45;--anatomy-shade-0:#cdcdc8;--anatomy-shade-1:#dadad5;--anatomy-shade-2:#e5e5e0;--anatomy-shade-3:#efefea;--anatomy-top:#f9f9f6;--we-steam:#d9480f;--we-exhaust:#1864ab}
.iso[data-theme="dark"]{--anatomy-weight:.85px;--anatomy-lit:#ff9f43;--anatomy-page:#09090a;--anatomy-card:#111113;--anatomy-lo:#7a7a82;--anatomy-mid:#a6a6ae;--anatomy-hi:#e4e4e8;--anatomy-faint:#4c4c53;--anatomy-muted:#8b8b93;--anatomy-text:#bcbcc3;--anatomy-shade-0:#1e1e22;--anatomy-shade-1:#26262b;--anatomy-shade-2:#2f2f35;--anatomy-shade-3:#38383f;--anatomy-top:#44444c;--we-steam:#ff9f43;--we-exhaust:#74c0fc}
.we-face{fill:var(--anatomy-top);stroke:none}
.we-face[data-tone="dark"]{fill:var(--anatomy-shade-1)}
.we-pin{fill:var(--anatomy-hi);stroke:none}
.we-ball{fill:var(--anatomy-shade-0);stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.3)}
.we-ball-light{fill:var(--anatomy-shade-2);stroke:none}
.we-arm{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*3);stroke-linecap:round}
.we-arm-core{fill:none;stroke:var(--anatomy-shade-3);stroke-width:calc(var(--anatomy-weight)*1.3);stroke-linecap:round}
.we-inset-paper{fill:var(--anatomy-card);stroke:none}
.we-inset-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight)}
.we-inset-guide{fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-dasharray:calc(var(--anatomy-weight)*4) calc(var(--anatomy-weight)*3.4)}
.we-shine{fill:var(--anatomy-top);stroke:none}
.we-bore{fill:var(--anatomy-card);stroke:none}
.we-fill{--glow:0;stroke:none;opacity:calc(var(--glow)*.5)}
.we-fill[data-kind="steam"]{fill:var(--we-steam)}
.we-fill[data-kind="exhaust"]{fill:var(--we-exhaust)}
.we-water{fill:var(--we-exhaust);opacity:.13;stroke:none}
.we-jet{fill:none;stroke:var(--we-exhaust);stroke-width:calc(var(--anatomy-weight)*.9);stroke-linecap:round;stroke-dasharray:calc(var(--anatomy-weight)*.2) calc(var(--anatomy-weight)*2.2)}
.we-port{fill:none;stroke:var(--anatomy-card);stroke-width:calc(var(--anatomy-weight)*2.2);stroke-linecap:butt}
.we-rod{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.5);stroke-linecap:round;stroke-linejoin:round}
.we-rod[data-thin]{stroke-width:calc(var(--anatomy-weight)*1.1)}
.we-belt{fill:none;stroke:var(--anatomy-mid);stroke-width:calc(var(--anatomy-weight)*1.4);stroke-linecap:round}
.we-outline{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-dasharray:calc(var(--anatomy-weight)*3.2) calc(var(--anatomy-weight)*2.6);stroke-linecap:round;stroke-linejoin:round}
.we-throttle{fill:none;stroke:var(--we-steam);stroke-width:calc(var(--anatomy-weight)*2.2);stroke-linecap:round}
.we-handle{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.7);stroke-linecap:round}
.we-knob{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight)}
.we-knob[data-kind="steam"]{fill:color-mix(in srgb,var(--we-steam) calc(var(--glow)*100%),var(--anatomy-card))}
.we-knob[data-kind="exhaust"]{fill:color-mix(in srgb,var(--we-exhaust) calc(var(--glow)*100%),var(--anatomy-card))}
.we-flow{--glow:0;fill:none;stroke:var(--we-steam);stroke-width:calc(var(--anatomy-weight)*2.3);stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:calc(var(--anatomy-weight)*5) calc(var(--anatomy-weight)*4);opacity:var(--glow);pointer-events:none}
.we-flow[data-kind="exhaust"]{stroke:var(--we-exhaust);stroke-dasharray:calc(var(--anatomy-weight)*2.2) calc(var(--anatomy-weight)*3.4)}
.we-tracebox{margin-top:12px;user-select:none;-webkit-user-select:none}
.we-trace{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 8px;font-size:13px;color:var(--anatomy-strong)}
.we-chip{--glow:0;white-space:nowrap;opacity:calc(.38 + .62*var(--glow))}
.we-chip-arrow{color:var(--anatomy-lo)}
.we-pathkey{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 20px;margin-top:9px;font-size:12px;color:var(--anatomy-muted)}
.we-pathkey span{display:flex;align-items:center;gap:8px;white-space:nowrap}
.we-swatch{display:block;width:24px;border-top:3px dashed var(--we-steam)}
.we-swatch[data-kind="exhaust"]{border-top:3px dotted var(--we-exhaust)}
.we-steps,.we-stepmark{display:none}
.iso-stage{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.we-badges{position:absolute;inset:0;pointer-events:none}
.we-badge,.we-num{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;flex:none;font-family:var(--anatomy-mono);font-size:10.5px;font-weight:600;line-height:1;color:var(--anatomy-card);background:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.we-badge{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;opacity:0;box-shadow:0 0 0 2px var(--anatomy-card)}
.we-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:5px 18px;margin:0;padding:0;list-style:none}
.we-parts li{display:flex;align-items:center;gap:8px}
.we-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-left:-10px;user-select:none;-webkit-user-select:none}
.we-controls button{font:inherit;font-size:13px;color:var(--anatomy-muted);background:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer}
.we-controls button:hover{color:var(--anatomy-strong)}
.we-controls button[aria-pressed="true"]{color:var(--anatomy-strong);background:color-mix(in srgb,var(--anatomy-strong) 10%,transparent)}
.we-controls button:focus-visible,.we-load input:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:1px}
.we-load{display:flex;align-items:center;gap:8px;margin-left:auto;padding:5px 10px;font-size:13px;color:var(--anatomy-muted)}
.we-load input{width:120px;accent-color:var(--we-steam)}
.we-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.we-film-legend{display:none}
html,body{overflow-x:hidden}
@media (max-width:520px){.iso-plate-corner[data-corner="hint"]{display:none}}
`;

const FILM_CSS = `
html,body{margin:0!important;overflow:hidden!important;background:var(--anatomy-card)!important}
.iso{--anatomy-weight:1.6px}
.iso-page{width:1920px!important;margin:0!important}
.iso-figure{margin:0!important}
.iso-plate{width:1920px;height:1080px;padding:0!important;overflow:hidden;box-shadow:none!important;box-sizing:border-box}
.iso-plate-corners{inset:34px 44px!important;z-index:3}
.iso-plate-corner{font-size:21px!important;background:var(--anatomy-card);padding:8px 12px;margin:-8px -12px;border-radius:6px}
.iso-plate-corner[data-corner="hint"]{display:none}
.iso-legend,.we-sr{display:none!important}
.we-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.we-film-legend{display:grid;grid-template-columns:repeat(5,auto);justify-content:center;gap:12px 30px;position:absolute;left:0;right:0;bottom:84px;margin:0;padding:0;list-style:none;font-size:21px;color:var(--anatomy-text);opacity:var(--we-apart,0)}
.we-film-legend{font-size:20px!important}
.we-film-legend li{display:flex;align-items:center;gap:10px;white-space:nowrap}
.we-film-legend .we-num{width:30px;height:30px;font-size:17px}
.we-tracebox{position:absolute;left:44px;bottom:34px;margin:0;z-index:3;opacity:calc((1 - var(--we-open,0))*(1 - var(--we-steps,0)))}
.we-trace{justify-content:flex-start;font-size:25px;gap:0 14px}
.we-pathkey{justify-content:flex-start;font-size:20px;gap:0 40px;margin-top:14px}
.we-pathkey span{gap:12px}
.we-swatch{width:44px;border-top-width:5px!important}
.we-steps{display:grid;grid-template-columns:repeat(2,auto);grid-auto-flow:column;grid-template-rows:repeat(3,auto);justify-content:start;gap:10px 46px;position:absolute;left:44px;bottom:34px;margin:0;padding:0;list-style:none;font-size:25px;color:var(--anatomy-strong);z-index:3;opacity:var(--we-steps,0)}
.we-steps li{--glow:0;display:flex;align-items:center;gap:13px;white-space:nowrap;opacity:calc(.16 + .84*var(--glow))}
.we-steps .we-num{width:34px;height:34px;font-size:19px}
.we-stepmark{display:grid;background:var(--we-steam)}
.we-stepmark[data-kind="exhaust"]{background:var(--we-exhaust)}
`;

const pieces = Object.entries(Explode.PIECES).sort((a, b) => a[1].number - b[1].number);
const SHORT_NAMES = {
  beam: "Beam, parallel motion",
  piston: "Piston and rod",
  cylinder: "Cylinder, cut open",
  valves: "Valve chests, plug rod",
  steam: "Steam pipe, throttle valve",
  condenser: "Condenser, air pump",
  rod: "Connecting rod, planet gear",
  flywheel: "Sun gear, flywheel",
  governor: "Centrifugal governor",
  base: "Bed, column, frame",
};
const partsList = (className, names = {}) => `<ol class="${className}">${pieces.map(([name, piece]) => `<li><span class="we-num">${piece.number}</span>${names[name] ?? piece.name}</li>`).join("")}</ol>`;
const EXHAUST_STEP = 4;
const stepMarks = film ? Engine.STEPS.map((_, index) => `<span class="we-badge we-stepmark" data-stepmark="${index}"${index === EXHAUST_STEP ? ' data-kind="exhaust"' : ""}>${index + 1}</span>`).join("") : "";
const badges = `<div class="we-badges" aria-hidden="true">${pieces.map(([name, piece]) => `<span class="we-badge" data-badge="${name}">${piece.number}</span>`).join("")}${stepMarks}</div>`;
const stepList = `<ol class="we-steps" aria-hidden="true">${Engine.STEPS.map((step, index) => `<li data-step-item="${index}"><span class="we-num">${index + 1}</span>${step.label}</li>`).join("")}</ol>`;

// The trace: four short phrases that light up one after the other on every stroke.
const chips = Engine.TRACE.map((text, index) => `<span class="we-chip" data-trace="${index}">${text}${index === 0 ? " down" : ""}</span>`);
const pathKey = `<div class="we-pathkey"><span><i class="we-swatch"></i>steam from the boiler</span><span><i class="we-swatch" data-kind="exhaust"></i>used steam and water, to the condenser</span></div>`;
const traceBox = `<div class="we-tracebox" aria-hidden="true"><div class="we-trace">${chips.join('<span class="we-chip-arrow">→</span>')}</div>${pathKey}</div>`;

const controls = `<span class="we-controls" role="group" aria-label="Engine controls"><button type="button" data-apart aria-pressed="false">Take apart</button><button type="button" data-sound aria-pressed="false">Sound</button><button type="button" data-pause aria-pressed="false">Pause</button><button type="button" data-step>One stroke</button><label class="we-load">Load<input type="range" data-load min="0" max="100" value="50" aria-label="Load on the engine, per cent"></label></span>`;

const stageLabel = "Watt steam engine. Space pauses and runs it, the right arrow plays one stroke and stops, the up and down arrows change the load, Shift and E take the engine apart and put it back together.";

const plate = k.plateHtml({
  fig: "Fig 4",
  title: "Watt rotative beam engine, 1780s",
  hint: "Space: pause · Shift+E: apart",
  readout: "strokes 0",
  keys: [{ mark: "raised", label: "Cylinder, valve chests, condenser, air pump, beam, sun and planet gear, flywheel, governor" }],
  caption:
    "A double-acting rotative beam engine of the kind Boulton & Watt built in the 1780s, drawn with the cylinder, the condenser and the air pump cut open. Steam from the boiler (in outline) passes the throttle valve and reaches the two valve chests. On the down stroke it is let in above the piston while the space below is open to the condenser; at the end of the stroke the valves change over, so the piston is pushed both ways. The used steam runs to the separate condenser, the idea Watt had in 1765 and patented in 1769: a vessel kept cold in a cistern, where a jet of water condenses the steam while the cylinder itself stays hot. The air pump then lifts the water out. Because the piston now pushes as well as pulls, a chain to the beam will not do, so Watt's parallel motion of 1784 guides the top of the piston rod in a nearly straight line while the beam end swings through an arc. At the other end the connecting rod carries a planet gear that cannot turn on it; it rolls round the sun gear on the flywheel shaft, and with equal gears the shaft turns twice for each double stroke. The gear, invented by William Murdoch and patented by Watt in 1781, did the work of a crank, which another patent covered. The flywheel evens out the strokes. The centrifugal governor, which Watt adapted in 1788, is spun by the shaft: when the engine runs faster the balls swing out and lift a sleeve, and a rod closes the throttle valve; when it slows they drop and the valve opens. Change the load and watch the speed settle. In this drawing a rod hung from the beam trips the valves and the air pump hangs from the parallel motion; the sizes, the speeds and the valve timing are the figure's own, not measurements of one engine. Taken apart, the numbers mark ten assemblies.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${stageLabel}">${svg}${badges}</div>${traceBox}${film ? stepList + partsList("we-film-legend", SHORT_NAMES) : ""}`,
});

const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);
const withParts = withControls.replace('<span class="iso-caption">', `${partsList("we-parts")}<span class="iso-caption">`);
const body = `<style>${CSS}${film ? FILM_CSS : ""}</style>${withParts}<span class="we-sr" data-announce aria-live="polite"></span>`;

const config = {
  projection: P,
  stepPoints: STEP_POINTS,
  inset: { frame: INSET.frame, source: insetSource(), room: INSET.room },
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
// The kit's page builder is not used inside the page, and its text would put document tags into the script.
const kitInPage = kitScript().replace(/function pageHtml\([\s\S]*?\n}\n/, "");
if (/<!doctype|<html|<head|<meta|<body/i.test(kitInPage)) throw new Error("the inlined kit still names document tags");
const script = `${kitInPage}\nlet Engine;\n{\n${read("model.mjs")}\nEngine = EngineApi;\n}\nlet Layout;\nlet Draw;\nlet Explode;\n{\n${read("explode.mjs")}\nExplode = ExplodeApi;\n}\n{\nconst CONFIG = ${JSON.stringify(config)};\n${read("layout.mjs")}\nLayout = createLayout(Engine);\nDraw = createDraw({ iso, pathOf, cameraOf }, CONFIG.projection);\n${read("live.js")}\n${read("apart.js")}\n}\n`;

const suffix = `${film ? "-film" : ""}${theme === "dark" ? "-dark" : ""}`;
const file = `watt-steam-engine-anatomy${suffix}.html`;
const TITLE = "Watt Steam Engine Anatomy";
const html = k.pageHtml({ title: TITLE, theme, body, script, width: 650 });
writeFileSync(join(HERE, file), html);

// The copy for publishing: no doctype, html, head, meta or body tags; it starts with the title and the styles.
function publishCopy(page) {
  const styles = /<style>[\s\S]*?<\/style>/.exec(page)[0];
  const content = page.slice(page.indexOf(">", page.indexOf("<body")) + 1, page.lastIndexOf("</body>"));
  const setup = `<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>`;
  return `<title>${TITLE}</title>${styles}${setup}${content}`;
}

if (!film && theme === "light") {
  mkdirSync(join(HERE, "publish"), { recursive: true });
  writeFileSync(join(HERE, "publish", file), publishCopy(html));
}
const solids = (svg.match(/class="iso-solid/g) ?? []).length;
const paths = (svg.match(/<path/g) ?? []).length;
console.log(`wrote ${file} · ${theme} · ${(html.length / 1024).toFixed(0)} KB · ${items.length} items · ${solids} static solids · ${paths} static paths · scale ${P.scale.toFixed(3)} · order cycles assembled ${measured.cycles}`);
