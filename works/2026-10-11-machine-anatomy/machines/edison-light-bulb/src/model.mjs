// Pure model of a carbon-filament incandescent lamp on a supply with a key switch. No DOM in here: the
// build, the page, the film and the tests all read this one file.
//
// What is physics: Ohm's law for the current, electric power heating the filament, radiation (T to the
// fourth power) cooling it, a filament resistance that falls as carbon gets hot, and carbon burning away
// when there is air round it. What is chosen for the figure (see reference/notes.md): the supply voltage,
// the two resistances (inside the 100 to 500 ohm range of US patent 223,898), the working temperature,
// the heat capacity that sets how fast it warms, how fast it burns in air, and the short sweep that shows
// the current arriving (in a real circuit the current starts everywhere at once).

const AMBIENT_KELVIN = 295;
const NOMINAL_VOLTS = 100;
const MIN_VOLTS = 40;
const MAX_VOLTS = 115;
const COLD_OHMS = 250;
const HOT_OHMS = 140;
const WORKING_KELVIN = 2100;
const HEAT_CAPACITY = 0.015;
const RADIATION = (NOMINAL_VOLTS * NOMINAL_VOLTS) / HOT_OHMS / (WORKING_KELVIN ** 4 - AMBIENT_KELVIN ** 4);
const GAS_COOLING = 0.012;
const GLOW_KELVIN = 800;
const BURN_FROM_KELVIN = 900;
const BURN_FULL_KELVIN = 1800;
const BURN_SECONDS = 1.1;
const WEAR_THINNING = 0.6;
const KEY_SECONDS = 0.16;
const PATH_SECONDS = 0.45;
const FILAMENT_REACH = 0.5;
const LONGEST_STEP = 1 / 240;

// The film's five numbered steps and the four words of the trace under the figure.
const STEPS = [
  { label: "The key switch closes the circuit" },
  { label: "Current flows up the lead-in wires" },
  { label: "The thin carbon filament resists it and heats" },
  { label: "It glows white hot" },
  { label: "No air in the bulb, so it does not burn" },
];
const TRACE = ["switch on", "current through the thin filament", "it gets white hot", "light"];
const PATH_SEGMENTS = ["wireOut", "socketIn", "leadUp", "leadDown", "socketOut", "wireBack"];
// Where along the sweep each piece of the path lights up: [from, to] as shares of the sweep.
const PATH_SHARES = { wireOut: [0, 0.22], socketIn: [0.22, 0.36], leadUp: [0.36, 0.5], leadDown: [0.5, 0.64], socketOut: [0.64, 0.78], wireBack: [0.78, 1] };

// Colour of the filament by temperature, on paper: dark carbon, then dull red, orange, yellow, yellow-white.
const COLOUR_STOPS = [
  [700, [70, 70, 76]],
  [950, [122, 30, 18]],
  [1250, [208, 62, 16]],
  [1550, [240, 132, 12]],
  [1850, [255, 196, 46]],
  [2100, [255, 226, 120]],
  [2300, [255, 240, 176]],
];

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function smooth(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

function createLamp() {
  return {
    wanted: false,
    turn: 0,
    closed: false,
    volts: NOMINAL_VOLTS,
    air: false,
    wear: 0,
    broken: false,
    temperature: AMBIENT_KELVIN,
    pathShare: 0,
    litSeconds: 0,
    time: 0,
  };
}

function setSwitch(lamp, on) {
  lamp.wanted = Boolean(on);
}

function setVolts(lamp, volts) {
  lamp.volts = clamp(volts, MIN_VOLTS, MAX_VOLTS);
}

function letAirIn(lamp) {
  lamp.air = true;
}

// A new filament in a bulb pumped out again. The switch stays where it is.
function mend(lamp) {
  lamp.air = false;
  lamp.wear = 0;
  lamp.broken = false;
  lamp.pathShare = 0;
}

// Carbon conducts better hot: the resistance falls from the cold value to the hot one as it warms,
// and rises as the filament burns thinner.
function resistanceOf(lamp) {
  const warmth = clamp((lamp.temperature - AMBIENT_KELVIN) / (WORKING_KELVIN - AMBIENT_KELVIN), 0, 1);
  const whole = COLD_OHMS + (HOT_OHMS - COLD_OHMS) * warmth;
  return whole / (1 - WEAR_THINNING * Math.min(1, lamp.wear));
}

function circuitComplete(lamp) {
  return lamp.closed && !lamp.broken;
}

// Amperes through the filament. The sweep that shows the current arriving has to reach the filament first.
function currentOf(lamp) {
  if (!circuitComplete(lamp) || lamp.pathShare < FILAMENT_REACH) return 0;
  return lamp.volts / resistanceOf(lamp);
}

function powerOf(lamp) {
  const current = currentOf(lamp);
  return current * current * resistanceOf(lamp);
}

function heatLossOf(lamp) {
  const radiated = RADIATION * (lamp.temperature ** 4 - AMBIENT_KELVIN ** 4);
  const carriedOff = lamp.air ? GAS_COOLING * (lamp.temperature - AMBIENT_KELVIN) : 0;
  return radiated + carriedOff;
}

// How much visible light, from 0 (dark) to about 1.15 at the highest voltage.
function brightnessOf(temperature) {
  const share = clamp((temperature - GLOW_KELVIN) / (WORKING_KELVIN - GLOW_KELVIN), 0, 1.3);
  return share ** 1.6;
}

function colourOf(temperature) {
  if (temperature <= COLOUR_STOPS[0][0]) return COLOUR_STOPS[0][1].slice();
  for (let index = 1; index < COLOUR_STOPS.length; index++) {
    const [upper, upperColour] = COLOUR_STOPS[index];
    if (temperature > upper) continue;
    const [lower, lowerColour] = COLOUR_STOPS[index - 1];
    const share = (temperature - lower) / (upper - lower);
    return lowerColour.map((channel, place) => Math.round(channel + (upperColour[place] - channel) * share));
  }
  return COLOUR_STOPS[COLOUR_STOPS.length - 1][1].slice();
}

function heatWord(temperature) {
  if (temperature < 330) return "cold";
  if (temperature < GLOW_KELVIN) return "warm, no glow yet";
  if (temperature < 1150) return "dull red";
  if (temperature < 1500) return "orange";
  if (temperature < 1850) return "yellow";
  return "yellow-white";
}

// Rough temperature for the readout: degrees Celsius to the nearest fifty.
function celsiusText(temperature) {
  const celsius = temperature - 273;
  if (celsius < 60) return "room temperature";
  return `about ${(Math.round(celsius / 50) * 50).toLocaleString("en-US")} °C`;
}

function stepKey(lamp, seconds, events) {
  const before = lamp.closed;
  const direction = lamp.wanted ? 1 : -1;
  lamp.turn = clamp(lamp.turn + (direction * seconds) / KEY_SECONDS, 0, 1);
  lamp.closed = lamp.turn >= 1;
  if (lamp.closed && !before) events.push({ name: "switch-on", complete: !lamp.broken, volts: lamp.volts });
  if (!lamp.closed && before) events.push({ name: "switch-off" });
}

function stepPath(lamp, seconds) {
  if (!circuitComplete(lamp)) {
    lamp.pathShare = 0;
    return;
  }
  lamp.pathShare = Math.min(1, lamp.pathShare + seconds / PATH_SECONDS);
}

function stepHeat(lamp, seconds, events) {
  const wasGlowing = lamp.temperature >= GLOW_KELVIN;
  const flow = (powerOf(lamp) - heatLossOf(lamp)) / HEAT_CAPACITY;
  lamp.temperature = Math.max(AMBIENT_KELVIN, lamp.temperature + flow * seconds);
  const glowing = lamp.temperature >= GLOW_KELVIN;
  if (glowing && !wasGlowing) {
    lamp.litSeconds = 0;
    events.push({ name: "glow" });
  }
  if (glowing) lamp.litSeconds += seconds;
}

// With air in the bulb the hot carbon burns away; when it is gone the circuit is open.
function stepBurning(lamp, seconds, events) {
  if (!lamp.air || lamp.broken) return;
  const fierceness = smooth(BURN_FROM_KELVIN, BURN_FULL_KELVIN, lamp.temperature);
  lamp.wear += (fierceness * seconds) / BURN_SECONDS;
  if (lamp.wear < 1) return;
  lamp.wear = 1;
  lamp.broken = true;
  lamp.pathShare = 0;
  events.push({ name: "burn-out" });
}

// Advances the lamp by `seconds` and returns what happened: switch-on, switch-off, glow, burn-out.
function step(lamp, seconds) {
  const events = [];
  const pieces = Math.max(1, Math.ceil(seconds / LONGEST_STEP));
  const piece = seconds / pieces;
  for (let index = 0; index < pieces; index++) {
    lamp.time += piece;
    stepKey(lamp, piece, events);
    stepPath(lamp, piece);
    stepHeat(lamp, piece, events);
    stepBurning(lamp, piece, events);
  }
  return events;
}

function segmentGlow(lamp, name) {
  const [from, to] = PATH_SHARES[name];
  return smooth(from, to, lamp.pathShare);
}

// How far each of the five numbered steps has come, 0 to 1.
function stepLevels(lamp) {
  const flowing = circuitComplete(lamp);
  return [
    smooth(0.2, 1, lamp.turn),
    flowing ? smooth(0.3, FILAMENT_REACH, lamp.pathShare) : 0,
    smooth(330, 700, lamp.temperature),
    smooth(1500, 1950, lamp.temperature),
    !lamp.air && !lamp.broken ? smooth(1850, 1990, lamp.temperature) : 0,
  ];
}

// How far each of the four words of the trace under the figure has come, 0 to 1.
function traceLevels(lamp) {
  return [smooth(0.2, 1, lamp.turn), currentOf(lamp) > 0 ? 1 : 0, smooth(900, 1900, lamp.temperature), Math.min(1, brightnessOf(lamp.temperature))];
}

function stateText(lamp) {
  if (lamp.broken) return "filament burnt out · circuit open";
  if (!lamp.closed) return lamp.temperature >= GLOW_KELVIN ? "off · cooling" : "off";
  return lamp.air ? "on · burning in air" : "on";
}

export const LampApi = {
  AMBIENT_KELVIN,
  NOMINAL_VOLTS,
  MIN_VOLTS,
  MAX_VOLTS,
  COLD_OHMS,
  HOT_OHMS,
  WORKING_KELVIN,
  GLOW_KELVIN,
  KEY_SECONDS,
  PATH_SECONDS,
  FILAMENT_REACH,
  STEPS,
  TRACE,
  PATH_SEGMENTS,
  clamp,
  smooth,
  createLamp,
  setSwitch,
  setVolts,
  letAirIn,
  mend,
  resistanceOf,
  circuitComplete,
  currentOf,
  powerOf,
  brightnessOf,
  colourOf,
  heatWord,
  celsiusText,
  step,
  segmentGlow,
  stepLevels,
  traceLevels,
  stateText,
};
