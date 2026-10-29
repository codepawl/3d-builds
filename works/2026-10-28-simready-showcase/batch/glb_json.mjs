// Reads and writes a glb's JSON chunk without touching the binary chunk, plus the 4x4 matrix helpers that the
// JSON-only edits (remove_prototypes.mjs, add_physics.mjs) need. Matrices are glTF column-major arrays of 16.
import { readFileSync, writeFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

export function readGlb(path) {
  const buffer = readFileSync(path);
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path} is not a glb`);
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== JSON_CHUNK) throw new Error(`${path} has no JSON chunk first`);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const rest = buffer.subarray(20 + jsonLength); // binary chunk header and data, kept byte for byte
  return { gltf, rest };
}

export function writeGlb(path, gltf, rest) {
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const padding = (4 - (json.length % 4)) % 4;
  json = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + rest.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(JSON_CHUNK, 16);
  writeFileSync(path, Buffer.concat([header, json, rest]));
}

/** "arm_01_mesh_00.001" -> "arm_01_mesh_00": Blender suffixes a repeated object name. */
export function baseName(name) {
  return (name ?? '').replace(/\.\d+$/, '');
}

export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiply(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
    }
  }
  return result;
}

/** Rotation matrix of a unit quaternion given as [x, y, z, w]. */
export function quaternionMatrix([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
}

export function composeMatrix(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
  const matrix = quaternionMatrix(rotation);
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 3; row += 1) matrix[column * 4 + row] *= scale[column];
  }
  matrix[12] = translation[0];
  matrix[13] = translation[1];
  matrix[14] = translation[2];
  return matrix;
}

export function localMatrix(node) {
  if (node.matrix) return node.matrix;
  return composeMatrix(node.translation, node.rotation, node.scale);
}

export function invert(matrix) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = matrix;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  const scale = 1 / determinant;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * scale,
    (a02 * b10 - a01 * b11 - a03 * b09) * scale,
    (a31 * b05 - a32 * b04 + a33 * b03) * scale,
    (a22 * b04 - a21 * b05 - a23 * b03) * scale,
    (a12 * b08 - a10 * b11 - a13 * b07) * scale,
    (a00 * b11 - a02 * b08 + a03 * b07) * scale,
    (a32 * b02 - a30 * b05 - a33 * b01) * scale,
    (a20 * b05 - a22 * b02 + a23 * b01) * scale,
    (a10 * b10 - a11 * b08 + a13 * b06) * scale,
    (a01 * b08 - a00 * b10 - a03 * b06) * scale,
    (a30 * b04 - a31 * b02 + a33 * b00) * scale,
    (a21 * b02 - a20 * b04 - a23 * b00) * scale,
    (a11 * b07 - a10 * b09 - a12 * b06) * scale,
    (a00 * b09 - a01 * b07 + a02 * b06) * scale,
    (a31 * b01 - a30 * b03 - a32 * b00) * scale,
    (a20 * b03 - a21 * b01 + a22 * b00) * scale,
  ];
}

/** Splits a matrix without shear into translation, rotation [x, y, z, w] and scale. */
export function decompose(matrix) {
  const translation = [matrix[12], matrix[13], matrix[14]];
  const scale = [0, 1, 2].map((column) => Math.hypot(matrix[column * 4], matrix[column * 4 + 1], matrix[column * 4 + 2]));
  const r = (row, column) => matrix[column * 4 + row] / scale[column];
  const trace = r(0, 0) + r(1, 1) + r(2, 2);
  let rotation;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    rotation = [(r(2, 1) - r(1, 2)) * s, (r(0, 2) - r(2, 0)) * s, (r(1, 0) - r(0, 1)) * s, 0.25 / s];
  } else if (r(0, 0) > r(1, 1) && r(0, 0) > r(2, 2)) {
    const s = 2 * Math.sqrt(1 + r(0, 0) - r(1, 1) - r(2, 2));
    rotation = [0.25 * s, (r(0, 1) + r(1, 0)) / s, (r(0, 2) + r(2, 0)) / s, (r(2, 1) - r(1, 2)) / s];
  } else if (r(1, 1) > r(2, 2)) {
    const s = 2 * Math.sqrt(1 + r(1, 1) - r(0, 0) - r(2, 2));
    rotation = [(r(0, 1) + r(1, 0)) / s, 0.25 * s, (r(1, 2) + r(2, 1)) / s, (r(0, 2) - r(2, 0)) / s];
  } else {
    const s = 2 * Math.sqrt(1 + r(2, 2) - r(0, 0) - r(1, 1));
    rotation = [(r(0, 2) + r(2, 0)) / s, (r(1, 2) + r(2, 1)) / s, 0.25 * s, (r(1, 0) - r(0, 1)) / s];
  }
  return { translation, rotation, scale };
}

export function transformPoint(matrix, [x, y, z]) {
  return [0, 1, 2].map((row) => matrix[row] * x + matrix[4 + row] * y + matrix[8 + row] * z + matrix[12 + row]);
}

export function transformDirection(matrix, [x, y, z]) {
  return [0, 1, 2].map((row) => matrix[row] * x + matrix[4 + row] * y + matrix[8 + row] * z);
}

/** Parent index of every node, and world matrices of the nodes reachable from the scenes. */
export function sceneGraph(gltf) {
  const parentOf = new Map();
  (gltf.nodes ?? []).forEach((node, index) => {
    for (const child of node.children ?? []) parentOf.set(child, index);
  });
  const world = new Map();
  function walk(nodeIndex, parentMatrix) {
    const matrix = multiply(parentMatrix, localMatrix(gltf.nodes[nodeIndex]));
    world.set(nodeIndex, matrix);
    for (const child of gltf.nodes[nodeIndex].children ?? []) walk(child, matrix);
  }
  for (const scene of gltf.scenes ?? []) for (const root of scene.nodes ?? []) walk(root, IDENTITY);
  return { parentOf, world };
}
