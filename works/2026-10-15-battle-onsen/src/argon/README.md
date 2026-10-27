# Hakugin Onsen (白銀の湯) — Winter Mountain Rotenburo

An interactive 3D WebGL scene depicting a traditional Japanese outdoor hot spring (*rotenburo*) beside a wooden *sukiya-zukuri* ryokan in the snowy mountains during winter.

---

## 1. How to Build the Assets

All 3D geometry and procedural PBR textures are generated headlessly via Python scripts in Blender 5.2 (`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"`). Always run Blender jobs **one at a time** at `BelowNormal` process priority from the project root (`battle-onsen-argon`):

```powershell
$blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"

foreach ($script in @(
  "blender/build_pool_and_terrain.py",
  "blender/build_ryokan.py",
  "blender/build_props.py",
  "blender/build_pines.py"
)) {
  $proc = Start-Process -FilePath $blender -ArgumentList "--background","--python",$script -NoNewWindow -PassThru
  $proc.PriorityClass = 'BelowNormal'
  $proc.WaitForExit()
}
```

### Generated GLB Models (`public/models/`)
- `onsen_pool_and_terrain.glb` (~8.18 MB) — Organic stone-rimmed pool basin (`PoolBasinFloor`), submerged river stones, 56 fractured volcanic boulders (`PoolEdgeBoulders`) with draped polar-grid snow caps (`PoolBoulderSnowCaps`), wet garden stepping stones (`GardenSteppingStones`), sculpted snowdrifts (`SnowGroundNear`), and a 360° alpine mountain amphitheater (`SnowyMountainRange`).
- `ryokan_and_deck.glb` (~5.09 MB) — Elevated hinoki cypress veranda (`RyokanHinokiDeck`) and steps, dark cedar post-and-beam ryokan architecture (`RyokanCedarTimber`), warm cream plaster walls (`RyokanPlasterWalls`), 5 multi-pane glowing shoji doors with fine *kumiko* lattice (`ShojiGlowingScreens`), pitched kawara tiled main roof and engawa eaves (`RyokanTiledRoofs`, `RyokanRoofRafters`) with thick snow blankets (`RyokanRoofSnowBlanket`) and translucent hanging icicles (`RyokanEavesIcicles`), hanging wooden *andon* lantern (`EavesAndonFrame`, `EavesAndonGlow`), and tied bamboo privacy fence (`BambooPrivacyFence`, `FenceHempTwine`, `FenceTopSnow`).
- `onsen_props.glb` (~3.15 MB) — Two carved granite *yukimi-doro* snow-viewing and pedestal stone lanterns (`StoneLanternBody`, `StoneLanternGlowCore`, `StoneLanternSnowCap`), weathered bamboo water spout (`KakehiBambooSpout`, `KakehiHempBindings`, `KakehiSnowCap`), four hinoki bath buckets (`HinokiBuckets_Oke`) with copper hoops (`BucketCopperBands`) and green-tinted hot spring water (`BucketHotWater`), bath stools (`HinokiBathStools_Isu`), and folded cotton bath towels (`FoldedOnsenTowels`).
- `winter_pines.glb` (~8.65 MB) — Two gnarled lakeside Japanese black pines (*kuromatsu*) leaning over the pool and 43 mountain conifers built with crooked multi-segment branches, fine needle bough clusters, and draped branch snow pillows (`PineTrunksAndBranches`, `PineFoliageClusters`, `PineBranchSnowCushions`).
- **Total GLB footprint**: **25.07 MB** (within the 30 MB budget).

---

## 2. How to Run the Scene

From `battle-onsen-argon`:

```powershell
npm.cmd run serve
```

This starts the zero-dependency static HTTP server (`server.mjs`) on **`http://127.0.0.1:5506`**.

### Controls
- **Mouse Drag / Touch Drag**: Look around (`yaw` and `pitch`).
- **Scroll Wheel**: Move smoothly along the curated camera path (`progress` `0 → 1`) from the north bank of the pool (`0.0`), curving along the western stone path (`0.5`), onto the western corner of the ryokan's wooden *engawa* deck (`0.75`), and along the veranda overlooking thebamboo spout, stone lantern, pool, and snowy pines (`1.0`).
- **WASD / Arrow Keys / Two-Finger Touch Drag**: Walk forward/backward along the path and strafe laterally (`[-0.45m, +0.45m]`) with subtle footsteps bobbing.
- **`1`–`4` Keys or Toolbar Buttons**: Smoothly transition between **Morning**, **Golden**, **Blue**, and **Night** lighting presets.
- **`F` Key or `DOF` Button**: Toggle shared autofocus bokeh Depth of Field (`look.setDof`).
- **`C` Key or `DSLR` Button**: Toggle shared DSLR lens optics and ACES/filmic grading (`look.setDslr`).

### Shared Look (`src/battle-look.js`) & Automation Hook (`window.battle`)
The scene uses `three@0.180.0` (`WebGLRenderer({ antialias: false })`) and renders every frame through `createBattleLook({ renderer, scene, camera })` from `src/battle-look.js`. Opening `http://127.0.0.1:5506/?capture=1` disables the internal `requestAnimationFrame` loop for deterministic external driving:
- `window.battle.ready`: `true` once all 4 GLB models and shaders are compiled and the first frame has rendered.
- `window.battle.setPreset(name, instant)`: Switches between `'morning' | 'golden' | 'blue' | 'night'`.
- `window.battle.setToggle(name, value)`: Toggles `'dof'` (`look.setDof`) or `'dslr'` (`look.setDslr`).
- `window.battle.placeCamera(progress, lateral, { yawOffset, pitch })`: Deterministically positions and orients the camera along the spline.
- `window.battle.step(deltaTime, count)`: Advances all simulations (water ripples, spout stream, rising steam, falling snowflakes, wind sway, lantern flicker) and renders synchronously via `look.render(dt)`.

---

## 3. Measured Frame Rate (1920×1080)

Measured in headless Chromium with hardware D3D11 ANGLE GPU acceleration (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`, NVIDIA GeForce RTX 3060) at `1920×1080` (`devicePixelRatio = 1`) with shared `battle-look.js` (`DSLROn + DOFOn` + SMAA):

- **Live `requestAnimationFrame` loop**: **60.4 FPS** (`121` frames over `2.00 s`, vsync-locked at 60 Hz).
- **Synchronous `window.battle.step(1/60, 180)`**: **13.57 ms per frame** (**73.7 FPS** uncapped throughput with full post-processing pipeline).
- **Console errors / WebGL warnings**: **0**.

---

## 4. Honest Gaps & Trade-offs

- **Screen-Space Reflections vs. Analytic Sky/Lantern Reflections**: Rather than rendering a second planar reflection pass of the full scene geometry, the hot spring water shader combines multi-layered Gerstner-style wave normals and concentric spout ripples with analytic Fresnel sky-dome reflection, warm point-light specular reflections from the shoji and stone lanterns, and depth-based mineral green-teal absorption over the sculpted basin stones.
- **Distance-Based Foliage Subdivision**: To keep `winter_pines.glb` at 8.65 MB (total project GLB size 25.07 MB < 30 MB), the two foreground lakeside *kuromatsu* pines use higher-subdivision needle tufts and snow pillows (`subdivisions=2`, `rings=4, segments=12`), while the 43 hillside conifers step down in subdivision count by distance from the pool.
- **Billboard Steam**: Steam is rendered using 220 low-hovering camera-facing instanced billboards with procedural FBM noise and warm point-light scattering rather than a raymarched 3D fluid volume.
