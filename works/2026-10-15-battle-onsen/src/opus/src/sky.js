// Gradient sky dome with sun glow, sun or moon disc and stars, plus the environment map made from it.
import * as THREE from "three";
import { valueNoiseGlsl } from "./glsl.js";

const skyVertexShader = /* glsl */ `
  varying vec3 viewDirection;
  void main() {
    viewDirection = normalize(position);
    vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clipPosition.xyww;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 fogColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform vec3 sunGlowColor;
  uniform float sunGlowAmount;
  uniform float sunDiscAmount;
  uniform float moonAmount;
  uniform float starAmount;
  uniform float time;
  uniform float discScale;
  uniform float cloudCoverage;
  uniform vec3 cloudLitColor;
  uniform vec3 cloudShadeColor;
  varying vec3 viewDirection;
  ${valueNoiseGlsl}

  // A layer of drifting cumulus and stratus seen from below: noise on a plane above the valley, lit from the
  // side facing the sun and darker where the cloud is thick between the viewer and the light.
  vec4 cloudLayer(vec3 direction, vec3 sunDirectionNormalized) {
    vec2 planePoint = direction.xz / (direction.y + 0.09) * 0.55 + vec2(time * 0.006, time * 0.0025);
    float shape = fractalNoise(planePoint * 1.1 + vec2(3.1, 7.7));
    float detail = fractalNoise(planePoint * 4.3 + vec2(-time * 0.01, 1.3));
    float threshold = 1.0 - cloudCoverage;
    float density = smoothstep(threshold - 0.08, threshold + 0.22, shape * 0.82 + detail * 0.28);
    vec2 towardSun = normalize(sunDirectionNormalized.xz + vec2(1e-4)) * 0.14;
    float shapeTowardSun = fractalNoise((planePoint + towardSun) * 1.1 + vec2(3.1, 7.7));
    float lightThrough = clamp(1.0 - (shapeTowardSun - shape) * 3.0, 0.0, 1.0);
    float sunAlignment = max(dot(direction, sunDirectionNormalized), 0.0);
    float silverLining = pow(sunAlignment, 12.0) * (1.0 - density) * 2.5;
    vec3 color = mix(cloudShadeColor, cloudLitColor, lightThrough * (0.55 + 0.45 * detail)) + cloudLitColor * silverLining;
    float horizonFade = smoothstep(0.0, 0.18, direction.y);
    return vec4(color, density * horizonFade);
  }

  float hashDirection(vec3 cell) {
    return fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  vec3 starField(vec3 direction) {
    vec3 scaled = direction * 420.0;
    vec3 cell = floor(scaled);
    float randomValue = hashDirection(cell);
    if (randomValue < 0.9965) {
      return vec3(0.0);
    }
    vec3 local = fract(scaled) - 0.5;
    float falloff = smoothstep(0.32, 0.0, length(local));
    float twinkle = 0.7 + 0.3 * sin(time * 2.0 + randomValue * 400.0);
    float brightness = (randomValue - 0.9965) / 0.0035;
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.78), fract(randomValue * 91.0));
    return tint * falloff * twinkle * (0.4 + 2.6 * brightness * brightness);
  }

  void main() {
    vec3 direction = normalize(viewDirection);
    float height = direction.y;
    float upAmount = clamp(height, 0.0, 1.0);
    vec3 color = mix(horizonColor, zenithColor, pow(upAmount, 0.55));
    color = mix(color, fogColor, smoothstep(0.12, -0.02, height));
    float sunAlignment = max(dot(direction, normalize(sunDirection)), 0.0);
    float glow = pow(sunAlignment, 6.0) * 0.6 + pow(sunAlignment, 48.0) * 1.2;
    float horizonBand = exp(-abs(height) * 6.0);
    color += sunGlowColor * glow * sunGlowAmount * (0.55 + 0.45 * horizonBand);
    float discEdge = 0.99995 - 0.00004 * discScale;
    float sunDisc = smoothstep(discEdge, discEdge + 0.00002, sunAlignment);
    color += sunColor * sunDisc * sunDiscAmount * 40.0 * step(-0.01, height);
    float moonDisc = smoothstep(0.99975, 0.99979, sunAlignment);
    float moonShade = 0.8 + 0.2 * hashDirection(floor(direction * 3000.0));
    color += vec3(0.85, 0.9, 1.0) * moonDisc * moonShade * moonAmount * 3.0;
    color += vec3(0.25, 0.3, 0.5) * pow(sunAlignment, 220.0) * moonAmount * 0.6;
    if (height > 0.0) {
      color += starField(direction) * starAmount * smoothstep(0.0, 0.25, height);
      vec4 clouds = cloudLayer(direction, normalize(sunDirection));
      color = mix(color, clouds.rgb, clouds.a);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenithColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      sunGlowColor: { value: new THREE.Color() },
      sunGlowAmount: { value: 1 },
      sunDiscAmount: { value: 1 },
      moonAmount: { value: 0 },
      starAmount: { value: 0 },
      time: { value: 0 },
      discScale: { value: 1 },
      cloudCoverage: { value: 0.4 },
      cloudLitColor: { value: new THREE.Color() },
      cloudShadeColor: { value: new THREE.Color() },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export class Sky {
  constructor(renderer) {
    this.renderer = renderer;
    this.material = createSkyMaterial();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.environmentScene = new THREE.Scene();
    this.environmentMaterial = createSkyMaterial();
    this.environmentMaterial.uniforms.discScale.value = 40;
    this.environmentScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.environmentMaterial));
    this.environmentGround = new THREE.Mesh(
      new THREE.CircleGeometry(48, 32).rotateX(-Math.PI / 2).translate(0, -1.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.environmentScene.add(this.environmentGround);
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.environmentTarget = null;
  }

  applyPreset(values, time) {
    for (const material of [this.material, this.environmentMaterial]) {
      const uniforms = material.uniforms;
      uniforms.zenithColor.value.fromArray(values.skyZenith);
      uniforms.horizonColor.value.fromArray(values.skyHorizon);
      uniforms.fogColor.value.fromArray(values.fogColor);
      uniforms.sunDirection.value.fromArray(values.sunDirection);
      uniforms.sunColor.value.fromArray(values.sunColor);
      uniforms.sunGlowColor.value.fromArray(values.sunGlowColor);
      uniforms.sunGlowAmount.value = values.sunGlowAmount;
      uniforms.sunDiscAmount.value = values.sunDiscAmount;
      uniforms.moonAmount.value = values.moonAmount;
      uniforms.starAmount.value = values.starAmount;
      uniforms.cloudCoverage.value = values.cloudCoverage;
      uniforms.cloudLitColor.value.fromArray(values.cloudLit);
      uniforms.cloudShadeColor.value.fromArray(values.cloudShade);
      uniforms.time.value = time;
    }
    const groundBrightness = values.hemisphereGround.map((channel) => channel * values.hemisphereIntensity * 0.9);
    this.environmentGround.material.color.fromArray(groundBrightness);
  }

  updateEnvironment() {
    const previousTarget = this.environmentTarget;
    this.environmentTarget = this.pmremGenerator.fromScene(this.environmentScene, 0, 0.1, 200);
    if (previousTarget) {
      previousTarget.dispose();
    }
    return this.environmentTarget.texture;
  }
}
