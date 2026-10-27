# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC. The briefs are copied as sent, with local paths replaced by relative paths or placeholders.

## Prompt 1 (translated from Vietnamese, 2026-10-17 01:01 UTC)

Look for 3D models on Sketchfab or other model platforms, pull them in, adjust them and use them as reference. Do not make them low poly. I need them realistic, for example plants, rocks, houses, furniture, exteriors. The materials must be realistic too, so look online for references.

## Prompt 2: topic file, the plan for this app (`design/TOPIC-er.md`)

~~~~text
Your folder: <your folder> (create it). Port 5430.
Look: toy isometric (references/looks.md).
Subject: a hospital emergency department operations app (patient flow and capacity, not clinical decisions). Sites are three hospitals in a made-up health network (a city level 1 trauma centre, a suburban community hospital, a children's hospital). The world: the ambulance bay with ambulances arriving, a helipad with a medical helicopter, the walk-in entrance and waiting room, triage desks, resuscitation and trauma bays, cubicles with beds, imaging (CT and X-ray), a lab, the nurses' station, porters wheeling beds, staff in scrubs, and the admission path to wards. Keep it calm and clinical: no blood, no injuries shown, patients are covered figures on beds with a colour triage tag. Data: patients (made-up ID only, triage level 1 to 5, stage, waiting time, assigned bed, pending tests), beds (state: free, occupied, cleaning), staff on shift, ambulances (ETA, priority), imaging queue. KPIs: door-to-doctor time, patients waiting, beds free, left without being seen. The bottom timeline follows one patient's visit (arrival, triage, seen, tests, decision, admitted or discharged). Use made-up hospital names and no real patient data.
Reference images: An approved (2026-10-17) fetching about 20 to 40 reference images for modelling from Wikimedia Commons (check each licence) and public domain US government sites, kept in blender/refs/, never shown in the app or film.
~~~~

## Prompt 3 (translated from Vietnamese, 2026-10-17 12:29 UTC)

Now try a rocket launch site, a container port, a fulfillment warehouse, an F1 pit lane, a hospital emergency room and a theme park. That is enough. Make about 3 posts today and the rest tomorrow. (Also in the message: "Jack the Ripper is a good idea too, just note it.")

## Prompt 4 (translated from Vietnamese, 2026-10-17 17:36 UTC)

OK, now you can continue with the ones we noted.

## Prompt 5: Pass 1: assets (brief to the delegated agent)

~~~~text
Build the 3D asset pack for a real-time operations app that looks like a strategy game. The subject, its world and
its data are in design/TOPIC-er.md; read it first. The topic names a look; read that look's section in
<skills folder>/build-game-ops-app/references/looks.md and look at its reference files before
modelling. Make your own designs; no real brands, logos, liveries or existing characters.

Model from real references, never from memory: follow
<skills folder>/build-game-ops-app/references/real-objects.md. For every main asset write its
reference sheet in blender/refs/ (real type, dimensions with sources, proportions, parts list, 3 to 6 reference
images with source and licence) before modelling it, block out at real size against the reference views, and check
the compare renders. Fetch reference images with one script (curl or Node) through the Wikimedia Commons API (search, then imageinfo with url and extmetadata for the licence; send a descriptive User-Agent) and public domain US government pages; keep it to the count the topic allows. No images of real patients or injuries.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Blender 5.2 is at
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (--background --factory-startup
--python) at below-normal priority, only when no other blender.exe is running (wait if one is; two other workers are building asset packs at the same time, so expect to wait and use the wait to write scripts and reference sheets). You may copy helper scripts (lib.py, preview.py, compare scripts, run.ps1, fetch_refs.mjs) from <game-fulfillment folder>/blender as a start.

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details (vents,
bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and hardened edges,
UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Several variants per
asset type so repetition does not show. Moving parts are separate named objects or bones with their pivot at the
origin (wheels, doors, rotors, bed backrests, character limbs); characters get an armature with
named clips (walk, push bed, idle, chart). Keep the total under about 40 MB, one GLB per asset family so repeats can be instanced.

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on) to
blender/previews/, plus a reference-versus-render compare sheet per main asset; look at every sheet and fix wrong
scale, wrong proportions, missing parts, bad normals, holes, floating parts. Write
blender/ASSETS.md listing every GLB, its nodes, pivots, clips, real-world scale and where it goes. Rules: no
top-level cd, no bare python (use uv run --no-project python), no trailing & or nohup, check nvidia-smi before GPU renders, never kill processes you did not start, no personal data. Write pass1_started_at.txt and
pass1_finished_at.txt (UTC). Budget about 90 tool calls. Report the asset list with sizes, what you looked at, gaps.
~~~~

## Prompt 6: Pass 2: app and film (brief to the delegated agent)

~~~~text
Build a real-time 3D operations app that looks like a strategy game, in the browser, on the subject in design/TOPIC-er.md
(read it first), using the GLB asset pack in <your folder>/app/public/assets (read blender\ASSETS.md). Render the
world, skin the UI and shape the film as the look named in the topic says (its section in
<skills folder>/build-game-ops-app/references/looks.md, and its reference files). In every look: a
world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout.

Work only in <your folder>/app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5430. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
it, and a small seeded simulation advances it in real time so things move, statuses change and numbers tick. Load the
GLBs with instancing for repeats, drive every moving part and clip from the simulation. Clicking an object selects it
and opens its card; clicking a list row flies the camera to it (and follows it if it moves); switching sites changes
the world. Soft shadows, ambient occlusion, gentle bloom on lights, smooth camera moves. 60 fps at 1920x1080 on an
RTX 3060 (other jobs share the GPU; check nvidia-smi before heavy steps). You may reuse infrastructure (store, camera rig, film and shoot tools) from <game-fulfillment folder>/app or game-port\app, which already solved the film traps below.

Topic beat for the film: the department as a cutaway (roof off) with patients flowing: an ambulance backs into the bay, paramedics roll a stretcher in, triage, a bed in a cubicle, a porter wheels a bed to CT. The followed unit in the 5-12 s beat is that ambulance arrival and stretcher into a resus or cubicle bay. Keep it calm and clinical as the topic says. The helicopter landing on the helipad is a good wide moment for the end.

House UI rules: no small uppercase eyebrow labels above headings, no coloured left-border callouts, no divider lines
between rows (spacing and subtle fills instead), every status starts with an icon whose shape differs per state, tabs
are quiet text buttons, a card closes by clicking empty ground or Esc (no X on side panels).

Verify with Playwright (<playwright install>, Chromium with --use-angle=d3d11
--enable-gpu --ignore-gpu-blocklist) at 1920x1080: the overview, a selected object with its card, a second site, a
close-up, plus close-ups of each main asset type. Look at every one and fix clipping, overlapping UI, unreadable
text, z-fighting, floating or sunken objects, broken picking, anything that looks like programmer art. Measure fps. Check the people clips actually play (Pass 1 only checked rest poses).

Film: 30 s 1920x1080 30 fps at shots/film.mp4 with a deterministic virtual clock (override requestAnimationFrame,
performance.now and Date.now in an init script, advance 1/30 s per captured frame; drive the app only through real
clicks, drags and wheel events with a visible cursor), encoded at below-normal priority, H.264 yuv420p crf 18
faststart, plus a copy under 25 MB. Shape: 0-5 s slow orbit over the whole site with things moving; 5-12 s click a
moving unit, its card opens and updates live while the camera follows; 12-18 s click a list row and the camera flies
there; 18-24 s switch to another site; 24-30 s pull back to a wide shot where the site still fills most of the frame.
mpdecimate must show no repeated frames; look at stills.
Film traps earlier builds had to fix: the opening so far out that units are specks (open close enough that moving units read); a beat that waits on the simulation and shows nothing (pre-roll the virtual clock so the followed event lands 2-3 s into its beat); a follow camera that ends inside a structure (keep a minimum distance and a height above the tallest model); selection rings far wider than the object (fit the footprint, at most about 1.3x); bare white or grey ground (give every surface a real material: asphalt, paint, verges, floors); a last shot where the site is small in empty ground.

Two other workers build similar apps at the same time (ports 5429 and 5431). Rules: no top-level cd, no bare python (uv run --no-project python), no trailing & or nohup (use background tool runs), never kill processes you did not start (no taskkill /IM), kill your own dev server and Chromium when done.

Write README.md, pass2_started_at.txt and pass2_finished_at.txt (UTC). Budget about 100 tool calls. Report: what was
built, how to run it, screenshot and film paths, checks with numbers, honest gaps, and a one-line caption suggestion
("Opus 5.5 built a live ... you can play like a strategy game, every ... modeled in Blender and running in three.js").
~~~~

## Prompt 7: Film polish (brief to the delegated agent)

~~~~text
Polish the film of the ER operations app in <your folder>/app (read README.md; dev server `npm run dev` on port 5430, film via `node tools/film.mjs` and the encode step the README names). Fix only these, change nothing else:
1. The canopy fade leaves a bright translucent ghost box (its lamps and glass keep glowing). When the canopy fades, fade or hide its lamps and emissive parts too, so at close range it disappears cleanly.
2. While the camera follows the cot after the ambulance hand-over (film 7-12 s), the selection ring and pin stay on the ambulance, so the frame shows a huge blue ring on empty ground. Move the selection (ring, pin, card) to the followed cot/patient when the follow switches, with a ring fitted to the cot (at most about 1.3x its footprint).
3. In the 12-18 s beat (Imaging tab, click a queued CT patient's row) the stills look like the same cubicle area as before. Make the flight land on the CT room with the scanner clearly in frame and the couch sliding into the bore within the beat (pre-roll or pick a row whose patient is on or about to go onto the CT couch, as tools/forecast.mjs does for the ambulance).
4. Re-record so the two UI fixes made after the last recording (patient rows say "on a cot", time values no longer wrap) are in the film.
Then re-encode shots/film.mp4 and shots/film-web.mp4 (under 25 MB) at below-normal priority, H.264 yuv420p crf 18 faststart, and check: mpdecimate drops 0 frames; render a 1 fps contact sheet with `uv run --no-project --with numpy python <skills folder>/watch-video/scripts/perceive.py shots/film-web.mp4 --out shots/watch --fps 1` and look at every frame of 5-18 s to confirm the three fixes show. Rules: no top-level cd (use a subshell), no bare python, no trailing & or nohup (use run_in_background), never kill processes you did not start (no taskkill /IM), stop your own dev server at the end. Budget about 45 tool calls. Report what changed, the check numbers and the contact sheet path.
~~~~

## Prompt 8 (translated from Vietnamese, 2026-10-17 14:38 UTC, feedback on the series look)

The point-cloud theme looks a bit boring. Make only the rocket one with it, and use the normal theme for the rest.
