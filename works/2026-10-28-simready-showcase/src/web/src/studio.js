// Shared clean PBR look: the studio HDRI, ACES tone mapping and one camera framing function.
// The film and the load-time measurement page both use it, so a captured still matches a live render.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.mjs';

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FIELD_OF_VIEW = 30;

export function makeStudioRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export async function loadEnvironment(url = './assets/lilienstein_2k.hdr') {
  const texture = await new HDRLoader().loadAsync(url);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function makeStudioScene(environment) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  const key = new THREE.DirectionalLight(0xfff2e0, 1.6);
  key.position.set(3.5, 5.5, 4.5);
  scene.add(key);
  return scene;
}

export function makeLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

/** Puts the camera on an orbit around the box centre. Distance is fitted to the box radius; zoom > 1 moves in. */
export function frameBox(camera, box, yawDegrees, elevationDegrees, zoom = 1, centreShift = new THREE.Vector3()) {
  const centre = box.getCenter(new THREE.Vector3()).add(centreShift);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2)) / zoom;
  const yaw = THREE.MathUtils.degToRad(yawDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  camera.position.set(
    centre.x + Math.sin(yaw) * Math.cos(elevation) * distance,
    centre.y + Math.sin(elevation) * distance,
    centre.z + Math.cos(yaw) * Math.cos(elevation) * distance,
  );
  camera.near = radius / 100;
  camera.far = radius * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(centre);
}
