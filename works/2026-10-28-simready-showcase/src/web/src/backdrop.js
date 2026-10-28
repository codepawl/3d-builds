// The dithered, ASCII backdrop: a 1-bit ordered Bayer floor and wall plus a field of glyphs, drawn on its own canvas
// behind the clean model canvas. The models are never in this pass, so they cannot be dithered or turned into glyphs.
import * as THREE from 'three';

const GLYPHS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
const ATLAS_CELL_WIDTH = 32;
const ATLAS_CELL_HEIGHT = 56;
export const ASCII_CELL = { width: 14, height: 26 };
export const DITHER_CELL_PX = 3;

function buildGlyphAtlas(fontFamily) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_CELL_WIDTH * GLYPHS.length;
  canvas.height = ATLAS_CELL_HEIGHT;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = `700 50px ${fontFamily}, Consolas, monospace`;
  context.textAlign = 'center';
  GLYPHS.forEach((glyph, index) => context.fillText(glyph, index * ATLAS_CELL_WIDTH + ATLAS_CELL_WIDTH / 2, 42));
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec2 uScreen;
uniform float uTime;
uniform float uHorizon;
uniform float uSweep;
uniform float uCellDither;
uniform vec2 uCellAscii;
uniform float uGlyphCount;
uniform sampler2D uAtlas;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 uv = pixel / uScreen;
  float edge = smoothstep(0.22, 0.95, length((uv - 0.5) * vec2(1.15, 1.0)));
  float sweepBand = 1.0 - smoothstep(40.0, 150.0, abs(pixel.x - uSweep));
  float sweepActive = step(0.0, uSweep);
  sweepBand *= sweepActive;

  // floor: a perspective grid that converges on the horizon, drawn as dither dots
  float below = pixel.y - uHorizon;
  float onFloor = step(0.0, below);
  float depth = max(below, 1.0);
  float columnPhase = abs(fract((pixel.x - uScreen.x * 0.5) / depth * 6.0 + 0.5) - 0.5);
  float columnLine = 1.0 - smoothstep(0.0, 6.0 * 1.4 / depth, columnPhase);
  float rowPhase = abs(fract(3200.0 / depth + uTime * 0.12 + 0.5) - 0.5);
  float rowLine = 1.0 - smoothstep(0.0, 3200.0 * 1.4 / (depth * depth), rowPhase);
  float floorFade = smoothstep(0.0, 40.0, below) * (1.0 - 0.7 * edge);
  float floorLuma = onFloor * (0.07 * smoothstep(0.0, 200.0, below) + 0.55 * max(columnLine, rowLine) * floorFade);

  float wallLuma = (1.0 - onFloor) * (0.05 + 0.10 * (1.0 - uv.y) * (1.0 - edge));
  float luma = wallLuma + floorLuma + sweepBand * 0.55;

  vec2 ditherCell = floor(pixel / uCellDither);
  float on = step(bayer8(ditherCell) + 0.04, luma * 1.9);
  // Colour, not monochrome (An, 2026-10-28): cool wall (indigo to teal) behind a warm floor grid (green to amber),
  // so the brand marks (NVIDIA green, Hugging Face yellow, Blender orange) sit in the same family.
  vec3 ground = vec3(0.035, 0.035, 0.050);
  vec3 wallTop = vec3(0.20, 0.20, 0.50);
  vec3 wallLow = vec3(0.10, 0.34, 0.38);
  vec3 floorNear = vec3(0.34, 0.52, 0.12);
  vec3 floorFar = vec3(0.34, 0.22, 0.07); // dim: the grid packs into a solid band at the horizon
  vec3 wallDots = mix(wallTop, wallLow, uv.y);
  vec3 floorDots = mix(floorFar, floorNear, smoothstep(0.0, 420.0, below));
  // Mostly grey with only a faint tint: full colour fought the numbers on top (An, 2026-10-28).
  vec3 grey = vec3(0.24, 0.24, 0.26);
  vec3 tint = mix(wallDots, floorDots, onFloor);
  vec3 dim = mix(grey, tint * 0.6, 0.18);
  dim = mix(dim, vec3(0.42, 0.40, 0.36), sweepBand * 0.6);
  vec3 color = mix(ground, dim, on);

  // glyph field, strongest toward the frame edges and inside the sweep
  vec2 cell = floor(pixel / uCellAscii);
  vec2 inCell = pixel / uCellAscii - cell;
  float field = valueNoise(cell * 0.11 + vec2(uTime * 0.06, uTime * 0.025));
  float strength = (0.05 + 0.95 * smoothstep(0.30, 1.0, edge)) * (1.0 - 0.8 * onFloor * (1.0 - edge));
  strength = max(strength, sweepBand);
  float jitter = hash(cell + floor(uTime * 18.0));
  float level = mix(field, jitter, sweepBand);
  float index = clamp(floor(level * strength * uGlyphCount * 1.15), 0.0, uGlyphCount - 1.0);
  vec2 atlasUv = vec2((index + inCell.x) / uGlyphCount, 1.0 - inCell.y);
  float coverage = texture2D(uAtlas, atlasUv).r;
  // glyphs run green, yellow, orange across the frame, the three brand colours in the film
  vec3 green = vec3(0.46, 0.73, 0.10);
  vec3 yellow = vec3(1.00, 0.82, 0.12);
  vec3 orange = vec3(0.91, 0.49, 0.05);
  vec3 brand = uv.x < 0.5 ? mix(green, yellow, uv.x * 2.0) : mix(yellow, orange, uv.x * 2.0 - 1.0);
  vec3 ink = mix(vec3(0.80, 0.79, 0.75), brand, 0.15);
  color += ink * coverage * (0.16 + 0.6 * sweepBand);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class Backdrop {
  constructor(canvas, width, height, fontFamily) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      uniforms: {
        uScreen: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0 },
        uHorizon: { value: 700 },
        uSweep: { value: -1 },
        uCellDither: { value: DITHER_CELL_PX },
        uCellAscii: { value: new THREE.Vector2(ASCII_CELL.width, ASCII_CELL.height) },
        uGlyphCount: { value: GLYPHS.length },
        uAtlas: { value: buildGlyphAtlas(fontFamily) },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  /** sweep: x of the transition band in pixels, or -1 when no transition runs. */
  render(time, horizon, sweep) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uHorizon.value = horizon;
    this.material.uniforms.uSweep.value = sweep;
    this.renderer.render(this.scene, this.camera);
  }
}
