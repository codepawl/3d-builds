// The book: a cover, two leaves and a back board hinged on one gutter line. One number, t, says how far it is open:
// t = 0 closed, t = 1 first spread open, t = 2 second spread, t = 3 the sources page. Leaf i runs from flat on the
// lower stack (0) to open at REST (u = 1) to flat on the back pile (180 degrees, u = 2).
import * as THREE from 'three';
import { PAGE_WIDTH, PAGE_DEPTH, CARD_THICKNESS, COVER_THICKNESS, REST_DEGREES } from './config.js';
import { canvasToTexture } from './paint.js';

const REST = (REST_DEGREES * Math.PI) / 180;
const LEAF_THICKNESS = [COVER_THICKNESS, CARD_THICKNESS, CARD_THICKNESS];
const LEAF_OFFSET = [0, COVER_THICKNESS, COVER_THICKNESS + CARD_THICKNESS];
const BOARD_TOP = COVER_THICKNESS + CARD_THICKNESS * 2;

export function leafAngle(u) {
  if (u <= 0) return 0;
  if (u <= 1) return REST * u;
  if (u <= 2) return REST + (Math.PI - REST) * (u - 1);
  return Math.PI;
}

export function leafProgress(angle) {
  if (angle <= REST) return angle / REST;
  return 1 + (angle - REST) / (Math.PI - REST);
}

function pageMaterial(texture) {
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 });
}

export class Book {
  constructor({ renderer, scene, spreads, coverCanvas, colophonCanvas, endpaperCanvas }) {
    this.spreads = spreads;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.leaves = [];
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1f2a2c, roughness: 0.95 });
    const paperEdge = new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 1 });
    const inner = [spreads[0].backdrop, spreads[1].backdrop, colophonCanvas];
    const outer = [coverCanvas, spreads[0].floor, spreads[1].floor];
    for (let index = 0; index < 3; index += 1) {
      const isCover = index === 0;
      const width = PAGE_WIDTH + (isCover ? 1.4 : 0);
      const depth = PAGE_DEPTH + (isCover ? 0.7 : 0);
      const thickness = LEAF_THICKNESS[index];
      const offset = LEAF_OFFSET[index];
      const hinge = new THREE.Group();
      hinge.name = `leaf-${index}`;
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), isCover ? cloth : paperEdge);
      body.position.set(0, -offset - thickness / 2, depth / 2);
      body.castShadow = true;
      body.receiveShadow = true;
      body.userData.leaf = index;
      hinge.add(body);
      const frontPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), pageMaterial(canvasToTexture(THREE, outer[index], renderer)));
      frontPlane.rotation.x = -Math.PI / 2;
      frontPlane.position.set(0, -offset + 0.004, depth / 2);
      frontPlane.receiveShadow = true;
      frontPlane.userData.leaf = index;
      const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), pageMaterial(canvasToTexture(THREE, inner[index], renderer)));
      backPlane.rotation.x = Math.PI / 2;
      backPlane.position.set(0, -offset - thickness - 0.004, depth / 2);
      backPlane.receiveShadow = true;
      backPlane.userData.leaf = index;
      hinge.add(frontPlane, backPlane);
      this.group.add(hinge);
      this.leaves.push({ hinge, thickness, offset, width, depth });
    }
    // popups ride on the near leaf of their spread
    this.popupRoots = [];
    spreads.forEach((spread, index) => {
      const root = new THREE.Group();
      root.position.y = -LEAF_OFFSET[index + 1];
      root.add(spread.root);
      this.leaves[index + 1].hinge.add(root);
      this.popupRoots.push(root);
    });
    // lower board, with the final page printed on it, and the pile the turned leaves lie on
    const board = new THREE.Mesh(new THREE.BoxGeometry(PAGE_WIDTH + 1.4, COVER_THICKNESS, PAGE_DEPTH + 0.7), cloth);
    board.position.set(0, -BOARD_TOP - COVER_THICKNESS / 2, (PAGE_DEPTH + 0.7) / 2);
    board.castShadow = true;
    board.receiveShadow = true;
    const boardTop = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_DEPTH), pageMaterial(canvasToTexture(THREE, endpaperCanvas, renderer)));
    boardTop.rotation.x = -Math.PI / 2;
    boardTop.position.set(0, -BOARD_TOP + 0.004, PAGE_DEPTH / 2);
    boardTop.receiveShadow = true;
    const pile = new THREE.Mesh(new THREE.BoxGeometry(PAGE_WIDTH + 1.4, BOARD_TOP + COVER_THICKNESS, PAGE_DEPTH + 0.7), cloth);
    pile.position.set(0, -(BOARD_TOP + COVER_THICKNESS) / 2 - 0.02, -(PAGE_DEPTH + 0.7) / 2);
    pile.castShadow = true;
    pile.receiveShadow = true;
    this.group.add(board, boardTop, pile);
    this.deskY = -BOARD_TOP - COVER_THICKNESS;
    this.angles = [0, 0, 0];
    this.t = 0;
    this.setT(0);
  }

  setT(t) {
    this.t = Math.min(3, Math.max(0, t));
    for (let index = 0; index < 3; index += 1) {
      const angle = leafAngle(this.t - index);
      this.angles[index] = angle;
      this.leaves[index].hinge.rotation.x = -angle;
    }
    this.spreads.forEach((spread, index) => {
      const farIndex = index;
      const nearIndex = index + 1;
      const farAngle = this.angles[farIndex];
      const nearAngle = nearIndex <= 2 ? this.angles[nearIndex] : 0;
      const psi = Math.max(0, farAngle - nearAngle);
      const far = this.leaves[farIndex];
      const near = this.leaves[nearIndex];
      const board = far.thickness + far.offset;
      // far leaf's inner face, in the popup root's frame (origin on the near leaf's front face)
      const offset = {
        y: near.offset + board * -Math.cos(psi),
        z: board * Math.sin(psi),
      };
      spread.update(psi, offset);
      spread.psi = psi;
    });
  }

  // the leaf the reader turns next: the far leaf of the spread that is showing
  grabLeaf() {
    if (this.t < 0.5) return 0;
    return Math.min(2, Math.max(0, Math.round(this.t) - 1));
  }
}
