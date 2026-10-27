# Anatomy series: film and inset rules, version 2 (owner's feedback, 2026-10-12)

These rules replace the earlier film structure for every piece in `demos/*-anatomy/`.

## One zoom frame, and it is born from the model
- The figure has at most ONE magnified inset (the "zoom frame"). Remove any permanent source rectangle drawn on the model.
- The film opens on the full, complete, assembled model, centred, with NO inset and no source rectangle. Hold about 1.5 s so the viewer sees the whole machine.
- When the zoom is needed: a thin source rectangle appears on the model around the part being magnified; the zoom frame then grows out of that rectangle to its final place and size (ease out, about 0.7 s); four dashed lines join the four corners of the source rectangle to the four corners of the zoom frame while it grows and for about 1 s after; then the source rectangle and the four dashed lines fade out slowly (about 1.2 s) so only the zoom frame is left.
- The same birth animation is used in the page when the inset first appears; with reduced motion it just appears.
- The model shifts or scales as little as possible to make room; nothing is clipped and the zoom frame never covers the part of the model that is acting.

## Order of the 30 seconds
1. Full model, no zoom (about 1.5 s).
2. One slow run with the short numbered step labels, the zoom frame being born when the signal reaches the part it shows.
3. Several runs at normal speed (at least three clear cycles/letters/strokes) so the principle is understood. This is the longest section.
4. Only then the take-apart: the zoom frame fades away first, then the assemblies leave gradually one by one (staggered as now), hold with the numbered legend, and go back together.
5. End on the assembled machine running again for a moment.
- Still 30.0 s, 1920x1080, 30 fps, fills the 16:9 frame, light theme, no title bar.

## Sound
- Unchanged recipe (see `demos/enigma-anatomy/sound.mjs`): soft damped taps, 3-6 ms fade-in, no tones, no limiter, no saturation, no continuous bed, high-pass 110 Hz, gentle low-pass 3.5 kHz, about -28 LUFS integrated, true peak at or under -3 dBFS, small per-hit variation.

## Amendment 2026-10-12 (owner: "khúc đầu t muốn nó hoạt động luôn, chưa zoom vội, tầm 5s rồi mới zoom")
This replaces steps 1 and 2 of "Order of the 30 seconds":
1. 0 to about 5 s: the full assembled machine is already WORKING at normal speed from the first frame (typing, sending, running, switching on), centred, with no zoom frame, no source rectangle and no step labels. The current path, trace strip and readout are live as usual.
2. At about 5 s the zoom frame is born as described above, and the one slow run with the numbered step labels starts with it.
3. Then normal speed again, take-apart, back together, end running: unchanged, shortened as needed so the film is still exactly 30.0 s. Keep at least 6 s of normal running after the slow run and keep the apart hold readable (at least 1.5 s).
The owner approved everything else in the films; change nothing else.
