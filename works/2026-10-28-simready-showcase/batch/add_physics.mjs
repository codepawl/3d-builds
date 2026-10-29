// Writes each asset's SimReady physics (rigid bodies, mass, physics materials, joints) into its glb as
// KHR_physics_rigid_bodies, and mirrors the joints as plain node extras for engines without that extension.
// Usage: node add_physics.mjs <asset-list.txt> <glb-in-folder> <glb-out-folder> <usd-cache-folder> <report.jsonl>
//   Reads base.usda, instances.usda and Physics/physics.usda of nvidia/simready-assets (cached in <usd-cache-folder>).
//   Only the JSON chunk changes: new nodes for joint frames and wrappers, nothing is re-encoded.
//
// Frames: USD is Z-up and the glbs are Y-up, converted by C: (x, y, z) -> (x, z, -y). A USD local frame becomes
// C * frame * C^T in the glb, so a joint axis X stays column 0, Z becomes column 1, and Y becomes column 2 negated.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readGlb, writeGlb, baseName, multiply, invert, decompose, composeMatrix, localMatrix, sceneGraph, transformPoint, transformDirection,
  IDENTITY,
} from './glb_json.mjs';
import { parseUsda, apiSchemas, reference, parseNumber, parseNumbers, parsePath, parseToken } from './usda.mjs';

const [listPath, glbInFolder, glbOutFolder, usdCacheFolder, reportPath] = process.argv.slice(2);
const SOURCE = 'https://huggingface.co/datasets/nvidia/simready-assets/resolve/main';
const LAYERS = { base: 'base.usda', instances: 'instances.usda', physics: 'Physics/physics.usda' };
const WORKERS = 6;
const EXTENSION = 'KHR_physics_rigid_bodies';

// ---------- USD to glb frames ----------

const Y_UP = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
const Z_UP = invert(Y_UP);

function convertPoint([x, y, z]) {
  return [x, z, -y];
}

/** USD quaternion (w, x, y, z) of a local frame -> glTF [x, y, z, w] of the same frame in the glb. */
function convertQuaternion([w, x, y, z]) {
  return [x, z, -y, w];
}

/** Joint axis token -> the column of the converted frame and the sign of motion along it. */
const AXIS = { X: { index: 0, sign: 1 }, Y: { index: 2, sign: -1 }, Z: { index: 1, sign: 1 } };

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

function roundAll(values) {
  return values.map(round);
}

// ---------- USD layers ----------

/** Hugging Face answers 429 once a client asks too fast; wait as long as it says (or back off) and ask again. */
async function fetchWithRetry(url) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url);
    if (response.status !== 429 || attempt === 8) return response;
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || 2 ** attempt * 5;
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterSeconds, 300) * 1000));
  }
}

async function loadLayer(asset, layer) {
  const cachePath = join(usdCacheFolder, asset, layer.replace('/', '_'));
  if (existsSync(cachePath)) {
    const text = readFileSync(cachePath, 'utf8');
    return text === '' ? null : parseUsda(text);
  }
  mkdirSync(join(usdCacheFolder, asset), { recursive: true });
  const response = await fetchWithRetry(`${SOURCE}/${asset}/simready_usd/payloads/${layer}`);
  const text = response.ok ? await response.text() : '';
  if (!response.ok && response.status !== 404) throw new Error(`${layer}: HTTP ${response.status}`);
  writeFileSync(cachePath, text);
  return text === '' ? null : parseUsda(text);
}

/** USD rotateXYZ, rotateZYX, rotateX, ...: degrees per named axis, applied in the order the letters name them. */
function rotationMatrix(axes, degrees) {
  let matrix = IDENTITY;
  [...axes].forEach((axis, index) => {
    const half = (degrees[index] * Math.PI) / 360;
    const quaternion = [0, 0, 0, Math.cos(half)];
    quaternion['XYZ'.indexOf(axis)] = Math.sin(half);
    matrix = multiply(composeMatrix(undefined, quaternion), matrix);
  });
  return matrix;
}

/** USD local matrix (column-major, Z-up) from a prim's xformOps. Returns null when an op is not understood. */
function usdLocalMatrix(prim) {
  const order = prim?.attributes.get('xformOpOrder');
  if (!order) return IDENTITY;
  let matrix = IDENTITY;
  for (const op of [...order.matchAll(/"([^"]+)"/g)].map((item) => item[1])) {
    const value = prim.attributes.get(op);
    if (op === '!resetXformStack!') continue;
    if (op.startsWith('!invert!')) return null;
    if (!value) continue; // declared without a value: no opinion, so no motion
    const numbers = parseNumbers(value);
    let opMatrix;
    if (op.startsWith('xformOp:translate')) opMatrix = composeMatrix(numbers);
    else if (op.startsWith('xformOp:orient')) opMatrix = composeMatrix(undefined, [numbers[1], numbers[2], numbers[3], numbers[0]]);
    else if (op.startsWith('xformOp:scale')) opMatrix = composeMatrix(undefined, undefined, numbers);
    else if (op.startsWith('xformOp:transform')) opMatrix = numbers;
    else if (/^xformOp:rotate[XYZ]{1,3}\b/.test(op)) opMatrix = rotationMatrix(op.match(/^xformOp:rotate([XYZ]+)/)[1], numbers);
    else return null;
    matrix = multiply(matrix, opMatrix);
  }
  return matrix;
}

function usdWorldMatrix(base, path) {
  let matrix = IDENTITY;
  const parts = path.split('/').filter(Boolean);
  for (let depth = 1; depth <= parts.length; depth += 1) {
    const local = usdLocalMatrix(base.get(`/${parts.slice(0, depth).join('/')}`));
    if (!local) return null;
    matrix = multiply(matrix, local);
  }
  return matrix;
}

/** Mass properties of a body: physics.usda first, then the referenced instance mesh, then base.usda's pxr:usd values. */
function massProperties(bodyPath, layers) {
  const sources = [layers.physics.get(bodyPath)];
  const instance = reference(layers.base.get(bodyPath));
  if (instance && layers.instances) {
    for (const [path, prim] of layers.instances) {
      if (path.startsWith(`${instance.path}/`) && prim.attributes.has('physics:mass')) sources.push(prim);
    }
  }
  const pick = (name) => sources.find((prim) => prim?.attributes.has(name))?.attributes.get(name);
  // A center of mass of (-inf, -inf, -inf) is USD's way to say: compute it. Skip it and use the next source.
  const finiteVector = (text) => (text && parseNumbers(text).every(Number.isFinite) ? text : undefined);
  const pickFinite = (name) => sources.map((prim) => finiteVector(prim?.attributes.get(name))).find(Boolean);
  const baseBody = layers.base.get(bodyPath);
  const massText = pick('physics:mass') ?? baseBody?.attributes.get('pxr:usd:physics_mass');
  const centerText = pickFinite('physics:centerOfMass') ?? finiteVector(baseBody?.attributes.get('pxr:usd:physics_centerofmass'));
  const inertiaText = pick('physics:diagonalInertia');
  const axesText = pick('physics:principalAxes');
  const motion = {};
  const mass = massText === undefined ? undefined : parseNumber(massText);
  if (mass > 0) motion.mass = round(mass);
  if (centerText) motion.centerOfMass = roundAll(convertPoint(parseNumbers(centerText)));
  if (inertiaText) {
    const [first, second, third] = parseNumbers(inertiaText);
    // Principal axes Y and Z trade places under C, so their moments do too.
    if (first > 0 && second > 0 && third > 0) motion.inertiaDiagonal = roundAll([first, third, second]);
    if (axesText && motion.inertiaDiagonal) motion.inertiaOrientation = roundAll(convertQuaternion(parseNumbers(axesText)));
  }
  return motion;
}

/** Base prims whose referenced instance prototype holds a mesh with PhysicsRigidBodyAPI. */
function instanceBodyPaths(layers) {
  if (!layers.instances) return [];
  const rigidPrototypes = [...layers.instances.entries()]
    .filter(([, prim]) => apiSchemas(prim).includes('PhysicsRigidBodyAPI'))
    .map(([path]) => path);
  const result = [];
  for (const [path, prim] of layers.base) {
    const instance = reference(prim);
    if (!instance) continue;
    if (rigidPrototypes.some((rigidPath) => rigidPath.startsWith(`${instance.path}/`))) result.push(path);
  }
  return result;
}

// ---------- glb edits ----------

function addNode(gltf, node, parentIndex, sceneIndex) {
  gltf.nodes.push(node);
  const index = gltf.nodes.length - 1;
  if (parentIndex === undefined) gltf.scenes[sceneIndex].nodes.push(index);
  else (gltf.nodes[parentIndex].children ??= []).push(index);
  return index;
}

/** Sets a node's transform from a matrix, dropping identity parts so the JSON stays small. */
function setTransform(node, matrix) {
  const { translation, rotation, scale } = decompose(matrix);
  delete node.matrix;
  delete node.translation;
  delete node.rotation;
  delete node.scale;
  if (translation.some((value) => Math.abs(value) > 1e-9)) node.translation = translation;
  if (Math.abs(rotation[3]) < 1 - 1e-9) node.rotation = rotation;
  if (scale.some((value) => Math.abs(value - 1) > 1e-9)) node.scale = scale;
}

/**
 * The glb node that stands for a USD body prim "<part>_obj_NN". Blender sometimes merges an obj prim into its only
 * mesh, leaving "<part>_mesh_NN" alone: then a wrapper node with the obj's name and USD transform is put above it.
 */
function findBodyNode(gltf, bodyPath, layers, graph, report) {
  const name = bodyPath.split('/').at(-1);
  const exact = gltf.nodes.findIndex((node) => baseName(node.name) === name);
  if (exact !== -1) return exact;
  const meshPrefix = name.replace(/_obj_(\d+)$/, '_mesh_');
  if (meshPrefix === name) return -1;
  const meshes = gltf.nodes.map((node, index) => [node, index]).filter(([node]) => baseName(node.name).startsWith(meshPrefix));
  if (meshes.length === 0) return -1;
  const parents = new Set(meshes.map(([, index]) => graph.parentOf.get(index)));
  if (parents.size !== 1) return -1;
  const parentIndex = [...parents][0];
  const usdWorld = usdWorldMatrix(layers.base, bodyPath);
  if (!usdWorld) return -1;
  const wrapperWorld = multiply(Y_UP, multiply(usdWorld, Z_UP));
  const parentWorld = parentIndex === undefined ? IDENTITY : graph.world.get(parentIndex);
  const wrapperLocal = multiply(invert(parentWorld), wrapperWorld);
  const wrapper = { name, children: [] };
  setTransform(wrapper, wrapperLocal);
  gltf.nodes.push(wrapper);
  const wrapperIndex = gltf.nodes.length - 1;
  for (const [meshNode, meshIndex] of meshes) {
    const siblings = parentIndex === undefined ? gltf.scenes[0].nodes : gltf.nodes[parentIndex].children;
    siblings.splice(siblings.indexOf(meshIndex), 1);
    wrapper.children.push(meshIndex);
    const meshLocal = multiply(invert(parentWorld), graph.world.get(meshIndex) ?? localMatrix(meshNode));
    setTransform(meshNode, multiply(invert(wrapperLocal), meshLocal));
  }
  if (parentIndex === undefined) gltf.scenes[0].nodes.push(wrapperIndex);
  else gltf.nodes[parentIndex].children.push(wrapperIndex);
  graph.world.set(wrapperIndex, wrapperWorld);
  graph.parentOf.set(wrapperIndex, parentIndex);
  for (const [, meshIndex] of meshes) graph.parentOf.set(meshIndex, wrapperIndex);
  report.wrapped += 1;
  return wrapperIndex;
}

/** Mesh nodes that belong to a body: its subtree, without the subtrees of other bodies. */
function bodyMeshNodes(gltf, bodyIndex, bodyIndices) {
  const result = [];
  function walk(nodeIndex) {
    if (gltf.nodes[nodeIndex].mesh !== undefined) result.push(nodeIndex);
    for (const child of gltf.nodes[nodeIndex].children ?? []) if (!bodyIndices.has(child)) walk(child);
  }
  walk(bodyIndex);
  return result;
}

function jointLimits(type, axisToken, lower, upper) {
  const locked = { min: 0, max: 0 };
  if (type === 'fixed') {
    return [{ linearAxes: [0, 1, 2], ...locked }, { angularAxes: [0], ...locked }, { angularAxes: [1, 2], ...locked }];
  }
  if (type === 'spherical') return [{ linearAxes: [0, 1, 2], ...locked }];
  const axis = AXIS[axisToken];
  const others = [0, 1, 2].filter((index) => index !== axis.index);
  const scale = type === 'revolute' ? Math.PI / 180 : 1;
  const range = {};
  const signedLower = axis.sign > 0 ? lower : -upper;
  const signedUpper = axis.sign > 0 ? upper : -lower;
  if (Number.isFinite(signedLower)) range.min = round(signedLower * scale);
  if (Number.isFinite(signedUpper)) range.max = round(signedUpper * scale);
  const free = range.min === undefined && range.max === undefined;
  if (type === 'revolute') {
    const limits = [{ linearAxes: [0, 1, 2], ...locked }, { angularAxes: others, ...locked }];
    if (!free) limits.push({ angularAxes: [axis.index], ...range });
    return limits;
  }
  const limits = [{ linearAxes: others, ...locked }, { angularAxes: [axis.index], ...locked }, { angularAxes: others, ...locked }];
  if (!free) limits.push({ linearAxes: [axis.index], ...range });
  return limits;
}

function addShared(list, keyed, value) {
  const key = JSON.stringify(value);
  if (!keyed.has(key)) {
    list.push(value);
    keyed.set(key, list.length - 1);
  }
  return keyed.get(key);
}

async function processAsset(asset) {
  const report = { asset, bodies: 0, colliders: 0, joints: 0, skippedJoints: [], wrapped: 0, looseMeshes: 0 };
  const layers = {};
  await Promise.all(Object.entries(LAYERS).map(async ([key, layer]) => {
    layers[key] = await loadLayer(asset, layer);
  }));
  if (!layers.base || !layers.physics) return { ...report, skipped: 'no base or physics layer' };

  const bodyPaths = [...layers.physics.keys()].filter((path) => apiSchemas(layers.physics.get(path)).includes('PhysicsRigidBodyAPI'));
  // Some assets put RigidBodyAPI on the prototype mesh in instances.usda (safety_mobileShutoff_a01's wheels): the
  // base prim that references that prototype is then the body.
  for (const bodyPath of instanceBodyPaths(layers)) if (!bodyPaths.includes(bodyPath)) bodyPaths.push(bodyPath);
  if (bodyPaths.length === 0) return { ...report, skipped: 'no rigid body' };

  const { gltf, rest } = readGlb(join(glbInFolder, `${asset}.glb`));
  const graph = sceneGraph(gltf);
  const physicsMaterials = [];
  const materialKeys = new Map();
  const physicsJoints = [];
  const jointKeys = new Map();

  const bodyIndexByPath = new Map();
  for (const bodyPath of bodyPaths) {
    const index = findBodyNode(gltf, bodyPath, layers, graph, report);
    if (index === -1) report.skippedJoints.push(`body ${bodyPath} has no glb node`);
    else bodyIndexByPath.set(bodyPath, index);
  }
  const bodyIndices = new Set(bodyIndexByPath.values());

  for (const [bodyPath, bodyIndex] of bodyIndexByPath) {
    const node = gltf.nodes[bodyIndex];
    const motion = massProperties(bodyPath, layers);
    if (layers.physics.get(bodyPath)?.attributes.get('physics:kinematicEnabled')?.match(/^(1|true)$/)) motion.isKinematic = true;
    node.extensions ??= {};
    node.extensions[EXTENSION] = { motion };
    report.bodies += 1;

    const materialPath = parsePath(layers.base.get(bodyPath)?.attributes.get('material:binding:physics'));
    const materialPrim = materialPath ? layers.physics.get(materialPath) ?? layers.base.get(materialPath) : null;
    let materialIndex;
    if (materialPrim) {
      const value = (name) => (materialPrim.attributes.has(name) ? round(parseNumber(materialPrim.attributes.get(name))) : undefined);
      const material = { staticFriction: value('physics:staticFriction'), dynamicFriction: value('physics:dynamicFriction'), restitution: value('physics:restitution') };
      for (const key of Object.keys(material)) if (material[key] === undefined) delete material[key];
      materialIndex = addShared(physicsMaterials, materialKeys, material);
      const density = value('physics:density');
      if (density !== undefined) node.extras = { ...node.extras, density };
    }
    if (motion.mass !== undefined) node.extras = { ...node.extras, mass: motion.mass };

    // SimReady collides with signed distance fields built from the render mesh; the closest portable shape is the
    // convex hull of each part's mesh, which every engine can build.
    for (const meshIndex of bodyMeshNodes(gltf, bodyIndex, bodyIndices)) {
      const collider = { geometry: { node: meshIndex, convexHull: true } };
      if (materialIndex !== undefined) collider.physicsMaterial = materialIndex;
      gltf.nodes[meshIndex].extensions ??= {};
      gltf.nodes[meshIndex].extensions[EXTENSION] = { ...gltf.nodes[meshIndex].extensions[EXTENSION], collider };
      report.colliders += 1;
    }
  }
  const covered = new Set([...bodyIndices].flatMap((index) => bodyMeshNodes(gltf, index, new Set())));
  report.looseMeshes = gltf.nodes.filter((node, index) => node.mesh !== undefined && !covered.has(index) && graph.world.has(index)).length;

  /** The body a joint target belongs to: the target itself or its nearest ancestor that is a body. */
  function resolveBody(targetPath) {
    if (!targetPath) return { world: true };
    for (let path = targetPath; path; path = path.slice(0, path.lastIndexOf('/'))) {
      if (bodyIndexByPath.has(path)) return { path, index: bodyIndexByPath.get(path) };
    }
    return null;
  }

  const jointPrims = [...layers.physics.values()].filter((prim) => /^Physics(\w+)Joint$/.test(prim.type));
  for (const prim of jointPrims) {
    const type = prim.type.match(/^Physics(\w+)Joint$/)[1].toLowerCase();
    const attributes = prim.attributes;
    const axisToken = parseToken(attributes.get('physics:axis')) || 'X';
    if (!['fixed', 'revolute', 'prismatic', 'spherical'].includes(type) || (type !== 'fixed' && type !== 'spherical' && !AXIS[axisToken])) {
      report.skippedJoints.push(`${prim.name}: ${type} ${axisToken}`);
      continue;
    }
    const first = resolveBody(parsePath(attributes.get('physics:body0')));
    const second = resolveBody(parsePath(attributes.get('physics:body1')));
    if (!first || !second || (first.world && second.world)) {
      report.skippedJoints.push(`${prim.name}: bodies not found`);
      continue;
    }
    // Both ends on one body (body_02 to itself in the brake caliper kit): the joint has nothing to hold.
    if (first.index === second.index) {
      report.skippedJoints.push(`${prim.name}: both ends on one body`);
      continue;
    }
    const frame = (side) => composeMatrix(
      convertPoint(parseNumbers(attributes.get(`physics:localPos${side}`) ?? '(0, 0, 0)')),
      convertQuaternion(parseNumbers(attributes.get(`physics:localRot${side}`) ?? '(1, 0, 0, 0)')),
    );
    const lower = attributes.has('physics:lowerLimit') ? parseNumber(attributes.get('physics:lowerLimit')) : -Infinity;
    const upper = attributes.has('physics:upperLimit') ? parseNumber(attributes.get('physics:upperLimit')) : Infinity;
    const jointIndex = addShared(physicsJoints, jointKeys, { limits: jointLimits(type, axisToken, lower, upper) });

    // The joint node sits on body0 and the connected node on body1, so a joint position measures body1 relative to
    // body0 as in USD. A missing body0 is the fixed world frame: the joint node then goes at the scene root.
    const firstWorld = first.world ? IDENTITY : graph.world.get(first.index);
    const jointNode = { name: `${prim.name}_frame0` };
    setTransform(jointNode, frame(0));
    const connectedNode = { name: `${prim.name}_frame1` };
    setTransform(connectedNode, frame(1));
    const connectedIndex = addNode(gltf, connectedNode, second.world ? undefined : second.index, 0);
    jointNode.extensions = { [EXTENSION]: { joint: { connectedNode: connectedIndex, joint: jointIndex } } };
    addNode(gltf, jointNode, first.world ? undefined : first.index, 0);

    // Plain mirror for viewers and engines without the extension: pivot and axis in scene space at rest.
    const jointWorld = multiply(firstWorld, frame(0));
    const axis = AXIS[axisToken] ?? AXIS.X;
    const axisDirection = transformDirection(jointWorld, [0, 1, 2].map((index) => (index === axis.index ? axis.sign : 0)));
    const length = Math.hypot(...axisDirection);
    const mirror = {
      name: prim.name,
      type,
      parent: first.world ? null : gltf.nodes[first.index].name,
      pivot: roundAll(transformPoint(jointWorld, [0, 0, 0])),
      axis: roundAll(axisDirection.map((value) => value / length)),
    };
    if (Number.isFinite(lower)) mirror.min = round(lower);
    if (Number.isFinite(upper)) mirror.max = round(upper);
    if (type === 'revolute') mirror.unit = 'degrees';
    if (type === 'prismatic') mirror.unit = 'meters';
    const moving = second.world ? gltf.nodes[first.index] : gltf.nodes[second.index];
    moving.extras = { ...moving.extras, joints: [...(moving.extras?.joints ?? []), mirror] };
    report.joints += 1;
  }

  gltf.extensions ??= {};
  gltf.extensions[EXTENSION] = {};
  if (physicsMaterials.length > 0) gltf.extensions[EXTENSION].physicsMaterials = physicsMaterials;
  if (physicsJoints.length > 0) gltf.extensions[EXTENSION].physicsJoints = physicsJoints;
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), EXTENSION])].sort();
  writeGlb(join(glbOutFolder, `${asset}.glb`), gltf, rest);
  return report;
}

mkdirSync(glbOutFolder, { recursive: true });
const done = new Set(existsSync(reportPath) ? readFileSync(reportPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).asset) : []);
const assets = readFileSync(listPath, 'utf8').split('\n').map((line) => line.trim()).filter((name) => name && !done.has(name));
let next = 0;
async function worker() {
  while (next < assets.length) {
    const asset = assets[next];
    next += 1;
    let row;
    try {
      row = await processAsset(asset);
    } catch (error) {
      row = { asset, error: String(error.stack ?? error) };
    }
    appendFileSync(reportPath, `${JSON.stringify(row)}\n`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`processed ${assets.length}`);
