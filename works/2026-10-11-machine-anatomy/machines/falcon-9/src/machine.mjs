// SpaceX Falcon 9 on the machine-anatomy kit: its assemblies with their removal axes and provenance,
// every visible text with the facts it rests on, the readout templates, the controls, the film story and
// the sound voices. The model is model.mjs, the sizes layout.mjs, the drawing figure.mjs and the live
// hooks live.js.
import { FalconApi as Falcon } from "./model.mjs";

const fact = (text, ...facts) => ({ text, facts });
const UP = [0, 0, 1];
const DOWN = [0, 0, -1];
const sourced = (...facts) => ({ kind: "sourced", facts });
const inferred = (...facts) => ({ kind: "inferred", facts });

// Assemblies, numbered for the legend from the top down. Everything on the stack lifts off along the
// rocket's own axis, as it is stacked; the fairing halves part sideways at their seam, as they do in
// flight; the engines drop out of the engine section. The RP-1 tank, the legs and the scenery stay.
const pieces = {
  fairingLeft: { number: 1, name: fact("Fairing half, carbon composite", "spacex-fairing", "guide-fairing-halves"), short: fact("Fairing half", "guide-fairing-halves"), move: [-4.4, 4.4, 21], provenance: sourced("spacex-fairing", "spacex-fairing-size", "guide-fairing-halves") },
  fairingRight: { number: 2, name: fact("Fairing half, opened by pneumatic pushers", "guide-fairing-halves"), short: fact("Fairing half", "guide-fairing-halves"), move: [4.4, -4.4, 21], provenance: sourced("spacex-fairing", "spacex-fairing-size", "guide-fairing-halves") },
  payload: { number: 3, name: fact("Payload on its adapter", "spacex-fairing"), short: fact("Payload", "spacex-fairing"), axis: UP, distance: 23, provenance: { kind: "simplified", facts: ["spacex-fairing"], note: fact("The payload is a plain box standing in for any satellite.", "spacex-fairing") } },
  upper: { number: 4, name: fact("Second stage: LOX and RP-1 tanks, nitrogen thrusters", "spacex-second-stage", "guide-nitrogen-thrusters"), short: fact("Second stage", "spacex-second-stage"), axis: UP, distance: 15, provenance: inferred("spacex-second-stage", "drawing-proportions") },
  mvac: { number: 5, name: fact("Merlin Vacuum engine with its long 165:1 nozzle", "spacex-second-stage", "guide-mvac-nozzle"), short: fact("Merlin Vacuum engine", "spacex-second-stage"), axis: UP, distance: 8, provenance: inferred("guide-mvac-nozzle", "drawing-proportions") },
  interstage: { number: 6, name: fact("Interstage with four grid fins and nitrogen thrusters", "spacex-interstage", "spacex-grid-fins", "guide-nitrogen-thrusters"), short: fact("Interstage, grid fins", "spacex-interstage", "spacex-grid-fins"), axis: UP, distance: 2, provenance: inferred("spacex-interstage", "spacex-grid-fins", "thruster-place") },
  lox: { number: 7, name: fact("Liquid oxygen tank, down to the common dome", "spacex-first-stage", "guide-common-dome"), short: fact("LOX tank", "guide-common-dome"), axis: UP, distance: 1, provenance: inferred("guide-common-dome", "drawing-proportions") },
  rp1: { number: 8, name: fact("RP-1 kerosene tank", "spacex-first-stage", "guide-common-dome"), short: fact("RP-1 tank", "spacex-first-stage"), axis: UP, distance: 0, provenance: inferred("guide-common-dome", "drawing-proportions") },
  legs: { number: 9, name: fact("Four landing legs, folded up for the climb", "guide-fins-legs"), short: fact("Landing legs", "guide-fins-legs"), axis: UP, distance: 0, provenance: { kind: "simplified", facts: ["guide-fins-legs"], note: fact("The legs are flat strips without their struts.", "guide-fins-legs") } },
  engines: { number: 10, name: fact("Nine Merlin engines, eight round a centre one", "guide-nine-engines", "guide-engine-layout"), short: fact("Nine Merlin engines", "guide-engine-layout"), axis: DOWN, distance: 3, provenance: { kind: "simplified", facts: ["guide-engine-layout"], note: fact("Engine bells are plain turned shapes; the flames, shock diamonds and exhaust cloud are drawn effects driven by throttle and altitude, not measured shapes.", "guide-engine-layout", "plume-drawing", "wiki-shock-diamonds") } },
  scene: { number: 11, badge: false, name: fact("Launch pad SLC-40 and droneship", "guide-slc40", "asds-barge"), short: fact("Pad SLC-40, droneship", "guide-slc40", "asds-barge"), axis: UP, distance: 0, provenance: { kind: "simplified", facts: ["guide-slc40", "guide-lightning-wires", "guide-strongback", "guide-clamps", "wiki-slc40-crew-tower", "photo-lightning-towers", "photo-erector", "photo-crew-tower", "asds-barge", "pad-drawing", "film-compression"], note: fact("The pad (mount, clamps, trench, erector, access tower, lightning towers and wires) is drawn plain after photographs, with the lightning towers closer in than they stand; the droneship is drawn small; the erector tilts back in about a second, and the flight's distances and times are squeezed to fit the frame.", "pad-drawing", "photo-lightning-towers", "photo-erector", "photo-crew-tower", "guide-strongback", "asds-barge", "film-compression") } },
};

// The reference images (reference/images/sources.json) each assembly was drawn from.
const PIECE_IMAGES = {
  fairingLeft: ["pad-2.jpg", "pad-3.jpg"],
  fairingRight: ["pad-2.jpg", "pad-3.jpg"],
  payload: ["pad-2.jpg"],
  upper: ["pad-2.jpg", "pad-4.jpg"],
  mvac: ["pad-2.jpg"],
  interstage: ["pad-4.jpg", "booster-landed.jpg"],
  lox: ["pad-2.jpg", "booster-landed.jpg"],
  rp1: ["pad-2.jpg", "booster-landed.jpg"],
  legs: ["octaweb.jpg", "booster-landed.jpg"],
  engines: ["octaweb.jpg"],
  scene: ["pad-1.jpg", "pad-2.jpg", "pad-3.jpg", "pad-4.jpg"],
};
for (const [name, images] of Object.entries(PIECE_IMAGES)) pieces[name].provenance.images = images;

const STEP_FACTS =[["guide-nine-engines", "guide-held-down"], ["model-values"], ["maxq-throttle-down", "guide-timeline"], ["guide-throttle", "model-values"]];
const TRACE_FACTS = [["guide-held-down"], ["model-values"], ["guide-separation"], ["wiki-recovery-burns", "guide-nitrogen-thrusters"], ["spacex-fairing", "guide-fairing-halves", "spacex-second-stage"], ["wiki-three-engine-burns"], ["wiki-centre-engine-burns", "wiki-single-engine-landing", "asds-barge"]];
const PHASE_WORDS = Object.values(Falcon.PHASE_WORDS).join("|");
const READOUT_FACTS = ["model-values", "guide-timeline", "wiki-recovery-burns", "wiki-three-engine-burns", "wiki-single-engine-landing", "film-time-factor"];

// Every working part of the rocket and its pad, with what in the film shows it working (probe: a snapshot
// key that changes when it works; shown: film seconds) or why it is left out.
const FUNCTIONS = [
  { id: "erector", part: "scene", does: "the transporter-erector tilts back from the stack", probe: "erector", shown: [0.8] },
  { id: "clamps", part: "scene", does: "the hold-down clamps let go at T-0", probe: "clampsOpen", shown: [2.4] },
  { id: "engines", part: "engines", does: "the nine engines start, throttle down through max Q and back", probe: "throttle", shown: [0.6, 15.5] },
  { id: "engine-count", part: "engines", does: "three engines for the boostback and entry burns, the centre one alone to land", probe: "engines", shown: [23.2, 26.6, 29.2] },
  { id: "separation", part: "upper", does: "the second stage is pushed off the booster", probe: "upperApart", shown: [19.4] },
  { id: "second-stage", part: "mvac", does: "the Merlin Vacuum engine lights and burns on", probe: "upperBurning", shown: [20.0] },
  { id: "thrusters", part: "interstage", does: "the nitrogen thrusters turn the booster round", probe: "thrusters", shown: [20.5] },
  { id: "grid-fins", part: "interstage", does: "the grid fins swing out to steer", probe: "fins", shown: [24.1] },
  { id: "fairing", part: "fairingLeft", does: "the fairing halves part and fall away", probe: "fairingOpen", shown: [25.2] },
  { id: "legs", part: "legs", does: "the legs swing down for touchdown", probe: "legs", shown: [31.2] },
  { id: "payload", part: "payload", does: "the payload is released from the second stage", outOfScope: "it is released in orbit long after the film's last second; the film follows the booster down" },
  { id: "access-arm", part: "scene", does: "the access tower's arm swings to the capsule", outOfScope: "it swings only to Dragon capsules; this flight carries a fairing, so the arm stays swung away" },
  { id: "gimbal", part: "engines", does: "the engines gimbal to steer", outOfScope: "a few degrees, too small to see at this scale; the pitch program stands for it" },
];

export default {
  functions: FUNCTIONS,
  slug: "falcon-9",
  pageTitle: fact("Falcon 9 Anatomy", "spacex-overview"),
  title: fact("SpaceX Falcon 9, one flight with a droneship landing", "spacex-overview", "wiki-recovery-burns"),
  fig: "Fig 1",
  hint: "Click: launch · Shift+E: apart",
  initialReadout: Falcon.readoutOf(Falcon.createFlight()),
  theme: "light",
  style: "dither",
  azimuth: 45,
  worldBounds: { box: { x: -7, y: -7, w: 14, d: 14 }, z0: -4, z1: 86 },
  page: { width: 580, height: 620, pad: 30, nudge: [0, 0], zoom: { x: 420, y: 330, width: 140, height: 140, corner: 6 }, margin: { x: 40, y: 40, lift: 0 }, cardWidth: 780 },
  modules: ["model.mjs", "layout.mjs"],
  figure: "figure.mjs",
  live: "live.js",
  pieces,
  leaveOrder: ["fairingLeft", "fairingRight", "payload", "upper", "mvac", "interstage", "lox", "engines"],
  legendKey: fact("Fairing, payload, second stage, Merlin Vacuum, interstage, LOX and RP-1 tanks, legs, nine engines", "spacex-first-stage", "spacex-second-stage", "spacex-interstage", "spacex-fairing", "guide-fins-legs"),
  steps: Falcon.STEPS.map((step, index) => fact(step.label, ...STEP_FACTS[index])),
  trace: Falcon.TRACE.map((word, index) => fact(word, ...TRACE_FACTS[index])),
  pathKey: [],
  caption: [
    fact("SpaceX's Falcon 9 is a reusable two-stage rocket, 70 m tall and 3.7 m across.", "spacex-overview", "spacex-dimensions"),
    fact("Nine Merlin engines, eight round a centre one, burn liquid oxygen and RP-1 kerosene from the first stage's tanks; a common dome separates the two tanks.", "spacex-first-stage", "guide-engine-layout", "guide-common-dome"),
    fact("The rocket is held down until its systems check out, climbs, eases its engines back round max Q, and cuts them off; pneumatic pushers then separate the stages and the second stage's single Merlin Vacuum engine lights a few seconds later.", "guide-held-down", "maxq-throttle-down", "guide-separation", "spacex-second-stage"),
    fact("The booster flips round on nitrogen thrusters, can burn back toward the launch site, slows with an entry burn, steers with four grid fins and lands on its four legs with a last burn, here on a droneship, a barge that holds its own position at sea.", "guide-nitrogen-thrusters", "wiki-recovery-burns", "spacex-grid-fins", "guide-fins-legs", "asds-barge"),
    fact("After separation the second stage burns on toward orbit with the payload, and the fairing halves come down under parachutes and are scooped out of the sea to fly again.", "spacex-second-stage", "wiki-fairing-recovery"),
    fact("Landing the first stage lets SpaceX fly the most expensive part of the rocket again; the first droneship landing was on the CRS-8 flight in April 2016.", "spacex-reuse", "wiki-crs8-landing"),
    fact("Ascent times follow a sample timeline in SpaceX's user's guide; heights, speeds, throttle and the recovery burns come from a small model with chosen values, not from a real mission.", "guide-timeline", "model-values"),
  ],
  simplifiedNotes: [fact("Tank and engine lengths are estimated between the sourced height and diameters.", "drawing-proportions")],
  readouts: [
    { pattern: `^T[+-]\\d+:\\d\\d( · time ×\\d+(\\.\\d)?)? · (${PHASE_WORDS}) · (engines off|1 engine at \\d+%|\\d engines at \\d+%) · (\\d+ m up|\\d+\\.\\d km up) · \\d+ m/s$`, facts: READOUT_FACTS },
  ],
  controlsLabel: "Flight controls",
  controls: [{ data: "launch", label: "Launch" }],
  uiTexts: ["Launch again", "Sound on", "Put together"],
  stageLabel: "Falcon 9. Enter, Space or a click launches the flight again; Shift and E take the rocket apart in the air and put it back together.",
  film: {
    variant: "in-motion",
    seconds: 35,
    // Causality (references/completeness-and-causality.md): the booster's turn, read in mission seconds.
    clock: "missionTime",
    timeShown: "time ×",
    bodies: [{ name: "booster", angle: "pitch", clock: "missionTime", maxRate: 15, cause: (state) => state.turnCause }],
    slow: { from: 9.2, to: 16.9, speed: 0.2, ease: 0.7 },
    apart: { open: 9.4, close: 14.3 },
    legend: "side",
    minimum: { subject: 0.25 },
    // Events that must happen on screen, with the assemblies that must be at least 60% inside the frame.
    onScreen: [["phase-liftoff", ["rp1", "lox"]], ["phase-separation", ["interstage", "upper"]], ["fairing-separation", ["fairingLeft", "fairingRight"]], ["phase-landed", ["rp1", "legs"]]],
    // Overlaps that are physically real, with the reason; every other collision fails the film.
    overlapAllowed: [["legs", "rp1", "the legs fold flat against the RP-1 tank"], ["engines", "rp1", "the engine section is bolted under the tank"], ["lox", "rp1", "the tanks meet at the common dome"], ["interstage", "lox", "the interstage sits on the LOX tank"], ["interstage", "mvac", "the MVac nozzle hangs inside the interstage"], ["upper", "mvac", "the engine is mounted on the stage"], ["upper", "interstage", "the stages are latched together"], ["upper", "fairingLeft", "the fairing sits on the stage"], ["upper", "fairingRight", "the fairing sits on the stage"], ["payload", "fairingLeft", "the payload is inside the fairing"], ["payload", "fairingRight", "the payload is inside the fairing"], ["fairingLeft", "fairingRight", "the halves meet at the seam"], ["payload", "upper", "the payload adapter sits on the stage"], ["legs", "engines", "the legs hinge at the engine section"]],
    steps: { from: 4.6, to: 18.6 },
    posterAt: 12.6,
    story(spec) {
      return [
        [0, "launch"],
        [spec.steps.from, "holdZoom", false],
        [spec.apart.open, "setApart", true],
        [spec.apart.close, "setApart", false],
      ];
    },
    stills: [["pad", 0.5], ["liftoff", 3.2], ["birth", 6.6], ["dissected", 13.2], ["separation", 19.6], ["flip", 21.6], ["fairing", 25.4], ["entry", 27.1], ["landing", 31.2], ["touchdown", 34.0], ["end", 34.8]],
    sync: [["stage separation tap", "phase-separation", 0], ["legs tap", "legs-deploy", 0], ["reassembly tap", "apart-seated", 0]],
  },
  sound: {
    seed: 2010,
    pan: 0,
    voices: {
      "phase-ignition": { tap: "reseat", level: -2 },
      "phase-liftoff": { tap: "switchOn", level: 0 },
      "phase-max-q": { tap: "tick", level: -9 },
      "phase-meco": { tap: "switchOff", level: -3 },
      "phase-separation": { tap: "part", level: 0 },
      "ses-1": { tap: "switchOn", level: -4 },
      "fairing-separation": { tap: "part", level: -5 },
      "phase-boostback": { tap: "switchOn", level: -5 },
      "phase-entry-burn": { tap: "switchOn", level: -5 },
      "phase-landing-burn": { tap: "switchOn", level: -4 },
      "legs-deploy": { tap: "tick", level: -4 },
      "fins-deploy": { tap: "tick", level: -8 },
      "phase-landed": { tap: "reseat", level: 0 },
      rumble: { swell: true, level: -26 },
    },
  },
};
