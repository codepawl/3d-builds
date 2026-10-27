// The castle itself: rock block, moat, walls, towers, gatehouse, bailey buildings and the cut-open keep.
// Everything animated here is a function of t through update(t).
import * as THREE from 'three';
import { Batch, makeRandom, smoothstep, glowSpriteTexture, emblemTexture } from './kit.js';

export const FRONT = 12;
export const LEVEL = { dungeon: -12, storage: -6, kitchen: 0, chapel: 6, hall: 12, lord: 19.5, roof: 26 };
export const GATE_X = -22;

// Time table for the one-shot events of the world, shared with the sound export.
export const SCRIPT = { bridgeStart: 3.0, bridgeLand: 5.2, portcullisStart: 5.0, portcullisEnd: 6.4, bellTolls: [16.6, 18.4] };

const easeInOut = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

export function buildWorld(scene, M) {
  const random = makeRandom(11);
  const batch = new Batch(M);
  const woodBatch = batch;
  const animated = { flames: [], glows: [], lights: [], smokes: [], flags: [], windows: [] };
  const anchors = {};
  const box = (name, x0, y0, z0, x1, y1, z1, rotation) => batch.span(name, x0, y0, z0, x1, y1, z1, rotation);
  const cylinder = (name, x, y, z, radiusTop, radiusBottom, height, segments, rotation, open) =>
    batch.cylinder(name, x, y, z, radiusTop, radiusBottom, height, segments, rotation, open);

  const glowTextures = {
    warm: glowSpriteTexture('rgba(255,210,130,1)', 'rgba(255,140,50,0.45)'),
    smoke: glowSpriteTexture('rgba(150,140,130,0.9)', 'rgba(150,140,130,0.35)'),
  };

  // ---------- light and fire helpers ----------
  function addLight(x, y, z, base, lamp, distance, color = 0xffa850) {
    const light = new THREE.PointLight(color, base, distance, 2);
    light.position.set(x, y, z);
    scene.add(light);
    animated.lights.push({ light, base, lamp, phase: random() * 10 });
    return light;
  }

  function addGlow(x, y, z, size, strength, lampOnly = false) {
    const material = new THREE.SpriteMaterial({ map: glowTextures.warm, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    animated.glows.push({ sprite, size, strength, lampOnly, phase: random() * 10 });
  }

  function addFlame(x, y, z, size, withLight = null) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.28 * size, 0.9 * size, 7), M.flame.material);
    outer.position.y = 0.45 * size;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15 * size, 0.55 * size, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    inner.position.y = 0.3 * size;
    group.add(outer, inner);
    scene.add(group);
    animated.flames.push({ group, phase: random() * 10 });
    addGlow(x, y + 0.5 * size, z, 3.2 * size, 0.55);
    if (withLight) {
      addLight(x, y + 0.9 * size, z, withLight.base, withLight.lamp, withLight.distance);
    }
  }

  function addSmoke(x, y, z, scale = 1, count = 9) {
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.SpriteMaterial({ map: glowTextures.smoke, transparent: true, depthWrite: false, opacity: 0, color: 0xcfc6bb });
      const sprite = new THREE.Sprite(material);
      scene.add(sprite);
      animated.smokes.push({ sprite, x, y, z, scale, offset: index / count, drift: 0.8 + random() * 0.6 });
    }
  }

  // ---------- window decals that light up at dusk ----------
  function windowDecal(x, y, z, facing, width, height, glassName = 'windowGlow') {
    const depth = 0.16;
    const alongX = facing === '+z' || facing === '-z';
    const frameWidth = alongX ? width + 0.4 : depth;
    const frameDepth = alongX ? depth : width + 0.4;
    const sign = facing[0] === '+' ? 1 : -1;
    const offsetX = alongX ? 0 : sign * 0.04;
    const offsetZ = alongX ? sign * 0.04 : 0;
    batch.box('stoneDeep', x + offsetX, y, z + offsetZ, frameWidth, height + 0.4, frameDepth);
    batch.box(glassName, x + offsetX + (alongX ? 0 : sign * 0.06), y, z + offsetZ + (alongX ? sign * 0.06 : 0), alongX ? width : 0.1, height, alongX ? 0.1 : width);
    batch.box('woodDark', x + offsetX + (alongX ? 0 : sign * 0.12), y, z + offsetZ + (alongX ? sign * 0.12 : 0), alongX ? 0.12 : 0.06, height, alongX ? 0.06 : 0.12);
    batch.box('woodDark', x + offsetX + (alongX ? 0 : sign * 0.12), y, z + offsetZ + (alongX ? sign * 0.12 : 0), alongX ? width : 0.06, 0.12, alongX ? 0.06 : width);
  }

  // ---------- crenellations ----------
  function merlonsAlongX(x0, x1, z, y, material = 'stone', depth = 0.8) {
    for (let x = x0 + 0.8; x < x1 - 0.6; x += 3) {
      box(material, x - 0.8, y, z - depth / 2, x + 0.8, y + 1.5, z + depth / 2);
    }
  }
  function merlonsAlongZ(z0, z1, x, y, material = 'stone', depth = 0.8) {
    for (let z = z0 + 0.8; z < z1 - 0.6; z += 3) {
      box(material, x - depth / 2, y, z - 0.8, x + depth / 2, y + 1.5, z + 0.8);
    }
  }
  function merlonsRing(centerX, centerZ, radius, y, count = 14) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      batch.box('stone', centerX + Math.cos(angle) * radius, y + 0.75, centerZ + Math.sin(angle) * radius, 1.7, 1.5, 0.85, [0, -angle + Math.PI / 2, 0]);
    }
  }

  // ---------- roofs ----------
  function coneRoof(x, y, z, radius, height, material = 'slate', segments = 12, rotationY = 0) {
    const geometry = new THREE.ConeGeometry(radius, height, segments);
    const uv = geometry.attributes.uv;
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, uv.getX(index) * ((Math.PI * 2 * radius) / M[material].tile), uv.getY(index) * (height / M[material].tile));
    }
    batch.push(material, geometry, [x, y + height / 2, z], [0, rotationY, 0]);
  }
  // A sloped roof plane: spans (x0..x1) wide, from the high edge z to the low edge z, thickness fixed.
  function leanTo(x0, x1, zHigh, zLow, yHigh, yLow, material) {
    const rise = yHigh - yLow;
    const run = Math.abs(zLow - zHigh);
    const length = Math.hypot(rise, run) + 0.8;
    const tilt = Math.atan2(rise, run) * Math.sign(zLow - zHigh);
    batch.box(material, (x0 + x1) / 2, (yHigh + yLow) / 2, (zHigh + zLow) / 2, x1 - x0 + 0.8, 0.28, length, [tilt, 0, 0]);
  }

  // =========================================================
  // GROUND, ROCK, MOAT
  // =========================================================
  box('stone', -36, -14, -28, 4, -0.1, FRONT);
  box('dirt', -36, -0.1, -28, 4, 0, FRONT);
  box('strata', 4, -14, -28, 28, -0.1, -4);
  box('dirt', 4, -0.1, -28, 28, 0, -4);
  box('strata', -52, -14, 20, 4, -0.1, 34);
  box('grass', -52, -0.1, 20, 4, 0, 34);
  box('strata', -52, -14, -28, -44, -0.1, 20);
  box('grass', -52, -0.1, -28, -44, 0, 20);
  const waterFront = new THREE.Mesh(new THREE.BoxGeometry(48, 4.2, 8), M.water.material);
  waterFront.position.set(-20, -3.9, 16);
  const waterWest = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 40), M.water.material);
  waterWest.position.set(-40, -3.9, -8);
  waterFront.receiveShadow = true;
  waterWest.receiveShadow = true;
  scene.add(waterFront, waterWest);
  M.water.material.map.repeat.set(4, 1);
  box('strata', -44, -14, 12, 4, -6, 20);
  box('strata', -44, -14, -28, -36, -6, 12);

  // the page is unlit so it stays cream; a transparent plane above it catches the castle's shadow
  M.parchment.material.map.repeat.set(40, 40);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: M.parchment.material.map }));
  page.rotation.x = -Math.PI / 2;
  page.position.y = -14.05;
  scene.add(page);
  const pageShadow = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ color: 0x5a4020, opacity: 0.3 }));
  pageShadow.rotation.x = -Math.PI / 2;
  pageShadow.position.y = -14.0;
  pageShadow.receiveShadow = true;
  scene.add(pageShadow);

  // rocks at the foot and the right side of the keep, seeded so they are the same every run
  const rockMaterial = new THREE.MeshStandardMaterial({ map: M.strata.material.map, color: 0xd8d0c0, roughness: 1 });
  const rockLayout = [
    [40, -10, 2, 6.5], [38, -10, -14, 7.5], [-60, -11, 10, 6], [-54, -11, 40, 6], [-40, -12, 46, 5], [-58, -11, -16, 7],
  ];
  for (const [rockX, rockY, rockZ, rockSize] of rockLayout) {
    const geometry = new THREE.IcosahedronGeometry(rockSize, 2);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const px = positions.getX(index);
      const py = positions.getY(index);
      const pz = positions.getZ(index);
      const factor = 1 + 0.07 * Math.sin(px * 0.6 + py * 0.9) * Math.cos(pz * 0.7 - px * 0.3) + 0.04 * Math.sin(pz * 1.3 + py * 0.5);
      positions.setXYZ(index, px * factor, py * factor * 0.75, pz * factor);
    }
    geometry.computeVertexNormals();
    const rock = new THREE.Mesh(geometry, rockMaterial);
    rock.position.set(rockX, rockY, rockZ);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // trees on the banks
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x7da556, roughness: 1 });
  const leafMaterialAlt = new THREE.MeshStandardMaterial({ color: 0x93b05a, roughness: 1 });
  for (const [treeX, treeZ, treeScale] of [[-50, 22, 1.2], [-49, 2, 1.1], [-48, -17, 1.3], [-9, 31, 1.0], [-3, 27, 0.8]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * treeScale, 0.55 * treeScale, 3.6 * treeScale, 6), trunkMaterial);
    trunk.position.set(treeX, 1.8 * treeScale, treeZ);
    trunk.castShadow = true;
    scene.add(trunk);
    [[0, 5.0, 0, 2.4], [1.3, 4.3, 0.8, 1.8], [-1.2, 4.4, -0.6, 1.9]].forEach(([dx, dy, dz, radius], blob) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * treeScale, 2), blob % 2 ? leafMaterialAlt : leafMaterial);
      crown.position.set(treeX + dx * treeScale, dy * treeScale, treeZ + dz * treeScale);
      crown.castShadow = true;
      scene.add(crown);
    });
  }

  // =========================================================
  // CURTAIN WALLS
  // =========================================================
  box('stone', -36, 0, -28, 28, 9, -25.6);
  merlonsAlongX(-36, 28, -27.6, 9);
  box('stone', -36, 0, -25.6, -33.6, 9, FRONT);
  merlonsAlongZ(-28, FRONT, -35.6, 9);
  box('stone', 26, 0, -25.6, 28, 9, -4);
  merlonsAlongZ(-28, -4, 27.6, 9);
  box('stone', -36, 0, 9.6, -31, 6.5, FRONT);
  box('stone', -13, 0, 9.6, 4, 6.5, FRONT);
  merlonsAlongX(-36, -31, 11.6, 6.5);
  merlonsAlongX(-13, 4, 11.6, 6.5);
  // inner wall-walk kerb so the walk reads as a path
  box('stoneDeep', -33.6, 9, -25.6, 26, 9.35, -25.25);
  box('stoneDeep', -33.6, 9, -25.25, -33.25, 9.35, 9.6);

  // round towers
  function roundTower(centerX, centerZ, radius, height, roof) {
    cylinder('stone', centerX, height / 2, centerZ, radius, radius + 0.15, height, 20);
    cylinder('stone', centerX, height + 0.3, centerZ, radius + 0.55, radius + 0.45, 0.7, 20);
    if (roof === 'cone') {
      coneRoof(centerX, height + 0.65, centerZ, radius + 1.2, 9, 'slate', 20);
    } else {
      merlonsRing(centerX, centerZ, radius + 0.2, height + 0.65);
    }
  }
  roundTower(-35, -27, 4.8, 15, 'cone');
  roundTower(27, -27, 4.6, 14, 'open');
  roundTower(-35, 10.6, 4.4, 11.5, 'open');
  // back turrets of the keep
  roundTower(4, -4.5, 3.1, 31, 'cone');
  roundTower(28, -4.5, 3.1, 29, 'open');
  // arrow slits
  for (const [slitX, slitZ] of [[-30, -25.5], [-16, -25.5], [0, -25.5], [14, -25.5]]) {
    batch.box('stoneDeep', slitX, 5, slitZ, 0.5, 1.8, 0.2);
  }
  for (const slitZ of [-18, -2, 4]) {
    batch.box('stoneDeep', -33.5, 5, slitZ, 0.2, 1.8, 0.5);
  }
  // mid west square tower with a timber hoarding
  box('stone', -36.6, 0, -13, -30.4, 12.5, -5.5);
  box('woodDark', -37.3, 12.5, -13.6, -29.8, 14.2, -4.9);
  for (let post = 0; post < 5; post += 1) {
    box('wood', -37.3 + post * 1.875, 14.2, -13.6, -37.1 + post * 1.875, 16, -13.4);
    box('wood', -37.3 + post * 1.875, 14.2, -5.1, -37.1 + post * 1.875, 16, -4.9);
  }
  leanTo(-37.3, -29.8, -13.6, -4.9, 16.5, 16.5, 'brownRoof');
  box('brownRoof', -37.7, 16, -14, -29.4, 16.3, -4.5);
  windowDecal(-29.9, 8, -9.2, '+x', 1.0, 1.8);

  // =========================================================
  // GATEHOUSE
  // =========================================================
  const gateShape = new THREE.Shape();
  gateShape.moveTo(-31, 0);
  gateShape.lineTo(-13, 0);
  gateShape.lineTo(-13, 11.8);
  gateShape.lineTo(-31, 11.8);
  gateShape.lineTo(-31, 0);
  const archHole = new THREE.Path();
  archHole.moveTo(GATE_X - 2.5, 0);
  archHole.lineTo(GATE_X - 2.5, 4.6);
  archHole.absarc(GATE_X, 4.6, 2.5, Math.PI, 0, true);
  archHole.lineTo(GATE_X + 2.5, 0);
  archHole.lineTo(GATE_X - 2.5, 0);
  gateShape.holes.push(archHole);
  const gateGeometry = new THREE.ExtrudeGeometry(gateShape, { depth: 10, bevelEnabled: false, curveSegments: 18 });
  gateGeometry.translate(0, 0, 2);
  const gateUv = gateGeometry.attributes.uv;
  for (let index = 0; index < gateUv.count; index += 1) {
    gateUv.setXY(index, gateUv.getX(index) / 8, gateUv.getY(index) / 8);
  }
  batch.shape('stone', gateGeometry, [0, 0, 0]);
  merlonsAlongX(-31, -13, 11.6, 11.8);
  merlonsAlongX(-31, -13, 2.4, 11.8);
  merlonsAlongZ(2, FRONT, -30.6, 11.8);
  merlonsAlongZ(2, FRONT, -13.4, 11.8);
  for (const turretX of [-31, -13]) {
    cylinder('stone', turretX, 8.5, 11, 2.3, 2.5, 17, 14);
    cylinder('stone', turretX, 17.2, 11, 3, 2.8, 0.8, 14);
    coneRoof(turretX, 17.6, 11, 3.2, 6.5, 'slate', 14);
  }
  // guard room on the gatehouse roof
  // gate windows and torches
  windowDecal(-27.2, 9.5, FRONT + 0.0, '+z', 1.0, 2.0);
  windowDecal(-16.8, 9.5, FRONT + 0.0, '+z', 1.0, 2.0);
  windowDecal(-22, 9.2, FRONT + 0.0, '+z', 0.9, 1.4);
  // shields on the gatehouse
  const shieldMaterial = new THREE.MeshStandardMaterial({ map: emblemTexture('#b02a2e', '#e8c45a'), roughness: 0.9 });
  for (const shieldX of [-26, -18]) {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.18), shieldMaterial);
    shield.position.set(shieldX, 7.8, FRONT + 0.1);
    shield.castShadow = true;
    scene.add(shield);
  }
  // sill and road
  box('dirt', -24.6, -0.1, 2, -19.4, 0.02, FRONT + 0.2);
  box('stoneDeep', -25.2, -2, FRONT - 0.1, -18.8, 0.1, FRONT + 0.7);

  // portcullis
  const portcullis = new THREE.Group();
  const ironMaterial = M.iron.material;
  for (let bar = 0; bar < 11; bar += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.6, 0.16), ironMaterial);
    post.position.set(GATE_X - 2.4 + bar * 0.48, 3.8, 0);
    post.castShadow = true;
    portcullis.add(post);
  }
  for (let row = 0; row < 7; row += 1) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 0.18), ironMaterial);
    rail.position.set(GATE_X, 0.7 + row * 1.15, 0);
    portcullis.add(rail);
  }
  portcullis.position.set(0, 0, FRONT - 1.2);
  scene.add(portcullis);

  // drawbridge: a leaf hinged at the sill, hauled by two chains
  const bridge = new THREE.Group();
  bridge.position.set(GATE_X, 0.12, FRONT + 0.25);
  const leafBatch = new Batch(M);
  leafBatch.box('wood', 0, 0.15, 4.4, 4.4, 0.34, 8.8);
  for (const beamX of [-2.3, 2.3]) {
    leafBatch.box('woodDark', beamX, 0.5, 4.4, 0.34, 0.5, 8.8);
  }
  for (let band = 1; band < 5; band += 1) {
    leafBatch.box('iron', 0, 0.34, band * 1.75, 4.5, 0.06, 0.2);
  }
  leafBatch.build(bridge);
  scene.add(bridge);
  const chains = [-2.0, 2.0].map((side) => {
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1), ironMaterial);
    chain.castShadow = true;
    scene.add(chain);
    return { chain, side };
  });
  const chainAnchorY = 10.4;
  // far bank landing stone
  box('stoneDeep', -25, -2, 20.0, -19, 0.1, 21);
  anchors.bridgeTip = new THREE.Vector3();

  // =========================================================
  // THE KEEP, CUT OPEN ON ITS FRONT
  // =========================================================
  // A floor slab with an optional rectangular stair opening { x0, x1, z0, z1 }; the front edge shows a dark cut face.
  const slabOpen = (top, hole, floorName) => {
    const pieces = [];
    if (!hole) {
      pieces.push([6, -2, 26, FRONT]);
    } else {
      pieces.push([6, -2, hole.x0, FRONT], [hole.x1, -2, 26, FRONT], [hole.x0, -2, hole.x1, hole.z0], [hole.x0, hole.z1, hole.x1, FRONT]);
    }
    for (const [x0, z0, x1, z1] of pieces) {
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) {
        continue;
      }
      box('stone', x0, top - 0.8, z0, x1, top - 0.08, z1);
      box(floorName, x0, top - 0.08, z0, x1, top, z1);
      if (z1 >= FRONT - 0.01) {
        box('cut', x0, top - 0.8, FRONT, x1, top, FRONT + 0.14);
      }
    }
  };
  box('stoneDeep', 4, -14, -4, 28, -12, FRONT);
  box('cut', 4, -14, FRONT, 28, -12, FRONT + 0.14);
  slabOpen(LEVEL.dungeon + 6, null, 'stoneDeep');
  slabOpen(LEVEL.storage + 6, null, 'stone');
  slabOpen(LEVEL.chapel, { x0: 23.6, x1: 26, z0: -0.8, z1: 4.4 }, 'stone');
  slabOpen(LEVEL.hall, { x0: 6, x1: 8.4, z0: -0.8, z1: 4.0 }, 'wood');
  slabOpen(LEVEL.lord, null, 'wood');
  slabOpen(LEVEL.roof, null, 'stone');

  // outer walls of the keep in two vertical pieces, rock below the bailey
  const keepWall = (x0, z0, x1, z1) => {
    box('stoneDeep', x0, -14, z0, x1, 0, z1);
    box('stone', x0, 0, z0, x1, LEVEL.roof, z1);
  };
  keepWall(4, -4, 6, FRONT);
  keepWall(26, -4, 28, FRONT);
  keepWall(4, -4, 28, -2);
  for (const capX of [[4, 6], [26, 28]]) {
    box('cut', capX[0], -14, FRONT, capX[1], LEVEL.roof, FRONT + 0.14);
  }
  // door in the kitchen's left wall: clear it by laying a dark passage over the stone, wall stays solid above
  box('woodDark', 3.9, 0, 2.0, 4.1, 3.6, 4.4);
  box('iron', 3.85, 3.4, 2.0, 4.15, 3.6, 4.4);

  // keep roof: parapet, timber lookout with a slate roof and the bell
  merlonsAlongX(4, 28, FRONT + 0.4, LEVEL.roof);
  merlonsAlongX(4, 28, -3.6, LEVEL.roof);
  merlonsAlongZ(-4, FRONT, 4.4, LEVEL.roof);
  merlonsAlongZ(-4, FRONT, 27.6, LEVEL.roof);
  for (const [postX, postZ] of [[11, 0], [21, 0], [11, 8], [21, 8], [16, 0], [16, 8], [11, 4], [21, 4]]) {
    box('wood', postX - 0.2, LEVEL.roof, postZ - 0.2, postX + 0.2, LEVEL.roof + 3.6, postZ + 0.2);
  }
  box('woodDark', 10.6, LEVEL.roof + 3.6, -0.4, 21.4, LEVEL.roof + 4.1, 8.4);
  box('woodDark', 10.6, LEVEL.roof + 1.2, FRONT - 3.6, 21.4, LEVEL.roof + 1.5, FRONT - 3.5);
  coneRoof(16, LEVEL.roof + 4.1, 4, 8.6, 6.4, 'slate', 4, Math.PI / 4);
  const bellPivot = new THREE.Group();
  bellPivot.position.set(16, LEVEL.roof + 3.5, 4);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.8, 1.2, 12), M.gold.material);
  bell.position.y = -0.8;
  bell.castShadow = true;
  bellPivot.add(bell);
  box('woodDark', 15.5, LEVEL.roof + 3.45, 3.9, 16.5, LEVEL.roof + 3.6, 4.1);
  scene.add(bellPivot);
  anchors.bell = new THREE.Vector3(16, LEVEL.roof + 3, 4);

  // chimney stack on the back wall, from the kitchen hearth up past the roof
  box('stone', 10.6, 0, -5.6, 14.4, 29.6, -4);
  box('stoneDeep', 10.3, 29.6, -5.9, 14.7, 30.3, -3.7);
  addSmoke(12.5, 30.4, -4.8, 1.3, 10);

  // ---------- keep rooms ----------
  const innerLeft = 6;
  const innerRight = 26;
  const backZ = -2;

  // pillars and ribs in the chapel and hall to read as stone interiors
  // DUNGEON
  box('stoneDeep', 19, -12, backZ, 19.6, -6.8, 2);
  box('stoneDeep', 19, -12, 4.4, 19.6, -6.8, 7);
  box('stoneDeep', 19, -9.2, 2, 19.6, -6.8, 4.4);
  for (let bar = 0; bar < 6; bar += 1) {
    box('iron', 19.1, -12, 2.2 + bar * 0.4, 19.3, -9.2, 2.3 + bar * 0.4);
  }
  for (let bar = 0; bar < 15; bar += 1) {
    box('iron', 19.5 + bar * 0.43, -12, 6.9, 19.6 + bar * 0.43, -6.8, 7.0);
  }
  box('iron', 19, -10, 6.85, 26, -9.9, 7.05);
  box('iron', 19, -8, 6.85, 26, -7.9, 7.05);
  for (const strawX of [21, 23.6, 25]) {
    box('hay', strawX - 0.9, -12, 0.2 + (strawX % 3), strawX + 0.9, -11.6, 1.8 + (strawX % 3));
  }
  box('iron', 25.8, -9.5, 1, 25.95, -8, 1.1);
  box('iron', 25.8, -9.5, 3, 25.95, -8, 3.1);
  box('wood', 8.5, -12, 3.5, 12.5, -10.9, 5.5);
  box('wood', 8.3, -12, 3.3, 8.7, -10.9, 3.7);
  box('wood', 12.3, -12, 5.3, 12.7, -10.9, 5.7);
  box('candle', 10.4, -10.9, 4.2, 10.7, -10.5, 4.5);
  addFlame(10.55, -10.5, 4.35, 0.45);
  box('wood', 10, -12, 6.0, 11, -11.45, 6.8);
  box('wood', 21.9, -12, 1.0, 22.7, -11.45, 1.8);
  cylinder('barrel', 7.4, -11.4, 0.2, 0.7, 0.7, 1.3, 12);
  cylinder('barrel', 15.2, -11.4, 0.0, 0.7, 0.7, 1.3, 12);
  box('wood', 14, -12, 0.2, 16, -11.6, 1.2);
  // torch on the back wall
  box('woodDark', 8.9, -9.6, -1.9, 9.1, -8.4, -1.7);
  addFlame(9, -8.5, -1.7, 0.8, { base: 20, lamp: 24, distance: 16 });
  addLight(22, -9, 3.5, 6, 6, 9);

  // FOOD STORAGE
  for (const [barrelX, barrelZ] of [[7.5, -0.6], [9.1, -0.6], [10.7, -0.6], [8.3, -0.6], [9.9, -0.6]]) {
    const level = (barrelX === 8.3 || barrelX === 9.9) ? 1 : 0;
    cylinder('barrel', barrelX, -5.2 + level * 1.4 + 0.65 - (level ? -0.0 : 0), barrelZ + (level ? 0 : 0.0), 0.75, 0.75, 1.3, 12);
  }
  for (const [barrelX, barrelZ] of [[7.8, 3.2], [9.4, 3.2], [8.6, 4.6], [14, 7.5]]) {
    cylinder('barrel', barrelX, -5.35, barrelZ, 0.72, 0.72, 1.3, 12);
  }
  box('woodDark', 12, -6, -1.9, 21, -5.9, -1);
  for (let shelf = 0; shelf < 3; shelf += 1) {
    box('woodDark', 12, -4.8 + shelf * 1.3, -1.9, 21, -4.7 + shelf * 1.3, -0.9);
    for (let item = 0; item < 6; item += 1) {
      cylinder(item % 2 ? 'sack' : 'food', 12.6 + item * 1.35, -4.4 + shelf * 1.3, -1.4, 0.32, 0.36, 0.7, 8);
    }
  }
  for (const sackX of [17, 18.2, 19.4, 22.5, 23.5]) {
    batch.box('sack', sackX, -5.5, 6.5 + (sackX % 2), 0.9, 1.0, 0.7);
  }
  box('sack', 21, -6, 6.3, 22.2, -5.2, 7.6);
  for (let ham = 0; ham < 5; ham += 1) {
    cylinder('food', 8 + ham * 1.7, -2.4, 7.4, 0.28, 0.4, 0.8, 8);
    box('iron', 7.95 + ham * 1.7, -1.6, 7.35, 8.05 + ham * 1.7, -0.8, 7.45);
  }
  box('woodDark', 6, -1.8, 7.3, 26, -1.4, 7.5);
  addFlame(24.5, -5.4, 10.8, 0.4);
  box('woodDark', 24.4, -6, 10.7, 24.6, -5.4, 10.9);
  addLight(16, -3, 5, 8, 8, 13);

  // KITCHEN
  box('stoneDeep', 9, 0, -2, 15.5, 0.6, 1);
  box('stoneDeep', 8.6, 0, -2, 9.2, 4.8, 1.2);
  box('stoneDeep', 15.3, 0, -2, 15.9, 4.8, 1.2);
  box('stoneDeep', 8.6, 3.3, -2, 15.9, 5.2, 1.3);
  box('woodDark', 9.2, 0.6, -2, 15.3, 3.3, -1.7);
  cylinder('pot', 12.2, 2.0, 0.45, 0.75, 0.55, 0.9, 12);
  box('iron', 12.1, 2.6, 0.35, 12.3, 3.4, 0.55);
  box('iron', 10, 1.5, 0.35, 14.4, 1.6, 0.55);
  addFlame(11.2, 0.6, 0.2, 1.5);
  addFlame(13.2, 0.6, 0.2, 1.2);
  addLight(12.2, 2.2, 1.6, 36, 22, 18, 0xff9a48);
  // work tables, shelves, barrels
  box('wood', 16.5, 0, 3.4, 22.5, 1.1, 5.4);
  box('wood', 8, 0, 6, 13, 1.1, 8);
  for (const [foodX, foodZ] of [[17.5, 4], [19, 4.6], [20.4, 4.0], [21.6, 4.7]]) {
    cylinder('food', foodX, 1.3, foodZ, 0.28, 0.3, 0.4, 8);
  }
  box('cloth', 9.2, 1.1, 6.4, 11.2, 1.18, 7.6);
  cylinder('pot', 12, 1.4, 6.6, 0.4, 0.3, 0.5, 10);
  for (let pot = 0; pot < 5; pot += 1) {
    cylinder('pot', 16.6 + pot * 1.3, 3.3, -1.2, 0.28, 0.3, 0.45, 8);
    box('iron', 16.55 + pot * 1.3, 3.55, -1.3, 16.65 + pot * 1.3, 4.1, -1.2);
  }
  box('woodDark', 16, 3.8, -1.9, 23, 3.9, -1);
  for (const barrelX of [22.2, 23.4]) {
    cylinder('barrel', barrelX, 0.65, -0.8, 0.6, 0.6, 1.3, 10);
  }
  cylinder('barrel', 7.3, 0.65, 10.8, 0.6, 0.6, 1.3, 10);
  box('sack', 6.6, 0, 7.6, 7.4, 0.8, 8.6);
  windowDecal(6.05, 3.3, 8, '+x', 0.5, 1.5);
  windowDecal(21, 3.4, -1.95, '+z', 1.0, 1.6);
  addLight(18, 3.8, 6, 12, 14, 14);

  // CHAPEL
  box('stone', 14, 6, -1.9, 18, 7.1, 0.3);
  box('cloth', 13.8, 7.0, -1.9, 18.2, 7.15, 0.5);
  box('gold', 15.8, 7.1, -1.7, 16.2, 9.6, -1.5);
  box('gold', 15.2, 8.7, -1.7, 16.8, 9.1, -1.5);
  for (const candleX of [14.5, 17.5]) {
    box('candle', candleX - 0.12, 7.15, -0.2, candleX + 0.12, 7.9, 0.05);
    addFlame(candleX, 7.9, -0.07, 0.3);
  }
  // stained glass in a framed arch window
  box('stoneDeep', 12.6, 7.4, -2.0, 19.4, 11.0, -1.85);
  const glassNames = ['glassBlue', 'glassRed', 'glassGold', 'glassBlue', 'glassGold', 'glassRed'];
  for (let column = 0; column < 6; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      const name = glassNames[(column + row * 2) % 6];
      box(name, 12.8 + column * 1.0, 7.6 + row * 1.05, -1.9, 13.75 + column * 1.0, 8.55 + row * 1.05, -1.8);
    }
  }
  for (const rowZ of [3.6, 5.6, 7.6]) {
    for (const bench of [[9.2, 14.2], [17.8, 22.2]]) {
      box('wood', bench[0], 6, rowZ, bench[1], 6.55, rowZ + 0.7);
      box('woodDark', bench[0], 6.55, rowZ + 0.55, bench[1], 7.5, rowZ + 0.7);
    }
  }
  box('red', 15, 6.0, 1.4, 17, 6.06, 9);
  windowDecal(6.05, 9.2, 4, '+x', 0.9, 2.2, 'glassBlue');
  addLight(16, 9.5, 4, 14, 10, 14, 0xffc070);

  // GREAT HALL
  box('wood', 10.6, 12.72, 3.9, 23, 12.9, 5.9);
  for (const [legX, legZ] of [[10.8, 4.1], [22.8, 4.1], [10.8, 5.7], [22.8, 5.7]]) {
    box('woodDark', legX - 0.15, 12, legZ - 0.15, legX + 0.15, 12.72, legZ + 0.15);
  }
  box('cloth', 10.6, 12.9, 4.4, 23, 12.96, 5.4);
  for (const benchZ of [2.9, 6.3]) {
    box('woodDark', 10.6, 12, benchZ, 23, 12.55, benchZ + 0.7);
  }
  for (let place = 0; place < 9; place += 1) {
    cylinder(place % 3 ? 'pot' : 'gold', 11.4 + place * 1.3, 13.05, 4.5 + (place % 2) * 0.5, 0.18, 0.15, 0.2, 8);
  }
  box('food', 16, 12.96, 4.7, 17.4, 13.4, 5.3);
  const bannerTextureRed = new THREE.MeshStandardMaterial({ map: emblemTexture('#a8282c', '#e6c25a'), roughness: 0.9, side: THREE.DoubleSide });
  const bannerTextureBlue = new THREE.MeshStandardMaterial({ map: emblemTexture('#2c4a96', '#e6c25a'), roughness: 0.9, side: THREE.DoubleSide });
  [[8.6, bannerTextureRed], [13.4, bannerTextureBlue], [18.2, bannerTextureRed], [23, bannerTextureBlue]].forEach(([bannerX, material]) => {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.4), material);
    banner.position.set(bannerX, 15.6, -1.85);
    banner.castShadow = true;
    scene.add(banner);
    box('woodDark', bannerX - 1.1, 17.9, -1.95, bannerX + 1.1, 18.1, -1.7);
  });
  windowDecal(10.8, 15.4, -1.97, '+z', 1.0, 2.4);
  windowDecal(20.6, 15.4, -1.97, '+z', 1.0, 2.4);
  windowDecal(6.05, 15.4, 3, '+x', 1.1, 2.6);
  windowDecal(6.05, 15.4, 8, '+x', 1.1, 2.6);
  // chandelier
  const chandelier = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 20), M.iron.material);
  chandelier.rotation.x = Math.PI / 2;
  chandelier.position.set(16, 17.2, 4.9);
  scene.add(chandelier);
  box('iron', 15.97, 17.2, 4.9, 16.03, 18.7, 4.96);
  for (let flameIndex = 0; flameIndex < 6; flameIndex += 1) {
    const angle = (flameIndex / 6) * Math.PI * 2;
    addFlame(16 + Math.cos(angle) * 1.5, 17.3, 4.9 + Math.sin(angle) * 1.5, 0.3);
  }
  addLight(12, 16.5, 5, 24, 26, 16);
  addLight(20.5, 16.5, 5, 24, 26, 16);
  // hall stair rail along the opening

  // LORD'S CHAMBERS
  box('wood', 18.2, 19.5, -1.8, 24.6, 20.4, 3.4);
  box('red', 18.4, 20.4, -1.6, 24.4, 20.9, 3.2);
  box('cloth', 18.4, 20.9, -1.6, 20.2, 21.2, -0.2);
  for (const [postX, postZ] of [[18.2, -1.8], [24.4, -1.8], [18.2, 3.2], [24.4, 3.2]]) {
    box('woodDark', postX, 19.5, postZ, postX + 0.25, 24.0, postZ + 0.25);
  }
  box('red', 18.1, 24.0, -1.9, 24.7, 24.3, 3.5);
  box('woodDark', 8.5, 19.5, 0, 12.5, 20.4, 1.8);
  box('cloth', 9, 20.4, 0.3, 10.2, 20.45, 1.3);
  box('woodDark', 8.2, 19.5, 2.3, 9.2, 20.1, 3.3);
  box('woodDark', 13, 19.5, 4, 15.2, 20.3, 5);
  box('red', 10, 19.58, 3.0, 17, 19.64, 9);
  box('gold', 10.4, 19.64, 3.4, 16.6, 19.68, 8.6);
  box('red', 10.6, 19.7, 3.6, 16.4, 19.74, 8.4);
  const hangings = [[8.5, bannerTextureBlue], [14.6, bannerTextureRed]];
  hangings.forEach(([hangX, material]) => {
    const hanging = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), material);
    hanging.position.set(hangX, 22.8, -1.85);
    scene.add(hanging);
  });
  windowDecal(20.5, 23.4, -1.97, '+z', 0.9, 2.2);
  windowDecal(6.05, 22.6, 5, '+x', 1.0, 2.2);
  box('candle', 8.7, 20.4, 0.6, 8.9, 20.9, 0.8);
  addFlame(8.8, 20.9, 0.7, 0.3);
  box('candle', 14.1, 20.3, 4.4, 14.3, 20.8, 4.6);
  addFlame(14.2, 20.8, 4.5, 0.3);
  addLight(11, 23.5, 3, 18, 18, 14);
  addLight(21, 23, 3, 10, 14, 12);
  // lord's tapestry stripes
  box('gold', 6.1, 22.6, -0.8, 6.15, 22.8, 5.8);

  // the stair: kitchen to chapel (run A) and chapel to hall (run B) along the right wall
  function stairRun(floorY, fromZ, toZ, steps, x0, x1) {
    const rise = 6 / steps;
    for (let step = 0; step < steps; step += 1) {
      const z = fromZ + ((toZ - fromZ) * (step + 0.5)) / steps;
      box('wood', x0 + 0.1, floorY + step * rise + rise - 0.2, z - 0.45, x1 - 0.1, floorY + step * rise + rise, z + 0.45);
    }
    const length = Math.hypot(6, Math.abs(toZ - fromZ));
    const tilt = Math.atan2(6, Math.abs(toZ - fromZ)) * Math.sign(toZ - fromZ) * -1;
    for (const stringerX of [x0 + 0.05, x1 - 0.05]) {
      batch.box('woodDark', stringerX, floorY + 2.9, (fromZ + toZ) / 2, 0.16, 0.4, length, [tilt, 0, 0]);
    }
  }
  stairRun(LEVEL.kitchen, 11.2, -0.8, 14, 24, 26);
  stairRun(LEVEL.chapel, 11.2, -0.8, 14, 6.2, 8.2);

  // =========================================================
  // BAILEY BUILDINGS
  // =========================================================
  // stables along the north wall
  box('woodDark', -29, 0, -19.7, -28.7, 4.8, -19.4);
  for (let post = 0; post < 5; post += 1) {
    box('woodDark', -29 + post * 4, 0, -19.7, -28.7 + post * 4, 4.2, -19.4);
    if (post > 0 && post < 4) {
      box('wood', -29 + post * 4 - 0.1, 0, -24.4, -28.9 + post * 4, 1.7, -20.4);
    }
  }
  leanTo(-29.4, -12.6, -25.6, -19.2, 5.6, 4.2, 'brownRoof');
  for (const hayX of [-27.2, -23.2, -19.2]) {
    box('hay', hayX - 1.2, 0.9, -25.3, hayX + 1.2, 1.8, -24.2);
  }
  for (const hayBale of [[-14.4, -22], [-13.2, -22.5], [-14, -23.6]]) {
    box('hay', hayBale[0] - 0.7, 0, hayBale[1] - 0.5, hayBale[0] + 0.7, 0.9, hayBale[1] + 0.5);
  }
  box('hay', -27.5, 0, -22, -26, 0.15, -20.6);
  // smithy against the west wall
  for (const postZ of [-14, -6]) {
    box('woodDark', -27.8, 0, postZ - 0.2, -27.4, 4.4, postZ + 0.2);
  }
  leanTo(-33.6, -27.2, -14, -6, 4.6, 5.4, 'brownRoof');
  box('stoneDeep', -33.6, 0, -11.9, -31.2, 5, -8.9);
  box('stone', -33.2, 5, -11.3, -32.0, 9.8, -9.5);
  box('forge', -31.6, 1.2, -11.2, -31.3, 1.4, -9.6);
  addGlow(-31.5, 1.6, -10.4, 3.5, 0.9);
  addLight(-31, 2, -10.4, 30, 20, 11, 0xff7a30);
  addSmoke(-32.6, 10.0, -10.4, 1.0, 8);
  cylinder('woodDark', -29.8, 0.5, -10.4, 0.45, 0.5, 1.0, 8);
  box('iron', -30.2, 1.0, -10.8, -29.3, 1.3, -10.0);
  box('iron', -30.4, 1.2, -10.5, -30.0, 1.4, -10.3);
  cylinder('barrel', -29.4, 0.6, -7.2, 0.55, 0.55, 1.1, 10);
  box('woodDark', -33.5, 2.2, -7.6, -33.1, 3.0, -6.4);
  // carpenter along the north wall
  for (const postX of [-8.6, -0.5, 3.5]) {
    box('woodDark', postX - 0.2, 0, -20.3, postX + 0.2, 4.3, -19.9);
  }
  leanTo(-9.4, 4.4, -25.6, -19.6, 5.4, 4.2, 'brownRoof');
  box('wood', -7, 0, -24.4, -2, 1.1, -22.8);
  box('wood', -1.5, 0, -24.3, 2.8, 0.5, -23.2);
  for (let plank = 0; plank < 4; plank += 1) {
    box('wood', -9 + plank * 0.0, 0.2 + plank * 0.22, -23.6 + plank * 0.2, -7.4, 0.4 + plank * 0.22, -22.4 + plank * 0.2);
  }
  for (const log of [[-1.0, -21.6], [0.6, -21.4], [-0.2, -21.5]]) {
    cylinder('woodDark', log[0], 0.4, log[1], 0.38, 0.38, 3.0, 8, [0, 0, Math.PI / 2]);
  }
  // market stall
  for (const [postX, postZ] of [[-3.4, -13.6], [2.4, -13.6], [-3.4, -9.6], [2.4, -9.6]]) {
    box('woodDark', postX - 0.15, 0, postZ - 0.15, postX + 0.15, 3.0, postZ + 0.15);
  }
  leanTo(-3.8, 2.8, -13.9, -9.3, 3.4, 2.6, 'red');
  box('wood', -3, 0, -13.2, 2, 1.2, -12);
  for (const stuff of [[-2, 0], [-0.5, 1], [1, 0]]) {
    cylinder(stuff[1] ? 'green' : 'food', stuff[0], 1.45, -12.6, 0.35, 0.4, 0.5, 8);
  }
  // well
  cylinder('stone', -14, 0.6, -8, 1.5, 1.6, 1.2, 14);
  cylinder('pot', -14, 1.18, -8, 1.1, 1.1, 0.06, 14);
  for (const postX of [-15.4, -12.6]) {
    box('woodDark', postX - 0.15, 0, -8.15, postX + 0.15, 3.4, -7.85);
  }
  box('woodDark', -15.6, 3.2, -8.1, -12.4, 3.5, -7.9);
  leanTo(-15.8, -12.2, -8, -8, 4.3, 3.4, 'brownRoof');
  box('woodDark', -15.7, 3.3, -8.8, -12.3, 3.45, -7.2, [0, 0, 0]);
  for (const side of [-1, 1]) {
    batch.box('brownRoof', -14, 3.9, -8 + side * 0.9, 3.8, 0.2, 2.0, [side * -0.5, 0, 0]);
  }
  // crates, barrels and hay along the bailey
  for (const [crateX, crateZ] of [[-30, 3], [-31.4, 4.4], [-26, 7.5], [-6, 7.6], [-4.2, 8], [-8, 8], [-31.2, -20.6]]) {
    box('wood', crateX - 0.6, 0, crateZ - 0.6, crateX + 0.6, 1.2, crateZ + 0.6);
  }
  for (const [barrelX, barrelZ] of [[-30.8, 6.4], [-29.7, 7.1], [-3, 8.6], [-12, -24.4], [-11.4, -23.4]]) {
    cylinder('barrel', barrelX, 0.65, barrelZ, 0.6, 0.6, 1.3, 10);
  }
  box('hay', -10, 0, 6, -7, 1.4, 8.4);
  // woodpile and a low stall in the east yard behind the keep
  box('wood', 8, 0, -22, 14, 1.4, -19);
  box('hay', 16, 0, -24, 24, 2.4, -20);
  // wall torches and lamp posts
  const torches = [[-27.8, 3.6, 8.2, 'x'], [-16.2, 3.6, 8.2, 'x'], [-22, 3.6, 2.6, 'x'], [-6, 2.6, -24.4, 'z'], [2, 2.6, 8.4, 'x'], [-18, 2.6, -2, 'p'], [-14, 2.6, -14, 'p']];
  for (const [torchX, torchY, torchZ, kind] of torches) {
    box('woodDark', torchX - 0.08, kind === 'p' ? 0 : torchY - 0.8, torchZ - 0.08, torchX + 0.08, torchY, torchZ + 0.08);
    addFlame(torchX, torchY, torchZ, 0.6, { base: 16, lamp: 26, distance: 15 });
  }
  addFlame(-22, 8.4, FRONT + 0.7, 0.8, { base: 12, lamp: 20, distance: 14 });
  addFlame(-27.5, 8.4, FRONT + 0.7, 0.7);
  addFlame(-16.5, 8.4, FRONT + 0.7, 0.7);

  // flags on towers
  function addFlag(x, y, z, material, width = 3.0, height = 1.7) {
    box('woodDark', x - 0.1, y - 1, z - 0.1, x + 0.1, y + height + 1, z + 0.1);
    const geometry = new THREE.PlaneGeometry(width, height, 14, 4);
    geometry.translate(width / 2, 0, 0);
    const flag = new THREE.Mesh(geometry, material);
    flag.position.set(x + 0.1, y + height / 2 + 0.2, z);
    flag.castShadow = true;
    scene.add(flag);
    animated.flags.push({ mesh: flag, base: geometry.attributes.position.array.slice(), phase: random() * 6, width });
  }
  const flagRed = new THREE.MeshStandardMaterial({ map: emblemTexture('#b3282c', '#e8c45a'), roughness: 0.9, side: THREE.DoubleSide });
  const flagBlue = new THREE.MeshStandardMaterial({ map: emblemTexture('#2c4a96', '#e8c45a'), roughness: 0.9, side: THREE.DoubleSide });
  addFlag(-35, 24, -27, flagRed);
  addFlag(4, 36.4, -4.5, flagRed, 3.4, 2.0);
  addFlag(16, LEVEL.roof + 10.2, 4, flagBlue, 3.6, 2.1);
  addFlag(-31, 23.2, 11, flagRed, 2.4, 1.4);
  addFlag(-13, 23.2, 11, flagRed, 2.4, 1.4);
  addFlag(27, 15.6, -27, flagBlue, 2.6, 1.5);
  addFlag(28, 30.6, -4.5, flagBlue, 2.6, 1.5);
  addFlag(-35, 11.6, 10.6, flagRed, 2.4, 1.4);

  // arrow slits and windows on the faces seen from the bailey
  for (const [windowY, windowZ] of [[3.2, -0.5], [9.2, 1], [15.4, 5.5], [22.6, 8]]) {
    windowDecal(3.95, windowY, windowZ, '-x', 0.9, 1.7);
  }

  batch.build(scene);

  // collect window glow materials: emissive rises at dusk
  animated.windowMaterials = [M.windowGlow.material, M.glassBlue.material, M.glassRed.material, M.glassGold.material, M.candle.material];

  // =========================================================
  // PER-FRAME UPDATE
  // =========================================================
  const flicker = (t, phase) => 1 + 0.18 * Math.sin(t * 11.3 + phase) + 0.12 * Math.sin(t * 23.7 + phase * 2.1) + 0.07 * Math.sin(t * 41 + phase * 3.3);
  const dusk = (t) => smoothstep(2, 19, t);
  const lamp = (t) => smoothstep(9, 17, t);

  function bridgeAngle(t) {
    if (t < SCRIPT.bridgeStart) {
      return -Math.PI / 2 + 0.012 * Math.sin(t * 3.1);
    }
    const progress = Math.min(1, (t - SCRIPT.bridgeStart) / (SCRIPT.bridgeLand - SCRIPT.bridgeStart));
    const fall = easeInOut(progress) ** 1.35;
    let angle = -(Math.PI / 2) * (1 - fall);
    if (t > SCRIPT.bridgeLand) {
      const since = t - SCRIPT.bridgeLand;
      angle -= 0.05 * Math.exp(-since * 9) * Math.abs(Math.sin(since * 14));
    }
    return Math.min(0, angle);
  }

  const tipVector = new THREE.Vector3();
  function update(t) {
    const lampLevel = lamp(t);
    // water drifts
    M.water.material.map.offset.set(t * 0.012, t * 0.004);
    // drawbridge, chains, portcullis
    const angle = bridgeAngle(t);
    bridge.rotation.x = angle;
    tipVector.set(0, 0.2, 8.8).applyEuler(new THREE.Euler(angle, 0, 0)).add(bridge.position);
    anchors.bridgeTip.copy(tipVector);
    for (const { chain, side } of chains) {
      const anchor = new THREE.Vector3(GATE_X + side, chainAnchorY, FRONT + 0.5);
      const end = new THREE.Vector3(GATE_X + side, 0, 0).add(new THREE.Vector3(0, 0.45, 7.8).applyEuler(new THREE.Euler(angle, 0, 0))).add(new THREE.Vector3(0, bridge.position.y, bridge.position.z));
      chain.position.copy(anchor).add(end).multiplyScalar(0.5);
      chain.scale.z = anchor.distanceTo(end);
      chain.lookAt(end);
    }
    const lift = easeInOut(Math.min(1, Math.max(0, (t - SCRIPT.portcullisStart) / (SCRIPT.portcullisEnd - SCRIPT.portcullisStart))));
    portcullis.position.y = lift * 7.4 + (t > SCRIPT.portcullisEnd ? 0 : 0.03 * Math.sin(t * 40) * (lift > 0 && lift < 1 ? 1 : 0));
    // bell swings while it tolls
    let swing = 0;
    for (const toll of SCRIPT.bellTolls) {
      const since = t - toll;
      if (since > 0 && since < 3.2) {
        swing += 0.5 * Math.exp(-since * 0.9) * Math.sin(since * 5.2);
      }
    }
    bellPivot.rotation.z = swing + 0.012 * Math.sin(t * 1.7);
    // flames, glows, lights
    for (const { group, phase } of animated.flames) {
      const value = flicker(t, phase);
      group.scale.set(1 + (value - 1) * 0.4, value, 1 + (value - 1) * 0.4);
      group.rotation.z = 0.08 * Math.sin(t * 7.1 + phase);
    }
    for (const entry of animated.glows) {
      const value = flicker(t, entry.phase);
      entry.sprite.material.opacity = Math.min(1, entry.strength * (0.55 + 0.7 * lampLevel) * (0.85 + 0.15 * value));
      entry.sprite.scale.setScalar(entry.size * (0.92 + 0.08 * value));
    }
    for (const entry of animated.lights) {
      entry.light.intensity = (entry.base + entry.lamp * lampLevel) * (0.9 + 0.1 * flicker(t, entry.phase));
    }
    for (const material of animated.windowMaterials) {
      material.emissiveIntensity = material === M.candle.material ? 0.5 + lampLevel : 0.18 + lampLevel * 2.1;
    }
    // smoke
    for (const puff of animated.smokes) {
      const age = (t * 0.2 + puff.offset) % 1;
      const rise = age * 11 * puff.scale;
      puff.sprite.position.set(puff.x + age * 5 * puff.drift + Math.sin(age * 6 + puff.offset * 9) * 0.5, puff.y + rise, puff.z + age * 1.2);
      puff.sprite.scale.setScalar((1.6 + age * 5.5) * puff.scale);
      puff.sprite.material.opacity = Math.sin(Math.PI * Math.min(1, age * 1.15)) * 0.45 * (1 - age * 0.5);
    }
    // flags
    for (const flag of animated.flags) {
      const positions = flag.mesh.geometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        const baseX = flag.base[index * 3];
        const along = baseX / flag.width;
        positions.setZ(index, Math.sin(baseX * 2.2 - t * 6 + flag.phase) * 0.35 * along);
        positions.setY(index, flag.base[index * 3 + 1] + Math.sin(baseX * 1.6 - t * 4.5 + flag.phase) * 0.08 * along);
      }
      positions.needsUpdate = true;
    }
  }

  return { update, anchors, dusk, lamp, bridgeAngle, flicker, animated, page };
}
