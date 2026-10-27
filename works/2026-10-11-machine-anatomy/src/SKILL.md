---
name: machine-anatomy
description: Build an interactive isometric "anatomy" of a real machine or invention (a lamp, a cipher machine, a steam engine, a transistor) from a pure tested model, with every caption fact tied to a source, a choice of colour theme and render style (line, dither, halftone, hatching, pixel), physically sensible motion, an exploded view, and a recorded 30 s film with soft sound in 16:9, 9:16 or square. Use for "anatomy of <machine>", "how does <machine> work, drawn", "isometric explainer", "exploded view video", "làm anatomy", "dựng máy <X>", or any request to dissect a real machine as an interactive figure or short film.
license: MIT
---

# Machine Anatomy

A shared kit: a new machine writes only its model, its layout and drawing, its live hooks and its facts.
The kit owns the page, the themes and styles, the zoom frame, the exploded view, the truth lint, the
recorder, the sound and the checks. The worked example is `examples/edison-light-bulb/`; copy its shape.

## 1. Ask once, then build

Before any code, ask the user the intake questions in **one round** with the host's question tool
(AskUserQuestion in Claude Code), each with its recommended default, skipping anything they already said.
Then proceed without further gates. Questions, defaults and how each answer maps to config:
`references/intake.md`.

## 2. Research, then facts

Read real sources (patent, maker's papers, museum page, encyclopedia). Write `reference/notes.md` with
URLs and quotes, then `facts.json`: one entry per fact with `text`, `source`, `quote` or `note`, and
`status` (`verified` or `inferred`). Rules and what lint enforces: `references/truth-control.md`.
List every function of the machine and its setting from the sources into `functions`.

Then collect at least 3 real photos or drawings of the machine and its setting into `reference/images/`
with `sources.json`, and open each before drawing; every assembly names the images it was drawn from.
Lint enforces it and `record` writes `shots/reference-compare.png` to check against: `references/reference-images.md`.

## 3. Build the machine folder

`node cli.mjs new <folder> --title "..."` scaffolds from the Edison example. Replace in this order:

1. `model.mjs` — pure model, no DOM; all behaviour and every number shown. `test-model.mjs` tests it
   against real values or invariants. Tests are mandatory.
2. `layout.mjs` — sizes in world units and computed curves (paths follow real parts, never chords).
3. `figure.mjs` — `drawFigure(draw)`: draw the real parts as items of numbered assemblies with the kit's
   helpers; return label, defs, css, badge anchors, step points and the zoom target.
4. `live.js` — `createMachineHooks(kit)`: state, drawing of moving parts, controls, readout, actions.
   Use `kit.Motion` for springs, inertia and joints: `references/motion.md`.
5. `machine.mjs` — assemblies with removal axes and provenance, every visible text as
   `{ text, facts }`, readout templates, controls, film story, sound voices.

Read the matching files of the example before writing each one; do not read built `*.html` files.

## 4. Look

Theme and render style are independent layers: `references/themes-and-styles.md`. Set the defaults in
`machine.mjs` (`theme`, `style`); any page switches with `?theme=` and `?style=`.

## 5. Film and sound

The default film is the approved 30 s shape (working first, one zoom birth, one slow labelled run, normal
running with a contrast moment, staggered take-apart, back together, end working): `references/film.md`.
Sound is quiet close-mic taps, no beeps, no limiter: `references/sound.md`. Caption rules for posting the
film: `references/caption.md`.

## 6. Commands and checks (all required before handing off)

```
node cli.mjs lint   <folder>     # texts tied to facts, sources, superlatives, provenance
node cli.mjs test   <folder>     # model tests
node cli.mjs build  <folder> [--format 16:9,9:16,square]
node cli.mjs audit  <folder>     # exploded-view paint order and pass-through
node cli.mjs verify <folder>     # real page in headless Chrome, every theme and style
node scripts/lines.mjs <folder>/<slug>-anatomy.html   # texture lines end on something
node cli.mjs record <folder> [--format 9:16] [--style dither] [--no-sound]
node cli.mjs remux  <folder>     # sound-only change on the recorded frames
npm test                         # kit unit tests
```

Playwright is not bundled: `npm install --no-save playwright`, or set `MACHINE_ANATOMY_PLAYWRIGHT` to an
existing Playwright `index.mjs`. Recording runs below normal priority and without the GPU.

Then open `shots/<variant>/video-sheet.png`, three stills, the verify screenshots and
`shots/reference-compare.png` yourself; fix clipping, overlaps, illegible text, swimming patterns and
every difference from the reference images that is not a declared simplification.

## Rules the owner set (enforced where a check exists)

- Nothing covers anything: one collision check in record and verify (`references/film.md`); declare
  only physically real overlap, with its reason, in `film.overlapAllowed`.
- Show the machine in its full real setting (intake question 10), sourced, with provenance.
- The subject fills at least 25% of the frame height in every phase and key events happen on screen
  (`minimum.subject`, `film.onScreen`); a moving machine runs a camera with `hooks.camera()`.
- Patterns stay locked to surfaces and do not swim; measure with `scripts/swim.mjs`
  (`references/themes-and-styles.md`).
- Fire, steam, smoke and glow come from `kit/effects.mjs`, driven by the model (`references/motion.md`).
- Every working part is shown working or has a stated reason; no motion without a drawn, active cause;
  compressed time is shown on screen (`references/completeness-and-causality.md`, lint and record).

## Report

Paths of the page, publish fragment and films; lint, test, audit, verify and lines counts; loudness, true
peak and spectrum of the film (say nobody listened); the film timeline; each caption fact with its source;
what is simplified, inferred or unverified.

Credit: built on Anatomy by Ryan (github.com/wheresryan22/anatomy, MIT). See `THIRD_PARTY_NOTICES.md`.
