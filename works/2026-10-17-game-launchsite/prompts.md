# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC. The briefs are copied as sent, with local paths replaced by relative paths or placeholders.

## Prompt 1 (translated from Vietnamese, 2026-10-17 01:01 UTC)

Look for 3D models on Sketchfab or other model platforms, pull them in, adjust them and use them as reference. Do not make them low poly. I need them realistic, for example plants, rocks, houses, furniture, exteriors. The materials must be realistic too, so look online for references.

## Prompt 2: topic file, the plan for this app (`design/TOPIC-launchsite.md`)

~~~~text
Your folder: <your folder> (create it). Port 5426.
Look: point-cloud survey (references/looks.md). Terrain is a made-up stretch of flat subtropical coast (beach, dunes, tidal flats, a lagoon, a highway on a causeway), generated procedurally as a heightmap; no elevation download.
Subject: a heavy-lift reusable rocket launch site operations app. Sites are three pads on a made-up coastal launch complex (an orbital launch pad with its catch tower, a second pad under construction, a suborbital test stand), plus the build yard a few km inland. The world: a fully reusable two-stage super-heavy rocket (stainless, booster about 70 m and ship about 50 m, 9 m diameter, grid fins, many engines), the launch mount with its water deluge, the tower with two catch arms and the quick-disconnect arm, the propellant tank farm (liquid oxygen, liquid methane, nitrogen; spherical and horizontal tanks, vaporizers), the build yard high bays, self-propelled transporters rolling stages down the highway, cranes stacking the ship on the booster, ground crew vehicles, a road closure checkpoint, a recovery boat offshore, camera and weather towers. Data: vehicles (booster and ship serials, state: in bay, rolling, stacked, fuelling, flown), propellant load per tank (percent, boil-off), tasks (static fire, stack, destack, rollout, tank test), range status (road closure, airspace, marine, weather go or no-go with wind at altitude), countdown with holds. KPIs: days to next launch, propellant loaded, stages ready, range go or no-go. The bottom timeline follows one launch countdown (rollout, stack, propellant load, terminal count, liftoff, booster boostback, tower catch). Use made-up company, vehicle and site names; no real company, logo or livery.
Reference images: An approved (2026-10-17) fetching about 20 to 40 reference images for modelling from Wikimedia Commons (check each licence) and public domain US government sites (NASA, NOAA, USGS, FAA, US Navy, Library of Congress), kept in blender/refs/, never shown in the app or film.
~~~~

## Prompt 3 (translated from Vietnamese, 2026-10-17 12:29 UTC)

Now try a rocket launch site, a container port, a fulfillment warehouse, an F1 pit lane, a hospital emergency room and a theme park. That is enough. Make about 3 posts today and the rest tomorrow. (Also in the message: "Jack the Ripper is a good idea too, just note it.")

## Prompt 4: Pass 1: assets (brief to the delegated agent)

~~~~text
Build the 3D asset pack for a real-time operations app that looks like a strategy game. The subject, its world and
its data are in design/TOPIC-launchsite.md; read it first. The topic names a look; read that look's section in
<skills folder>/build-game-ops-app/references/looks.md and look at its reference files before
modelling. Make your own designs; no real brands, logos, liveries or existing characters.

Model from real references, never from memory: follow
<skills folder>/build-game-ops-app/references/real-objects.md. For every main asset write its
reference sheet in blender/refs/ (real type, dimensions with sources, proportions, parts list, 3 to 6 reference
images with source and licence) before modelling it, block out at real size against the reference views, and check
the compare renders. If the topic is a real place, fetch its elevation as that file says (the topic file states
whether An approved the download). Fetch reference images with one script (curl or Node) through the Wikimedia Commons API (search, then imageinfo with url and extmetadata for the licence; send a descriptive User-Agent) and public domain US government pages; keep it to the count the topic allows.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Blender 5.2 is at
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (--background --factory-startup
--python) at below-normal priority, only when no other blender.exe is running (wait if one is; two other workers are building asset packs at the same time, so expect to wait and use the wait to write scripts and reference sheets).

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details (vents,
bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and hardened edges,
UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Several variants per
asset type so repetition does not show. Moving parts are separate named objects or bones with their pivot at the
origin (wheels, doors, fans, lifts, booms, bridges, character limbs); characters and animals get an armature with
named clips. Keep the total under about 40 MB, one GLB per asset family so repeats can be instanced.

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on) to
blender/previews/, plus a reference-versus-render compare sheet per main asset; look at every sheet and fix wrong
scale, wrong proportions, missing parts, bad normals, holes, floating parts. Write
blender/ASSETS.md listing every GLB, its nodes, pivots, clips, real-world scale and where it goes. Rules: no
top-level cd, no bare python (use uv run --no-project python), no trailing & or nohup, check nvidia-smi before GPU renders, no personal data. Write pass1_started_at.txt and
pass1_finished_at.txt (UTC). Budget about 90 tool calls. Report the asset list with sizes, what you looked at, gaps.
~~~~

## Prompt 5: Pass 2: app and film (brief to the delegated agent)

~~~~text
Build a real-time 3D operations app that looks like a strategy game, in the browser, on the subject in design/TOPIC-launchsite.md
(read it first), using the GLB asset pack in <your folder>/app/public/assets (read blender\ASSETS.md). Render the
world, skin the UI and shape the film as the look named in the topic says (its section in
<skills folder>/build-game-ops-app/references/looks.md, and its reference files). In every look: a
world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout.

Work only in <your folder>/app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5426. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
it, and a small seeded simulation advances it in real time so things move, statuses change and numbers tick. Load the
GLBs with instancing for repeats, drive every moving part and clip from the simulation. Clicking an object selects it
and opens its card; clicking a list row flies the camera to it (and follows it if it moves); switching sites changes
the world. Soft shadows, ambient occlusion, gentle bloom on lights, smooth camera moves. 60 fps at 1920x1080 on an
RTX 3060 (other jobs share the GPU; check nvidia-smi before heavy steps). The point-cloud look overrides bloom (none) and asks for SSAO and a tilt-shift depth of field. rocket.glb is 133k triangles, mostly weld ring lines; thin it if you need headroom.

Topic beat for the film: the hero moment is the launch. Within the shape below, the countdown reaches liftoff (exhaust and steam as dot particles, the vehicle climbing) and the film ends on the booster returning and being caught by the tower arms, framed so the tower and booster fill most of the frame. A site switch can be short.

House UI rules: no small uppercase eyebrow labels above headings, no coloured left-border callouts, no divider lines
between rows (spacing and subtle fills instead), every status starts with an icon whose shape differs per state, tabs
are quiet text buttons, a card closes by clicking empty ground or Esc (no X on side panels).

Verify with Playwright (<playwright install>, Chromium with --use-angle=d3d11
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

Two other workers are building similar apps at the same time (ports 5427 and 5428) and may record films; check nvidia-smi and do not record at the same moment as another heavy GPU job if you can avoid it. Rules: no top-level cd, no bare python (uv run --no-project python), no trailing & or nohup (use background tool runs), kill your dev server and Chromium when done.

Write README.md, pass2_started_at.txt and pass2_finished_at.txt (UTC). Budget about 100 tool calls. Report: what was
built, how to run it, screenshot and film paths, checks with numbers, honest gaps, and a one-line caption suggestion
("Opus 5.5 built a live ... you can play like a strategy game, every ... modeled in Blender and running in three.js").
~~~~

## Prompt 6: Polish pass (brief to the delegated agent)

~~~~text
Polish pass on the launch-site app in <your folder>/app (read its README.md first; source in src/, tools in tools/, port 5426). The owner approved everything else; change nothing else. Fix exactly these, then re-record the film with the existing tools (node tools/film.mjs, then pwsh tools/encode.ps1) and look at stills from it:

1. Terrain dots read as coarse balls. The look (<skills folder>/build-game-ops-app/references/looks.md, Point-cloud survey; reference image <reference folder>/point-cloud-strait/ref.png) wants 2-4 px per dot in the wide shot: make the dots smaller and the grid denser (switch to THREE.Points with a sphere-impostor shader if instancing cannot hold 60 fps at the higher count), add slight jitter, and raise the height exaggeration so the dunes and lagoon banks read as landforms.
2. Liftoff is weak: a small orange smudge under the vehicle. Make it the hero moment: a bright exhaust core (white to orange, the one place warm colour is allowed besides the alert orange) with a long plume of dots behind the climbing vehicle, and a big steam cloud of dots that billows out radially from the mount and rises, still visible for several seconds after the vehicle clears the tower. Keep fps at 60 on the overview.
3. Film pacing: the recovery-boat beat holds about 6 s on a boat with oversized red rings. Cut it to about 3 s, scale selection rings to the object's footprint (never wider than about 1.5x the object), and give the time to the liftoff and ascent.
4. Status icons in the Vehicles list all use the same half-filled circle. Each state gets its own icon shape (for example ascent arrow up, holding pattern loop, parked square, driving chevron), as the house UI rules require.

Rules: no top-level cd, no bare python (uv run --no-project python), no trailing & or nohup (use background tool runs), check nvidia-smi before recording, kill the dev server and Chromium when done. Budget about 45 tool calls. Report what changed, fps measured, mpdecimate result, film paths and sizes, and anything you could not fix.
~~~~

## Prompt 7 (translated from Vietnamese, 2026-10-17 14:38 UTC, feedback on the series look)

The point-cloud theme looks a bit boring. Make only the rocket one with it, and use the normal theme for the rest.
