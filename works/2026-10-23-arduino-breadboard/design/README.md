# Hookup: learn Arduino one circuit at a time
Six lessons (Blink, Button, Fade, Potentiometer, Servo, Traffic light), each 4 steps that build the circuit part by part on a real-size Uno R3 and half-size breadboard.
Run: `npm install` then `npm run dev`, open http://127.0.0.1:5244/
Files: `src/layout.js` (real-size coordinates), `src/parts.jsx` (3D parts), `src/lessons.js` (copy, cameras, code, simulation), `src/Stage.jsx`, `src/App.jsx`, `src/Instrument.jsx`.
Checks: `node tools/shoot.mjs shots/dev 0:0 ...` screenshots; `node tools/film.mjs` records shots/film.mp4 on a virtual clock with real mouse input.

## Second round (An's review)

- Wires and parts start on a bench tray left of the board and are carried in an arc and pressed into the exact holes (the cable is re-solved from both ends every frame). Earlier wires stay.
- "Show current" (off by default) in the lesson card: red dots on the 5 V side, blue on the GND side, speed follows the mA, a glow on the LED and an mA label per branch.
- Lesson 7, "Build your own": tray drag to snapped holes, wires drawn hole/pin to hole/pin, click a part for Rotate/Delete, five sketches with an editable pin, Run/Stop, a circuit check (no resistor, reversed, no path), saved in localStorage ("hookup-sandbox-v1"). One button, one pot and one servo at most.
- Tools: tools/sandbox-test.mjs (real-mouse sandbox run), tools/film.mjs (new 30 s film).
