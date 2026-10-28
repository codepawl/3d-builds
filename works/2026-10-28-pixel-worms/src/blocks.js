// Shared helpers for building the hazards and opponents out of boxes in the Kenney-like low-poly style.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeToonMaterial, addAccentTag } from './look.js';

const solidMaterials = new Map();
export function solid(color) {
  if (!solidMaterials.has(color)) solidMaterials.set(color, makeToonMaterial({ color }));
  return solidMaterials.get(color);
}

export function box(width, height, depth, color, x = 0, y = 0, z = 0, materialFor = solid) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materialFor(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// One shared material for every baked model: the colour lives in the vertices.
const bakedMaterials = new Map();
function bakedBoxMaterial(accent) {
  if (!bakedMaterials.has(accent)) {
    const material = makeToonMaterial({ vertexColors: true });
    bakedMaterials.set(accent, accent ? addAccentTag(material) : material);
  }
  return bakedMaterials.get(accent);
}

// Merges the plain boxes inside every group of a model into one mesh per group, so a model of 40 boxes is a handful of draw
// calls instead of 40 (and the same again in the shadow pass). Groups keep their own transforms, so a head, a wing or a wheel
// still animates as a whole. Boxes in `keep` (a jaw that swings on its own) stay separate.
// `accent` keeps the model's own colours through the quiet-world grade (a red mower on grey-green land).
export function bakeBoxes(root, keep = [], accent = false) {
  const groups = [];
  root.traverse((node) => {
    if (node.isGroup || node === root) groups.push(node);
  });
  for (const group of groups) {
    const boxes = group.children.filter((child) => child.isMesh && child.geometry.type === 'BoxGeometry' && !keep.includes(child));
    if (boxes.length === 0) continue;
    const pieces = boxes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) mesh.material.color.toArray(colors, vertex * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    });
    const merged = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    for (const mesh of boxes) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    const baked = new THREE.Mesh(merged, bakedBoxMaterial(accent));
    baked.castShadow = true;
    baked.receiveShadow = true;
    baked.frustumCulled = false;
    group.add(baked);
  }
  return root;
}
