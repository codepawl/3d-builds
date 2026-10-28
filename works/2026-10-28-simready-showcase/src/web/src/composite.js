// One full-screen shader mixes three looks of the same frame: the raw PBR render, the ASCII pass and a 1-bit
// ordered Bayer dither. A wipe edge decides which side shows which look, and a thin band of the raw render rides the edge.
import * as THREE from 'three';

const displayColor = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
export const INK = displayColor(0xe9e5d8);
export const BACKGROUND = displayColor(0x0b0b0d);
export const DITHER_CELL_PX = 3;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BAYER = /* glsl */ `
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tRaw;
uniform sampler2D tAscii;
uniform vec2 uScreen;
uniform float uCellPx;
uniform float uExposure;
uniform vec3 uInk;
uniform vec3 uBackground;
uniform float uWipeMode;
uniform vec2 uWipePoint;
uniform vec2 uWipeDirection;
uniform float uWipeRadius;
uniform float uBandHalfWidth;
uniform float uFlip;
varying vec2 vUv;
${BAYER}

vec3 acesFilm(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toDisplay(vec3 linearColor) { return pow(acesFilm(linearColor * uExposure), vec3(1.0 / 2.2)); }
float lumaOf(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  float edgeDistance = uWipeMode < 0.5 ? dot(pixel - uWipePoint, uWipeDirection) : length(pixel - uWipePoint) - uWipeRadius;

  vec3 rawColor = uBackground + toDisplay(texture2D(tRaw, vUv).rgb) * (1.0 - uBackground);

  vec2 cell = floor(pixel / uCellPx);
  vec2 cellCenter = (cell + 0.5) * uCellPx;
  vec2 cellUv = vec2(cellCenter.x / uScreen.x, 1.0 - cellCenter.y / uScreen.y);
  vec2 quarter = vec2(uCellPx * 0.3) / uScreen;
  vec3 cellRaw = 0.25 * (texture2D(tRaw, cellUv + vec2(quarter.x, quarter.y)).rgb + texture2D(tRaw, cellUv + vec2(-quarter.x, quarter.y)).rgb
    + texture2D(tRaw, cellUv + vec2(quarter.x, -quarter.y)).rgb + texture2D(tRaw, cellUv + vec2(-quarter.x, -quarter.y)).rgb);
  float cellLuma = smoothstep(0.03, 0.92, lumaOf(toDisplay(cellRaw)) * 1.12);
  float threshold = bayer8(cell);
  vec3 ditherColor = mix(uBackground, uInk, step(threshold + 0.02, cellLuma));

  float asciiLuma = lumaOf(texture2D(tAscii, vUv).rgb);
  vec3 asciiColor = mix(uBackground, uInk, clamp(asciiLuma * 1.15, 0.0, 1.0));

  // The Space key swaps which side is ASCII; the swap dissolves cell by cell through the same Bayer matrix.
  bool flipped = threshold < uFlip;
  float asciiSide = flipped ? 1.0 - step(0.0, edgeDistance) : step(0.0, edgeDistance);
  vec3 sideColor = mix(ditherColor, asciiColor, asciiSide);
  float rawAmount = 1.0 - smoothstep(uBandHalfWidth - 3.0, uBandHalfWidth + 5.0, abs(edgeDistance));
  gl_FragColor = vec4(mix(sideColor, rawColor, rawAmount), 1.0);
}
`;

const DISSOLVE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform float uAmount;
uniform float uCellPx;
uniform vec2 uScreen;
varying vec2 vUv;
${BAYER}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  float threshold = bayer8(floor(pixel / uCellPx));
  gl_FragColor = threshold < uAmount ? texture2D(tTo, vUv) : texture2D(tFrom, vUv);
}
`;

function makeFullScreenPass(renderer, fragmentShader, uniforms) {
  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    material,
    draw(target) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    },
  };
}

export class Compositor {
  constructor(renderer, width, height) {
    this.screen = new THREE.Vector2(width, height);
    this.composite = makeFullScreenPass(renderer, COMPOSITE_FRAGMENT, {
      tRaw: { value: null },
      tAscii: { value: null },
      uScreen: { value: this.screen },
      uCellPx: { value: DITHER_CELL_PX },
      uExposure: { value: 1.0 },
      uInk: { value: INK },
      uBackground: { value: BACKGROUND },
      uWipeMode: { value: 0 },
      uWipePoint: { value: new THREE.Vector2() },
      uWipeDirection: { value: new THREE.Vector2(1, 0) },
      uWipeRadius: { value: 0 },
      uBandHalfWidth: { value: 30 },
      uFlip: { value: 0 },
    });
    this.dissolve = makeFullScreenPass(renderer, DISSOLVE_FRAGMENT, {
      tFrom: { value: null },
      tTo: { value: null },
      uAmount: { value: 0 },
      uCellPx: { value: DITHER_CELL_PX },
      uScreen: { value: this.screen },
    });
  }

  /** wipe: { mode: 'line' | 'radial', point: [x, y] px, direction: [x, y], radius, bandHalfWidth } */
  mix(rawTexture, asciiTexture, wipe, flipAmount, target) {
    const uniforms = this.composite.material.uniforms;
    uniforms.tRaw.value = rawTexture;
    uniforms.tAscii.value = asciiTexture;
    uniforms.uWipeMode.value = wipe.mode === 'radial' ? 1 : 0;
    uniforms.uWipePoint.value.set(wipe.point[0], wipe.point[1]);
    const direction = wipe.direction ?? [1, 0];
    const length = Math.hypot(direction[0], direction[1]) || 1;
    uniforms.uWipeDirection.value.set(direction[0] / length, direction[1] / length);
    uniforms.uWipeRadius.value = wipe.radius ?? 0;
    uniforms.uBandHalfWidth.value = wipe.bandHalfWidth ?? 30;
    uniforms.uFlip.value = flipAmount;
    this.composite.draw(target);
  }

  /** Dither dissolve from one finished frame to another; amount 0 shows `from`, 1 shows `to`. */
  blend(fromTexture, toTexture, amount, target = null) {
    const uniforms = this.dissolve.material.uniforms;
    uniforms.tFrom.value = fromTexture;
    uniforms.tTo.value = toTexture;
    uniforms.uAmount.value = amount;
    this.dissolve.draw(target);
  }
}
