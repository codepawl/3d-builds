// Things a worm has to go over: logs, round hay bales, crates, the cart and the paddock fence. Each one is stamped into the
// simulation height field (see terrain.js), so a worm's body rests on the top and the sides and slides down the far side.
// Logs, bales and crates are drawn here; the cart and the fence are models drawn by props.js and only get a stamp.
import * as THREE from 'three';
import { paddock } from './layout.js';
import { smoothstep } from './random.js';
import { makeToonMaterial } from './look.js';

const EDGE = 0.55; // metres over which a surface ramps from the ground to its side
const BARK = '#b08a5e';
const BARK_END = '#e2c690';
const HAY = '#d3b25a';
const HAY_END = '#e6cf86';
const CRATE = '#9a7448';

const FENCE_HEIGHT = 0.6;
const FENCE_HALF_THICKNESS = 0.1;

function fenceBoxes() {
  const boxes = [];
  const centerX = (paddock.minX + paddock.maxX) / 2;
  const centerZ = (paddock.minZ + paddock.maxZ) / 2;
  const halfWidth = (paddock.maxX - paddock.minX) / 2;
  const halfDepth = (paddock.maxZ - paddock.minZ) / 2;
  const hidden = { shape: 'box', yaw: 0, height: FENCE_HEIGHT, visible: false };
  boxes.push({ ...hidden, x: centerX, z: paddock.minZ, halfX: halfWidth, halfZ: FENCE_HALF_THICKNESS });
  boxes.push({ ...hidden, x: centerX, z: centerZ, halfX: FENCE_HALF_THICKNESS, halfZ: halfDepth, offsetX: -halfWidth });
  boxes.push({ ...hidden, x: centerX, z: centerZ, halfX: FENCE_HALF_THICKNESS, halfZ: halfDepth, offsetX: halfWidth });
  // The south side has a gate gap from x = 13.6 to 18.4.
  boxes.push({ ...hidden, x: (paddock.minX + 13.6) / 2, z: paddock.maxZ, halfX: (13.6 - paddock.minX) / 2, halfZ: FENCE_HALF_THICKNESS });
  boxes.push({ ...hidden, x: (18.4 + paddock.maxX) / 2, z: paddock.maxZ, halfX: (paddock.maxX - 18.4) / 2, halfZ: FENCE_HALF_THICKNESS });
  return boxes.map((box) => (box.offsetX ? { ...box, x: box.x + box.offsetX } : box));
}

export const OBSTACLES = [
  // The first thing the lone worm meets: a log across its way, just ahead of the start.
  { shape: 'log', x: 14.3, z: 7.3, yaw: 0.1, length: 3.2, radius: 0.34, color: BARK, endColor: BARK_END },
  // Round hay bales in the paddock and a crate stack by the cottage.
  { shape: 'log', x: 11.0, z: 1.6, yaw: 0.5, length: 1.5, radius: 0.62, color: HAY, endColor: HAY_END },
  { shape: 'log', x: 19.5, z: -2.6, yaw: -0.3, length: 1.5, radius: 0.62, color: HAY, endColor: HAY_END },
  { shape: 'log', x: 20.6, z: -1.2, yaw: 0.9, length: 1.5, radius: 0.62, color: HAY, endColor: HAY_END },
  { shape: 'box', x: -12.6, z: -6.6, yaw: 0.3, halfX: 0.6, halfZ: 0.6, height: 0.9, color: CRATE },
  { shape: 'box', x: -11.6, z: -6.2, yaw: 0.5, halfX: 0.45, halfZ: 0.45, height: 0.7, color: CRATE },
  // Woods: fallen trunks lying across the way.
  { shape: 'log', x: -56, z: 9, yaw: 1.2, length: 4.4, radius: 0.55, color: BARK, endColor: BARK_END },
  { shape: 'log', x: -66, z: 15, yaw: 0.2, length: 4.0, radius: 0.5, color: BARK, endColor: BARK_END },
  { shape: 'log', x: -78, z: 18, yaw: 0.8, length: 4.6, radius: 0.6, color: BARK, endColor: BARK_END },
  // The farm cart (a model from props.js), as a box.
  { shape: 'box', x: 12, z: -5.4, yaw: 0.2, halfX: 0.78, halfZ: 1.6, height: 0.9, visible: false },
  ...fenceBoxes(),
];

const localOf = (obstacle, x, z) => {
  const dx = x - obstacle.x;
  const dz = z - obstacle.z;
  const cosine = Math.cos(obstacle.yaw);
  const sine = Math.sin(obstacle.yaw);
  return [dx * cosine - dz * sine, dx * sine + dz * cosine];
};

function logLift(obstacle, localX, localZ) {
  const radius = obstacle.radius;
  const across = Math.abs(localZ);
  const along = Math.max(Math.abs(localX) - obstacle.length / 2, 0);
  if (across >= radius + EDGE || along >= EDGE) return 0;
  const crossSection =
    across < radius ? radius + Math.sqrt(radius * radius - across * across) : radius * (1 - smoothstep(0, EDGE, across - radius));
  return crossSection * (1 - smoothstep(0, EDGE, along));
}

function boxLift(obstacle, localX, localZ) {
  const outsideX = Math.abs(localX) - obstacle.halfX;
  const outsideZ = Math.abs(localZ) - obstacle.halfZ;
  if (outsideX > EDGE || outsideZ > EDGE) return 0;
  const outside = Math.hypot(Math.max(outsideX, 0), Math.max(outsideZ, 0));
  return obstacle.height * (1 - smoothstep(0, EDGE, outside));
}

// The height a worm's spine stands on, above the ground, because of these objects.
export function obstacleLift(x, z) {
  let lift = 0;
  for (const obstacle of OBSTACLES) {
    const reach = (obstacle.shape === 'log' ? obstacle.length / 2 + obstacle.radius : Math.hypot(obstacle.halfX, obstacle.halfZ)) + EDGE + 0.5;
    if (Math.hypot(x - obstacle.x, z - obstacle.z) > reach) continue;
    const [localX, localZ] = localOf(obstacle, x, z);
    lift = Math.max(lift, obstacle.shape === 'log' ? logLift(obstacle, localX, localZ) : boxLift(obstacle, localX, localZ));
  }
  return lift;
}

// Draws the visible ones, resting on the ground at (x, z).
export function buildObstacleMeshes(groundHeight) {
  const group = new THREE.Group();
  for (const obstacle of OBSTACLES) {
    if (obstacle.visible === false) continue;
    let mesh;
    if (obstacle.shape === 'log') {
      const geometry = new THREE.CylinderGeometry(obstacle.radius, obstacle.radius, obstacle.length, 8);
      geometry.rotateZ(Math.PI / 2);
      const side = makeToonMaterial({ color: obstacle.color });
      const end = makeToonMaterial({ color: obstacle.endColor });
      mesh = new THREE.Mesh(geometry, [side, end, end]);
      mesh.position.set(obstacle.x, groundHeight(obstacle.x, obstacle.z) + obstacle.radius, obstacle.z);
    } else {
      const geometry = new THREE.BoxGeometry(obstacle.halfX * 2, obstacle.height, obstacle.halfZ * 2);
      mesh = new THREE.Mesh(geometry, makeToonMaterial({ color: obstacle.color }));
      mesh.position.set(obstacle.x, groundHeight(obstacle.x, obstacle.z) + obstacle.height / 2, obstacle.z);
    }
    mesh.rotation.y = obstacle.yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
