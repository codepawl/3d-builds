import * as THREE from "three";

const WATER_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const WATER_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyReflectTint;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uWarmLightColor;
uniform float uWarmGlowWeight;
uniform vec3 uFogColor;
uniform float uFogDensity;

varying vec3 vWorldPos;
varying vec2 vUv;

float wavePattern(vec2 p, float t) {
  float w1 = sin(p.x * 4.2 + p.y * 3.1 + t * 1.65) * 0.35;
  float w2 = cos(p.x * 6.8 - p.y * 5.4 - t * 1.35) * 0.25;
  float w3 = sin(p.x * 11.5 + p.y * 9.8 + t * 2.10) * 0.15;
  vec2 spoutImpact = vec2(1.42, -1.50);
  float distSpout = length(p - spoutImpact);
  float ringRipple = sin(distSpout * 18.0 - t * 6.5) * exp(-distSpout * 1.15) * 0.55;
  return w1 + w2 + w3 + ringRipple;
}

vec3 computeWaterNormal(vec2 p, float t) {
  float eps = 0.03;
  float hCenter = wavePattern(p, t);
  float hRight = wavePattern(p + vec2(eps, 0.0), t);
  float hForward = wavePattern(p + vec2(0.0, eps), t);
  vec3 normal = normalize(vec3((hCenter - hRight) * 1.15, 1.0, (hCenter - hForward) * 1.15));
  return normal;
}

void main() {
  vec3 viewVec = cameraPosition - vWorldPos;
  float viewDist = length(viewVec);
  vec3 viewDir = viewVec / max(viewDist, 1e-4);

  vec3 normal = computeWaterNormal(vWorldPos.xz, uTime);
  float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.2);

  vec2 poolCenter = vec2(0.35, 0.35);
  float radialDist = length(vWorldPos.xz - poolCenter) / 3.45;
  float edgeFactor = clamp(radialDist, 0.0, 1.0);
  float causticShimmer = 0.5 + 0.5 * sin(vWorldPos.x * 7.5 + uTime * 1.8) * cos(vWorldPos.z * 7.2 - uTime * 1.5);
  vec3 mineralWater = mix(uDeepColor, uShallowColor, edgeFactor * 0.65 + causticShimmer * 0.22);

  vec3 reflectDir = reflect(-viewDir, normal);
  vec3 skyRefl = uSkyReflectTint * (0.65 + 0.35 * clamp(reflectDir.y, 0.0, 1.0));

  vec3 sunDir = normalize(uSunDirection);
  vec3 halfVec = normalize(sunDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 96.0) * 0.85;
  vec3 sunSpec = uSunColor * spec;

  vec3 lanternWest = vec3(-3.30, 0.72, -2.75);
  vec3 lanternEast = vec3(2.45, 0.74, -2.05);
  vec3 shojiCenter = vec3(-0.35, 1.55, -4.25);

  float dWest = length(vWorldPos.xz - lanternWest.xz);
  float dEast = length(vWorldPos.xz - lanternEast.xz);
  float dShoji = length((vWorldPos.xz - shojiCenter.xz) * vec2(0.45, 0.85));

  float rippleMod = 0.72 + 0.28 * sin(normal.x * 16.0 + normal.z * 16.0);
  float warmRefl = (exp(-dWest * 0.75) * 0.85 + exp(-dEast * 0.85) * 0.65 + exp(-dShoji * 0.58) * 0.90) * rippleMod;
  vec3 warmContribution = uWarmLightColor * warmRefl * uWarmGlowWeight;

  float spoutFoamDist = length(vWorldPos.xz - vec2(1.42, -1.50));
  float foamRing = exp(-spoutFoamDist * 5.2) * (0.55 + 0.45 * sin(spoutFoamDist * 28.0 - uTime * 8.0));
  vec3 foamColor = mix(uSkyReflectTint, vec3(0.92, 0.96, 0.98), 0.65) * foamRing * 0.65;

  vec3 surfaceColor = mix(mineralWater, skyRefl, fresnel * 0.62) + sunSpec + warmContribution + foamColor;

  float fogFactor = 1.0 - exp(-(uFogDensity * viewDist) * (uFogDensity * viewDist));
  surfaceColor = mix(surfaceColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

  float alpha = clamp(mix(0.70, 0.93, fresnel) + foamRing * 0.2, 0.68, 0.96);
  gl_FragColor = vec4(surfaceColor, alpha);
}
`;

const STREAM_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const STREAM_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uWaterTint;
uniform vec3 uWarmLightColor;
uniform float uWarmGlowWeight;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  float flow = fract(vUv.x * 3.0 - uTime * 3.8);
  float streak1 = sin(vUv.y * 18.0 + uTime * 9.0) * 0.5 + 0.5;
  float streak2 = cos(vUv.x * 14.0 - uTime * 14.0) * 0.5 + 0.5;
  float foam = smoothstep(0.2, 0.9, streak1 * 0.6 + streak2 * 0.4);
  vec3 baseCol = mix(uWaterTint, vec3(0.88, 0.95, 0.96), 0.45 + foam * 0.42);
  baseCol += uWarmLightColor * (0.18 * uWarmGlowWeight);
  float alpha = 0.72 + foam * 0.22;
  gl_FragColor = vec4(baseCol, alpha);
}
`;

const STEAM_VERTEX_SHADER = `
attribute vec3 aSeedPos;
attribute vec4 aParams;

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vLifeAlpha;
varying float vSeedPhase;

void main() {
  vUv = uv;
  float phase = aParams.x;
  float speed = aParams.y;
  float baseScale = aParams.z;
  float driftRadius = aParams.w;
  vSeedPhase = phase;

  float cycle = fract(phase + uTime * speed);
  float riseHeight = cycle * 0.58;
  float windDriftX = sin(uTime * 0.55 + phase * 6.28) * driftRadius + cycle * 0.22;
  float windDriftZ = cos(uTime * 0.48 + phase * 6.28) * driftRadius - cycle * 0.12;

  vec3 centerWorld = vec3(
    aSeedPos.x + windDriftX,
    aSeedPos.y + riseHeight,
    aSeedPos.z + windDriftZ
  );

  float puffScale = baseScale * (0.55 + cycle * 0.52);
  float fadeIn = smoothstep(0.0, 0.22, cycle);
  float fadeOut = 1.0 - smoothstep(0.45, 1.0, cycle);
  vLifeAlpha = fadeIn * fadeOut;

  vec3 toCam = normalize(cameraPosition - centerWorld);
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  vec3 rightVec = normalize(cross(worldUp, toCam));
  vec3 upVec = cross(toCam, rightVec);

  float rotAngle = phase * 6.28318 + uTime * (0.14 * (fract(phase * 13.7) - 0.5));
  float ca = cos(rotAngle);
  float sa = sin(rotAngle);
  vec2 rotatedOffset = vec2(
    (position.x * ca - position.y * sa) * 1.25,
    (position.x * sa + position.y * ca) * 0.68
  ) * puffScale;

  vec3 vertexWorld = centerWorld + rightVec * rotatedOffset.x + upVec * rotatedOffset.y;
  vWorldPos = vertexWorld;
  gl_Position = projectionMatrix * viewMatrix * vec4(vertexWorld, 1.0);
}
`;

const STEAM_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uSteamBaseColor;
uniform vec3 uSteamWarmColor;
uniform float uSteamWarmWeight;
uniform float uSteamOpacity;
uniform vec3 uFogColor;
uniform float uFogDensity;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vLifeAlpha;
varying float vSeedPhase;

float hash2d(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2d(i + vec2(0.0, 0.0)), hash2d(i + vec2(1.0, 0.0)), u.x),
    mix(hash2d(i + vec2(0.0, 1.0)), hash2d(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbmVapor(vec2 p) {
  float sum = 0.0;
  sum += 0.55 * valueNoise2d(p);
  sum += 0.30 * valueNoise2d(p * 2.15 + vec2(1.7, 3.2));
  sum += 0.15 * valueNoise2d(p * 4.30 - vec2(2.4, 1.1));
  return sum;
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float radialSq = dot(centered, centered);
  if (radialSq > 1.0) {
    discard;
  }
  float radialMask = pow(1.0 - radialSq, 1.85);
  vec2 noiseCoord = vUv * 2.8 + vec2(vSeedPhase * 7.1, -uTime * 0.22);
  float wisp = fbmVapor(noiseCoord);
  float cloudShape = smoothstep(0.22, 0.78, wisp) * radialMask;

  float waterClearance = smoothstep(0.02, 0.32, vWorldPos.y);
  float alpha = cloudShape * vLifeAlpha * waterClearance * uSteamOpacity;
  if (alpha < 0.004) {
    discard;
  }

  vec3 lanternWest = vec3(-3.30, 0.72, -2.75);
  vec3 lanternEast = vec3(2.45, 0.74, -2.05);
  vec3 shojiFront = vec3(-0.35, 1.50, -4.25);

  float dWest = length(vWorldPos - lanternWest);
  float dEast = length(vWorldPos - lanternEast);
  float dShoji = length((vWorldPos - shojiFront) * vec3(0.45, 0.8, 0.75));

  float lanternScatter = exp(-dWest * 0.65) * 0.90 + exp(-dEast * 0.68) * 0.75 + exp(-dShoji * 0.52) * 0.65;
  float warmMix = clamp(lanternScatter * uSteamWarmWeight, 0.0, 0.85);
  vec3 steamColor = mix(uSteamBaseColor, uSteamWarmColor, clamp(warmMix * 0.55, 0.0, 0.65));
  steamColor += uSteamWarmColor * (warmMix * 0.12);

  float viewDist = length(cameraPosition - vWorldPos);
  float fogFactor = 1.0 - exp(-(uFogDensity * viewDist) * (uFogDensity * viewDist));
  steamColor = mix(steamColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

  gl_FragColor = vec4(steamColor, clamp(alpha, 0.0, 0.78));
}
`;

function createOrganicPoolDiscGeometry() {
  const radialSegments = 72;
  const ringSegments = 20;
  const positions = [];
  const uvs = [];
  const indices = [];

  positions.push(0.35, 0.0, 0.35);
  uvs.push(0.5, 0.5);

  for (let rIdx = 1; rIdx <= ringSegments; rIdx++) {
    const frac = rIdx / ringSegments;
    for (let aIdx = 0; aIdx < radialSegments; aIdx++) {
      const angle = (aIdx / radialSegments) * Math.PI * 2.0;
      const rx = 3.55;
      const rz = 3.15;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const ellipseR = (rx * rz) / Math.sqrt((rz * cosA) ** 2 + (rx * sinA) ** 2);
      const wave = 0.22 * Math.sin(2.0 * angle + 0.6) + 0.14 * Math.cos(3.0 * angle - 0.5);
      const radius = (ellipseR + wave) * frac;
      const wx = 0.35 + radius * cosA;
      const wz = 0.35 + radius * sinA;
      positions.push(wx, 0.0, wz);
      uvs.push(0.5 + 0.5 * frac * cosA, 0.5 + 0.5 * frac * sinA);
    }
  }

  for (let aIdx = 0; aIdx < radialSegments; aIdx++) {
    const nextA = (aIdx + 1) % radialSegments;
    indices.push(0, 1 + nextA, 1 + aIdx);
  }

  for (let rIdx = 0; rIdx < ringSegments - 1; rIdx++) {
    const ringStart = 1 + rIdx * radialSegments;
    const nextRingStart = 1 + (rIdx + 1) * radialSegments;
    for (let aIdx = 0; aIdx < radialSegments; aIdx++) {
      const nextA = (aIdx + 1) % radialSegments;
      const v00 = ringStart + aIdx;
      const v01 = ringStart + nextA;
      const v10 = nextRingStart + aIdx;
      const v11 = nextRingStart + nextA;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBambooPouringStreamMesh(streamMaterial) {
  const curvePoints = [];
  const startPoint = new THREE.Vector3(1.56, 0.545, -1.66);
  const endPoint = new THREE.Vector3(1.41, -0.02, -1.49);
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = THREE.MathUtils.lerp(startPoint.x, endPoint.x, t);
    const z = THREE.MathUtils.lerp(startPoint.z, endPoint.z, t);
    const y = startPoint.y * (1.0 - t * t) + endPoint.y * (t * t) + 0.04 * t * (1.0 - t);
    curvePoints.push(new THREE.Vector3(x, y, z));
  }
  const streamCurve = new THREE.CatmullRomCurve3(curvePoints);
  const tubeGeo = new THREE.TubeGeometry(streamCurve, 20, 0.026, 10, false);
  const streamMesh = new THREE.Mesh(tubeGeo, streamMaterial);
  streamMesh.renderOrder = 2;
  return streamMesh;
}

function createSteamInstancedMesh(steamMaterial) {
  const puffCount = 72;
  const basePlane = new THREE.PlaneGeometry(1.0, 1.0);
  const instancedGeometry = new THREE.InstancedBufferGeometry();
  instancedGeometry.index = basePlane.index;
  instancedGeometry.attributes.position = basePlane.attributes.position;
  instancedGeometry.attributes.uv = basePlane.attributes.uv;

  const seedPositions = new Float32Array(puffCount * 3);
  const paramsArray = new Float32Array(puffCount * 4);

  let seedValue = 1337;
  function nextRandom() {
    seedValue = (seedValue * 16807) % 2147483647;
    return (seedValue - 1) / 2147483646;
  }

  for (let i = 0; i < puffCount; i++) {
    let sx = 0.0;
    let sz = 0.0;
    let baseScale = 0.95;
    if (i < 16) {
      const angle = nextRandom() * Math.PI * 2.0;
      const dist = nextRandom() * 0.75;
      sx = -2.15 + Math.cos(angle) * dist;
      sz = -1.25 + Math.sin(angle) * dist;
      baseScale = 0.78 + nextRandom() * 0.35;
    } else if (i < 30) {
      const angle = nextRandom() * Math.PI * 2.0;
      const dist = nextRandom() * 0.65;
      sx = 1.35 + Math.cos(angle) * dist;
      sz = -1.45 + Math.sin(angle) * dist;
      baseScale = 0.75 + nextRandom() * 0.32;
    } else {
      const angle = nextRandom() * Math.PI * 2.0;
      const r = Math.sqrt(nextRandom()) * 2.35;
      sx = 0.35 + Math.cos(angle) * r;
      sz = 0.35 + Math.sin(angle) * r * 0.86;
      baseScale = 0.85 + nextRandom() * 0.42;
    }
    seedPositions[i * 3 + 0] = sx;
    seedPositions[i * 3 + 1] = 0.02;
    seedPositions[i * 3 + 2] = sz;

    const phase = (i / puffCount) + nextRandom() * 0.05;
    const speed = 0.09 + nextRandom() * 0.05;
    const driftRadius = 0.12 + nextRandom() * 0.14;

    paramsArray[i * 4 + 0] = phase;
    paramsArray[i * 4 + 1] = speed;
    paramsArray[i * 4 + 2] = baseScale;
    paramsArray[i * 4 + 3] = driftRadius;
  }

  instancedGeometry.setAttribute("aSeedPos", new THREE.InstancedBufferAttribute(seedPositions, 3));
  instancedGeometry.setAttribute("aParams", new THREE.InstancedBufferAttribute(paramsArray, 4));
  instancedGeometry.instanceCount = puffCount;

  const steamMesh = new THREE.Mesh(instancedGeometry, steamMaterial);
  steamMesh.frustumCulled = false;
  steamMesh.renderOrder = 4;
  return steamMesh;
}

export function createWaterAndSteamSystem(scene) {
  const waterUniforms = {
    uTime: { value: 0.0 },
    uDeepColor: { value: new THREE.Color(0x0e2e29) },
    uShallowColor: { value: new THREE.Color(0x1f594c) },
    uSkyReflectTint: { value: new THREE.Color(0x486da6) },
    uSunDirection: { value: new THREE.Vector3(-0.45, 0.36, 0.81).normalize() },
    uSunColor: { value: new THREE.Color(0xffffff) },
    uWarmLightColor: { value: new THREE.Color(0xff9638) },
    uWarmGlowWeight: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0x233d69) },
    uFogDensity: { value: 0.0092 }
  };

  const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false
  });

  const poolWaterGeometry = createOrganicPoolDiscGeometry();
  const poolWaterMesh = new THREE.Mesh(poolWaterGeometry, waterMaterial);
  poolWaterMesh.renderOrder = 1;
  scene.add(poolWaterMesh);

  const bucketWaterGeo1 = new THREE.CircleGeometry(0.125, 16);
  bucketWaterGeo1.rotateX(-Math.PI * 0.5);
  const bucketWater1 = new THREE.Mesh(bucketWaterGeo1, waterMaterial);
  bucketWater1.position.set(0.12, 0.445, -2.78);
  bucketWater1.renderOrder = 1;
  scene.add(bucketWater1);

  const bucketWater2 = new THREE.Mesh(bucketWaterGeo1, waterMaterial);
  bucketWater2.position.set(0.88, 0.45, -2.85);
  bucketWater2.renderOrder = 1;
  scene.add(bucketWater2);

  const streamUniforms = {
    uTime: { value: 0.0 },
    uWaterTint: { value: new THREE.Color(0x2d7564) },
    uWarmLightColor: { value: new THREE.Color(0xff9638) },
    uWarmGlowWeight: { value: 1.0 }
  };
  const streamMaterial = new THREE.ShaderMaterial({
    vertexShader: STREAM_VERTEX_SHADER,
    fragmentShader: STREAM_FRAGMENT_SHADER,
    uniforms: streamUniforms,
    transparent: true,
    depthWrite: false
  });
  const streamMesh = createBambooPouringStreamMesh(streamMaterial);
  scene.add(streamMesh);

  const steamUniforms = {
    uTime: { value: 0.0 },
    uSteamBaseColor: { value: new THREE.Color(0x88a8d4) },
    uSteamWarmColor: { value: new THREE.Color(0xff9638) },
    uSteamWarmWeight: { value: 1.1 },
    uSteamOpacity: { value: 0.52 },
    uFogColor: { value: new THREE.Color(0x233d69) },
    uFogDensity: { value: 0.0092 }
  };
  const steamMaterial = new THREE.ShaderMaterial({
    vertexShader: STEAM_VERTEX_SHADER,
    fragmentShader: STEAM_FRAGMENT_SHADER,
    uniforms: steamUniforms,
    transparent: true,
    depthWrite: false
  });
  const steamMesh = createSteamInstancedMesh(steamMaterial);
  scene.add(steamMesh);

  return {
    waterUniforms,
    streamUniforms,
    steamUniforms,
    poolWaterMesh,
    streamMesh,
    steamMesh
  };
}

export function updateWaterAndSteamSystem(waterAndSteam, state, elapsedTime) {
  const { waterUniforms, streamUniforms, steamUniforms } = waterAndSteam;

  waterUniforms.uTime.value = elapsedTime;
  waterUniforms.uDeepColor.value.copy(state.waterDeepColor);
  waterUniforms.uShallowColor.value.copy(state.waterShallowColor);
  waterUniforms.uSkyReflectTint.value.copy(state.waterSkyReflectTint);
  waterUniforms.uSunDirection.value.copy(state.sunDirection);
  waterUniforms.uSunColor.value.copy(state.sunColor);
  waterUniforms.uWarmLightColor.value.copy(state.lanternEmissiveColor);
  waterUniforms.uWarmGlowWeight.value = state.waterWarmGlowWeight;
  waterUniforms.uFogColor.value.copy(state.fogColor);
  waterUniforms.uFogDensity.value = state.fogDensity;

  streamUniforms.uTime.value = elapsedTime;
  streamUniforms.uWaterTint.value.copy(state.waterShallowColor);
  streamUniforms.uWarmLightColor.value.copy(state.lanternEmissiveColor);
  streamUniforms.uWarmGlowWeight.value = state.waterWarmGlowWeight;

  steamUniforms.uTime.value = elapsedTime;
  steamUniforms.uSteamBaseColor.value.copy(state.steamBaseColor);
  steamUniforms.uSteamWarmColor.value.copy(state.steamWarmColor);
  steamUniforms.uSteamWarmWeight.value = state.steamWarmWeight;
  steamUniforms.uSteamOpacity.value = state.steamOpacity;
  steamUniforms.uFogColor.value.copy(state.fogColor);
  steamUniforms.uFogDensity.value = state.fogDensity;
}
