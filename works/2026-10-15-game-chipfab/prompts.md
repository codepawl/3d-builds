# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC. The briefs are copied as sent, with local paths removed.

## Prompt 1 (translated from Vietnamese, 2026-10-15 14:37 UTC)

Draft a post like this one (the airport post, https://x.com/anxuanng/status/2110460775722852744), but about an air traffic control app, visualized as 3D in the same way. Can you do it? Only tell me whether you already have a skill for this.

## Prompt 2 (translated from Vietnamese, 2026-10-15 14:45 UTC)

OK. Create it so it is reusable, then come up with a few more ideas.

## Prompt 3 (translated from Vietnamese, 2026-10-15 14:48 UTC)

OK, go ahead in parallel.

## Prompt 4 (translated from Vietnamese, 2026-10-15 18:33 UTC)

OK, post it. After that, try Argon.

## Prompt 5: topic file (`design/TOPIC-chipfab.md`)

~~~~text
Your folder: <your folder> (create it). Port 5425.
Subject: a semiconductor fab operations app, shown as a 3D strategy-game world. Sites are fab buildings on a made-up campus (a 300 mm logic fab, a second fab under ramp-up, an advanced packaging plant). The world: the cleanroom bays seen from above at a tilt with the roof cut away, rows of tools in their real order (lithography scanners in yellow-lit bays, etch and deposition clusters, ion implanters, furnaces, CMP polishers, metrology and inspection tools, wet benches), the overhead hoist transport (OHT) rail network with small vehicles carrying wafer pods (FOUPs) between tool load ports, stockers that buffer pods, engineers in bunny suits walking the bays, the sub-fab utility floor below (pumps, chillers, gas cabinets) and the support buildings outside (ultra-pure water plant, gas yard, cooling towers, power substation). Data: wafer lots (lot ID, product, step number of a few hundred, current tool, queue time, priority, hot lots), tools (state: running, idle, down, maintenance; utilisation; wafers per hour; alarms), OHT vehicles (carrying, destination), maintenance tickets, yield from inline metrology. KPIs: wafer starts per day, line yield, cycle time in days, tool availability. The bottom timeline follows one hot lot through its route (litho, etch, deposition, implant, anneal, CMP, metrology) with its current step. Use made-up company, product and tool names; no real chipmaker, tool vendor or logo. Keep it educational: how a fab moves wafers through hundreds of steps, nothing proprietary.
~~~~

## Prompt 6: pass 1, asset pack (`design/PASS1-chipfab.md`)

~~~~text
Build the 3D asset pack for a real-time operations app that looks like a strategy game. The subject, its world and
its data are in design/TOPIC-chipfab.md; read it first. The look comes from the reference video
the reference video (not included) (frame sheet its frame sheet): a clean
isometric world in a light, cool palette with one strong brand colour, small vehicles and units, chunky readable
shapes. Make your own designs; no real brands, logos, liveries or existing characters.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Blender 5.2 is at
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (--background --factory-startup
--python) at below-normal priority, only when no other blender.exe is running (wait if one is).

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details (vents,
bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and hardened edges,
UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Several variants per
asset type so repetition does not show. Moving parts are separate named objects or bones with their pivot at the
origin (wheels, doors, fans, lifts, booms, bridges, character limbs); characters and animals get an armature with
named clips. Keep the total under about 40 MB, one GLB per asset family so repeats can be instanced.

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on) to
blender/previews/; look at every sheet and fix wrong scale, bad normals, holes, floating parts. Write
blender/ASSETS.md listing every GLB, its nodes, pivots, clips, real-world scale and where it goes. Rules: no
top-level cd, no bare python, check nvidia-smi before GPU renders, no personal data. Write pass1_started_at.txt and
pass1_finished_at.txt (UTC). Budget about 80 tool calls. Report the asset list with sizes, what you looked at, gaps.
~~~~

## Prompt 7: pass 2, app and film (`design/PASS2-chipfab.md`)

~~~~text
Build a real-time 3D operations app that looks like a strategy game, in the browser, on the subject in design/TOPIC-chipfab.md
(read it first), using the GLB asset pack in <your folder>\app\public\assets (read blender\ASSETS.md). Learn the look
from the reference video the reference video (not included) and sheet.png: an
isometric world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout.

Work only in <your folder>\app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5425. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
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
("Opus 5.5 built a live ... you can play like a strategy game, every ... modeled in Blender and running in three.js").
~~~~

## Prompt 8: battle version of pass 1 given to Argon (`design/ARGON-PASS1-chipfab.md`)

~~~~text
Build the 3D asset pack for a real-time operations app that looks like a strategy game. The subject, its world and
its data are in design/TOPIC-chipfab.md; read it first. The look comes from the reference video
the reference video (not included) (frame sheet its frame sheet): a clean
isometric world in a light, cool palette with one strong brand colour, small vehicles and units, chunky readable
shapes. Make your own designs; no real brands, logos, liveries or existing characters.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Blender 5.2 is at
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (--background --factory-startup
--python) at below-normal priority, only when no other blender.exe is running (wait if one is).

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details (vents,
bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and hardened edges,
UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Several variants per
asset type so repetition does not show. Moving parts are separate named objects or bones with their pivot at the
origin (wheels, doors, fans, lifts, booms, bridges, character limbs); characters and animals get an armature with
named clips. Keep the total under about 40 MB, one GLB per asset family so repeats can be instanced.

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on) to
blender/previews/; look at every sheet and fix wrong scale, bad normals, holes, floating parts. Write
blender/ASSETS.md listing every GLB, its nodes, pivots, clips, real-world scale and where it goes. Rules: no
top-level cd, no bare python, check nvidia-smi before GPU renders, no personal data. Write pass1_started_at.txt and
pass1_finished_at.txt (UTC). Budget about 80 tool calls. Report the asset list with sizes, what you looked at, gaps.


Do not open, read or copy anything from <your folder> (another model's finished version of this app). The reference video folder and the topic file are yours to read.
~~~~

## Prompt 9: battle version of pass 2 given to Argon (`design/ARGON-PASS2-chipfab.md`)

~~~~text
Build a real-time 3D operations app that looks like a strategy game, in the browser, on the subject in design/TOPIC-chipfab.md
(read it first), using the GLB asset pack in <your folder>\app\public\assets (read blender\ASSETS.md). Learn the look
from the reference video the reference video (not included) and sheet.png: an
isometric world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout.

Work only in <your folder>\app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5425. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
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
~~~~

Both models got the same brief. Argon's version only adds the rule not to read the Opus folder.
