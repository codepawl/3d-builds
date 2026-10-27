# Shirayu Onsen

A rotenburo (outdoor hot spring) beside a small wooden ryokan in the winter mountains, rendered live with three.js.
Every model and texture is built procedurally by Blender Python scripts in `blender/`. Nothing is downloaded.

## Build the assets

```
npm install
npm run build:assets
```

`tools/build-assets.mjs` runs Blender 5.2 headless (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, or
set `BLENDER_PATH`) at below-normal priority on `blender/build_assets.py`. It writes to `public/assets/`:

| File | Size | Contents |
| --- | --- | --- |
| `site.glb` | 11.3 MB | ground, pool rocks with snow shells, ryokan, deck, props, lantern, spout, fence, shrubs |
| `pines.glb` | 2.4 MB | four pine variants (two near, one far, one distant) for instancing |
| `mountains.glb` | 7.4 MB | a ring of ridged peaks from 140 m to 1.4 km |
| `layout.json` | small | water level, pool outline, camera path, light positions, pine transforms |

The textures are generated with numpy and packed into the GLBs, along with their normal maps. They cover wood grain,
stone, plaster, shoji paper, roof tiles, bark, bamboo and snow, plus a fir frond atlas with an alpha mask
(`blender/foliage_textures.py`). Materials are PBR: base colour times vertex colour, roughness, a normal map, and
emission for the shoji and the lantern.

## Run

```
npm run serve
```

Then open http://localhost:5505. Any static server works; `tools/serve.mjs` is a small one with no dependencies.
three is pinned to exactly 0.180.0 and loaded from `node_modules` through an import map (`three` and
`three/addons/`). The page makes no external requests.

Controls:
- Drag to look.
- Use the mouse wheel to move along the camera path.
- Walk with WASD or the arrow keys; Shift is faster.
- Press 1 to 4 for the presets, F for depth of field and C for the DSLR look.
- On a phone, drag with one finger to look and use two fingers to move along the path.

`?capture=1` stops the page's own animation loop. `window.battle` drives the scene synchronously: `ready`,
`setPreset(name, instant)`, `setToggle("dof" | "dslr", value)`, `placeCamera(progress, lateral, { yawOffset, pitch })`
and `step(deltaTime, count)`. `window.sceneDebug` exposes the renderer, scene, camera, lights, steam and water to the
measurement tools.

## Pass 2

The second pass moved the scene onto the shared look and fixed the feedback on pass 1.

- **Shared look.**
  - `src/battle-look.js` is the benchmark's file, copied byte for byte.
  - Every frame renders through `look.render(deltaTime)`, including frames from `battle.step`, and resizing goes
    through `look.setSize`.
  - The DOF and DSLR buttons, the F and C keys and `setToggle` call `look.setDof` and `look.setDslr`. Both start on.
  - My own post-processing (`src/post.js`) and handheld sway are gone, and the renderer is created with
    `antialias: false`.
  - Steam and the far forest skip the look's override-material passes (ambient occlusion, depth of field and the
    focus probe), which would otherwise draw their quads as solid surfaces.
- **The pool is the subject.**
  - The steam was rewritten as 120 thin wisps and 22 low mist sheets. Each wisp is a vertical billboard of
    domain-warped noise inside a soft envelope, and the wisps leave gaps that the water, the toro and the ryokan
    show through.
  - The camera aims at a point inside the pool. Over the last 40% of the walk, that point slides towards the ryokan.
  - The deck was extended east and the path now ends on it. The night view ends with the pool on the left and the
    lit ryokan on the right, not on the fence.
- **Sky.**
  - A drifting cloud layer is lit through towards the sun, has a silver lining and fades into the horizon.
  - The sun and moon move with each preset. In the morning the sun is low in the east (azimuth 105°, 20° up). At
    golden hour it is low in the west, at blue hour just under the horizon, and at night the moon is high.
- **Real foliage.**
  - The pines are needle fronds on tiers around a dark core. The fronds are alpha-tested cards with alpha to coverage,
    snowy on their upper side, with snow clumps added. The shrubs use the same fronds.
  - The far forest is split into 16 sectors and two distance bands, so whole chunks can be culled. It is left out of
    the water reflection.
- **Weather on surfaces.**
  - Per-pixel shaders in `src/surface-snow.js` put snow on upward-facing stone and keep it bare near the hot water.
  - The open deck is wet and glossy, with snow drifting along its outer edges. The planks under the eaves stay dry.
  - The rocks carry thin snow shells on top instead of lids.
- **Shadows and haze.**
  - The sun's PCF shadows are rendered again only when a preset is applied, since nothing that casts them moves.
  - The shared look's ambient occlusion supplies the contact shadows.
  - Each preset sets the fog colour and density, and the mountains get extra aerial haze.
- **Motion.** The water has waves and spout ripples, the steam rises and drifts, the snow falls, and the pines sway.

## What was built in pass 1

- **Site.**
  - An oval pool edged with cleaved boulders and flat stepping stones, with more stones under the water. The stones
    are wet near the waterline.
  - A cedar deck with buckets, a stool, a bench, a towel and geta leads to a two-storey ryokan.
  - The ryokan has an engawa and posts, shoji bays and a noren entrance. Its upper floor has a railing, a paper
    lantern and two hipped tile roofs, with snow rolls along the eaves and icicles.
  - The site also has a kasuga-style stone toro, a bamboo kakei spout on a crossed support, a bamboo fence and snowy
    shrubs.
  - The pines are instanced: 30 near and 900 far. The mountains fade into haze.
- **Water.** A half-resolution planar reflection with an oblique clip plane, wave normals, ripples where the spout
  lands, Fresnel and a green tint that deepens with depth.
- **Snow, spout and wind.**
  - 9,000 falling flakes (14,000 in pass 1), lit by the lantern and the windows.
  - The spout is a stream with a splash.
  - The pines sway in the wind in their vertex shader.
- **Lighting.**
  - The sun or moon casts the shadows.
  - Each preset sets a hemisphere light, a gradient sky with a sun disc, moon and stars, and a PMREM environment taken
    from that sky.
  - The lantern, the paper lantern and one light behind the shoji are point lights that flicker. The other shoji
    glow through their emission.
  - The four presets blend over 2.6 s.
- **Camera path.** It runs at eye level from the far side of the pool around its east edge to the ryokan deck.

## Verification

`npm run shots` saves 34 screenshots at 1920x1080 to `shots/pass2/`:

- each preset, DOF on and off, at progress 0, 0.5 and 1, with DSLR on;
- the five path points (progress 0, 0.25, 0.5, 0.75 and 1) at the extremes of the recording:
  - golden, with 0.45 m of drift to the left and 0.14 rad of yaw;
  - night, with the same to the right.

The pass 1 shots stay in `shots/`.

All shots were taken in headless Chrome with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. Playwright comes
from `playwright`. Its bundled Chromium was missing on this machine, so the
tools launch the installed Chrome (set `CHROME_PATH` to override).

I compared each set by eye against how a photograph of the place would look and fixed what I saw over several
rounds. The last run had no console errors.

## Measured frame rate

`npm run fps` uses headless Chrome on an RTX 3060 (D3D11) at 1920x1080. Each case is timed two ways:

- Wall time: frames rendered through `battle.step`, each forced to finish with a one-pixel readback.
- GPU time: the same frames timed on the GPU with `EXT_disjoint_timer_query_webgl2`.

`tools/profile-parts.mjs` switches parts of the scene off one at a time to find what costs most.

The last run used 200 frames per case. Another session's headless browser kept the GPU 40–60% busy during it, so the
numbers are higher than on an idle GPU.

| Case | GPU median | Wall median |
| --- | --- | --- |
| progress 0.5 and 1, DOF and DSLR off | 10.5–11.7 ms | 13.5–17.1 ms |
| progress 0.5 and 1, DOF and DSLR on (night) | 14.9–17.0 ms | 15.8–18.5 ms |
| progress 0, all cases | 15.3–23.7 ms | 20.1–36.6 ms |

The progress 0 numbers came during a burst from that other job. In the run just before, progress 0 measured 10.9–16.0
ms of GPU median.

With the shared look's DOF on, the frame sits at or just under the 16.7 ms budget for 60 fps. With DOF off there are
about 5 ms of headroom.

## Honest gaps

- 60 fps with DOF on is marginal. The shared look's focus probe reads pixels back every frame. Its ambient occlusion
  and bokeh passes cost about 3 ms together. I did not get a measurement on an idle GPU or in a visible browser window
  on a 60 Hz display.
- The far pines read as spires with lighter tops. The near pines hold up at mid range but are still cards up close.
- At progress 1 the wet deck fills the lower right of the frame. It reads well at night, when it reflects the lights,
  and plainer in daylight.
- The mountains are a heightfield ring with vertex colour and a stone normal map. They read as grey ridges in the haze
  and lack real rock and snow detail.
- The steam is still billboards, not a volume. From the path it looks right, but from low and close to the water the
  sheets can show.
- The water has no refraction or caustics. Its colour comes from a depth tint.
- WASD can walk off the path. The ryokan blocks you, but the pines and the fence do not.
