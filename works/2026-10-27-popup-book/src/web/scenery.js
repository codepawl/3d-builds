// Printed scenery shared by both spreads: sea and river strips, night sky, ice, smoke curls and the lectern text cards.
// Every strip is a function of absolute centimetres along the page, so pieces cut from one sea line up when side by side.
import {
  INK, SERIF, SMALL_CAPS, makeCanvas, paintPaper, wash, polygonPath, curvePath, rectPath, inkLine, hatch, paragraph, softBlob, seededRandom, addGrain,
} from './paint.js';

function hashUnit(value) {
  const mixed = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return mixed - Math.floor(mixed);
}

// A cut-out strip of water. Everything above the first crest is transparent, so the sky shows through.
export function paintSeaWall(widthCm, heightCm, options = {}) {
  const { startCm = 0, pixelsPerCm = 50, tones, seed = 1, crestDropCm = 1.2, amplitudeCm = 0.35, foam = false, glints = true, wavelengthCm = 6 } = options;
  const width = Math.round(widthCm * pixelsPerCm);
  const height = Math.round(heightCm * pixelsPerCm);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const rows = tones.length;
  const firstCrest = crestDropCm * pixelsPerCm;
  const rowHeight = (height - firstCrest) / rows;
  for (let row = 0; row < rows; row += 1) {
    const base = firstCrest + row * rowHeight;
    const amplitude = pixelsPerCm * amplitudeCm * (1 - row * 0.1);
    const length = wavelengthCm * (1 + row * 0.22);
    const phase = seed * 1.7 + row * 2.3;
    const curve = (pixelX) => {
      const position = pixelX / pixelsPerCm + startCm;
      return base + amplitude * Math.sin((position / length) * Math.PI * 2 + phase) + amplitude * 0.45 * Math.sin((position / (length * 0.41)) * Math.PI * 2 + phase * 2);
    };
    const bandPath = (ctx) => {
      ctx.moveTo(0, height);
      for (let pixelX = 0; pixelX <= width; pixelX += 3) ctx.lineTo(pixelX, curve(pixelX));
      ctx.lineTo(width, height);
      ctx.closePath();
    };
    context.beginPath();
    bandPath(context);
    context.fillStyle = tones[row];
    context.fill();
    // watercolour: the water is lighter under the crest and settles darker toward the next band
    context.save();
    context.beginPath();
    bandPath(context);
    context.clip();
    const bandGradient = context.createLinearGradient(0, base - amplitude, 0, base + rowHeight * 1.1);
    bandGradient.addColorStop(0, 'rgba(255,255,245,0.2)');
    bandGradient.addColorStop(0.5, 'rgba(255,255,245,0)');
    bandGradient.addColorStop(1, 'rgba(20,50,70,0.12)');
    context.fillStyle = bandGradient;
    context.fillRect(0, 0, width, height);
    context.restore();
    const crest = [];
    for (let pixelX = 0; pixelX <= width; pixelX += 10) crest.push([pixelX, curve(pixelX)]);
    // crests run on across the cut edges so neighbouring strips meet without a gap in the ink
    if (foam) inkLine(context, crest.map(([x, y]) => [x, y + 5]), 11, seed + row, 0.2, '#f4ecd6', { taper: false });
    inkLine(context, crest, row === 0 ? 4 : 3, seed + 40 + row, 0.3, INK, { taper: false });
    if (glints) {
      // flowing scallops under the crest: short curved strokes that swell and fade
      for (let slot = 0; slot < width / pixelsPerCm * 1.6; slot += 1) {
        const position = Math.floor(startCm * 1.6) + slot;
        const pixelX = (position / 1.6 - startCm) * pixelsPerCm;
        if (hashUnit(position * 3.1 + row * 17 + seed) > 0.55) continue;
        const pixelY = curve(pixelX) + 10 + hashUnit(position + row) * rowHeight * 0.5;
        const length = 30 + hashUnit(position * 1.3) * 44;
        inkLine(context, [[pixelX, pixelY], [pixelX + length * 0.3, pixelY - 5], [pixelX + length * 0.65, pixelY - 3], [pixelX + length, pixelY + 3]], 3.4, position, 0.15, 'rgba(244,236,214,0.7)');
      }
    }
  }
  addGrain(context, 0, 0, width, height, 6, seed + 3);
  return canvas;
}

// Water seen from above: the top of a step.
export function paintSeaTop(widthCm, lengthCm, options = {}) {
  const { startCm = 0, pixelsPerCm = 40, tone = '#2f5d70', light = '#4f8296', seed = 4 } = options;
  const width = Math.round(widthCm * pixelsPerCm);
  const height = Math.round(lengthCm * pixelsPerCm);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, tone);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const lines = Math.max(3, Math.round(lengthCm * 1.4));
  for (let line = 0; line < lines; line += 1) {
    const baseY = ((line + 0.5) / lines) * height;
    const points = [];
    for (let pixelX = 0; pixelX <= width; pixelX += 14) {
      const position = pixelX / pixelsPerCm + startCm;
      points.push([pixelX, baseY + Math.sin(position * 1.3 + line * 2 + seed) * 5 + Math.sin(position * 0.5 + line) * 4]);
    }
    inkLine(context, points, 2.6, seed + line, 0.2, 'rgba(244,236,214,0.55)', { taper: false });
  }
  addGrain(context, 0, 0, width, height, 6, seed);
  return canvas;
}

export function paintNightSky(width, height, { title, subtitle }) {
  const canvas = makeCanvas(width, height, 2.5);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, 71);
  const margin = Math.round(height * 0.03);
  const random = seededRandom(17);
  // a deckled paper edge: the points are drawn once and joined by one smooth curve for both the clip and the outline
  const edgePoints = [];
  for (let x = margin; x <= width - margin; x += 40) edgePoints.push([x, margin + (random() - 0.5) * 8]);
  for (let y = margin; y <= height - margin; y += 40) edgePoints.push([width - margin + (random() - 0.5) * 8, y]);
  for (let x = width - margin; x >= margin; x -= 40) edgePoints.push([x, height - margin + (random() - 0.5) * 8]);
  for (let y = height - margin; y >= margin; y -= 40) edgePoints.push([margin + (random() - 0.5) * 8, y]);
  const edge = curvePath(edgePoints, true, 0.4);
  context.save();
  context.beginPath();
  edge(context);
  context.clip();
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0f1936');
  sky.addColorStop(0.45, '#1f3361');
  sky.addColorStop(0.72, '#3d5f86');
  sky.addColorStop(0.9, '#7f9fb0');
  sky.addColorStop(1, '#2a4a63');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  // the Milky Way, a pale band across the sky
  context.save();
  context.translate(width * 0.55, height * 0.3);
  context.rotate(-0.35);
  for (let blob = 0; blob < 26; blob += 1) {
    softBlob(context, (random() - 0.5) * width * 0.9, (random() - 0.5) * 120, 260 + random() * 220, 90 + random() * 60, '#b9c6e4', 0.35, blob + 5);
  }
  context.restore();
  // stars
  for (let star = 0; star < 1400; star += 1) {
    const x = random() * width;
    const y = random() * height * 0.78;
    const size = random() < 0.9 ? 1.5 + random() * 2 : 3.5 + random() * 3;
    context.fillStyle = `rgba(250,240,214,${0.4 + random() * 0.6})`;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
    if (size > 4.5) {
      context.strokeStyle = 'rgba(250,240,214,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - size * 3, y);
      context.lineTo(x + size * 3, y);
      context.moveTo(x, y - size * 3);
      context.lineTo(x, y + size * 3);
      context.stroke();
    }
  }
  // a far line of sea under the horizon haze
  const horizon = height * 0.78;
  const sea = context.createLinearGradient(0, horizon, 0, height);
  sea.addColorStop(0, '#5d7f93');
  sea.addColorStop(1, '#1e3d56');
  context.fillStyle = sea;
  context.fillRect(0, horizon, width, height - horizon);
  inkLine(context, [[0, horizon], [width, horizon]], 4, 3, 0.3);
  context.restore();
  context.beginPath();
  edge(context);
  context.strokeStyle = INK;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = '#e8c978';
  context.font = `190px ${SMALL_CAPS}`;
  context.fillText(title, margin * 3, margin * 3 + 150);
  context.fillStyle = '#d8d2bd';
  context.font = `italic 400 76px ${SERIF}`;
  context.fillText(subtitle, margin * 3 + 6, margin * 3 + 250);
  return canvas;
}

// Mix a #rrggbb colour toward white (amount > 0) or toward the warm ink (amount < 0).
function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? [255, 252, 244] : [61, 38, 21];
  const mix = Math.abs(amount);
  const channel = (shift, index) => Math.round(((value >> shift) & 255) * (1 - mix) + target[index] * mix);
  return `rgb(${channel(16, 0)},${channel(8, 1)},${channel(0, 2)})`;
}

// A berg cut-out. `profile` is the above-water outline as fractions of the canvas (x, y from the top), left to right;
// it starts and ends on the waterline. Each outline segment becomes a rounded facet: faces that rise to the right face the
// lamp and stay pale, faces that fall away take blue shadow. Under the waterline the ice turns green-blue.
export function paintIceberg(widthCm, heightCm, options = {}) {
  const { profile, waterline = 0.88, seed = 3, lampFromLeft = true } = options;
  const pixelsPerCm = 90;
  const width = Math.round(widthCm * pixelsPerCm);
  const height = Math.round(heightCm * pixelsPerCm);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  const random = seededRandom(seed * 131 + 7);
  const scale = (points) => points.map(([x, y]) => [x * width, y * height]);
  const top = scale(profile);
  const waterY = waterline * height;
  const leftFoot = [top[0][0], waterY];
  const rightFoot = [top[top.length - 1][0], waterY];
  const submerged = [[rightFoot[0] + width * 0.015, waterY + height * 0.05], [rightFoot[0] - width * 0.04, height], [leftFoot[0] + width * 0.04, height], [leftFoot[0] - width * 0.015, waterY + height * 0.05]];
  const outline = (ctx) => {
    curvePath([...top, ...submerged], true, 0.22)(ctx);
  };
  context.save();
  context.beginPath();
  outline(context);
  context.clip();
  context.fillStyle = '#dcebf0';
  context.fillRect(0, 0, width, height);
  // facets: one per outline segment, dropped to a foot that leans toward the highest point of the berg
  const peak = top.reduce((best, point) => (point[1] < best[1] ? point : best), top[0]);
  const feet = top.map((point) => [point[0] + (peak[0] - point[0]) * (0.18 + random() * 0.14), waterY - height * (0.02 + random() * 0.05)]);
  for (let index = 0; index < top.length - 1; index += 1) {
    const from = top[index];
    const to = top[index + 1];
    const slope = (to[1] - from[1]) / Math.max(1, to[0] - from[0]);
    const facing = lampFromLeft ? -slope : slope;
    const lit = Math.min(1, Math.max(0, 0.5 + facing * 1.1));
    const face = [from, to, feet[index + 1], feet[index]];
    const path = curvePath(face, true, 0.16);
    const gradient = context.createLinearGradient(from[0], Math.min(from[1], to[1]), feet[index][0], waterY);
    const paleTop = lit > 0.55 ? '#fdfefd' : lit > 0.3 ? '#e9f3f5' : '#bcd6e6';
    const paleBottom = lit > 0.55 ? '#d8eaf1' : lit > 0.3 ? '#b9d4e4' : '#7da6c8';
    gradient.addColorStop(0, paleTop);
    gradient.addColorStop(1, paleBottom);
    context.beginPath();
    path(context);
    context.fillStyle = gradient;
    context.fill();
    if (lit < 0.45) wash(context, path, '#6f9fc4', { seed: seed + index, alpha: 0.55, layers: 2, pool: 0.5, poolWidth: 3 });
    // a fold inside the facet: a smaller darker plane, so the face reads as carved rather than flat
    const middle = [(from[0] + to[0]) / 2 + (random() - 0.5) * 18, (from[1] + to[1]) / 2 + (waterY - (from[1] + to[1]) / 2) * 0.35];
    const fold = [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], middle, [from[0] + (feet[index][0] - from[0]) * 0.55, from[1] + (feet[index][1] - from[1]) * 0.55]];
    wash(context, curvePath(fold, true, 0.2), lit > 0.5 ? '#9cc3dc' : '#4f82b0', { seed: seed + 40 + index, alpha: 0.4, layers: 1, pool: 0.3, poolWidth: 2 });
    context.save();
    context.beginPath();
    path(context);
    context.clip();
    if (lit < 0.45) hatch(context, Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.abs(to[0] - from[0]) + 4, waterY - Math.min(from[1], to[1]), 12, 0.22, seed + index, 1.2);
    context.restore();
    // crease between facets, an ink line tapering at both ends
    inkLine(context, [to, [(to[0] + feet[index + 1][0]) / 2, (to[1] + feet[index + 1][1]) / 2], feet[index + 1]], 2.6, seed + index * 3, 0.5, 'rgba(48,66,96,0.6)');
  }
  // bright sparkle on lit corners
  for (let index = 1; index < top.length - 1; index += 1) {
    if (top[index][1] < top[index - 1][1] && top[index][1] < top[index + 1][1]) {
      inkLine(context, [[top[index][0] - 10, top[index][1] + 14], [top[index][0] + 2, top[index][1] + 6], [top[index][0] + 18, top[index][1] + 12]], 5, seed + index, 0.2, 'rgba(255,255,255,0.9)');
    }
  }
  // under the water: ice gone green-blue and deeper
  const deep = context.createLinearGradient(0, waterY - 6, 0, height);
  deep.addColorStop(0, 'rgba(120,196,190,0.9)');
  deep.addColorStop(0.35, 'rgba(60,140,160,0.95)');
  deep.addColorStop(1, 'rgba(32,88,120,1)');
  context.fillStyle = deep;
  context.beginPath();
  const waveTop = [];
  for (let pixelX = 0; pixelX <= width; pixelX += 8) waveTop.push([pixelX, waterY + Math.sin(pixelX / 17 + seed) * 3 + Math.sin(pixelX / 41) * 2]);
  context.moveTo(0, height);
  waveTop.forEach(([x, y]) => context.lineTo(x, y));
  context.lineTo(width, height);
  context.closePath();
  context.fill();
  // pale band where the ice meets the water
  inkLine(context, waveTop.map(([x, y]) => [x, y - 2]), 9, seed + 90, 0.15, 'rgba(250,250,240,0.8)', { taper: false });
  context.restore();
  // foam scallops at the waterline
  for (let slot = leftFoot[0]; slot < rightFoot[0]; slot += 30) {
    const x = slot + random() * 12;
    inkLine(context, [[x, waterY + 2], [x + 12, waterY - 6], [x + 26, waterY + 2]], 3, slot, 0.3, 'rgba(250,246,232,0.9)');
  }
  inkLine(context, top, 4.4, seed + 7, 0.4);
  inkLine(context, [[leftFoot[0], leftFoot[1]], ...waveTop.filter(([x]) => x > leftFoot[0] && x < rightFoot[0]), [rightFoot[0], rightFoot[1]]], 3.2, seed + 8, 0.25, 'rgba(61,38,21,0.7)');
  return canvas;
}

// A cut-out plume of billowing puffs: each puff is shaded round, the silhouette is drawn once around the whole cloud
// and the inner folds are fine tapered lines; the plume ends in a curl.
export function paintSmoke(widthCm, heightCm, seed, tone = '#d7d5ce') {
  const pixelsPerCm = 60;
  const width = Math.round(widthCm * pixelsPerCm);
  const height = Math.round(heightCm * pixelsPerCm);
  const canvas = makeCanvas(width, height, 3);
  const context = canvas.getContext('2d');
  const random = seededRandom(seed);
  const wobble = random() * 2;
  const circles = [];
  const steps = 46;
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const radius = pixelsPerCm * (0.32 + progress * 0.62);
    circles.push({ x: width * (0.12 + progress * 0.62) + radius * 0.2, y: height * (0.86 - progress * 0.5) + Math.sin(progress * 7 + wobble) * height * 0.07 * progress, radius });
  }
  for (let step = 1; step <= 14; step += 1) {
    const angle = -1.1 + step * 0.42;
    const spiral = 1 - step / 17;
    circles.push({ x: width * 0.8 + Math.cos(angle) * pixelsPerCm * 0.9 * spiral, y: height * 0.34 + Math.sin(angle) * pixelsPerCm * 0.9 * spiral, radius: pixelsPerCm * (0.5 * spiral + 0.12) });
  }
  circles.forEach((circle, index) => {
    const outline = 2.6 + 2.2 * Math.sin((index / circles.length) * Math.PI);
    context.fillStyle = INK;
    context.beginPath();
    context.arc(circle.x, circle.y, circle.radius + outline, 0, Math.PI * 2);
    context.fill();
  });
  circles.forEach((circle) => {
    const body = context.createRadialGradient(circle.x - circle.radius * 0.35, circle.y - circle.radius * 0.4, circle.radius * 0.1, circle.x, circle.y, circle.radius);
    body.addColorStop(0, shade(tone, 0.45));
    body.addColorStop(0.6, shade(tone, 0));
    body.addColorStop(1, shade(tone, -0.22));
    context.fillStyle = body;
    context.beginPath();
    context.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
    context.fill();
  });
  // the fold along the lower right of every third puff, a short curved line that fades at both ends
  for (let step = 2; step < circles.length; step += 3) {
    const circle = circles[step];
    const arc = [];
    for (let part = 0; part <= 6; part += 1) {
      const angle = Math.PI * (0.05 + (part / 6) * 0.7);
      arc.push([circle.x + Math.cos(angle) * circle.radius * 0.82, circle.y + Math.sin(angle) * circle.radius * 0.82]);
    }
    inkLine(context, arc, 2.2, step + seed, 0.2, 'rgba(61,38,21,0.5)');
  }
  return canvas;
}

// The short text card on a lectern: a heading and two or three lines, large enough to read in the reel.
export function paintLecternCard(widthCm, heightCm, heading, body, accent) {
  const pixelsPerCm = 100;
  const width = Math.round(widthCm * pixelsPerCm);
  const height = Math.round(heightCm * pixelsPerCm);
  const canvas = makeCanvas(width, height, 2.5);
  const context = canvas.getContext('2d');
  paintPaper(context, width, height, heading.length * 7, [244, 235, 213], 5);
  wash(context, rectPath(0, 0, width, height * 0.23), accent, { seed: 3, alpha: 0.85, layers: 2, pool: 0.3 });
  context.fillStyle = INK;
  context.font = `700 118px ${SERIF}`;
  context.fillText(heading, 56, height * 0.18);
  paragraph(context, body, 56, height * 0.23 + 138, width - 112, 126, `400 104px ${SERIF}`);
  context.strokeStyle = INK;
  context.lineWidth = 6;
  context.beginPath();
  context.roundRect(6, 6, width - 12, height - 12, 14);
  context.stroke();
  return canvas;
}
