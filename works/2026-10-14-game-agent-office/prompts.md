# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC. The briefs are copied as sent, with local paths removed.

## Prompt 1 (translated from Vietnamese, 2026-10-14 14:14 UTC)

Download this video (https://www.youtube.com/watch?v=Cv5RSFlfPSM) so Opus can try it. The idea is a 3D warehouse app that looks like a game. Now build something on a different subject, but with the same idea: it looks like a game.

## Prompt 2 (translated from Vietnamese, 2026-10-14 14:21 UTC)

Do all three.

## Prompt 3 (translated from Vietnamese, 2026-10-14 15:42 UTC)

Have you had them modelled in Blender and then put into three.js yet?

## Prompt 4 (translated from Vietnamese, 2026-10-14 18:49 UTC)

Skip the other posts. Now do the Blender and three.js version of those three.

## Prompt 5: topic file for this app (`design/TOPIC-agents.md`)

~~~~text
Your folder: <your folder> (create it). Port 5422.
Subject: an AI agents office, the "workers" of a desktop app called Orglet (by CodePawl), shown as a little isometric office where each AI agent is a character. Before designing, read what Orglet really does from the Orglet repository (github.com/codepawl/orglet) (read only: its README files and docs; do not run, build or change anything there), and show only real features and concepts from it (for example agents, tasks, tools, approvals, if that is what the docs say). Sites are teams or workspaces. The world: desks, rooms such as a research corner, a coding room, a review room and a mailroom; agent characters walk between rooms carrying task cards; a manager desk where tasks arrive; approval stations where a human signs off. Data: agents (name, role, current task, tool in use, tokens spent), tasks with stages, approvals waiting. KPIs that fit the real product. Characters are original simple chunky low-poly figures, not any existing character. If something you would like to show is not in Orglet's docs, leave it out and list it in your report.
~~~~

## Prompt 6: shared build brief, pass 1 (`design/BRIEF-COMMON.md`)

~~~~text
Build a real-time 3D operations app that looks like a strategy game, in the browser, so An (the user) can post it on X. It is the same idea as the reference video, on a different subject (below). The reference: the reference video (not included) (72 s) and its frame sheet sheet.png in the same folder. Watch frames from it first (ffmpeg is on PATH) to learn the look: a clean isometric low-poly world in a light, cool palette with one strong brand colour; small vehicles and units moving on their own; pins and selection rings over objects; a real dashboard around the scene (top bar with search, site switcher, live clock and user; KPI cards at the top left; a detail card on the right that opens when you click any object, with live fields and a progress bar; a timeline strip at the bottom; tabs of lists at the bottom right; zoom and camera buttons). Make your own name, logo and data. Do not copy the reference's name, logo, text or exact layout.

Work only inside your folder (named below). Never run a top-level `cd` (absolute paths or a subshell), never call a bare `python` (use `uv run --no-project python <file>`). Do not read other folders except the reference folder and any read-only source named below.

Stack: Vite + React + React Three Fiber (+ drei), pinned exact versions. A plain data model (sites, units, tasks, events) drives everything; the 3D view and the dashboard both read it, and a small simulation advances it in real time so things move, statuses change and numbers tick. Clicking an object in 3D selects it and opens its detail card; clicking a row in a list flies the camera to it. Switching sites changes the world. Models are built in code from primitives with bevels and soft shading (no downloaded assets), with soft shadows, ambient occlusion feel, gentle bloom on lights, and smooth camera moves. Keep 60 fps at 1920x1080 on an RTX 3060 (other jobs share the GPU; check nvidia-smi before heavy steps and keep VRAM use modest).

Verify on the rendered page yourself with Playwright (playwright, headless Chromium with --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist) at 1920x1080: screenshots of the overview, a selected object with its card open, a second site, and a close-up. Look at every one and fix clipping, overlapping UI, unreadable text, z-fighting and anything that looks like programmer art. UI follows these house rules: no small uppercase "eyebrow" labels above headings, no coloured left-border callouts, no divider lines between rows (use spacing and subtle fills), status always starts with an icon whose shape differs per state, tabs are quiet text buttons.

Film: record a 30 s 1920x1080 30 fps mp4 at shots/film.mp4 with a deterministic virtual clock (override requestAnimationFrame, performance.now and Date.now in an init script and advance 1/30 s per captured frame; drive the app only through real clicks, drags and wheel events with a visible cursor), encoded with ffmpeg at below-normal priority, H.264 yuv420p crf 18 faststart. Shape: 0-5 s slow orbit over the whole site with things moving; 5-12 s click a moving unit, its card opens and updates live; 12-18 s click a list row and the camera flies to it; 18-24 s switch to another site; 24-30 s pull back to a wide shot. Check the film has no repeated frames (ffmpeg mpdecimate) and look at stills from it.

Write README.md (how to run) and started_at.txt / finished_at.txt (UTC). Budget about 100 tool calls. Report: what was built, how to run it, paths of screenshots and film, check results, honest gaps, and a two-line caption suggestion ("Opus 5.5 built ..." then one everyday sentence).
~~~~

## Prompt 7: Blender rebuild brief, pass 2 (`design/BRIEF-BLENDER.md`)

~~~~text
Second pass on an existing app in your folder (named in the task). The owner wants every 3D asset rebuilt in Blender and loaded into three.js, the same pipeline as the creek scene: today the models are made from primitives in React Three Fiber code and read as blocky toys.

Do:
1. Read your folder first (README, src, the data model, the film script, shots/) so you keep everything that works. Keep the data model, simulation, dashboard, interactions, camera moves, house UI rules and the film's shape and timing exactly; only the 3D assets and their look change.
2. Write Blender Python scripts in `blender/` that model every asset procedurally: proper bevels, rounded edges, panel lines, small real details (vents, bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and correct normals, UVs, and PBR materials (base colour, roughness, metalness, emissive where it glows; small procedurally baked textures are fine). Several variants per asset type so repetition does not show. Keep moving parts as separate named objects or bones (wheels, doors, fans, lifts, jet bridges, character limbs) so the app can animate them. Export GLB to `public/assets/` (keep the total under about 40 MB). Blender 5.2 is at "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (`--background --factory-startup --python <script>`) at below-normal priority. Other sessions also run Blender on this machine: before each run check no other blender.exe is running and wait if one is.
3. Load the GLBs in the app (drei useGLTF, instancing for repeated assets so it stays at 60 fps), keep picking and selection rings working on the new meshes, and tune lighting and post (shadows, AO, bloom, tone mapping) for the new materials. Keep the light, clean art direction of the reference and of your first pass, just with real detail.
4. Verify as before with Playwright at 1920x1080 (the same four screenshots plus one close-up of each main asset type) and look at every one; fix scale, floating or sunken objects, normals, z-fighting, broken picking, unreadable UI. Measure the frame rate.
5. Re-record the 30 s film with your existing film script to `shots/film-blender.mp4` (keep the old `shots/film.mp4`), check mpdecimate and look at stills. Delete the intermediate frame PNGs after encoding.

Rules: work only in your folder; no top-level `cd`; no bare `python`; check nvidia-smi before GPU-heavy steps and keep VRAM use modest (three apps are being reworked at once); no personal data in files or headers; original designs only (no real brands, logos or existing characters). Write `pass2_started_at.txt` first and `pass2_finished_at.txt` last (UTC). Budget about 100 tool calls. Report: what changed, asset list with GLB sizes, fps, screenshot and film paths, mpdecimate result, and honest gaps.
~~~~

## Prompt 8: the task message to the delegated agent, pass 2 (18:49 UTC)

~~~~text
Use the `simplify-code` skill. Your folder: <game-agent folder>-office (the Orglet Office app, port 5422). Read and follow, completely and exactly, design/BRIEF-BLENDER.md. Assets to rebuild in Blender include the orglet characters (keep them original, chunky and friendly, rigged or split so they walk, sit and carry a task card; not based on any existing character), desks, chairs, monitors, the lead desk, approval kiosks, the routines board, room walls and floors, plants and trees. Do not touch the Orglet repo.
~~~~

## Prompt 9: Polish pass (19:16 UTC), the message to the delegated agent

~~~~text
Use the `simplify-code` skill. Final polish pass on an approved app: <game-agent folder>-office (Orglet Office, three.js + Blender GLBs, port 5422; read README.md first). The owner approved everything else; change nothing beyond these fixes:

1. Routines board reads grey because it faces away from the main light: make its tiles and frame read clearly (light it or adjust its material/emissive in the Blender script `blender/build_office.py` and/or the scene), without washing out the rest.
2. Seated orglets clip into the armrests of the second chair style: fix the seat placement or the chair model so seated orglets sit cleanly in every chair.
3. Limbs move as rigid blocks: soften the walk and sit animation in `src/Character.jsx` (a small bob and sway, easing on arm and leg swings, a slight lean when carrying the card) so motion reads less robotic. No skinning rewrite.
4. In the film, Pax walks out of the close-up after about 3 s and the final wide shot ends a bit far out: make the camera follow the selected orglet during the close-up beat (or pick a seated one) and end the final pull-back a little closer so the office fills the frame. Keep the film's beats and 30 s length.

Rebuild assets with `blender/run.ps1` (it waits for other Blender jobs), run `vite build`, take screenshots with `scripts/screenshots.mjs` and look at the overview, the routines board close-up and a seated orglet close-up; then re-record with `scripts/film.mjs` to `shots/film-blender.mp4` (overwrite), check mpdecimate (no repeated frames) and look at 6 stills. Keep 60 fps. Rules: work only in that folder, no top-level cd, no bare python, check nvidia-smi before GPU steps. Budget about 40 tool calls. Report what changed, fps, mpdecimate result, stills you checked, anything left.
~~~~
