// Canvas painting helpers for the plate look: cream paper with grain, watercolour washes that pool softly at their
// edges, hand-drawn ink lines that swell and taper like a pen under pressure, and light hatching for shadow.
// Every printed page of the book is made with these.
export const INK = '#3d2615';
export const SERIF = '"EB Garamond", Georgia, serif';
export const SMALL_CAPS = '"IM Fell English SC", "EB Garamond", Georgia, serif';

// Every canvas is painted in logical units (the page is 40 units per centimetre) and stored at `scale` times that
// many pixels, so lines and text stay sharp in the closest shot. `canvas.logicalWidth` and `logicalHeight` are the
// painting sizes; the context is pre-scaled the first time it is asked for.
export const DEFAULT_SCALE = 2;

export function makeCanvas(width, height, scale = DEFAULT_SCALE) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.logicalWidth = width;
  canvas.logicalHeight = height;
  canvas.paintScale = scale;
  const rawGetContext = canvas.getContext.bind(canvas);
  let scaled = false;
  canvas.getContext = (type, options) => {
    const context = rawGetContext(type, options);
    if (!scaled && context) {
      context.scale(canvas.width / width, canvas.height / height);
      scaled = true;
    }
    return context;
  };
  return canvas;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export async function loadFonts() {
  const faces = ['400 40px "EB Garamond"', 'italic 400 40px "EB Garamond"', '700 40px "EB Garamond"', '400 40px "IM Fell English SC"'];
  await Promise.all(faces.map((face) => document.fonts.load(face)));
}

// Cream paper: low-frequency blotches first, fine grain multiplied at the end.
export function paintPaper(context, width, height, seed = 1, base = [243, 234, 214], grain = 7) {
  const random = seededRandom(seed);
  context.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < 70; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = (0.08 + random() * 0.25) * Math.max(width, height);
    const warm = random() < 0.5;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, warm ? 'rgba(190,150,90,0.07)' : 'rgba(120,150,150,0.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  addGrain(context, 0, 0, width, height, grain, seed + 7);
}

// Grain works on device pixels, so the logical rectangle is converted by the canvas scale.
export function addGrain(context, x, y, width, height, amount = 7, seed = 3) {
  const random = seededRandom(seed);
  const scale = context.canvas.paintScale || 1;
  const left = Math.round(x * scale);
  const top = Math.round(y * scale);
  const picture = context.getImageData(left, top, Math.round(width * scale), Math.round(height * scale));
  const data = picture.data;
  for (let index = 0; index < data.length; index += 4) {
    const noise = (random() - 0.5) * 2 * amount;
    data[index] += noise;
    data[index + 1] += noise;
    data[index + 2] += noise * 0.9;
  }
  context.putImageData(picture, left, top);
}

// A smooth path through points (Catmull-Rom as cubic beziers). `tension` 0.5 is round, lower is more pointed.
export function curvePath(points, closed = false, tension = 0.5) {
  return (context) => {
    const count = points.length;
    const at = (index) => (closed ? points[((index % count) + count) % count] : points[Math.min(count - 1, Math.max(0, index))]);
    context.moveTo(points[0][0], points[0][1]);
    const segments = closed ? count : count - 1;
    const k = tension / 3;
    for (let index = 0; index < segments; index += 1) {
      const p0 = at(index - 1);
      const p1 = at(index);
      const p2 = at(index + 1);
      const p3 = at(index + 2);
      context.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
        p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
        p2[0], p2[1],
      );
    }
    if (closed) context.closePath();
  };
}

// A watercolour wash: the shape is filled in a few slightly shifted layers (multiplied over what is below), then
// pigment pools softly just inside its edge: three strokes of falling width and rising strength, clipped to the shape.
export function wash(context, tracePath, color, options = {}) {
  const { seed = 1, layers = 3, alpha = 0.55, pool = 0.28, shift = 2.5, poolWidth = 3 } = options;
  const random = seededRandom(seed);
  context.save();
  context.globalCompositeOperation = 'multiply';
  for (let layer = 0; layer < layers; layer += 1) {
    context.save();
    context.translate((random() - 0.5) * shift, (random() - 0.5) * shift);
    context.globalAlpha = alpha / Math.sqrt(layers) * (0.7 + random() * 0.5);
    context.fillStyle = color;
    context.beginPath();
    tracePath(context);
    context.fill();
    context.restore();
  }
  if (pool > 0) {
    context.save();
    context.beginPath();
    tracePath(context);
    context.clip();
    context.strokeStyle = color;
    context.lineJoin = 'round';
    for (const [widthFactor, strength] of [[3.6, 0.2], [2.2, 0.32], [1.1, 0.5]]) {
      context.globalAlpha = Math.min(1, pool * strength);
      context.lineWidth = poolWidth * widthFactor;
      context.beginPath();
      tracePath(context);
      context.stroke();
    }
    context.restore();
  }
  context.restore();
}

export function rectPath(x, y, width, height) {
  return (context) => context.rect(x, y, width, height);
}

// Polygon with softly rounded corners: a hand-cut shape, not a ruled one.
export function polygonPath(points, radius = 5) {
  return (context) => {
    const count = points.length;
    for (let index = 0; index < count; index += 1) {
      const previous = points[(index + count - 1) % count];
      const current = points[index];
      const next = points[(index + 1) % count];
      const toPrevious = Math.hypot(previous[0] - current[0], previous[1] - current[1]) || 1;
      const toNext = Math.hypot(next[0] - current[0], next[1] - current[1]) || 1;
      const reach = Math.min(radius, toPrevious / 2, toNext / 2);
      const startX = current[0] + ((previous[0] - current[0]) / toPrevious) * reach;
      const startY = current[1] + ((previous[1] - current[1]) / toPrevious) * reach;
      const endX = current[0] + ((next[0] - current[0]) / toNext) * reach;
      const endY = current[1] + ((next[1] - current[1]) / toNext) * reach;
      if (index === 0) context.moveTo(startX, startY);
      else context.lineTo(startX, startY);
      context.quadraticCurveTo(current[0], current[1], endX, endY);
    }
    context.closePath();
  };
}

function smoothNoise(random) {
  const values = Array.from({ length: 64 }, () => random() * 2 - 1);
  return (position) => {
    const cell = Math.floor(position);
    const fraction = position - cell;
    const a = values[((cell % 64) + 64) % 64];
    const b = values[(((cell + 1) % 64) + 64) % 64];
    const eased = fraction * fraction * (3 - 2 * fraction);
    return a + (b - a) * eased;
  };
}

// Dense points along a polyline (sharp or two points) or along a Catmull-Rom curve through the points.
function sampleCurve(points, sharp) {
  const spacing = 1.5;
  const out = [];
  const count = points.length;
  for (let index = 0; index < count - 1; index += 1) {
    const p1 = points[index];
    const p2 = points[index + 1];
    const length = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(1, Math.ceil(length / spacing));
    if (sharp || count === 2) {
      for (let step = 0; step < steps; step += 1) {
        out.push([p1[0] + ((p2[0] - p1[0]) * step) / steps, p1[1] + ((p2[1] - p1[1]) * step) / steps]);
      }
    } else {
      const p0 = points[Math.max(0, index - 1)];
      const p3 = points[Math.min(count - 1, index + 2)];
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const blend = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([blend(p0[0], p1[0], p2[0], p3[0]), blend(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
  }
  out.push(points[count - 1]);
  return out;
}

// Ink line through points: a smooth curve drawn as a ribbon whose width swells in the middle, tapers to a fine tip at
// both ends and drifts a little with pen pressure; a slow hand wobble bends it off the ruler.
export function inkLine(context, points, width = 2, seed = 1, wobble = 0.8, color = INK, options = {}) {
  const { taper = true, sharp = false } = options;
  const random = seededRandom(Math.floor(seed * 7919) + 13);
  const bend = smoothNoise(random);
  const pressure = smoothNoise(random);
  const dense = sampleCurve(points, sharp);
  if (dense.length < 2) return;
  const distances = [0];
  for (let index = 1; index < dense.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(dense[index][0] - dense[index - 1][0], dense[index][1] - dense[index - 1][1]));
  }
  const total = distances[distances.length - 1];
  if (total < 0.01) return;
  const taperLength = Math.min(total * 0.5, width * 7);
  const left = [];
  const right = [];
  for (let index = 0; index < dense.length; index += 1) {
    const before = dense[Math.max(0, index - 1)];
    const after = dense[Math.min(dense.length - 1, index + 1)];
    let directionX = after[0] - before[0];
    let directionY = after[1] - before[1];
    const length = Math.hypot(directionX, directionY) || 1;
    directionX /= length;
    directionY /= length;
    const normalX = -directionY;
    const normalY = directionX;
    const distance = distances[index];
    const ramp = taper && taperLength > 0 ? Math.min(1, Math.min(distance, total - distance) / taperLength) : 1;
    const shape = taper ? 0.26 + 0.74 * Math.sin((ramp * Math.PI) / 2) : 1;
    const half = width * 0.5 * shape * (1 + 0.14 * pressure(distance / 55));
    const drift = wobble * width * 0.8 * bend(distance / 48);
    const centerX = dense[index][0] + normalX * drift;
    const centerY = dense[index][1] + normalY * drift;
    left.push([centerX + normalX * half, centerY + normalY * half]);
    right.push([centerX - normalX * half, centerY - normalY * half]);
  }
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(left[0][0], left[0][1]);
  for (let index = 1; index < left.length; index += 1) context.lineTo(left[index][0], left[index][1]);
  for (let index = right.length - 1; index >= 0; index -= 1) context.lineTo(right[index][0], right[index][1]);
  context.closePath();
  context.fill();
  context.restore();
}

export function inkPolygon(context, points, width = 2, seed = 1) {
  inkLine(context, [...points, points[0]], width, seed, 0.3, INK, { sharp: true, taper: false });
}

// Light curved hatching for shadow: fine tapered strokes, softer than the outline.
export function hatch(context, x, y, width, height, spacing = 8, alpha = 0.35, seed = 5, lineWidth = 1.2) {
  const random = seededRandom(seed);
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  const color = `rgba(61,38,21,${(alpha * 0.55).toFixed(3)})`;
  for (let offset = -height; offset < width; offset += spacing) {
    const jitter = random() * 2;
    inkLine(context, [[x + offset + jitter, y + height + 4], [x + offset + height / 2 + 1.5, y + height / 2], [x + offset + height + jitter, y - 4]], lineWidth * 1.4, offset + 11, 0.2, color);
  }
  context.restore();
}

// Wrapped text. Returns the y after the last line. Lines are broken on spaces.
export function paragraph(context, text, x, y, maxWidth, lineHeight, font, color = INK) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'alphabetic';
  const words = text.split(' ');
  let line = '';
  let cursor = y;
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (context.measureText(attempt).width > maxWidth && line) {
      context.fillText(line, x, cursor);
      cursor += lineHeight;
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) {
    context.fillText(line, x, cursor);
    cursor += lineHeight;
  }
  context.restore();
  return cursor;
}

// One margin note: bold heading, body, and an optional small source line (so unverified claims are visible).
export function note(context, x, y, width, heading, body, scale, options = {}) {
  const headingSize = 34 * scale;
  const bodySize = 27 * scale;
  context.save();
  context.font = `700 ${headingSize}px ${SERIF}`;
  context.fillStyle = INK;
  context.fillText(heading, x, y + headingSize * 0.8);
  context.restore();
  let cursor = y + headingSize * 1.35;
  cursor = paragraph(context, body, x, cursor + bodySize * 0.55, width, bodySize * 1.22, `400 ${bodySize}px ${SERIF}`);
  if (options.source) {
    cursor = paragraph(context, options.source, x, cursor + bodySize * 0.25, width, bodySize * 1.1, `italic 400 ${bodySize * 0.84}px ${SERIF}`, '#7a5a3a');
  }
  return cursor;
}

export function softBlob(context, x, y, radiusX, radiusY, color, alpha, seed = 1) {
  const random = seededRandom(seed);
  context.save();
  context.globalCompositeOperation = 'multiply';
  for (let index = 0; index < 5; index += 1) {
    context.globalAlpha = alpha / 3;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x + (random() - 0.5) * radiusX * 0.2, y + (random() - 0.5) * radiusY * 0.3, radiusX * (0.8 + random() * 0.3), radiusY * (0.8 + random() * 0.3), 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

// Sea: layered wave bands in teal wash with flowing ink crests.
export function paintWaves(context, x, y, width, height, seed = 1, rows = 5) {
  const random = seededRandom(seed);
  for (let row = 0; row < rows; row += 1) {
    const top = y + (height * row) / rows;
    const rowHeight = height / rows;
    const tone = ['#9fc3c0', '#86b2b2', '#6e9fa5', '#5a8c96', '#487a86'][row % 5];
    const amplitude = rowHeight * 0.32;
    const wavelength = 90 + random() * 60;
    const phase = random() * 6;
    const crestAt = (step) => top + Math.sin((step / wavelength) * Math.PI * 2 + phase) * amplitude;
    const crest = [];
    for (let step = 0; step <= width; step += 12) crest.push([x + step, crestAt(step)]);
    wash(context, (ctx) => {
      curvePath(crest)(ctx);
      ctx.lineTo(x + width, top + rowHeight * 2);
      ctx.lineTo(x, top + rowHeight * 2);
      ctx.closePath();
    }, tone, { seed: seed + row, layers: 2, alpha: 0.7, pool: 0.4, poolWidth: 3 });
    inkLine(context, crest, 2.4, seed + 40 + row, 0.5);
  }
}

export function canvasToTexture(THREE, canvas, renderer, options = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}
