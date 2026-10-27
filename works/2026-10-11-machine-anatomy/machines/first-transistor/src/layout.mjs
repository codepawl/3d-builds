// The size table of the first-transistor figure, in world units: x runs from the emitter side to the
// collector side, y towards the viewer, z up. The build draws from it and the page reads the same
// numbers. Nothing here is a measured dimension of the 1947 device: only the arrangement is taken from
// the sources (reference/notes.md), and the slit between the two contacts is drawn far wider than the
// real one so that it can be seen at all.

const BOARD = { x0: -84, x1: 84, y0: -46, y1: 46, z0: 0, z1: 6 };
const BASE = { x0: -22, x1: 22, y0: -16, y1: 16, z0: BOARD.z1, z1: 14 };
const GERMANIUM = { x0: -12, x1: 12, y0: -9, y1: 9, z0: BASE.z1, z1: 19 };
const WEDGE = { halfWidth: 20, top: 55, tip: GERMANIUM.z1, flat: 1.2, tipLift: 1.2, y0: -5, y1: 5 };
const FOIL = { thickness: 1.3, inner: 0.8, outer: 2.3 };
const POST = { x0: -4, x1: 4, y0: -36, y1: -28, z0: BOARD.z1, z1: 82 };
const ARM = { x0: -3, x1: 3, y0: -36, y1: 2, z0: 78, z1: 82 };
const SPRING = { halfWidth: 9, y: 0, top: ARM.z0, bottom: WEDGE.top };
const TERMINAL = { radius: 3.2, z0: BOARD.z1, z1: 19, cap: 21.4 };
const TERMINALS = { emitter: [-44, 22], collector: [44, 22], base: [44, -26] };
const SOURCE = { x0: -80, x1: -60, y0: -14, y1: 10, z0: BOARD.z1, z1: 20 };
const EMITTER_CELL = { x: -70, y: 28, radius: 6, z0: BOARD.z1, z1: 20 };
const COLLECTOR_BATTERY = { x0: 58, x1: 80, y0: 14, y1: 38, z0: BOARD.z1, z1: 28 };
const LOAD = { x0: 58, x1: 80, y0: -22, y1: -4, z0: BOARD.z1, z1: 16 };
const SWITCH = { x0: -36, x1: -22, y0: 33, y1: 41, z0: BOARD.z1, z1: 9, lever: 9 };
const WIRE_Z = BOARD.z1 + 0.05;

function wedgeProfile() {
  return [[-WEDGE.halfWidth, WEDGE.top], [WEDGE.halfWidth, WEDGE.top], [WEDGE.flat, WEDGE.tip + WEDGE.tipLift], [-WEDGE.flat, WEDGE.tip + WEDGE.tipLift]];
}

// One strip of foil lies on each sloping edge of the wedge and ends on the germanium. `side` is -1 for
// the emitter's strip and 1 for the collector's.
function foilProfile(side) {
  const slope = [WEDGE.halfWidth - FOIL.inner, WEDGE.top - WEDGE.tip];
  const length = Math.hypot(slope[0], slope[1]);
  const outward = [(slope[1] / length) * FOIL.thickness, (-slope[0] / length) * FOIL.thickness];
  const profile = [[FOIL.inner, WEDGE.tip], [WEDGE.halfWidth, WEDGE.top], [WEDGE.halfWidth + outward[0], WEDGE.top + outward[1]], [FOIL.outer, WEDGE.tip]];
  return profile.map(([x, z]) => [x * side, z]);
}

// Where a lead is soldered to the top of a strip of foil.
function foilTop(side) {
  return [side * (WEDGE.halfWidth - 1), 0, WEDGE.top - 2];
}

function contactPoint(side) {
  return [side * ((FOIL.inner + FOIL.outer) / 2), 0, WEDGE.tip];
}

function terminalTop(name) {
  const [x, y] = TERMINALS[name];
  return [x, y, TERMINAL.cap];
}

const BASE_LUG = [BASE.x1, -8, 10];

// The three leads as the points a soft curve is drawn through.
function leadRoute(name) {
  if (name === "base") return [BASE_LUG, [31, -12, 16], [39, -20, 25], terminalTop("base")];
  const side = name === "emitter" ? -1 : 1;
  return [foilTop(side), [side * 29, 3, 63], [side * 41, 13, 47], terminalTop(name)];
}

function onBoard(points) {
  return points.map(([x, y]) => [x, y, WIRE_Z]);
}

// The demonstration circuit's wires, flat on the board. The input loop: signal source, emitter cell,
// bias switch, emitter terminal; and back from the base terminal to the source. The output loop:
// collector terminal, collector battery, load, base terminal.
const BOARD_WIRES = {
  sourceToCell: onBoard([[-70, SOURCE.y1], [-70, EMITTER_CELL.y - EMITTER_CELL.radius]]),
  cellToSwitch: onBoard([[-70, EMITTER_CELL.y + EMITTER_CELL.radius], [-70, 37], [SWITCH.x0, 37]]),
  switchToEmitter: onBoard([[SWITCH.x1, 37], [-16, 37], [-16, 29], [TERMINALS.emitter[0] + TERMINAL.radius, 29], [TERMINALS.emitter[0], TERMINALS.emitter[1] + TERMINAL.radius]]),
  baseToSource: onBoard([[TERMINALS.base[0], TERMINALS.base[1] - TERMINAL.radius], [44, -41], [-70, -41], [-70, SOURCE.y0]]),
  collectorToBattery: onBoard([[TERMINALS.collector[0] + TERMINAL.radius, 22], [COLLECTOR_BATTERY.x0, 22]]),
  batteryToLoad: onBoard([[69, COLLECTOR_BATTERY.y0], [69, LOAD.y1]]),
  loadToBase: onBoard([[LOAD.x0, -13], [51, -13], [51, -26], [TERMINALS.base[0] + TERMINAL.radius, -26]]),
};

export const LayoutApi = {
  BOARD,
  BASE,
  GERMANIUM,
  WEDGE,
  FOIL,
  POST,
  ARM,
  SPRING,
  TERMINAL,
  TERMINALS,
  SOURCE,
  EMITTER_CELL,
  COLLECTOR_BATTERY,
  LOAD,
  SWITCH,
  WIRE_Z,
  BASE_LUG,
  BOARD_WIRES,
  wedgeProfile,
  foilProfile,
  foilTop,
  contactPoint,
  terminalTop,
  leadRoute,
};
