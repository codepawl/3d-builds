import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExplodeKit } from "../kit/explode.mjs";
import { lintMachine } from "../kit/truth.mjs";
import { createTextRegistry } from "../kit/texts.mjs";
import { styleDefs, STYLE_NAMES } from "../kit/styles.mjs";
import { THEME_NAMES, missingTokens } from "../kit/themes.mjs";
import { filmShapeProblems, filmSpecOf, formatOf, stepsAt, speedAt } from "../kit/film.mjs";

const pieces = {
  lid: { number: 1, name: "Lid", axis: [0, 0, 1], distance: 20 },
  body: { number: 2, name: "Body", axis: [1, 0, 0], distance: 10 },
  base: { number: 3, name: "Base", axis: [0, 0, 1], distance: 0 },
};

test("the exploded view leaves along each removal axis, staggered, and returns exactly", () => {
  const explode = createExplodeKit({ pieces, leaveOrder: ["lid", "body"] });
  const state = explode.createExplode();
  explode.setApart(state, true, false);
  const leaves = [];
  for (let step = 0; step < 60 * 6; step++) leaves.push(...explode.stepExplode(state, 1 / 60).filter((event) => event.name === "leave"));
  assert.deepEqual(leaves.map((event) => event.piece), ["lid", "body"]);
  assert.ok(Math.abs(leaves[1].at - leaves[0].at - explode.SPRING.stagger) < 0.02);
  assert.deepEqual(explode.shiftsOf(state).lid, [0, 0, 20]);
  assert.deepEqual(explode.shiftsOf(state).body, [10, 0, 0]);
  assert.ok(explode.isFixed("base"));
  explode.setApart(state, false, false);
  for (let step = 0; step < 60 * 6; step++) explode.stepExplode(state, 1 / 60);
  assert.ok(Object.values(explode.shiftsOf(state)).every((shift) => shift.every((value) => value === 0)));
});

function fakeLoaded(overrides = {}) {
  const facts = {
    "seen-it": { text: "The lid lifts off.", source: "https://example.org/lid", quote: "the lid lifts off", status: "verified" },
    "guess": { text: "The body is cast.", source: "https://example.org/body", note: "From photographs.", status: "inferred" },
  };
  const machine = {
    pieces: {
      lid: { number: 1, provenance: { kind: "sourced", facts: ["seen-it"], images: ["a.jpg"] } },
      body: { number: 2, provenance: { kind: "simplified", facts: ["guess"], note: { text: "Drawn without ribs.", facts: ["guess"] }, images: ["b.jpg", "c.jpg"] } },
    },
    readouts: [{ pattern: "^idle$", facts: ["guess"] }],
    functions: [{ id: "lid", part: "lid", does: "the lid lifts off", outOfScope: "a test fixture" }],
  };
  return { machine: { ...machine, ...overrides.machine }, facts: { facts: { ...facts, ...overrides.facts } }, dir: fakeMachineFolder() };
}

// A machine folder with three reference images and their sources.json.
function fakeMachineFolder() {
  const dir = mkdtempSync(join(tmpdir(), "anatomy-lint-"));
  const images = join(dir, "reference", "images");
  mkdirSync(images, { recursive: true });
  const files = ["a.jpg", "b.jpg", "c.jpg"];
  for (const file of files) writeFileSync(join(images, file), "");
  writeFileSync(join(images, "sources.json"), JSON.stringify({ images: files.map((file) => ({ file, url: "https://example.org/" + file, shows: "the lid" })) }));
  return dir;
}

function fakePage(build) {
  const texts = createTextRegistry();
  const parts = build(texts);
  return { texts, html: `<body>${parts.map((text) => `<span>${text}</span>`).join("")}</body>` };
}

test("lint passes texts that rest on facts", () => {
  const page = fakePage((texts) => [texts.fact({ text: "The lid lifts off.", facts: ["seen-it"] }), texts.ui("Take apart"), texts.readout("idle")]);
  assert.deepEqual(lintMachine(fakeLoaded(), page).problems, []);
});

test("lint fails a text with no fact, a fact with no source and an unverified superlative", () => {
  const page = fakePage((texts) => [texts.fact("A bare claim."), texts.fact({ text: "The first cast body.", facts: ["guess"] })]);
  const loaded = fakeLoaded({ facts: { sourceless: { text: "x", status: "verified", quote: "x" } } });
  const problems = lintMachine(loaded, page).problems.join("\n");
  assert.match(problems, /names no fact/);
  assert.match(problems, /fact "sourceless" has no source/);
  assert.match(problems, /says "first" but rests on unverified facts: guess/);
});

test("lint fails a machine without enough reference images or an assembly that names none", () => {
  const page = fakePage((texts) => [texts.fact({ text: "The lid lifts off.", facts: ["seen-it"] }), texts.readout("idle")]);
  const loaded = fakeLoaded();
  loaded.machine.pieces.body.provenance.images = [];
  loaded.dir = mkdtempSync(join(tmpdir(), "anatomy-lint-"));
  const problems = lintMachine(loaded, page).problems.join("\n");
  assert.match(problems, /has 0 images; collect at least 3/);
  assert.match(problems, /assembly "body" names no reference image/);
});

test("lint fails text that bypassed the registry, a stray readout and a part with no provenance", () => {
  const page = fakePage((texts) => [texts.readout("running")]);
  page.html = page.html.replace("</body>", "<p>Invented on a Tuesday</p></body>");
  const loaded = fakeLoaded();
  loaded.machine.pieces.lid.provenance = undefined;
  const problems = lintMachine(loaded, page).problems.join("\n");
  assert.match(problems, /no registered text covers/);
  assert.match(problems, /readout "running" matches no readout template/);
  assert.match(problems, /assembly "lid" has no provenance mark/);
});

test("every theme has every token and every style has its patterns", () => {
  for (const theme of THEME_NAMES) assert.deepEqual(missingTokens(theme), [], theme);
  const defs = styleDefs({ width: 100, height: 100 });
  for (const prefix of ["ma-dither", "ma-halftone", "ma-hatch"]) {
    for (let level = 0; level <= 4; level++) assert.ok(defs.includes(`id="${prefix}-${level}"`), `${prefix}-${level}`);
  }
  assert.ok(defs.includes('id="ma-pixel-dark-ink"') && defs.includes('id="ma-pixel-light-ink"'));
  assert.deepEqual(STYLE_NAMES, ["line", "dither", "halftone", "hatching", "pixel"]);
});

test("dither density falls from the deepest shade to the top face", () => {
  const defs = styleDefs({ width: 100, height: 100, cell: 1 });
  const inkOf = (level) => (new RegExp(`id="ma-dither-${level}"[\\s\\S]*?</pattern>`).exec(defs)[0].match(/<circle cx=/g) ?? []).length;
  const counts = [0, 1, 2, 3, 4].map(inkOf);
  assert.ok(counts.every((count, index) => index === 0 || count < counts[index - 1]), counts.join(" "));
});

test("the film spec defaults to the approved shape and the formats resolve", () => {
  const spec = filmSpecOf({});
  assert.equal(spec.seconds, 30);
  assert.ok(spec.slow.from >= spec.minimum.opening);
  assert.ok(spec.apart.open - spec.slow.to >= spec.minimum.normal);
  assert.equal(speedAt(spec, 1), 1);
  assert.equal(speedAt(spec, 8), spec.slow.speed);
  assert.equal(stepsAt(spec, 1), 0);
  assert.equal(stepsAt(spec, 8), 1);
  assert.equal(formatOf("square").width, 1080);
  assert.equal(formatOf("9:16").height, 1920);
  assert.throws(() => formatOf("4:3"));
});

test("the in-motion film variant eases time down, keeps the steps window and checks a dissection in flight", () => {
  const spec = filmSpecOf({ variant: "in-motion", slow: { from: 10, to: 18, speed: 0.2, ease: 0.7 }, apart: { open: 10.3, close: 14.5 }, steps: { from: 4.6, to: 21 } });
  assert.equal(speedAt(spec, 9.9), 1);
  assert.ok(speedAt(spec, 10.2) < 1 && speedAt(spec, 10.2) > 0.2);
  assert.ok(Math.abs(speedAt(spec, 14) - 0.2) < 1e-9);
  assert.equal(stepsAt(spec, 15), 1);
  assert.equal(stepsAt(spec, 4), 0);
  const states = Array.from({ length: spec.fps * spec.seconds }, (_, frame) => ({ time: frame / spec.fps, working: true, open: 0, zoomAge: frame / spec.fps >= 5 ? 0 : -1 }));
  const events = [{ name: "apart-open", at: 10.4 }, { name: "apart-hold", at: 12.6 }, { name: "apart-close", at: 14.5 }, { name: "apart-seated", at: 16.8 }];
  assert.deepEqual(filmShapeProblems(spec, events, states), []);
  const late = events.map((event) => (event.name === "apart-seated" ? { ...event, at: 18.5 } : event));
  assert.ok(filmShapeProblems(spec, late, states).some((problem) => problem.includes("not inside the slow run")));
  const stopped = states.map((state) => (state.time > 12 && state.time < 13 ? { ...state, working: false } : state));
  assert.ok(filmShapeProblems(spec, events, stopped).some((problem) => problem.includes("stops working")));
});

test("the plume effect follows throttle and thin air, cuts at the ground and flickers the same every time", async () => {
  const { plume, puffs, glow } = await import("../kit/effects.mjs");
  const widest = (shape) => Math.max(...shape.body.map(([across]) => across));
  const low = plume({ throttle: 0.6, thin: 0, time: 1 });
  const full = plume({ throttle: 1, thin: 0, time: 1 });
  const high = plume({ throttle: 1, thin: 0.9, time: 1 });
  assert.ok(full.length > low.length, "longer at throttle-up");
  assert.ok(widest(high) > widest(full) && high.bodyOpacity < full.bodyOpacity, "wider and more translucent in thin air");
  assert.ok(full.diamonds.length > 0 && high.diamonds.length === 0, "shock diamonds only in thick air");
  const widestHalo = Math.max(...full.halo.map(([across]) => across));
  const widestCore = Math.max(...full.core.map(([across]) => across));
  assert.ok(widestHalo > widest(full) && widestCore < widest(full) * 0.7, "a soft halo outside the body and a narrow core inside it");
  const landing = plume({ throttle: 1, thin: 0, ground: 3, time: 1 });
  assert.ok(landing.length <= 3 && landing.splash, "cut at the deck, with a splash");
  assert.deepEqual(plume({ throttle: 1, time: 2.5, seed: 4 }), plume({ throttle: 1, time: 2.5, seed: 4 }));
  assert.ok(puffs({ age: 5 }).length > 0 && puffs({ age: 0 }).length === 0);
  assert.ok(glow({ power: 1, distance: 0 }) > glow({ power: 1, distance: 40 }));
});

test("completeness: every function is shown working or has a reason, and the film shows it change", async () => {
  const { lintFunctions, functionProblems } = await import("../kit/causality.mjs");
  const machine = { pieces: { arm: {} }, film: { seconds: 10 }, functions: [{ id: "lift", part: "arm", does: "the arm lifts", probe: "lift", shown: [2] }, { id: "idle", part: "arm", does: "the arm turns" }] };
  assert.match(lintFunctions(machine).join("\n"), /idle is never shown working/);
  assert.match(lintFunctions({ pieces: {} }).join("\n"), /lists no functions/);
  const still = Array.from({ length: 60 }, (_, frame) => ({ lift: 0, time: frame / 10 }));
  const moving = still.map((state, frame) => ({ ...state, lift: frame / 60 }));
  assert.match(functionProblems(machine.functions, still, 10).join("\n"), /lift is not seen working near 2 s/);
  assert.deepEqual(functionProblems(machine.functions, moving, 10), []);
});

test("causality: a turn needs a cause and a believable rate; compressed time must be shown", async () => {
  const { causalityProblems, timeShownProblems } = await import("../kit/causality.mjs");
  const { stepRateLimited, createSpring, springFor } = await import("../kit/motion.mjs");
  const body = { name: "booster", angle: "angle", clock: "clock", maxRate: 10, cause: (state) => state.cause };
  const turning = (cause, rate) => Array.from({ length: 40 }, (_, frame) => ({ time: frame / 30, clock: frame * 0.1, angle: frame < 20 ? 0 : (frame - 20) * 0.1 * rate, cause }));
  assert.match(causalityProblems([body], turning("thruster", 0.6)).join("\n"), /faster than the 10 deg\/s/);
  assert.match(causalityProblems([body], turning("none", 0.1)).join("\n"), /with nothing acting on it/);
  assert.deepEqual(causalityProblems([body], turning("thruster", 0.1)), []);
  const spring = createSpring({ ...springFor(1, 1), value: 0, target: 1 });
  spring.settled = false;
  assert.ok(stepRateLimited(spring, 1, 0.1) <= 0.1 + 1e-9, "a rate-limited spring moves no faster than its actuator");
  const fast = Array.from({ length: 10 }, (_, frame) => ({ time: frame / 30, clock: frame, readout: frame > 5 ? "T+0:05 · time ×30" : "T+0:05" }));
  assert.match(timeShownProblems({ clock: "clock", timeShown: "time ×" }, fast).join("\n"), /readout does not show it/);
});
