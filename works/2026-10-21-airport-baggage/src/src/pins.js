import * as THREE from 'three';

// DOM pins that float over 3D objects. The render loop moves them, React only mounts them.
export const pinRegistry = new Map();
const projected = new THREE.Vector3();

export function updatePins(camera, width, height) {
  for (const pin of pinRegistry.values()) {
    const world = pin.getPosition();
    if (!world) {
      pin.element.style.opacity = '0';
      continue;
    }
    projected.copy(world).project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
    pin.element.style.opacity = visible ? '1' : '0';
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    pin.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}
