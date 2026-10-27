# Completeness and causality (required, checked)

Two owner rules (Falcon 9, 2026-10-12): "if the main subject has something that can operate and we never
touch it, that is a big omission", and "no turning fast with nothing acting to turn it".

## Completeness: every working part is shown working

During research, list every function of the machine **and its setting** from the sources (each engine
mode, every hinge, door, arm, clamp, valve, switch, thruster, the payload). Put the list in `machine.mjs`:

```js
functions: [
  { id: "legs", part: "legs", does: "the legs swing down for touchdown", probe: "legs", shown: [31.2] },
  { id: "access-arm", part: "scene", does: "the arm swings to the capsule", outOfScope: "Dragon flights only" },
]
```

- `part` is an assembly; `probe` is a key of `hooks.snapshot()` that changes when the part works;
  `shown` lists film seconds; `outOfScope` says honestly why a function is not shown.
- Lint fails on no list, an unknown part, a function with neither `probe` + `shown` nor `outOfScope`, or
  a time outside the film. The recorder fails a function whose probe does not change within 1.5 s of
  each shown time.
- A part that works but would read as broken when idle (eight engines dark while one lands) gets a
  plain-words line in the trace or readout that says why.

## Causality: no motion without a cause

- Every change of motion comes from a modelled cause that is drawn and active at that moment: engine
  thrust, a thruster (drawn firing), a grid fin in air, a spring, gravity, drag, a lever, a motor, a hand.
- Drive attitudes and joints through `kit/motion.mjs`: springs for settling and `stepRateLimited(spring,
  seconds, maxRate)` for an actuator that can only turn so fast (thrusters, fins, motors). Pick `maxRate`
  per actuator from sources or mark it chosen in `model-values`.
- Declare the bodies whose motion the film shows in `film.bodies`: `{ name, angle, clock, maxRate, cause }`,
  where `angle` and `clock` are snapshot keys (radians, the machine's own seconds), `maxRate` the real
  body's sanity bound in degrees per second, and `cause(state)` the cause acting now or `"none"`. Report
  `"none"` when the drawn cause is not visible (thruster puffs off).
- The recorder fails a turn faster than `maxRate` and any angular acceleration above 0.03 rad/s² while the
  cause is `"none"`.
- Time compression is allowed only when shown: set `film.clock` (snapshot key) and `film.timeShown` (a
  pattern the readout carries, e.g. `"time ×"`); the recorder fails any stretch where the machine clock
  runs more than 20% faster or slower than the film without it (frames where the kit shows its own
  take-apart status instead of the readout are skipped). Ease between rates; give slow turns and
  landings screen time, and make the film longer (`film.seconds`) before running them through.
