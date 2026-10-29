// Drops SimReady models on a floor and lets people pull their parts, using only the physics stored in each glb:
// KHR_physics_rigid_bodies motions (mass, center of mass, inertia) and colliders (convex hulls, friction,
// restitution), and the joints mirrored in node extras (userData.joints: type, parent, pivot, axis, min, max).
// ?models=a,b,c picks the models (the first one stands in the middle, the rest fall around it).
// ?base=<url> points at another copy of the dataset files, as in the viewer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import RAPIER from 'rapier';

const DATASET_BASE = 'https://huggingface.co/datasets/codepawl/simready-glb/resolve/main/';
const parameters = new URLSearchParams(location.search);
const fileBase = parameters.get('base') ?? DATASET_BASE;
const DEFAULT_MODELS = [
  'cabinet_file_a01',
  'box_cardboard_a01',
  'bucket_utility_red_a01',
  'drum_plastic_blue_a01',
  'box_cardboard_b01',
  'chair_office_fabric_manager_a01',
];
const modelNames = (parameters.get('models') ?? DEFAULT_MODELS.join(',')).split(',').map((name) => name.trim()).filter(Boolean);
const EXTENSION = 'KHR_physics_rigid_bodies';
const HULL_POINT_LIMIT = 1500;
const FALLBACK_DENSITY = 400; // kg/m³ when a body has no mass
const STEP_SECONDS = 1 / 60;
const GRAB_STIFFNESS = 90;
const GRAB_DAMPING = 14;

const canvas = document.getElementById('world');
const statusElement = document.getElementById('status');

// ---------- scene ----------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.6);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 200);
camera.position.set(3.6, 2.4, 4.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.8, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

function resize() {
  const { clientWidth, clientHeight } = canvas;
  if (clientWidth === 0 || clientHeight === 0) return;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

// ---------- physics ----------

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP_SECONDS;
world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.8));

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = [];
let bodies = [];

function setStatus(text) {
  statusElement.className = 'stage-status loading';
  statusElement.innerHTML = text ? `<span class="spinner"></span><span>${text}</span>` : '';
}

function physicsOf(object) {
  return object.userData.gltfExtensions?.[EXTENSION];
}

/** Parts of the model that move on their own, in scene order; a model without any is one body. */
function bodyObjects(model) {
  const found = [];
  model.traverse((object) => {
    if (physicsOf(object)?.motion) found.push(object);
  });
  return found.length > 0 ? found : [model];
}

/** Meshes that belong to a body: its subtree, without the subtrees of other bodies. */
function bodyMeshes(bodyObject, otherBodies) {
  const meshes = [];
  function walk(object) {
    if (object !== bodyObject && otherBodies.has(object)) return;
    if (object.isMesh) meshes.push(object);
    for (const child of object.children) walk(child);
  }
  walk(bodyObject);
  return meshes;
}

/** Up to HULL_POINT_LIMIT vertices of a mesh in world space, minus the body origin. */
function hullPoints(mesh, origin) {
  const positions = mesh.geometry.getAttribute('position');
  const step = Math.max(1, Math.floor(positions.count / HULL_POINT_LIMIT));
  const points = [];
  const vertex = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += step) {
    vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).sub(origin);
    points.push(vertex.x, vertex.y, vertex.z);
  }
  return new Float32Array(points);
}

/** The collider's physics material from the glb's top-level extension, found through the collider's mesh node. */
function materialFor(mesh, physicsMaterials) {
  for (let object = mesh; object; object = object.parent) {
    const collider = physicsOf(object)?.collider;
    if (collider) return physicsMaterials[collider.physicsMaterial] ?? {};
  }
  return {};
}

function toRapier(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

/**
 * Builds the Rapier bodies, colliders and joints of one placed model. Every body starts unrotated at the world
 * position of its node, so pivots and axes given in model space at rest are the same in both bodies of a joint.
 */
function buildModel(model, gltfJson, collisionGroup) {
  model.updateMatrixWorld(true);
  const physicsMaterials = gltfJson.extensions?.[EXTENSION]?.physicsMaterials ?? [];
  const objects = bodyObjects(model);
  const objectSet = new Set(objects);
  const records = new Map();
  const groups = (collisionGroup << 16) | (0xffff & ~collisionGroup);

  for (const object of objects) {
    const origin = object.getWorldPosition(new THREE.Vector3());
    const description = RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x, origin.y, origin.z).setCanSleep(true);
    const motion = physicsOf(object)?.motion;
    const worldRotation = object.getWorldQuaternion(new THREE.Quaternion());
    if (motion?.mass > 0) {
      const centerOfMass = new THREE.Vector3(...(motion.centerOfMass ?? [0, 0, 0])).applyQuaternion(worldRotation);
      const inertia = motion.inertiaDiagonal ?? [motion.mass / 10, motion.mass / 10, motion.mass / 10];
      const inertiaFrame = worldRotation.clone().multiply(new THREE.Quaternion(...(motion.inertiaOrientation ?? [0, 0, 0, 1])));
      description.setAdditionalMassProperties(
        motion.mass,
        toRapier(centerOfMass),
        { x: inertia[0], y: inertia[1], z: inertia[2] },
        { x: inertiaFrame.x, y: inertiaFrame.y, z: inertiaFrame.z, w: inertiaFrame.w },
      );
    }
    const body = world.createRigidBody(description);
    for (const mesh of bodyMeshes(object, objectSet)) {
      const colliderDescription = RAPIER.ColliderDesc.convexHull(hullPoints(mesh, origin));
      if (!colliderDescription) continue;
      const material = materialFor(mesh, physicsMaterials);
      colliderDescription
        .setDensity(motion?.mass > 0 ? 0 : FALLBACK_DENSITY)
        .setFriction(material.dynamicFriction ?? 0.5)
        .setRestitution(material.restitution ?? 0.1)
        .setCollisionGroups(groups);
      world.createCollider(colliderDescription, body);
      mesh.castShadow = true;
    }
    records.set(object, { object, body, origin, rest: object.matrixWorld.clone(), depth: depthOf(object) });
  }

  for (const record of records.values()) {
    for (const joint of record.object.userData.joints ?? []) addJoint(model, records, record, joint);
  }
  return [...records.values()];
}

function depthOf(object) {
  let depth = 0;
  for (let parent = object.parent; parent; parent = parent.parent) depth += 1;
  return depth;
}

function addJoint(model, records, childRecord, joint) {
  const parentObject = joint.parent ? model.getObjectByName(joint.parent) : null;
  const parentRecord = parentObject ? records.get(parentObject) : null;
  const pivot = new THREE.Vector3(...joint.pivot).applyMatrix4(model.matrixWorld);
  const axis = new THREE.Vector3(...joint.axis).transformDirection(model.matrixWorld);
  const parentBody = parentRecord?.body ?? world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const parentOrigin = parentRecord?.origin ?? new THREE.Vector3();
  const anchorParent = toRapier(pivot.clone().sub(parentOrigin));
  const anchorChild = toRapier(pivot.clone().sub(childRecord.origin));
  let data;
  if (joint.type === 'revolute') data = RAPIER.JointData.revolute(anchorParent, anchorChild, toRapier(axis));
  else if (joint.type === 'prismatic') data = RAPIER.JointData.prismatic(anchorParent, anchorChild, toRapier(axis));
  else if (joint.type === 'spherical') data = RAPIER.JointData.spherical(anchorParent, anchorChild);
  else data = RAPIER.JointData.fixed(anchorParent, { w: 1, x: 0, y: 0, z: 0 }, anchorChild, { w: 1, x: 0, y: 0, z: 0 });
  if ((joint.type === 'revolute' || joint.type === 'prismatic') && Number.isFinite(joint.min) && Number.isFinite(joint.max)) {
    const scale = joint.type === 'revolute' ? Math.PI / 180 : 1;
    data.limitsEnabled = true;
    data.limits = [joint.min * scale, joint.max * scale];
  }
  const created = world.createImpulseJoint(data, parentBody, childRecord.body, true);
  created.setContactsEnabled(false);
  if (joint.type === 'revolute' || joint.type === 'prismatic') {
    // SimReady joints carry a light damping drive; a small velocity motor gives the same feel.
    created.configureMotorVelocity(0, joint.type === 'revolute' ? 0.4 : 4);
  }
}

/** Moves each part's node to its body's pose: body motion times the node's rest pose. */
function syncObjects() {
  const motion = new THREE.Matrix4();
  const back = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const inverseParent = new THREE.Matrix4();
  for (const record of bodies) {
    const position = record.body.translation();
    const rotation = record.body.rotation();
    motion.compose(new THREE.Vector3(position.x, position.y, position.z), new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w), new THREE.Vector3(1, 1, 1));
    back.makeTranslation(-record.origin.x, -record.origin.y, -record.origin.z);
    world.copy(motion).multiply(back).multiply(record.rest);
    record.object.parent.updateMatrixWorld(true);
    inverseParent.copy(record.object.parent.matrixWorld).invert();
    world.premultiply(inverseParent).decompose(record.object.position, record.object.quaternion, record.object.scale);
    record.object.updateMatrixWorld(true);
  }
}

// ---------- loading and placing ----------

async function loadModel(name) {
  const gltf = await loader.loadAsync(`${fileBase}glb/${encodeURIComponent(name)}.glb`);
  return { name, root: gltf.scene, json: gltf.parser.json };
}

/** Puts a model with its lowest point at height and its footprint centred on x, z. */
function place(root, x, height, z, turn) {
  root.rotation.y = turn;
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(x - center.x, height - box.min.y, z - center.z);
  root.updateMatrixWorld(true);
}

function clearWorld() {
  for (const record of bodies) world.removeRigidBody(record.body);
  bodies = [];
  for (const model of models) scene.remove(model.root);
  models.length = 0;
}

/** The first model stands in the middle; the others fall onto the floor around it, one after another. */
const dropPlan = [];

async function dropAll() {
  clearWorld();
  setStatus('Loading');
  const loaded = await Promise.all(modelNames.map((name) => loadModel(name).catch(() => null)));
  dropPlan.length = 0;
  loaded.filter(Boolean).forEach((model, index) => {
    models.push(model);
    if (index === 0) {
      place(model.root, 0, 0.001, 0, 0);
      scene.add(model.root);
      bodies.push(...buildModel(model.root, model.json, 1 << (index % 15)));
      return;
    }
    const angle = (index / Math.max(1, loaded.length - 1)) * Math.PI * 1.6 - Math.PI * 0.3;
    const radius = 1.25 + (index % 2) * 0.35;
    dropPlan.push({ model, index, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius + 0.4, height: 1.6 + index * 0.25, turn: angle * 1.7, at: 0.35 + index * 0.45 });
  });
  bodies.sort((first, second) => first.depth - second.depth);
  simulationSeconds = 0;
  setStatus('');
  window.__ready = true;
}

function releaseDue() {
  while (dropPlan.length > 0 && dropPlan[0].at <= simulationSeconds) {
    const drop = dropPlan.shift();
    place(drop.model.root, drop.x, drop.height, drop.z, drop.turn);
    scene.add(drop.model.root);
    const created = buildModel(drop.model.root, drop.model.json, 1 << (drop.index % 15));
    for (const record of created) record.body.setAngvel({ x: 0.6, y: 0.3, z: -0.4 }, true);
    bodies.push(...created);
    bodies.sort((first, second) => first.depth - second.depth);
  }
}

// ---------- grabbing ----------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const grabPlane = new THREE.Plane();
let grab = null;
const grabMarker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0b7a5c }));
const grabLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x0b7a5c }));
grabMarker.visible = false;
grabLine.visible = false;
scene.add(grabMarker, grabLine);

function setPointer(event) {
  const rectangle = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rectangle.left) / rectangle.width) * 2 - 1, -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

function recordOf(object) {
  for (let current = object; current; current = current.parent) {
    const record = bodies.find((candidate) => candidate.object === current);
    if (record) return record;
  }
  return null;
}

function localPoint(body, worldPoint) {
  const position = body.translation();
  const rotation = body.rotation();
  return worldPoint.clone().sub(new THREE.Vector3(position.x, position.y, position.z))
    .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert());
}

function worldPoint(body, local) {
  const position = body.translation();
  const rotation = body.rotation();
  return local.clone().applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
    .add(new THREE.Vector3(position.x, position.y, position.z));
}

canvas.addEventListener('pointerdown', (event) => {
  setPointer(event);
  const hits = raycaster.intersectObjects(models.map((model) => model.root), true);
  const hit = hits.find((candidate) => recordOf(candidate.object));
  if (!hit) return;
  const record = recordOf(hit.object);
  grab = { record, local: localPoint(record.body, hit.point), target: hit.point.clone() };
  grabPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
  controls.enabled = false;
  record.body.wakeUp();
  canvas.setPointerCapture(event.pointerId);
}, { capture: true });

canvas.addEventListener('pointermove', (event) => {
  if (!grab) return;
  setPointer(event);
  raycaster.ray.intersectPlane(grabPlane, grab.target);
});

function endGrab() {
  grab = null;
  controls.enabled = true;
  grabMarker.visible = false;
  grabLine.visible = false;
}
canvas.addEventListener('pointerup', endGrab);
canvas.addEventListener('pointercancel', endGrab);

/** A spring from the grabbed point to the cursor, pushed through Rapier as an impulse at that point. */
function pullGrabbed() {
  if (!grab) return;
  const body = grab.record.body;
  const held = worldPoint(body, grab.local);
  const velocity = body.linvel();
  const mass = Math.max(body.mass(), 0.2);
  const impulse = grab.target.clone().sub(held).multiplyScalar(GRAB_STIFFNESS)
    .sub(new THREE.Vector3(velocity.x, velocity.y, velocity.z).multiplyScalar(GRAB_DAMPING))
    .multiplyScalar(mass * STEP_SECONDS);
  body.applyImpulseAtPoint(toRapier(impulse), toRapier(held), true);
  grabMarker.position.copy(held);
  grabLine.geometry.setFromPoints([held, grab.target]);
  grabMarker.visible = true;
  grabLine.visible = true;
}

// ---------- loop ----------

let simulationSeconds = 0;
let lastTime = performance.now();
let pending = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now();
  pending = Math.min(pending + (now - lastTime) / 1000, 0.1);
  lastTime = now;
  while (pending >= STEP_SECONDS) {
    releaseDue();
    pullGrabbed();
    world.step();
    simulationSeconds += STEP_SECONDS;
    pending -= STEP_SECONDS;
  }
  syncObjects();
  controls.update();
  renderer.render(scene, camera);
});

document.getElementById('drop-again').addEventListener('click', () => dropAll());

/**
 * Screen point of a named part, for scripted recordings. along moves the point from the part's centre along its
 * joint axis, in meters (a drawer's front face, a door's free edge).
 */
window.__screenPoint = (name, along = 0) => {
  const object = models.map((model) => model.root.getObjectByName(name)).find(Boolean);
  if (!object) return [0, 0];
  const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  const joint = object.userData.joints?.find((item) => item.type !== 'fixed');
  if (joint) point.addScaledVector(new THREE.Vector3(...joint.axis), along);
  const projected = point.project(camera);
  const rectangle = canvas.getBoundingClientRect();
  return [rectangle.left + ((projected.x + 1) / 2) * rectangle.width, rectangle.top + ((1 - projected.y) / 2) * rectangle.height];
};

/** Screen point of a world point, and the world centre of a named part, for scripted recordings. */
window.__project = (x, y, z) => {
  const projected = new THREE.Vector3(x, y, z).project(camera);
  const rectangle = canvas.getBoundingClientRect();
  return [rectangle.left + ((projected.x + 1) / 2) * rectangle.width, rectangle.top + ((1 - projected.y) / 2) * rectangle.height];
};
window.__worldCenter = (name) => {
  const object = models.map((model) => model.root.getObjectByName(name)).find(Boolean);
  return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).toArray() : null;
};
window.__modelCenter = (name) => {
  const model = models.find((item) => item.name === name);
  return model ? new THREE.Box3().setFromObject(model.root).getCenter(new THREE.Vector3()).toArray() : null;
};
window.__settled = () => dropPlan.length === 0 && bodies.every((record) => record.body.isSleeping() || record.body.linvel().y > -0.05);
await dropAll();
