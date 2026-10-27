# Second pass: more real, better models, identical camera look

The owner watched both builds side by side. Both scenes still read as a game or as low quality next to a photograph.
This pass is about two things: the scene must look much more real, and every camera and screen effect must be
exactly the same on both sides so the comparison is only about the scene itself. The rules of `COMMON.md` still
apply (your folder, your port, Blender then three.js, no hand edits, the `window.battle` hook, verification).

## 1. The shared look (required, identical for both models)

- Use three.js exactly `0.180.0` (`npm install three@0.180.0 --save-exact`), with the import map entries `three` and
  `three/addons/` pointing into `node_modules/three`.
- Copy `battle-1015\shared\battle-look.js` into your `src/` folder
  unchanged (byte for byte; it will be checked). Read its header.
- Render every frame with `look.render(deltaTime)` from `createBattleLook({ renderer, scene, camera })`, including
  inside `window.battle.step`. Resize with `look.setSize`. The `DOF` button, the `F` key and
  `window.battle.setToggle('dof', value)` call `look.setDof`; the `DSLR` button, the `C` key and
  `setToggle('dslr', value)` call `look.setDslr`. Both start on.
- Remove all of your own screen-space post-processing: depth of field, bokeh, bloom, glare, SSAO or any ambient
  occlusion pass, FXAA, SMAA, TAA, vignette, grain, chromatic aberration, colour grading passes, lens flares drawn in
  screen space, and your own handheld sway. Create the renderer with `antialias: false` (the look does 4x MSAA).
  The look fixes the vertical field of view at 50 degrees, ACES tone mapping and pixel ratio 1; do not fight them.
- Everything inside the 3D scene stays yours: models, materials and textures, lights, shadows, `toneMappingExposure`
  per preset, sky, clouds, fog and haze, in-scene volumetric light, water, rain, snow, steam, particles, reflections
  (planar or cube), environment maps you generate in code, and emissive glow.

## 2. Look much more real

- Environment: a believable sky with clouds and correct sun or moon position per preset, soft physically plausible
  light, good shadow quality (no blocky or swimming shadows, contact shadows where things touch the ground), depth
  and atmosphere through haze, and surfaces that react to the weather (wet sheen, snow cover, puddles, spray).
- Models: no low-poly or toy look. Real proportions, bevelled edges, enough geometry where the camera gets close,
  irregular natural shapes for rocks, trees and terrain, real foliage (leaf clusters, not slabs or cones), small
  props that sell the place. Materials with real variation: generated colour, roughness and normal detail, dirt,
  wear, moss, no flat single-colour surfaces.
- Motion: water, rain, snow, steam, leaves and foliage move believably.

## 3. The camera path must show the subject

The recording walks the path from progress 0 to 1 at eye height, with a sideways drift of up to 0.45 m and a yaw
sway of up to 0.14 rad. At every point along the path the scene's subject named in your scene brief must be in view
and clear, with nothing blocking the lens. Check this with screenshots at progress 0, 0.25, 0.5, 0.75 and 1.

## 4. What the owner saw in your build

Your own notes are in the file `benchmarks/battle-1015/feedback/<your scene>-<your model>.md`. Fix every point there.

## 5. Verify and finish

Write the UTC time to `pass2_started_at.txt` first and `pass2_finished_at.txt` last. Redo the screenshots of
`COMMON.md` (four presets, DOF on and off) plus the five path points above into `shots/pass2/`, look at every one
next to what a real photograph of this place would look like, and keep iterating until it is genuinely close.
Measure the frame rate again. Update the README. Stop every server, Blender and browser process you started.
Report what changed, the measured frame rate and the honest remaining gaps.
