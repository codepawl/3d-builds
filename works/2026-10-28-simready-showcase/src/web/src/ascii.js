// The ASCII post pass: the 3D scene is rendered small (3x3 texels per character cell) together with a
// normal pass, then one full-screen shader picks a glyph per cell from brightness, or a line glyph on an edge.
import * as THREE from 'three';

export const FONT_FAMILY = 'AsciiMono';
// Atlas order: 0-9 brightness ramp, 10-14 edge glyphs.
const ATLAS_GLYPHS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@', '|', '/', '-', '\\', '_', ','];
const ATLAS_CELL_WIDTH = 32;
const ATLAS_CELL_HEIGHT = 56;
export const TEXELS_PER_CELL = 3;

function buildGlyphAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_CELL_WIDTH * ATLAS_GLYPHS.length;
  canvas.height = ATLAS_CELL_HEIGHT;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = `700 50px ${FONT_FAMILY}, Consolas, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  ATLAS_GLYPHS.forEach((glyph, index) => {
    context.fillText(glyph, index * ATLAS_CELL_WIDTH + ATLAS_CELL_WIDTH / 2, 42);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform sampler2D tAtlas;
uniform vec2 uScreen;
uniform vec2 uCell;
uniform vec2 uGrid;
uniform vec2 uTexelPx;
uniform float uNear;
uniform float uFar;
uniform float uExposure;
uniform float uEdgeDepth;
uniform float uEdgeNormal;
uniform vec3 uTint;
uniform vec3 uUpView;
varying vec2 vUv;

float linearDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
float normalField(vec3 n) { return n.x + 1.3 * n.y + 0.7 * n.z; }
// Alpha of the normal target tells the material class: 1 terrain, about 0.38 enemy, about 0.62 hero.
float heroAt(vec2 uv) { float a = texture2D(tNormal, uv).a; return step(0.55, a) * step(a, 0.7); }

void main() {
  vec2 pixelTop = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 cell = floor(pixelTop / uCell);
  if (cell.x >= uGrid.x || cell.y >= uGrid.y) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 inCell = pixelTop / uCell - cell;
  vec2 cellUv = uCell / uScreen;
  vec2 centerUv = vec2((cell.x + 0.5) * cellUv.x, 1.0 - (cell.y + 0.5) * cellUv.y);
  vec2 texelStep = cellUv / 3.0;

  vec3 sum = vec3(0.0);
  vec3 peak = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec3 sampleColor = texture2D(tScene, centerUv + vec2(float(i), float(j)) * texelStep).rgb;
      sum += sampleColor;
      peak = max(peak, sampleColor);
    }
  }
  vec3 color = mix(sum / 9.0, peak, 0.3) * uExposure;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

  vec4 centerNormal = texture2D(tNormal, centerUv);
  float classAlpha = centerNormal.a;
  float isHero = step(0.55, classAlpha) * step(classAlpha, 0.7);
  float isEnemy = step(0.3, classAlpha) * step(classAlpha, 0.5);
  float isCharacter = max(isHero, isEnemy);
  float nearHero = max(max(isHero, heroAt(centerUv + vec2(texelStep.x, 0.0))), max(heroAt(centerUv - vec2(texelStep.x, 0.0)), max(heroAt(centerUv + vec2(0.0, texelStep.y)), heroAt(centerUv - vec2(0.0, texelStep.y)))));
  float isFloor = (1.0 - isCharacter) * step(0.88, dot(centerNormal.xyz * 2.0 - 1.0, uUpView));

  float depthCenter = linearDepth(centerUv);
  float depthLeft = linearDepth(centerUv - vec2(texelStep.x, 0.0));
  float depthRight = linearDepth(centerUv + vec2(texelStep.x, 0.0));
  float depthUp = linearDepth(centerUv + vec2(0.0, texelStep.y));
  float depthDown = linearDepth(centerUv - vec2(0.0, texelStep.y));
  float depthEdge = max(abs(depthLeft + depthRight - 2.0 * depthCenter), abs(depthUp + depthDown - 2.0 * depthCenter)) / depthCenter;
  vec2 depthGradient = vec2(depthRight - depthLeft, depthUp - depthDown) / depthCenter;

  vec3 normalLeft = normalAt(centerUv - vec2(texelStep.x, 0.0));
  vec3 normalRight = normalAt(centerUv + vec2(texelStep.x, 0.0));
  vec3 normalUp = normalAt(centerUv + vec2(0.0, texelStep.y));
  vec3 normalDown = normalAt(centerUv - vec2(0.0, texelStep.y));
  float normalEdge = max(length(normalRight - normalLeft), length(normalUp - normalDown));
  vec2 normalGradient = vec2(normalField(normalRight) - normalField(normalLeft), normalField(normalUp) - normalField(normalDown));

  float depthScore = depthEdge / uEdgeDepth;
  float normalScore = normalEdge / uEdgeNormal;
  bool onSurface = depthCenter < uFar * 0.9;
  bool isEdge = max(depthScore, normalScore) > 1.0 && luma > 0.1 && onSurface;
  vec2 gradient = depthScore >= normalScore ? depthGradient : normalGradient;
  gradient = gradient / (2.0 * uTexelPx);

  float brightness = clamp((luma - 0.08) / 0.92, 0.0, 1.0);
  float glyphIndex = 0.0;
  float valueScale = 1.0;
  if (isEdge) {
    vec2 along = vec2(-gradient.y, gradient.x);
    float angle = atan(along.y, along.x);
    if (angle < 0.0) angle += 3.14159265;
    float turn = angle / 3.14159265 * 8.0;
    if (turn < 1.0 || turn >= 7.0) glyphIndex = 12.0;
    else if (turn < 3.0) glyphIndex = 11.0;
    else if (turn < 5.0) glyphIndex = 10.0;
    else glyphIndex = 13.0;
    brightness = max(brightness, 0.55);
  } else if (isCharacter > 0.5) {
    brightness = max(brightness, 0.22);
    glyphIndex = floor(clamp(pow(brightness, 0.68), 0.0, 0.999) * 10.0);
  } else if (isFloor > 0.5) {
    // Floors stay quiet: dots, commas and colons that thicken only inside a light pool.
    glyphIndex = brightness < 0.2 ? 1.0 : (brightness < 0.45 ? 15.0 : (brightness < 0.7 ? 2.0 : 3.0));
    valueScale = 0.75;
  } else {
    // Walls and pillars: dense blocky glyphs that stay visible even when dim.
    if (onSurface) brightness = max(brightness, 0.12);
    valueScale = 0.55;
    glyphIndex = 7.0 + floor(clamp(brightness * 3.0, 0.0, 2.99));
  }

  vec2 atlasUv = vec2((glyphIndex + inCell.x) / 16.0, 1.0 - inCell.y);
  float coverage = texture2D(tAtlas, atlasUv).r;
  float maxChannel = max(max(color.r, color.g), max(color.b, 0.0001));
  vec3 hue = color / maxChannel;
  float saturation = max(hue.r, max(hue.g, hue.b)) - min(hue.r, min(hue.g, hue.b));
  float tintAmount = (isFloor < 0.5 && isCharacter < 0.5) ? 0.65 : 0.3;
  hue = mix(hue, uTint, tintAmount * (1.0 - smoothstep(0.3, 0.65, saturation)));
  if (isFloor < 0.5 && isCharacter < 0.5) hue = mix(hue, uTint, 0.7);
  vec3 glyphColor = hue * clamp(0.12 + 1.0 * pow(brightness, 0.6), 0.0, 1.0) * valueScale;
  if (isEdge) glyphColor = mix(glyphColor, uTint, isCharacter > 0.5 ? 0.0 : 0.6) * 1.25;
  if (isEdge && nearHero > 0.5) glyphColor = vec3(0.35, 1.0, 0.8);
  glyphColor = floor(clamp(glyphColor, 0.0, 1.0) * 8.0 + 0.5) / 8.0;
  float present = step(0.004, brightness);
  vec3 outColor = glyphColor * coverage * present + glyphColor * 0.03 * present * (isFloor > 0.5 ? 0.0 : 1.0);
  gl_FragColor = vec4(pow(clamp(outColor, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;

export class AsciiPass {
  constructor(renderer) {
    this.renderer = renderer;
    this.raw = false;
    this.cellWidth = 8;
    this.cellHeight = 14;
    this.grid = new THREE.Vector2(1, 1);
    this.hiddenForNormals = [];
    this.atlas = buildGlyphAtlas();
    this.sceneTarget = null;
    this.normalTarget = null;
    this.normalMaterial = new THREE.MeshNormalMaterial();
    const characterVertex = 'varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    const characterFragment = (alpha) => 'varying vec3 vNormal; void main() { gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, ' + alpha + '); }';
    this.enemyMaterial = new THREE.ShaderMaterial({ vertexShader: characterVertex, fragmentShader: characterFragment('0.38') });
    this.heroMaterial = new THREE.ShaderMaterial({ vertexShader: characterVertex, fragmentShader: characterFragment('0.62') });
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        tScene: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        tAtlas: { value: this.atlas },
        uScreen: { value: new THREE.Vector2(1, 1) },
        uCell: { value: new THREE.Vector2(8, 14) },
        uGrid: { value: this.grid },
        uTexelPx: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.5 },
        uFar: { value: 150 },
        uExposure: { value: 2.3 },
        uEdgeDepth: { value: 0.11 },
        uEdgeNormal: { value: 1.05 },
        uTint: { value: new THREE.Vector3(0.7, 0.78, 0.95) },
        uUpView: { value: new THREE.Vector3(0, 1, 0) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  resize(widthPx, heightPx, cellWidth, cellHeight) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.grid.set(Math.floor(widthPx / cellWidth), Math.floor(heightPx / cellHeight));
    const targetWidth = this.grid.x * TEXELS_PER_CELL;
    const targetHeight = this.grid.y * TEXELS_PER_CELL;
    this.sceneTarget?.dispose();
    this.normalTarget?.dispose();
    this.sceneTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(targetWidth, targetHeight) });
    this.normalTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, { type: THREE.UnsignedByteType });
    this.material.uniforms.tScene.value = this.sceneTarget.texture;
    this.material.uniforms.tDepth.value = this.sceneTarget.depthTexture;
    this.material.uniforms.tNormal.value = this.normalTarget.texture;
    this.material.uniforms.uScreen.value.set(widthPx, heightPx);
    this.material.uniforms.uCell.value.set(cellWidth, cellHeight);
    this.material.uniforms.uTexelPx.value.set(widthPx / targetWidth, heightPx / targetHeight);
    this.targetHeight = targetHeight;
  }

  /** Scale for custom point shaders: pixels per world unit at distance 1, in scene-target texels. */
  get targetPixelHeight() {
    return this.targetHeight ?? 100;
  }

  render(scene, camera, effectObjects, outputTarget = null) {
    const renderer = this.renderer;
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;
    if (this.raw) {
      renderer.setRenderTarget(null);
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      return;
    }
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);

    for (const object of effectObjects) {
      object.userData.wasVisible = object.visible;
      object.visible = false;
    }
    renderer.shadowMap.needsUpdate = false;
    const upView = this.material.uniforms.uUpView.value;
    upView.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    renderer.setRenderTarget(this.normalTarget);
    renderer.setClearColor(0x808080, 1);
    camera.layers.set(0);
    scene.overrideMaterial = this.normalMaterial;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    camera.layers.set(1);
    scene.overrideMaterial = this.enemyMaterial;
    renderer.render(scene, camera);
    camera.layers.set(2);
    scene.overrideMaterial = this.heroMaterial;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    camera.layers.enable(0);
    camera.layers.enable(1);
    camera.layers.enable(2);
    scene.overrideMaterial = null;
    renderer.setClearColor(0x000000, 1);
    for (const object of effectObjects) object.visible = object.userData.wasVisible;

    renderer.setRenderTarget(outputTarget);
    renderer.render(this.quadScene, this.quadCamera);
  }
}
