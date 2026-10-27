# Fixing the jitter in pixel-on-3D dioramas

A small camera module for three.js that stops pixels from crawling when you render a 3D scene at low resolution and upscale it. The camera snaps to the texel grid.

- Post: https://x.com/anxuanng/status/2114775030710338042  (the video that taught the technique, by Red Giraffe, is linked in a reply: https://x.com/anxuanng/status/2114776119778197861)
- Made with: Claude Opus 5.5 in Claude Code, three.js 0.186.1 (the test page needs it through an import map)

## How it was made
1. An sent a video about the technique and asked to apply it to the pixel dioramas and write a post about solving the jitter (see prompts.md).
2. The video was watched and its method was written into `src/pixel-camera.js`.
3. A test page (`src/test/`) moves the camera and objects in several modes. `src/record.mjs` records it, and `src/tools_smoothness.py` and `src/tools_summarize.py` measure how much the image crawls between frames.
4. The module then went into the container port and the other pixel dioramas.

## Run it
`src/test/index.html` resolves `three` through an import map. Serve the folder and open it:
```
uv run --no-project python -m http.server 8080 --directory src
```
Open http://localhost:8080/test/index.html. The page draws nothing by itself (it is driven by the recorder): type `renderAt(3)` in the browser console, with any time from 0 to `DURATION` seconds, and add `?preset=A` to `?preset=Cdither` to switch the mode. The page uses the three.js copy in `src/three/three.module.js` (r170, MIT). Edit the import map if you keep three.js somewhere else.

## Design
The scene renders into a small target (for example 320x180) with an orthographic camera, then a composite pass upscales it with square pixels. Pixels crawl when static geometry lands in different texels from one frame to the next. The fix has three parts.

1. Snap the camera. Round the camera target to a multiple of one texel in the camera's own right and up directions. Static geometry then always rasterizes into the same texels.
```js
const rightAmount = target.dot(this.right);
const upAmount = target.dot(this.up);
deltaRight = (Math.round(rightAmount / texelWorld) * texelWorld - rightAmount) / texelWorld;
deltaUp = (Math.round(upAmount / texelWorld) * texelWorld - upAmount) / texelWorld;
snapped.addScaledVector(this.right, deltaRight * texelWorld).addScaledVector(this.up, deltaUp * texelWorld);
```
2. Put the remainder back. The rounding moves the view by less than one texel. The composite pass shifts the upscaled image by that remainder, rounded to whole output pixels, so the view still glides (`offset: 'pixel'`). Other modes are `'none'` (the view steps one texel at a time) and `'subtexel'` (a one-pixel anti-aliased edge).
3. Snap moving objects. A vehicle that moves smoothly also shimmers, so round its position to the same grid in the camera plane. Depth is left alone.
```js
snapPosition(position, output = new THREE.Vector3()) {
  output.copy(position);
  if (!this.mode.objectSnap) return output;
  const rightAmount = position.dot(this.right);
  const upAmount = position.dot(this.up);
  const rightDelta = Math.round(rightAmount / this.texelWorld) * this.texelWorld - rightAmount;
  const upDelta = Math.round(upAmount / this.texelWorld) * this.texelWorld - upAmount;
  return output.addScaledVector(this.right, rightDelta).addScaledVector(this.up, upDelta);
}
```
Zoom has its own rule. Changing the texel size every frame re-rasterizes everything and crawls. With `zoom: 'hold'` the texel size stays fixed and the zoom happens in output space. Orbiting cannot be snapped, because texels cross the grid, so while `view.rotating` is true you can blur, coarsen or dither the upscale.

Usage:
```js
const pixelCamera = new PixelCamera(renderer, { lowWidth: 320, lowHeight: 180, outputWidth: 1280, outputHeight: 720,
  baseTexelWorld: 0.125, zoomMin: 1, mode: { snap: true, offset: 'pixel', zoom: 'hold' } });
pixelCamera.prepare({ target, azimuth, elevation, distance, zoom, rotating });
vehicle.position.copy(pixelCamera.snapPosition(truePosition, scratchVector));
pixelCamera.render(scene);
```

## Assets and credits
- The technique follows a video by Red Giraffe (https://youtu.be/Ua2EXkOmrpA). The code is our own.
- No model, texture or sound is used. The poster is a frame from the container port build.

## Prompts
See prompts.md.
