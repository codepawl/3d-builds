// Jitter-free pixel camera: an orthographic camera renders the scene at low resolution, then a composite pass
// upscales it to the output size with square pixels.
//
// What keeps pixels from crawling:
//   snap            camera position is rounded to a multiple of one texel in its own right/up plane, so static
//                   geometry rasterises into the same texels every frame.
//   offset          the rounding remainder is put back at output resolution, so the view still glides.
//                   'none'     no offset (view steps one whole texel at a time, blocky)
//                   'pixel'    offset rounded to whole output pixels (hard edges, 1/scale texel steps)
//                   'subtexel' offset kept fractional; the upscale uses a one-output-pixel box filter at texel
//                              edges, so it is anti-aliased there (a hairline of blend, not a blur)
//   zoom            'naive' changes the texel's world size every frame (re-rasterises everything: crawls)
//                   'hold'  texel world size stays fixed, the zoom happens in output space (no re-rasterising)
//                   'steps' texel size changes only on a geometric ladder, output-space zoom in between
//   rotation        orbiting cannot be snapped (texels cross the grid). Mitigations while view.rotating is true:
//                   'none' | 'blur' (soft upscale) | 'boost' (coarser texel) | 'dither' (screen-space ordered dither)
//   snapPosition()  rounds a moving object's position to the same texel grid, in the camera plane only.
//
// Usage (the page must resolve the bare 'three' import, e.g. with an import map):
//   const pixelCamera = new PixelCamera(renderer, { lowWidth: 320, lowHeight: 180, outputWidth: 1280, outputHeight: 720,
//     baseTexelWorld: 0.125, zoomMin: 1, mode: { snap: true, offset: 'pixel', zoom: 'hold' } });
//   pixelCamera.prepare({ target, azimuth, elevation, distance, zoom, rotating });
//   vehicle.position.copy(pixelCamera.snapPosition(truePosition, scratchVector));
//   pixelCamera.render(scene);
import * as THREE from 'three';

const DEFAULT_MODE = {
  snap: true,
  objectSnap: false,
  offset: 'pixel',
  zoom: 'hold',
  rotation: 'none',
  boostFactor: 2,
  blurTexels: 1,
  ditherLevels: 10,
  stepRatio: 1.25,
};

const compositeVertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const compositeFragmentShader = `
precision highp float;
uniform sampler2D uColor;
uniform vec2 uRenderTargetSize;
uniform vec2 uOutputSize;
uniform vec2 uDelta;
uniform float uScale;
uniform float uFilterTexels;
uniform float uDitherLevels;

vec3 fetchTexel(vec2 texel) {
  return texture2D(uColor, (texel + 0.5) / uRenderTargetSize).rgb;
}

// Box filter one filter-width wide, centred on each texel edge. Width 0 is plain nearest-neighbour.
vec3 sampleTexels(vec2 coordinate, float filterWidth) {
  if (filterWidth <= 0.0) return fetchTexel(floor(coordinate));
  vec2 edge = floor(coordinate + 0.5);
  vec2 weight = clamp((coordinate - edge) / filterWidth + 0.5, 0.0, 1.0);
  vec3 lowerLeft = fetchTexel(edge + vec2(-1.0, -1.0));
  vec3 lowerRight = fetchTexel(edge + vec2(0.0, -1.0));
  vec3 upperLeft = fetchTexel(edge + vec2(-1.0, 0.0));
  vec3 upperRight = fetchTexel(edge);
  return mix(mix(lowerLeft, lowerRight, weight.x), mix(upperLeft, upperRight, weight.x), weight.y);
}

float bayer4(vec2 pixel) {
  vec2 cell = mod(floor(pixel), 4.0);
  float index = cell.x + cell.y * 4.0;
  float values[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (values[int(index)] + 0.5) / 16.0 - 0.5;
}

void main() {
  vec2 fromCentre = gl_FragCoord.xy - uOutputSize * 0.5;
  vec2 coordinate = uRenderTargetSize * 0.5 + fromCentre / uScale - uDelta;
  float filterWidth = uFilterTexels > 0.0 ? max(uFilterTexels, 1.0 / uScale) : 0.0;
  vec3 color = sampleTexels(coordinate, filterWidth);
  if (uDitherLevels > 0.0) {
    color = floor(color * uDitherLevels + 0.5 + bayer4(gl_FragCoord.xy)) / uDitherLevels;
  }
  gl_FragColor = vec4(color, 1.0);
}`;

function evenCeil(value) {
  const rounded = Math.ceil(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export class PixelCamera {
  constructor(renderer, options) {
    this.renderer = renderer;
    this.lowWidth = options.lowWidth;
    this.lowHeight = options.lowHeight;
    this.outputWidth = options.outputWidth;
    this.outputHeight = options.outputHeight;
    this.baseTexelWorld = options.baseTexelWorld;
    this.zoomMin = options.zoomMin ?? 1;
    this.mode = { ...DEFAULT_MODE, ...options.mode };
    const margin = options.margin ?? 4;
    // Even texel counts keep the camera centre on a texel corner, so object snapping and camera snapping agree.
    this.targetWidth = evenCeil(this.lowWidth / this.zoomMin + margin * 2);
    this.targetHeight = evenCeil(this.lowHeight / this.zoomMin + margin * 2);

    this.colorTarget = new THREE.WebGLRenderTarget(this.targetWidth, this.targetHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.texelWorld = this.baseTexelWorld;
    this.outputScale = 1;

    this.uniforms = {
      uColor: { value: this.colorTarget.texture },
      uRenderTargetSize: { value: new THREE.Vector2(this.targetWidth, this.targetHeight) },
      uOutputSize: { value: new THREE.Vector2(this.outputWidth, this.outputHeight) },
      uDelta: { value: new THREE.Vector2() },
      uScale: { value: 1 },
      uFilterTexels: { value: 0 },
      uDitherLevels: { value: 0 },
    };
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: compositeVertexShader,
        fragmentShader: compositeFragmentShader,
        uniforms: this.uniforms,
        depthTest: false,
      }),
    ));
  }

  /** The texel world size for this view, before any rotation boost. */
  texelWorldFor(zoom) {
    if (this.mode.zoom === 'naive') return this.baseTexelWorld / zoom;
    if (this.mode.zoom === 'steps') {
      const level = Math.pow(this.mode.stepRatio, Math.floor(Math.log(zoom) / Math.log(this.mode.stepRatio) + 1e-9));
      return this.baseTexelWorld / level;
    }
    return this.baseTexelWorld;
  }

  /** view: { target: Vector3 | [x,y,z], azimuth, elevation, distance, zoom = 1, rotating = false } */
  prepare(view) {
    const zoom = view.zoom ?? 1;
    const target = Array.isArray(view.target) ? new THREE.Vector3(...view.target) : view.target.clone();
    this.direction.set(
      Math.sin(view.azimuth) * Math.cos(view.elevation),
      Math.sin(view.elevation),
      Math.cos(view.azimuth) * Math.cos(view.elevation),
    );
    this.camera.position.copy(target).addScaledVector(this.direction, view.distance);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);

    let texelWorld = this.texelWorldFor(zoom);
    const rotating = Boolean(view.rotating);
    if (rotating && this.mode.rotation === 'boost') texelWorld *= this.mode.boostFactor;
    this.texelWorld = texelWorld;
    // True magnification: output pixels per world unit. The texel's share of it is the output scale.
    const outputPixelsPerWorld = (this.outputWidth / (this.lowWidth * this.baseTexelWorld)) * zoom;
    this.outputScale = texelWorld * outputPixelsPerWorld;

    const snapped = target.clone();
    let deltaRight = 0;
    let deltaUp = 0;
    if (this.mode.snap) {
      const rightAmount = target.dot(this.right);
      const upAmount = target.dot(this.up);
      deltaRight = (Math.round(rightAmount / texelWorld) * texelWorld - rightAmount) / texelWorld;
      deltaUp = (Math.round(upAmount / texelWorld) * texelWorld - upAmount) / texelWorld;
      snapped.addScaledVector(this.right, deltaRight * texelWorld).addScaledVector(this.up, deltaUp * texelWorld);
    }
    if (this.mode.offset === 'none') {
      deltaRight = 0;
      deltaUp = 0;
    } else if (this.mode.offset === 'pixel') {
      deltaRight = Math.round(deltaRight * this.outputScale) / this.outputScale;
      deltaUp = Math.round(deltaUp * this.outputScale) / this.outputScale;
    }
    this.snappedTarget = snapped;

    const halfWidth = (this.targetWidth * texelWorld) / 2;
    const halfHeight = (this.targetHeight * texelWorld) / 2;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(snapped).addScaledVector(this.direction, view.distance);
    this.camera.lookAt(snapped);
    this.camera.updateMatrixWorld();

    let filterTexels = 0;
    if (this.mode.offset === 'subtexel') filterTexels = 1 / this.outputScale;
    if (rotating && this.mode.rotation === 'blur') filterTexels = this.mode.blurTexels;
    this.uniforms.uDelta.value.set(deltaRight, deltaUp);
    this.uniforms.uScale.value = this.outputScale;
    this.uniforms.uFilterTexels.value = filterTexels;
    this.uniforms.uDitherLevels.value = rotating && this.mode.rotation === 'dither' ? this.mode.ditherLevels : 0;
  }

  /** Rounds a position to the texel grid in the camera plane; depth is left alone. Writes into `output`. */
  snapPosition(position, output = new THREE.Vector3()) {
    output.copy(position);
    if (!this.mode.objectSnap) return output;
    const rightAmount = position.dot(this.right);
    const upAmount = position.dot(this.up);
    const rightDelta = Math.round(rightAmount / this.texelWorld) * this.texelWorld - rightAmount;
    const upDelta = Math.round(upAmount / this.texelWorld) * this.texelWorld - upAmount;
    return output.addScaledVector(this.right, rightDelta).addScaledVector(this.up, upDelta);
  }

  render(scene) {
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.clear();
    this.renderer.render(scene, this.camera);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.render(this.compositeScene, this.compositeCamera);
  }
}
