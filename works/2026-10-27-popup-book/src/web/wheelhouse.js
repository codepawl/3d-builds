// The wheelhouse patch under the bridge flap, drawn as a small illustration in the book's ink-and-wash style: a panelled
// wooden wall lit by a lamp, night windows, a ship's wheel with lathe-turned spokes, a binnacle compass between two
// engine-order telegraphs. Painted at 150 logical units per centimetre and stored at 4x, i.e. 600 texels per centimetre,
// 1.5x what the close shot of the flap shows.
import {
  INK, SERIF, makeCanvas, paintPaper, wash, rectPath, polygonPath, curvePath, inkLine, seededRandom,
} from './paint.js';

const BRASS_LIGHT = '#f2d684';
const BRASS_MID = '#d1a247';
const BRASS_DARK = '#8f6424';
const WOOD_LIGHT = '#a8703a';
const WOOD_DARK = '#5a3519';

function circlePoints(centerX, centerY, radiusX, radiusY, steps = 24, start = 0) {
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = start + (step / steps) * Math.PI * 2;
    points.push([centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY]);
  }
  return points;
}

function brassGradient(context, x0, y0, x1, y1) {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, BRASS_LIGHT);
  gradient.addColorStop(0.5, BRASS_MID);
  gradient.addColorStop(1, BRASS_DARK);
  return gradient;
}

function paintWallAndWindows(context, width, height, random) {
  paintPaper(context, width, height, 43, [178, 120, 70], 4);
  wash(context, rectPath(0, 0, width, height), '#c28a52', { seed: 3, alpha: 0.95, layers: 2, pool: 0.4 });
  // vertical planks: seams drawn as fine tapered ink lines, grain as paler strokes
  const plankWidth = 46;
  for (let x = 0; x < width; x += plankWidth) {
    const tone = ['#d29a5e', '#b9824a', '#e0aa6c'][Math.floor(random() * 3)];
    wash(context, rectPath(x + 1, 0, plankWidth - 2, height), tone, { seed: x + 5, alpha: 0.5, layers: 1, pool: 0.35, poolWidth: 3 });
    inkLine(context, [[x, 0], [x + random() * 3 - 1.5, height * 0.5], [x + 1, height]], 2.2, x + 2, 0.4, 'rgba(40,22,10,0.8)');
    for (let grain = 0; grain < 3; grain += 1) {
      const grainX = x + 8 + random() * (plankWidth - 16);
      const grainTop = random() * height * 0.4;
      inkLine(context, [[grainX, grainTop], [grainX + random() * 4 - 2, grainTop + height * 0.3], [grainX + random() * 6 - 3, grainTop + height * (0.5 + random() * 0.4)]], 1.2, x + grain * 13, 0.6, 'rgba(36,18,8,0.28)');
    }
  }
  // lamp light pooling in the middle
  const glow = context.createRadialGradient(width * 0.5, height * 0.55, 6, width * 0.5, height * 0.55, width * 0.5);
  glow.addColorStop(0, 'rgba(255,214,130,0.6)');
  glow.addColorStop(0.6, 'rgba(255,170,70,0.14)');
  glow.addColorStop(1, 'rgba(255,170,70,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  // ceiling beam and a low raised-panel dado
  wash(context, rectPath(0, 0, width, height * 0.07), '#74492a', { seed: 11, alpha: 0.9, layers: 2, pool: 0.4 });
  inkLine(context, [[0, height * 0.07], [width, height * 0.07]], 4, 12, 0.3);
  wash(context, rectPath(0, height * 0.82, width, height * 0.18), '#8a5a30', { seed: 13, alpha: 0.85, layers: 2, pool: 0.4 });
  inkLine(context, [[0, height * 0.82], [width * 0.5, height * 0.815], [width, height * 0.82]], 4, 14, 0.3);
  for (let x = 14; x < width - 40; x += 74) {
    inkLine(context, [[x, height * 0.86], [x + 54, height * 0.86], [x + 54, height * 0.97], [x, height * 0.97], [x, height * 0.86]], 2, x, 0.3, 'rgba(230,180,110,0.45)', { sharp: true, taper: false });
  }
  // four windows onto the night
  const windowWidth = width * 0.17;
  const windowTop = height * 0.12;
  const windowHeight = height * 0.32;
  for (let index = 0; index < 4; index += 1) {
    const windowX = width * (0.045 + index * 0.238);
    const sky = context.createLinearGradient(0, windowTop, 0, windowTop + windowHeight);
    sky.addColorStop(0, '#142640');
    sky.addColorStop(1, '#35577a');
    context.fillStyle = sky;
    context.fillRect(windowX, windowTop, windowWidth, windowHeight);
    for (let star = 0; star < 6; star += 1) {
      const starX = windowX + 5 + random() * (windowWidth - 10);
      const starY = windowTop + 4 + random() * windowHeight * 0.55;
      inkLine(context, [[starX - 2.5, starY], [starX + 2.5, starY]], 1.6, star + index * 9, 0, 'rgba(255,248,215,0.95)', { taper: false });
      inkLine(context, [[starX, starY - 2.5], [starX, starY + 2.5]], 1.6, star + index * 9 + 4, 0, 'rgba(255,248,215,0.95)', { taper: false });
    }
    // sea at the bottom of each window
    const seaPoints = [];
    for (let step = 0; step <= 10; step += 1) seaPoints.push([windowX + (step / 10) * windowWidth, windowTop + windowHeight * 0.78 + Math.sin(step * 1.7 + index) * 2]);
    wash(context, curvePath([...seaPoints, [windowX + windowWidth, windowTop + windowHeight], [windowX, windowTop + windowHeight]], true, 0.2), '#1d4c63', { seed: index + 30, alpha: 0.9, layers: 1, pool: 0.2 });
    // glass sheen
    context.fillStyle = 'rgba(255,255,255,0.1)';
    context.beginPath();
    context.moveTo(windowX + windowWidth * 0.15, windowTop);
    context.lineTo(windowX + windowWidth * 0.45, windowTop);
    context.lineTo(windowX + windowWidth * 0.2, windowTop + windowHeight);
    context.lineTo(windowX, windowTop + windowHeight);
    context.lineTo(windowX, windowTop + windowHeight * 0.4);
    context.closePath();
    context.fill();
    // brass frame and a mullion
    context.strokeStyle = brassGradient(context, windowX, windowTop, windowX + windowWidth, windowTop + windowHeight);
    context.lineWidth = 7;
    context.strokeRect(windowX - 2, windowTop - 2, windowWidth + 4, windowHeight + 4);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(windowX + windowWidth / 2, windowTop);
    context.lineTo(windowX + windowWidth / 2, windowTop + windowHeight);
    context.stroke();
    inkLine(context, [[windowX - 5.5, windowTop - 5.5], [windowX + windowWidth + 5.5, windowTop - 5.5], [windowX + windowWidth + 5.5, windowTop + windowHeight + 5.5], [windowX - 5.5, windowTop + windowHeight + 5.5], [windowX - 5.5, windowTop - 5.5]], 2.4, index + 50, 0.2, INK, { sharp: true, taper: false });
    inkLine(context, [[windowX + 1.5, windowTop + 1.5], [windowX + windowWidth - 1.5, windowTop + 1.5], [windowX + windowWidth - 1.5, windowTop + windowHeight - 1.5], [windowX + 1.5, windowTop + windowHeight - 1.5], [windowX + 1.5, windowTop + 1.5]], 1.6, index + 60, 0.2, INK, { sharp: true, taper: false });
  }
}

// The wheel is seen face on. Eight turned spokes, each a baluster: a swelling bead, a waist, then a handle that
// stands out past the rim and ends in a knob.
function paintShipsWheel(context, centerX, centerY, radius, random) {
  const spokes = 8;
  const rimWidth = radius * 0.17;
  const handleLength = radius * 0.34;
  // soft contact shadow on the wall
  const shadow = context.createRadialGradient(centerX + 6, centerY + 8, radius * 0.6, centerX + 6, centerY + 8, radius * 1.5);
  shadow.addColorStop(0, 'rgba(30,14,4,0.5)');
  shadow.addColorStop(1, 'rgba(30,14,4,0)');
  context.fillStyle = shadow;
  context.fillRect(centerX - radius * 1.7, centerY - radius * 1.7, radius * 3.4, radius * 3.4);
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = (spoke / spokes) * Math.PI * 2 + 0.2;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const total = radius + handleLength;
    // half-width profile along the spoke: hub neck, bead, waist, long taper, handle grip, knob
    const profile = [[0.1, 2.6], [0.22, 3.2], [0.3, 5.2], [0.36, 3.0], [0.46, 2.6], [0.58, 3.6], [0.7, 2.4], [0.82, 3.4], [0.9, 4.6], [0.96, 3.8], [1.0, 5.8], [1.04, 0.6]];
    const along = (t) => t * total;
    const left = profile.map(([t, half]) => [centerX + ux * along(t) + nx * half, centerY + uy * along(t) + ny * half]);
    const right = profile.map(([t, half]) => [centerX + ux * along(t) - nx * half, centerY + uy * along(t) - ny * half]).reverse();
    const outline = polygonPath([...left, ...right], 1.5);
    const gradient = context.createLinearGradient(centerX + nx * 6, centerY + ny * 6, centerX - nx * 6, centerY - ny * 6);
    gradient.addColorStop(0, '#c18a4d');
    gradient.addColorStop(0.5, WOOD_LIGHT);
    gradient.addColorStop(1, '#5e3a1b');
    context.beginPath();
    outline(context);
    context.fillStyle = gradient;
    context.fill();
    inkLine(context, [...left, ...right, left[0]], 2, spoke + 70, 0.2, INK, { taper: false, sharp: true });
    // highlight along the spoke
    inkLine(context, [[centerX + ux * along(0.12) + nx * 1.2, centerY + uy * along(0.12) + ny * 1.2], [centerX + ux * along(0.7) + nx * 0.9, centerY + uy * along(0.7) + ny * 0.9]], 1.4, spoke + 90, 0.3, 'rgba(255,225,170,0.6)');
  }
  // rim: a ring of wood between two ink circles, with a brass band on its face
  const outer = circlePoints(centerX, centerY, radius + rimWidth / 2, radius + rimWidth / 2, 56);
  const inner = circlePoints(centerX, centerY, radius - rimWidth / 2, radius - rimWidth / 2, 56);
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius + rimWidth / 2, 0, Math.PI * 2);
  context.arc(centerX, centerY, radius - rimWidth / 2, 0, Math.PI * 2, true);
  const rimGradient = context.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  rimGradient.addColorStop(0, '#c9935a');
  rimGradient.addColorStop(0.5, '#8f5a2a');
  rimGradient.addColorStop(1, '#4d2e14');
  context.fillStyle = rimGradient;
  context.fill('evenodd');
  context.restore();
  inkLine(context, outer, 2.8, 81, 0.25, INK, { taper: false });
  inkLine(context, inner, 2.4, 82, 0.25, INK, { taper: false });
  inkLine(context, circlePoints(centerX, centerY, radius, radius, 56), 2, 83, 0.15, BRASS_LIGHT, { taper: false });
  inkLine(context, circlePoints(centerX - 1, centerY - 1, radius + rimWidth * 0.3, radius + rimWidth * 0.3, 40, 3.4).slice(0, 14), 2.4, 84, 0.2, 'rgba(255,230,180,0.65)');
  // brass hub with a rivet ring
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.17, 0, Math.PI * 2);
  context.fillStyle = brassGradient(context, centerX - radius * 0.17, centerY - radius * 0.17, centerX + radius * 0.17, centerY + radius * 0.17);
  context.fill();
  inkLine(context, circlePoints(centerX, centerY, radius * 0.17, radius * 0.17, 28), 2.6, 85, 0.2, INK, { taper: false });
  inkLine(context, circlePoints(centerX, centerY, radius * 0.1, radius * 0.1, 22), 1.6, 86, 0.2, 'rgba(90,60,20,0.8)', { taper: false });
  context.beginPath();
  context.arc(centerX - radius * 0.04, centerY - radius * 0.05, radius * 0.035, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,245,200,0.9)';
  context.fill();
}

// An engine-order telegraph: a brass pedestal under a round dial with a sector scale and a lever on a boss.
function paintTelegraph(context, centerX, baseY, dialRadius, leverAngle, seed) {
  const dialY = baseY - dialRadius * 2.4;
  // pedestal: a tapering column with a flared foot
  const column = [[centerX - dialRadius * 0.28, dialY + dialRadius * 0.8], [centerX + dialRadius * 0.28, dialY + dialRadius * 0.8], [centerX + dialRadius * 0.2, baseY - dialRadius * 0.4], [centerX + dialRadius * 0.62, baseY], [centerX - dialRadius * 0.62, baseY], [centerX - dialRadius * 0.2, baseY - dialRadius * 0.4]];
  context.beginPath();
  polygonPath(column, 2)(context);
  context.fillStyle = brassGradient(context, centerX - dialRadius * 0.6, 0, centerX + dialRadius * 0.6, 0);
  context.fill();
  inkLine(context, [...column, column[0]], 2.4, seed, 0.2, INK, { taper: false, sharp: true });
  inkLine(context, [[centerX - dialRadius * 0.4, baseY - dialRadius * 0.2], [centerX + dialRadius * 0.4, baseY - dialRadius * 0.2]], 1.8, seed + 1, 0.2, 'rgba(61,38,21,0.7)');
  // bezel and face
  context.beginPath();
  context.arc(centerX, dialY, dialRadius, 0, Math.PI * 2);
  context.fillStyle = brassGradient(context, centerX - dialRadius, dialY - dialRadius, centerX + dialRadius, dialY + dialRadius);
  context.fill();
  inkLine(context, circlePoints(centerX, dialY, dialRadius, dialRadius, 40), 3, seed + 2, 0.2, INK, { taper: false });
  const faceRadius = dialRadius * 0.82;
  context.beginPath();
  context.arc(centerX, dialY, faceRadius, 0, Math.PI * 2);
  const face = context.createRadialGradient(centerX - faceRadius * 0.3, dialY - faceRadius * 0.3, 2, centerX, dialY, faceRadius);
  face.addColorStop(0, '#fbf3d6');
  face.addColorStop(1, '#e2d3a2');
  context.fillStyle = face;
  context.fill();
  inkLine(context, circlePoints(centerX, dialY, faceRadius, faceRadius, 40), 1.8, seed + 3, 0.2, INK, { taper: false });
  // scale: ticks over the upper sweep, a red stop sector and tiny words
  for (let tick = 0; tick <= 14; tick += 1) {
    const angle = Math.PI * (1.12 + (tick / 14) * 0.76);
    const inset = tick % 2 === 0 ? 0.72 : 0.8;
    inkLine(context, [[centerX + Math.cos(angle) * faceRadius * inset, dialY + Math.sin(angle) * faceRadius * inset], [centerX + Math.cos(angle) * faceRadius * 0.94, dialY + Math.sin(angle) * faceRadius * 0.94]], tick % 2 === 0 ? 2.2 : 1.4, seed + 10 + tick, 0.1, INK, { taper: false });
  }
  wash(context, curvePath([[centerX - faceRadius * 0.2, dialY + faceRadius * 0.2], [centerX - faceRadius * 0.55, dialY + faceRadius * 0.55], [centerX + faceRadius * 0.55, dialY + faceRadius * 0.55], [centerX + faceRadius * 0.2, dialY + faceRadius * 0.2]], true, 0.3), '#b5483a', { seed: seed + 20, alpha: 0.75, layers: 1, pool: 0.3, poolWidth: 2 });
  context.fillStyle = INK;
  context.font = `600 ${dialRadius * 0.17}px ${SERIF}`;
  context.textAlign = 'center';
  context.fillText('AHEAD', centerX, dialY - faceRadius * 0.28);
  context.fillText('STOP', centerX, dialY + faceRadius * 0.42);
  context.fillText('ASTERN', centerX, dialY + faceRadius * 0.7);
  context.textAlign = 'left';
  // lever: a bar on a boss with a red knob
  const leverX = centerX + Math.cos(leverAngle) * faceRadius * 0.66;
  const leverY = dialY + Math.sin(leverAngle) * faceRadius * 0.66;
  inkLine(context, [[centerX, dialY], [leverX, leverY]], dialRadius * 0.14, seed + 30, 0.1, '#6b1d18');
  inkLine(context, [[centerX, dialY], [leverX, leverY]], dialRadius * 0.05, seed + 31, 0.1, 'rgba(255,170,150,0.7)');
  context.beginPath();
  context.arc(leverX, leverY, dialRadius * 0.11, 0, Math.PI * 2);
  context.fillStyle = '#a82b24';
  context.fill();
  inkLine(context, circlePoints(leverX, leverY, dialRadius * 0.11, dialRadius * 0.11, 16), 1.8, seed + 32, 0.1, INK, { taper: false });
  context.beginPath();
  context.arc(centerX, dialY, dialRadius * 0.12, 0, Math.PI * 2);
  context.fillStyle = BRASS_DARK;
  context.fill();
  inkLine(context, circlePoints(centerX, dialY, dialRadius * 0.12, dialRadius * 0.12, 16), 1.8, seed + 33, 0.1, INK, { taper: false });
  context.beginPath();
  context.arc(centerX - dialRadius * 0.38, dialY - dialRadius * 0.46, dialRadius * 0.08, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,240,0.75)';
  context.fill();
}

// A binnacle: a wooden column with a brass hood, a compass card under glass and the two iron correcting spheres.
function paintBinnacle(context, centerX, baseY, size, seed) {
  const bodyTop = baseY - size * 1.9;
  const body = [[centerX - size * 0.5, bodyTop], [centerX + size * 0.5, bodyTop], [centerX + size * 0.62, baseY], [centerX - size * 0.62, baseY]];
  context.beginPath();
  polygonPath(body, 2)(context);
  const wood = context.createLinearGradient(centerX - size * 0.6, 0, centerX + size * 0.6, 0);
  wood.addColorStop(0, '#b27a42');
  wood.addColorStop(0.55, '#7d4a22');
  wood.addColorStop(1, '#4a2a12');
  context.fillStyle = wood;
  context.fill();
  inkLine(context, [...body, body[0]], 2.4, seed, 0.2, INK, { taper: false, sharp: true });
  // door panel with a brass pull
  const panel = [[centerX - size * 0.32, bodyTop + size * 0.35], [centerX + size * 0.32, bodyTop + size * 0.35], [centerX + size * 0.36, baseY - size * 0.18], [centerX - size * 0.36, baseY - size * 0.18]];
  inkLine(context, [...panel, panel[0]], 1.8, seed + 1, 0.2, 'rgba(255,215,150,0.55)', { taper: false, sharp: true });
  context.beginPath();
  context.arc(centerX + size * 0.2, bodyTop + size * 0.95, size * 0.045, 0, Math.PI * 2);
  context.fillStyle = BRASS_LIGHT;
  context.fill();
  // brass band
  const band = [[centerX - size * 0.54, bodyTop - size * 0.05], [centerX + size * 0.54, bodyTop - size * 0.05], [centerX + size * 0.55, bodyTop + size * 0.2], [centerX - size * 0.55, bodyTop + size * 0.2]];
  context.beginPath();
  polygonPath(band, 2)(context);
  context.fillStyle = brassGradient(context, centerX - size * 0.5, 0, centerX + size * 0.5, 0);
  context.fill();
  inkLine(context, [...band, band[0]], 2.2, seed + 2, 0.2, INK, { taper: false, sharp: true });
  // hood: a dome over the compass bowl
  const bowlY = bodyTop - size * 0.38;
  const bowlRadius = size * 0.5;
  context.beginPath();
  context.arc(centerX, bowlY, bowlRadius, 0, Math.PI * 2);
  context.fillStyle = brassGradient(context, centerX - bowlRadius, bowlY - bowlRadius, centerX + bowlRadius, bowlY + bowlRadius);
  context.fill();
  inkLine(context, circlePoints(centerX, bowlY, bowlRadius, bowlRadius, 40), 3, seed + 3, 0.2, INK, { taper: false });
  const cardRadius = bowlRadius * 0.78;
  context.beginPath();
  context.arc(centerX, bowlY, cardRadius, 0, Math.PI * 2);
  const card = context.createRadialGradient(centerX - cardRadius * 0.3, bowlY - cardRadius * 0.3, 2, centerX, bowlY, cardRadius);
  card.addColorStop(0, '#fff8e0');
  card.addColorStop(1, '#e8dcb0');
  context.fillStyle = card;
  context.fill();
  inkLine(context, circlePoints(centerX, bowlY, cardRadius, cardRadius, 40), 1.8, seed + 4, 0.2, INK, { taper: false });
  for (let tick = 0; tick < 32; tick += 1) {
    const angle = (tick / 32) * Math.PI * 2;
    const inner = tick % 8 === 0 ? 0.62 : tick % 4 === 0 ? 0.76 : 0.85;
    inkLine(context, [[centerX + Math.cos(angle) * cardRadius * inner, bowlY + Math.sin(angle) * cardRadius * inner], [centerX + Math.cos(angle) * cardRadius * 0.95, bowlY + Math.sin(angle) * cardRadius * 0.95]], 1.4, seed + 10 + tick, 0.1, INK, { taper: false });
  }
  // compass rose: a four-point star, the north point red
  const star = (length, narrow, angle, color) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const points = [[centerX + ux * length, bowlY + uy * length], [centerX - uy * narrow, bowlY + ux * narrow], [centerX - ux * length * 0.2, bowlY - uy * length * 0.2], [centerX + uy * narrow, bowlY - ux * narrow]];
    context.beginPath();
    polygonPath(points, 0.5)(context);
    context.fillStyle = color;
    context.fill();
    inkLine(context, [...points, points[0]], 1.4, seed + 50 + Math.floor(angle * 10), 0.1, INK, { taper: false, sharp: true });
  };
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) star(cardRadius * 0.7, cardRadius * 0.14, angle - Math.PI / 2 - 0.35, angle === 0 ? '#b5483a' : '#3a4a5e');
  context.fillStyle = INK;
  context.font = `700 ${size * 0.14}px ${SERIF}`;
  context.textAlign = 'center';
  context.fillText('N', centerX + cardRadius * 0.28, bowlY - cardRadius * 0.62);
  context.textAlign = 'left';
  // correcting spheres on arms
  for (const side of [-1, 1]) {
    const sphereX = centerX + side * size * 0.82;
    const sphereY = bowlY + size * 0.28;
    inkLine(context, [[centerX + side * bowlRadius * 0.95, bowlY + size * 0.2], [sphereX - side * size * 0.12, sphereY]], 2.4, seed + 70 + side, 0.1, INK, { taper: false });
    const sphere = context.createRadialGradient(sphereX - 4, sphereY - 4, 1, sphereX, sphereY, size * 0.2);
    sphere.addColorStop(0, '#9fb0b8');
    sphere.addColorStop(1, '#2f3a42');
    context.beginPath();
    context.arc(sphereX, sphereY, size * 0.17, 0, Math.PI * 2);
    context.fillStyle = sphere;
    context.fill();
    inkLine(context, circlePoints(sphereX, sphereY, size * 0.17, size * 0.17, 20), 2, seed + 75 + side, 0.1, INK, { taper: false });
  }
  context.beginPath();
  context.arc(centerX - bowlRadius * 0.4, bowlY - bowlRadius * 0.5, bowlRadius * 0.12, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,240,0.55)';
  context.fill();
}

export function paintWheelhouse(widthCm, heightCm) {
  const pixelsPerCm = 150;
  const width = widthCm * pixelsPerCm;
  const height = heightCm * pixelsPerCm;
  const canvas = makeCanvas(width, height, 4);
  const context = canvas.getContext('2d');
  const random = seededRandom(91);
  paintWallAndWindows(context, width, height, random);
  paintTelegraph(context, width * 0.115, height * 0.97, height * 0.105, -Math.PI * 0.32, 100);
  paintShipsWheel(context, width * 0.37, height * 0.56, height * 0.235, random);
  paintBinnacle(context, width * 0.66, height * 0.97, height * 0.19, 200);
  paintTelegraph(context, width * 0.885, height * 0.97, height * 0.105, -Math.PI * 0.64, 300);
  // a vignette so the corners fall away from the lamp
  const vignette = context.createRadialGradient(width * 0.5, height * 0.5, height * 0.4, width * 0.5, height * 0.5, width * 0.62);
  vignette.addColorStop(0, 'rgba(20,8,2,0)');
  vignette.addColorStop(1, 'rgba(20,8,2,0.4)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
  return canvas;
}
