// Overlap audit: every pair of paper pieces from different assemblies is tested as two oriented boxes (separating axis
// test). A pair is reported when the boxes sink into each other by more than `tolerance` centimetres along every axis.
import * as THREE from 'three';

const axisBuffer = [];

function describe(mesh) {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const columns = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  mesh.matrixWorld.extractBasis(columns[0], columns[1], columns[2]);
  const axes = columns.map((column) => column.clone().normalize());
  const scales = columns.map((column) => column.length());
  const extent = half.toArray().map((value, index) => Math.max(0.04, value * scales[index]));
  return { center, axes, extent, name: mesh.userData.label || mesh.parent?.name || mesh.name || 'mesh' };
}

function assemblyOf(mesh, stop) {
  for (let node = mesh; node && node !== stop; node = node.parent) {
    if (node.userData && node.userData.assembly) return node.userData.assembly;
  }
  return 'root';
}

function penetration(boxA, boxB) {
  const offset = boxB.center.clone().sub(boxA.center);
  const axes = [...boxA.axes, ...boxB.axes];
  for (const first of boxA.axes) for (const second of boxB.axes) axes.push(new THREE.Vector3().crossVectors(first, second));
  let smallest = Infinity;
  for (const axis of axes) {
    const length = axis.length();
    if (length < 1e-4) continue;
    axis.divideScalar(length);
    let radiusA = 0;
    let radiusB = 0;
    for (let index = 0; index < 3; index += 1) {
      radiusA += boxA.extent[index] * Math.abs(axis.dot(boxA.axes[index]));
      radiusB += boxB.extent[index] * Math.abs(axis.dot(boxB.axes[index]));
    }
    const overlap = radiusA + radiusB - Math.abs(offset.dot(axis));
    if (overlap <= 0) return 0;
    smallest = Math.min(smallest, overlap);
  }
  return smallest;
}

export function findOverlaps(root, tolerance = 0.15) {
  root.updateMatrixWorld(true);
  const boxes = [];
  root.traverse((object) => {
    if (!object.isMesh || object.userData.cheek || !object.visible) return;
    const box = describe(object);
    box.assembly = assemblyOf(object, root.parent);
    boxes.push(box);
  });
  const found = [];
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      if (boxes[first].assembly === boxes[second].assembly) continue;
      if (boxes[first].center.distanceTo(boxes[second].center) > boxes[first].extent[0] + boxes[first].extent[1] + boxes[first].extent[2] + boxes[second].extent[0] + boxes[second].extent[1] + boxes[second].extent[2]) continue;
      const depth = penetration(boxes[first], boxes[second]);
      if (depth > tolerance) found.push({ a: boxes[first].assembly, b: boxes[second].assembly, depth: Number(depth.toFixed(2)) });
    }
  }
  const summary = new Map();
  for (const item of found) {
    const key = `${item.a}|${item.b}`;
    const previous = summary.get(key);
    if (!previous || previous.depth < item.depth) summary.set(key, item);
  }
  return [...summary.values()].sort((left, right) => right.depth - left.depth).slice(0, 14);
}
