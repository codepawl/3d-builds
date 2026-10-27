import * as THREE from 'three';
import { SITE_OFFSET_RAMP } from '../sim/layout.js';

function makeTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function seededNoise(context, width, height, count, alphaMax, lightness) {
  let state = 12345;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < count; index += 1) {
    const shade = lightness + Math.floor(next() * 40) - 20;
    context.fillStyle = `rgba(${shade},${shade},${shade},${next() * alphaMax})`;
    context.fillRect(next() * width, next() * height, 1 + next() * 2.5, 1 + next() * 2.5);
  }
}

// A floor texture maps world metres to pixels: the canvas covers [minX, maxX] x [minZ, maxZ].
function worldCanvas(minX, maxX, minZ, maxZ, pixelsPerMetre, draw) {
  const width = Math.round((maxX - minX) * pixelsPerMetre);
  const height = Math.round((maxZ - minZ) * pixelsPerMetre);
  return makeTexture(width, height, (context) => {
    const toX = (x) => (x - minX) * pixelsPerMetre;
    const toZ = (z) => (z - minZ) * pixelsPerMetre;
    draw(context, toX, toZ, pixelsPerMetre, width, height);
  });
}

function slab(minX, maxX, minZ, maxZ, topY, bottomY, texture, sideColor) {
  const group = new THREE.Group();
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set((minX + maxX) / 2, topY, (minZ + maxZ) / 2);
  top.receiveShadow = true;
  group.add(top);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, topY - bottomY - 0.02, depth),
    new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.9 }),
  );
  body.position.set((minX + maxX) / 2, (topY + bottomY - 0.02) / 2, (minZ + maxZ) / 2);
  body.receiveShadow = true;
  body.castShadow = true;
  group.add(body);
  return group;
}

function wall(fromX, fromZ, toX, toZ, height, baseY, color) {
  const length = Math.hypot(toX - fromX, toZ - fromZ);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, 0.4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
  );
  mesh.position.set((fromX + toX) / 2, baseY + height / 2, (fromZ + toZ) / 2);
  mesh.rotation.y = -Math.atan2(toZ - fromZ, toX - fromX);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.25, 0.55),
    new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.5 }),
  );
  trim.position.set(mesh.position.x, baseY + height + 0.125, mesh.position.z);
  trim.rotation.y = mesh.rotation.y;
  trim.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh, trim);
  return group;
}

export function createGround(world) {
  const group = new THREE.Group();
  group.name = 'ground';

  // Backdrop plinth under everything, so the diorama sits on a soft pale slab.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(400, 1, 260),
    new THREE.MeshStandardMaterial({ color: '#c9d5e1', roughness: 1 }),
  );
  plinth.position.set(40, -2.6, 20);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Main level: polished concrete with painted walkways around the machines.
  const hall = { minX: -31, maxX: 44, minZ: -9, maxZ: 33 };
  const hallTexture = worldCanvas(hall.minX, hall.maxX, hall.minZ, hall.maxZ, 26, (context, toX, toZ, scale, width, height) => {
    context.fillStyle = '#b7c3cf';
    context.fillRect(0, 0, width, height);
    seededNoise(context, width, height, 90000, 0.14, 120);
    context.strokeStyle = 'rgba(120,132,146,0.35)';
    context.lineWidth = 2;
    for (let x = hall.minX; x <= hall.maxX; x += 6) {
      context.beginPath();
      context.moveTo(toX(x), 0);
      context.lineTo(toX(x), height);
      context.stroke();
    }
    for (let z = hall.minZ; z <= hall.maxZ; z += 6) {
      context.beginPath();
      context.moveTo(0, toZ(z));
      context.lineTo(width, toZ(z));
      context.stroke();
    }
    // Slightly darker maintenance floor under the sorter.
    context.fillStyle = 'rgba(96,112,130,0.16)';
    context.fillRect(toX(-1.5), toZ(0.6), 28 * scale, 14.6 * scale);
    // Yellow safety lines.
    context.strokeStyle = '#f2c230';
    context.lineWidth = 0.14 * scale;
    context.strokeRect(toX(-1.5), toZ(0.6), 28 * scale, 14.6 * scale);
    context.beginPath();
    context.moveTo(toX(-25), toZ(20.9));
    context.lineTo(toX(5), toZ(20.9));
    context.moveTo(toX(-25), toZ(24.1));
    context.lineTo(toX(5), toZ(24.1));
    context.moveTo(toX(5.9), toZ(23.1));
    context.lineTo(toX(5.9), toZ(10.8));
    context.stroke();
    // Hazard hatch in front of the scanner.
    context.save();
    context.beginPath();
    context.rect(toX(5.9), toZ(19), 4.2 * scale, 2.8 * scale);
    context.clip();
    context.strokeStyle = 'rgba(242,194,48,0.9)';
    context.lineWidth = 0.18 * scale;
    for (let offset = -4; offset < 8; offset += 0.7) {
      context.beginPath();
      context.moveTo(toX(5.9 + offset), toZ(21.8));
      context.lineTo(toX(5.9 + offset + 2.8), toZ(19));
      context.stroke();
    }
    context.restore();
    // Green walkway to the search room.
    context.fillStyle = 'rgba(52,168,120,0.22)';
    context.fillRect(toX(9.4), toZ(13), 3.2 * scale, 4 * scale);
  });
  group.add(slab(hall.minX, hall.maxX, hall.minZ, hall.maxZ, 0, -2, hallTexture, '#aab6c2'));

  // Raised check-in hall (1.5 m): light tiles.
  const checkIn = { minX: -45, maxX: -31, minZ: -2, maxZ: 26 };
  const tileTexture = worldCanvas(checkIn.minX, checkIn.maxX, checkIn.minZ, checkIn.maxZ, 40, (context, toX, toZ, scale, width, height) => {
    context.fillStyle = '#d6dde5';
    context.fillRect(0, 0, width, height);
    const tile = 0.6 * scale;
    for (let row = 0; row * tile < height; row += 1) {
      for (let column = 0; column * tile < width; column += 1) {
        if ((row + column) % 2 === 0) {
          context.fillStyle = 'rgba(190,200,212,0.35)';
          context.fillRect(column * tile, row * tile, tile, tile);
        }
      }
    }
    seededNoise(context, width, height, 30000, 0.08, 170);
    // Queue lane carpet in front of the desks.
    context.fillStyle = 'rgba(59,130,246,0.18)';
    context.fillRect(toX(-44), toZ(-0.6), 4.6 * scale, 25 * scale);
  });
  group.add(slab(checkIn.minX, checkIn.maxX, checkIn.minZ, checkIn.maxZ, 1.5, -2, tileTexture, '#b9c4cf'));

  // Terminal walls: cut away on the south and east so the camera sees inside.
  group.add(wall(hall.minX - 0.2, hall.minZ, hall.maxX + 0.2, hall.minZ, 5, 0, '#e6ebf0'));
  group.add(wall(hall.minX - 0.2, hall.minZ, hall.minX - 0.2, checkIn.minZ, 5, 0, '#e6ebf0'));
  group.add(wall(checkIn.minX - 0.2, checkIn.minZ, checkIn.minX - 0.2, checkIn.maxZ, 3.6, 1.5, '#e6ebf0'));
  group.add(wall(checkIn.minX - 0.2, checkIn.minZ, checkIn.maxX, checkIn.minZ, 3.6, 1.5, '#e6ebf0'));
  group.add(wall(hall.minX - 0.2, checkIn.maxZ, hall.minX - 0.2, hall.maxZ, 5, 0, '#e6ebf0'));

  // Apron and make-up edge.
  const offsetX = SITE_OFFSET_RAMP;
  const apron = { minX: offsetX - 38, maxX: offsetX + 38, minZ: 2, maxZ: 62 };
  const apronTexture = worldCanvas(apron.minX, apron.maxX, apron.minZ, apron.maxZ, 18, (context, toX, toZ, scale, width, height) => {
    context.fillStyle = '#566069';
    context.fillRect(0, 0, width, height);
    seededNoise(context, width, height, 160000, 0.22, 110);
    // Service road around the tug loop.
    const loopCentre = { x: offsetX - 17, z: 28 };
    context.strokeStyle = 'rgba(40,46,54,0.55)';
    context.lineWidth = 6 * scale;
    context.lineJoin = 'round';
    context.beginPath();
    context.roundRect(toX(loopCentre.x - 5), toZ(loopCentre.z - 21), 10 * scale, 42 * scale, 4.5 * scale);
    context.stroke();
    context.strokeStyle = 'rgba(255,255,255,0.8)';
    context.lineWidth = 0.14 * scale;
    context.setLineDash([1.2 * scale, 1.2 * scale]);
    context.beginPath();
    context.roundRect(toX(loopCentre.x - 5), toZ(loopCentre.z - 21), 10 * scale, 42 * scale, 4.5 * scale);
    context.stroke();
    context.setLineDash([]);
    // Aircraft stand: centre line, stop bar and nose-wheel circle.
    context.strokeStyle = '#f2c230';
    context.lineWidth = 0.2 * scale;
    context.beginPath();
    context.moveTo(toX(offsetX + 6), toZ(6));
    context.lineTo(toX(offsetX + 6), toZ(60));
    context.stroke();
    context.beginPath();
    context.moveTo(toX(offsetX + 2), toZ(54.5));
    context.lineTo(toX(offsetX + 10), toZ(54.5));
    context.stroke();
    context.beginPath();
    context.arc(toX(offsetX + 6), toZ(50), 1.4 * scale, 0, Math.PI * 2);
    context.stroke();
    // Safety zone around the aircraft.
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 0.12 * scale;
    context.strokeRect(toX(offsetX - 13), toZ(11), 38 * scale, 42 * scale);
    // Concrete stand slab.
    context.fillStyle = 'rgba(170,176,182,0.16)';
    context.fillRect(toX(offsetX - 13), toZ(11), 38 * scale, 42 * scale);
  });
  group.add(slab(apron.minX, apron.maxX, apron.minZ, apron.maxZ, 0, -2, apronTexture, '#5d6770'));

  const terminal = { minX: offsetX - 38, maxX: offsetX + 38, minZ: -18, maxZ: 2 };
  const terminalTexture = worldCanvas(terminal.minX, terminal.maxX, terminal.minZ, terminal.maxZ, 22, (context, toX, toZ, scale, width, height) => {
    context.fillStyle = '#bfcad5';
    context.fillRect(0, 0, width, height);
    seededNoise(context, width, height, 50000, 0.12, 130);
    context.strokeStyle = 'rgba(120,132,146,0.3)';
    context.lineWidth = 2;
    for (let x = terminal.minX; x <= terminal.maxX; x += 5) {
      context.beginPath();
      context.moveTo(toX(x), 0);
      context.lineTo(toX(x), height);
      context.stroke();
    }
    context.strokeStyle = '#f2c230';
    context.lineWidth = 0.14 * scale;
    context.strokeRect(toX(offsetX - 20.5), toZ(-9.6), 22 * scale, 8 * scale);
    context.strokeRect(toX(offsetX - 0.5), toZ(-9.6), 22 * scale, 8 * scale);
  });
  group.add(slab(terminal.minX, terminal.maxX, terminal.minZ, terminal.maxZ, 0.25, -2, terminalTexture, '#aab6c2'));
  group.add(wall(terminal.minX, terminal.minZ, terminal.maxX, terminal.minZ, 5, 0.25, '#e6ebf0'));
  group.add(wall(terminal.minX, terminal.minZ, terminal.minX, terminal.maxZ, 5, 0.25, '#e6ebf0'));
  return group;
}
