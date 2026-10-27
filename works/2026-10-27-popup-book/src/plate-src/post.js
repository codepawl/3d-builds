// Watercolour plate post process: toon bands, brown ink outlines, hatching, paper grain.
import * as THREE from 'three';

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float near;
uniform float far;
uniform float paperAlpha;
uniform float transparentPaper;
uniform float inkScale;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}
vec3 toSrgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
float soft(float x, float edge) { return smoothstep(edge - 0.035, edge + 0.035, x); }

void main() {
  vec2 px = 1.0 / res;
  float scale = max(res.y / 1080.0, 0.45);
  if (inkScale > 0.0) scale = inkScale;
  vec2 frag = vUv * res;
  vec4 c = texture2D(tColor, vUv);
  float d0 = texture2D(tDepth, vUv).r;
  bool geo = d0 < 0.99999;

  vec3 paper = vec3(0.953, 0.918, 0.839);
  float blot = vnoise(frag / (170.0 * scale)) * 0.6 + vnoise(frag / (42.0 * scale)) * 0.4;
  paper *= 0.95 + 0.075 * blot;
  vec3 base = paper;
  float banded = 1.0;

  if (c.a > 0.003) {
    vec3 un = toSrgb(c.rgb / c.a);
    if (geo) {
      float l = dot(un, vec3(0.299, 0.587, 0.114));
      banded = 0.26 + 0.24 * soft(l, 0.20) + 0.22 * soft(l, 0.42) + 0.22 * soft(l, 0.64) + 0.12 * soft(l, 0.84);
      vec3 toned = un * (banded / max(l, 0.03));
      un = mix(un, toned, 0.78);
      vec3 shadowTint = mix(vec3(0.80, 0.72, 0.88), vec3(1.0, 0.98, 0.92), smoothstep(0.1, 0.62, banded));
      un *= shadowTint;
      un *= 0.9 + 0.16 * vnoise(frag / (15.0 * scale));
      float gray = dot(un, vec3(0.299, 0.587, 0.114));
      un = mix(vec3(gray), un, 1.0);
    }
    base = mix(paper, un, c.a);
    if (transparentPaper > 0.5 && !geo) base = un;
  }

  if (geo) {
    vec3 ink = vec3(0.24, 0.15, 0.085);
    float width = (1.0 + 0.8 * vnoise(frag / (21.0 * scale))) * max(scale, 1.0);
    vec2 o = px * width;
    float L0 = linearDepth(d0);
    vec3 n0 = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
    float e = 0.0;
    float soften = 0.0;
    vec2 dirs[4];
    dirs[0] = vec2(1.0, 0.0);
    dirs[1] = vec2(-1.0, 0.0);
    dirs[2] = vec2(0.0, 1.0);
    dirs[3] = vec2(0.0, -1.0);
    for (int i = 0; i < 4; i++) {
      vec2 uvN = vUv + o * dirs[i];
      float dn = texture2D(tDepth, uvN).r;
      bool geoN = dn < 0.99999;
      float Ln = geoN ? linearDepth(dn) : far;
      float rel = abs(Ln - L0) / L0;
      e = max(e, smoothstep(0.0045, 0.012, rel));
      if (geoN) {
        vec3 nn = texture2D(tNormal, uvN).xyz * 2.0 - 1.0;
        e = max(e, smoothstep(0.28, 0.62, 1.0 - dot(n0, nn)) * 0.8);
      }
      vec2 uvW = vUv + px * 3.5 * dirs[i];
      float dw = texture2D(tDepth, uvW).r;
      float Lw = dw < 0.99999 ? linearDepth(dw) : far;
      soften += smoothstep(0.006, 0.02, abs(Lw - L0) / L0) * 0.25;
    }
    base *= 1.0 - 0.14 * soften;
    float hatchZone = smoothstep(0.62, 0.28, banded);
    float t1 = (frag.x + frag.y) / (3.6 * scale) + vnoise(frag / (28.0 * scale)) * 2.0;
    float t2 = (frag.x - frag.y) / (3.6 * scale) + vnoise(frag / (31.0 * scale) + 7.0) * 2.0;
    float line1 = smoothstep(0.39, 0.5, abs(fract(t1) - 0.5));
    float line2 = smoothstep(0.39, 0.5, abs(fract(t2) - 0.5));
    float hatch = hatchZone * line1 + step(0.6, hatchZone) * line2 * 0.8;
    base = mix(base, ink * 1.3, clamp(hatch, 0.0, 1.0) * 0.5);
    float strength = e * (0.78 + 0.22 * vnoise(frag / (7.0 * scale)));
    base = mix(base, ink, clamp(strength, 0.0, 1.0) * 0.92);
  }

  float grain = (hash(floor(frag)) - 0.5) * 0.05 + (vnoise(frag / 3.0) - 0.5) * 0.05;
  base *= 1.0 + grain;
  float outAlpha = 1.0;
  if (transparentPaper > 0.5) outAlpha = geo ? 1.0 : c.a;
  gl_FragColor = vec4(base, outAlpha);
}`;

export class PlatePost {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.colorTarget = null;
    this.normalTarget = null;
    this.normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    this.hiddenInNormalPass = [];
    this.backdrop = null;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        tColor: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        res: { value: new THREE.Vector2(width, height) },
        near: { value: 1 },
        far: { value: 1000 },
        paperAlpha: { value: 1 },
        transparentPaper: { value: 0 },
        inkScale: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize(width, height);
  }

  resize(width, height) {
    if (this.colorTarget) {
      this.colorTarget.dispose();
      this.normalTarget.dispose();
      this.normalTarget.depthTexture.dispose();
    }
    this.width = width;
    this.height = height;
    this.colorTarget = new THREE.WebGLRenderTarget(width, height, { samples: 4, type: THREE.HalfFloatType });
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.normalTarget = new THREE.WebGLRenderTarget(width, height, { depthTexture });
    this.material.uniforms.res.value.set(width, height);
    this.material.uniforms.tColor.value = this.colorTarget.texture;
    this.material.uniforms.tNormal.value = this.normalTarget.texture;
    this.material.uniforms.tDepth.value = depthTexture;
  }

  // Objects that must not make outlines (sea wash) are listed here.
  render(scene, camera, outputTarget = null) {
    const renderer = this.renderer;
    this.material.uniforms.near.value = camera.near;
    this.material.uniforms.far.value = camera.far;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.colorTarget);
    renderer.clear();
    if (this.backdrop) {
      renderer.autoClear = false;
      renderer.render(this.backdrop, camera);
      renderer.autoClear = true;
    }
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;

    for (const object of this.hiddenInNormalPass) object.visible = false;
    scene.overrideMaterial = this.normalMaterial;
    renderer.setRenderTarget(this.normalTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    for (const object of this.hiddenInNormalPass) object.visible = true;

    renderer.setRenderTarget(outputTarget);
    renderer.render(this.quadScene, this.quadCamera);
  }

  // Render once into a 2D canvas (used for the inset and the portraits).
  renderToCanvas(scene, camera, canvas, inkScale = 0) {
    this.material.uniforms.inkScale.value = inkScale;
    this.material.uniforms.transparentPaper.value = 1;
    const output = new THREE.WebGLRenderTarget(this.width, this.height);
    this.render(scene, camera, output);
    const pixels = new Uint8Array(this.width * this.height * 4);
    this.renderer.readRenderTargetPixels(output, 0, 0, this.width, this.height, pixels);
    output.dispose();
    this.material.uniforms.transparentPaper.value = 0;
    this.material.uniforms.inkScale.value = 0;
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(this.width, this.height);
    for (let row = 0; row < this.height; row++) {
      const source = (this.height - 1 - row) * this.width * 4;
      image.data.set(pixels.subarray(source, source + this.width * 4), row * this.width * 4);
    }
    context.putImageData(image, 0, 0);
  }
}
