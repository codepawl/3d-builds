// Spread 2: a coal-fired steam power station. Drawn in the same plate style as spread 1.
import * as THREE from 'three';
import {
  INK, SERIF, SMALL_CAPS, makeCanvas, paintPaper, wash, rectPath, polygonPath, inkLine, hatch, paragraph, note,
  softBlob, seededRandom, canvasToTexture,
} from './paint.js';
import { Layer, VFold, makeCard, makeCutout, paperMaterial } from './pop.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM, floorX, floorZ } from './config.js';

const WALL = { width: 60, height: 11, pixelsPerCm: 70 };
// the steam loop in wall centimetres (x from the left, y from the bottom); type is what the strip carries
const LOOP = [
  { type: 'water', points: [[22, 2.0], [22, 0.8], [8, 0.8], [8, 8.4]] },
  { type: 'steam', points: [[8, 8.4], [10.5, 9.5], [19.5, 9.5], [19.5, 5.2], [33, 5.2], [33, 3.2]] },
  { type: 'wet', points: [[33, 3.2], [33, 2.0], [22, 2.0]] },
];
const ROTORS = [[24.5, 5.2, 1.15], [30, 5.2, 1.5], [39, 5.2, 1.5]];

function cmX(value) { return value * WALL.pixelsPerCm; }
function cmY(value) { return (WALL.height - value) * WALL.pixelsPerCm; }

export function figure(context, x, y, height, color) {
  context.fillStyle = color;
  context.strokeStyle = INK;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y - height * 0.88, height * 0.1, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.rect(x - height * 0.12, y - height * 0.76, height * 0.24, height * 0.46);
  context.fill();
  context.stroke();
  context.fillRect(x - height * 0.11, y - height * 0.3, height * 0.09, height * 0.3);
  context.fillRect(x + height * 0.02, y - height * 0.3, height * 0.09, height * 0.3);
}

function paintStation() {
  const width = WALL.width * WALL.pixelsPerCm;
  const height = WALL.height * WALL.pixelsPerCm;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 81, [240, 230, 208], 5);
  wash(context, rectPath(0, 0, cmX(16), height), '#e6c796', { seed: 1, alpha: 0.8, layers: 2, pool: 0.3 });
  wash(context, rectPath(cmX(16), 0, cmX(28), height), '#d6dcc9', { seed: 2, alpha: 0.8, layers: 2, pool: 0.3 });
  wash(context, rectPath(cmX(44), 0, cmX(16), height), '#dccaa6', { seed: 3, alpha: 0.8, layers: 2, pool: 0.3 });
  // roof trusses over the turbine hall and a crane
  for (let truss = 16; truss < 44; truss += 3.5) {
    inkLine(context, [[cmX(truss), cmY(10.9)], [cmX(truss + 1.75), cmY(9.7)], [cmX(truss + 3.5), cmY(10.9)]], 2.2, truss, 0.5);
  }
  inkLine(context, [[cmX(16), cmY(8.9)], [cmX(44), cmY(8.9)]], 4, 3);
  wash(context, rectPath(cmX(26), cmY(9.4), cmX(8), cmX(0.5)), '#7d868b', { seed: 4, alpha: 0.9, layers: 1, pool: 0.5 });
  inkLine(context, [[cmX(30), cmY(8.9)], [cmX(30), cmY(7.4)]], 2, 5);
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
  // control room and switchgear
  wash(context, rectPath(cmX(45.5), cmY(8.6), cmX(7.5), cmX(3.2)), '#c8d3d0', { seed: 16, alpha: 0.95, layers: 1, pool: 0.5 });
  wash(context, rectPath(cmX(46), cmY(8.0), cmX(6.5), cmX(1.2)), '#d9b563', { seed: 17, alpha: 0.8, layers: 1, pool: 0.4 });
  figure(context, cmX(48), cmY(5.6), cmX(1.2), '#40517a');
  figure(context, cmX(50.2), cmY(5.6), cmX(1.2), '#7a3b2e');
  for (let bar = 0; bar < 3; bar += 1) inkLine(context, [[cmX(44), cmY(3.6 - bar * 0.5)], [cmX(60), cmY(3.6 - bar * 0.5)]], 3, 20 + bar, 0.3);
  for (let cabinet = 45.5; cabinet < 58; cabinet += 2.2) {
    wash(context, rectPath(cmX(cabinet), cmY(2.8), cmX(1.8), cmX(2.4)), '#9aa0a2', { seed: cabinet, alpha: 0.95, layers: 1, pool: 0.5 });
  }
  // labels in small caps
  context.fillStyle = INK;
  context.font = `38px ${SMALL_CAPS}`;
  for (const [label, x, y] of [['Boiler house', 4.2, 10.7], ['Turbine hall', 19.2, 8.45], ['Generator', 36.5, 3.4], ['Condenser', 24.5, 0.28], ['Control room', 46.2, 11.6 - 0.2], ['Switchgear', 46, 0.28]]) {
    context.fillText(label, cmX(x), cmY(Math.min(y, 10.75)));
  }
  return canvas;
}

function paintRoof(width, height) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 83, [200, 205, 190], 5);
  wash(context, rectPath(0, 0, width, height), '#9fb09f', { seed: 4, alpha: 0.7, layers: 2, pool: 0.4 });
  for (let row = 14; row < height; row += 16) inkLine(context, [[0, row], [width, row]], 1.2, row, 0.3);
  inkLine(context, [[0, height / 2], [width, height / 2]], 4, 2);
  return canvas;
}

export function paintTower() {
  const width = 7 * 80;
  const height = 10.6 * 80;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const body = height * 0.82;
  const outline = (ctx) => {
    ctx.moveTo(width * 0.04, body);
    ctx.bezierCurveTo(width * 0.2, body * 0.6, width * 0.2, body * 0.28, width * 0.25, body * 0.1);
    ctx.lineTo(width * 0.75, body * 0.1);
    ctx.bezierCurveTo(width * 0.8, body * 0.28, width * 0.8, body * 0.6, width * 0.96, body);
    ctx.closePath();
  };
  wash(context, outline, '#c9c4b2', { seed: 5, alpha: 0.95, layers: 2, pool: 0.5 });
  context.save();
  context.beginPath();
  outline(context);
  context.clip();
  hatch(context, 0, 0, width, body, 12, 0.22, 5);
  for (let band = 0.2; band < 1; band += 0.14) {
    inkLine(context, [[0, body * band], [width, body * band]], 1.4, band * 10, 0.3);
  }
  context.restore();
  context.beginPath();
  outline(context);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.stroke();
  // plume
  softBlob(context, width * 0.5, height * 0.07, width * 0.22, height * 0.06, '#d9dbd6', 0.9, 7);
  softBlob(context, width * 0.58, height * 0.02, width * 0.16, height * 0.04, '#e6e6e0', 0.9, 8);
  return canvas;
}

export function paintStack() {
  const width = 1.8 * 90;
  const height = 11.5 * 90;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const shape = polygonPath([[width * 0.1, height], [width * 0.28, height * 0.12], [width * 0.72, height * 0.12], [width * 0.9, height]]);
  wash(context, shape, '#d9d2c0', { seed: 6, alpha: 0.95, layers: 2, pool: 0.5 });
  for (const [from, to] of [[0.14, 0.22], [0.3, 0.38], [0.46, 0.54]]) {
    context.save();
    context.beginPath();
    shape(context);
    context.clip();
    context.fillStyle = 'rgba(160,45,35,0.85)';
    context.fillRect(0, height * from, width, height * (to - from));
    context.restore();
  }
  context.beginPath();
  shape(context);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.stroke();
  softBlob(context, width * 0.5, height * 0.07, width * 0.45, height * 0.05, '#55575a', 0.8, 9);
  return canvas;
}

function paintTransformers(widthCm, heightCm) {
  const pixels = 50;
  const width = widthCm * pixels;
  const height = heightCm * pixels;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const ear = 0.9 * pixels;
  const random = seededRandom(3);
  for (const centerCm of [-24, -6, 14]) {
    const x = width / 2 + centerCm * pixels - 2.3 * pixels;
    wash(context, rectPath(x, height * 0.42, 4.6 * pixels, height * 0.5), '#7e8f8c', { seed: x, alpha: 0.95, layers: 2, pool: 0.5 });
    for (let fin = 0; fin < 9; fin += 1) {
      wash(context, rectPath(x + 4.6 * pixels - 6, height * 0.5 + fin * 9, 22, 6), '#a3aeab', { seed: fin + x, alpha: 0.95, layers: 1, pool: 0.5 });
    }
    for (const bushing of [0.7, 2.3, 3.9]) {
      wash(context, rectPath(x + bushing * pixels, height * 0.14, 0.35 * pixels, height * 0.3), '#c5a46e', { seed: bushing + x, alpha: 0.95, layers: 1, pool: 0.5 });
    }
  }
  // two pylons with a sagging line
  for (const pylonCm of [-14.5, 28]) {
    const x = width / 2 + pylonCm * pixels;
    inkLine(context, [[x - 22, height], [x, height * 0.06], [x + 22, height]], 3, pylonCm, 0.4);
    inkLine(context, [[x - 14, height * 0.55], [x + 14, height * 0.55]], 2.5, pylonCm + 1, 0.3);
    inkLine(context, [[x - 8, height * 0.3], [x + 8, height * 0.3]], 2.5, pylonCm + 2, 0.3);
  }
  wash(context, rectPath(ear, height * 0.86, width - ear * 2, height * 0.14), '#a79c85', { seed: 8, alpha: 0.9, layers: 2, pool: 0.4 });
  hatch(context, ear, height * 0.86, width - ear * 2, height * 0.14, 7, 0.3, 4);
  for (const tabX of [0, width - ear]) wash(context, rectPath(tabX, 0, ear, pixels * 1.3), '#e6dac0', { seed: tabX + 7, alpha: 1, layers: 1, pool: 0.5 });
  return canvas;
}

export function paintRotor(size) {
  const canvas = makeCanvas(size, size);
  const context = canvas.getContext('2d');
  const center = size / 2;
  wash(context, (ctx) => ctx.arc(center, center, center - 6, 0, Math.PI * 2), '#b9c0c2', { seed: 9, alpha: 1, layers: 1, pool: 0.6 });
  for (let blade = 0; blade < 14; blade += 1) {
    const angle = (blade / 14) * Math.PI * 2;
    inkLine(context, [[center + Math.cos(angle) * center * 0.2, center + Math.sin(angle) * center * 0.2], [center + Math.cos(angle) * (center - 8), center + Math.sin(angle) * (center - 8)]], 3, blade, 0.3);
  }
  context.beginPath();
  context.arc(center, center, center - 6, 0, Math.PI * 2);
  context.strokeStyle = INK;
  context.lineWidth = 5;
  context.stroke();
  context.beginPath();
  context.arc(center, center, center * 0.16, 0, Math.PI * 2);
  context.fillStyle = '#7b2a20';
  context.fill();
  return canvas;
}

export function paintTab(widthCm, heightCm) {
  const pixels = 80;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, 91, [228, 214, 186], 4);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.logicalWidth - 4, canvas.logicalHeight - 4);
  context.beginPath();
  context.arc(canvas.logicalWidth * 0.5, canvas.logicalHeight * 0.5, canvas.logicalHeight * 0.2, 0, Math.PI * 2);
  context.fillStyle = '#d9b563';
  context.fill();
  context.stroke();
  context.fillStyle = INK;
  context.font = `italic 400 ${canvas.logicalHeight * 0.2}px ${SERIF}`;
  context.fillText('← pull →', canvas.logicalWidth * 0.08, canvas.logicalHeight * 0.86);
  return canvas;
}

function paintBackdrop(width, height, texts) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 101);
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, 'rgba(235,222,190,0)');
  sky.addColorStop(1, 'rgba(190,200,190,0.5)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  // distant hills and a line of pylons
  wash(context, (ctx) => {
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 40) ctx.lineTo(x, height * 0.76 - Math.sin(x / 520) * 60 - Math.sin(x / 190) * 18);
    ctx.lineTo(width, height);
    ctx.closePath();
  }, '#9bae94', { seed: 3, alpha: 0.8, layers: 2, pool: 0.4 });
  context.fillStyle = INK;
  context.font = `150px ${SMALL_CAPS}`;
  context.fillText('Steam Power Station', 130, 235);
  paragraph(context, 'Coal burns, water boils, steam spins a turbine, a generator makes three-phase current and a transformer lifts it onto the grid. Pull the tab on the front edge to send the steam round its loop.', 135, 335, 1380, 60, `400 50px ${SERIF}`);
  let y = note(context, 1620, 110, 800, 'The Rankine cycle', texts.rankine, 1.6, { source: 'Wikipedia, "Rankine cycle"' });
  note(context, 1620, y + 30, 800, 'Where the heat goes', texts.cooling, 1.6, { source: 'Wikipedia, "Cooling tower"' });
  y = note(context, 2480, 110, 780, 'How efficient', texts.efficiency, 1.6, { source: 'Wikipedia, "Thermal power station"' });
  y = note(context, 2480, y + 30, 780, 'Grid frequency', texts.frequency, 1.6, { source: 'Frequency: Wikipedia. Speeds: our arithmetic.' });
  note(context, 130, 700, 1380, 'Why turbines', texts.turbines, 1.6, { source: 'Wikipedia, "Thermal power station" and "Titanic"' });
  return canvas;
}

function paintFloor(width, height, texts) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 111);
  const grass = context.createLinearGradient(0, 0, 0, height);
  grass.addColorStop(0, 'rgba(150,175,130,0.5)');
  grass.addColorStop(1, 'rgba(150,175,130,0)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = grass;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  // the slot the tab runs in
  wash(context, rectPath(floorX(-27), floorZ(37.8), 54 * PIXELS_PER_CM, 2.8 * PIXELS_PER_CM), '#9d8a68', { seed: 2, alpha: 0.7, layers: 1, pool: 0.5 });
  return canvas;
}

export async function buildStation(renderer) {
  const texts = {
    rankine: 'Four processes make the loop: a pump raises the pressure of the liquid, the boiler turns it into steam, the turbine takes work from the steam and a condenser turns it back to liquid. The pump needs only about 1 % of the work the turbine gives back.',
    cooling: 'The heat that never became electricity leaves in the condenser, into cooling water or a cooling tower. The tower spreads it into the air; the tallest in the world, Pingshan II in China, stands 210 m.',
    efficiency: 'A coal plant at 170 bar and 570 degrees C runs at 35 to 38 %. Subcritical plants reach 36 to 40 %, supercritical designs the low to mid 40s, the best fossil plants 46 %.',
    frequency: 'Large stations make three-phase current at 50 Hz or 60 Hz. A two-pole generator therefore turns at 3,000 rpm for 50 Hz and 3,600 rpm for 60 Hz.',
    turbines: 'After about 1905 turbines replaced reciprocating steam engines in power stations: higher speed, more compact, and steady enough to run generators in parallel on one bus. Titanic carried both kinds in 1912: two piston engines and a turbine.',
    strips: 'Pull the tab along the slot at the front. It drags a printed paper strip round the loop: out of the condenser as water, up through the boiler, along the top pipe as steam, through the turbine and back down to the condenser.',
  };
  const pageWidth = PAGE_WIDTH * PIXELS_PER_CM;
  const pageHeight = PAGE_DEPTH * PIXELS_PER_CM;
  const backdrop = paintBackdrop(pageWidth, pageHeight, texts);
  const floor = paintFloor(pageWidth, pageHeight, texts);

  const stationCanvas = paintStation();
  const stationTexture = canvasToTexture(THREE, stationCanvas, renderer);
  const station = new Layer({
    name: 'station',
    depth: 7.5,
    height: WALL.height,
    halfWidth: WALL.width / 2,
    wall: makeCard({ width: WALL.width, length: WALL.height, thick: 0.12, front: paperMaterial(stationTexture) }),
    platform: makeCard({ width: WALL.width, length: 7.5, thick: 0.1, front: paperMaterial(canvasToTexture(THREE, paintRoof(WALL.width * 30, 7.5 * 30), renderer)) }),
    order: 1,
  });

  // steam overlay: redrawn when the tab moves
  const overlayCanvas = makeCanvas(WALL.width * WALL.pixelsPerCm, WALL.height * WALL.pixelsPerCm);
  const overlayContext = overlayCanvas.getContext('2d');
  const overlayTexture = canvasToTexture(THREE, overlayCanvas, renderer);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(WALL.width, WALL.height), new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, depthWrite: false }));
  overlay.position.set(0, WALL.height / 2, 0.075);
  overlay.renderOrder = 2;
  station.frame.add(overlay);

  const rotors = ROTORS.map(([x, y, radius]) => {
    const rotor = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ map: canvasToTexture(THREE, paintRotor(256), renderer), roughness: 0.8, transparent: true, alphaTest: 0.3 }));
    rotor.position.set(x - WALL.width / 2, y, 0.1);
    rotor.castShadow = true;
    station.frame.add(rotor);
    return rotor;
  });

  const towerFold = new VFold({
    layer: station,
    x: 21,
    width: 7,
    hingeAlong: 3,
    panelLength: 10.6,
    panelA: makeCutout({ width: 7, length: 10.6, texture: canvasToTexture(THREE, paintTower(), renderer), thick: 0.08 }),
    order: 0,
  });
  const stackFold = new VFold({
    layer: station,
    x: -25,
    width: 1.8,
    hingeAlong: 2.4,
    panelLength: 11.5,
    panelA: makeCutout({ width: 1.8, length: 11.5, texture: canvasToTexture(THREE, paintStack(), renderer), thick: 0.08 }),
    order: 1,
  });

  const yardLayer = new Layer({
    name: 'yard',
    depth: 14.5,
    height: 3.6,
    halfWidth: 38.45,
    strutHalfWidth: 38.45,
    wall: makeCutout({ width: 77.8, length: 3.6, texture: canvasToTexture(THREE, paintTransformers(77.8, 3.6), renderer) }),
    order: 2,
  });

  // pull tab on the front edge
  const tab = makeCard({ width: 7, length: 2.4, thick: 0.12, front: paperMaterial(canvasToTexture(THREE, paintTab(7, 2.4), renderer)) });
  tab.userData.handle = { kind: 'steam' };
  tab.rotation.x = -Math.PI / 2;
  tab.position.set(0, 0.14, 38.4);
  tab.rotation.x = -Math.PI / 2;
  const tabHolder = new THREE.Group();
  tabHolder.add(tab);
  tab.position.set(0, 0, 0);
  tab.rotation.set(-Math.PI / 2, 0, 0);
  tabHolder.position.set(0, 0.14, 40.8);
  const tabTravel = 24;

  const root = new THREE.Group();
  root.add(station.root, towerFold.root, stackFold.root, yardLayer.root, tabHolder);

  const loopLength = LOOP.reduce((sum, run) => sum + run.points.slice(1).reduce((inner, point, index) => inner + Math.hypot(point[0] - run.points[index][0], point[1] - run.points[index][1]), 0), 0);
  const state = { steam: 0 };
  const colors = { water: '#3d86b8', steam: '#fbf8ef', wet: '#cfd3d0' };

  function drawLoop(value) {
    const phase = value * 11 * WALL.pixelsPerCm * 3.2;
    const period = 0.62 * WALL.pixelsPerCm;
    overlayContext.clearRect(0, 0, overlayCanvas.logicalWidth, overlayCanvas.logicalHeight);
    let travelled = 0;
    for (const run of LOOP) {
      for (let index = 0; index < run.points.length - 1; index += 1) {
        const [x0, y0] = run.points[index];
        const [x1, y1] = run.points[index + 1];
        const length = Math.hypot(x1 - x0, y1 - y0) * WALL.pixelsPerCm;
        overlayContext.save();
        overlayContext.lineCap = 'butt';
        overlayContext.setLineDash([period * 0.62, period * 0.38]);
        overlayContext.lineDashOffset = travelled - phase;
        overlayContext.beginPath();
        overlayContext.moveTo(cmX(x0), cmY(y0));
        overlayContext.lineTo(cmX(x1), cmY(y1));
        overlayContext.strokeStyle = INK;
        overlayContext.lineWidth = run.type === 'steam' ? 34 : 28;
        overlayContext.stroke();
        overlayContext.strokeStyle = colors[run.type];
        overlayContext.lineWidth = run.type === 'steam' ? 25 : 20;
        overlayContext.stroke();
        overlayContext.restore();
        travelled += length;
      }
    }
    overlayTexture.needsUpdate = true;
    rotors.forEach((rotor, index) => { rotor.rotation.z = -phase * 0.011 * (index === 2 ? 1 : 1.3); });
  }

  const spread = {
    name: 'station',
    backdrop,
    floor,
    root,
    layers: [station, yardLayer],
    folds: [towerFold, stackFold],
    state,
    handles: { tab },
    tabHolder,
    tabTravel,
    update(psi, farShift) {
      station.update(psi, farShift);
      yardLayer.update(psi, farShift);
      towerFold.update(psi);
      stackFold.update(psi);
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
