// Falling snow: points that wrap in a box around the camera, lit by the preset and the lantern.
import * as THREE from "three";
import { createSeededRandom } from "./steam.js";

const snowVertexShader = /* glsl */ `
  attribute vec4 flakeParameters;
  uniform float time;
  uniform vec3 boxSize;
  uniform float pixelScale;
  uniform vec3 lanternPosition;
  uniform vec3 lanternLight;
  uniform vec3 windowPosition;
  uniform vec3 windowLight;
  uniform vec3 snowLight;
  uniform float fogDensity;
  uniform vec3 fogColor;
  varying vec3 flakeColor;
  varying float flakeAlpha;

  void main() {
    float fallSpeed = flakeParameters.x;
    float seed = flakeParameters.y;
    vec3 drift = vec3(0.25 + 0.35 * sin(time * 0.17 + seed * 3.0), -fallSpeed, -0.12);
    vec3 moving = position + drift * time;
    moving.x += sin(time * (0.9 + seed) + seed * 40.0) * 0.18;
    moving.z += cos(time * (0.7 + seed) + seed * 23.0) * 0.18;
    vec3 relative = mod(moving - cameraPosition + boxSize * 0.5, boxSize) - boxSize * 0.5;
    vec3 world = cameraPosition + relative;
    vec4 viewPosition = viewMatrix * vec4(world, 1.0);
    float viewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
    float flakeSize = flakeParameters.z;
    gl_PointSize = clamp(flakeSize * pixelScale / max(viewDepth, 0.1), 1.0, 24.0);
    vec3 toLantern = lanternPosition - world;
    vec3 toWindow = windowPosition - world;
    vec3 light = snowLight + lanternLight / (1.0 + dot(toLantern, toLantern) * 0.7) + windowLight / (1.0 + dot(toWindow, toWindow) * 0.12);
    float fogAmount = 1.0 - exp(-fogDensity * fogDensity * viewDepth * viewDepth);
    flakeColor = mix(light, fogColor, fogAmount);
    float edgeFade = 1.0 - smoothstep(0.38, 0.5, max(abs(relative.x) / boxSize.x, abs(relative.z) / boxSize.z));
    flakeAlpha = edgeFade * smoothstep(0.25, 1.2, viewDepth) * (0.55 + 0.45 * flakeParameters.w);
  }
`;

const snowFragmentShader = /* glsl */ `
  varying vec3 flakeColor;
  varying float flakeAlpha;
  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float radial = 1.0 - smoothstep(0.15, 0.5, length(centered));
    float alpha = radial * flakeAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(flakeColor, alpha);
  }
`;

export class Snowfall {
  constructor(layout) {
    const flakeCount = 9000;
    const randomSource = createSeededRandom(1234);
    const boxSize = new THREE.Vector3(44, 22, 44);
    const positions = new Float32Array(flakeCount * 3);
    const parameters = new Float32Array(flakeCount * 4);
    for (let index = 0; index < flakeCount; index += 1) {
      positions[index * 3] = (randomSource() - 0.5) * boxSize.x;
      positions[index * 3 + 1] = randomSource() * boxSize.y;
      positions[index * 3 + 2] = (randomSource() - 0.5) * boxSize.z;
      const isLargeFlake = randomSource() < 0.12;
      parameters.set([0.55 + randomSource() * 0.6, randomSource(), isLargeFlake ? 0.045 : 0.022 + randomSource() * 0.014, randomSource()], index * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("flakeParameters", new THREE.BufferAttribute(parameters, 4));
    this.uniforms = {
      time: { value: 0 },
      boxSize: { value: boxSize },
      pixelScale: { value: 1000 },
      lanternPosition: { value: new THREE.Vector3().fromArray(layout.lights.lantern) },
      lanternLight: { value: new THREE.Color() },
      windowPosition: { value: new THREE.Vector3().fromArray(layout.lights.windowsLower[1]) },
      windowLight: { value: new THREE.Color() },
      snowLight: { value: new THREE.Color() },
      fogDensity: { value: 0.01 },
      fogColor: { value: new THREE.Color() },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: snowVertexShader,
      fragmentShader: snowFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    this.points.layers.set(1);
  }

  applyPreset(values, lanternFlicker) {
    const ambient = values.hemisphereIntensity * 0.6 + values.sunIntensity * Math.max(values.sunDirection[1], 0) * 0.25;
    this.uniforms.snowLight.value.fromArray(values.snowfallColor).multiplyScalar(0.35 + ambient);
    this.uniforms.lanternLight.value.setRGB(1.0, 0.6, 0.3).multiplyScalar(values.lanternLight * 0.35 * lanternFlicker);
    this.uniforms.windowLight.value.setRGB(1.0, 0.72, 0.45).multiplyScalar(values.windowLight * 0.08);
    this.uniforms.fogDensity.value = values.fogDensity;
    this.uniforms.fogColor.value.fromArray(values.fogColor);
  }

  update(time, viewportHeight, camera) {
    this.uniforms.time.value = time;
    const focalLength = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.uniforms.pixelScale.value = focalLength;
  }
}
