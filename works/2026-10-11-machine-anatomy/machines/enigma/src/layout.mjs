// Every size of the machine, in world units (about 1.5 mm each), and where each letter's key, lamp,
// socket and contact sits. x runs along the rotor spindle from the reflector (the operator's left) to the
// entry wheel (right), y from the back of the case to the operator, z up. The build and the page both
// read this one table.

const STEP_ANGLE = (2 * Math.PI) / 26;
const ROTOR_WIDTH = 15;

const SIZES = {
  pitch: 18,
  case: { x0: -92, x1: 92, y0: -110, y1: 110, z1: 46, rim: 50, lip: 1.5 },
  keyboard: { x0: -84, x1: 84, y0: 44, y1: 104, z0: 50, z1: 54, rows: [56, 74, 92], capRadius: 5.6, stemRadius: 1.9, stemTop: 57.6, capTop: 60.4, travel: 2.8 },
  lamps: { x0: -84, x1: 84, y0: -24, y1: 32, z0: 50, z1: 58, rows: [-12, 4, 20], radius: 5.2 },
  plugboard: { x0: -84, x1: 84, y0: 111, y1: 117, z0: 6, z1: 44, rows: [35, 24, 13], hole: 0.9, spread: 1.7, plugLength: 6, bow: 12 },
  cradle: { x0: -74, x1: 36, y0: -104, y1: -28, z0: 50, z1: 54 },
  strip: { x0: -48, x1: 9, y0: -37.5, y1: -29.5, z1: 55.6, window: 5.4 },
  battery: { x0: 50, x1: 88, y0: -106, y1: -86, z0: 50, z1: 72 },
  switch: { x: 70, y: -44, r: 3.4 },
  pawls: { bar: { x0: -36, x1: 9, y0: -100, y1: -91, z0: 54, z1: 58 }, y0: -97, y1: -92.5, top: 80, lift: 3 },
  stack: {
    y: -66,
    z: 82,
    contactRadius: 13,
    windowAngle: (62 * Math.PI) / 180,
    rotorWidth: ROTOR_WIDTH,
    rotorLeft: [-44, -27, -10],
    // Along the spindle, from the rotor's left face: [from, to, radius].
    notchRing: [0, 2.5, 23.5],
    tyre: [2.5, 9.5, 22],
    fingerWheel: [9.5, 12, 24.6],
    ratchet: [12, ROTOR_WIDTH, 19.5],
    reflector: { x0: -58, x1: -46, r: 18 },
    entry: { x0: 7, x1: 17, r: 18 },
    spindle: { x0: -66, x1: 26, r: 2.2 },
    foot: { halfDepth: 10, z0: 54, z1: 66 },
    // The plate that carries the 26 pins on a rotor's right face: [inner radius, outer radius].
    pinPlate: [9.6, 16.4],
    // How far a wire inside a rotor pulls in towards the hub when it runs half-way round.
    wireWaist: 3.5,
  },
  // Where the wires run inside the case: under the deck from the keys, lower down to the lamps,
  // just behind the front wall, and along the floor to the entry wheel.
  wiring: { keyLevel: 41, lampLevel: 36, front: 107, floor: 6, side: 1.2, riser: 5 },
};

const WIRE_STEPS = 16;

export function createLayout(keyRows) {
  const spots = {};
  keyRows.forEach((row, rowIndex) => {
    Array.from(row).forEach((letter, column) => {
      spots[letter] = { row: rowIndex, x: (column - (row.length - 1) / 2) * SIZES.pitch };
    });
  });

  function keyPoint(letter) {
    return [spots[letter].x, SIZES.keyboard.rows[spots[letter].row], SIZES.keyboard.capTop];
  }

  function lampPoint(letter) {
    return [spots[letter].x, SIZES.lamps.rows[spots[letter].row], SIZES.lamps.z1];
  }

  function socketPoint(letter) {
    return [spots[letter].x, SIZES.plugboard.y1, SIZES.plugboard.rows[spots[letter].row]];
  }

  // A point on a rotor at `angle` round the spindle, measured from the operator's side upwards.
  function aroundSpindle(x, radius, angle) {
    return [x, SIZES.stack.y + radius * Math.cos(angle), SIZES.stack.z + radius * Math.sin(angle)];
  }

  // Where contact `contact` (0 = the entry wheel's A) sits on a rotor face at `x`.
  function contactPoint(x, contact) {
    return aroundSpindle(x, SIZES.stack.contactRadius, SIZES.stack.windowAngle + contact * STEP_ANGLE);
  }

  // The angle of the letter that is `ahead` places past the one in the window.
  function letterAngle(ahead) {
    return SIZES.stack.windowAngle + ahead * STEP_ANGLE;
  }

  // The four turned parts of rotor `rotor` (0 left, 1 middle, 2 right) as { x0, x1, r }.
  function rotorParts(rotor) {
    const left = SIZES.stack.rotorLeft[rotor];
    const part = ([from, to, r]) => ({ x0: left + from, x1: left + to, r });
    return { notchRing: part(SIZES.stack.notchRing), tyre: part(SIZES.stack.tyre), fingerWheel: part(SIZES.stack.fingerWheel), ratchet: part(SIZES.stack.ratchet) };
  }

  function rotorFaces(rotor) {
    const left = SIZES.stack.rotorLeft[rotor];
    return { left, right: left + ROTOR_WIDTH };
  }

  // Each pawl stands in the plane of the ratchet it drives and of the notched ring it rides on.
  function pawlSpan(rotor) {
    const ratchet = rotorParts(rotor).ratchet;
    if (rotor === 2) return [ratchet.x0, ratchet.x1];
    return [ratchet.x0, rotorParts(rotor + 1).notchRing.x1];
  }

  // A plugboard socket has two holes: the upper one is wired to the key, the lower one to the entry wheel.
  function socketHole(letter, upper) {
    const [x, y, z] = socketPoint(letter);
    return [x, y, z + (upper ? SIZES.plugboard.spread : -SIZES.plugboard.spread)];
  }

  // How many contacts to turn from one contact to another, going the short way round.
  function shortTurn(from, to) {
    const turn = (((to - from) % 26) + 26) % 26;
    return turn > 13 ? turn - 26 : turn;
  }

  function easeShare(share) {
    const clamped = Math.min(1, Math.max(0, share));
    return clamped * clamped * (3 - 2 * clamped);
  }

  // One wire inside a rotor, from the contact `from` on the face at `xFrom` to the contact `to` on
  // the face at `xTo`. It runs round the hub, never through it.
  function rotorWire(xFrom, xTo, from, to) {
    const turn = shortTurn(from, to);
    const waist = (SIZES.stack.wireWaist * Math.abs(turn)) / 13;
    const points = [];
    for (let step = 0; step <= WIRE_STEPS; step++) {
      const share = step / WIRE_STEPS;
      const contact = from + turn * easeShare((share - 0.12) / 0.76);
      const radius = SIZES.stack.contactRadius - waist * Math.sin(Math.PI * share);
      points.push(aroundSpindle(xFrom + (xTo - xFrom) * share, radius, SIZES.stack.windowAngle + contact * STEP_ANGLE));
    }
    return points;
  }

  // One of the reflector's 13 wires, in the plane `x`: a loop from one contact to its partner that
  // dips towards the hub, deeper the further apart the two are.
  function reflectorWire(x, from, to) {
    const turn = shortTurn(from, to);
    const dip = 2 + (5.5 * Math.abs(turn)) / 13;
    const points = [];
    for (let step = 0; step <= WIRE_STEPS; step++) {
      const share = step / WIRE_STEPS;
      const radius = SIZES.stack.contactRadius - dip * Math.sin(Math.PI * share);
      points.push(aroundSpindle(x, radius, SIZES.stack.windowAngle + (from + turn * share) * STEP_ANGLE));
    }
    return points;
  }

  // From the pressed key down its stem to the switch under the deck, forward to the front wall and out
  // to the upper hole of the key's socket. With no plug in the socket, its own switch joins the two holes.
  function keyRoute(letter, side, plugged) {
    const K = SIZES.keyboard;
    const W = SIZES.wiring;
    const key = keyPoint(letter);
    const hole = socketHole(letter, true);
    const x = key[0] + side;
    const points = [[key[0], key[1], K.capTop - K.travel], [key[0], key[1], K.z1], [x, key[1], W.keyLevel], [x, W.front, W.keyLevel], [x, W.front, hole[2]], hole];
    if (!plugged) points.push(socketHole(letter, false));
    return points;
  }

  // From the lower hole of a socket down to the floor of the case, along it to the entry wheel, up
  // through the cradle to the wheel's terminal for that letter and straight through the wheel.
  function harnessRoute(letter, contact, side) {
    const W = SIZES.wiring;
    const E = SIZES.stack.entry;
    const hole = socketHole(letter, false);
    const level = W.floor + side * 1.5;
    const front = W.front - 2 + side;
    const riser = E.x1 + W.riser + side * 1.5;
    return [hole, [hole[0], front, hole[2]], [hole[0], front, level], [riser, front, level], [riser, SIZES.stack.y, level], [riser, SIZES.stack.y, SIZES.cradle.z1], contactPoint(E.x1, contact), contactPoint(E.x0, contact)];
  }

  // From the upper hole of the lamp letter's socket back under the deck, through that letter's key
  // switch (at rest) and on to its lamp, which it reaches from below.
  function lampRoute(letter, side, plugged) {
    const W = SIZES.wiring;
    const lamp = lampPoint(letter);
    const key = keyPoint(letter);
    const hole = socketHole(letter, true);
    const x = hole[0] + side;
    const points = [hole, [x, W.front, hole[2]], [x, W.front, W.lampLevel], [x, key[1], W.lampLevel], [x, lamp[1], W.lampLevel], [lamp[0], lamp[1], SIZES.lamps.z0]];
    if (!plugged) points.unshift(socketHole(letter, false));
    return points;
  }

  return { sizes: SIZES, stepAngle: STEP_ANGLE, letters: Object.keys(spots), spots, keyPoint, lampPoint, socketPoint, socketHole, aroundSpindle, contactPoint, letterAngle, rotorParts, rotorFaces, pawlSpan, shortTurn, rotorWire, reflectorWire, keyRoute, harnessRoute, lampRoute };
}
