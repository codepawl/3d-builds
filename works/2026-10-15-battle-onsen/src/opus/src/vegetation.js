// Instanced pines from pines.glb with a gentle wind sway in the vertex shader.
import * as THREE from "three";

// Layer for the far forest: the main camera sees it, the water reflection camera does not.
export const FAR_FOREST_LAYER = 2;

export const windUniforms = {
  windTime: { value: 0 },
};

export function addWindSway(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windUniforms.windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 instanceOrigin = instanceMatrix[3].xyz;
        #else
          vec3 instanceOrigin = vec3(0.0);
        #endif
        float heightFactor = clamp(position.y / 10.0, 0.0, 1.0);
        float phase = instanceOrigin.x * 0.21 + instanceOrigin.z * 0.17;
        float gust = sin(windTime * 0.6 + phase) * 0.5 + 0.5;
        float sway = sin(windTime * 1.3 + phase * 3.0) * (0.5 + gust);
        float flutter = sin(windTime * 4.1 + position.x * 2.0 + position.z * 2.0 + phase) * 0.15;
        transformed.x += (sway + flutter) * ${strength.toFixed(3)} * heightFactor * heightFactor;
        transformed.z += (sway * 0.6 - flutter) * ${strength.toFixed(3)} * heightFactor * heightFactor;`
      );
  };
}

function buildInstanceMatrices(entries) {
  const dummy = new THREE.Object3D();
  return entries.map((entry) => {
    dummy.position.fromArray(entry.position);
    dummy.rotation.set(0, entry.rotation, 0);
    dummy.scale.setScalar(entry.scale);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
}

// Needle sprays are alpha-tested cards. Alpha to coverage uses the shared look's 4x MSAA to soften their edges.
export function prepareFrondMaterial(material) {
  material.transparent = false;
  material.alphaTest = 0.5;
  material.alphaToCoverage = true;
  material.depthWrite = true;
  material.side = THREE.DoubleSide;
}

// The far forest is split into angular sectors and distance bands, each its own instanced mesh with its own
// bounding sphere, so the renderer culls the sectors behind the camera in every pass of the frame.
const SECTOR_COUNT = 16;
const BAND_EDGES = [0, 70, 1000];

function chunkBySector(entries) {
  const chunks = new Map();
  for (const entry of entries) {
    const [pointX, , pointZ] = entry.position;
    const angle = Math.atan2(pointZ, pointX) + Math.PI;
    const sector = Math.min(SECTOR_COUNT - 1, Math.floor((angle / (Math.PI * 2)) * SECTOR_COUNT));
    const distance = Math.hypot(pointX, pointZ);
    const band = BAND_EDGES.findIndex((edge, index) => distance >= edge && distance < BAND_EDGES[index + 1]);
    const key = sector * BAND_EDGES.length + band;
    if (!chunks.has(key)) {
      chunks.set(key, { band, entries: [] });
    }
    chunks.get(key).entries.push(entry);
  }
  return [...chunks.values()];
}

// Ambient occlusion and depth of field redraw the scene with an override material, which would draw every
// needle card of the far forest as a solid quad. At 30 m and beyond the forest needs neither, so it is skipped.
function keepOutOfOverridePasses(instanced) {
  const instanceCount = instanced.count;
  instanced.onBeforeRender = (renderer, scene) => {
    instanced.count = scene.overrideMaterial ? 0 : instanceCount;
  };
}

function instancedFromMesh(sourceMesh, matrices, castShadow, swayStrength) {
  const material = sourceMesh.material.clone();
  if (material.name === "frond") {
    prepareFrondMaterial(material);
  }
  addWindSway(material, swayStrength);
  const instanced = new THREE.InstancedMesh(sourceMesh.geometry, material, matrices.length);
  matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
  instanced.instanceMatrix.needsUpdate = true;
  instanced.computeBoundingSphere();
  instanced.castShadow = castShadow;
  instanced.receiveShadow = true;
  return instanced;
}

export function createPines(pinesScene, layout) {
  const meshesByVariant = { pine_a: [], pine_b: [], pine_far: [], pine_distant: [] };
  pinesScene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    const variantName = Object.keys(meshesByVariant).find((name) => child.name.startsWith(name));
    if (variantName) {
      meshesByVariant[variantName].push(child);
    }
  });
  const group = new THREE.Group();
  const nearByVariant = [[], []];
  for (const entry of layout.nearPines) {
    nearByVariant[entry.variant].push(entry);
  }
  const nearVariantNames = ["pine_a", "pine_b"];
  nearVariantNames.forEach((variantName, variantIndex) => {
    const matrices = buildInstanceMatrices(nearByVariant[variantIndex]);
    for (const sourceMesh of meshesByVariant[variantName]) {
      group.add(instancedFromMesh(sourceMesh, matrices, true, 0.12));
    }
  });
  for (const chunk of chunkBySector(layout.farPines)) {
    const chunkMatrices = buildInstanceMatrices(chunk.entries);
    const variantName = chunk.band === 0 ? "pine_far" : "pine_distant";
    for (const sourceMesh of meshesByVariant[variantName]) {
      const instanced = instancedFromMesh(sourceMesh, chunkMatrices, false, 0.08);
      keepOutOfOverridePasses(instanced);
      instanced.layers.set(FAR_FOREST_LAYER);
      group.add(instanced);
    }
  }
  return group;
}
