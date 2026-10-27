// Water pouring from the bamboo spout: a falling ribbon tube and a splash of droplets where it lands.
import * as THREE from "three";
import { valueNoiseGlsl } from "./glsl.js";
import { createSeededRandom } from "./steam.js";

const streamVertexShader = /* glsl */ `
  varying vec2 streamUv;
  varying vec3 streamWorld;
  varying vec3 streamNormal;
  void main() {
    streamUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    streamWorld = world.xyz;
    streamNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const streamFragmentShader = /* glsl */ `
  uniform float time;
  uniform vec3 ambientLight;
  uniform vec3 highlightLight;
  varying vec2 streamUv;
  varying vec3 streamWorld;
  varying vec3 streamNormal;
  ${valueNoiseGlsl}
  void main() {
    float streaks = fractalNoise(vec2(streamUv.y * 6.0, streamUv.x * 40.0 - time * 9.0));
    vec3 viewDirection = normalize(cameraPosition - streamWorld);
    float rim = 1.0 - abs(dot(viewDirection, normalize(streamNormal)));
    float alpha = clamp(0.25 + 0.55 * rim + 0.35 * streaks, 0.0, 0.9);
    alpha *= smoothstep(1.0, 0.92, streamUv.x);
    vec3 color = ambientLight * (0.7 + 0.6 * streaks) + highlightLight * pow(rim, 3.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

const splashVertexShader = /* glsl */ `
  attribute vec4 dropParameters;
  uniform float time;
  uniform vec3 impactPoint;
  uniform float pixelScale;
  varying float dropAlpha;
  void main() {
    float lifetime = 0.55 + dropParameters.w * 0.35;
    float age = fract((time + dropParameters.z * 3.0) / lifetime);
    vec3 velocity = vec3(dropParameters.x, 0.9 + dropParameters.w * 0.9, dropParameters.y);
    vec3 world = impactPoint + velocity * age * lifetime - vec3(0.0, 4.9, 0.0) * pow(age * lifetime, 2.0);
    world.y = max(world.y, impactPoint.y);
    vec4 viewPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(0.018 * pixelScale / max(-viewPosition.z, 0.1), 1.0, 24.0);
    dropAlpha = 1.0 - age;
  }
`;

const splashFragmentShader = /* glsl */ `
  uniform vec3 ambientLight;
  varying float dropAlpha;
  void main() {
    float radial = 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(ambientLight * 1.2, radial * dropAlpha * 0.8);
  }
`;

export class Spout {
  constructor(layout) {
    const spoutEnd = new THREE.Vector3().fromArray(layout.lights.spoutEnd);
    const spoutStart = new THREE.Vector3(-3.75, 1.08, -4.05);
    const direction = spoutEnd.clone().sub(spoutStart).normalize();
    const exitVelocity = direction.multiplyScalar(0.9);
    const points = [];
    let impactPoint = spoutEnd.clone();
    for (let step = 0; step <= 30; step += 1) {
      const elapsed = step * 0.02;
      const point = spoutEnd.clone().addScaledVector(exitVelocity, elapsed);
      point.y -= 4.9 * elapsed * elapsed;
      points.push(point);
      impactPoint = point;
      if (point.y < layout.waterLevel) {
        break;
      }
    }
    impactPoint.y = layout.waterLevel + 0.01;
    this.impactPoint = impactPoint;
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.TubeGeometry(curve, 48, 0.018, 10, false);
    const flare = tube.attributes.position;
    const uvs = tube.attributes.uv;
    for (let index = 0; index < flare.count; index += 1) {
      const along = uvs.getX(index);
      const curvePoint = curve.getPointAt(Math.min(1, along));
      const widen = 1.0 + along * 0.6;
      flare.setXYZ(
        index,
        curvePoint.x + (flare.getX(index) - curvePoint.x) * widen,
        curvePoint.y + (flare.getY(index) - curvePoint.y) * widen,
        curvePoint.z + (flare.getZ(index) - curvePoint.z) * widen * 1.6
      );
    }
    this.uniforms = {
      time: { value: 0 },
      ambientLight: { value: new THREE.Color() },
      highlightLight: { value: new THREE.Color() },
      impactPoint: { value: impactPoint },
      pixelScale: { value: 1000 },
    };
    const streamMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: streamVertexShader,
      fragmentShader: streamFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    const stream = new THREE.Mesh(tube, streamMaterial);
    stream.renderOrder = 15;
    this.group.add(stream);
    this.group.add(this.createSplash());
    this.group.traverse((child) => child.layers.set(1));
  }

  createSplash() {
    const dropCount = 70;
    const randomSource = createSeededRandom(55);
    const positions = new Float32Array(dropCount * 3);
    const parameters = new Float32Array(dropCount * 4);
    for (let index = 0; index < dropCount; index += 1) {
      const angle = randomSource() * Math.PI * 2;
      const speed = 0.2 + randomSource() * 0.45;
      parameters.set([Math.cos(angle) * speed, Math.sin(angle) * speed, randomSource(), randomSource()], index * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("dropParameters", new THREE.BufferAttribute(parameters, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: splashVertexShader,
      fragmentShader: splashFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const splash = new THREE.Points(geometry, material);
    splash.frustumCulled = false;
    splash.renderOrder = 16;
    return splash;
  }

  applyPreset(values) {
    const ambient = values.hemisphereIntensity * 0.5 + values.sunIntensity * Math.max(values.sunDirection[1], 0) * 0.2 + 0.05;
    this.uniforms.ambientLight.value.fromArray(values.skyHorizon).multiplyScalar(ambient);
    this.uniforms.highlightLight.value.fromArray(values.sunColor).multiplyScalar(values.sunIntensity * 0.25 + values.lanternLight * 0.03);
  }

  update(time, focalLength) {
    this.uniforms.time.value = time;
    this.uniforms.pixelScale.value = focalLength;
  }
}
