# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC on 2026-10-21. The briefs are copied as sent, with local paths replaced by relative paths or placeholders. The briefs come from the `visualize-in-3d` skill (a topic, a look, a pass 1 for assets and a pass 2 for the app), which the delegated agents followed. The plan the build produced is in `design/ASSETS.md`.

## Prompt 1 (translated from Vietnamese, 08:37 UTC)

Also make a few more posts to post on X.

In a short follow-up in the same chat, An asked for posts "like the toll station" (a highway toll plaza world that had just been built). The chat chose this subject as one of two new worlds.

## Prompt 2: topic file, the plan for this app (`design/TOPIC-canal.md`)

~~~~text
Your folder: <your folder> (create it). Port 5433.
Subject: how a canal lock lifts a ship over a mountain, shown as a live 3D world of a made-up ship canal across an isthmus, modelled on how the Panama Canal locks really work. Sites are the three-step lock flight on the sea side, the single lake-level lock on the other side, and the canal control center. The world: two parallel lock lanes of chambers stepping up the hill, each chamber a long concrete basin with miter gates (two leaves meeting in a V) or rolling gates, culverts in the walls with valves, the electric locomotives ("mules") on rails along both walls pulling the ship with cables, a control house on the center wall, the approach channel, a man-made lake at the top, tugboats, and the water itself. What moves: a big cargo ship (and a smaller tanker) entering the bottom chamber, mules taking the lines, the gates closing, water flowing in through the culverts so the chamber fills and the ship rises about 8.5 m per step, the gates opening, the ship moving up to the next chamber, three steps to the lake 26 m above the sea; the other lane doing the same downhill. Water level is the key visual: show it rising and falling in each chamber, with the culvert flow drawn. Data: ships (made-up name, type, length, beam, draft, direction, lane, chamber, step), chambers (water level, filling/emptying/level, gate state, valve state), locomotives (assigned ship, line tension), water used per lockage, transits per day, wait queue at anchorage. KPIs: transits today, average transit time through the flight, water per lockage (million litres), ships waiting. The bottom timeline follows one ship from the sea anchorage to the lake (enter chamber 1, gates close, fill, gate open, chamber 2, chamber 3, lake). Real research first: lock chamber dimensions (old Panama locks about 305 m by 33.5 m, about 8.5 m lift per step), how culverts and valves fill a chamber by gravity, miter gates, how mules work. Made-up canal, ship and operator names; no real brand or logo. Look: toy isometric.
~~~~

## Prompt 3: pass 1 brief, assets (08:40 UTC, the message to the delegated agent)

~~~~text
Follow this brief exactly (it comes from the public skill visualize-in-3d). Brief:

<brief>
Build the 3D asset pack for a live 3D app that shows how a complex place or system works. The subject, its world and its data are in design/TOPIC-canal.md; read it first. The topic names a look; read that look's section in <visualize-in-3d skill>/references/looks.md before modelling. Make your own designs; no real brands, logos, liveries or existing characters.

Model from real references, never from memory: follow <visualize-in-3d skill>/references/real-objects.md. For every main asset write its reference sheet in blender/refs/ (real type, dimensions with sources, proportions, parts list) before modelling it, block out at real size, and check the compare renders. The user has not approved downloading reference images: write each sheet from what you know, mark the numbers "verify", and use a dimension blockout drawn from the sheet as the left side of the compare. Say so in the report.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Run Blender 5.x headless (--background --factory-startup --python <script>) at low priority, one Blender at a time (wait while another blender process runs; another worker builds an airport baggage world in parallel and shares Blender). Use the full path to the Blender executable if `blender` is not on PATH, and send its output to a log file you read afterwards. Keep scratch files inside your folder.
Blender gotchas: --factory-startup still loads the default cube, camera and light, so start each script with bpy.ops.wm.read_factory_settings(use_empty=True). Model each vehicle and vessel facing Blender -Y; the glTF exporter turns that into +Z. Write the facing into ASSETS.md. glTF export of clips needs export_animation_mode="NLA_TRACKS" with each clip pushed to an NLA strip. bmesh.ops.bevel gives new faces material index 0, so set the materials of the bevel faces again on multi-material meshes. Blender renames duplicate names to .001, so prefix each child with its variant name.

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details, clean topology with smooth shading and hardened edges, UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Anything the app switches (signals, lamps, screens) gets its own named emissive material per state. Two to four variants of anything that repeats more than about five times; one model is fine for unique structures. Moving parts are separate named objects with their pivot at the hinge or axis (gate leaves, valves, mule wheels and capstans, ship rudder/propeller). Build repeating structures (chamber wall sections, mule track) on one module length that fits the real thing, and write it into ASSETS.md. Water is NOT a GLB (the app makes it), but give each chamber clear inner wall faces and culvert openings at the floor so the app's water level reads. Keep the total under about 40 MB, one GLB per asset family. Set single-sided materials (backface culling on).

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on, a 1.8 m figure block beside each asset for scale) to blender/previews/. For 3 to 6 main assets, also a compare sheet: dimension blockout and render in the same orthographic view and scale with a 1 m ruler, side by side, or stacked for long objects; look at every sheet and fix wrong scale, wrong proportions, missing parts, bad normals, holes, floating parts. Write blender/ASSETS.md with one table row per node: file, node name, pivot, facing, clips, real-world size and where it goes. Also write blender/catalog.json with the numbers the app needs (chamber length, width, lift per step, gate leaf length, mule rail offset, ship lengths and drafts). Check the facing in ASSETS.md against the exported file before handing over. Rules: check GPU memory (nvidia-smi) before GPU renders and use Workbench or CPU when it is full, no personal data. Write pass1_started_at.txt and pass1_finished_at.txt (UTC). Budget about 100 tool calls. If the budget runs out, stop after a family is exported and checked, and list the families not built. Report the asset list with sizes, what you looked at, gaps.
</brief>

Machine rules (Windows 11, RTX 3060 shared with the user and a showreel render): never cd at top level in Bash (absolute paths or a subshell); never bare python (uv run --no-project python); no trailing & or nohup, long jobs via run_in_background; kill only processes you started; no downloads; do not touch other demos folders; do not post anything. At the end add "Skill problems": anything in the brief or skill files that was unclear, wrong or missing.
~~~~

## Prompt 4: pass 2 task message (09:03 UTC, the message to the delegated agent)

~~~~text
Follow the brief in this file exactly, read it first: the pass 2 brief (Prompt 5) (it comes from the public skill visualize-in-3d). Also read the "Live app films" and "Checks" sections of <visualize-in-3d skill>/references/film.md before recording. ASSETS.md is at <your folder>/blender/ASSETS.md and numbers in blender/catalog.json.

Notes from Pass 1: ships face +Z in glTF (bow +Z); wall, floor and mule-track modules are 30.5 m, ten per 305 m chamber, chamber 33.5 m wide, 8.5 m lift per step, walls 25 m tall; gate leaf 19.2 m, closed at 17.1 degrees; the "on" lamp materials live on the `state_materials` swatch node in site.glb (hide that node, take its materials). Not built, so build them in the app: terrain and the lake dam, water, mooring cables from mules to ship, the incline track between chambers, the anchorage. Ships are about 4-7 m longer than LOA because of bow rake (catalog.json has measured bounds).

Story the film must make easy to see: a ship climbing a mountain by water. Water is the star: a translucent-but-single-layer water surface per chamber whose level visibly rises about 8.5 m while the ship rises with it, culvert inflow drawn (bubbling/flow at the floor ports), gates swinging closed and open, mules taking the cables. In the 5-12 s follow beat the hero ship must visibly rise inside its chamber (pre-roll so the filling is under way 2-3 s into the beat). Show the chamber cut open or at an angle where the waterline against the wall reads. Make the subject big in frame; terrain never outweighs it.

Another worker is building a baggage app on port 5434 and a showreel render runs too: check nvidia-smi before recording, and record the film only when no other Playwright film recording is running (wait if one is).

Machine rules (Windows 11, RTX 3060 shared with the user): never cd at top level in Bash (absolute paths or a subshell); never bare python (uv run --no-project python); no trailing & or nohup, dev server via run_in_background and stopped at the end; kill only processes you started; no downloads other than npm install of pinned packages; ffmpeg at below-normal priority; do not touch other demos folders; do not post anything. Before handing back, extract two consecutive full-size frames from the follow beat and confirm the ship and water move every frame, and crop/zoom full-size frames to confirm no flickering or overlapping surfaces (water against walls especially).

At the end add "Skill problems": anything in the brief or skill files that was unclear, wrong or missing.
~~~~

## Prompt 5: pass 2 brief, app and film (the file that Prompt 4 points to)

~~~~text
Build a live 3D app in the browser that makes a complex place or system easy to see, on the subject in design/TOPIC-canal.md
(read it first), using the GLB asset pack in <your folder>/app/public/assets (read blender/ASSETS.md). Render the
world, skin the UI and shape the film as the look named in the topic says (its section in
<visualize-in-3d skill>/references/looks.md, and its reference files). In every look: a
world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data; do not copy the reference's name,
logo, text or exact layout. Never call it a game in the UI.

Work only in <your folder>/app. Stack: Vite + React + React Three Fiber (+ drei, @react-three/postprocessing with N8AO for ambient occlusion), and
Playwright as a dev dependency for checks and the film, all pinned to exact versions, serve on port
5433. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
it, and a small seeded simulation advances it in real time so things move, statuses change and numbers tick. Load the
GLBs with instancing for repeats, drive every moving part and clip from the simulation. A fixed-step simulation
keeps the previous and current pose of everything that moves and renders the pose interpolated by the leftover
time, so motion and the follow camera change every frame (no stutter). No two surfaces share a plane and no two
modules overlap: lay repeats end to end, build curves (track, viaduct deck) as continuous swept geometry, lift
stacked floors a few centimetres apart, and set the camera near plane to about 0.5 m. Layered transparent surfaces
(glass over glass) read as a smear; keep one glass layer and make the rest opaque. Clicking an object selects it
and opens its card; clicking a list row flies the camera to it (and follows it if it moves); switching sites changes
the world. Soft shadows, ambient occlusion, gentle bloom on lights, smooth camera moves. 60 fps at 1920x1080 on a
mid-range GPU such as an RTX 3060.

UI rules: no small uppercase eyebrow labels above headings, no coloured left-border callouts, no divider lines
between rows (spacing and subtle fills instead), every status starts with an icon whose shape differs per state, tabs
are quiet text buttons, a card closes by clicking empty ground or Esc (no X on side panels).

Verify with Playwright (Chromium with --enable-gpu --ignore-gpu-blocklist, plus --use-angle=d3d11 on Windows) at 1920x1080: the overview, a selected object with its card, a second site, a
close-up, plus close-ups of each main asset type. Look at every one and fix clipping, overlapping UI, unreadable
text, z-fighting, floating or sunken objects, broken picking, anything that looks like programmer art. Measure fps.

Film: 30 s 1920x1080 30 fps at shots/film.mp4 with a deterministic virtual clock (override requestAnimationFrame,
performance.now and Date.now in an init script, advance 1/30 s per captured frame; drive the app only through real
clicks, drags and wheel events with a visible cursor), encoded at below-normal priority, H.264 yuv420p crf 18
faststart, plus a copy under 25 MB. Shape: 0-5 s slow orbit over the whole site with things moving; 5-12 s click a
moving unit, its card opens and updates live while the camera follows; 12-18 s click a list row and the camera flies
there; 18-24 s switch to another site; 24-30 s pull back to a wide shot where the site still fills most of the frame.
mpdecimate must show no repeated frames; look at stills.
Film traps that earlier builds had to fix: the opening so far out that units are specks (open close
enough that dozens of moving units read); a beat that waits on the simulation and shows nothing (pre-roll the
virtual clock so the followed event lands 2-3 s into its beat); a follow camera that ends inside a structure (keep a
minimum distance and a height above the tallest model); selection rings far wider than the object (fit the
footprint, an ellipse for long things, at most about 1.3x); bare white or grey ground (give every surface a real
material: asphalt, lane paint, verges, floors); a last shot where the site is small in a sea of empty ground.

Record the film as <visualize-in-3d skill>/references/film.md "Live app films" says. Run the dev server as a background
job and stop it when done. Write README.md, pass2_started_at.txt and pass2_finished_at.txt (UTC). Budget about 100 tool calls. Report: what was
built, how to run it, screenshot and film paths, checks with numbers, honest gaps, and a one-line caption suggestion
("Claude built a live <place>, every <main assets> modeled in Blender and running in three.js").
~~~~

## Prompt 6 (translated from Vietnamese, 14:36 UTC)

Send me the canal, baggage and Chernobyl pieces to look at.

## Prompt 7 (translated from Vietnamese, 15:41 and 15:47 UTC)

"Also, add features for different camera perspectives for each important stage, the simulation speed, and so on. Update them into the skill, and commit and push." Then: "Apply all of it."

## Prompt 8: stage cameras and simulation speed (15:48 UTC, the message to the delegated agent)

~~~~text
Add stage cameras, a stage tour and simulation speed controls to an existing live 3D app (Vite + React Three Fiber). App: <your folder>/app (port 5433; topic design/TOPIC-canal.md; tools/shoot.mjs and tools/plan.mjs already exist). The spec is the paragraph starting "Stages and playback." in <visualize-in-3d skill>/references/brief.md; read it and the "UI rules" paragraph after it, and implement all of it. Stages for this app: ship waits at the approach, mules attach and tow it into chamber 1, gates close, chamber fills (culvert valves open, water rises, ship rises), gates open and the ship moves up to the next chamber, exits to the lake. Pick each preset from the real scene (lane A is cut open so the waterline reads against the gauge piers), framed so the acting unit reads clearly from the side that shows the moving part (gate leaves, valves, rising water).

Constraints: work only in that app folder. Do not touch shots/film.mp4, film-small.mp4 or any film (no re-recording). Keep the simulation deterministic: speed = more fixed steps per frame (accumulate fractional), never a longer step; the schedule is computed per lane, so make sure speed changes do not break it. Expose presets and speed on the app's window handle. UI fits the existing dashboard; no eyebrow labels, no divider lines, no left-border callouts, quiet text buttons, a status icon per state. Run the dev server as a background job and stop it at the end. No downloads beyond npm install. No top-level cd in Bash (use subshells), no bare python, no trailing & or nohup, never kill processes you did not start. Other agents may run Playwright checks at the same time on other ports; that is fine.

Verify with Playwright at 1920x1080 (Chromium --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11): one screenshot per stage preset into shots/stages/<n>-<name>.png, one with the stage bar and playback controls visible, and checks with numbers: pause freezes every moving thing including water level (compare over 1 s), for the same seed the order of the first 20 events is identical at 1x, 5x and 0.25x, the tour visits every stage once. Look at every screenshot and fix framing, clipping and UI overlap. Budget about 60 tool calls. Report: what was added, the stage list with keys, screenshot paths, check results with numbers, gaps.
~~~~
