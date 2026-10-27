// Every size of the telegraph, in world units (about 4 mm each), and where every wire runs.
// x runs from the sending office (left) to the receiving office (right), y from the back of the benches
// to the viewer, z up. The floor is z = 0. The build and the page both read this one table.

const BENCH_TOP = 8;
const WIRE_LEVEL = 8.3;
const DECK = 10.5;
const POST_TOP = 12.5;

const SIZES = {
  benchTop: BENCH_TOP,
  wireLevel: WIRE_LEVEL,
  deck: DECK,
  postTop: POST_TOP,
  postRadius: 1.3,
  send: { x0: -150, x1: -62, y0: -42, y1: 46 },
  receive: { x0: 56, x1: 158, y0: -42, y1: 46 },
  cell: { radius: 6.4, height: 19.5, capRadius: 3.4, capHeight: 2.4, terminal: 2.6 },
  battery: { tray: { x0: -147, x1: -112, y0: -36, y1: -5 }, cells: [[-138.5, -13.5], [-138.5, -28], [-121, -28], [-121, -13.5]], minus: [-142, -2], plus: [-116, -2] },
  localBattery: { tray: { x0: 64, x1: 100, y0: 10, y1: 30 }, cells: [[73.5, 20], [90.5, 20]], minus: [73.5, 34], plus: [90.5, 34] },
  key: {
    base: { x0: -112, x1: -70, y0: 2, y1: 30 },
    lever: { x0: -110, x1: -72, y0: 13.5, y1: 18.5, z0: 20, z1: 22.4 },
    pivot: [-96, 16, 21.2],
    posts: { x0: -97.2, x1: -94.8, near: [19.5, 21.5], far: [10.5, 12.5], top: 22 },
    knob: { x: -76, stemTop: 24.4, radius: 5.2, top: 27 },
    anvil: { x: -82, radius: 2, top: 17.2 },
    stud: { z0: 18.8 },
    stop: { x: -107, radius: 1.4 },
    spring: { x: -89, radius: 1.8, turns: 5 },
    rear: [-108, 24],
    front: [-73, 24],
    angle: 0.114,
  },
  linePost: { send: [-65, -24], receive: [60, -24] },
  earthPost: { send: [-65, 34], receive: [59, 34] },
  earthPlate: { send: { x0: -58, x1: -46, y0: 28, y1: 40 }, receive: { x0: 42, x1: 54, y0: 28, y1: 40 }, top: 1.2 },
  poles: { xs: [-40, 38], y: -24, half: 2, top: 84, arm: { half: 2.6, y0: -37, y1: -11, top: 87 }, pinTop: 89, bellRadius: 2.5, bellTop: 93.6, tie: 91.2 },
  line: { sag: 7, breakFrom: -6, breakTo: 4 },
  relay: {
    base: { x0: 66, x1: 102, y0: -38, y1: -12 },
    coils: [[76, -30], [76, -20]],
    coil: { radius: 4.4, flange: 5.2, z0: 12, z1: 25, flangeTop: 26.2, coreRadius: 1.6, coreTop: 27 },
    lever: { x0: 67, x1: 98, y0: -26.5, y1: -23.5, z0: 29.5, z1: 31.5 },
    pad: { x0: 72, x1: 80, y0: -35, y1: -15, z0: 28.2 },
    pivot: [90, -25, 30.5],
    posts: { x0: 88.5, x1: 91.5, near: [-22.5, -20.5], far: [-29.5, -27.5], top: 32.2 },
    contact: { x: 68.5, radius: 1.3, top: 27.6 },
    stud: { z0: 28.8 },
    spring: { x: 96, radius: 1.3, turns: 8 },
    coilIn: [69, -14],
    coilOut: [84, -14],
    arm: [96, -14],
    point: [69, -36],
    angle: 0.056,
  },
  register: {
    base: { x0: 108, x1: 154, y0: -12, y1: 40 },
    plate: { x0: 112, x1: 113.5, y0: 8, y1: 38, top: 48 },
    rollers: { x0: 113.5, x1: 135.5, radius: 2.4, grooved: [19, 40.2], feedTop: [24, 40.2], feedBottom: [24, 35] },
    gears: { x0: 113.5, x1: 114.7, wheels: [{ y: 30.5, z: 20, r: 7.5, spokes: 5, turn: 0.06 }, { y: 19.5, z: 21.5, r: 3.6, spokes: 4, turn: -0.125 }, { y: 14, z: 27, r: 2.8, spokes: 3, turn: 0.16 }] },
    coils: [[146, 13.5], [146, 24.5]],
    coil: { radius: 4.6, flange: 5.4, z0: 12, z1: 26.6, flangeTop: 27.6, coreRadius: 1.7, coreTop: 28.2 },
    lever: { x0: 129, x1: 152, y0: 17.5, y1: 20.5, z0: 31, z1: 33 },
    pad: { x0: 141.5, x1: 150.5, y0: 7.5, y1: 30.5, z0: 29.6 },
    pivot: [138, 19, 32],
    posts: { x0: 136.5, x1: 139.5, near: [22, 24], far: [14, 16], top: 33.7 },
    stylus: { x: 130.5, radius: 0.8, top: 36.7 },
    spring: { x: 134, radius: 1.2, turns: 8 },
    coilIn: [151.5, 4],
    coilOut: [151.5, 34],
    shelf: { x0: 123.5, x1: 135, y0: 27.5, y1: 76, z0: 36, z1: 37.5 },
    bracket: { x0: 127.5, x1: 130.5, y0: 35.5, y1: 38.5 },
    angle: 0.129,
  },
  reel: { x0: 125, x1: 133.5, y: -24, z: 36, radius: 10, flange: 11.2, stand: { near: [135, 137], far: [121.5, 123.5], y0: -26, y1: -22, top: 39 }, foot: { x0: 120, x1: 138.5, y0: -31, y1: -17, top: 9.5 } },
  tape: { x0: 125, x1: 133.5, reelTop: [-24, 46], flatFrom: 15.5, level: 37.6, end: 76, curl: [[77.4, 37.2], [78.5, 36.1], [79, 34.4]], markX: 130.5, stylusAt: 19, perBeat: 2 },
};

const HELIX_STEPS = 14;

export function createLayout() {
  // A screw-thread of points round a vertical axis: a coil of wire, or a coil spring.
  function helix(x, y, radius, z0, z1, turns) {
    const points = [];
    const count = Math.round(turns * HELIX_STEPS);
    for (let step = 0; step <= count; step++) {
      const share = step / count;
      const angle = share * turns * Math.PI * 2 + Math.PI / 4;
      points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle), z0 + (z1 - z0) * share]);
    }
    return points;
  }

  function cellTop() {
    return DECK + SIZES.cell.height + SIZES.cell.capHeight;
  }

  // The two terminals on top of a cell: [the one a strap arrives at, the one it leaves from].
  function cellTerminals([x, y]) {
    return [[x - SIZES.cell.terminal, y, cellTop()], [x + SIZES.cell.terminal, y, cellTop()]];
  }

  // From the minus post through every cell in turn to the plus post, as separate straps.
  function batteryStraps(battery) {
    const straps = [];
    let from = [battery.minus[0], battery.minus[1], POST_TOP];
    for (const cell of battery.cells) {
      const [arrives, leaves] = cellTerminals(cell);
      straps.push([from, arrives]);
      from = leaves;
    }
    straps.push([from, [battery.plus[0], battery.plus[1], POST_TOP]]);
    return straps;
  }

  // The same run in one piece, for the lit path: the current crosses each cell between its terminals.
  function throughBattery(battery) {
    return batteryStraps(battery).flat();
  }

  function onBench(points) {
    return points.map(([x, y]) => [x, y, WIRE_LEVEL]);
  }

  function post([x, y]) {
    return [[x, y, WIRE_LEVEL], [x, y, POST_TOP]];
  }

  function insulatorTie(pole) {
    return [SIZES.poles.xs[pole], SIZES.poles.y, SIZES.poles.tie];
  }

  // A wire hanging between two points, sagging by `sag` in the middle, from share `from` to share `to`.
  function hanging(start, end, sag, from = 0, to = 1, steps = 16) {
    const points = [];
    for (let step = 0; step <= steps; step++) {
      const share = from + ((to - from) * step) / steps;
      const dip = sag * 4 * share * (1 - share);
      points.push([start[0] + (end[0] - start[0]) * share, start[1] + (end[1] - start[1]) * share, start[2] + (end[2] - start[2]) * share - dip]);
    }
    return points;
  }

  // The line between the two poles, in two pieces: the gap in the middle stands for the miles left out.
  function lineSpans() {
    const start = insulatorTie(0);
    const end = insulatorTie(1);
    const shareOf = (x) => (x - start[0]) / (end[0] - start[0]);
    return [hanging(start, end, SIZES.line.sag, 0, shareOf(SIZES.line.breakFrom)), hanging(start, end, SIZES.line.sag, shareOf(SIZES.line.breakTo), 1)];
  }

  function dropWire(side) {
    const foot = side === "send" ? SIZES.linePost.send : SIZES.linePost.receive;
    const tie = insulatorTie(side === "send" ? 0 : 1);
    return hanging([foot[0], foot[1], POST_TOP], tie, 3);
  }

  function earthLead(side) {
    const [x, y] = SIZES.earthPost[side];
    const plate = SIZES.earthPlate[side];
    const middle = (plate.x0 + plate.x1) / 2;
    const towards = side === "send" ? 1 : -1;
    return [[x, y, POST_TOP], [x + towards * 6, y, 10.5], [middle, y, 5], [middle, y, SIZES.earthPlate.top]];
  }

  function earthReturn() {
    const from = SIZES.earthPlate.receive;
    const to = SIZES.earthPlate.send;
    return [[(from.x0 + from.x1) / 2, 34, SIZES.earthPlate.top], [(to.x0 + to.x1) / 2, 34, SIZES.earthPlate.top]];
  }

  // The wires that lie on the benches, each from a post or a base edge to another.
  function benchWires() {
    const K = SIZES.key;
    const R = SIZES.relay;
    const G = SIZES.register;
    return {
      batteryToKey: onBench([SIZES.battery.plus, [-116, 24], [K.base.x0, 24]]),
      keyToLine: onBench([[K.base.x1, 24], [-65, 24], SIZES.linePost.send]),
      earthToBattery: onBench([SIZES.earthPost.send, [-142, 34], SIZES.battery.minus]),
      lineToRelay: onBench([SIZES.linePost.receive, [60, -14], [R.base.x0, -14]]),
      relayToEarth: onBench([[84, R.base.y1], [84, -6], [59, -6], SIZES.earthPost.receive]),
      localToRelay: onBench([SIZES.localBattery.plus, [104, 34], [104, -10], [96, -10], [96, R.base.y1]]),
      relayToRegister: onBench([[69, R.base.y0], [69, -40], [156.5, -40], [156.5, 4], [G.base.x1, 4]]),
      registerToLocal: onBench([[G.base.x1, 34], [156.5, 34], [156.5, 43], [73.5, 43], SIZES.localBattery.minus]),
    };
  }

  // Up one coil of a magnet and down the other, between its two terminals.
  function throughCoils(part) {
    const [first, second] = part.coils;
    const coil = part.coil;
    const up = helix(first[0], first[1], coil.radius + 0.2, coil.z0, coil.z1, 6);
    const down = helix(second[0], second[1], coil.radius + 0.2, coil.z1, coil.z0, 6);
    return [[part.coilIn[0], part.coilIn[1], DECK], ...up, ...down, [part.coilOut[0], part.coilOut[1], DECK]];
  }

  function throughKey() {
    const K = SIZES.key;
    const leverLevel = K.pivot[2];
    return [
      [K.rear[0], K.rear[1], DECK],
      [K.pivot[0], K.rear[1], DECK],
      [K.pivot[0], K.posts.near[0] + 1, DECK],
      [K.pivot[0], K.posts.near[0] + 1, leverLevel],
      K.pivot,
      [K.anvil.x, K.pivot[1], leverLevel],
      [K.anvil.x, K.pivot[1], DECK],
      [K.anvil.x, K.front[1], DECK],
      [K.front[0], K.front[1], DECK],
    ];
  }

  function throughRelayContacts() {
    const R = SIZES.relay;
    return [
      [R.arm[0], R.arm[1], DECK],
      [R.pivot[0], R.arm[1], DECK],
      [R.pivot[0], R.posts.near[0] + 1, DECK],
      [R.pivot[0], R.posts.near[0] + 1, R.pivot[2]],
      R.pivot,
      [R.contact.x, R.pivot[1], R.pivot[2]],
      [R.contact.x, R.pivot[1], DECK],
      [R.point[0], R.point[1], DECK],
    ];
  }

  // Each stretch of the two circuits as one or more runs of world points, named as in the model.
  function pathRoutes() {
    const W = benchWires();
    const K = SIZES.key;
    const R = SIZES.relay;
    const G = SIZES.register;
    const deck = ([x, y]) => [x, y, DECK];
    const spans = lineSpans();
    return {
      battery: [[...throughBattery(SIZES.battery), ...W.batteryToKey, deck([K.base.x0, 24]), deck(K.rear)]],
      key: [throughKey()],
      toLine: [[deck(K.front), deck([K.base.x1, 24]), ...W.keyToLine, ...dropWire("send")]],
      line: spans,
      drop: [[...dropWire("receive").reverse(), ...W.lineToRelay, deck([R.base.x0, -14]), deck(R.coilIn)]],
      relayCoils: [throughCoils(R)],
      earth: [[deck(R.coilOut), deck([84, R.base.y1]), ...W.relayToEarth, ...earthLead("receive")], earthReturn(), [...earthLead("send").reverse(), ...W.earthToBattery, [SIZES.battery.minus[0], SIZES.battery.minus[1], POST_TOP]]],
      localOut: [[...throughBattery(SIZES.localBattery), ...W.localToRelay, deck([96, R.base.y1]), ...throughRelayContacts()]],
      toRegister: [[deck(R.point), deck([69, R.base.y0]), ...W.relayToRegister, deck([G.base.x1, 4]), deck(G.coilIn)]],
      registerCoils: [throughCoils(G)],
      localBack: [[deck(G.coilOut), deck([G.base.x1, 34]), ...W.registerToLocal, [SIZES.localBattery.minus[0], SIZES.localBattery.minus[1], POST_TOP]]],
    };
  }

  // The paper tape's centre line as [y, z], from the top of the reel to the curl past the shelf.
  function tapeProfile() {
    const T = SIZES.tape;
    return [T.reelTop, [T.flatFrom, T.level], [T.end, T.level], ...T.curl];
  }

  // A mark made `age` beats ago has travelled this far along the tape from the stylus.
  function markPlace(age) {
    return SIZES.tape.stylusAt + age * SIZES.tape.perBeat;
  }

  return { sizes: SIZES, helix, cellTop, cellTerminals, batteryStraps, post, insulatorTie, lineSpans, dropWire, earthLead, earthReturn, benchWires, pathRoutes, tapeProfile, markPlace };
}
