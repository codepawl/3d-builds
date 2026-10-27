# Prompts

The messages from An are translated from Vietnamese, with chat filler removed. Times are UTC on 2026-10-14. The briefs are copied as sent, with local paths replaced by relative paths. The brief file (Prompt 3) was written for a fox on a skateboard. A minute after the agent started, An changed the subject to a pelican on a bike, and that change reached the agent as a follow-up message (Prompt 4). The posted film used the pelican.

## Prompt 1 (translated from Vietnamese, 19:37 UTC)

A reference video was attached (a downloaded copy of an X video by another creator that draws a pelican riding a bike with Fourier epicycles), with a link to its post.

Copy this one, but with a different piece of math.

## Prompt 2: the task message to the delegated agent (19:38 UTC)

~~~~text
Use the `animate-code-illustration` and `simplify-code` skills. Read and follow, completely and exactly, design/BRIEF.md. Do not put personal data in files or HTTP headers.
~~~~

## Prompt 3: the brief file, the fox version

Make a 60 second 1920x1080 film in the spirit of the reference, with different mathematics. The reference (watch it first; ffmpeg is on PATH): reference/video.mp4 and sheet.png, frame50.png in that folder. It draws "a pelican riding a bike" with Fourier epicycles: the number of circles N rises (3, 10, 36, 1024), the error falls (26% to 0.33%), the drawing sharpens, then it animates and turns in 3D; dark navy background, glowing cyan line, gold accents, a large math readout (N, error) and the formulas in small type at the bottom, with music. Learn the pacing and the look; do not copy its subject, wording or exact layout.

Your mathematics: TSP art, the whole picture drawn as ONE continuous line that never crosses itself.
- Subject: an original line drawing you design yourself: a fox riding a skateboard, side view, with real detail (fur tufts, eye, tail, wheels, trucks). No existing character.
- Pipeline, all computed by your code, nothing faked: render the subject to a density field; weighted stippling with Lloyd relaxation (weighted Voronoi / centroidal) to place N points; build a tour through all points (nearest neighbour or greedy), then optimise with 2-opt (and Or-opt if useful) until no two segments cross; measure tour length and the number of crossings at each stage. Verify the final tour has 0 self-intersections with a real segment-intersection test.
- Story beats (about 60 s): N = 64, 256, 1024, 4096, 16384 points, each stage first showing the stippled dots, then the raw tour with its crossings (crossings highlighted in gold), then 2-opt untangling them live (the readout counts crossings down to 0 and tour length down), and the picture sharpening as N grows. Then a bright pen point travels the final single line and redraws the whole fox in one stroke. Finish with the fox animated: the line itself morphs so the fox pushes off and the board rolls (compute the tour once and deform the points with the pose so it stays one uncrossed line, or recompute per keyframe and morph; your choice, but it must stay one line), with a slow 3D tilt like the reference.
- Readout in the same spirit: big "N = 4096 · crossings = 0 · length = 38.2 k px", a small line under it, and small formulas at the bottom (Lloyd centroid update, the 2-opt swap condition). Use correct mathematics and correct numbers from your own run.
- Look: dark navy background with faint stars, glowing cyan line with bloom, gold for highlights, serif math type. 1920x1080, 30 fps, 60 s.
- Music: compose a short score in code (Web Audio offline render or a small synth in Node) that follows the beats: soft pulses as points appear, a rising figure while 2-opt untangles, a resolve when crossings hit 0. Soft, not shrill, about -16 LUFS, no clipping. Mux it into the film.

Work only inside tsp-fox (create it). Render frames deterministically (canvas in headless Chromium via Playwright at playwright or node-canvas), encode with ffmpeg at below-normal priority: H.264 yuv420p crf 18 faststart, AAC audio. Also a web copy under 25 MB. Check: mpdecimate (no frozen stretches except intended holds), look at stills at every stage and at the end, measure loudness and true peak. Never a top-level cd; never a bare python (use `uv run --no-project python <file>`); check nvidia-smi before GPU-heavy steps. Write started_at.txt and finished_at.txt (UTC). Budget about 100 tool calls.

Report: film paths, the real numbers per stage (N, tour length before and after 2-opt, crossings before and after, iterations), loudness and peak, what you looked at, honest gaps (say plainly nobody listened to the audio), and a two-line caption suggestion ("Opus 5.5 ..." then one everyday sentence).



## Prompt 4 (translated from Vietnamese, 19:39 UTC, then sent to the agent in English at 19:40 UTC)

An wrote: "Do not use a theme similar to the pelican riding a bike. Do not make a new animal. I only asked you to change the math so it looks good when presented."

The follow-up message that went to the running agent (copied as sent):

~~~~text
Change of subject from the owner: keep the same theme as the reference, a pelican riding a bicycle (side view, with real detail: long beak and throat pouch, eye, wing feathers, webbed feet on the pedals, both wheels with spokes, frame, chain, handlebars, saddle). Do not make a fox or any new animal. Draw your own pelican-on-a-bike line art from scratch; do not trace or copy frames of the reference video. Everything else in the brief stays the same (TSP art, one uncrossed line, stippling with Lloyd relaxation, 2-opt, the beats, look, music). For the final animation: the pelican pedals and the wheels turn, still one uncrossed line. Rename the folder target to demos/tsp-pelican (move what you already made there). Caption suggestion should be about the pelican on a bike.
~~~~

## Prompt 5 (translated from Vietnamese, 20:15 UTC, then sent to the agent in English)

An wrote: "Also, their pelican can be done in 3D and animation too. Watch the video and you can see what is in it."

The follow-up message to the agent:

~~~~text
Owner note: the reference's pelican is not only animated, it is truly 3D: in its last part the whole drawing turns around a vertical axis (readouts ψ and θ angles, a ground ellipse with a moving marker, the pelican seen from changing angles while it pedals). Match that level: after the one-stroke redraw, give the single uncrossed line real depth (lift the 2D tour into 3D: assign each point a z from a simple 3D model of the pelican and bike, e.g. body and wings as volumes, wheels and frame on two planes, legs between), then pedal (legs on the cranks, wheels and spokes turning) while the camera orbits at least half way round with a slow pitch change, with readouts for the view angle and a ground ellipse like the reference. A projected 3D tour can cross itself on screen; that is fine for this part, but keep it one continuous line in 3D and say so in the readout (e.g. "one stroke in 3D"). Keep everything you already made. Report when done.
~~~~

## Prompt 6 (translated from Vietnamese, 20:27 UTC, then sent to the agent in English)

An wrote: "I mean it draws the line live, then speeds up, and zooms in on the line to draw the detail. Right now it looks too boring."

The follow-up message to the agent:

~~~~text
Owner feedback on tsp-pelican: "it looks boring". They want the line DRAWN LIVE as the centrepiece, with camera work. Re-cut the film (keep all your maths, data, pelican art, look and the 3D ending; keep the old file as tsp-pelican-v2.mp4):
1. Shorten the stage-by-stage part to about 15 s total: quick beats for N = 64, 256, 1024, 4096 (dots → tangle with gold crossings → 2-opt snaps them to 0), fast and punchy, no long holds.
2. Then the main event, about 30 s: the final 16,384-point single line is drawn live by a glowing pen from the start of the tour. Start slow in a tight close-up that follows the pen tip so viewers see the maze-like line being laid down in detail (camera zoomed 6-10x, smooth follow with easing, slight lead ahead of the pen), then speed up as a time-lapse (show a speed readout like "×1 → ×8 → ×64", with the "edge 7,642 of 16,384" counter running), pulling the camera back in smooth steps, punching in again for one or two more detail moments on interesting parts (the beak and pouch, a wheel with spokes, the feet on the pedals), and ending on the full pelican as the pen closes the loop. Use motion blur or a trail on the pen at high speed, and keep the already-drawn line glowing.
3. Then the 3D lift and pedalling orbit (about 12 s) as you have it, and a short end hold.
Keep 60 s total, 1920x1080, 30 fps, re-time the music to the new beats (a build as the speed-up rises, a resolve when the loop closes), about -16 LUFS. Re-render, make the web copy under 25 MB, check mpdecimate (only intended holds), and look at stills especially of the close-ups (line must stay crisp when zoomed: draw it as vectors at the zoomed scale, not an upscaled bitmap). Report the new timeline and paths.
~~~~

## Prompt 7 (translated from Vietnamese, 21:05 UTC, then sent to the agent in English)

An wrote: "The 3D one only has half a body, and it zooms too much. Draw faster, under 45 s. The start should not show the pelican. It should show its unfinished form, not the finished one."

The follow-up message to the agent:

~~~~text
Owner feedback on the re-cut (keep it as tsp-pelican-v3.mp4 and make a new main file):
1. Total under 45 s (aim 40-44 s).
2. Do not show the finished pelican at the start. Remove the opening ink-density fade-in and anything that reveals the final drawing early (also the faint dot field of the final 16,384 points shown before the pen draws it). The film must start from the unfinished form: N = 64 dots and their crude tour that barely reads as a pelican, then it gets more recognisable stage by stage. During the live pen, show only what has been drawn so far (no preview of the remaining dots, or at most a very faint hint near the pen).
3. Zoom less: keep the live pen mostly at 1-2.5x, with at most one short close-up (3x max) instead of three 5-8x close-ups; the full figure should be readable most of the time.
4. Draw faster: the live pen should take about 15 s (ramp ×4 → ×64 → ×256 or similar), not 30 s.
5. The 3D part shows only half a body: make the 3D pelican and bike read as a whole volume from every angle of the orbit (both sides of the body, both wings, both legs, both pedals and cranks, wheels and frame with proper width). If the single line only covers the near side, mirror or extend the depth model so the far side is drawn too (still one continuous line in 3D, re-threaded as you do now), or tilt and light it so the orbit never shows a cut-off half. Check stills at θ = 0, 45, 90, 135, 180.
Suggested timing: stages 0-12 s, live pen 12-27 s, loop close 27-28 s, 3D orbit 28-42 s, end hold to ~43 s. Re-time the music, re-render, web copy under 25 MB, mpdecimate, stills, report.
~~~~

## Prompt 8 (translated from Vietnamese, 21:21 to 21:22 UTC, the post text)

- "Check how the caption of that post looks, set it again, and quote that post when you post it."
- "I mean make the math stand out."
- "What is the music made with, and what is the video made with?"

## Prompt 9: the last change sent to the agent in English (21:25 UTC)

~~~~text
Owner change for tsp-pelican (keep the current file as tsp-pelican-v4.mp4): no camera zoom on the whole frame anymore. The main view always stays the full scene at 1.0x as the base. Any close-up is shown in a magnifier inset instead, like the reference's small framed box: a rounded frame (about 480x300 px) in a corner that doesn't cover the drawing, a thin rectangle on the main view marking the area being magnified, and a fine leader line joining them; inside the inset, the same vector line redrawn at 3-8x so it stays crisp, following the pen while it draws there. Use the inset during the live pen (opening on the eye at the start, the bill and pouch near the end, and one in between), fade it in and out smoothly, and hide it during the stage beats and the 3D orbit unless it helps. Keep everything else (43 s, timing, music, 3D). Re-render, web copy under 25 MB, mpdecimate, look at stills of each inset, report.
~~~~
