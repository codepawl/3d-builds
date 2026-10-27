# Sound

The approved recipe, after two rejected mixes (bright beeps "like a toy"; bassy hits into a limiter over a
constant bed, "too loud"). Approved: quiet close-mic taps, ASMR-like. `kit/sound.mjs` renders it offline
from the film's event log; the page plays the same voices through Web Audio with the Sound button off by
default.

- Every sound is one short **tap**: noise through two damped resonances, gone within about 70 ms, with a
  3 to 6 ms raised-cosine fade-in. No tones, no beeps, no layered clicks.
- **No limiter, no saturation**: mix in float, apply one linear gain, found by measuring.
- High-pass about 110 Hz and a gentle low-pass about 3.5 kHz, one-pole stages.
- Tail: sparse decorrelated copies over about 120 ms at -18 dB. Never a few fixed reflections.
- Per hit: about 7% pitch, 2 dB level and a few ms timing variation.
- Level: about -28 LUFS integrated, true peak at or under -3 dBFS. A sparse track may land near -30.
- **Hierarchy**: the sound that carries the machine's rhythm is the reference (0 dB: a key, a valve tick,
  the click-clack of an armature); secondary taps -4 to -6 dB; parts leaving and landing -6 to -11 dB (the
  kit's `piece-leave`, `piece-land`, `apart-seated`); anything sustained (a chuff, a heating swell) at least
  20 dB under the taps and never longer than about 1.2 s.
- A machine with a famous sound gets it: a Morse key's click then clack per mark.

## Configuring a machine

```js
sound: {
  seed: 1879,          // the random variation is repeatable
  pan: 0.3,            // where the machine sits, -1 left to 1 right
  voices: {
    "switch-on": { tap: "switchOn", level: 0 },
    "switch-off": { tap: "switchOff", level: -5 },
    heat: { swell: true, level: -20 },
    "burn-out": { tap: "tick", level: -9 },
  },
  bodies: { /* extra tap bodies: { modes: [[Hz, ring seconds, share], ...], attack, blow } */ },
}
```

Event names are whatever `live.js` emits with `kit.emit(name, detail)`. `sound: false` makes a silent film.

## After recording

The recorder prints integrated loudness, true peak, samples at full scale, energy below 120 Hz, 120 Hz to
3.5 kHz and above 3.5 kHz, and sync against picture events. Report those numbers and say plainly that
nobody listened. `node cli.mjs remux <folder> [--format ...] [--style ...]` renders the track again onto the
recorded frames for any sound-only change.
