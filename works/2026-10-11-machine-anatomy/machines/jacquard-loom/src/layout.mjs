// Every size of the loom, in world units (about 1 px each): x runs along the warp from the warp beam (back)
// to the cloth beam (front), y across the loom, z up. The build and the page both read this one table.

const hook = { x: -20, foot: 129.6, top: 184, loop: 164, beak: 5, beakDrop: 2.4, doubled: 2.2, doubledTop: 147.6, overhang: 2.8 };
const card = { faceX: -52, travel: 3, half: 8.1, pitch: 16.2, length: 76, gap: 1.6, hole: 2.1, thick: 0.3 };
const griffe = { rise: 14, free: 2 };

export const LAYOUT = {
  lanes: 8,
  hookPitch: 8.5,
  warpPitch: 10,
  warpZ: 70,
  hook,
  card,
  griffe,
  beam: { x: -98, z: 60, r: 9.6 },
  mail: { halfWidth: 0.9, halfHeight: 1.6 },
  lingoe: { top: 38, length: 16, r: 1.2 },
  comber: { x0: -27, x1: -13, z0: 98, z1: 101, halfWidth: 51 },
  knotZ: 112,
  neckX: -18.9,
  bottomBoard: { x0: -30, x1: -10, z0: 126, z1: 129, halfWidth: 51 },
  grate: { x0: -25.5, x1: -14.5, z0: 143, z1: 144.4, halfWidth: 51 },
  needle: { z: 164, headX: -55, boardBack: -46, boardFront: -44, plateFront: 6, plateFrontEnd: 7.6, collarX: 9.4, plateBack: 15, plateBackEnd: 16.6, tailX: 18.2, loopR: 1.5, boardTop: 165.6, boardBottom: 155.5, halfWidth: 37 },
  knife: { x0: -24.2, x1: -22.2, z0: 177.5, z1: 182, halfWidth: 36 },
  swing: { out: 8, pivotZ: 138, armY: 42, arm: 26 },
  roller: { r: 1.4 },
  reed: { rest: 18, beat: 45, raceDepth: 9, raceTop: 69.4, raceBottom: 63.4, capZ: 89, capTop: 93, halfWidth: 52 },
  fell: 50,
  row: 5,
  cloth: { halfWidth: 40, cornerX: 96.6, dropTo: 39, z: 70.2 },
  shuttle: { reach: 40, z: 70.6, height: 3, offsetX: 4.5, halfLength: 8 },
  lever: { pivotX: -62, rodX: -23.2, rearX: -116, z: 237.5, y0: 2.6, y1: 5.6, thick: 3 },
  treadle: { pivotX: 104, pivotZ: 7, rearX: -116, rearZ: 30, y0: 1.6, y1: 6.6, thick: 3 },
  rails: { low: [57, 62], upper: [148, 153], top: [221, 226], y: 56, half: 2.5 },
  posts: { rear: -108, mid: -60.4, front: 104, frontTop: 70, upperEnd: 20, ridgeEnd: -52 },
};

export function hookY(lane) {
  return (lane - (LAYOUT.lanes - 1) / 2) * LAYOUT.hookPitch;
}

export function warpY(lane) {
  return (lane - (LAYOUT.lanes - 1) / 2) * LAYOUT.warpPitch;
}

// The numbers the pure model needs to work a card through needle, hook and griffe.
export const MECHANISM = {
  pressedFaceX: card.faceX,
  headX: LAYOUT.needle.headX,
  hook: { foot: hook.foot, top: hook.top, loop: hook.loop, overhang: hook.overhang },
  griffeRise: griffe.rise,
  freeTravel: griffe.free,
};

export const PRESSED_CENTRE = [card.faceX - card.thick - card.half, LAYOUT.needle.z];
