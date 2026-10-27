# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC on 2026-10-21. The briefs are copied as sent, with local paths replaced by relative paths or placeholders. The briefs follow the `visualize-in-3d` skill, and the run also tested that public skill. The plan the build followed is in `design/ASSETS.md`.

## Prompt 1: the request

An asked in an earlier chat for a metro world and a highway toll world to be added to the series of live 3D worlds (a paraphrase from the session notes, because the exact message was not found).

## Prompt 2: topic file (`design/TOPIC-metro.md`)

~~~~text
Your folder: <your folder> (create it). Port 5431.
Subject: how a city metro system runs, shown as a live 3D world of a made-up city's rail network. Sites are three lines of the network (two crossing lines and a circle line) plus the depot. The world: a stylised city block grid seen at a tilt with the ground cut away so the tunnels show underneath (a cross-section dollhouse view); twin-bore tunnels and elevated viaduct sections; stations with platforms, platform screen doors, escalators down from street entrances, mezzanine ticket gates; an interchange station where two lines cross on different levels; a depot and stabling yard with maintenance sheds and a wash plant; the control centre building. What moves: trains of 6 cars with real bogies and pantographs or third rail shoes, accelerating, braking and dwelling at platforms with doors opening; passengers as small flat figures flowing through gates, down escalators and onto platforms (crowd density shown by colour); signal blocks along the track that turn red behind each train (moving block / CBTC idea: the safe-braking envelope drawn as a soft bar ahead of each train); a disruption (a stalled train or a door fault) that makes following trains hold and headways stretch, then recover; power substations feeding sections of track. Data: trains (id, line, position, speed, load %, next station, delay), stations (passengers waiting, gate entries per minute, platform crowding), headway per line, timetable vs actual, incidents. KPIs: trains in service, average headway, on-time %, passengers per hour. The bottom timeline follows one train from depot to its first full loop (leave depot, enter service, stops, interchange, turnback). Real research first: how CBTC moving-block signalling, dwell time, headway, turnback and depot stabling work, and real dimensions of metro cars, platforms, tunnels and escalators. Made-up city, line names and colours; no real operator, map or logo.
~~~~

## Prompt 3: pass 1, assets (02:42 UTC, the message to the delegated agent)

~~~~text
Pass 1 (3D assets) of a "visualize-in-3d" live app about a city metro system. This run also tests the public skill, so follow it exactly as a stranger would.

Read first: `<visualize-in-3d skill>\SKILL.md`, then its `references/brief.md` (use the Pass 1 brief), `references/real-objects.md` and `references/looks.md` (look: toy isometric). In the skill, `{{WORK_DIR}}` = `<demos folder>` and `{{SKILL_DIR}}` = `<visualize-in-3d skill>`. The topic file is `design/TOPIC-metro.md`. Use the `simplify-code` skill for code.

Blender 5.2: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe", headless (--background --factory-startup --python), below-normal priority, only when no other blender.exe is running (another worker builds a toll plaza at the same time; wait for its Blender to finish rather than run two). No downloads: research from your knowledge and write the reference sheets with sources named as "from memory, verify" where you cannot open a page. Only edit inside `<your folder>`.

Machine rules: no top-level `cd` (absolute paths or a subshell), never bare `python` (use `uv run --no-project python`), no trailing `&` (use run_in_background), do not kill processes you did not start. Finish in about 80 tool calls; stop at a clean point if you run out.

Report: the asset list with GLB paths, the reference sheets, a compare render path, and a short list "skill problems": every place where the public skill's text was unclear, wrong, missing a step, or assumed something about this machine. That list matters as much as the assets.
~~~~

## Prompt 4: pass 2, app and film (03:16 UTC, the message to the delegated agent)

~~~~text
You are testing a public skill by following its brief exactly. Brief below, then machine rules.

<brief>
Build a live 3D app in the browser that makes a complex place or system easy to see, on the subject in design/TOPIC-metro.md
(read it first), using the GLB asset pack in <your folder>/app/public/assets (read <your folder>/blender/ASSETS.md). Render the
world, skin the UI and shape the film as the look named in the topic says (its section in
<visualize-in-3d skill>/references/looks.md). In every look: a
world with things moving on their own; pins and selection rings over objects; a real dashboard around the
scene (top bar with search, site switcher, live clock and user; KPI cards top left; a detail card on the right that
opens for any clicked object with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at
the bottom right; zoom and camera buttons). Make your own name, logo and data. Never call it a game in the UI.

Work only in <your folder>/app. Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions, serve on port
5431. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read
it, and a small seeded simulation advances it in real time so things move, statuses change and numbers tick. Load the
GLBs with instancing for repeats, drive every moving part and clip from the simulation. Clicking an object selects it
and opens its card; clicking a list row flies the camera to it (and follows it if it moves); switching sites changes
the world. Soft shadows, ambient occlusion, gentle bloom on lights, smooth camera moves. 60 fps at 1920x1080 on a
mid-range GPU such as an RTX 3060.

UI rules: no small uppercase eyebrow labels above headings, no coloured left-border callouts, no divider lines
between rows (spacing and subtle fills instead), every status starts with an icon whose shape differs per state, tabs
are quiet text buttons, a card closes by clicking empty ground or Esc (no X on side panels).

Verify with Playwright (Chromium with --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11) at 1920x1080: the overview, a selected object with its card, a second site, a
close-up, plus close-ups of each main asset type. Look at every one and fix clipping, overlapping UI, unreadable
text, z-fighting, floating or sunken objects, broken picking, anything that looks like programmer art. Measure fps.

Film: 30 s 1920x1080 30 fps at shots/film.mp4 with a deterministic virtual clock (override requestAnimationFrame,
performance.now and Date.now in an init script, advance 1/30 s per captured frame; drive the app only through real
clicks, drags and wheel events with a visible cursor), encoded at below-normal priority, H.264 yuv420p crf 18
faststart, plus a copy under 25 MB. Shape: 0-5 s slow orbit over the whole site with things moving; 5-12 s click a
moving unit, its card opens and updates live while the camera follows; 12-18 s click a list row and the camera flies
there; 18-24 s switch to another site; 24-30 s pull back to a wide shot where the site still fills most of the frame.
mpdecimate must show no repeated frames; look at stills (use bash <visualize-in-3d skill>/scripts/contact-sheet.sh <video> <out.png> [fps]).
Film traps that earlier builds had to fix: the opening so far out that units are specks (open close
enough that dozens of moving units read); a beat that waits on the simulation and shows nothing (pre-roll the
virtual clock so the followed event lands 2-3 s into its beat); a follow camera that ends inside a structure (keep a
minimum distance and a height above the tallest model); selection rings far wider than the object (fit the
footprint, an ellipse for long things, at most about 1.3x); bare white or grey ground (give every surface a real
material: asphalt, lane paint, verges, floors); a last shot where the site is small in a sea of empty ground.

Write README.md, pass2_started_at.txt and pass2_finished_at.txt (UTC) in <your folder>. Budget about 100 tool calls. Report: what was
built, how to run it, screenshot and film paths, checks with numbers, honest gaps, and a one-line caption suggestion
("Claude built a live <place>, every <main assets> modeled in Blender and running in three.js").
</brief>

Notes from Pass 1 (from ASSETS.md author): every GLB keeps roots side by side with an offset, so take a root by name and reset its position. The Walk/Idle clips on people.glb were never checked posed; check one posed frame and if bone axes are wrong, fall back to sliding figures without the clip and say so. Car end bellows read as black slabs; tint them in the app if it shows.

Machine rules (Windows 11, RTX 3060 shared with the user and another worker building a toll-plaza app on port 5432 in demos/viz-toll — do not touch that folder or its processes):
- Never cd at top level in Bash; use absolute paths or a subshell "(cd dir && ...)".
- Never call bare python; use `uv run --no-project python`. No trailing `&` or nohup; use run_in_background for the dev server and long jobs.
- No downloads other than npm install of the pinned packages. Start ffmpeg encodes at below-normal priority.
- Check nvidia-smi before GPU-heavy runs. Kill only processes you started (the dev server, your Chromium) when done.
- Use scratch files only inside <your folder> (not a shared scratch folder).
- Do not post anything anywhere.

At the end of your report add "Skill problems": a numbered list of anything in the brief or skill files that was unclear, wrong or missing, with what you did instead.
~~~~

## Prompt 5: polish pass (03:58 UTC, the message to the delegated agent)

~~~~text
Polish pass on the live 3D metro app in <your folder>/app (Vite + R3F, port 5431, film harness app/tools/film.mjs with plan app/shots/film-plan.json; read README.md in demos/viz-metro first). Everything else is approved; change only what is below, then re-record the 30 s film the same way (virtual clock, real mouse input, visible cursor), keeping shots/film.mp4 and a copy under 25 MB at shots/film-small.mp4.

Problem: in the current film (contact sheets in app/shots/film-sheets/) the city buildings dominate, trains are tiny specks, and the viewer never sees what makes a metro hard to picture: the tunnels and stations underground. Fixes:
1. Make the underground the star on the Harbour site. Cut the ground away along the line as a clean cutaway (section through soil strata, using the Ground_* blocks' strata) so twin tunnels with trains, the station box with platform, mezzanine, escalators and the street entrance all read in one view. Buildings within about 60 m of the line on the camera side are removed or ghosted to 15-25% opacity; keep them full on the far side. Fill open pits with soil/concrete materials, no empty grey/brown pit floors.
2. Trains must read: the opening and the follow shot frame so a 6-car train fills at least a quarter of the frame width. Open the film close on the cutaway with a train arriving at the platform, not on a city overview.
3. Follow beat (5-12 s): click a train that is moving and arrives at the station inside the beat (doors open, passengers move). Spawn or time it from the simulation so the arrival lands 2-3 s into the beat. Keep continuous slow real input (drag-orbit) during holds so no frames repeat.
4. Ring site ending (24-30 s): pull back only until the ring viaduct and its trains fill most of the frame; trains must still be visible as trains, not dots. Lower or thin the tallest towers near the ring if they hide it.
5. Timeline should follow the selected/followed train on each site, not one global train.

Check: contact sheets of the final encode with bash <visualize-in-3d skill>/scripts/contact-sheet.sh <video> <out.png> 1 (sheets newer than video), look at every frame for trains as specks, UI over the action, follow camera inside structures, empty pits; mpdecimate shows no repeated frames. Save 4 stills (opening, follow, station, ending) in app/shots/.

Machine rules (Windows 11, RTX 3060 shared with the user): never cd at top level in Bash (use absolute paths or a subshell); no bare python; no trailing & or nohup, run the dev server with run_in_background and stop it when done; no downloads; ffmpeg at below-normal priority; check nvidia-smi before GPU-heavy runs; kill only processes you started; do not touch other demos folders; do not post anything. Budget about 80 tool calls; if it runs out, stop after a clean re-record and list what is left.

Report: what changed, film paths and sizes, checks with numbers, gaps left, and a list of skill problems (anything a fresh agent following the skill would have needed to know).
~~~~

## Prompt 6: final small fix (04:44 UTC, the message to the delegated agent)

~~~~text
Final small fix on the live 3D metro app in <your folder>/app (port 5431, film harness tools/film.mjs with shots/film-plan.json; README in demos/viz-metro). Everything else is approved; change only these, then re-record the 30 s film exactly as before (always the full 900 frames; log to a file, do not pipe to tail):

1. Harbour site: remove the 20% ghost buildings on the camera side entirely (they wash the lower third of the frame into muddy green/yellow with banding). In their place put a clean low foreground: street-level paving/road and the soil cut face of the cutaway (concrete diaphragm wall top edge plus visible soil strata on the cut face), so the eye goes to the station and trains. Keep low-rise capping beyond as now. The street entrances and escalators must stay visible.
2. Train card consistency: while a train is "Boarding at platform" the Doors field must read Open (and Closing/Closed in the right phases), matching the door animation. Check other fields for the same kind of mismatch.

Check: contact sheets of the final encode with bash <visualize-in-3d skill>/scripts/contact-sheet.sh <video> <output folder> 1, look at every frame; mpdecimate keeps 900/900; replace shots/still-opening.png, still-follow.png, still-station.png, still-ending.png and look at still-follow.png and still-opening.png at full size. Outputs: shots/film.mp4 and shots/film-small.mp4 under 25 MB.

Machine rules: never cd at top level in Bash (use absolute paths or a subshell); no bare python; no trailing & or nohup, dev server via run_in_background and stopped at the end; kill only processes you started, including stray Chrome/node from timeouts; no downloads; ffmpeg at below-normal priority; do not touch other demos folders; do not post anything. Budget about 40 tool calls.

Report: what changed, file paths and sizes, checks with numbers, gaps.
~~~~

## Prompt 7 (translated from Vietnamese, 08:13 UTC)

"Why is the metro still laggy? The blocks glitch and stick together, so their textures overlap all the time. The opening is too boring. Turn it into a good showreel."

## Prompt 8: rendering defects (08:14 UTC, the message to the delegated agent)

~~~~text
Fix rendering defects in the live 3D metro app at <your folder>/app (Vite + R3F, port 5431, film harness tools/film.mjs with shots/film-plan.json; read demos/viz-metro/README.md first). Use the `engineering-workflows` skill for the order of work (reproduce, root cause, fix, verify). The user watched the film and says it still lags and blocks glitch into each other so textures overlap constantly. Diagnosis from frames (verify each in code before fixing):

1. Stutter: src/sim/simulation.js uses FIXED_STEP = 0.1 with an accumulator and no interpolation, so at 30/60 fps trains, doors, wheels and passengers move only every 3rd frame and the follow camera judders with them. Fix: keep the fixed-step sim, but store previous and current pose per moving thing and render the interpolated pose with alpha = accumulator / FIXED_STEP (trains along the track by distance, door positions, wheel angles, agents). The follow camera must target the interpolated pose and be smoothed. Measure: in a 30 fps film, the followed train's screen position must change every frame (sample 60 consecutive frames and compute per-frame motion of the train, report the numbers).
2. Station overlap at Harbour (Old Mill etc.): the station box with translucent glass / platform screen doors overlaps the trains and itself (repeated Station_Module instances overlapping at ends, transparent layers stacked), producing a layered smeared look. Fix: lay modules end to end with no overlap (use the module length from ASSETS.md / catalog), make the station walls and roof opaque or remove the near walls for the cutaway, keep only one thin glass layer for the screen doors with depthWrite correctly set and renderOrder, and make sure the train's track centerline sits clear of the platform edge and screen doors (no intersection).
3. Ring viaduct curve: the curve is built from straight Viaduct_Span instances that overlap, so decks and rails z-fight and look doubled. Fix: build the curved deck and rails as continuous geometry along the curve (extruded/swept or short segments with mitred joints, no overlap), keep piers from the GLB.
4. General z-fighting sweep: find any coplanar surfaces (ground blocks vs paving vs soil floor, road vs ground, platform floor vs module floor, track slab vs tunnel floor) and separate them by height (a few cm) or polygonOffset; check the logarithmic depth / near-far planes (near too small causes flicker: set near ~0.5-1 and far just beyond the scene).
Also: the orange low-rise roof that intrudes in the lower left during the first 2 s of the film: remove or lower that building.

Then re-record the 30 s film with the same plan (full 900 frames, log to a file, never pipe to tail), produce shots/film.mp4 and shots/film-small.mp4 (under 25 MB). Check: contact sheets with bash <visualize-in-3d skill>/scripts/contact-sheet.sh <video> <output folder> 1; extract full-size frames at 3 s, 8 s, 15 s, 22 s, 27 s and crop/zoom the station and the ring curve to confirm no overlapping or flickering surfaces; compare two consecutive frames at 8 s to confirm motion every frame; mpdecimate keeps 900/900. Report numbers.

Machine rules (Windows 11, RTX 3060 shared with the user): never cd at top level in Bash (absolute paths or a subshell); never bare python (uv run --no-project python); no trailing & or nohup, dev server via run_in_background and stopped at the end; kill only processes you started; no downloads; ffmpeg at below-normal priority; do not touch other demos folders; do not post anything. Budget about 80 tool calls; if it runs out, stop after a clean re-record and list what is left.

Report: root causes found, what changed (files), measured checks, full-size stills paths, gaps.
~~~~

## Prompt 9 (translated from Vietnamese, 15:41 and 15:47 UTC)

"Also, add features for different camera perspectives for each important stage, the simulation speed, and so on. Update them into the skill, and commit and push." Then: "Apply all of it."

## Prompt 10: stage cameras and simulation speed (15:48 UTC, the message to the delegated agent)

~~~~text
Add stage cameras, a stage tour and simulation speed controls to an existing live 3D app (Vite + React Three Fiber). App: <your folder>/app (port 5431; topic design/TOPIC-metro.md). The spec is the paragraph starting "Stages and playback." in <visualize-in-3d skill>/references/brief.md; read it and the "UI rules" paragraph after it, and implement all of it. Stages for this app: passengers through the fare gates, escalator down to the platform, train arrives and doors open (screen doors), boarding and doors close, train departs through the tunnel or viaduct, turnback or depot. Pick each preset from the real scene (the station is cut away), framed so the acting unit fills about a quarter of the frame from the side that shows the moving part.

Constraints: work only in that app folder. Do not touch shots/film.mp4, film-small.mp4 or any film (a post of the metro film is scheduled tonight; no re-recording). The simulation already interpolates poses with alpha from a fixed step in src/sim/simulation.js; keep that working. Keep it deterministic: speed = more fixed steps per frame (accumulate fractional), never a longer step. Expose presets and speed on the app's window handle. UI fits the existing dashboard; no eyebrow labels, no divider lines, no left-border callouts, quiet text buttons, a status icon per state. Run the dev server as a background job and stop it at the end. No downloads beyond npm install. No top-level cd in Bash (use subshells), no bare python, no trailing & or nohup, never kill processes you did not start. Other agents may run Playwright checks at the same time on other ports; that is fine.

Verify with Playwright at 1920x1080 (Chromium --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11): one screenshot per stage preset into shots/stages/<n>-<name>.png, one with the stage bar and playback controls visible, and checks with numbers: pause freezes every moving thing (compare positions over 1 s), for the same seed the order of the first 20 events is identical at 1x, 5x and 0.25x, the tour visits every stage once, and at 1x the followed train still moves every frame. Look at every screenshot and fix framing, clipping and UI overlap. Budget about 60 tool calls. Report: what was added, the stage list with keys, screenshot paths, check results with numbers, gaps.
~~~~

## Prompt 11 (translated from Vietnamese, 16:25 UTC)

"For the metro, check carefully that the train doors and the station doors match, so they don't sit off from each other."

## Prompt 12: door alignment (16:28 UTC, the message to the delegated agent)

~~~~text
Fix the metro station so every platform screen door (PSD) lines up with a train door, on both platform faces, at every station. Project: <your folder> (Blender scripts in blender/, GLBs in app/public/assets/, app in app/, port 5431). Read blender/ASSETS.md first.

Measured problem (from the GLB node positions and src/data/network.js):
- PSDs are baked into Station_Module (station.glb): the PsdGlass/steel/PsdIndicator wall with openings and the Psd_N1/N2/S1/S2 a/b leaves at module-local x = +-2.45 (leaves at +-1.95 / +-2.95, slide 1.0 m). Modules are 9.9 m in the GLB but placed at 9.8 m pitch with scale 9.8/9.9 (src/world/buildSite.js MODULE_LENGTH / MODULE_MODEL_LENGTH), 13 modules centred on the station.
- Train doors: CAR_KINDS [Cab, Motor, Trailer, Trailer, Motor, Cab], CAR_CENTRES [-51.2, -30.6, -10.2, 10.2, 30.6, 51.2]; Cab door leaf pairs centre at local x -7.8, -2.9, 2.0, 6.9 (nose +X; car 0 is flipped 180, car 5 is not, see placeTrain), the others at +-2.45, +-7.35. Door openings about 1.4 m.
- Result with the train stopped at station.s: offsets per door from the nearest PSD opening are +-0.4 m on the middle cars, +-1.2 m on cars 2 and 5, +-1.75 m on the end cars.
- Also lateral: track centres at LANE_OFFSET 7.6 (network.js) while the PSD plane is at +-5.3 and the car side about 1.54-1.6 from the track centre, so a gap of about 0.75 m between train and screen doors. Real gap is about 0.1-0.2 m. LANE_OFFSET was raised from 7.0 earlier because the train intersected something at the platform edge (the steel frame reaches +-5.45, the yellow edge +-5.4); find what the car body's real half-width is and set the offset so the car side is 0.12-0.2 m outside the outermost platform-edge geometry, with no intersection.

Fix the way real metros do it: the screen doors are placed to the train's doors.
1. In blender/station.py split the PSD wall out of Station_Module: a `Psd_DoorUnit` (frame, header with indicator in its own named emissive material, two leaves `Psd_Leaf_a/b` as separate objects with the pivot at the leaf centre, sliding along X) and a `Psd_Panel` fixed glass panel 1.0 m long that the app scales along X to fill gaps, plus end panels if needed. The module keeps platform, floor, edge and structure but no PSD wall. Keep the materials and look identical. Run Blender headless at low priority (one at a time; start the script with bpy.ops.wm.read_factory_settings(use_empty=True)); log to a file and read it. Re-render the station contact sheet with blender/preview.py and look at it. Update ASSETS.md.
2. In the app, build the PSD wall per station face from the train consist: one door unit centred on every train door position for a train stopped on its mark (compute from CAR_CENTRES, CAR_KINDS and the cab flips, mirror correctly for each direction/face, including the cab offset asymmetry), fixed panels filling between them, end to end with no overlap and no coplanar faces (skill rule: run <visualize-in-3d skill>/scripts/coplanar-check.js on the built scene). Drive the leaves from the same door-open value as the train doors, per face. Check the sim's stop point: the train must stop exactly where the computed doors assume (log train.s - station.s at dwell for several trains and stations; it must be under 5 cm, fix the stopping if not). Make the module grid stop shrinking modules if that was only there for the old PSD layout (keep no overlap).
3. Fix the lateral gap as above.

Verify with numbers and pictures: a script that, for every station and both faces, takes a dwelling train and prints each train door centre vs its PSD unit centre (world coordinates along the track) and the lateral gap; every offset must be under 5 cm. Screenshots at 1920x1080 (Chromium --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11) at platform eye level with doors open on both faces, from each end of the platform and the middle, into app/shots/psd/. Look at them. Re-run app/tools/stage-checks.mjs (stage cameras exist in src/data/stages.js) and re-shoot shots/stages/3-doors-open.png and 4-boarding.png. Do not touch existing films. Work only in that project folder. No downloads. No top-level cd in Bash (use subshells), no bare python (uv run --no-project python), no trailing & or nohup, never kill processes you did not start; stop your dev server at the end. Budget about 90 tool calls. Report: what changed, the offset table summary (max offset, max lateral gap), screenshot paths, what you looked at, gaps.
~~~~

## Prompt 13: re-record the film (16:45 UTC, the message to the delegated agent)

~~~~text
Re-record the 30 s metro film after a fix to the station. Project: <your folder>/app (port 5431). The platform screen doors were rebuilt to line up with the train doors, LANE_OFFSET went 7.6 -> 7.22, and trains now glide onto their stop mark (src/sim/simulation.js), so arrival timings shifted slightly. The film recorder is tools/film.mjs (planning helpers tools/plan-film.mjs, plan-film2.mjs; README.md in the app or project describes the encode). Read <visualize-in-3d skill>/references/film.md section "Live app films" and its Checks.

Do: keep the same film shape and beats as the current shots/film.mp4 (look at it first: extract stills at 1 fps and view a sheet). Re-plan any beat whose hero event no longer lands 2-3 s into its beat (the followed train arriving and its doors opening must be clearly visible with screen doors opening with them). Back up the current shots/film.mp4 and film-small.mp4 as film-v1-psd-misaligned.mp4 / film-small-v1-psd-misaligned.mp4 first. Record 900 frames on the virtual clock, encode H.264 yuv420p (use scale=in_range=full:out_range=limited,format=yuv420p if frames are JPEG), crf 18, faststart, BT.709 tags, at below-normal priority, plus film-small.mp4 under 25 MB. Checks: mpdecimate keeps 900 of 900; a 1 fps contact sheet you look at; two consecutive full-size frames in the follow beat show motion; one full-size crop at a station with doors open showing train doors and screen doors aligned; one flicker crop. Run the dev server as a background job and stop it at the end. Only that folder. No downloads. No top-level cd in Bash (subshells), no bare python, no trailing & or nohup, never kill processes you did not start. Budget about 50 tool calls. Report: what changed in the plan with times, file paths and sizes, check numbers, the stills you looked at, gaps.
~~~~
