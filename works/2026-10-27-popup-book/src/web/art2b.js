// Spread 2 build: a coal-fired steam power station as a staircase of paper layers, tallest at the back.
//   backdrop leaf : day sky and a printed town
//   hills         : a ridge strip with a line of pylons walking off towards the town
//   boiler house, turbine hall, control building : three box folds side by side, three heights
//   chimney on the boiler roof, cooling tower on its own plinth: V-folds with paper smoke and steam
//   pylon layer, transformer yard, river : the low steps in front
import * as THREE from 'three';
import {
  INK, SERIF, SMALL_CAPS, makeCanvas, paintPaper, wash, rectPath, polygonPath, inkLine, hatch, paragraph, softBlob, seededRandom, canvasToTexture,
} from './paint.js';
import { Layer, VFold, makeCard, makeCutout, makeLectern, paperMaterial, smoothstep } from './pop.js';
import { paintSeaWall, paintSeaTop, paintSmoke, paintLecternCard } from './scenery.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM, floorX, floorZ } from './config.js';
import { figure, paintTower, paintStack, paintRotor, paintTab } from './art2.js';

const PIXELS = 70;
const WALL_WIDTH = 60;
const WALL_HEIGHT = 13.4;
const FOUNDATION = 1.0;
const MODULES = [
  { name: 'boiler', from: 0, to: 16, height: 13.4, roofTone: '#b0634a', roofSeed: 31 },
  { name: 'turbine', from: 16, to: 44, height: 11.4, roofTone: '#9fb09f', roofSeed: 32 },
  { name: 'control', from: 44, to: 60, height: 7.8, roofTone: '#b8b6aa', roofSeed: 33 },
];
// the steam loop in wall centimetres (x from the left, y from the bottom); type is what the strip carries
const LOOP = [
  { type: 'water', points: [[22, 2.0], [22, 0.8], [8, 0.8], [8, 8.4]] },
  { type: 'steam', points: [[8, 8.4], [10.5, 9.5], [19.5, 9.5], [19.5, 5.2], [33, 5.2], [33, 3.2]] },
  { type: 'wet', points: [[33, 3.2], [33, 2.0], [22, 2.0]] },
];
const ROTORS = [[24.5, 5.2, 1.15], [30, 5.2, 1.5], [39, 5.2, 1.5]];

function cmX(value) { return value * PIXELS; }
function cmY(value) { return (WALL_HEIGHT - value - FOUNDATION) * PIXELS; }

function label(context, text, x, y, color = INK) {
  context.save();
  context.fillStyle = color;
  context.font = `84px ${SMALL_CAPS}`;
  context.fillText(text, cmX(x), cmY(y));
  context.restore();
}

// One printed cutaway of the whole station, 60 cm wide; each box fold takes its own slice.
function paintStationWall() {
  const canvas = makeCanvas(WALL_WIDTH * PIXELS, WALL_HEIGHT * PIXELS);
  const context = canvas.getContext('2d');
  const height = canvas.logicalHeight;
  paintPaper(context, canvas.logicalWidth, height, 81, [240, 230, 208], 5);
  wash(context, rectPath(0, 0, cmX(16), height), '#e6c796', { seed: 1, alpha: 0.8, layers: 2, pool: 0.3 });
  wash(context, rectPath(cmX(16), 0, cmX(28), height), '#d6dcc9', { seed: 2, alpha: 0.8, layers: 2, pool: 0.3 });
  wash(context, rectPath(cmX(44), 0, cmX(16), height), '#dccaa6', { seed: 3, alpha: 0.8, layers: 2, pool: 0.3 });
  // stone foundation along the foot of all three buildings
  wash(context, rectPath(0, height - cmX(FOUNDATION), canvas.logicalWidth, cmX(FOUNDATION)), '#9a9384', { seed: 50, alpha: 0.95, layers: 2, pool: 0.4 });
  for (let block = 0; block < WALL_WIDTH; block += 2.2) inkLine(context, [[cmX(block), height - cmX(FOUNDATION)], [cmX(block), height]], 1.6, block, 0.3);
  inkLine(context, [[0, height - cmX(FOUNDATION)], [canvas.logicalWidth, height - cmX(FOUNDATION)]], 3, 9, 0.3);
  // brick band under the boiler house roof
  wash(context, rectPath(0, 0, cmX(16), cmX(1.0)), '#b0634a', { seed: 40, alpha: 0.8, layers: 1, pool: 0.4 });
  for (let course = 0; course < 3; course += 1) inkLine(context, [[0, cmX(0.3 + course * 0.3)], [cmX(16), cmX(0.3 + course * 0.3)]], 1.4, course, 0.3);
  // roof trusses over the turbine hall and a crane
  for (let truss = 16; truss < 44; truss += 3.5) inkLine(context, [[cmX(truss), cmY(10.3)], [cmX(truss + 1.75), cmY(9.2)], [cmX(truss + 3.5), cmY(10.3)]], 2.4, truss, 0.5);
  inkLine(context, [[cmX(16), cmY(8.7)], [cmX(44), cmY(8.7)]], 4, 3);
  wash(context, rectPath(cmX(26), cmY(9.1), cmX(8), cmX(0.5)), '#7d868b', { seed: 4, alpha: 0.9, layers: 1, pool: 0.5 });
  inkLine(context, [[cmX(30), cmY(8.7)], [cmX(30), cmY(7.2)]], 2, 5);
  // boiler house: bunker, furnace, tubes, drum
  wash(context, polygonPath([[cmX(0.5), cmY(10.6)], [cmX(3.6), cmY(10.6)], [cmX(3.6), cmY(7.4)], [cmX(2.2), cmY(6.2)], [cmX(0.5), cmY(6.2)]]), '#8a7d68', { seed: 6, alpha: 0.85 });
  hatch(context, cmX(0.5), cmY(10.6), cmX(3.1), cmX(4.4), 9, 0.3, 4);
  wash(context, rectPath(cmX(4), cmY(8.3), cmX(9.5), cmX(7.1)), '#a85a3c', { seed: 7, alpha: 0.9, layers: 2, pool: 0.4 });
  hatch(context, cmX(4), cmY(8.3), cmX(9.5), cmX(7.1), 10, 0.3, 8);
  for (let tube = 4.7; tube < 13.2; tube += 0.75) inkLine(context, [[cmX(tube), cmY(8.0)], [cmX(tube), cmY(2.4)]], 1.6, tube, 0.3);
  const fire = context.createLinearGradient(0, cmY(3.2), 0, cmY(1.2));
  fire.addColorStop(0, 'rgba(255,170,60,0)');
  fire.addColorStop(1, 'rgba(255,150,40,0.95)');
  context.fillStyle = fire;
  context.fillRect(cmX(4.2), cmY(3.2), cmX(9.1), cmX(2));
  wash(context, rectPath(cmX(4.4), cmY(9.9), cmX(8.6), cmX(1.5)), '#8f979b', { seed: 9, alpha: 0.95, layers: 1, pool: 0.5 });
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.strokeRect(cmX(4.4), cmY(9.9), cmX(8.6), cmX(1.5));
  figure(context, cmX(2.4), cmY(0.2), cmX(1.5), '#33405a');
  // feed pump on the water line
  wash(context, (ctx) => ctx.arc(cmX(14.6), cmY(0.8), cmX(0.62), 0, Math.PI * 2), '#b9a46a', { seed: 41, alpha: 0.95, layers: 1, pool: 0.6 });
  context.beginPath();
  context.arc(cmX(14.6), cmY(0.8), cmX(0.62), 0, Math.PI * 2);
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.stroke();
  // turbine set on its foundation, condenser below
  wash(context, rectPath(cmX(17), cmY(4.1), cmX(26.5), cmX(1.1)), '#b9b09c', { seed: 10, alpha: 0.9, layers: 1, pool: 0.4 });
  wash(context, polygonPath([[cmX(19.5), cmY(4.2)], [cmX(23), cmY(4.2)], [cmX(23), cmY(6.2)], [cmX(19.5), cmY(5.9)]]), '#8c9aa3', { seed: 11, alpha: 0.95, layers: 1 });
  wash(context, polygonPath([[cmX(23), cmY(4.2)], [cmX(27), cmY(4.2)], [cmX(27), cmY(6.5)], [cmX(23), cmY(6.2)]]), '#7f909b', { seed: 12, alpha: 0.95, layers: 1 });
  wash(context, polygonPath([[cmX(27), cmY(4.2)], [cmX(33.6), cmY(4.2)], [cmX(33.6), cmY(6.9)], [cmX(27), cmY(6.5)]]), '#73858f', { seed: 13, alpha: 0.95, layers: 1 });
  wash(context, rectPath(cmX(35), cmY(6.7), cmX(8.3), cmX(2.5)), '#b3453a', { seed: 14, alpha: 0.95, layers: 2, pool: 0.4 });
  for (let fin = 35.4; fin < 43; fin += 0.6) inkLine(context, [[cmX(fin), cmY(6.6)], [cmX(fin), cmY(4.3)]], 1.4, fin, 0.3);
  wash(context, rectPath(cmX(21), cmY(3.0), cmX(13.5), cmX(2.1)), '#8aa8b4', { seed: 15, alpha: 0.95, layers: 2, pool: 0.4 });
  for (let tubeRow = 1.2; tubeRow < 2.9; tubeRow += 0.32) inkLine(context, [[cmX(21.4), cmY(tubeRow)], [cmX(34.1), cmY(tubeRow)]], 1.2, tubeRow, 0.3);
  figure(context, cmX(16.7), cmY(0.2), cmX(1.5), '#7a3b2e');
  figure(context, cmX(43.4), cmY(0.2), cmX(1.5), '#33405a');
  // control room and switchgear (the control building is only 6.8 cm tall)
  wash(context, rectPath(cmX(45.2), cmY(6.5), cmX(8.4), cmX(3.5)), '#c8d3d0', { seed: 16, alpha: 0.95, layers: 1, pool: 0.5 });
  wash(context, rectPath(cmX(45.7), cmY(4.6), cmX(7.4), cmX(1.1)), '#d9b563', { seed: 17, alpha: 0.8, layers: 1, pool: 0.4 });
  figure(context, cmX(48), cmY(3.0), cmX(1.2), '#40517a');
  figure(context, cmX(50.4), cmY(3.0), cmX(1.2), '#7a3b2e');
  for (let cabinet = 45.5; cabinet < 59; cabinet += 2.2) wash(context, rectPath(cmX(cabinet), cmY(2.6), cmX(1.8), cmX(2.2)), '#9aa0a2', { seed: cabinet, alpha: 0.95, layers: 1, pool: 0.5 });
  // labels, large enough to read in the reel
  label(context, 'Boiler house', 0.9, 11.6);
  label(context, 'Turbine', 20.9, 8.7);
  label(context, 'Generator', 35.3, 7.6);
  label(context, 'Condenser', 22.6, 0.45);
  label(context, 'Pump', 13.3, 2.1);
  label(context, 'Control room', 45.4, 5.7);
  return canvas;
}

function sliceCanvas(source, fromCm, toCm, heightCm) {
  const width = (toCm - fromCm) * PIXELS;
  const height = heightCm * PIXELS;
  const canvas = makeCanvas(width, height);
  const scale = source.paintScale;
  canvas.getContext("2d").drawImage(source, fromCm * PIXELS * scale, (source.logicalHeight - height) * scale, width * scale, height * scale, 0, 0, width, height);
  return canvas;
}

function paintRoof(widthCm, lengthCm, tone, seed) {
  const pixels = 30;
  const canvas = makeCanvas(widthCm * pixels, lengthCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, seed, [220, 215, 196], 5);
  wash(context, rectPath(0, 0, canvas.logicalWidth, canvas.logicalHeight), tone, { seed, alpha: 0.85, layers: 2, pool: 0.4 });
  for (let row = 12; row < canvas.logicalHeight; row += 14) inkLine(context, [[0, row], [canvas.logicalWidth, row]], 1.2, row, 0.3);
  inkLine(context, [[0, canvas.logicalHeight / 2], [canvas.logicalWidth, canvas.logicalHeight / 2]], 4, 2);
  return canvas;
}

// the ridge line of the hills strip, in cm above the strip foot, at page x
function ridgeHeight(pageX) {
  return 11.9 + 1.1 * Math.sin(pageX / 9) + 0.7 * Math.sin(pageX / 3.7 + 1);
}

function highestRidgeX() {
  let bestX = 0;
  for (let pageX = -40; pageX <= 40; pageX += 0.25) if (ridgeHeight(pageX) > ridgeHeight(bestX)) bestX = pageX;
  return bestX;
}

function paintHills(widthCm, heightCm) {
  const pixels = 50;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  const ridge = ridgeHeight;
  const toCanvasY = (valueCm) => canvas.logicalHeight - valueCm * pixels;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.logicalHeight);
  gradient.addColorStop(0, '#b4c7a0');
  gradient.addColorStop(1, '#7e9b78');
  context.beginPath();
  context.moveTo(0, canvas.logicalHeight);
  for (let pixelX = 0; pixelX <= canvas.logicalWidth; pixelX += 6) context.lineTo(pixelX, toCanvasY(ridge(pixelX / pixels - widthCm / 2)));
  context.lineTo(canvas.logicalWidth, canvas.logicalHeight);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
  const crest = [];
  for (let pixelX = 0; pixelX <= canvas.logicalWidth; pixelX += 12) crest.push([pixelX, toCanvasY(ridge(pixelX / pixels - widthCm / 2))]);
  inkLine(context, crest, 4, 3, 0.4);
  // field lines on the slope
  for (let line = 1; line < 5; line += 1) {
    const points = [];
    for (let pixelX = 0; pixelX <= canvas.logicalWidth; pixelX += 20) points.push([pixelX, toCanvasY(ridge(pixelX / pixels - widthCm / 2) - line * 0.9)]);
    inkLine(context, points, 1.6, line, 0.4, 'rgba(61,38,21,0.35)');
  }
  // pylons walking along the ridge towards the town, each smaller than the last
  const pylonsAt = [34, 28.5, 23.5, 19.5, 16, 13];
  const tops = [];
  pylonsAt.forEach((pageX, index) => {
    const size = 1.9 - index * 0.24;
    const baseX = (pageX + widthCm / 2) * pixels;
    const baseY = toCanvasY(ridge(pageX) - 0.7);
    const half = size * 0.22 * pixels;
    const topY = baseY - size * pixels;
    inkLine(context, [[baseX - half * 1.6, baseY + 6], [baseX - half * 0.4, topY], [baseX, topY - size * 0.12 * pixels], [baseX + half * 0.4, topY], [baseX + half * 1.6, baseY + 6]], 3.2, index + 2, 0.3);
    inkLine(context, [[baseX - half * 1.1, baseY - size * 0.45 * pixels], [baseX + half * 1.1, baseY - size * 0.45 * pixels]], 2.6, index + 5, 0.3);
    inkLine(context, [[baseX - half * 1.5, topY + size * 0.18 * pixels], [baseX + half * 1.5, topY + size * 0.18 * pixels]], 2.8, index + 8, 0.3);
    tops.push([baseX - half * 1.5, topY + size * 0.18 * pixels, baseX + half * 1.5]);
  });
  for (let index = 0; index < tops.length - 1; index += 1) {
    const [leftX, leftY] = [tops[index + 1][2], tops[index + 1][1]];
    const [rightX, rightY] = [tops[index][0], tops[index][1]];
    const midX = (leftX + rightX) / 2;
    inkLine(context, [[leftX, leftY], [midX, Math.max(leftY, rightY) + 10], [rightX, rightY]], 1.6, index, 0.2);
  }
  return canvas;
}

function paintPylon(widthCm, heightCm) {
  const pixels = 60;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  const centerX = canvas.logicalWidth * 0.6;
  const height = canvas.logicalHeight;
  const legHalfBottom = widthCm * 0.2 * pixels;
  const legHalfTop = widthCm * 0.035 * pixels;
  const sides = (y) => legHalfTop + (legHalfBottom - legHalfTop) * (y / (height * 0.88));
  context.strokeStyle = INK;
  context.lineCap = 'round';
  context.lineWidth = 10;
  const topY = height * 0.08;
  const baseY = height * 0.98;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(centerX + side * sides(0), topY);
    context.lineTo(centerX + side * legHalfBottom * 1.12, baseY);
    context.stroke();
  }
  context.lineWidth = 4;
  const levels = 8;
  for (let level = 0; level < levels; level += 1) {
    const y0 = topY + ((baseY - topY) * level) / levels;
    const y1 = topY + ((baseY - topY) * (level + 1)) / levels;
    const half0 = legHalfTop + ((legHalfBottom * 1.12 - legHalfTop) * level) / levels;
    const half1 = legHalfTop + ((legHalfBottom * 1.12 - legHalfTop) * (level + 1)) / levels;
    context.beginPath();
    context.moveTo(centerX - half0, y0);
    context.lineTo(centerX + half1, y1);
    context.moveTo(centerX + half0, y0);
    context.lineTo(centerX - half1, y1);
    context.moveTo(centerX - half1, y1);
    context.lineTo(centerX + half1, y1);
    context.stroke();
  }
  const arms = [[0.12, 2.6], [0.3, 3.2], [0.48, 3.8]];
  context.lineWidth = 6;
  for (const [fraction, length] of arms) {
    const y = height * fraction;
    context.beginPath();
    context.moveTo(centerX - length * pixels * 0.5, y);
    context.lineTo(centerX + length * pixels * 0.5, y);
    context.stroke();
    context.fillStyle = '#d9d2c0';
    for (const side of [-1, 1]) context.fillRect(centerX + side * length * pixels * 0.5 - 6, y, 12, 30);
  }
  // wires leaving to the left towards the next pylon
  context.lineWidth = 2.4;
  for (const [fraction, length] of arms) {
    const y = height * fraction;
    context.beginPath();
    context.moveTo(centerX - length * pixels * 0.5, y + 30);
    context.quadraticCurveTo(centerX * 0.5, y + 70, 0, y + 40);
    context.stroke();
  }
  return canvas;
}

function paintYard(widthCm, heightCm) {
  const pixels = 60;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  const height = canvas.logicalHeight;
  for (const centerCm of [3.6, 11.6]) {
    const x = centerCm * pixels - 2.1 * pixels;
    wash(context, rectPath(x, height * 0.38, 4.2 * pixels, height * 0.5), '#7e8f8c', { seed: x, alpha: 0.95, layers: 2, pool: 0.5 });
    for (let fin = 0; fin < 9; fin += 1) wash(context, rectPath(x + 4.2 * pixels - 6, height * 0.46 + fin * 10, 24, 7), '#a3aeab', { seed: fin + x, alpha: 0.95, layers: 1, pool: 0.5 });
    for (const bushing of [0.7, 2.1, 3.5]) wash(context, rectPath(x + bushing * pixels, height * 0.1, 0.42 * pixels, height * 0.3), '#c5a46e', { seed: bushing + x, alpha: 0.95, layers: 1, pool: 0.5 });
    inkLine(context, [[x, height * 0.88], [x + 4.2 * pixels, height * 0.88]], 3, x, 0.3);
  }
  wash(context, rectPath(0, height * 0.88, canvas.logicalWidth, height * 0.12), '#a79c85', { seed: 8, alpha: 0.9, layers: 2, pool: 0.4 });
  return canvas;
}

function paintBackdrop(width, height) {
  const canvas = makeCanvas(width, height, 2.5);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 101);
  const margin = Math.round(height * 0.03);
  const random = seededRandom(27);
  const edge = (context2) => {
    context2.moveTo(margin, margin);
    for (let x = margin; x <= width - margin; x += 40) context2.lineTo(x, margin + (random() - 0.5) * 8);
    for (let y = margin; y <= height - margin; y += 40) context2.lineTo(width - margin + (random() - 0.5) * 8, y);
    for (let x = width - margin; x >= margin; x -= 40) context2.lineTo(x, height - margin + (random() - 0.5) * 8);
    for (let y = height - margin; y >= margin; y -= 40) context2.lineTo(margin + (random() - 0.5) * 8, y);
    context2.closePath();
  };
  context.save();
  context.beginPath();
  edge(context);
  context.clip();
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#9cc3d2');
  sky.addColorStop(0.5, '#cfe0dc');
  sky.addColorStop(0.72, '#f0e0bc');
  sky.addColorStop(1, '#b9c8a4');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  // a low sun with a soft halo, printed clouds with ink edges, a flock of birds
  const sunX = width * 0.8;
  const sunY = height * 0.5;
  const halo = context.createRadialGradient(sunX, sunY, 20, sunX, sunY, 520);
  halo.addColorStop(0, 'rgba(255,238,190,0.95)');
  halo.addColorStop(1, 'rgba(255,238,190,0)');
  context.fillStyle = halo;
  context.fillRect(sunX - 520, sunY - 520, 1040, 1040);
  wash(context, (ctx) => ctx.arc(sunX, sunY, 110, 0, Math.PI * 2), '#f6c96a', { seed: 3, alpha: 1, layers: 1, pool: 0.6, poolWidth: 4 });
  const cloudPuffs = [[0.1, 0.34, 1.1], [0.38, 0.24, 1.5], [0.62, 0.38, 1.0], [0.9, 0.2, 1.2], [0.52, 0.5, 0.8]];
  for (const [fractionX, fractionY, size] of cloudPuffs) {
    const puffs = [[0, 0, 90], [110, -26, 120], [240, -6, 100], [340, 12, 76], [-100, 14, 70]];
    for (const [offsetX, offsetY, radius] of puffs) {
      const centerX = fractionX * width + offsetX * size;
      const centerY = fractionY * height + offsetY * size;
      context.beginPath();
      context.arc(centerX, centerY, radius * size, Math.PI, 0);
      context.fillStyle = '#fbf6ea';
      context.fill();
      context.beginPath();
      context.arc(centerX, centerY, radius * size, Math.PI * 1.02, Math.PI * 1.98);
      context.strokeStyle = 'rgba(61,38,21,0.75)';
      context.lineWidth = 3;
      context.stroke();
    }
    context.fillStyle = '#fbf6ea';
    context.fillRect(fractionX * width - 100 * size, fractionY * height - 6 * size, 440 * size, 30 * size);
  }
  for (let bird = 0; bird < 9; bird += 1) {
    const birdX = width * (0.18 + bird * 0.035) + (bird % 3) * 14;
    const birdY = height * (0.26 + Math.sin(bird * 1.7) * 0.03) + bird * 5;
    inkLine(context, [[birdX - 22, birdY - 6], [birdX, birdY + 4], [birdX + 22, birdY - 6]], 3.2, bird, 0.2);
  }
  const cmToX = (pageX) => (pageX + PAGE_WIDTH / 2) * PIXELS_PER_CM;
  const groundY = height - 16.6 * PIXELS_PER_CM;
  // far plain under the town
  context.fillStyle = '#a9bb8f';
  context.fillRect(0, groundY, width, height - groundY);
  inkLine(context, [[0, groundY], [width, groundY]], 3, 6, 0.3);
  // the town: rows of small houses, a church spire and a gasholder, with chimney smoke
  const palette = ['#c98d6a', '#b8704f', '#d8b07a', '#a9846a', '#cf9f86', '#9c6a52'];
  const draw = (pageX, houseWidth, houseHeight, color, row) => {
    const x = cmToX(pageX);
    const baseY = groundY + row * 14;
    const w = houseWidth * PIXELS_PER_CM;
    const h = houseHeight * PIXELS_PER_CM;
    wash(context, rectPath(x, baseY - h, w, h), color, { seed: pageX * 7 + row, alpha: 0.95, layers: 1, pool: 0.5 });
    context.beginPath();
    context.moveTo(x - 6, baseY - h);
    context.lineTo(x + w / 2, baseY - h - w * 0.38);
    context.lineTo(x + w + 6, baseY - h);
    context.closePath();
    context.fillStyle = '#7d4a3a';
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 2.4;
    context.stroke();
    context.strokeRect(x, baseY - h, w, h);
    context.fillStyle = '#f0d38a';
    for (let window = 0; window < Math.max(1, Math.floor(houseWidth / 0.9)); window += 1) context.fillRect(x + 8 + window * 34, baseY - h * 0.65, 14, 20);
  };
  for (let row = 0; row < 2; row += 1) {
    let pageX = -16 + row * 1.1;
    while (pageX < 30) {
      const houseWidth = 1.1 + random() * 1.2;
      draw(pageX, houseWidth, 1.4 + random() * 1.7, palette[Math.floor(random() * palette.length)], row);
      pageX += houseWidth + 0.15 + random() * 0.3;
    }
  }
  // church spire
  const spireX = cmToX(4.5);
  wash(context, rectPath(spireX, groundY - 4.6 * PIXELS_PER_CM, 1.5 * PIXELS_PER_CM, 4.6 * PIXELS_PER_CM), '#d6c8aa', { seed: 4, alpha: 0.95, layers: 1, pool: 0.5 });
  context.beginPath();
  context.moveTo(spireX - 8, groundY - 4.6 * PIXELS_PER_CM);
  context.lineTo(spireX + 0.75 * PIXELS_PER_CM, groundY - 8.8 * PIXELS_PER_CM);
  context.lineTo(spireX + 1.5 * PIXELS_PER_CM + 8, groundY - 4.6 * PIXELS_PER_CM);
  context.closePath();
  context.fillStyle = '#6c7c80';
  context.fill();
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.stroke();
  context.strokeRect(spireX, groundY - 4.6 * PIXELS_PER_CM, 1.5 * PIXELS_PER_CM, 4.6 * PIXELS_PER_CM);
  // gasholder
  const holderX = cmToX(19);
  wash(context, rectPath(holderX, groundY - 3.2 * PIXELS_PER_CM, 3.6 * PIXELS_PER_CM, 3.2 * PIXELS_PER_CM), '#b9c0c2', { seed: 6, alpha: 0.95, layers: 1, pool: 0.5 });
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.strokeRect(holderX, groundY - 3.2 * PIXELS_PER_CM, 3.6 * PIXELS_PER_CM, 3.2 * PIXELS_PER_CM);
  for (let band = 1; band < 4; band += 1) inkLine(context, [[holderX, groundY - band * 0.8 * PIXELS_PER_CM], [holderX + 3.6 * PIXELS_PER_CM, groundY - band * 0.8 * PIXELS_PER_CM]], 1.6, band, 0.3);
  for (const pageX of [-6, 0.5, 8, 15, 24]) softBlob(context, cmToX(pageX) + 20, groundY - 4.6 * PIXELS_PER_CM - random() * 60, 100, 36, '#ffffff', 0.7, Math.round(pageX + 40));
  context.restore();
  context.beginPath();
  edge(context);
  context.strokeStyle = INK;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = INK;
  context.font = `190px ${SMALL_CAPS}`;
  context.fillText('Steam Power Station', margin * 3, margin * 3 + 150);
  context.fillStyle = '#5b4630';
  context.font = `italic 400 76px ${SERIF}`;
  context.fillText('Coal to current, and the town it lights', margin * 3 + 6, margin * 3 + 250);
  return canvas;
}

function paintFloor(width, height) {
  const canvas = makeCanvas(width, height, 3);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 111);
  const grass = context.createLinearGradient(0, 0, 0, height);
  grass.addColorStop(0, 'rgba(150,175,130,0.55)');
  grass.addColorStop(0.55, 'rgba(150,175,130,0.25)');
  grass.addColorStop(1, 'rgba(150,175,130,0)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = grass;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  // the slot the tab runs in
  wash(context, rectPath(floorX(-27), floorZ(38.1), 54 * PIXELS_PER_CM, 2.8 * PIXELS_PER_CM), '#9d8a68', { seed: 2, alpha: 0.7, layers: 1, pool: 0.5 });
  return canvas;
}

export async function buildStation(renderer) {
  const texts = {
    strips: 'Pull the tab along the slot at the front. It drags the steam round its loop: water up through the boiler, along the top pipe as steam, through the turbine, into the condenser, and back by the pump.',
  };
  const toTexture = (canvas) => canvasToTexture(THREE, canvas, renderer);
  const backdrop = paintBackdrop(PAGE_WIDTH * PIXELS_PER_CM, PAGE_DEPTH * PIXELS_PER_CM);
  const floor = paintFloor(PAGE_WIDTH * PIXELS_PER_CM, PAGE_DEPTH * PIXELS_PER_CM);
  const stationCanvas = paintStationWall();
  const brick = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });

  const hills = new Layer({
    name: 'hills', depth: 1.2, height: 15, wallWidth: 82, order: 0, lag: 0, roofWidth: 3, roofOffsetX: highestRidgeX(),
    wall: makeCutout({ width: 82, length: 15, texture: toTexture(paintHills(82, 15)) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(82, 1.2, { tone: '#6f8d6b', light: '#7f9c7a', seed: 12 }))),
  });
  const overlays = [];
  const modules = MODULES.map((module, index) => {
    const widthCm = module.to - module.from;
    const centerX = (module.from + module.to) / 2 - WALL_WIDTH / 2;
    const layer = new Layer({
      name: module.name, depth: 8, height: module.height, wallWidth: widthCm, x: centerX, behind: hills, lag: 0.06, order: 1 + index * 0.01,
      wall: makeCard({ width: widthCm, length: module.height, thick: 0.12, front: paperMaterial(toTexture(sliceCanvas(stationCanvas, module.from, module.to, module.height))) }),
      roofFront: paperMaterial(toTexture(paintRoof(widthCm, 6.8, module.roofTone, module.roofSeed))),
      cheekMaterial: brick(index === 0 ? 0xc79a76 : index === 1 ? 0xcdd3c0 : 0xd8c9a6),
    });
    // steam overlay: redrawn when the tab moves
    const canvas = makeCanvas(widthCm * PIXELS, module.height * PIXELS);
    const texture = toTexture(canvas);
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(widthCm, module.height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    overlay.position.set(0, module.height / 2, 0.075);
    overlay.renderOrder = 2;
    layer.frame.add(overlay);
    overlays.push({ canvas, context: canvas.getContext('2d'), texture, from: module.from, height: module.height });
    return layer;
  });
  const [boilerLayer, turbineLayer, controlLayer] = modules;

  const rotors = ROTORS.map(([x, y, radius]) => {
    const rotor = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ map: toTexture(paintRotor(256)), roughness: 0.8, transparent: true, alphaTest: 0.3 }));
    rotor.position.set(x - 30, y + FOUNDATION, 0.1);
    rotor.castShadow = true;
    turbineLayer.frame.add(rotor);
    return rotor;
  });

  // chimney on the boiler roof, with dark smoke
  const chimneyHeight = 10;
  const chimneyPanel = makeCutout({ width: 2.2, length: chimneyHeight, texture: toTexture(paintStack()), thick: 0.08 });
  const chimneySmoke = makeCutout({ width: 7.2, length: 4.4, texture: toTexture(paintSmoke(7.2, 4.4, 41, '#7d7a76')), thick: 0.06 });
  chimneySmoke.position.set(2.3, chimneyHeight - 0.4, 0.05);
  chimneyPanel.add(chimneySmoke);
  const chimney = new VFold({ layer: boilerLayer, x: -24, width: 2.2, hingeAlong: 3.4, backAlong: 0, panelLength: chimneyHeight, panelA: chimneyPanel, order: 0, riseFrom: 1.0, riseTo: 1.95 });

  // cooling tower on its own plinth at the left, with a white steam plume
  const plinth = new Layer({
    name: 'plinth', depth: 6.5, height: 3, wallWidth: 10.4, x: -36.2, behind: hills, lag: 0.06, order: 1,
    wall: makeCard({ width: 10.4, length: 3, thick: 0.12, front: paperMaterial(toTexture(paintRoof(10.4, 3, '#a2a89a', 36))) }),
    roofFront: paperMaterial(toTexture(paintRoof(10.4, 5.3, '#97a58f', 37))),
    cheekMaterial: brick(0xb3b09c),
  });
  const towerHeight = 15;
  const towerPanel = makeCutout({ width: 9, length: towerHeight, texture: toTexture(paintTower()), thick: 0.08 });
  const towerSteam = makeCutout({ width: 8.6, length: 5.2, texture: toTexture(paintSmoke(8.6, 5.2, 57, '#f1f0ea')), thick: 0.06 });
  towerSteam.position.set(1.2, towerHeight * 0.74, 0.05);
  towerPanel.add(towerSteam);
  const tower = new VFold({ layer: plinth, x: -36.2, width: 9, hingeAlong: 2.7, backAlong: 0, panelLength: towerHeight, panelA: towerPanel, order: 0, riseFrom: 1.25, riseTo: 1.95 });

  // pylon layer (right), transformer yard and river steps in front
  const pylonWidth = 11.2;
  const pylonLayer = new Layer({
    name: 'pylon', depth: 9.8, height: 9.5, wallWidth: pylonWidth, x: 36.2, behind: hills, lag: 0.09, order: 1, roofWidth: 2.4, roofOffsetX: 1.2,
    wall: makeCutout({ width: pylonWidth, length: 9.5, texture: toTexture(paintPylon(pylonWidth, 9.5)) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(2.4, 8.6, { tone: '#7e9b78', light: '#a2b98f', seed: 14 }))),
  });
  const yardLayer = new Layer({
    name: 'yard', depth: 13.6, height: 5.2, wallWidth: 16, x: 22, behind: controlLayer, lag: 0.13, order: 2,
    wall: makeCutout({ width: 16, length: 5.2, texture: toTexture(paintYard(16, 5.2)) }),
    roofFront: paperMaterial(toTexture(paintRoof(16, 5.6, '#a79c85', 38))),
    cheekMaterial: brick(0xa79c85),
  });
  const riverTones = ['#98c4b8', '#75aaa2', '#5b9795'];
  const riverSlices = [
    { name: 'river-tower', from: -42, to: -30.6, behind: plinth, cheeks: 'left' },
    { name: 'river-boiler', from: -30, to: -14, behind: boilerLayer },
    { name: 'river-turbine', from: -14, to: 14, behind: turbineLayer },
    { name: 'river-yard', from: 14, to: 30, behind: yardLayer },
    { name: 'river-pylon', from: 30.6, to: 42, behind: pylonLayer, cheeks: 'right' },
  ];
  const riverLayers = riverSlices.map((slice) => {
    const width = slice.to - slice.from;
    const center = (slice.from + slice.to) / 2;
    return new Layer({
      name: slice.name, depth: 18, height: 1.1, wallWidth: width, x: center, behind: slice.behind, lag: 0.2, order: 4,
      wall: makeCutout({ width, length: 1.1, texture: toTexture(paintSeaWall(width, 1.1, { startCm: slice.from, tones: riverTones, seed: 8, crestDropCm: 0.4, amplitudeCm: 0.22, wavelengthCm: 4.2, foam: true, glints: false })) }),
      roofFront: paperMaterial(toTexture(paintSeaTop(width, 18 - slice.behind.depth, { startCm: slice.from, tone: '#5b9795', light: '#8fbfb4', seed: 15 }))),
      cheekMaterial: slice.cheeks ? brick(0x6aa39a) : null,
    });
  });
  const layers = [hills, boilerLayer, turbineLayer, controlLayer, plinth, pylonLayer, yardLayer, ...riverLayers];
  const folds = [chimney, tower];
  const puffs = [chimneySmoke, towerSteam];

  // lecterns with the short specialist texts
  const lecternDefinitions = [
    { x: -31, heading: 'Four steps', accent: '#e6c796', body: 'Pump, boiler, turbine, condenser. The pump needs only about 1 % of the turbine’s work.' },
    { x: -12.5, heading: 'Where heat goes', accent: '#a9c3c4', body: 'Heat that never became current leaves at the condenser, into river water or a cooling tower.' },
    { x: 6, heading: '35 to 38 %', accent: '#d9a58a', body: 'A coal plant at 170 bar and 570 degrees C. The best fossil plants reach 46 %.' },
    { x: 24.5, heading: '50 or 60 Hz', accent: '#cdd49a', body: 'Three-phase current. A two-pole generator turns at 3,000 or 3,600 rpm.' },
  ];
  const lecterns = lecternDefinitions.map((definition, index) => {
    const lectern = makeLectern({ width: 17.4, slopeLength: 7.6, angleDegrees: 36, texture: toTexture(paintLecternCard(17.4, 7.6, definition.heading, definition.body, definition.accent)) });
    lectern.position.set(definition.x, 0.02, 36.4);
    lectern.userData.assembly = `lectern-${index}`;
    return lectern;
  });

  // pull tab on the front edge
  const tab = makeCard({ width: 7, length: 2.4, thick: 0.12, front: paperMaterial(toTexture(paintTab(7, 2.4))) });
  tab.userData.handle = { kind: 'steam' };
  const tabHolder = new THREE.Group();
  tabHolder.userData.assembly = 'tab';
  tabHolder.add(tab);
  tab.rotation.set(-Math.PI / 2, 0, 0);
  tabHolder.position.set(0, 0.14, 40.9);
  const tabTravel = 24;

  const root = new THREE.Group();
  for (const layer of layers) root.add(layer.root);
  for (const fold of folds) root.add(fold.root);
  for (const lectern of lecterns) root.add(lectern);
  root.add(tabHolder);

  const state = { steam: 0 };
  const colors = { water: '#3d86b8', steam: '#fbf8ef', wet: '#cfd3d0' };
  const drawLoop = (value) => {
    const phase = value * 11 * PIXELS * 3.2;
    const period = 0.9 * PIXELS;
    for (const overlay of overlays) {
      const { context, canvas } = overlay;
      context.clearRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);
      let travelled = 0;
      for (const run of LOOP) {
        // one continuous path per run with round joins and caps, so the pipe turns its corners in a smooth pill-shaped dash
        let runLength = 0;
        context.save();
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.setLineDash([period * 0.14, period * 0.86]);
        context.lineDashOffset = travelled - phase;
        context.beginPath();
        run.points.forEach(([x, y], index) => {
          const pixelX = (x - overlay.from) * PIXELS;
          const pixelY = (overlay.height - y - FOUNDATION) * PIXELS;
          if (index === 0) context.moveTo(pixelX, pixelY);
          else context.lineTo(pixelX, pixelY);
          if (index > 0) runLength += Math.hypot(x - run.points[index - 1][0], y - run.points[index - 1][1]) * PIXELS;
        });
        context.strokeStyle = INK;
        context.lineWidth = run.type === 'steam' ? 50 : 42;
        context.stroke();
        context.strokeStyle = colors[run.type];
        context.lineWidth = run.type === 'steam' ? 40 : 32;
        context.stroke();
        context.restore();
        travelled += runLength;
      }
      overlay.texture.needsUpdate = true;
    }
    rotors.forEach((rotor, index) => { rotor.rotation.z = -phase * 0.011 * (index === 2 ? 1 : 1.3); });
  };

  const spread = {
    name: 'station',
    backdrop,
    floor,
    root,
    layers,
    folds,
    state,
    handles: { tab },
    tabHolder,
    tabTravel,
    update(psi, farShift) {
      for (const layer of layers) layer.update(psi, farShift);
      for (const fold of folds) fold.update(psi);
      const grow = smoothstep((psi - 1.0) / 0.95);
      for (const puff of puffs) puff.scale.setScalar(Math.max(0.001, grow));
      const lift = smoothstep(psi / 0.9);
      for (const lectern of lecterns) lectern.setStand(lift);
    },
    setSteam(value) {
      state.steam = Math.min(1, Math.max(0, value));
      tabHolder.position.x = -tabTravel + state.steam * tabTravel * 2;
      drawLoop(state.steam);
    },
    caption() {
      return { heading: 'Steam cycle', body: texts.strips };
    },
    hints: 'Drag the tab along the front edge.',
  };
  spread.setSteam(0);
  return spread;
}
