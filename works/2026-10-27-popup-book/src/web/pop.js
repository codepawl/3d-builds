// Pop-up mechanics. All pieces live in the (y, z) plane of one spread and run along the gutter axis x.
//   near leaf  : lies in y = 0, z from the gutter (0) towards the reader
//   far leaf   : turned about the gutter by psi, so it runs along d(psi) = (sin psi, cos psi)
// A Layer is a wall hinged on the near leaf at distance `depth` from the gutter, plus a roof (a step) that stays parallel
// to the near leaf and ties the wall's top back to the wall of the layer behind it (or to the far leaf, for the rearmost
// layer). Layers are stacked with the tallest at the back, so every roof is a visible step and none passes through a
// wall. Box folds close the two ends of each layer with a parallelogram cheek. A V-fold stands on a roof: a front panel
// and a back panel meeting at an apex, solved as a circle intersection each frame.
import * as THREE from 'three';

export const REST_ANGLE = (112 * Math.PI) / 180;

export function direction(psi) {
  return { y: Math.sin(psi), z: Math.cos(psi) };
}

export function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export function circleIntersection(centerA, radiusA, centerB, radiusB) {
  const deltaY = centerB.y - centerA.y;
  const deltaZ = centerB.z - centerA.z;
  const distance = Math.hypot(deltaY, deltaZ) || 1e-6;
  const along = (radiusA * radiusA - radiusB * radiusB + distance * distance) / (2 * distance);
  const clampedAlong = Math.min(radiusA, Math.max(-radiusA, along));
  const height = Math.sqrt(Math.max(0, radiusA * radiusA - clampedAlong * clampedAlong));
  const unitY = deltaY / distance;
  const unitZ = deltaZ / distance;
  const middle = { y: centerA.y + unitY * clampedAlong, z: centerA.z + unitZ * clampedAlong };
  const first = { y: middle.y + unitZ * height, z: middle.z - unitY * height };
  const second = { y: middle.y - unitZ * height, z: middle.z + unitY * height };
  return first.y >= second.y ? first : second;
}

const basis = new THREE.Matrix4();
// Puts a frame at `start` with its local y along the unit vector `along` and its local z (the front) at (-along.z, along.y).
export function orientFrame(object, start, along, x = 0, lift = 0) {
  const front = { y: -along.z, z: along.y };
  object.position.set(x, start.y + front.y * lift, start.z + front.z * lift);
  basis.makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, along.y, along.z), new THREE.Vector3(0, front.y, front.z));
  object.quaternion.setFromRotationMatrix(basis);
}

const paperEdge = new THREE.MeshStandardMaterial({ color: 0xe6dabd, roughness: 1 });

export function paperMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...extra });
}

// A solid card of printed paper with real thickness. Origin: bottom-edge centre, extends along +y, front is +z.
export function makeCard({ width, length, thick = 0.1, front, back = null, backColor = 0xe9dfc6, hangs = false }) {
  const geometry = new THREE.BoxGeometry(width, length, thick);
  geometry.translate(0, hangs ? -length / 2 : length / 2, 0);
  const frontMaterial = front instanceof THREE.Material ? front : paperMaterial(front);
  const backMaterial = back ? paperMaterial(back) : new THREE.MeshStandardMaterial({ color: backColor, roughness: 1 });
  const mesh = new THREE.Mesh(geometry, [paperEdge, paperEdge, paperEdge, paperEdge, frontMaterial, backMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A paper silhouette (alpha cut): two planes a card thickness apart; the back shows the print dimmed like show-through.
export function makeCutout({ width, length, texture, thick = 0.1, backTexture = null, backColor = 0x8a7d66 }) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(width, length);
  geometry.translate(0, length / 2, 0);
  const frontMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, alphaTest: 0.45, side: THREE.FrontSide });
  const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture || texture, color: backTexture ? 0xffffff : backColor, roughness: 1, alphaTest: 0.45, side: THREE.BackSide });
  const frontPlane = new THREE.Mesh(geometry, frontMaterial);
  frontPlane.position.z = thick / 2;
  const backPlane = new THREE.Mesh(geometry, backMaterial);
  backPlane.position.z = -thick / 2;
  for (const plane of [frontPlane, backPlane]) {
    plane.castShadow = true;
    plane.receiveShadow = true;
    group.add(plane);
  }
  group.userData.front = frontPlane;
  return group;
}

// A parallelogram cheek that closes one end of a box fold. Four points are rewritten every frame.
function makeCheek(material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]), 2));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(12), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Wall plus roof: one step of the staircase. `behind` is the layer whose wall the roof is tied to (null: the far leaf).
export class Layer {
  constructor({ name, depth, height, wallWidth, wall, roofFront, roofBack = null, x = 0, behind = null, lag = 0, order = 0, cheekMaterial = null, roofThick = 0.1, roofWidth = null, roofOffsetX = 0, hideRoof = false }) {
    this.roofOffsetX = roofOffsetX;
    this.name = name;
    this.depth = depth;
    this.height = height;
    this.wallWidth = wallWidth;
    this.behind = behind;
    this.lag = lag;
    this.order = order;
    this.x = x;
    this.psi = 0;
    this.frame = new THREE.Group();
    this.frame.name = `${name}-wall`;
    this.frame.add(wall);
    this.wall = wall;
    this.roofLength = behind ? depth - behind.depth : depth;
    this.platformFrame = new THREE.Group();
    this.platform = makeCard({ width: roofWidth || wallWidth, length: this.roofLength, thick: roofThick, front: roofFront, back: roofBack });
    this.platform.visible = !hideRoof;
    this.platformFrame.add(this.platform);
    this.root = new THREE.Group();
    this.root.name = name;
    this.root.userData.assembly = name;
    this.root.add(this.frame, this.platformFrame);
    this.cheeks = [];
    if (cheekMaterial) {
      for (const side of [-1, 1]) {
        const cheek = makeCheek(cheekMaterial);
        cheek.userData.side = side;
        cheek.userData.cheek = true;
        this.root.add(cheek);
        this.cheeks.push(cheek);
      }
    }
    this.farEnd = { y: 0, z: 0 };
  }

  // psiFar is the angle between the leaves. `farOffset` is where the far leaf's inner face passes (it carries the board
  // thicknesses), so a roof tied to the far leaf ends on the real paper surface. A layer lags the opening a little
  // (its wall trails the far leaf by up to `lag` radians midway) so the layers rise one after another.
  update(psiFar, farOffset = { y: 0, z: 0 }) {
    const openness = psiFar / REST_ANGLE;
    const stagger = openness > 0 && openness < 1 ? Math.sin(Math.PI * openness) : 0;
    const psi = Math.max(0, psiFar - this.lag * stagger);
    this.psi = psi;
    const d = direction(psi);
    const lift = this.order * 0.035;
    const base = { y: 0, z: this.depth };
    orientFrame(this.frame, base, d, this.x, lift);
    const top = { y: base.y + this.height * d.y, z: base.z + this.height * d.z };
    let farEnd;
    let farBase;
    if (this.behind) {
      const behindDirection = direction(this.behind.psi);
      farEnd = { y: this.height * behindDirection.y, z: this.behind.depth + this.height * behindDirection.z };
      farBase = { y: 0, z: this.behind.depth };
    } else {
      const farDirection = direction(psiFar);
      farEnd = { y: this.height * farDirection.y + farOffset.y, z: this.height * farDirection.z + farOffset.z };
      farBase = { y: farOffset.y, z: farOffset.z };
    }
    const span = { y: farEnd.y - top.y, z: farEnd.z - top.z };
    const length = Math.hypot(span.y, span.z) || 1e-3;
    orientFrame(this.platformFrame, top, { y: span.y / length, z: span.z / length }, this.x + this.roofOffsetX, lift);
    this.platformFrame.scale.y = length / this.roofLength;
    this.farEnd = farEnd;
    this.farBase = farBase;
    this.top = top;
    const corners = [base, top, farEnd, farBase];
    for (const cheek of this.cheeks) {
      const positions = cheek.geometry.attributes.position;
      const cheekX = this.x + cheek.userData.side * (this.wallWidth / 2 - 0.04);
      // vertex order matches the uv order: base of wall, top of wall, far end, far base
      corners.forEach((corner, index) => positions.setXYZ(index, cheekX, corner.y, corner.z));
      positions.needsUpdate = true;
      cheek.geometry.computeVertexNormals();
      cheek.geometry.computeBoundingSphere();
    }
  }

  // Point on the roof at distance `along` from its far end.
  platformPoint(along) {
    return { y: this.farEnd.y, z: this.farEnd.z + along };
  }
}

// Two panels joined at an apex: panel A hinged on a layer's roof at `hingeAlong`, panel B on the same roof at `backAlong`.
export class VFold {
  // The panels stand between page angles riseFrom and riseTo (radians); a V-fold that must clear a taller wall in front of
  // it rises late.
  constructor({ layer, x, width, hingeAlong, backAlong = 0, panelLength, panelA, panelB = null, order = 0, riseFrom = 0.4, riseTo = 1.3 }) {
    this.riseFrom = riseFrom;
    this.riseTo = riseTo;
    this.layer = layer;
    this.hingeAlong = hingeAlong;
    this.backAlong = backAlong;
    this.panelLength = panelLength;
    this.backLength = Math.hypot(panelLength, hingeAlong - backAlong);
    this.order = order;
    this.x = x;
    this.root = new THREE.Group();
    this.root.userData.assembly = layer.name;
    this.frameA = new THREE.Group();
    this.frameB = new THREE.Group();
    this.frameA.add(panelA);
    this.panelB = panelB || makeCard({ width: width * 0.96, length: this.backLength, thick: 0.08, front: new THREE.MeshStandardMaterial({ color: 0xd9cdb0, roughness: 1 }) });
    this.frameB.add(this.panelB);
    this.root.add(this.frameA, this.frameB);
    this.apex = { y: 0, z: 0 };
  }

  update(psiFar) {
    const layer = this.layer;
    const hingeA = layer.platformPoint(this.hingeAlong);
    const hingeB = layer.platformPoint(this.backAlong);
    const standing = circleIntersection(hingeA, this.panelLength, hingeB, this.backLength);
    // Near a closed book the panels cannot stand at fixed length, so they fold down onto the roof: the apex slides to the
    // middle of the two hinges and the panels shorten.
    const middle = { y: (hingeA.y + hingeB.y) / 2, z: (hingeA.z + hingeB.z) / 2 };
    const blend = smoothstep((psiFar - this.riseFrom) / (this.riseTo - this.riseFrom));
    const apex = { y: middle.y + (standing.y - middle.y) * blend, z: middle.z + (standing.z - middle.z) * blend };
    const lengthA = Math.max(1e-3, Math.hypot(apex.y - hingeA.y, apex.z - hingeA.z));
    const lengthB = Math.max(1e-3, Math.hypot(apex.y - hingeB.y, apex.z - hingeB.z));
    const lift = 0.05 + this.order * 0.03;
    orientFrame(this.frameA, hingeA, { y: (apex.y - hingeA.y) / lengthA, z: (apex.z - hingeA.z) / lengthA }, this.x, lift);
    orientFrame(this.frameB, hingeB, { y: (apex.y - hingeB.y) / lengthB, z: (apex.z - hingeB.z) / lengthB }, this.x, -lift);
    this.frameA.scale.y = lengthA / this.panelLength;
    this.frameB.scale.y = lengthB / this.backLength;
    this.apex = apex;
  }
}

// A triangular lectern on the near leaf: a printed slope card over a solid wedge (two triangle sides and a back), the
// "booklet flap" that carries a short text. It grows from flat as the book opens, so a closed book stays flat.
export function makeLectern({ width, slopeLength, angleDegrees, texture }) {
  const angle = (angleDegrees * Math.PI) / 180;
  const height = slopeLength * Math.sin(angle);
  const run = slopeLength * Math.cos(angle);
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(run, 0), new THREE.Vector2(run, height)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width - 0.16, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-(width - 0.16) / 2, 0, 0);
  const wedge = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe2d5b6, roughness: 1 }));
  wedge.castShadow = true;
  wedge.receiveShadow = true;
  inner.add(wedge);
  const card = makeCard({ width, length: slopeLength, thick: 0.08, front: paperMaterial(texture) });
  orientFrame(card, { y: 0.02, z: 0.03 }, { y: Math.sin(angle), z: -Math.cos(angle) }, 0, 0.02);
  inner.add(card);
  group.userData.inner = inner;
  group.userData.depth = run;
  group.userData.height = height;
  group.userData.assembly = 'lectern';
  group.setStand = (stand) => {
    inner.scale.y = Math.max(0.001, stand);
  };
  return group;
}
