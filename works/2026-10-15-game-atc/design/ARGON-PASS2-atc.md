Build a real-time 3D operations app that looks like a strategy game, in the browser, on the subject in design/TOPIC-atc.md
(read it first), using the GLB asset pack in <your folder>\app\public\assets (read blender\ASSETS.md). Learn the look
from the reference video the reference video (not included) and sheet.png: an
isometric world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout.

Work only in <your folder>\app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5424. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
it, and a small seeded simulation advances it in real time so things move, statuses change and numbers tick. Load the
GLBs with instancing for repeats, drive every moving part and clip from the simulation. Clicking an object selects it
and opens its card; clicking a list row flies the camera to it (and follows it if it moves); switching sites changes
the world. Soft shadows, ambient occlusion, gentle bloom on lights, smooth camera moves. 60 fps at 1920x1080 on an
RTX 3060 (other jobs share the GPU; check nvidia-smi before heavy steps).

House UI rules: no small uppercase eyebrow labels above headings, no coloured left-border callouts, no divider lines
between rows (spacing and subtle fills instead), every status starts with an icon whose shape differs per state, tabs
are quiet text buttons, a card closes by clicking empty ground or Esc (no X on side panels).

Verify with Playwright (playwright, Chromium with --use-angle=d3d11
--enable-gpu --ignore-gpu-blocklist) at 1920x1080: the overview, a selected object with its card, a second site, a
close-up, plus close-ups of each main asset type. Look at every one and fix clipping, overlapping UI, unreadable
text, z-fighting, floating or sunken objects, broken picking, anything that looks like programmer art. Measure fps.

Film: 30 s 1920x1080 30 fps at shots/film.mp4 with a deterministic virtual clock (override requestAnimationFrame,
performance.now and Date.now in an init script, advance 1/30 s per captured frame; drive the app only through real
clicks, drags and wheel events with a visible cursor), encoded at below-normal priority, H.264 yuv420p crf 18
faststart, plus a copy under 25 MB. Shape: 0-5 s slow orbit over the whole site with things moving; 5-12 s click a
moving unit, its card opens and updates live while the camera follows; 12-18 s click a list row and the camera flies
there; 18-24 s switch to another site; 24-30 s pull back to a wide shot where the site still fills most of the frame.
mpdecimate must show no repeated frames; look at stills.

Write README.md, pass2_started_at.txt and pass2_finished_at.txt (UTC). Budget about 100 tool calls. Report: what was
built, how to run it, screenshot and film paths, checks with numbers, honest gaps, and a one-line caption suggestion
("Gemini 4 Argon built a live ... you can play like a strategy game, every ... modeled in Blender and running in three.js").


Do not open, read or copy anything from <your folder> (another model's finished version of this app). The reference video folder and the topic file are yours to read.
