# Prompts

Both models got the same brief: `design/COMMON.md` (method, UI, recording hook, rules) plus `design/onsen.md` (the scene). Each ran headless once from a one-line starter prompt that named the brief, the project folder and a port. Opus ran with `claude -p --model opus`. Gemini 4 Argon ran with `agy --model gemini-4-argon-high`. The brief files are copied as they were, with local paths shortened.

## Prompt 1 (starter line, both models)

Follow the brief in benchmarks/battle-1015/onsen.md exactly (read it and COMMON.md first, completely). Your project folder is <your folder>/battle-onsen-<model> and your port is <port>.

## Prompt 1 brief: COMMON.md

# Common rules for every scene in this battle

Two AI models get the same scene brief and build it independently, so An (the user) can post a side-by-side video.
The one-line prompt that started you names your project folder and your port. Work only inside that folder (create
it). Do not read or touch any other folder except the read-only tools named below. Never run a top-level `cd` (use
subshells or absolute paths). Never call a bare `python`: Blender ships its own Python, and for any other Python use
`uv run --no-project python <file>`.

## Method, in this order

1. **Assets in Blender.** Blender 5.2 is at "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe". Write
   Blender Python scripts that model every asset procedurally and run them headless
   (`blender --background --python <script>`). PBR materials (vertex colours or small textures you generate in code
   are fine). Export GLB, total under about 30 MB. No downloaded models, textures, HDRIs or scenes. Run Blender at
   below-normal priority (from PowerShell: `$p = Start-Process -FilePath <exe> -ArgumentList @(...) -NoNewWindow
   -PassThru; $p.PriorityClass = 'BelowNormal'; $p.WaitForExit()`), one Blender job at a time. The owner works on
   this machine (RTX 3060 12 GB); other jobs share it.
2. **Web app in three.js.** An npm project with an exact pinned three version, loading the GLBs and adding whatever
   is animated or shaded in real time (water, rain, snow, smoke, foliage wind, particles), the lighting presets,
   soft shadows, ACES tone mapping, fog or haze, and postprocessing. A static server must be enough to run it; add
   `npm run serve` that serves on your port. No external URLs at runtime.

## Look

It should feel like a photograph of a real, cozy place, not a game level or programmer art: believable scale,
weathered materials, soft light, depth and atmosphere. Iterate on the look until it is genuinely good.

## UI and controls (same on every scene)

- A small title top left (pick a place name) with one short subtitle line.
- A pill toolbar top centre: a `DSLR` toggle (vignette, film grain, slight handheld sway), a `DOF` toggle (bokeh
  depth of field that focuses on what is in the centre), and the scene's four time-of-day presets, which relight the
  whole scene with a smooth blend (sun or moon colour and angle, sky, fog, every light source, emissive glow,
  reflections, particles). Give the buttons the ids `btn-dslr` and `btn-dof`, and give each preset button
  `data-preset="<name>"` with the preset names from the scene brief.
- Drag to look around, mouse wheel to move along the scene's camera path, WASD or arrow keys to walk (Shift faster),
  keys 1 to 4 for the presets, F for depth of field, C for the DSLR look. It must also work on a phone-sized screen.

## Performance

Hold 60 frames per second at 1920x1080 on an RTX 3060.

## Recording hook (required, so both builds are filmed by the same script)

The page must accept `?capture=1`, which stops its own animation loop and hides nothing else, and expose
`window.battle` with these members, all synchronous:

- `ready`: becomes `true` when everything is loaded and the first frame is drawn.
- `setPreset(name, instant)`: switches to one of the four preset names; `instant` skips the blend.
- `setToggle(name, value)`: `name` is `dof` or `dslr`.
- `placeCamera(progress, lateral, { yawOffset, pitch })`: puts the camera on the scene's camera path (defined in
  the scene brief), looking forward along it. `progress` 0 is the start of the path and 1 the end; `lateral` is a
  sideways offset in metres; `yawOffset` and `pitch` are radians added to the forward view.
- `step(deltaTime, count)`: advances all animation by `deltaTime` seconds `count` times and renders each frame.

## Verify on the rendered page yourself

Serve the app on your port. Use Playwright from `playwright`
(headless Chromium with the GPU: `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`). Take 1920x1080
screenshots of each preset with DOF on and off at progress 0, 0.5 and 1 into `shots/`, look at every one and fix what
looks wrong (floating or intersecting objects, z-fighting, stretched textures, banding, black or blown-out presets,
UI overlap, broken hook). Measure the frame rate at 1920x1080 and write the number in the README.

## Rules

- No hand edits: you write and fix everything yourself.
- Nothing is published or posted, no paid APIs, no secrets.
- Code uses full descriptive names, one statement per line, small functions.
- Write `README.md`: how to build the assets, run the scene, what was built, measured frame rate, honest gaps.
- Write the current UTC time to `started_at.txt` first and to `finished_at.txt` last.
- Stop the server, Blender and browser processes you started when you finish.
- Stop when you judge the scene finished. Report what you built, the time it took, and the honest gaps.

## Prompt 1 brief: onsen.md

# Scene: hot spring in the snowy mountains

Read `benchmarks/battle-1015/COMMON.md` first, completely; it holds the method, UI, hook and rules. This file is the scene.

**Scene.** An outdoor hot spring (rotenburo) beside a small wooden ryokan in the mountains in winter. A rock-edged pool
of clear, slightly green-tinted hot water steams thickly; snow lies on the rocks, on the pine branches and on the
roofs, and snow is falling. A lit stone lantern (toro) stands at the pool edge, a bamboo spout pours water into the
pool, a wooden deck with a few wooden buckets leads to the ryokan, whose paper-screen windows glow warm. Snowy
mountains and pines fade into the haze behind. The mood is quiet and warm against the cold, like a travel photograph.

**Presets** (names exactly): `morning` (bright cold light, blue shadows on snow), `golden` (low warm sun on the
peaks), `blue` (blue hour, lantern and windows glowing), `night` (dark, moon and warm lights only, steam lit by the
lantern; still readable).

**Camera path** for the hook and the mouse wheel: at eye level, from the far side of the pool (progress 0, ryokan
across the water) around the pool edge to the ryokan deck (progress 1).

## Prompt 2 (second pass, both models, resumed in the same conversation)

Starter line: "Second pass. Follow benchmarks/battle-1015/PASS2.md exactly (read it, then benchmarks/battle-1015/feedback/onsen-<model>.md, completely). Same project folder and port as before."

The pass 2 text is in `design/PASS2.md`. The per-model feedback was written by the owner after watching both builds: `design/feedback-pass2-opus.md` and `design/feedback-pass2-argon.md`.
