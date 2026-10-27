// Steam rising off the hot water in thin wisps, plus a faint mist that hugs the surface.
// Each wisp is a tall billboard that turns only around the vertical axis. Its shape is domain-warped noise
// stretched upwards and scrolled with the rise, so neighbouring wisps leave gaps the water and ryokan show through.
import * as THREE from "three";
import { valueNoiseGlsl } from "./glsl.js";

const steamVertexShader = /* glsl */ `
  attribute vec4 spawnPoint;
  attribute vec4 lifeParameters;
  attribute vec2 shapeParameters;
  uniform float time;
  uniform float waterLevel;
  uniform vec2 windDrift;
  varying vec2 wispUv;
  varying float wispAlpha;
  varying float wispSeed;
  varying float wispAge;
  varying vec3 wispWorld;
  varying float wispViewDepth;
  varying float heightAboveWater;

  void main() {
    float seed = spawnPoint.z;
    float riseHeight = spawnPoint.w;
    float lifetime = lifeParameters.y;
    float age = fract((time + lifeParameters.x) / lifetime);
    float width = mix(lifeParameters.z * 0.55, lifeParameters.z, sqrt(age));
    float tallness = shapeParameters.x;
    float isSurfaceMist = shapeParameters.y;

    vec3 center = vec3(spawnPoint.x, waterLevel, spawnPoint.y);
    float rise = riseHeight * age * (0.55 + 0.45 * age);
    center.y += mix(width * tallness * 0.5 + rise, 0.32, isSurfaceMist);
    center.xz += windDrift * age * age * 1.8;
    center.x += sin(time * 0.37 + seed * 6.28) * 0.3 * age;
    center.z += cos(time * 0.29 + seed * 4.1) * 0.3 * age;

    vec3 toCamera = cameraPosition - center;
    vec3 sideways = normalize(vec3(toCamera.z, 0.0, -toCamera.x));
    vec3 upwards = vec3(0.0, 1.0, 0.0);
    float height = mix(width * tallness, width * 0.28, isSurfaceMist);
    vec3 world = center + sideways * position.x * width + upwards * position.y * height;

    float cameraDistance = length(world - cameraPosition);
    float lifeFade = smoothstep(0.0, 0.2, age) * (1.0 - smoothstep(0.5, 1.0, age));
    wispAlpha = lifeFade * smoothstep(1.6, 5.0, cameraDistance);
    wispUv = position.xy + 0.5;
    wispSeed = seed;
    wispAge = age;
    wispWorld = world;
    heightAboveWater = world.y - waterLevel;
    vec4 viewPosition = viewMatrix * vec4(world, 1.0);
    wispViewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const steamFragmentShader = /* glsl */ `
  uniform float time;
  uniform vec3 steamColor;
  uniform float steamOpacity;
  uniform vec3 sunDirection;
  uniform vec3 sunLight;
  uniform vec3 lanternPosition;
  uniform vec3 lanternLight;
  uniform vec3 windowPosition;
  uniform vec3 windowLight;
  uniform vec3 fogColor;
  uniform float fogDensity;
  varying vec2 wispUv;
  varying float wispAlpha;
  varying float wispSeed;
  varying float wispAge;
  varying vec3 wispWorld;
  varying float wispViewDepth;
  varying float heightAboveWater;
  ${valueNoiseGlsl}

  // The warp only bends the strands, so two octaves are enough for it.
  float coarseNoise(vec2 point) {
    return valueNoise(point) * 0.667 + valueNoise(point * 2.03 + vec2(1.7, 9.2)) * 0.333;
  }

  void main() {
    vec2 centered = wispUv - 0.5;
    float envelope = 1.0 - smoothstep(0.12, 0.5, length(centered * vec2(1.0, 0.85)));
    if (envelope * wispAlpha < 0.01) discard;
    vec2 scroll = vec2(wispSeed * 23.0, wispSeed * 41.0 - time * 0.12);
    vec2 warp = vec2(coarseNoise(wispUv * 1.6 + scroll), coarseNoise(wispUv * 1.6 + scroll + 5.3));
    vec2 billowPoint = wispUv * vec2(2.4, 2.0) + (warp - 0.5) * 1.3 + scroll;
    float strands = fractalNoise(billowPoint);
    float density = smoothstep(0.46, 0.8, strands + 0.2 * envelope) * envelope;
    density *= 1.0 - 0.55 * wispAge;
    float surfaceFade = smoothstep(0.0, 0.3, heightAboveWater);
    float alpha = density * wispAlpha * steamOpacity * surfaceFade;
    if (alpha < 0.002) discard;

    vec3 viewDirection = normalize(wispWorld - cameraPosition);
    float forwardScatter = pow(max(dot(viewDirection, normalize(sunDirection)), 0.0), 8.0);
    vec3 light = steamColor;
    light += sunLight * (0.04 + 0.12 * forwardScatter) * smoothstep(-0.05, 0.1, sunDirection.y);
    vec3 toLantern = lanternPosition - wispWorld;
    light += lanternLight / (1.0 + dot(toLantern, toLantern) * 0.7);
    vec3 toWindow = windowPosition - wispWorld;
    light += windowLight / (1.0 + dot(toWindow, toWindow) * 0.06);
    light *= 0.8 + 0.4 * strands;
    float fogAmount = 1.0 - exp(-fogDensity * fogDensity * wispViewDepth * wispViewDepth);
    light = mix(light, fogColor, fogAmount);
    gl_FragColor = vec4(light * alpha, alpha);
  }
`;

function samplePointInPolygon(outline, randomSource, shrink) {
  const minX = Math.min(...outline.map((point) => point[0]));
  const maxX = Math.max(...outline.map((point) => point[0]));
  const minZ = Math.min(...outline.map((point) => point[1]));
  const maxZ = Math.max(...outline.map((point) => point[1]));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const pointX = minX + (maxX - minX) * randomSource();
    const pointZ = minZ + (maxZ - minZ) * randomSource();
    if (isInsidePolygon(outline, pointX / shrink, pointZ / shrink)) {
      return [pointX, pointZ];
    }
  }
  return [0, 0];
}

export function isInsidePolygon(outline, pointX, pointZ) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index, index += 1) {
    const [currentX, currentZ] = outline[index];
    const [previousX, previousZ] = outline[previous];
    const crosses = currentZ > pointZ !== previousZ > pointZ;
    if (crosses && pointX < ((previousX - currentX) * (pointZ - currentZ)) / (previousZ - currentZ) + currentX) {
      inside = !inside;
    }
  }
  return inside;
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Override-material passes (ambient occlusion normals, depth of field depth, the focus probe) would draw these
// transparent quads as solid surfaces. Drawing no instances while an override is active keeps them out.
export function skipOverrideMaterialPasses(mesh, instanceCount) {
  mesh.onBeforeRender = (renderer, scene, camera, geometry) => {
    geometry.instanceCount = scene.overrideMaterial ? 0 : instanceCount;
  };
}

function buildWispAttributes(layout, wispCount, mistCount) {
  const randomSource = createSeededRandom(77);
  const total = wispCount + mistCount;
  const spawnPoints = new Float32Array(total * 4);
  const lifeParameters = new Float32Array(total * 4);
  const shapeParameters = new Float32Array(total * 2);
  for (let index = 0; index < total; index += 1) {
    const isSurfaceMist = index >= wispCount;
    const [pointX, pointZ] = samplePointInPolygon(layout.poolOutline, randomSource, isSurfaceMist ? 0.8 : 0.85);
    const riseHeight = isSurfaceMist ? 0 : 1.2 + randomSource() * 1.8;
    spawnPoints.set([pointX, pointZ, randomSource(), riseHeight], index * 4);
    const lifetime = isSurfaceMist ? 9 + randomSource() * 5 : 5 + randomSource() * 4;
    const width = isSurfaceMist ? 2.6 + randomSource() * 1.6 : 1.3 + randomSource() * 1.1;
    lifeParameters.set([randomSource() * lifetime, lifetime, width, 0], index * 4);
    const tallness = 1.0 + randomSource() * 0.5;
    shapeParameters.set([tallness, isSurfaceMist ? 1 : 0], index * 2);
  }
  return { spawnPoints, lifeParameters, shapeParameters, total };
}

export class Steam {
  constructor(layout) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.attributes.position);
    const { spawnPoints, lifeParameters, shapeParameters, total } = buildWispAttributes(layout, 120, 22);
    geometry.setAttribute("spawnPoint", new THREE.InstancedBufferAttribute(spawnPoints, 4));
    geometry.setAttribute("lifeParameters", new THREE.InstancedBufferAttribute(lifeParameters, 4));
    geometry.setAttribute("shapeParameters", new THREE.InstancedBufferAttribute(shapeParameters, 2));
    geometry.instanceCount = total;
    this.uniforms = {
      time: { value: 0 },
      waterLevel: { value: layout.waterLevel },
      windDrift: { value: new THREE.Vector2(0.35, -0.2) },
      steamColor: { value: new THREE.Color() },
      steamOpacity: { value: 0.3 },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunLight: { value: new THREE.Color() },
      lanternPosition: { value: new THREE.Vector3().fromArray(layout.lights.lantern) },
      lanternLight: { value: new THREE.Color() },
      windowPosition: { value: new THREE.Vector3().fromArray(layout.lights.windowsLower[1]) },
      windowLight: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0.01 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: steamVertexShader,
      fragmentShader: steamFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    skipOverrideMaterialPasses(this.mesh, total);
  }

  applyPreset(values, lanternFlicker) {
    const uniforms = this.uniforms;
    uniforms.steamColor.value.fromArray(values.steamColor).multiplyScalar(values.hemisphereIntensity * 0.55 + 0.25);
    uniforms.steamOpacity.value = values.steamOpacity;
    uniforms.sunDirection.value.fromArray(values.sunDirection);
    uniforms.sunLight.value.fromArray(values.sunColor).multiplyScalar(values.sunIntensity);
    uniforms.lanternLight.value.setRGB(1.0, 0.55, 0.25).multiplyScalar(values.lanternLight * 0.14 * lanternFlicker);
    uniforms.windowLight.value.setRGB(1.0, 0.7, 0.4).multiplyScalar(values.windowLight * 0.06);
    uniforms.fogColor.value.fromArray(values.fogColor);
    uniforms.fogDensity.value = values.fogDensity;
  }

  update(time) {
    this.uniforms.time.value = time;
  }
}
