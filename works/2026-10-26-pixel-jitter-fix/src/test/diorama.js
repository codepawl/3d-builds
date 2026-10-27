// A small procedural diorama (textured ground, painted lines, window-textured buildings, a driving truck) and one
// camera path: slow pan, slow zoom, short orbit. Every value is a function of time.
import * as THREE from 'three';

export const DURATION = 10;
const PAN_END = 3;
const ZOOM_END = 6.5;
const BASE_AZIMUTH = 0.75;
const BASE_ELEVATION = 0.55;

function smoothstep(edge0, edge1, value) {
  const clamped = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return clamped * clamped * (3 - 2 * clamped);
}

export function cameraViewAt(time) {
  const pan = smoothstep(0, PAN_END, time);
  const zoom = smoothstep(PAN_END, ZOOM_END, time);
  const orbit = smoothstep(ZOOM_END, DURATION, time);
  return {
    target: [-5 + 10 * pan, 0, -3 + 6 * pan],
    azimuth: BASE_AZIMUTH + 0.5 * orbit,
    elevation: BASE_ELEVATION,
    distance: 80,
    zoom: 1 + 0.5 * zoom,
    rotating: time > ZOOM_END && time < DURATION,
  };
}

export function vehiclePositionAt(time) {
  return new THREE.Vector3(-14 + 2.6 * time, 0, 2.2);
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function makeTexture(size, paint, repeatX, repeatY) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function groundTexture() {
  const random = seededRandom(7);
  return makeTexture(128, (context, size) => {
    context.fillStyle = '#6f8f5a';
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < 900; index++) {
      const shade = 90 + Math.floor(random() * 70);
      context.fillStyle = `rgb(${shade - 20},${shade + 30},${shade - 30})`;
      context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1 + Math.floor(random() * 2), 1);
    }
  }, 20, 20);
}

function wallTexture(wallColor, repeatX, repeatY) {
  return makeTexture(64, (context, size) => {
    context.fillStyle = wallColor;
    context.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        context.fillStyle = '#2d3b52';
        context.fillRect(column * 16 + 3, row * 16 + 4, 10, 8);
        context.fillStyle = '#e9d9a0';
        context.fillRect(column * 16 + 5, row * 16 + 5, 6, 3);
      }
    }
  }, repeatX, repeatY);
}

function addBuilding(scene, x, z, width, depth, height, wallColor, roofColor) {
  const sideMaterial = new THREE.MeshLambertMaterial({ map: wallTexture(wallColor, width / 4, height / 4) });
  const frontMaterial = new THREE.MeshLambertMaterial({ map: wallTexture(wallColor, depth / 4, height / 4) });
  const roofMaterial = new THREE.MeshLambertMaterial({ color: roofColor });
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    [frontMaterial, frontMaterial, roofMaterial, roofMaterial, sideMaterial, sideMaterial],
  );
  building.position.set(x, height / 2, z);
  scene.add(building);
}

export function buildDiorama() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ec5e8');
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9a80', 3.2));
  const sun = new THREE.DirectionalLight('#fff2d8', 3.4);
  sun.position.set(-30, 50, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const asphalt = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 6), new THREE.MeshLambertMaterial({ color: '#454c57' }));
  asphalt.position.set(0, 0.05, 2.2);
  scene.add(asphalt);
  const paint = new THREE.MeshBasicMaterial({ color: '#f2efe6' });
  for (let index = -28; index < 28; index++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.15), paint);
    dash.position.set(index * 2 + 0.6, 0.11, 2.2);
    scene.add(dash);
  }
  for (const edgeZ of [-0.6, 5.0]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(60, 0.02, 0.1), paint);
    edge.position.set(0, 0.11, edgeZ);
    scene.add(edge);
  }

  addBuilding(scene, -7, -6, 6, 4, 5, '#c8a27a', '#8c3f3a');
  addBuilding(scene, 1, -8, 4, 5, 8, '#b9c4cf', '#4a5a74');
  addBuilding(scene, 8, -5, 7, 4, 3.5, '#d9c9a3', '#6a5a4a');
  addBuilding(scene, -2, 10, 8, 4, 4, '#a9b9a0', '#5a6a58');
  addBuilding(scene, 9, 9, 4, 4, 6, '#cfa9a9', '#7a4a52');
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), new THREE.MeshLambertMaterial({ color: '#8a8f98' }));
  pole.position.set(-11, 3, 6);
  scene.add(pole);

  const vehicle = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: '#e0883a' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.6), bodyMaterial);
  body.position.set(-0.4, 1.0, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.5), new THREE.MeshLambertMaterial({ color: '#f1efe9' }));
  cab.position.set(1.8, 0.9, 0);
  vehicle.add(body, cab);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: '#23262c' });
  for (const wheelX of [-1.4, 1.6]) {
    for (const wheelZ of [-0.8, 0.8]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wheelX, 0.4, wheelZ);
      vehicle.add(wheel);
    }
  }
  scene.add(vehicle);
  return { scene, vehicle };
}
