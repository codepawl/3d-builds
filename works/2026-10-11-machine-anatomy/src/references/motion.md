# Motion

`kit/motion.mjs` is a small library, not a physics engine. The model and the page use the same functions
(`import ... from "../../kit/motion.mjs"` in a model; `kit.Motion` in `live.js`). All of it is unit-tested
in `test/motion.test.mjs`.

## Which motion for which part

| Part | Use | Why |
|---|---|---|
| Key, lever, latch, trigger, any return | `createSpring` with `springFor(settleSeconds, 1)` | critically damped: eases into its stop and never passes it |
| Something that should bounce a little (a needle, a dropped part) | `springFor(settle, 0.6 to 0.85)` | `overshootBound(spring)` gives the worst overshoot |
| Flywheel, rotor, armature, fan | `createInertia({ spinUpSeconds, coastSeconds })`, `stepInertia(inertia, drivenSpeed, dt)` | spin-up, steady run and coast-down as first-order lags; exact for any frame rate |
| Hinge, rotor, pointer | `revolute(pivot, axis, angle, point)` | turn points of the drawing about a real axis |
| Slide, plunger, carriage | `prismatic(origin, axis, travel)` | |
| Gear train | `gearMesh({ driverTeeth, drivenTeeth, driverAngle, phase: meshPhase(drivenTeeth) })` | opposite turn at the tooth ratio, a tooth always in a gap |
| Piston and crank | `crankSlider({ centre, crankRadius, rodLength, crankAngle })` | closed rod, stroke twice the crank |
| Linkage, walking beam, Watt's parallel motion | `fourBar({ ground, crank, coupler, rocker, crankAngle, branch })` | every link length kept; `null` where it cannot assemble |

Rules:

- **Never instant on/off** for anything with mass: a rotor spins up and coasts, a key eases into its stop.
  Contacts close at a share of travel (the Edison key closes at 97%), so the sound lands on the frame
  where the picture shows contact.
- **Solve joints from the model**: the model holds angles and travels; the drawing calls the joint to
  place points. Never animate a drawn point on its own path.
- **Frame-rate independence**: springs step in pieces of at most 1/240 s; inertia is exact. The film
  and the page give the same motion.

## Exploded view

`kit/explode.mjs` moves each assembly along its **real removal axis**: in `machine.mjs` each piece has
`axis` and `distance` (or `move` when the part must swing clear of what it covered). A piece with `ride`
is carried by another (a key that rides on its socket). Pieces not in `leaveOrder` stay put. Springs are
staggered by `spring.stagger` (0.22 s); outside parts leave first and come back last.

The audit (`node cli.mjs audit <folder>`) replays opening, closing and reversals at every stagger
boundary and fails on: order cycles at rest or in flight, pairs drawn the wrong way round at rest, solid
blocks passing through each other in flight, and blocks sunk into each other when apart. Mark thick solids
as blocks (`slab`, `upright`, or `put(..., true)`); declare a wire that must cross a path with `crosses`.

## Effects: fire, exhaust, steam, smoke, glow

Use `kit/effects.mjs` (`kit.Effects` in live.js), never a hand-drawn flat flame. `plume({ throttle, thin,
exitRadius, length, spread, ground, time, seed })` gives a warm body, a near-white core at the exit, shock
diamonds while the air is thick, a splash where it meets a surface, and noise flicker that is a function
of time, so every recording is identical; it grows with throttle and widens and turns translucent as
`thin` rises. `puffs({ age, ... })` gives a billowing steam or smoke cloud, `glow({ power, distance })`
the light a source throws on a surface (a pad, a deck). Drive every parameter from the model; draw with
the `ma-fx-*` classes; mark the effect simplified in provenance.
