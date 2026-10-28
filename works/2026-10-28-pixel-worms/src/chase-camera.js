// Third-person perspective camera that renders to a small target and upscales it with nearest filtering, so pixels stay
// square. There is no texel snapping (that only works for an orthographic camera); the look comes from the low resolution,
// a depth-based outline, ordered-dither colour quantising and the toon shading in the scene.
import * as THREE from 'three';

const NEAR = 0.5;
const FAR = 450;

const compositeVertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const compositeFragmentShader = `
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uLowSize;
uniform vec2 uOutputSize;
uniform float uDitherLevels;
uniform float uOutlineStrength;

float linearDepth(vec2 texel) {
  float d = texture2D(uDepth, (texel + 0.5) / uLowSize).r;
  return ${NEAR.toFixed(2)} * ${FAR.toFixed(1)} / (${FAR.toFixed(1)} - d * (${FAR.toFixed(1)} - ${NEAR.toFixed(2)}));
}

float bayer4(vec2 pixel) {
  vec2 cell = mod(floor(pixel), 4.0);
  float index = cell.x + cell.y * 4.0;
  float values[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (values[int(index)] + 0.5) / 16.0 - 0.5;
}

// Worm pixels carry alpha 0.5 (see addGlint); everything else is opaque. The mask keeps worms out of the quiet-world grade
// and the dither, and gives them their own, finer outline test.
float wormMask(vec2 texel) {
  return texture2D(uColor, (texel + 0.5) / uLowSize).a < 0.75 ? 1.0 : 0.0;
}

// Quiet world: pale, low-saturation colours, with reds and oranges (wood, roofs, pumpkins, pigs) grey-beige so the
// wine-red worms are the only strong red in the frame.
vec3 quietWorld(vec3 color) {
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  float warm = smoothstep(0.0, 0.06, color.r - max(color.g, color.b));
  float keep = mix(0.5, 0.2, warm);
  vec3 grey = vec3(luminance);
  vec3 quiet = mix(grey, color, keep);
  return mix(quiet, vec3(1.0), 0.1) * 0.97 + vec3(0.03);
}

void main() {
  vec2 texel = floor(gl_FragCoord.xy / (uOutputSize / uLowSize));
  vec4 sampled = texture2D(uColor, (texel + 0.5) / uLowSize);
  vec3 color = sampled.rgb;
  float isWorm = sampled.a < 0.75 ? 1.0 : 0.0;
  float here = linearDepth(texel);
  vec2 offsets[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  float nearest = 1e6;
  float nearestWorm = 1e6;
  for (int index = 0; index < 4; index++) {
    float neighbour = linearDepth(texel + offsets[index]);
    nearest = min(nearest, neighbour);
    if (wormMask(texel + offsets[index]) > 0.5) nearestWorm = min(nearestWorm, neighbour);
  }
  if (isWorm < 0.5) color = quietWorld(color);
  // Worms stay bright and red at a distance: lift them as the fog and the pull-back make them small.
  color *= 1.0 + isWorm * (0.3 + 0.35 * smoothstep(20.0, 75.0, here));
  // A texel with a clearly nearer neighbour is darkened, so a 1 texel outline hugs the outside of every silhouette.
  // A nearer worm gets a finer threshold, so worms outline against the ground and against each other.
  float fade = smoothstep(35.0, 110.0, nearest);
  if (nearest < here - (0.05 * here + 0.12)) {
    color *= mix(uOutlineStrength, 1.0, fade);
  } else if (nearestWorm < here - (0.006 * here + 0.025)) {
    color *= mix(0.78, 1.0, smoothstep(12.0, 50.0, nearestWorm));
  }
  // Quantise to flat tones; dither only in the fog, never on worms.
  if (uDitherLevels > 0.0) {
    float ditherAmount = (1.0 - isWorm) * smoothstep(45.0, 115.0, here);
    color = floor(color * uDitherLevels + 0.5 + bayer4(texel) * ditherAmount) / uDitherLevels;
  }
  gl_FragColor = vec4(color, 1.0);
}`;

export class ChaseCamera {
  constructor(renderer, options) {
    this.renderer = renderer;
    this.lowWidth = options.lowWidth;
    this.lowHeight = options.lowHeight;
    this.outputWidth = options.outputWidth;
    this.outputHeight = options.outputHeight;
    this.colorTarget = new THREE.WebGLRenderTarget(this.lowWidth, this.lowHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.colorTarget.depthTexture = new THREE.DepthTexture(this.lowWidth, this.lowHeight);
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 54, this.outputWidth / this.outputHeight, NEAR, FAR);
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: compositeVertexShader,
        fragmentShader: compositeFragmentShader,
        uniforms: {
          uColor: { value: this.colorTarget.texture },
          uDepth: { value: this.colorTarget.depthTexture },
          uLowSize: { value: new THREE.Vector2(this.lowWidth, this.lowHeight) },
          uOutputSize: { value: new THREE.Vector2(this.outputWidth, this.outputHeight) },
          uDitherLevels: { value: options.ditherLevels ?? 20 },
          uOutlineStrength: { value: options.outlineStrength ?? 0.32 },
        },
        depthTest: false,
      }),
    ));
    this.scratch = new THREE.Vector3();
  }

  // Play fits the picture to the window: low-resolution size, output size (low size times the pixel scale) and vertical field of view.
  resize(lowWidth, lowHeight, outputWidth, outputHeight, fov) {
    this.lowWidth = lowWidth;
    this.lowHeight = lowHeight;
    this.outputWidth = outputWidth;
    this.outputHeight = outputHeight;
    this.colorTarget.setSize(lowWidth, lowHeight);
    const uniforms = this.compositeScene.children[0].material.uniforms;
    uniforms.uLowSize.value.set(lowWidth, lowHeight);
    uniforms.uOutputSize.value.set(outputWidth, outputHeight);
    this.camera.fov = fov;
    this.camera.aspect = outputWidth / outputHeight;
    this.camera.updateProjectionMatrix();
  }

  place(position, lookAt) {
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
  }

  // Output pixels (y down) to a world ray: { origin, direction }.
  rayThrough(pixelX, pixelY) {
    const ndcX = (pixelX / this.outputWidth) * 2 - 1;
    const ndcY = 1 - (pixelY / this.outputHeight) * 2;
    const point = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    const direction = point.sub(this.camera.position).normalize();
    return { origin: this.camera.position.clone(), direction };
  }

  // World point to output pixels. `behind` is true when the point is behind the camera.
  project(x, y, z) {
    this.scratch.set(x, y, z);
    const viewZ = this.scratch.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    const behind = viewZ > 0;
    const ndc = this.scratch.project(this.camera);
    return { x: (ndc.x * 0.5 + 0.5) * this.outputWidth, y: (0.5 - ndc.y * 0.5) * this.outputHeight, behind };
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
