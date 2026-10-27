// Spread 1: RMS Titanic. Textures are the plate renderer's side view (cut out of its paper) plus drawn card art.
import * as THREE from 'three';
import {
  INK, SERIF, SMALL_CAPS, makeCanvas, paintPaper, wash, rectPath, polygonPath, inkLine, inkPolygon, hatch, paragraph, note,
  softBlob, paintWaves, seededRandom, canvasToTexture, addGrain,
} from './paint.js';
import { Layer, VFold, makeCard, makeCutout, paperMaterial } from './pop.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM, floorX, floorZ } from './config.js';

const SHIP_CROP = { x: 86, y: 384, width: 3489, height: 426 };
const SHIP_PX_PER_CM = SHIP_CROP.width / 74;
const FUNNEL_CROPS = [[937, 1089], [1273, 1425], [1605, 1757], [1939, 2083]];
const FUNNEL_TOP = 127;
const FUNNEL_BOTTOM = 402;
export const VOLVELLE = { x: 26, z: 31, wheelRadius: 9, baseRadius: 11 };

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
const DECK_TONES = ['#e9dcb5', '#e3c98e', '#d9a04e', '#a8743c', '#6f9aa0', '#c4552b', '#8a8f93', '#40517a'];

async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

function isFunnelBuff(red, green, blue) {
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

function paintDeck(width, height) {
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

function paintFunnel(image) {
  const width = FUNNEL_CROPS[0][1] - FUNNEL_CROPS[0][0];
  const height = FUNNEL_BOTTOM - FUNNEL_TOP;
  const canvas = makeCanvas(width, height);
  canvas.getContext('2d').drawImage(image, FUNNEL_CROPS[0][0], FUNNEL_TOP, width, height, 0, 0, width, height);
  return canvas;
}

function hullPaint(context, x, y, width, height, seed) {
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

function paintHullStrip(widthCm, heightCm, windowCm) {
  const pixels = 50;
  const width = widthCm * pixels;
  const height = heightCm * pixels;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const earPixels = 0.9 * pixels;
  context.save();
  context.beginPath();
  context.rect(earPixels, 0, width - earPixels * 2, height);
  context.clip();
  hullPaint(context, earPixels, 0, width - earPixels * 2, height, 7);
  context.restore();
  // paper tabs at both ends, where the struts are glued
  for (const tabX of [0, width - earPixels]) {
    wash(context, rectPath(tabX, 0, earPixels, pixels * 1.3), '#e6dac0', { seed: tabX, alpha: 1, layers: 1, pool: 0.5 });
  }
  // the window onto the boiler rooms, with the board's cut edge shaded
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
  context.lineWidth = 3;
  context.strokeRect(windowX, windowY, windowWidth, windowHeight);
  return canvas;
}

function paintSlider(widthCm, heightCm) {
  const pixels = 50;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.width, canvas.height, 21, [225, 214, 190], 3);
  hullPaint(context, 0, 0, canvas.width, canvas.height, 17);
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  // finger pull: a brass ring and an arrow
  context.beginPath();
  context.arc(canvas.width - 60, canvas.height / 2, 24, 0, Math.PI * 2);
  context.fillStyle = '#d9b563';
  context.fill();
  context.stroke();
  context.fillStyle = '#e9dcb5';
  context.font = `italic 400 44px ${SERIF}`;
  context.fillText('pull →', canvas.width / 2 - 40, canvas.height / 2 + 14);
  return canvas;
}

function paintWaveStrip(widthCm, heightCm) {
  const pixels = 50;
  const width = widthCm * pixels;
  const height = heightCm * pixels;
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const earPixels = 0.9 * pixels;
  paintWaves(context, earPixels, height * 0.18, width - earPixels * 2, height * 0.9, 4, 4);
  for (const tabX of [0, width - earPixels]) {
    wash(context, rectPath(tabX, 0, earPixels, pixels * 1.3), '#e6dac0', { seed: tabX + 3, alpha: 1, layers: 1, pool: 0.5 });
  }
  return canvas;
}

function paintFlapFront(widthCm, heightCm) {
  const pixels = 120;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.width, canvas.height, 41, [236, 226, 200], 4);
  wash(context, rectPath(0, 0, canvas.width, canvas.height), '#efe6cf', { seed: 5, alpha: 0.9, layers: 1, pool: 0.6 });
  const windows = 6;
  for (let index = 0; index < windows; index += 1) {
    const x = canvas.width * (0.08 + (index / windows) * 0.88);
    wash(context, rectPath(x, canvas.height * 0.3, canvas.width * 0.09, canvas.height * 0.42), '#3f5d68', { seed: index, alpha: 0.9, layers: 1, pool: 0.5 });
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.strokeRect(x, canvas.height * 0.3, canvas.width * 0.09, canvas.height * 0.42);
  }
  inkLine(context, [[0, canvas.height * 0.18], [canvas.width, canvas.height * 0.18]], 5, 4);
  inkLine(context, [[0, canvas.height * 0.82], [canvas.width, canvas.height * 0.82]], 4, 6);
  context.fillStyle = '#7a5a3a';
  context.font = `italic 400 ${canvas.height * 0.16}px ${SERIF}`;
  context.fillText('Bridge – lift', canvas.width * 0.05, canvas.height * 0.15);
  return canvas;
}

function paintWheelhouse(widthCm, heightCm) {
  const pixels = 120;
  const canvas = makeCanvas(widthCm * pixels, heightCm * pixels);
  const context = canvas.getContext('2d');
  paintPaper(context, canvas.width, canvas.height, 43, [60, 44, 30], 4);
  wash(context, rectPath(0, 0, canvas.width, canvas.height), '#6b4528', { seed: 3, alpha: 0.9, layers: 2, pool: 0.5 });
  // night windows with a glow of lamp light
  const glow = context.createRadialGradient(canvas.width * 0.5, canvas.height * 0.65, 5, canvas.width * 0.5, canvas.height * 0.65, canvas.width * 0.5);
  glow.addColorStop(0, 'rgba(255,190,90,0.85)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  // ship's wheel
  const wheelX = canvas.width * 0.5;
  const wheelY = canvas.height * 0.62;
  const radius = canvas.height * 0.3;
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
    context.arc(canvas.width * x, canvas.height * 0.6, canvas.height * 0.17, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 4;
    context.stroke();
  }
  context.fillStyle = '#f1e6c8';
  context.font = `italic 400 ${canvas.height * 0.17}px ${SERIF}`;
  context.fillText('wheelhouse', canvas.width * 0.04, canvas.height * 0.2);
  return canvas;
}

function paintArch(widthCm, heightCm, ringCm) {
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

function paintFloor(width, height, texts) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 51);
  // sea apron: the far part of the page carries a pale sea wash that thins towards the reader
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(120,170,175,0.55)');
  gradient.addColorStop(0.55, 'rgba(150,190,190,0.22)');
  gradient.addColorStop(1, 'rgba(150,190,190,0)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  const noteY = floorZ(18);
  // volvelle base
  const centerX = floorX(VOLVELLE.x);
  const centerY = floorZ(VOLVELLE.z);
  const baseRadius = VOLVELLE.baseRadius * PIXELS_PER_CM;
  wash(context, (ctx) => ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2), '#efe3c4', { seed: 2, alpha: 1, layers: 1, pool: 0.6, poolWidth: 5 });
  context.strokeStyle = INK;
  context.lineWidth = 3;
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
    place(9.9, () => { context.font = `700 30px ${SERIF}`; context.fillStyle = INK; context.fillText(stop.deck, 0, 8); });
    place(6.5, () => {
      context.font = `700 38px ${SERIF}`;
      context.fillStyle = INK;
      context.fillText(stop.figure, 0, 0);
      context.font = `italic 400 27px ${SERIF}`;
      context.fillText(stop.unit, 0, 36);
    });
  });
  note(context, floorX(8), floorZ(40.2) - 20, 1500, '', '', 0.1);
  return canvas;
}

function paintWheel(size) {
  const canvas = makeCanvas(size, size);
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
  const inner = perCm * 4.3;
  const outer = perCm * 8.1;
  const half = Math.PI / 8.4;
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

function paintBackdrop(width, height, texts) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 71);
  // sea band low on the page (the pieces stand in front of it), pale sky above
  const sky = context.createLinearGradient(0, 0, 0, height * 0.7);
  sky.addColorStop(0, 'rgba(235,222,190,0)');
  sky.addColorStop(1, 'rgba(210,200,170,0.5)');
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  softBlob(context, width * 0.82, height * 0.1, 340, 90, '#cfc8b4', 0.3, 4);
  paintWaves(context, 0, height * 0.7, width, height * 0.3, 8, 6);
  context.fillStyle = INK;
  context.font = `150px ${SMALL_CAPS}`;
  context.fillText('RMS Titanic', 130, 235);
  paragraph(context, 'Built in Belfast by Harland and Wolff, 269 m long and 46,329 gross tons. Her maiden voyage began in April 1912. The ship is cut open below: the boiler rooms behind the hull plate, the Grand Staircase as a tunnel, the funnels folded up from the boat deck.', 135, 335, 1250, 60, `400 50px ${SERIF}`);
  const columnTwo = 1480;
  const columnThree = 2380;
  let y = note(context, columnTwo, 110, 830, 'Sixteen compartments', texts.compartments, 1.6, { source: 'Wikipedia, "Titanic", read 2026-10-27' });
  note(context, columnTwo, y + 30, 830, 'Why four, and not six', texts.six, 1.6, { source: 'Wikipedia, "Titanic"; spill-over described there' });
  y = note(context, columnThree, 110, 830, 'Boilers and coal', texts.boilers, 1.6, { source: 'Wikipedia, "Titanic"' });
  note(context, columnThree, y + 30, 830, 'Triple expansion against the turbine', texts.engines, 1.6, { source: 'Hp and sizes: Wikipedia. The explanation is general engineering, not from that page.' });
  return canvas;
}

export async function buildTitanic(renderer) {
  const shipImage = await loadImage('tex/ship-side.png');
  const texts = {
    slider: 'Pull the brass ring right. The hull plate rides over the hull strip on the same card, so it slides without lifting, and the boiler rooms behind it come into view: 29 boilers in six rooms.',
    flap: 'Lift the bridge. The flap is hinged along its top edge; a patch under it is glued to the ship card and shows the wheelhouse, with the wheel, telegraphs and compass.',
    compartments: 'Fifteen bulkheads divided the hull into sixteen primary compartments. Only eight of the fifteen rose as high as D deck. Eleven watertight doors on the orlop deck closed from a switch on the bridge.',
    six: 'The ship could not stay afloat with more than four compartments flooded. The iceberg heavily breached five and slightly a sixth. As the bow settled, water spilled over the top of each bulkhead into the next compartment, so the bulkheads only delayed it.',
    boilers: '29 boilers (24 double-ended, 5 single-ended) fed 159 furnaces. Each boiler was 4.80 m across and 6.1 m long and held 48.5 tonnes of water. More than 600 tonnes of coal a day went in by hand, 176 firemen working round the clock.',
    engines: 'Two four-cylinder triple-expansion engines gave 30,000 hp. A triple-expansion engine passes the same steam through three cylinders at falling pressure. A Parsons turbine of 16,000 hp ran on the low-pressure steam beyond them.',
  };
  const pageWidth = PAGE_WIDTH * PIXELS_PER_CM;
  const pageHeight = PAGE_DEPTH * PIXELS_PER_CM;
  const backdrop = paintBackdrop(pageWidth, pageHeight, texts);
  const floor = paintFloor(pageWidth, pageHeight, texts);

  // ship wall: crop of the plate view, with the funnels removed from it (they stand up as V-folds)
  const wallCanvas = makeCanvas(SHIP_CROP.width, SHIP_CROP.height);
  const wallContext = wallCanvas.getContext('2d', { willReadFrequently: true });
  wallContext.drawImage(shipImage, SHIP_CROP.x, SHIP_CROP.y, SHIP_CROP.width, SHIP_CROP.height, 0, 0, SHIP_CROP.width, SHIP_CROP.height);
  const wallPicture = wallContext.getImageData(0, 0, SHIP_CROP.width, SHIP_CROP.height);
  const data = wallPicture.data;
  for (let y = 0; y < SHIP_CROP.height; y += 1) {
    for (let x = 0; x < SHIP_CROP.width; x += 1) {
      const index = (y * SHIP_CROP.width + x) * 4;
      const sourceX = x + SHIP_CROP.x;
      const sourceY = y + SHIP_CROP.y;
      const nearBottom = sourceY > 640;
      if (nearBottom && data[index] > 185 && data[index + 1] > 185 && data[index + 2] > 175) data[index + 3] = 0;
      if (sourceY < 448 && FUNNEL_CROPS.some(([from, to]) => sourceX > from - 6 && sourceX < to + 6) && isFunnelBuff(data[index], data[index + 1], data[index + 2])) data[index + 3] = 0;
    }
  }
  wallContext.putImageData(wallPicture, 0, 0);
  const shipWidthCm = SHIP_CROP.width / SHIP_PX_PER_CM;
  const shipHeightCm = SHIP_CROP.height / SHIP_PX_PER_CM;
  const shipHalf = shipWidthCm / 2;

  const shipLayer = new Layer({
    name: 'ship',
    depth: 7.9,
    height: shipHeightCm,
    halfWidth: shipHalf,
    wall: makeCutout({ width: shipWidthCm, length: shipHeightCm, texture: canvasToTexture(THREE, wallCanvas, renderer) }),
    platform: makeCard({ width: shipWidthCm, length: 7.9, thick: 0.1, front: paperMaterial(canvasToTexture(THREE, paintDeck(shipWidthCm * 40, 7.9 * 40), renderer)) }),
    order: 1,
  });

  const hullHeight = 3.8;
  const windowCm = { left: -12.2, right: 13.5, bottom: 0.5, top: 3.4 };
  const hullLayer = new Layer({
    name: 'hull',
    depth: 9.6,
    height: hullHeight,
    halfWidth: 38.9,
    strutHalfWidth: 38.9,
    wall: makeCutout({ width: 78.7, length: hullHeight, texture: canvasToTexture(THREE, paintHullStrip(78.7, hullHeight, windowCm), renderer) }),
    order: 2,
  });
  const waveLayer = new Layer({
    name: 'front-waves',
    depth: 15,
    height: 3.4,
    halfWidth: 40.9,
    strutHalfWidth: 40.9,
    wall: makeCutout({ width: 82.7, length: 3.4, texture: canvasToTexture(THREE, paintWaveStrip(82.7, 3.4), renderer) }),
    order: 3,
  });

  // hull plate that slides across the window
  const sliderWidth = 27.8;
  const sliderHeight = 3.0;
  const slider = makeCard({ width: sliderWidth, length: sliderHeight, thick: 0.1, front: paperMaterial(canvasToTexture(THREE, paintSlider(sliderWidth, sliderHeight), renderer)) });
  slider.userData.handle = { kind: 'slider' };
  slider.position.set(0, 0.35, 0.14);
  hullLayer.frame.add(slider);
  const sliderTravel = 23.5;
  const sliderHome = (windowCm.left + windowCm.right) / 2;

  // bridge flap
  const flapWidth = 5.6;
  const flapHeight = 2.0;
  const flapX = 20.65;
  const flapPivot = new THREE.Group();
  flapPivot.position.set(flapX, shipHeightCm - 0.02, 0.12);
  const flap = makeCard({ width: flapWidth, length: flapHeight, thick: 0.08, hangs: true, front: paperMaterial(canvasToTexture(THREE, paintFlapFront(flapWidth, flapHeight), renderer)), back: canvasToTexture(THREE, paintWheelhouse(flapWidth, flapHeight), renderer) });
  flap.userData.handle = { kind: 'flap' };
  flapPivot.add(flap);
  shipLayer.frame.add(flapPivot);
  const patch = makeCard({ width: flapWidth, length: flapHeight, thick: 0.04, hangs: true, front: paperMaterial(canvasToTexture(THREE, paintWheelhouse(flapWidth, flapHeight), renderer)) });
  patch.position.set(flapX, shipHeightCm - 0.02, 0.06);
  shipLayer.frame.add(patch);

  // Grand Staircase tunnel: three nested arches on struts that stand off the wall as the page opens
  const arches = [];
  [[4.6, 5.9, 0.6, 0.5], [4.2, 5.4, 1.2, 0.43], [3.7, 4.9, 1.8, 0.36]].forEach(([width, height, offset, ring]) => {
    const arch = makeCutout({ width, length: height, texture: canvasToTexture(THREE, paintArch(width, height, ring), renderer), thick: 0.08 });
    arch.position.set(10.0, 3.05, 0.1);
    arch.userData.offset = offset;
    shipLayer.frame.add(arch);
    arches.push(arch);
  });

  // funnels
  const funnelTexture = (index) => {
    const [from, to] = FUNNEL_CROPS[index];
    const canvas = makeCanvas(to - from, FUNNEL_BOTTOM - FUNNEL_TOP);
    canvas.getContext('2d').drawImage(shipImage, from, FUNNEL_TOP, to - from, FUNNEL_BOTTOM - FUNNEL_TOP, 0, 0, to - from, FUNNEL_BOTTOM - FUNNEL_TOP);
    return canvasToTexture(THREE, canvas, renderer);
  };
  const funnelHeight = (FUNNEL_BOTTOM - FUNNEL_TOP) / SHIP_PX_PER_CM;
  const funnels = FUNNEL_CROPS.map(([from, to], index) => {
    const width = (to - from) / SHIP_PX_PER_CM;
    const x = ((from + to) / 2 - SHIP_CROP.x) / SHIP_PX_PER_CM - shipHalf;
    return new VFold({
      layer: shipLayer,
      x,
      width,
      hingeAlong: 3.0,
      panelLength: funnelHeight,
      panelA: makeCutout({ width, length: funnelHeight, texture: funnelTexture(index), thick: 0.08 }),
      order: index,
    });
  });

  // wheel
  const wheelTexture = canvasToTexture(THREE, paintWheel(1024), renderer);
  const wheel = new THREE.Group();
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
  const grommet = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 24), new THREE.MeshStandardMaterial({ color: 0xb8923e, metalness: 0.6, roughness: 0.4 }));
  grommet.rotation.x = Math.PI / 2;
  wheelSpin.add(grommet);
  wheel.add(wheelSpin);
  wheel.rotation.x = -Math.PI / 2;
  wheel.position.set(VOLVELLE.x, 0.12, VOLVELLE.z);

  const root = new THREE.Group();
  for (const layer of [shipLayer, hullLayer, waveLayer]) root.add(layer.root);
  for (const funnel of funnels) root.add(funnel.root);
  root.add(wheel);

  const state = { slide: 0, flap: 0, wheelStop: 0, wheelAngle: 0 };
  const spread = {
    name: 'titanic',
    backdrop,
    floor,
    root,
    layers: [shipLayer, hullLayer, waveLayer],
    folds: funnels,
    state,
    handles: { slider, flap, wheel: wheelFront },
    frames: { hull: hullLayer.frame, flapPivot, wheel },
    sliderTravel,
    update(psi, farShift) {
      for (const layer of [shipLayer, hullLayer, waveLayer]) layer.update(psi, farShift);
      for (const funnel of funnels) funnel.update(psi);
      const stand = Math.sin(psi);
      for (const arch of arches) arch.position.z = 0.1 + arch.userData.offset * stand;
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
