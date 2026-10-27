// Drawing kit for a hand-inked look: seeded randomness, wobbly ink lines, hatching, paper grain.
// Everything is a pure function of its inputs, so a frame drawn twice looks the same.
"use strict";

const Ink = (() => {
  const PAPER = "#efe3c8";
  const INK = "#2a1f17";
  // Lines "boil" like hand-drawn animation: the wobble seed changes 8 times a second.
  const BOIL_PER_SECOND = 0;

  function seededRandom(seed) {
    let state = Math.floor(seed * 2654435761) >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1000000) / 1000000;
    };
  }

  function hash(x, y = 0, z = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return value - Math.floor(value);
  }

  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const progress = (time, start, end) => clamp((time - start) / (end - start));
  const easeInOut = (value) => value * value * (3 - 2 * value);
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);
  const easeIn = (value) => value * value * value;

  let boilFrame = 0;
  function setTime(time) {
    boilFrame = Math.floor(time * BOIL_PER_SECOND);
  }

  // A closed or open polyline with a small hand wobble that boils over time.
  function wobblyPath(context, points, { closed = false, wobble = 1.2, seed = 1 } = {}) {
    context.beginPath();
    points.forEach(([x, y], index) => {
      const offsetX = (hash(index, seed, boilFrame) - 0.5) * 2 * wobble;
      const offsetY = (hash(seed, index, boilFrame + 17) - 0.5) * 2 * wobble;
      if (index === 0) {
        context.moveTo(x + offsetX, y + offsetY);
      } else {
        context.lineTo(x + offsetX, y + offsetY);
      }
    });
    if (closed) {
      context.closePath();
    }
  }

  function ellipsePoints(centerX, centerY, radiusX, radiusY, rotation = 0, count = 48) {
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const localX = Math.cos(angle) * radiusX;
      const localY = Math.sin(angle) * radiusY;
      points.push([
        centerX + localX * Math.cos(rotation) - localY * Math.sin(rotation),
        centerY + localX * Math.sin(rotation) + localY * Math.cos(rotation),
      ]);
    }
    return points;
  }

  // Fill a shape, hatch inside it, then ink its outline.
  function inkShape(context, points, { fill, hatch = null, line = INK, width = 2.4, seed = 1, wobble = 1.1 } = {}) {
    wobblyPath(context, points, { closed: true, wobble: wobble * 0.5, seed });
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (hatch) {
      context.save();
      context.clip();
      hatchArea(context, boundsOf(points), hatch);
      context.restore();
    }
    if (line) {
      wobblyPath(context, points, { closed: true, wobble, seed: seed + 3 });
      context.strokeStyle = line;
      context.lineWidth = width;
      context.lineJoin = "round";
      context.stroke();
    }
  }

  function boundsOf(points) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }

  // Parallel strokes across a box at an angle; draw it inside a clip.
  function hatchArea(context, box, { angle = 0.7, spacing = 7, color = INK, alpha = 0.35, width = 1, cross = false, seed = 5 } = {}) {
    const centerX = (box.left + box.right) / 2;
    const centerY = (box.top + box.bottom) / 2;
    const reach = Math.hypot(box.right - box.left, box.bottom - box.top) / 2 + spacing;
    context.save();
    context.globalAlpha *= alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    const angles = cross ? [angle, angle + Math.PI / 2.4] : [angle];
    angles.forEach((lineAngle, layer) => {
      const directionX = Math.cos(lineAngle);
      const directionY = Math.sin(lineAngle);
      context.beginPath();
      for (let offset = -reach; offset <= reach; offset += spacing) {
        const jitter = (hash(offset, seed + layer, boilFrame) - 0.5) * spacing * 0.5;
        const startX = centerX - directionY * (offset + jitter) - directionX * reach;
        const startY = centerY + directionX * (offset + jitter) - directionY * reach;
        const length = reach * (1.6 + hash(offset, seed) * 0.4);
        context.moveTo(startX, startY);
        context.lineTo(startX + directionX * length, startY + directionY * length);
      }
      context.stroke();
    });
    context.restore();
  }

  // Cross-hatched shadow on one side of a shape: everything past a line through its middle, turned by lightAngle.
  function shadeSide(context, points, { lightAngle = -2.3, depth = 0.35, spacing = 4, alpha = 0.45, color = INK, seed = 7 } = {}) {
    const box = boundsOf(points);
    const centerX = (box.left + box.right) / 2;
    const centerY = (box.top + box.bottom) / 2;
    const reach = Math.hypot(box.right - box.left, box.bottom - box.top);
    context.save();
    wobblyPath(context, points, { closed: true, wobble: 0.4, seed });
    context.clip();
    context.translate(centerX, centerY);
    context.rotate(lightAngle + Math.PI);
    context.beginPath();
    // After the turn, +x points away from the light; shade the last `depth` of the half-width.
    context.rect((reach / 2) * (1 - 2 * depth) * 0.75, -reach, reach, reach * 2);
    context.rotate(-(lightAngle + Math.PI));
    context.translate(-centerX, -centerY);
    context.clip();
    hatchArea(context, box, { angle: 0.8, spacing, alpha, color, cross: true, seed });
    context.restore();
  }

  // Soft colour blotches like uneven pencil or watercolour, under the ink.
  function blotches(context, box, { colors, count = 14, alpha = 0.12, seed = 13 } = {}) {
    context.save();
    for (let index = 0; index < count; index += 1) {
      const x = lerp(box.left, box.right, hash(index, seed, 1));
      const y = lerp(box.top, box.bottom, hash(index, seed, 2));
      const radius = (box.right - box.left) * (0.08 + hash(index, seed, 3) * 0.2);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const color = colors[index % colors.length];
      gradient.addColorStop(0, color.replace("ALPHA", String(alpha)));
      gradient.addColorStop(1, color.replace("ALPHA", "0"));
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.restore();
  }

  // Short random pen flecks: sand, grain, sparkle.
  function flecks(context, box, { count = 200, color = INK, alpha = 0.3, length = 4, seed = 9, width = 1 } = {}) {
    context.save();
    context.globalAlpha *= alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    for (let index = 0; index < count; index += 1) {
      const x = lerp(box.left, box.right, hash(index, seed));
      const y = lerp(box.top, box.bottom, hash(seed, index));
      const angle = hash(index, seed, 3) * Math.PI;
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
    context.stroke();
    context.restore();
  }

  let paperCanvas = null;
  function paper(context, size, tint = PAPER) {
    if (!paperCanvas || paperCanvas.tint !== tint) {
      paperCanvas = document.createElement("canvas");
      paperCanvas.width = size;
      paperCanvas.height = size;
      paperCanvas.tint = tint;
      const paperContext = paperCanvas.getContext("2d");
      paperContext.fillStyle = tint;
      paperContext.fillRect(0, 0, size, size);
      const random = seededRandom(42);
      for (let index = 0; index < 26000; index += 1) {
        const shade = random() < 0.5 ? "0,0,0" : "255,255,255";
        paperContext.fillStyle = `rgba(${shade},${0.02 + random() * 0.05})`;
        paperContext.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
      }
    }
    context.drawImage(paperCanvas, 0, 0);
  }

  // A soft vignette and grain over the finished frame, so every scene shares the same paper.
  function finish(context, size, strength = 0.35) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(20,12,6,${strength})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const BEAT = 0.5;
  function beatTime(time) {
    const beat = Math.floor(time / BEAT);
    const phase = time / BEAT - beat;
    const surge = 1 - (1 - phase) ** 3;
    return (beat + 0.65 * surge + 0.35 * phase) * BEAT;
  }

  // A gentle kick once per bar of two beats; every beat was too often and made people dizzy (An, 2026-10-13).
  function beatPulse(context, time, size, strength = 0.01) {
    const phase = (time / (BEAT * 2)) % 1;
    const scale = 1 + strength * Math.exp(-phase * 9);
    context.translate(size / 2, size / 2);
    context.scale(scale, scale);
    context.translate(-size / 2, -size / 2);
  }

  // Sketch and stop-motion lines (An, 2026-10-14: "sketch và cartoon... nét vẽ theo stopmotion"): the motion stays
  // smooth, but the drawing itself boils. The whole frame passes through a small turbulence displacement whose seed
  // changes 10 times a second ("on threes" at 30 fps), and a second pass with another seed is laid over it lightly, so
  // every outline gets a doubled pencil edge that shifts from drawing to drawing.
  const BOILS_PER_SECOND = 10;
  const BOIL_FILTERS = ["ink-boil-main", "ink-boil-ghost"];
  let boilLayer = null;

  function ensureBoilFilters() {
    if (document.getElementById(BOIL_FILTERS[0])) {
      return;
    }
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    BOIL_FILTERS.forEach((id, index) => {
      const filter = document.createElementNS(namespace, "filter");
      filter.setAttribute("id", id);
      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", "100%");
      filter.setAttribute("height", "100%");
      const turbulence = document.createElementNS(namespace, "feTurbulence");
      turbulence.setAttribute("type", "fractalNoise");
      turbulence.setAttribute("baseFrequency", index === 0 ? "0.035" : "0.05");
      turbulence.setAttribute("numOctaves", "2");
      turbulence.setAttribute("result", "noise");
      const displacement = document.createElementNS(namespace, "feDisplacementMap");
      displacement.setAttribute("in", "SourceGraphic");
      displacement.setAttribute("in2", "noise");
      displacement.setAttribute("scale", index === 0 ? "3.2" : "5");
      displacement.setAttribute("xChannelSelector", "R");
      displacement.setAttribute("yChannelSelector", "G");
      filter.append(turbulence, displacement);
      svg.append(filter);
    });
    document.body.append(svg);
  }

  function sketchPass(context, time, size) {
    ensureBoilFilters();
    if (!boilLayer) {
      boilLayer = document.createElement("canvas");
      boilLayer.width = size;
      boilLayer.height = size;
    }
    const drawing = Math.floor(time * BOILS_PER_SECOND);
    BOIL_FILTERS.forEach((id, index) => {
      document.querySelector(`#${id} feTurbulence`).setAttribute("seed", String((drawing * 7 + index * 131) % 997));
    });
    const layer = boilLayer.getContext("2d");
    layer.clearRect(0, 0, size, size);
    layer.drawImage(context.canvas, 0, 0);
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.filter = `url(#${BOIL_FILTERS[0]})`;
    context.drawImage(boilLayer, 0, 0);
    // The ghost pass darkens only where it is darker (the lines), giving each edge a second, offset pencil stroke.
    context.filter = `url(#${BOIL_FILTERS[1]})`;
    context.globalCompositeOperation = "darken";
    context.globalAlpha = 0.45;
    context.drawImage(boilLayer, 0, 0);
    context.restore();
  }

  // Wraps a module's renderAt so it runs on beat time inside a pulsing frame, then boils the lines.
  function onBeat(renderAt, size = 1080) {
    const wrapped = (context, time) => {
      context.save();
      beatPulse(context, time, size);
      renderAt(context, beatTime(time));
      context.restore();
      sketchPass(context, time, size);
    };
    // The bare scene, for a later beat that replays this one at another speed with its own line boil.
    wrapped.raw = renderAt;
    return wrapped;
  }

  return {
    BEAT, beatTime, beatPulse, onBeat, sketchPass,
    PAPER, INK, seededRandom, hash, clamp, lerp, progress, easeInOut, easeOut, easeIn, setTime,
    wobblyPath, ellipsePoints, inkShape, hatchArea, shadeSide, blotches, flecks, paper, finish, boundsOf,
  };
})();
