// Hot spring water: rippled, slightly green, with a half-resolution planar reflection.
import * as THREE from "three";

function buildPoolGeometry(outline, waterLevel) {
  const ringCount = 10;
  const centerX = outline.reduce((sum, point) => sum + point[0], 0) / outline.length;
  const centerZ = outline.reduce((sum, point) => sum + point[1], 0) / outline.length;
  const positions = [centerX, waterLevel, centerZ];
  const depthFactors = [1];
  for (let ringIndex = 1; ringIndex <= ringCount; ringIndex += 1) {
    const fraction = ringIndex / ringCount;
    // Push the outer ring a little past the outline so the water tucks under the rim rocks.
    const reach = fraction * 1.04;
    for (const [pointX, pointZ] of outline) {
      positions.push(centerX + (pointX - centerX) * reach, waterLevel, centerZ + (pointZ - centerZ) * reach);
      depthFactors.push(1 - fraction * fraction);
    }
  }
  const indices = [];
  const pointCount = outline.length;
  for (let index = 0; index < pointCount; index += 1) {
    const next = (index + 1) % pointCount;
    indices.push(0, 1 + next, 1 + index);
  }
  for (let ringIndex = 1; ringIndex < ringCount; ringIndex += 1) {
    const innerStart = 1 + (ringIndex - 1) * pointCount;
    const outerStart = 1 + ringIndex * pointCount;
    for (let index = 0; index < pointCount; index += 1) {
      const next = (index + 1) % pointCount;
      indices.push(innerStart + index, innerStart + next, outerStart + index);
      indices.push(innerStart + next, outerStart + next, outerStart + index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("depthFactor", new THREE.Float32BufferAttribute(depthFactors, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  for (let index = 0; index < normals.count; index += 1) {
    normals.setXYZ(index, 0, 1, 0);
  }
  return geometry;
}

const waterHeightGlsl = /* glsl */ `
  uniform float waterTime;
  uniform vec2 spoutPoint;
  float waterHeight(vec2 point) {
    float height = 0.0;
    height += sin(dot(point, vec2(0.8, 0.6)) * 3.1 + waterTime * 1.3) * 0.006;
    height += sin(dot(point, vec2(-0.5, 0.86)) * 4.7 + waterTime * 1.7) * 0.004;
    height += sin(dot(point, vec2(0.95, -0.3)) * 7.3 + waterTime * 2.3) * 0.0025;
    height += sin(dot(point, vec2(-0.2, -0.98)) * 11.0 + waterTime * 2.9) * 0.0015;
    float spoutDistance = length(point - spoutPoint);
    height += sin(spoutDistance * 16.0 - waterTime * 7.0) * 0.012 * exp(-spoutDistance * 1.1);
    return height;
  }
  vec3 waterNormal(vec2 point) {
    float step = 0.03;
    float heightRight = waterHeight(point + vec2(step, 0.0));
    float heightLeft = waterHeight(point - vec2(step, 0.0));
    float heightFront = waterHeight(point + vec2(0.0, step));
    float heightBack = waterHeight(point - vec2(0.0, step));
    return normalize(vec3(heightLeft - heightRight, 2.0 * step, heightBack - heightFront));
  }
`;

export class Water {
  constructor(layout, renderer) {
    this.renderer = renderer;
    this.waterLevel = layout.waterLevel;
    const geometry = buildPoolGeometry(layout.poolOutline, layout.waterLevel);
    this.reflectionTarget = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
    this.textureMatrix = new THREE.Matrix4();
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.uniforms = {
      waterTime: { value: 0 },
      spoutPoint: { value: new THREE.Vector2(layout.lights.spoutEnd[0], layout.lights.spoutEnd[2]) },
      reflectionMap: { value: this.reflectionTarget.texture },
      reflectionMatrix: { value: this.textureMatrix },
      deepColor: { value: new THREE.Color(0.05, 0.12, 0.1) },
      reflectionStrength: { value: 1.0 },
    };
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.2, 0.36, 0.3),
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      envMapIntensity: 0.25,
    });
    this.material.onBeforeCompile = (shader) => this.patchShader(shader);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 10;
    this.mesh.receiveShadow = true;
    this.mesh.layers.set(1);
    this.reflectorPlane = new THREE.Plane();
    this.clipPlane = new THREE.Vector4();
  }

  patchShader(shader) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float depthFactor;
        uniform mat4 reflectionMatrix;
        varying float vDepthFactor;
        varying vec3 vWaterWorld;
        varying vec4 vReflectionCoordinate;`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 waterWorldPosition = modelMatrix * vec4(transformed, 1.0);
        vWaterWorld = waterWorldPosition.xyz;
        vDepthFactor = depthFactor;
        vReflectionCoordinate = reflectionMatrix * waterWorldPosition;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D reflectionMap;
        uniform vec3 deepColor;
        uniform float reflectionStrength;
        varying float vDepthFactor;
        varying vec3 vWaterWorld;
        varying vec4 vReflectionCoordinate;
        ${waterHeightGlsl}`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 waterWorldNormal = waterNormal(vWaterWorld.xz);
        normal = normalize((viewMatrix * vec4(waterWorldNormal, 0.0)).xyz);`
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 viewToSurface = normalize(vWaterWorld - cameraPosition);
        float facing = clamp(dot(-viewToSurface, waterWorldNormal), 0.0, 1.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
        vec2 distortion = waterWorldNormal.xz * 0.35;
        vec4 distortedCoordinate = vReflectionCoordinate;
        distortedCoordinate.xy += distortion * distortedCoordinate.w * 0.25;
        vec3 reflection = texture2DProj(reflectionMap, distortedCoordinate).rgb;
        float depthTint = smoothstep(0.0, 1.0, vDepthFactor);
        vec3 bodyColor = mix(outgoingLight, deepColor * (outgoingLight + 0.02) * 4.0, depthTint * 0.4);
        vec3 surfaceColor = bodyColor + reflection * fresnel * reflectionStrength;
        float bodyAlpha = mix(0.32, 0.72, depthTint);
        float alpha = clamp(bodyAlpha + fresnel * 0.6, 0.0, 1.0);
        diffuseColor.a = alpha;
        outgoingLight = surfaceColor;
        #include <opaque_fragment>`
      );
  }

  applyPreset(values) {
    this.material.color.fromArray(values.waterColor);
    this.uniforms.deepColor.value.fromArray(values.waterColor).multiplyScalar(0.5);
  }

  update(time) {
    this.uniforms.waterTime.value = time;
  }

  setSize(width, height) {
    this.reflectionTarget.setSize(Math.max(2, Math.floor(width / 2)), Math.max(2, Math.floor(height / 2)));
  }

  renderReflection(renderer, scene, camera) {
    const reflectorPosition = new THREE.Vector3(0, this.waterLevel, 0);
    const normal = new THREE.Vector3(0, 1, 0);
    const cameraPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (cameraPosition.y < this.waterLevel + 0.02) {
      return;
    }
    const rotationMatrix = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const mirroredPosition = cameraPosition.clone().sub(reflectorPosition).reflect(normal).negate().add(reflectorPosition);
    const lookAtPosition = new THREE.Vector3(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraPosition);
    const target = reflectorPosition.clone().sub(lookAtPosition).reflect(normal).negate().add(reflectorPosition);
    const virtualCamera = this.virtualCamera;
    virtualCamera.position.copy(mirroredPosition);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = camera.far;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    virtualCamera.layers.set(0);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(virtualCamera.projectionMatrix);
    this.textureMatrix.multiply(virtualCamera.matrixWorldInverse);

    this.reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorPosition);
    this.reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    this.clipPlane.set(this.reflectorPlane.normal.x, this.reflectorPlane.normal.y, this.reflectorPlane.normal.z, this.reflectorPlane.constant);
    const projection = virtualCamera.projectionMatrix.elements;
    const corner = new THREE.Vector4(
      (Math.sign(this.clipPlane.x) + projection[8]) / projection[0],
      (Math.sign(this.clipPlane.y) + projection[9]) / projection[5],
      -1.0,
      (1.0 + projection[10]) / projection[14]
    );
    this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(corner));
    const clipBias = 0.003;
    projection[2] = this.clipPlane.x;
    projection[6] = this.clipPlane.y;
    projection[10] = this.clipPlane.z + 1.0 - clipBias;
    projection[14] = this.clipPlane.w;

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.reflectionTarget);
    renderer.clear();
    renderer.render(scene, virtualCamera);
    renderer.setRenderTarget(previousTarget);
  }
}
