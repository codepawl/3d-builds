import * as THREE from "three";
import { PRESET_DEFINITIONS } from "./presets.js";

const SKY_VERTEX_SHADER = `
varying vec3 vWorldDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SKY_FRAGMENT_SHADER = `
uniform vec3 uZenithColor;
uniform vec3 uMidColor;
uniform vec3 uHorizonColor;
uniform vec3 uCloudLitColor;
uniform vec3 uCloudShadowColor;
uniform vec3 uSunDirection;
uniform vec3 uSunDiscColor;
uniform float uStarVisibility;
uniform float uTime;

varying vec3 vWorldDirection;

float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i + vec2(0.0, 0.0)), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbmClouds(vec2 p) {
  float sum = 0.0;
  float amp = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise2(p);
    p = rot * p * 2.08 + vec2(1.7, 2.3);
    amp *= 0.48;
  }
  return sum;
}

float computeStarHash(vec3 p) {
  vec3 q = fract(p * vec3(443.8975, 397.2973, 491.1871));
  q += dot(q.zxy, q.yxz + 19.19);
  return fract(q.x * q.y * q.z);
}

void main() {
  vec3 dir = normalize(vWorldDirection);
  float elevation = clamp(dir.y, 0.0, 1.0);
  float lowerMix = smoothstep(0.0, 0.26, elevation);
  float upperMix = smoothstep(0.20, 0.86, elevation);
  vec3 skyColor = mix(uHorizonColor, uMidColor, lowerMix);
  skyColor = mix(skyColor, uZenithColor, upperMix);

  vec3 sunDir = normalize(uSunDirection);
  float sunCos = max(dot(dir, sunDir), 0.0);
  float rayleighScatter = pow(1.0 - elevation, 3.2) * (0.18 + 0.24 * sunCos);
  skyColor = mix(skyColor, uHorizonColor, clamp(rayleighScatter, 0.0, 0.45));

  float mieHalo = pow(sunCos, 8.0) * 0.22 + pow(sunCos, 64.0) * 0.34;
  float sunDisc = smoothstep(0.9985, 0.9995, sunCos);
  skyColor += uSunDiscColor * (mieHalo + sunDisc * 1.45);

  if (uStarVisibility > 0.01 && elevation > 0.08) {
    vec3 starCell = floor(dir * 260.0);
    float starRand = computeStarHash(starCell);
    if (starRand > 0.9948) {
      float twinkle = 0.70 + 0.30 * sin(uTime * 2.0 + starRand * 60.0);
      float starFade = smoothstep(0.08, 0.35, elevation) * (1.0 - sunDisc);
      float brightness = (starRand - 0.9948) / 0.0052;
      skyColor += vec3(0.86, 0.92, 1.0) * brightness * twinkle * starFade * uStarVisibility * 1.05;
    }
  }

  if (elevation > 0.03) {
    vec2 skyUv = dir.xz / (elevation + 0.16);
    vec2 drift1 = vec2(uTime * 0.0045, -uTime * 0.0022);
    vec2 drift2 = vec2(uTime * 0.0020, uTime * 0.0012);

    float lowCloudNoise = fbmClouds(skyUv * 0.95 + drift1);
    float lowCloudGrad = fbmClouds(skyUv * 0.95 + drift1 + sunDir.xz * 0.12);
    float lowDensity = smoothstep(0.46, 0.78, lowCloudNoise) * smoothstep(0.03, 0.22, elevation) * (1.0 - smoothstep(0.55, 0.92, elevation));

    float highCirrus = fbmClouds(skyUv * 1.85 + drift2 + vec2(4.2, -1.8));
    float highDensity = smoothstep(0.54, 0.84, highCirrus) * smoothstep(0.12, 0.45, elevation) * 0.42;

    float directLit = clamp(0.52 + (lowCloudNoise - lowCloudGrad) * 3.2 + pow(sunCos, 3.0) * 0.42, 0.0, 1.0);
    vec3 cloudColor = mix(uCloudShadowColor, uCloudLitColor, directLit);
    float totalCloudAlpha = clamp(lowDensity * 0.62 + highDensity * 0.38, 0.0, 0.72);
    skyColor = mix(skyColor, cloudColor, totalCloudAlpha);
  }

  gl_FragColor = vec4(skyColor, 1.0);
}
`;

function buildPresetEnvironmentMaps(renderer, skyMaterial, skyUniforms) {
  const envMaps = {};
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  const envScene = new THREE.Scene();
  const envSkyGeo = new THREE.SphereGeometry(50.0, 32, 20);
  const envSkyMesh = new THREE.Mesh(envSkyGeo, skyMaterial);
  envScene.add(envSkyMesh);

  const groundGeo = new THREE.SphereGeometry(48.0, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x3b4d66, side: THREE.BackSide });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  envScene.add(groundMesh);

  for (const [presetKey, preset] of Object.entries(PRESET_DEFINITIONS)) {
    skyUniforms.uZenithColor.value.copy(preset.skyZenithColor);
    skyUniforms.uMidColor.value.copy(preset.skyMidColor);
    skyUniforms.uHorizonColor.value.copy(preset.skyHorizonColor);
    skyUniforms.uCloudLitColor.value.copy(preset.cloudLitColor);
    skyUniforms.uCloudShadowColor.value.copy(preset.cloudShadowColor);
    skyUniforms.uSunDirection.value.copy(preset.sunDirection);
    skyUniforms.uSunDiscColor.value.copy(preset.sunDiscColor);
    skyUniforms.uStarVisibility.value = preset.starVisibility;
    groundMat.color.copy(preset.hemisphereGroundColor);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    envMaps[presetKey] = renderTarget.texture;
  }

  envSkyGeo.dispose();
  groundGeo.dispose();
  groundMat.dispose();
  pmremGenerator.dispose();
  return envMaps;
}

export function createSkyAndLightingSystem(scene, renderer) {
  const skyGeometry = new THREE.SphereGeometry(215.0, 48, 28);
  const skyUniforms = {
    uZenithColor: { value: new THREE.Color(0x162947) },
    uMidColor: { value: new THREE.Color(0x32507a) },
    uHorizonColor: { value: new THREE.Color(0x6685ad) },
    uCloudLitColor: { value: new THREE.Color(0x8aa6cc) },
    uCloudShadowColor: { value: new THREE.Color(0x294166) },
    uSunDirection: { value: new THREE.Vector3(-0.45, 0.35, 0.82).normalize() },
    uSunDiscColor: { value: new THREE.Color(0xb8cfed) },
    uStarVisibility: { value: 0.28 },
    uTime: { value: 0.0 }
  };
  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);

  const presetEnvMaps = renderer ? buildPresetEnvironmentMaps(renderer, skyMaterial, skyUniforms) : {};
  if (presetEnvMaps.blue) {
    scene.environment = presetEnvMaps.blue;
    scene.environmentIntensity = 0.45;
  }

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 4096;
  sunLight.shadow.mapSize.height = 4096;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 88.0;
  const shadowBounds = 14.5;
  sunLight.shadow.camera.left = -shadowBounds;
  sunLight.shadow.camera.right = shadowBounds;
  sunLight.shadow.camera.top = shadowBounds;
  sunLight.shadow.camera.bottom = -shadowBounds;
  sunLight.shadow.bias = -0.00035;
  sunLight.shadow.normalBias = 0.018;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const skyFillLight = new THREE.DirectionalLight(0x8ab4e8, 0.55);
  skyFillLight.castShadow = false;
  scene.add(skyFillLight);

  const hemisphereLight = new THREE.HemisphereLight(0x5878a3, 0x324766, 1.2);
  scene.add(hemisphereLight);

  const ambientLight = new THREE.AmbientLight(0x46628a, 0.5);
  scene.add(ambientLight);

  const westToroLight = new THREE.PointLight(0xffd498, 1.15, 7.5, 1.85);
  westToroLight.position.set(-3.30, 0.72, -2.75);
  scene.add(westToroLight);

  const eastToroLight = new THREE.PointLight(0xffd498, 1.0, 7.0, 1.85);
  eastToroLight.position.set(2.45, 0.74, -2.05);
  scene.add(eastToroLight);

  const eavesAndonLight = new THREE.PointLight(0xffd498, 0.85, 6.5, 1.85);
  eavesAndonLight.position.set(0.85, 1.82, -3.10);
  scene.add(eavesAndonLight);

  const shojiWarmLights = [];
  const shojiLightPositions = [
    [-2.55, 1.50, -3.95],
    [-0.35, 1.55, -3.95],
    [1.65, 1.50, -3.95]
  ];
  for (const [lx, ly, lz] of shojiLightPositions) {
    const shojiLight = new THREE.PointLight(0xffe0b5, 0.78, 7.5, 1.80);
    shojiLight.position.set(lx, ly, lz);
    scene.add(shojiLight);
    shojiWarmLights.push(shojiLight);
  }

  const sceneFog = new THREE.FogExp2(0x3b5882, 0.0060);
  scene.fog = sceneFog;

  return {
    skyMesh,
    skyUniforms,
    presetEnvMaps,
    sunLight,
    skyFillLight,
    hemisphereLight,
    ambientLight,
    westToroLight,
    eastToroLight,
    eavesAndonLight,
    shojiWarmLights,
    sceneFog
  };
}

export function applyPresetToSkyAndLights(lightingSystem, state, elapsedTime, emissiveMaterials, scene) {
  const {
    skyUniforms,
    presetEnvMaps,
    sunLight,
    skyFillLight,
    hemisphereLight,
    ambientLight,
    westToroLight,
    eastToroLight,
    eavesAndonLight,
    shojiWarmLights,
    sceneFog
  } = lightingSystem;

  if (scene && presetEnvMaps && presetEnvMaps[state.name]) {
    scene.environment = presetEnvMaps[state.name];
  }

  skyUniforms.uZenithColor.value.copy(state.skyZenithColor);
  skyUniforms.uMidColor.value.copy(state.skyMidColor);
  skyUniforms.uHorizonColor.value.copy(state.skyHorizonColor);
  skyUniforms.uCloudLitColor.value.copy(state.cloudLitColor);
  skyUniforms.uCloudShadowColor.value.copy(state.cloudShadowColor);
  skyUniforms.uSunDirection.value.copy(state.sunDirection);
  skyUniforms.uSunDiscColor.value.copy(state.sunDiscColor);
  skyUniforms.uStarVisibility.value = state.starVisibility;
  skyUniforms.uTime.value = elapsedTime;

  sunLight.position.copy(state.sunDirection).multiplyScalar(36.0);
  sunLight.target.position.set(0.0, 0.5, -1.2);
  sunLight.color.copy(state.sunColor);
  sunLight.intensity = state.sunIntensity;

  skyFillLight.position.set(-state.sunDirection.x * 25.0, 18.0, -state.sunDirection.z * 25.0);
  skyFillLight.color.copy(state.hemisphereSkyColor);
  skyFillLight.intensity = state.hemisphereIntensity * 0.40;

  hemisphereLight.color.copy(state.hemisphereSkyColor);
  hemisphereLight.groundColor.copy(state.hemisphereGroundColor);
  hemisphereLight.intensity = state.hemisphereIntensity;

  ambientLight.color.copy(state.ambientColor);
  ambientLight.intensity = state.ambientIntensity;

  const candleFlicker1 = 1.0 + 0.028 * Math.sin(elapsedTime * 6.8) + 0.018 * Math.cos(elapsedTime * 12.3);
  const candleFlicker2 = 1.0 + 0.028 * Math.cos(elapsedTime * 6.1 + 1.2) + 0.015 * Math.sin(elapsedTime * 11.1);

  westToroLight.color.copy(state.lanternEmissiveColor);
  westToroLight.intensity = state.lanternPointIntensity * candleFlicker1;

  eastToroLight.color.copy(state.lanternEmissiveColor);
  eastToroLight.intensity = state.lanternPointIntensity * 0.88 * candleFlicker2;

  eavesAndonLight.color.copy(state.lanternEmissiveColor);
  eavesAndonLight.intensity = state.lanternPointIntensity * 0.72 * candleFlicker1;

  for (const shojiLight of shojiWarmLights) {
    shojiLight.color.copy(state.shojiEmissiveColor);
    shojiLight.intensity = state.shojiPointIntensity;
  }

  sceneFog.color.copy(state.fogColor);
  sceneFog.density = state.fogDensity;

  for (const mat of emissiveMaterials.shojiMaterials) {
    mat.emissive.copy(state.shojiEmissiveColor);
    mat.emissiveIntensity = state.shojiEmissiveIntensity;
  }
  for (const mat of emissiveMaterials.lanternMaterials) {
    mat.emissive.copy(state.lanternEmissiveColor);
    mat.emissiveIntensity = state.lanternEmissiveIntensity * candleFlicker1;
  }
}
