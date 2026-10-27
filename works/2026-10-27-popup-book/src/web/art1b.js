// Spread 1 build: RMS Titanic as a staircase of paper layers, tallest at the back (see pop.js for the mechanics).
//   backdrop leaf  : the night sky and a far sea line
//   horizon        : a sea strip, the tallest step
//   port wall      : the plain hull side (portholes outside), hidden behind the deck
//   ship           : the starboard cutaway, roof deck with lifeboats, end cheeks, funnels as V-folds with smoke curls
//   hull strip     : the hull plate in front, with a window onto the boiler rooms (a recessed box) and the pull tab
//   iceberg        : its own layer off the bow
//   near waves     : two low sea steps in front of the hull, hiding the waterline
import * as THREE from 'three';
import {
  INK, SERIF, makeCanvas, paintPaper, wash, rectPath, inkLine, hatch, seededRandom, canvasToTexture,
} from './paint.js';
import { Layer, VFold, makeCard, makeCutout, makeLectern, paperMaterial, smoothstep, direction } from './pop.js';
import { paintSeaWall, paintSeaTop, paintNightSky, paintIceberg, paintSmoke, paintLecternCard } from './scenery.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM, floorX, floorZ } from './config.js';
import {
  SHIP_CROP, SHIP_PX_PER_CM, FUNNEL_CROPS, FUNNEL_TOP, FUNNEL_BOTTOM, VOLVELLE, DIAL_STOPS, DECK_TONES, loadImage, isFunnelBuff, PLATE_TOP_OF_FUNNEL_AREA, PLATE_BELOW_DECK_Y,
  paintDeck, hullPaint, paintSlider, paintFlapFront, paintArch, paintWheel,
} from './art1.js';
import { paintWheelhouse } from './wheelhouse.js';

const SHIP_SCALE = 0.92;
const SHIP_CENTER_X = 5;
const SEA_TONES_FAR = ['#5a8794', '#46778a', '#386880', '#2c5873', '#214761', '#183a52'];
const SEA_TONES_NEAR = ['#7fb0b6', '#5f9aa6', '#4a8896'];
const SEA_TONES_FOAM = ['#9cc6c4', '#78acb0'];

function paintSolid(widthCm, lengthCm, color, seed, stripe = null) {
  const pixelsPerCm = 40;
  const canvas = makeCanvas(widthCm * pixelsPerCm, lengthCm * pixelsPerCm);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, seed, [236, 226, 204], 5);
  wash(context, rectPath(0, 0, canvas.logicalWidth, canvas.logicalHeight), color, { seed, alpha: 0.95, layers: 2, pool: 0.3 });
  if (stripe) {
    context.fillStyle = stripe;
    context.fillRect(0, canvas.logicalHeight * 0.42, canvas.logicalWidth, canvas.logicalHeight * 0.16);
  }
  inkLine(context, [[0, 3], [canvas.logicalWidth, 3]], 3, seed, 0.3);
  return canvas;
}

// The hull strip that stands in front of the cutaway: raked ends, a window onto the boiler rooms.
function paintHullStrip(widthCm, heightCm, windowCm) {
  const pixels = 50;
  const width = widthCm * pixels;
  const height = heightCm * pixels;
  const canvas = makeCanvas(width, height, 2.5);
  const context = canvas.getContext('2d');
  context.save();
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(width, 0);
  context.lineTo(width - 3.2 * pixels, height);
  context.lineTo(4.6 * pixels, height);
  context.closePath();
  context.clip();
  hullPaint(context, 0, 0, width, height, 7);
  context.restore();
  const windowX = width / 2 + windowCm.left * pixels;
  const windowY = height - windowCm.top * pixels;
  const windowWidth = (windowCm.right - windowCm.left) * pixels;
  const windowHeight = (windowCm.top - windowCm.bottom) * pixels;
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  context.fillRect(windowX, windowY, windowWidth, windowHeight);
  context.restore();
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.strokeRect(windowX, windowY, windowWidth, windowHeight);
  return canvas;
}

// A silhouette cut from the ship wall's alpha, filled by `paint`: the port wall has the same outline as the cutaway.
function paintSilhouette(wallCanvas, widthCm, heightCm, paint) {
  const pixels = 50;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  context.drawImage(wallCanvas, 0, 0, canvas.logicalWidth, canvas.logicalHeight);
  context.globalCompositeOperation = 'source-in';
  paint(context, canvas.logicalWidth, canvas.logicalHeight);
  return canvas;
}

function paintHullEnd(widthCm, heightCm) {
  const pixels = 50;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, 77, [236, 226, 204], 4);
  hullPaint(context, 0, 0, canvas.logicalWidth, canvas.logicalHeight, 11);
  return canvas;
}

function paintFloor(width, height) {
  const canvas = makeCanvas(width, height, 3);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 51);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(70,120,140,0.7)');
  gradient.addColorStop(0.5, 'rgba(110,160,170,0.45)');
  gradient.addColorStop(0.62, 'rgba(150,190,190,0.12)');
  gradient.addColorStop(1, 'rgba(150,190,190,0)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  const random = seededRandom(14);
  for (let mark = 0; mark < 90; mark += 1) {
    const x = random() * width;
    const y = random() * height * 0.55;
    inkLine(context, [[x, y], [x + 24, y - 8], [x + 52, y]], 2.2, mark, 0.4, 'rgba(61,38,21,0.45)');
  }
  const centerX = floorX(VOLVELLE.x);
  const centerY = floorZ(VOLVELLE.z);
  const baseRadius = VOLVELLE.baseRadius * PIXELS_PER_CM;
  wash(context, (ctx) => ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2), '#efe3c4', { seed: 2, alpha: 1, layers: 1, pool: 0.6, poolWidth: 5 });
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
  context.stroke();
  DIAL_STOPS.forEach((stop, index) => {
    const bearing = (index / DIAL_STOPS.length) * Math.PI * 2;
    const upsideDown = Math.cos(bearing) < -0.15;
    const place = (radiusCm, draw) => {
      context.save();
      context.translate(centerX + Math.sin(bearing) * radiusCm * PIXELS_PER_CM, centerY - Math.cos(bearing) * radiusCm * PIXELS_PER_CM);
      context.rotate(bearing + (upsideDown ? Math.PI : 0));
      context.textAlign = 'center';
      draw();
      context.restore();
    };
    wash(context, (ctx) => { ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, baseRadius * 0.99, bearing - Math.PI / 2 - Math.PI / 8 + 0.03, bearing - Math.PI / 2 + Math.PI / 8 - 0.03); ctx.closePath(); }, DECK_TONES[index], { seed: index, alpha: 0.35, layers: 1, pool: 0.3 });
    place(11.1, () => { context.font = `700 44px ${SERIF}`; context.fillStyle = INK; context.fillText(stop.deck, 0, 14); });
    // the readout must fit inside the wheel's window (about 4 cm wide here), so each line shrinks until it does
    const fitted = (weight, size, text, maxWidth) => {
      let fontSize = size;
      context.font = `${weight} ${fontSize}px ${SERIF}`;
      while (context.measureText(text).width > maxWidth && fontSize > 12) {
        fontSize -= 1;
        context.font = `${weight} ${fontSize}px ${SERIF}`;
      }
    };
    place(6.4, () => {
      context.fillStyle = INK;
      fitted('700', 46, stop.figure, 150);
      context.fillText(stop.figure, 0, 0);
      fitted('italic 400', 32, stop.unit, 150);
      context.fillText(stop.unit, 0, 36);
    });
  });
  return canvas;
}

export async function buildTitanic(renderer) {
  const shipImage = await loadImage('tex/ship-side.png');
  const texts = {
    slider: 'Pull the brass ring right. The hull plate slides over the hull strip on the same card, so it moves without lifting. The window behind it is a recessed box that shows the boiler rooms: 29 boilers.',
    flap: 'Lift the bridge. The flap is hinged along its top edge; a patch under it is glued to the ship card and shows the wheelhouse, with the wheel, telegraphs and compass.',
  };
  const toTexture = (canvas) => canvasToTexture(THREE, canvas, renderer);
  const pageWidth = PAGE_WIDTH * PIXELS_PER_CM;
  const pageHeight = PAGE_DEPTH * PIXELS_PER_CM;
  const backdrop = paintNightSky(pageWidth, pageHeight, { title: 'RMS Titanic', subtitle: 'Sunday 14 April 1912, the North Atlantic, a clear and moonless night' });
  const floor = paintFloor(pageWidth, pageHeight);

  // the ship wall: the plate view with its funnels cut out (they stand up as V-folds)
  const wallCanvas = makeCanvas(SHIP_CROP.width, SHIP_CROP.height, 1);
  const wallContext = wallCanvas.getContext('2d', { willReadFrequently: true });
  wallContext.drawImage(shipImage, SHIP_CROP.x, SHIP_CROP.y, SHIP_CROP.width, SHIP_CROP.height, 0, 0, SHIP_CROP.width, SHIP_CROP.height);
  const wallPicture = wallContext.getImageData(0, 0, SHIP_CROP.width, SHIP_CROP.height);
  const data = wallPicture.data;
  for (let y = 0; y < SHIP_CROP.height; y += 1) {
    for (let x = 0; x < SHIP_CROP.width; x += 1) {
      const index = (y * SHIP_CROP.width + x) * 4;
      const sourceX = x + SHIP_CROP.x;
      const sourceY = y + SHIP_CROP.y;
      const nearBottom = sourceY > PLATE_BELOW_DECK_Y;
      if (nearBottom && data[index] > 185 && data[index + 1] > 185 && data[index + 2] > 175) data[index + 3] = 0;
      if (sourceY < PLATE_TOP_OF_FUNNEL_AREA && FUNNEL_CROPS.some(([from, to]) => sourceX > from - 20 && sourceX < to + 20) && isFunnelBuff(data[index], data[index + 1], data[index + 2])) data[index + 3] = 0;
    }
  }
  wallContext.putImageData(wallPicture, 0, 0);
  const shipWidth = (SHIP_CROP.width / SHIP_PX_PER_CM) * SHIP_SCALE;
  const shipHeight = (SHIP_CROP.height / SHIP_PX_PER_CM) * SHIP_SCALE;
  const shipHalf = shipWidth / 2;
  const hullHeight = 3.3;
  const icebergWidth = 12;
  const icebergX = -PAGE_WIDTH / 2 + icebergWidth / 2;

  // ---- layers, rearmost first: each roof is tied to the wall of the layer it names in `behind` ----
  const horizon = new Layer({
    name: 'horizon', depth: 1.2, height: 14.6, wallWidth: 82, order: 0, lag: 0,
    wall: makeCutout({ width: 82, length: 14.6, texture: toTexture(paintSeaWall(82, 14.6, { startCm: 0, tones: SEA_TONES_FAR, seed: 5, crestDropCm: 0.14, amplitudeCm: 0.12, wavelengthCm: 9 })) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(82, 1.2, { tone: '#27506a', light: '#3d6a82' }))),
  });
  const portWall = new Layer({
    name: 'port', depth: 6.4, height: shipHeight, wallWidth: shipWidth, x: SHIP_CENTER_X, behind: horizon, lag: 0.05, order: 1,
    wall: makeCutout({
      width: shipWidth, length: shipHeight, thick: 0.1,
      texture: toTexture(paintSilhouette(wallCanvas, shipWidth, shipHeight, (context, width, height) => { context.fillStyle = '#5b3f28'; context.fillRect(0, 0, width, height); hatch(context, 0, 0, width, height, 10, 0.25, 6); })),
      backTexture: toTexture(paintSilhouette(wallCanvas, shipWidth, shipHeight, (context, width, height) => hullPaint(context, 0, 0, width, height, 7))),
    }),
    roofFront: paperMaterial(toTexture(paintSeaTop(shipWidth, 6.4, { startCm: SHIP_CENTER_X - shipHalf, tone: '#27506a', light: '#3f6d84', seed: 6 }))),
  });
  const cheekHull = new THREE.MeshStandardMaterial({ map: toTexture(paintHullEnd(6.2, shipHeight)), roughness: 0.9, side: THREE.DoubleSide });
  const shipLayer = new Layer({
    name: 'ship', depth: 12.6, height: shipHeight, wallWidth: shipWidth, x: SHIP_CENTER_X, behind: portWall, lag: 0.09, order: 2,
    wall: makeCutout({ width: shipWidth, length: shipHeight, texture: toTexture(wallCanvas) }),
    roofFront: paperMaterial(toTexture(paintDeck(shipWidth * 40, 6.2 * 40))),
    cheekMaterial: cheekHull,
  });
  const windowCm = { left: -11.2, right: 12.4, bottom: 0.3, top: 3.0 };
  const cheekStrip = new THREE.MeshStandardMaterial({ map: toTexture(paintHullEnd(1.6, hullHeight)), roughness: 0.9, side: THREE.DoubleSide });
  const hullLayer = new Layer({
    name: 'hull', depth: 14.2, height: hullHeight, wallWidth: shipWidth, x: SHIP_CENTER_X, behind: shipLayer, lag: 0.09, order: 3,
    wall: makeCutout({ width: shipWidth, length: hullHeight, texture: toTexture(paintHullStrip(shipWidth, hullHeight, windowCm)) }),
    roofFront: paperMaterial(toTexture(paintSolid(shipWidth, 1.6, '#8d2b22', 8, '#c8a04a'))),
    cheekMaterial: cheekStrip,
  });
  // the berg is three cut-outs at different depths (a tall far peak, the main mass, a near shard): no roofs and no cheeks,
  // so nothing but ice shows
  const bergProfile = {
    far: [[0.03, 0.9], [0.06, 0.6], [0.14, 0.45], [0.22, 0.3], [0.3, 0.1], [0.38, 0.02], [0.46, 0.12], [0.54, 0.08], [0.62, 0.3], [0.7, 0.4], [0.8, 0.5], [0.9, 0.66], [0.97, 0.9]],
    main: [[0.02, 0.9], [0.03, 0.62], [0.08, 0.46], [0.15, 0.36], [0.2, 0.2], [0.27, 0.12], [0.33, 0.2], [0.4, 0.05], [0.5, 0.02], [0.57, 0.14], [0.65, 0.12], [0.72, 0.28], [0.8, 0.3], [0.88, 0.45], [0.95, 0.62], [0.98, 0.9]],
    shard: [[0.03, 0.9], [0.06, 0.55], [0.14, 0.35], [0.24, 0.1], [0.34, 0.18], [0.42, 0.4], [0.54, 0.3], [0.64, 0.5], [0.78, 0.58], [0.9, 0.72], [0.97, 0.9]],
  };
  const bergFarWidth = 8.4;
  const bergFar = new Layer({
    name: 'berg-far', depth: 7.6, height: 13, wallWidth: bergFarWidth, x: -PAGE_WIDTH / 2 + bergFarWidth / 2 + 0.6, behind: horizon, lag: 0.07, order: 1, hideRoof: true,
    wall: makeCutout({ width: bergFarWidth, length: 13, texture: toTexture(paintIceberg(bergFarWidth, 13, { profile: bergProfile.far, seed: 5 })) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(bergFarWidth, 6.4, { tone: '#27506a', light: '#3d6a82', seed: 9 }))),
  });
  const iceberg = new Layer({
    name: 'iceberg', depth: 11, height: 10, wallWidth: icebergWidth, x: icebergX, behind: bergFar, lag: 0.1, order: 2, hideRoof: true,
    wall: makeCutout({ width: icebergWidth, length: 10, texture: toTexture(paintIceberg(icebergWidth, 8.6, { profile: bergProfile.main, seed: 3 })) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(icebergWidth, 3.4, { tone: '#27506a', light: '#3d6a82', seed: 9 }))),
  });
  const bergShardWidth = 6.2;
  const bergShard = new Layer({
    name: 'berg-shard', depth: 13.6, height: 6.4, wallWidth: bergShardWidth, x: -PAGE_WIDTH / 2 + bergShardWidth / 2 + 0.2, behind: iceberg, lag: 0.12, order: 3, hideRoof: true,
    wall: makeCutout({ width: bergShardWidth, length: 6.4, texture: toTexture(paintIceberg(bergShardWidth, 6.4, { profile: bergProfile.shard, seed: 8 })) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(bergShardWidth, 2.6, { tone: '#27506a', light: '#3d6a82', seed: 9 }))),
  });
  const seaSlice = (name, x, width, depth, height, behind, lag, order, tones, foam, seed) => new Layer({
    name, depth, height, wallWidth: width, x, behind, lag, order,
    wall: makeCutout({ width, length: height, texture: toTexture(paintSeaWall(width, height, { startCm: x - width / 2, tones, seed: 21, crestDropCm: foam ? 0.4 : 0.45, amplitudeCm: foam ? 0.26 : 0.32, foam, wavelengthCm: 4.2, glints: !foam })) }),
    roofFront: paperMaterial(toTexture(paintSeaTop(width, depth - behind.depth, { startCm: x - width / 2, tone: '#3d7285', light: '#69a0ac', seed }))),
    cheekMaterial: new THREE.MeshStandardMaterial({ color: 0x4f8896, roughness: 0.95, side: THREE.DoubleSide }),
  });
  const waveNear = seaSlice('wave-near', SHIP_CENTER_X, shipWidth, 16.9, 1.5, hullLayer, 0.17, 4, SEA_TONES_NEAR, false, 3);
  const waveBow = seaSlice('wave-bow', icebergX, icebergWidth, 16.9, 1.5, iceberg, 0.17, 4, SEA_TONES_NEAR, false, 4);
  const foamNear = seaSlice('foam-near', SHIP_CENTER_X, shipWidth, 19.5, 0.95, waveNear, 0.22, 5, SEA_TONES_FOAM, true, 5);
  const foamBow = seaSlice('foam-bow', icebergX, icebergWidth, 19.5, 0.95, waveBow, 0.22, 5, SEA_TONES_FOAM, true, 6);
  const layers = [horizon, portWall, shipLayer, hullLayer, bergFar, iceberg, bergShard, waveNear, waveBow, foamNear, foamBow];

  // ---- hull plate that slides across the window, and the recessed boiler box behind the window ----
  const sliderWidth = 27.8 * SHIP_SCALE;
  const sliderHeight = 3.0;
  const slider = makeCard({ width: sliderWidth, length: sliderHeight, thick: 0.1, front: paperMaterial(toTexture(paintSlider(sliderWidth, sliderHeight))) });
  slider.userData.handle = { kind: 'slider' };
  slider.position.set(0, 0.35, 0.14);
  hullLayer.frame.add(slider);
  const sliderTravel = 23;
  const sliderHome = (windowCm.left + windowCm.right) / 2;
  const recess = new THREE.Group();
  const recessMaterial = new THREE.MeshStandardMaterial({ color: 0x7a4624, roughness: 1, emissive: 0x4a2208 });
  const windowWidth = windowCm.right - windowCm.left;
  const windowHeight = windowCm.top - windowCm.bottom;
  for (const [width, height, x, y] of [
    [windowWidth, 0.08, sliderHome, windowCm.top], [windowWidth, 0.08, sliderHome, windowCm.bottom],
    [0.08, windowHeight, windowCm.left, (windowCm.top + windowCm.bottom) / 2], [0.08, windowHeight, windowCm.right, (windowCm.top + windowCm.bottom) / 2],
  ]) {
    const reveal = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1).translate(0, 0, -0.5), recessMaterial);
    reveal.position.set(x, y, 0);
    reveal.castShadow = true;
    reveal.receiveShadow = true;
    recess.add(reveal);
  }
  hullLayer.frame.add(recess);
  // how far behind the hull wall the ship wall lies at the window's top and bottom edges: the recess reaches it
  const recessDepth = () => {
    const hullDirection = direction(hullLayer.psi);
    const shipDirection = direction(shipLayer.psi);
    const normal = { y: -hullDirection.z, z: hullDirection.y };
    let nearest = Infinity;
    for (const along of [windowCm.bottom, windowCm.top]) {
      const point = { y: along * hullDirection.y, z: hullLayer.depth + along * hullDirection.z - shipLayer.depth };
      const crossPoint = point.y * shipDirection.z - point.z * shipDirection.y;
      const crossNormal = normal.y * shipDirection.z - normal.z * shipDirection.y;
      if (Math.abs(crossNormal) > 1e-4) nearest = Math.min(nearest, crossPoint / crossNormal);
    }
    return Number.isFinite(nearest) ? nearest : 0;
  };

  // ---- bridge flap and the Grand Staircase tunnel on the ship wall ----
  const flapWidth = 5.6 * SHIP_SCALE;
  const flapHeight = 2.0;
  const flapX = 20.65 * SHIP_SCALE;
  const flapPivot = new THREE.Group();
  flapPivot.position.set(flapX, shipHeight - 0.02, 0.12);
  const flap = makeCard({ width: flapWidth, length: flapHeight, thick: 0.08, hangs: true, front: paperMaterial(toTexture(paintFlapFront(flapWidth, flapHeight))), back: toTexture(paintWheelhouse(flapWidth, flapHeight)) });
  flap.userData.handle = { kind: 'flap' };
  flapPivot.add(flap);
  shipLayer.frame.add(flapPivot);
  const patch = makeCard({ width: flapWidth, length: flapHeight, thick: 0.04, hangs: true, front: paperMaterial(toTexture(paintWheelhouse(flapWidth, flapHeight))) });
  patch.position.set(flapX, shipHeight - 0.02, 0.06);
  shipLayer.frame.add(patch);
  const arches = [];
  [[4.6, 5.9, 0.35, 0.5], [4.2, 5.4, 0.7, 0.43], [3.7, 4.9, 1.05, 0.36]].forEach(([width, height, offset, ring]) => {
    const arch = makeCutout({ width: width * SHIP_SCALE * 0.85, length: height * SHIP_SCALE * 0.85, texture: toTexture(paintArch(width, height, ring)), thick: 0.08 });
    arch.position.set(10.0 * SHIP_SCALE, hullHeight + 0.3, 0.1);
    arch.userData.offset = offset;
    shipLayer.frame.add(arch);
    arches.push(arch);
  });

  // ---- funnels: V-folds on the deck, each with a paper smoke curl ----
  const funnelTexture = (index) => {
    const [from, to] = FUNNEL_CROPS[index];
    const canvas = makeCanvas(to - from, FUNNEL_BOTTOM - FUNNEL_TOP, 1);
    canvas.getContext('2d').drawImage(shipImage, from, FUNNEL_TOP, to - from, FUNNEL_BOTTOM - FUNNEL_TOP, 0, 0, to - from, FUNNEL_BOTTOM - FUNNEL_TOP);
    return toTexture(canvas);
  };
  const funnelHeight = ((FUNNEL_BOTTOM - FUNNEL_TOP) / SHIP_PX_PER_CM) * SHIP_SCALE;
  const smokes = [];
  const funnels = FUNNEL_CROPS.map(([from, to], index) => {
    const width = ((to - from) / SHIP_PX_PER_CM) * SHIP_SCALE;
    const x = SHIP_CENTER_X + (((from + to) / 2 - SHIP_CROP.x) / SHIP_PX_PER_CM) * SHIP_SCALE - shipHalf;
    const panelA = makeCutout({ width, length: funnelHeight, texture: funnelTexture(index), thick: 0.08 });
    const smoke = makeCutout({ width: 7.4, length: 4.6, texture: toTexture(paintSmoke(7.4, 4.6, 3 + index * 5)), thick: 0.06 });
    smoke.position.set(2.5, funnelHeight - 0.5, 0.05 + index * 0.04);
    panelA.add(smoke);
    smokes.push(smoke);
    return new VFold({ layer: shipLayer, x, width, hingeAlong: 3.1, backAlong: 0, panelLength: funnelHeight, panelA, order: index, riseFrom: 0.45 + index * 0.08, riseTo: 1.35 + index * 0.08 });
  });

  // ---- lecterns: the short specialist texts, printed on small booklet flaps on the lower leaf ----
  const lecternDefinitions = [
    { x: -32, heading: 'Four, not five', accent: '#e6c796', body: 'She could float with four compartments flooded. The iceberg opened five, and water spilled over the bulkheads.' },
    { x: -13.4, heading: '29 boilers', accent: '#d9a58a', body: '159 furnaces. Over 600 tonnes of coal a day, shovelled by 176 firemen.' },
    { x: 6.4, heading: 'Piston and turbine', accent: '#a9c3c4', body: 'Two engines made 30,000 hp. A turbine on their spent steam added 16,000 hp.' },
  ];
  const lecterns = lecternDefinitions.map((definition, index) => {
    const lectern = makeLectern({ width: 17.4, slopeLength: 7.6, angleDegrees: 36, texture: toTexture(paintLecternCard(17.4, 7.6, definition.heading, definition.body, definition.accent)) });
    lectern.position.set(definition.x, 0.02, 37);
    lectern.userData.assembly = `lectern-${index}`;
    return lectern;
  });

  // ---- volvelle ----
  const wheelTexture = toTexture(paintWheel(1024));
  const wheel = new THREE.Group();
  wheel.userData.assembly = 'wheel';
  const wheelSpin = new THREE.Group();
  const wheelFront = new THREE.Mesh(new THREE.CircleGeometry(VOLVELLE.wheelRadius, 96), new THREE.MeshStandardMaterial({ map: wheelTexture, roughness: 0.92, alphaTest: 0.45 }));
  const wheelBack = new THREE.Mesh(new THREE.CircleGeometry(VOLVELLE.wheelRadius, 96), new THREE.MeshStandardMaterial({ map: wheelTexture, color: 0x8a7d66, roughness: 1, alphaTest: 0.45, side: THREE.BackSide }));
  wheelFront.position.z = 0.07;
  wheelBack.position.z = -0.07;
  wheelFront.castShadow = true;
  wheelFront.receiveShadow = true;
  wheelBack.castShadow = true;
  wheelFront.userData.handle = { kind: 'wheel' };
  wheelSpin.add(wheelFront, wheelBack);
  const grommet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 24), new THREE.MeshStandardMaterial({ color: 0xb8923e, metalness: 0.6, roughness: 0.4 }));
  grommet.rotation.x = Math.PI / 2;
  wheelSpin.add(grommet);
  wheel.add(wheelSpin);
  wheel.rotation.x = -Math.PI / 2;
  wheel.position.set(VOLVELLE.x, 0.12, VOLVELLE.z);

  const root = new THREE.Group();
  for (const layer of layers) root.add(layer.root);
  for (const funnel of funnels) root.add(funnel.root);
  for (const lectern of lecterns) root.add(lectern);
  root.add(wheel);

  const state = { slide: 0, flap: 0, wheelStop: 0, wheelAngle: 0 };
  const spread = {
    name: 'titanic',
    backdrop,
    floor,
    root,
    layers,
    folds: funnels,
    state,
    handles: { slider, flap, wheel: wheelFront },
    frames: { hull: hullLayer.frame, flapPivot, wheel },
    sliderTravel,
    sliderHome,
    update(psi, farShift) {
      for (const layer of layers) layer.update(psi, farShift);
      for (const funnel of funnels) funnel.update(psi);
      const stand = Math.sin(psi);
      for (const arch of arches) arch.position.z = 0.1 + arch.userData.offset * stand;
      recess.scale.z = Math.max(0.001, recessDepth() - 0.06);
      const grow = smoothstep((psi - 1.0) / 0.95);
      for (const smoke of smokes) smoke.scale.setScalar(Math.max(0.001, grow));
      const lift = smoothstep(psi / 0.9);
      for (const lectern of lecterns) lectern.setStand(lift);
    },
    setSlide(value) {
      state.slide = Math.min(1, Math.max(0, value));
      slider.position.x = sliderHome + state.slide * sliderTravel;
    },
    setFlap(value) {
      state.flap = Math.min(1, Math.max(0, value));
      flapPivot.rotation.x = -state.flap * (105 * Math.PI) / 180;
    },
    setWheelAngle(angle) {
      state.wheelAngle = angle;
      wheelSpin.rotation.z = angle;
    },
    currentStop() {
      const turns = Math.round((-state.wheelAngle / (Math.PI * 2)) * DIAL_STOPS.length);
      return ((turns % DIAL_STOPS.length) + DIAL_STOPS.length) % DIAL_STOPS.length;
    },
    caption(kind) {
      if (kind === 'slider') return { heading: 'Pull tab', body: texts.slider };
      if (kind === 'flap') return { heading: 'Lift flap', body: texts.flap };
      const stop = DIAL_STOPS[this.currentStop()];
      return { heading: stop.deck, body: stop.fact };
    },
    hints: 'Drag the brass ring, lift the bridge, turn the wheel.',
  };
  spread.setSlide(0);
  spread.setFlap(0);
  return spread;
}
