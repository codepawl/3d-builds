import * as THREE from "three";

const SNOWFLAKE_VERTEX_SHADER = `
attribute vec3 aInitialPos;
attribute vec4 aFlakeParams;

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vAlpha;

void main() {
  vUv = uv;
  float fallSpeed = aFlakeParams.x;
  float swayPhase = aFlakeParams.y;
  float flakeSize = aFlakeParams.z;
  float swayAmp = aFlakeParams.w;

  float boxHeight = 13.5;
  float wrappedY = mod(aInitialPos.y - uTime * fallSpeed, boxHeight) - 0.2;
  float driftX = sin(uTime * 0.85 + swayPhase) * swayAmp + sin(uTime * 0.25) * 0.45;
  float driftZ = cos(uTime * 0.72 + swayPhase * 1.3) * swayAmp;

  vec3 flakeCenter = vec3(
    aInitialPos.x + driftX,
    wrappedY,
    aInitialPos.z + driftZ
  );

  vec3 toCam = cameraPosition - flakeCenter;
  float camDist = length(toCam);
  vec3 viewDir = toCam / max(camDist, 1e-4);
  vec3 rightVec = normalize(cross(vec3(0.0, 1.0, 0.0), viewDir));
  vec3 upVec = cross(viewDir, rightVec);

  vec3 worldVertex = flakeCenter + (rightVec * position.x + upVec * position.y) * flakeSize;
  vWorldPos = worldVertex;

  float heightFade = smoothstep(-0.1, 0.45, wrappedY) * (1.0 - smoothstep(11.5, 13.5, wrappedY));
  float distFade = 1.0 - smoothstep(14.0, 24.0, camDist);
  vAlpha = heightFade * distFade;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldVertex, 1.0);
}
`;

const SNOWFLAKE_FRAGMENT_SHADER = `
uniform vec3 uSnowTint;
uniform vec3 uWarmColor;
uniform float uWarmWeight;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vAlpha;

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float rSq = dot(centered, centered);
  if (rSq > 1.0 || vAlpha < 0.01) {
    discard;
  }
  float softCore = pow(1.0 - rSq, 1.8);
  vec3 lanternWest = vec3(-3.30, 0.72, -2.75);
  vec3 lanternEast = vec3(2.45, 0.74, -2.05);
  float dWest = length(vWorldPos - lanternWest);
  float dEast = length(vWorldPos - lanternEast);
  float warmGlow = (exp(-dWest * 0.75) + exp(-dEast * 0.78)) * uWarmWeight;

  vec3 flakeColor = mix(uSnowTint, uWarmColor, clamp(warmGlow * 0.45, 0.0, 0.55));
  gl_FragColor = vec4(flakeColor, softCore * vAlpha * 0.82);
}
`;

export function createWeatherAndWindSystem(scene) {
  const flakeCount = 2200;
  const baseQuad = new THREE.PlaneGeometry(1.0, 1.0);
  const instancedGeo = new THREE.InstancedBufferGeometry();
  instancedGeo.index = baseQuad.index;
  instancedGeo.attributes.position = baseQuad.attributes.position;
  instancedGeo.attributes.uv = baseQuad.attributes.uv;

  const initialPos = new Float32Array(flakeCount * 3);
  const flakeParams = new Float32Array(flakeCount * 4);

  let rngState = 98765;
  function nextRand() {
    rngState = (rngState * 16807) % 2147483647;
    return (rngState - 1) / 2147483646;
  }

  for (let i = 0; i < flakeCount; i++) {
    initialPos[i * 3 + 0] = (nextRand() - 0.5) * 28.0;
    initialPos[i * 3 + 1] = nextRand() * 13.5;
    initialPos[i * 3 + 2] = (nextRand() - 0.5) * 28.0;

    flakeParams[i * 4 + 0] = 0.65 + nextRand() * 0.65;
    flakeParams[i * 4 + 1] = nextRand() * Math.PI * 2.0;
    flakeParams[i * 4 + 2] = 0.024 + nextRand() * 0.032;
    flakeParams[i * 4 + 3] = 0.18 + nextRand() * 0.32;
  }

  instancedGeo.setAttribute("aInitialPos", new THREE.InstancedBufferAttribute(initialPos, 3));
  instancedGeo.setAttribute("aFlakeParams", new THREE.InstancedBufferAttribute(flakeParams, 4));
  instancedGeo.instanceCount = flakeCount;

  const snowUniforms = {
    uTime: { value: 0.0 },
    uSnowTint: { value: new THREE.Color(0x9cb8e0) },
    uWarmColor: { value: new THREE.Color(0xff9638) },
    uWarmWeight: { value: 1.0 }
  };

  const snowMaterial = new THREE.ShaderMaterial({
    vertexShader: SNOWFLAKE_VERTEX_SHADER,
    fragmentShader: SNOWFLAKE_FRAGMENT_SHADER,
    uniforms: snowUniforms,
    transparent: true,
    depthWrite: false
  });

  const snowMesh = new THREE.Mesh(instancedGeo, snowMaterial);
  snowMesh.frustumCulled = false;
  snowMesh.renderOrder = 5;
  scene.add(snowMesh);

  const windSharedUniform = { value: 0.0 };

  return {
    snowUniforms,
    snowMesh,
    windSharedUniform
  };
}

export function attachPineWindShader(material, windSharedUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windSharedUniform;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      uniform float uWindTime;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float swayHeight = clamp((position.y - 1.2) * 0.18, 0.0, 1.0);
      float swayWave = sin(uWindTime * 1.15 + position.x * 0.55 + position.z * 0.45) * 0.055 * swayHeight;
      transformed.x += swayWave;
      transformed.z += swayWave * 0.6;`
    );
  };
  material.needsUpdate = true;
}

export function updateWeatherAndWindSystem(weatherSystem, state, elapsedTime) {
  weatherSystem.snowUniforms.uTime.value = elapsedTime;
  weatherSystem.snowUniforms.uSnowTint.value.copy(state.snowTint);
  weatherSystem.snowUniforms.uWarmColor.value.copy(state.lanternEmissiveColor);
  weatherSystem.snowUniforms.uWarmWeight.value = state.steamWarmWeight;
  weatherSystem.windSharedUniform.value = elapsedTime;
}
