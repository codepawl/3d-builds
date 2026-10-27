// Spread 1: RMS Titanic. Textures are the plate renderer's side view (cut out of its paper) plus drawn card art.
import * as THREE from 'three';
import {
  INK, SERIF, SMALL_CAPS, makeCanvas, paintPaper, wash, rectPath, polygonPath, inkLine, inkPolygon, hatch, paragraph, note,
  softBlob, paintWaves, seededRandom, canvasToTexture, addGrain,
} from './paint.js';
import { Layer, VFold, makeCard, makeCutout, paperMaterial } from './pop.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM, floorX, floorZ } from './config.js';

// Pixel coordinates in tex/ship-side.png, rendered by tools/capture-plate.mjs at 3x device pixels (11520 x 3300).
export const SHIP_CROP = { x: 291, y: 1000, width: 11200, height: 1367 };
export const SHIP_PX_PER_CM = SHIP_CROP.width / 74;
export const FUNNEL_CROPS = [[3020, 3510], [4085, 4575], [5147, 5637], [6209, 6699]];
export const FUNNEL_TOP = 175;
export const FUNNEL_BOTTOM = 1058;
export const PLATE_TOP_OF_FUNNEL_AREA = 1205;
export const PLATE_BELOW_DECK_Y = 1822;
export const VOLVELLE = { x: 27.5, z: 31.8, wheelRadius: 10, baseRadius: 12 };
export const SHIP_CROP_EXPORT = null;

export const DIAL_STOPS = [
  { deck: 'Boat deck', figure: '20 boats', unit: 'for 2,208 aboard', fact: 'Boat deck. Twenty lifeboats (14 wooden, 4 collapsible, 2 emergency cutters) had room for 1,178 of the 2,208 people aboard. The 16 sets of davits could have handled 48 boats.' },
  { deck: 'A deck', figure: '166 m', unit: 'promenade', fact: 'A deck. The first class promenade ran the whole 546 ft (166 m) of the superstructure, past the reading and writing room, lounge, smoke room and Palm Court.' },
  { deck: 'D deck', figure: '8 of 15', unit: 'bulkheads reach D', fact: 'D deck. The highest level the watertight bulkheads reached, and only eight of the fifteen got that high. When the bow went down, water spilled over the tops of the others, one compartment into the next.' },
  { deck: 'E deck', figure: 'Scotland Rd', unit: 'crew and 3rd class', fact: 'E deck. A long passageway nicknamed Scotland Road ran along it, used by third class passengers and crew.' },
  { deck: 'G deck', figure: 'lowest', unit: 'portholes', fact: 'G deck. The lowest portholes, just above the waterline. The first class squash court and the travelling post office were here; partial orlop decks lay over the boiler, engine and turbine rooms.' },
  { deck: 'Boilers', figure: '29 boilers', unit: '159 furnaces', fact: 'Boiler rooms. 29 boilers (24 double-ended, 5 single-ended) with 159 furnaces, each boiler 4.80 m across and 6.1 m long. Over 600 tonnes of coal a day went in by hand, 176 firemen, and 100 tonnes of ash a day into the sea. Working pressure about 215 psi: recalled, not verified.' },
  { deck: 'Engines', figure: '46,000 hp', unit: '30,000 + 16,000', fact: 'Engine rooms. Two four-cylinder triple-expansion engines, 63 ft long and 720 tonnes each, gave 30,000 hp together and drove the outer propellers; a central low-pressure Parsons turbine gave 16,000 hp.' },
  { deck: 'Tank top', figure: 'double', unit: 'bottom', fact: 'Tank top. The inner bottom of the hull, the platform that carried the boilers, engines, turbines and generators. Beneath it lay the water and ballast tanks of the double bottom.' },
];
export const DECK_TONES = ['#e9dcb5', '#e3c98e', '#d9a04e', '#a8743c', '#6f9aa0', '#c4552b', '#8a8f93', '#40517a'];

export async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function isFunnelBuff(red, green, blue) {
  return red > 130 && green > 90 && blue < 125 && red - blue > 55;
}

export function paintCover(width, height) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#1f2a2c';
  context.fillRect(0, 0, width, height);
  const random = seededRandom(9);
  context.globalAlpha = 0.07;
  for (let row = 0; row < height; row += 3) {
    context.fillStyle = random() < 0.5 ? '#000' : '#6b8a85';
    context.fillRect(0, row, width, 1);
  }
  for (let column = 0; column < width; column += 3) {
    context.fillStyle = random() < 0.5 ? '#000' : '#6b8a85';
    context.fillRect(column, 0, 1, height);
  }
  context.globalAlpha = 1;
  addGrain(context, 0, 0, width, height, 6, 4);
  const gold = '#c8a45a';
  context.fillStyle = gold;
  context.textAlign = 'center';
  context.font = `${190}px ${SMALL_CAPS}`;
  context.fillText('How Big Things Work', width / 2, height * 0.42);
  context.font = `italic 400 70px ${SERIF}`;
  context.fillText('a pop-up book of cutaways, with the real numbers', width / 2, height * 0.42 + 120);
  // ratchet wheel and pawl, stamped
  const centerX = width / 2;
  const centerY = height * 0.7;
  context.strokeStyle = gold;
  context.lineWidth = 6;
  const teeth = 18;
  context.beginPath();
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const angle = (tooth / teeth) * Math.PI * 2;
    const next = ((tooth + 0.85) / teeth) * Math.PI * 2;
    context.lineTo(centerX + Math.cos(angle) * 150, centerY + Math.sin(angle) * 150);
    context.lineTo(centerX + Math.cos(next) * 150, centerY + Math.sin(next) * 150);
    context.lineTo(centerX + Math.cos(next) * 120, centerY + Math.sin(next) * 120);
    context.lineTo(centerX + Math.cos((tooth + 1) / teeth * Math.PI * 2) * 120, centerY + Math.sin((tooth + 1) / teeth * Math.PI * 2) * 120);
  }
  context.closePath();
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, 38, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(centerX + 190, centerY - 95);
  context.lineTo(centerX + 168, centerY - 40);
  context.lineTo(centerX + 128, centerY - 125 + 40);
  context.stroke();
  return canvas;
}

export function paintColophon(width, height) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 31);
  context.font = `130px ${SMALL_CAPS}`;
  context.fillStyle = INK;
  context.fillText('Sources', 140, 260);
  const left = 140;
  const column = 1450;
  let cursor = note(context, left, 340, column, 'Titanic', 'Dimensions, compartments, bulkhead heights, boilers, coal, engines, lifeboats and decks come from the English Wikipedia article "Titanic", read as plain text on 2026-10-27. Room positions in the cutaway are our own placement, not a Harland and Wolff plan. The 215 psi boiler pressure is recalled and not verified.', 1.1);
  cursor = note(context, left, cursor + 50, column, 'Power station', 'Efficiency figures (35 to 38 % at 170 bar and 570 degrees C, 36 to 40 % subcritical, 46 % best fossil) and the 50 or 60 Hz grid frequency come from the Wikipedia articles "Thermal power station" and "Utility frequency". The four Rankine processes come from "Rankine cycle". The 3,000 and 3,600 rpm figures are our arithmetic (rpm = 120 f / poles for a two-pole machine).', 1.1);
  note(context, 1850, 340, 1300, 'How the paper works', 'Each standing piece is a linkage between the two leaves: a wall hinged on the lower leaf, tied back to the upper leaf by a platform that always stays parallel to the lower one. Funnels, the stack and the cooling tower are V-folds: two equal panels meeting at an apex. All of them fold flat when the book closes.', 1.1);
  return canvas;
}

export function paintDeck(width, height) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 12, [226, 196, 140], 6);
  wash(context, rectPath(0, 0, width, height), '#c9a06a', { seed: 3, alpha: 0.5, pool: 0.3 });
  const random = seededRandom(5);
  for (let row = 12; row < height; row += 14) inkLine(context, [[0, row], [width, row]], 1.2, 40 + row, 0.3);
  for (let seam = 0; seam < 120; seam += 1) {
    const x = random() * width;
    const y = Math.floor(random() * (height / 14)) * 14;
    inkLine(context, [[x, y], [x, y + 14]], 1.2, seam, 0.3);
  }
  // lifeboats seen from above
  for (const boatX of [0.07, 0.15, 0.31, 0.39, 0.55, 0.63, 0.8, 0.88]) {
    for (const rowY of [0.22, 0.82]) {
      const x = boatX * width;
      const y = rowY * height;
      wash(context, (ctx) => ctx.ellipse(x, y, 34, 15, 0, 0, Math.PI * 2), '#f1e6c8', { seed: x, alpha: 0.95, layers: 1, pool: 0.5 });
      context.beginPath();
      context.ellipse(x, y, 34, 15, 0, 0, Math.PI * 2);
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.stroke();
    }
  }
  return canvas;
}

export function hullPaint(context, x, y, width, height, seed) {
  // upper navy, lower red, a gold sheer stripe, rivet seams and portholes
  const split = height * 0.55;
  wash(context, rectPath(x, y, width, split), '#2e3150', { seed, alpha: 0.95, layers: 2, pool: 0.4 });
  wash(context, rectPath(x, y + split, width, height - split), '#8d2b22', { seed: seed + 1, alpha: 0.95, layers: 2, pool: 0.4 });
  context.fillStyle = '#c8a04a';
  context.fillRect(x, y + 3, width, 5);
  hatch(context, x, y + split, width, height - split, 9, 0.28, seed + 2);
  for (let seam = x + 90; seam < x + width; seam += 160) inkLine(context, [[seam, y], [seam, y + height]], 1.4, seam, 0.4);
  for (let porthole = x + 70; porthole < x + width - 40; porthole += 130) {
    context.beginPath();
    context.arc(porthole, y + split * 0.45, 10, 0, Math.PI * 2);
    context.fillStyle = '#d9b563';
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 2.4;
    context.stroke();
  }
}

export function paintSlider(widthCm, heightCm) {
  const pixels = 50;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels, 2.5);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, 21, [225, 214, 190], 3);
  hullPaint(context, 0, 0, canvas.logicalWidth, canvas.logicalHeight, 17);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.logicalWidth - 4, canvas.logicalHeight - 4);
  // finger pull: a brass ring and an arrow
  context.beginPath();
  context.arc(canvas.logicalWidth - 60, canvas.logicalHeight / 2, 24, 0, Math.PI * 2);
  context.fillStyle = '#d9b563';
  context.fill();
  context.stroke();
  context.fillStyle = '#e9dcb5';
  context.font = `italic 400 44px ${SERIF}`;
  context.fillText('pull →', canvas.logicalWidth / 2 - 40, canvas.logicalHeight / 2 + 14);
  return canvas;
}

export function paintFlapFront(widthCm, heightCm) {
  const pixels = 120;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels, 4);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, 41, [236, 226, 200], 4);
  wash(context, rectPath(0, 0, canvas.logicalWidth, canvas.logicalHeight), '#efe6cf', { seed: 5, alpha: 0.9, layers: 1, pool: 0.6 });
  const windows = 6;
  for (let index = 0; index < windows; index += 1) {
    const x = canvas.logicalWidth * (0.08 + (index / windows) * 0.88);
    wash(context, rectPath(x, canvas.logicalHeight * 0.3, canvas.logicalWidth * 0.09, canvas.logicalHeight * 0.42), '#3f5d68', { seed: index, alpha: 0.9, layers: 1, pool: 0.5 });
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.strokeRect(x, canvas.logicalHeight * 0.3, canvas.logicalWidth * 0.09, canvas.logicalHeight * 0.42);
  }
  inkLine(context, [[0, canvas.logicalHeight * 0.18], [canvas.logicalWidth, canvas.logicalHeight * 0.18]], 5, 4);
  inkLine(context, [[0, canvas.logicalHeight * 0.82], [canvas.logicalWidth, canvas.logicalHeight * 0.82]], 4, 6);
  context.fillStyle = '#7a5a3a';
  context.font = `italic 400 ${canvas.logicalHeight * 0.16}px ${SERIF}`;
  context.fillText('Bridge – lift', canvas.logicalWidth * 0.05, canvas.logicalHeight * 0.15);
  return canvas;
}

export function paintWheelhouse(widthCm, heightCm) {
  const pixels = 120;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels, 4);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.logicalWidth, canvas.logicalHeight, 43, [60, 44, 30], 4);
  wash(context, rectPath(0, 0, canvas.logicalWidth, canvas.logicalHeight), '#6b4528', { seed: 3, alpha: 0.9, layers: 2, pool: 0.5 });
  // night windows with a glow of lamp light
  const glow = context.createRadialGradient(canvas.logicalWidth * 0.5, canvas.logicalHeight * 0.65, 5, canvas.logicalWidth * 0.5, canvas.logicalHeight * 0.65, canvas.logicalWidth * 0.5);
  glow.addColorStop(0, 'rgba(255,190,90,0.85)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);
  // ship's wheel
  const wheelX = canvas.logicalWidth * 0.5;
  const wheelY = canvas.logicalHeight * 0.62;
  const radius = canvas.logicalHeight * 0.3;
  context.strokeStyle = '#d9b563';
  context.lineWidth = 9;
  context.beginPath();
  context.arc(wheelX, wheelY, radius, 0, Math.PI * 2);
  context.stroke();
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = (spoke / 8) * Math.PI * 2;
    context.beginPath();
    context.moveTo(wheelX, wheelY);
    context.lineTo(wheelX + Math.cos(angle) * radius * 1.22, wheelY + Math.sin(angle) * radius * 1.22);
    context.lineWidth = 6;
    context.stroke();
  }
  // telegraph and compass
  for (const [x, color] of [[0.18, '#c8a04a'], [0.82, '#c8a04a']]) {
    context.beginPath();
    context.arc(canvas.logicalWidth * x, canvas.logicalHeight * 0.6, canvas.logicalHeight * 0.17, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 4;
    context.stroke();
  }
  context.fillStyle = '#f1e6c8';
  context.font = `italic 400 ${canvas.logicalHeight * 0.17}px ${SERIF}`;
  context.fillText('wheelhouse', canvas.logicalWidth * 0.04, canvas.logicalHeight * 0.2);
  return canvas;
}

export function paintArch(widthCm, heightCm, ringCm) {
  const pixels = 100;
  const width = widthCm * pixels;
  const height = heightCm * pixels;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const archPath = (ctx, inset) => {
    const radius = width / 2 - inset;
    ctx.moveTo(inset, height);
    ctx.lineTo(inset, radius + inset);
    ctx.arc(width / 2, radius + inset, radius, Math.PI, 0);
    ctx.lineTo(width - inset, height);
    ctx.closePath();
  };
  context.beginPath();
  archPath(context, 0);
  context.fillStyle = '#8a5a2e';
  context.fill();
  hatch(context, 0, 0, width, height, 7, 0.22, 3);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.stroke();
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  archPath(context, ringCm * pixels);
  context.fill();
  context.restore();
  context.beginPath();
  archPath(context, ringCm * pixels);
  context.strokeStyle = '#d9b563';
  context.lineWidth = 3;
  context.stroke();
  return canvas;
}

export function paintWheel(size) {
  const canvas = makeCanvas(size, size, 3);
  const context = canvas.getContext('2d');
  const center = size / 2;
  const radius = size / 2 - 4;
  const perCm = radius / VOLVELLE.wheelRadius;
  paintPaper(context, size, size, 61, [238, 228, 204], 5);
  context.globalCompositeOperation = 'destination-in';
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = '#000';
  context.fill();
  context.globalCompositeOperation = 'source-over';
  DIAL_STOPS.forEach((stop, index) => {
    const start = (index / DIAL_STOPS.length) * Math.PI * 2 - Math.PI / 2 - Math.PI / 8;
    wash(context, (ctx) => { ctx.moveTo(center, center); ctx.arc(center, center, radius * 0.98, start, start + Math.PI / 4); ctx.closePath(); }, DECK_TONES[index], { seed: index + 20, alpha: 0.8, layers: 1, pool: 0.5, poolWidth: 3 });
    const middle = start + Math.PI / 8;
    inkLine(context, [[center + Math.cos(start) * radius * 0.25, center + Math.sin(start) * radius * 0.25], [center + Math.cos(start) * radius * 0.98, center + Math.sin(start) * radius * 0.98]], 2, index, 0.4);
    context.save();
    context.translate(center + Math.cos(middle) * radius * 0.2, center + Math.sin(middle) * radius * 0.2);
    context.restore();
  });
  wash(context, (ctx) => ctx.arc(center, center, radius * 0.26, 0, Math.PI * 2), '#efe3c4', { seed: 3, alpha: 1, layers: 1, pool: 0.6, poolWidth: 4 });
  context.fillStyle = INK;
  context.font = `italic 400 ${perCm * 0.62}px ${SERIF}`;
  context.textAlign = 'center';
  context.fillText('turn to a deck', center, center + perCm * 0.2);
  // pointer on the rim and the window over the fact ring
  context.beginPath();
  context.moveTo(center - perCm * 0.5, center - radius + 2);
  context.lineTo(center + perCm * 0.5, center - radius + 2);
  context.lineTo(center, center - radius - perCm * 0.1);
  context.closePath();
  context.fillStyle = '#7b2a20';
  context.fill();
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  const inner = perCm * 4.0;
  const outer = perCm * 8.3;
  const half = Math.PI / 6.6;
  context.arc(center, center, outer, -Math.PI / 2 - half, -Math.PI / 2 + half);
  context.arc(center, center, inner, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
  context.closePath();
  context.fill();
  context.restore();
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(center, center, outer, -Math.PI / 2 - half, -Math.PI / 2 + half);
  context.arc(center, center, inner, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
  context.closePath();
  context.stroke();
  return canvas;
}

