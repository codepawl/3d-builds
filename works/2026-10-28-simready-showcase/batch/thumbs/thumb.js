// Renders one optimized SimReady glb to a square transparent PNG for the dataset thumbnails.
// render_thumbs.mjs calls window.renderThumbnail(name) once per asset and saves the returned data URL.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { makeLoader } from '/web/src/studio.js';

const SIZE = 512;
const FIELD_OF_VIEW = 30;
const YAW_DEGREES = 35;
const ELEVATION_DEGREES = 22;
const FILL_FRACTION = 0.86;

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

const environment = await new HDRLoader().loadAsync('/web/assets/lilienstein_2k.hdr');
environment.mapping = THREE.EquirectangularReflectionMapping;
const scene = new THREE.Scene();
scene.environment = environment;
const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.6);
keyLight.position.set(3.5, 5.5, 4.5);
scene.add(keyLight);

const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 1000);
const loader = makeLoader();

function disposeTree(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function boxCorners(box) {
  const corners = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return corners;
}

function placeCamera(target, distance, radius) {
  const yaw = THREE.MathUtils.degToRad(YAW_DEGREES);
  const elevation = THREE.MathUtils.degToRad(ELEVATION_DEGREES);
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(elevation) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.cos(yaw) * Math.cos(elevation) * distance,
  );
  camera.near = Math.max(distance - radius * 2, distance / 1000);
  camera.far = distance + radius * 2;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/**
 * Seen from the front-right and a bit above, fits the projected bounding box so its larger side fills FILL_FRACTION
 * of the frame and its centre sits in the middle. A sphere fit alone leaves compact objects small.
 */
function frameModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  const corners = boxCorners(box);
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  const target = box.getCenter(new THREE.Vector3());
  let distance = radius / Math.sin(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2));
  for (let iteration = 0; iteration < 3; iteration += 1) {
    placeCamera(target, distance, radius);
    const projected = new THREE.Box2();
    for (const corner of corners) {
      const point = corner.clone().project(camera);
      projected.expandByPoint(new THREE.Vector2(point.x, point.y));
    }
    const halfExtent = Math.max(projected.max.x - projected.min.x, projected.max.y - projected.min.y) / 2;
    const centre = projected.getCenter(new THREE.Vector2());
    const halfHeightAtTarget = Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2)) * distance;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, centre.x * halfHeightAtTarget).addScaledVector(up, centre.y * halfHeightAtTarget);
    distance *= halfExtent / FILL_FRACTION;
  }
  placeCamera(target, distance, radius);
}

window.renderThumbnail = async (assetName) => {
  const gltf = await loader.loadAsync(`/glb/${encodeURIComponent(assetName)}.glb`);
  scene.add(gltf.scene);
  frameModel(gltf.scene);
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL('image/png');
  scene.remove(gltf.scene);
  disposeTree(gltf.scene);
  return dataUrl;
};

window.__ready = true;
