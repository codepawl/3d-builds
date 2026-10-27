// Beat 3, 6 s: the banded embryo becomes a segmented larva (blueprint), then, drawn on paper, it hatches from the egg
// lying on fruit flesh and crawls toward yeast. Built from anatomy/fruit-fly-larva.md.
"use strict";

const Larva = (() => {
  const { hash, lerp, clamp, progress, easeOut, easeInOut } = Ink;
  const SIZE = 1080;
  const DURATION = 6;
  const CUT = 2.0;
  const NAVY = "#1d1f33";
  const BLUE = { ground: "#0d1322", line: "#b8dcea", faint: "rgba(169,214,232,0.22)", glow: "#eef8fc", en: "#e05cc8", gut: "rgba(169,214,232,0.35)" };
  const AXIS = -0.62;
  const SEGMENTS = 12;

  // Two framings of the same egg: the blueprint one matches the end of beat 2; the paper one is smaller, leaving room
  // for the larva to crawl out toward the lower left.
  const BLUEPRINT_EGG = { center: [560, 580], halfLength: 440, halfWidth: 158 };
  const PAPER_EGG = { center: [660, 430], halfLength: 270, halfWidth: 97 };

  function eggPoint(egg, u, v) {
    const along = u * egg.halfLength;
    const across = v * egg.halfWidth;
    return [egg.center[0] + along * Math.cos(AXIS) - across * Math.sin(AXIS), egg.center[1] + along * Math.sin(AXIS) + across * Math.cos(AXIS)];
  }

  function shellV(u, dorsal) {
    return (dorsal ? -0.86 : 1.0) * Math.sqrt(Math.max(0, 1 - u * u)) ** 0.85;
  }

  function shellOutline(egg, { squash = 1, count = 120 } = {}) {
    const points = [];
    for (let index = 0; index <= count / 2; index += 1) {
      const u = -Math.cos((index / (count / 2)) * Math.PI);
      points.push(eggPoint(egg, u, shellV(u, true) * squash));
    }
    for (let index = count / 2; index >= 0; index -= 1) {
      const u = -Math.cos((index / (count / 2)) * Math.PI);
      points.push(eggPoint(egg, u, shellV(u, false) * squash));
    }
    return points;
  }

  function trace(context, points, closed = true) {
    context.beginPath();
    points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    if (closed) {
      context.closePath();
    }
  }

  // ---------- the larva's body along a path ----------

  // A path is a list of screen points; pointAt walks it by arc length and returns the point and the direction.
  function makePath(points) {
    const lengths = [0];
    for (let index = 1; index < points.length; index += 1) {
      lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
    }
    const pointAt = (distance) => {
      const clamped = clamp(distance, 0, lengths[lengths.length - 1]);
      let index = 1;
      while (index < lengths.length - 1 && lengths[index] < clamped) {
        index += 1;
      }
      const amount = (clamped - lengths[index - 1]) / Math.max(1e-6, lengths[index] - lengths[index - 1]);
      const [fromX, fromY] = points[index - 1];
      const [toX, toY] = points[index];
      return { x: lerp(fromX, toX, amount), y: lerp(fromY, toY, amount), angle: Math.atan2(toY - fromY, toX - fromX) };
    };
    return { pointAt, length: lengths[lengths.length - 1] };
  }

  function smoothPath(controls, perSegment = 16) {
    const points = [];
    for (let index = 0; index < controls.length - 1; index += 1) {
      const previous = controls[Math.max(0, index - 1)];
      const current = controls[index];
      const next = controls[index + 1];
      const after = controls[Math.min(controls.length - 1, index + 2)];
      for (let step = 0; step < perSegment; step += 1) {
        const t = step / perSegment;
        points.push([0, 1].map((axis) => 0.5 * (2 * current[axis] + (-previous[axis] + next[axis]) * t + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - after[axis]) * t * t + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + after[axis]) * t * t * t)));
      }
    }
    points.push(controls[controls.length - 1]);
    return makePath(points);
  }

  // Peristalsis: a wave of contraction runs from the tail to the head; a contracted segment is shorter and fatter.
  // One peristaltic wave per beat, so crawling pushes land on the music.
  function segmentSqueeze(segment, time, period = Ink.BEAT) {
    const wave = (1 - ((time / period) % 1)) * (SEGMENTS + 3) - 1.5;
    return Math.exp(-((segment - wave) ** 2) / 1.6);
  }

  // Body boundaries from head (0) to tail (SEGMENTS), as distances back from the head along the path.
  function boundaries(length, time, crawling) {
    const weights = Array.from({ length: SEGMENTS }, (unused, segment) => (segment === 0 ? 1.3 : segment < 4 ? 0.85 : 1.0) * (1 - (crawling ? 0.32 : 0.18) * segmentSqueeze(segment, time)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const result = [0];
    weights.forEach((weight) => result.push(result[result.length - 1] + (weight / total) * length));
    return result;
  }

  function halfWidthAt(fraction, maxHalfWidth) {
    if (fraction < 0.14) {
      return maxHalfWidth * Math.pow(fraction / 0.14, 0.75) * 0.95 + 2;
    }
    if (fraction > 0.86) {
      return maxHalfWidth * Math.sqrt(Math.max(0, 1 - ((fraction - 0.86) / 0.15) ** 2)) + 2;
    }
    return maxHalfWidth;
  }

  // Lays the body on the path: head at headDistance, tail behind it. Returns the outline and per-segment frames.
  function bodyGeometry(path, headDistance, length, maxHalfWidth, time, { crawling = false, swing = 0 } = {}) {
    const marks = boundaries(length, time, crawling);
    const samples = 60;
    const left = [];
    const right = [];
    const spine = [];
    for (let step = 0; step <= samples; step += 1) {
      const fraction = step / samples;
      const { x, y, angle } = path.pointAt(headDistance - fraction * length);
      // The head swings side to side; the swing fades along the body.
      const sway = swing * (1 - fraction) ** 3 * maxHalfWidth * 1.4;
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      const segment = Math.min(SEGMENTS - 1, Math.floor(fraction * SEGMENTS));
      const bulge = 1 + 0.22 * segmentSqueeze(segment, time) * (crawling ? 1 : 0.6);
      const half = halfWidthAt(fraction, maxHalfWidth) * bulge;
      const centerX = x + normalX * sway;
      const centerY = y + normalY * sway;
      spine.push({ x: centerX, y: centerY, angle, half, fraction });
      left.push([centerX + normalX * half, centerY + normalY * half]);
      right.push([centerX - normalX * half, centerY - normalY * half]);
    }
    const grooves = marks.slice(1, -1).map((distance) => spine[Math.round((distance / length) * samples)]);
    return { outline: [...left, ...right.reverse()], spine, grooves };
  }

  // ---------- drawing the larva ----------

  function drawLarvaBlueprint(context, body, { grooves = 1, gut = 1, trachea = 1, hooks = 1, alpha = 1 }) {
    context.save();
    context.globalAlpha = alpha;
    trace(context, body.outline);
    context.fillStyle = "rgba(169,214,232,0.06)";
    context.fill();
    context.strokeStyle = BLUE.line;
    context.lineWidth = 3;
    context.stroke();
    drawGut(context, body, gut, BLUE.gut, 3);
    drawGrooves(context, body, grooves, BLUE.line, 1.6);
    drawTrachea(context, body, trachea, BLUE.glow, 1.6);
    drawHooks(context, body, hooks, BLUE.glow);
    context.restore();
  }

  function drawLarvaPaper(context, body, time) {
    context.save();
    context.filter = "blur(10px)";
    context.fillStyle = "rgba(90,40,10,0.25)";
    trace(context, body.outline.map(([x, y]) => [x + 10, y + 14]));
    context.fill();
    context.restore();
    trace(context, body.outline);
    context.fillStyle = "#f4eddd";
    context.fill();
    context.save();
    trace(context, body.outline);
    context.clip();
    drawGut(context, body, 1, "rgba(150,104,52,0.6)", 5);
    sketchSide(context, body);
    drawTrachea(context, body, 1, "rgba(236,242,246,0.95)", 3, "rgba(50,60,75,0.75)");
    context.restore();
    drawGrooves(context, body, 1, "rgba(40,28,20,0.8)", 1.6);
    drawDenticles(context, body);
    trace(context, body.outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    drawHooks(context, body, 1, "#120c08");
    drawSpiracles(context, body);
  }

  function drawGrooves(context, body, amount, color, width) {
    if (amount <= 0) {
      return;
    }
    context.strokeStyle = color;
    context.lineWidth = width;
    context.globalAlpha *= amount;
    body.grooves.forEach(({ x, y, angle, half }) => {
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      context.beginPath();
      context.moveTo(x + normalX * half * 0.96, y + normalY * half * 0.96);
      context.quadraticCurveTo(x + Math.cos(angle) * half * 0.18, y + Math.sin(angle) * half * 0.18, x - normalX * half * 0.96, y - normalY * half * 0.96);
      context.stroke();
    });
    context.globalAlpha /= amount;
  }

  // Short ticks along the belly edge at the front of each segment: the denticle belts that grip when crawling.
  function drawDenticles(context, body) {
    context.strokeStyle = "rgba(40,25,15,0.7)";
    context.lineWidth = 1;
    context.beginPath();
    body.grooves.forEach(({ x, y, angle, half }, index) => {
      if (index < 3) {
        return;
      }
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      for (let tick = 0; tick < 6; tick += 1) {
        const along = -4 - tick * 2.4;
        const baseX = x + Math.cos(angle) * along + normalX * half * 0.92;
        const baseY = y + Math.sin(angle) * along + normalY * half * 0.92;
        context.moveTo(baseX, baseY);
        context.lineTo(baseX + normalX * 4, baseY + normalY * 4);
      }
    });
    context.stroke();
  }

  // The gut: a dark tube folded back and forth inside the body.
  function drawGut(context, body, amount, color, width) {
    if (amount <= 0) {
      return;
    }
    const points = [];
    const loops = 7;
    for (let step = 0; step <= 280; step += 1) {
      const turn = (step / 280) * loops * Math.PI * 2;
      const along = 0.22 + (step / 280) * 0.56 - Math.sin(turn) * 0.035 * amount;
      const spinePoint = body.spine[Math.round(clamp(along, 0, 1) * (body.spine.length - 1))];
      const across = Math.cos(turn) * spinePoint.half * 0.5 * amount;
      points.push([spinePoint.x - Math.sin(spinePoint.angle) * across, spinePoint.y + Math.cos(spinePoint.angle) * across]);
    }
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    trace(context, points, false);
    context.stroke();
  }

  // Two air tubes along the back, filling from front to back.
  function drawTrachea(context, body, fill, color, width, outline = null) {
    if (fill <= 0) {
      return;
    }
    [-0.42, 0.42].forEach((offset) => {
      const points = body.spine.filter((point) => point.fraction > 0.1 && point.fraction < 0.1 + 0.85 * fill).map(({ x, y, angle, half }) => [x - Math.sin(angle) * half * offset, y + Math.cos(angle) * half * offset]);
      if (points.length < 2) {
        return;
      }
      if (outline) {
        context.strokeStyle = outline;
        context.lineWidth = width + 2;
        trace(context, points, false);
        context.stroke();
      }
      context.strokeStyle = color;
      context.lineWidth = width;
      trace(context, points, false);
      context.stroke();
    });
  }

  function drawHooks(context, body, amount, color) {
    if (amount <= 0) {
      return;
    }
    const { x, y, angle, half } = body.spine[3];
    context.save();
    context.globalAlpha *= amount;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.lineCap = "round";
    [-1, 1].forEach((side) => {
      const normalX = -Math.sin(angle) * side;
      const normalY = Math.cos(angle) * side;
      const baseX = x + normalX * half * 0.3 - Math.cos(angle) * half * 0.4;
      const baseY = y + normalY * half * 0.3 - Math.sin(angle) * half * 0.4;
      context.beginPath();
      context.moveTo(baseX, baseY);
      context.quadraticCurveTo(baseX + Math.cos(angle) * half * 0.9, baseY + Math.sin(angle) * half * 0.9, baseX + Math.cos(angle) * half * 1.0 - normalX * half * 0.35, baseY + Math.sin(angle) * half * 1.0 - normalY * half * 0.35);
      context.stroke();
    });
    context.restore();
  }

  function drawSpiracles(context, body) {
    const { x, y, angle, half } = body.spine[body.spine.length - 3];
    context.strokeStyle = "#2a1a10";
    context.lineWidth = 3;
    context.lineCap = "round";
    [-1, 1].forEach((side) => {
      const baseX = x - Math.sin(angle) * half * 0.35 * side;
      const baseY = y + Math.cos(angle) * half * 0.35 * side;
      context.beginPath();
      context.moveTo(baseX, baseY);
      context.lineTo(baseX - Math.cos(angle) * 12, baseY - Math.sin(angle) * 12);
      context.stroke();
    });
  }

  // Sketched shading down one side of the body, in clusters of short strokes.
  function sketchSide(context, body) {
    context.strokeStyle = "rgba(80,60,40,0.55)";
    context.lineWidth = 1.1;
    context.beginPath();
    body.spine.forEach(({ x, y, angle, half }, index) => {
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      const strokes = 4 + Math.floor(hash(index, 3) * 4);
      for (let stroke = 0; stroke < strokes; stroke += 1) {
        const depth = 0.35 + hash(index, stroke) * 0.6;
        const startX = x + normalX * half * depth + Math.cos(angle) * (stroke - strokes / 2) * 2.4;
        const startY = y + normalY * half * depth + Math.sin(angle) * (stroke - strokes / 2) * 2.4;
        const tilt = angle + 1.15 + (hash(stroke, index) - 0.5) * 0.7;
        const length = 6 + depth * 10;
        context.moveTo(startX, startY);
        context.lineTo(startX + Math.cos(tilt) * length, startY + Math.sin(tilt) * length);
      }
    });
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,0.7)";
    context.lineWidth = 3;
    const sheen = body.spine.filter((point) => point.fraction > 0.15 && point.fraction < 0.85).map(({ x, y, angle, half }) => [x + Math.sin(angle) * half * 0.55, y - Math.cos(angle) * half * 0.55]);
    trace(context, sheen, false);
    context.stroke();
  }

  // ---------- blueprint part (0 to 2 s) ----------

  function blueprint(context, time) {
    context.fillStyle = BLUE.ground;
    context.fillRect(0, 0, SIZE, SIZE);
    // A slow push in, as in beat 2.
    const scale = lerp(1, 1.18, easeInOut(progress(time, 0, CUT)));
    context.save();
    context.translate(SIZE / 2, SIZE / 2);
    context.scale(scale, scale);
    context.translate(-SIZE / 2, -SIZE / 2);
    const egg = BLUEPRINT_EGG;
    trace(context, shellOutline(egg));
    context.strokeStyle = BLUE.line;
    context.lineWidth = 4;
    context.stroke();
    // The engrailed stripes of beat 2 fade as the grooves take their place.
    const stripesFade = 1 - progress(time, 0.1, 0.7);
    if (stripesFade > 0) {
      context.save();
      trace(context, shellOutline(egg));
      context.clip();
      context.globalAlpha = stripesFade * 0.85;
      context.fillStyle = BLUE.en;
      for (let stripe = 0; stripe < 14; stripe += 1) {
        const center = -0.44 + stripe * 0.08;
        trace(context, [eggPoint(egg, center - 0.011, -1.2), eggPoint(egg, center + 0.011, -1.2), eggPoint(egg, center + 0.011, 1.2), eggPoint(egg, center - 0.011, 1.2)]);
        context.fill();
      }
      context.restore();
    }
    const path = makePath([eggPoint(egg, 0.86, 0), eggPoint(egg, -0.84, 0)]);
    const swing = Math.sin(time * 9) * 0.25 * progress(time, 1.4, 1.7);
    const body = bodyGeometry(path, path.length, path.length, egg.halfWidth * 0.5, time, { swing });
    drawLarvaBlueprint(context, body, {
      grooves: progress(time, 0.2, 0.8),
      gut: easeOut(progress(time, 0.4, 1.2)),
      trachea: easeOut(progress(time, 1.0, 1.5)),
      hooks: progress(time, 1.2, 1.4),
      alpha: progress(time, 0, 0.5),
    });
    context.restore();
    label(context, "segments", 70, 110, progress(time, 0.3, 0.6));
    label(context, "trachea", 70, 145, progress(time, 1.0, 1.3));
    label(context, "mouth hooks", 70, 180, progress(time, 1.2, 1.5));
  }

  function label(context, text, x, y, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = BLUE.line;
    context.font = '24px Consolas, "Courier New", monospace';
    context.fillText(text, x, y);
    context.restore();
  }

  // ---------- paper part (2 to 6 s) ----------

  // Fruit flesh: plump cells packed together, each with an ink edge, a warm fill and a pale highlight.
  function fruitFlesh(context) {
    const base = context.createLinearGradient(0, 0, SIZE, SIZE);
    base.addColorStop(0, "#f7a54a");
    base.addColorStop(1, "#e87425");
    context.fillStyle = base;
    context.fillRect(0, 0, SIZE, SIZE);
    for (let row = -1; row < 12; row += 1) {
      for (let column = -1; column < 11; column += 1) {
        const x = column * 104 + (row % 2) * 52 + (hash(row, column, 1) - 0.5) * 30;
        const y = row * 92 + (hash(column, row, 2) - 0.5) * 26;
        const radiusX = 50 + hash(row, column, 3) * 10;
        const radiusY = 44 + hash(row, column, 4) * 10;
        const tilt = hash(row, column, 5) * Math.PI;
        // Rounded blob: an ellipse with a gentle wobble.
        const blob = Array.from({ length: 28 }, (unused, step) => {
          const turn = (step / 28) * Math.PI * 2;
          const wobble = 1 + 0.06 * Math.sin(turn * 3 + row + column);
          const localX = Math.cos(turn) * radiusX * wobble;
          const localY = Math.sin(turn) * radiusY * wobble;
          return [x + localX * Math.cos(tilt) - localY * Math.sin(tilt), y + localX * Math.sin(tilt) + localY * Math.cos(tilt)];
        });
        const fill = context.createRadialGradient(x - radiusX * 0.3, y - radiusY * 0.35, 4, x, y, radiusX * 1.1);
        fill.addColorStop(0, "rgba(255,214,140,0.95)");
        fill.addColorStop(0.6, "rgba(250,160,70,0.9)");
        fill.addColorStop(1, "rgba(222,96,34,0.95)");
        trace(context, blob);
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = "rgba(170,60,20,0.55)";
        context.lineWidth = 1.6;
        context.stroke();
        // Wet highlight: a short bright arc near the top left.
        context.strokeStyle = "rgba(255,250,235,0.85)";
        context.lineWidth = 3;
        context.lineCap = "round";
        context.beginPath();
        context.ellipse(x - radiusX * 0.15, y - radiusY * 0.15, radiusX * 0.6, radiusY * 0.55, tilt, Math.PI * 1.1, Math.PI * 1.45);
        context.stroke();
        context.fillStyle = "rgba(255,255,255,0.8)";
        context.beginPath();
        context.arc(x - radiusX * 0.42, y - radiusY * 0.4, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Juice droplets.
    for (let drop = 0; drop < 9; drop += 1) {
      const x = hash(drop, 31) * SIZE;
      const y = hash(drop, 32) * SIZE;
      const radius = 8 + hash(drop, 33) * 14;
      context.fillStyle = "rgba(255,236,200,0.55)";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(190,80,25,0.6)";
      context.lineWidth = 1.4;
      context.stroke();
      context.fillStyle = "rgba(255,255,255,0.95)";
      context.beginPath();
      context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.25, 0, Math.PI * 2);
      context.fill();
    }
    // A broad sheen across the wet surface.
    const sheen = context.createLinearGradient(0, SIZE * 0.2, SIZE, SIZE * 0.6);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,248,230,0.18)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = sheen;
    context.fillRect(0, 0, SIZE, SIZE);
  }

  function yeastPaste(context, centerX, centerY, radius, seed) {
    const outline = [];
    for (let step = 0; step < 50; step += 1) {
      const turn = (step / 50) * Math.PI * 2;
      const reach = radius * (1 + 0.12 * Math.sin(turn * 5 + seed) + 0.06 * Math.sin(turn * 11));
      outline.push([centerX + Math.cos(turn) * reach, centerY + Math.sin(turn) * reach * 0.8]);
    }
    trace(context, outline);
    context.fillStyle = "#e8d6a8";
    context.fill();
    context.save();
    trace(context, outline);
    context.clip();
    context.fillStyle = "rgba(150,110,60,0.45)";
    for (let speck = 0; speck < 200; speck += 1) {
      context.fillRect(centerX + (hash(speck, seed) - 0.5) * radius * 2.2, centerY + (hash(seed, speck) - 0.5) * radius * 1.8, 1.6, 1.6);
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = "rgba(110,70,30,0.8)";
    context.lineWidth = 2;
    context.stroke();
  }

  function yeastCluster(context, centerX, centerY, time) {
    for (let cell = 0; cell < 16; cell += 1) {
      const turn = cell * 2.4;
      const distance = 18 + Math.sqrt(cell) * 22;
      const x = centerX + Math.cos(turn) * distance;
      const y = centerY + Math.sin(turn) * distance * 0.8;
      const radiusX = 13 + hash(cell, 1) * 5;
      const radiusY = 10 + hash(cell, 2) * 3;
      const tilt = hash(cell, 3) * Math.PI;
      context.fillStyle = "#f5ecd6";
      context.beginPath();
      context.ellipse(x, y, radiusX, radiusY, tilt, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 1.6;
      context.stroke();
      context.fillStyle = "rgba(120,90,60,0.5)";
      context.beginPath();
      context.arc(x + 2, y + 1, 3.5, 0, Math.PI * 2);
      context.fill();
      // A bud on some of them.
      if (hash(cell, 4) > 0.55) {
        const budX = x + Math.cos(tilt) * radiusX * 1.05;
        const budY = y + Math.sin(tilt) * radiusX * 1.05;
        context.fillStyle = "#f5ecd6";
        context.beginPath();
        context.arc(budX, budY, 5 + 2 * Math.sin(time * 2 + cell), 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }
  }

  function paperEgg(context, time, split, empty) {
    const egg = PAPER_EGG;
    const squash = lerp(1, 0.8, empty);
    const outline = shellOutline(egg, { squash });
    const forward = AXIS + Math.PI;
    [-1, 1].forEach((side) => {
      const [rootX, rootY] = eggPoint(egg, -0.73 + side * 0.03, shellV(-0.73 + side * 0.03, true) * 0.96 * squash);
      const direction = forward - side * 0.16 - 0.22;
      const [tipX, tipY] = [rootX + Math.cos(direction) * 210, rootY + Math.sin(direction) * 210];
      context.strokeStyle = NAVY;
      context.lineWidth = 2.6;
      context.beginPath();
      context.moveTo(rootX, rootY);
      context.lineTo(tipX, tipY);
      context.stroke();
      context.fillStyle = "rgba(245,238,220,0.95)";
      context.beginPath();
      context.ellipse(tipX - Math.cos(direction) * 34, tipY - Math.sin(direction) * 34, 42, 15, direction, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
    trace(context, outline);
    context.fillStyle = `rgba(250,245,230,${lerp(0.45, 0.85, empty)})`;
    context.fill();
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = "rgba(120,110,90,0.22)";
    context.lineWidth = 1;
    for (let row = -12; row <= 12; row += 1) {
      for (let column = -26; column <= 26; column += 1) {
        const [x, y] = eggPoint(egg, column * 0.05 + (row % 2) * 0.025, row * 0.09);
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = (corner / 6) * Math.PI * 2;
          context.lineTo(x + Math.cos(turn) * 7.5, y + Math.sin(turn) * 7.5);
        }
        context.closePath();
        context.stroke();
      }
    }
    if (empty > 0) {
      context.strokeStyle = `rgba(80,60,40,${0.6 * empty})`;
      context.lineWidth = 1.6;
      for (let wrinkle = 0; wrinkle < 9; wrinkle += 1) {
        const u = -0.7 + hash(wrinkle, 7) * 1.4;
        const v = -0.6 + hash(wrinkle, 8) * 1.2;
        const [startX, startY] = eggPoint(egg, u, v * squash);
        const [endX, endY] = eggPoint(egg, u + (hash(wrinkle, 9) - 0.5) * 0.5, (v + (hash(wrinkle, 10) - 0.5) * 0.8) * squash);
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo((startX + endX) / 2 + (hash(wrinkle, 11) - 0.5) * 40, (startY + endY) / 2 + (hash(wrinkle, 12) - 0.5) * 40, endX, endY);
        context.stroke();
      }
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    // The cap at the front (the operculum) pops off and tips aside as the larva cuts its way out.
    if (split > 0) {
      const cap = [];
      for (let step = 0; step <= 24; step += 1) {
        const turn = -Math.PI / 2 + (step / 24) * Math.PI;
        cap.push(eggPoint(egg, -0.84 - Math.cos(turn) * 0.16, Math.sin(turn) * 0.52));
      }
      const [capX, capY] = eggPoint(egg, -0.92, 0);
      const pop = easeOut(split);
      const offsetX = -60 * pop;
      const offsetY = -70 * pop;
      const tilt = -0.9 * pop;
      const moved = cap.map(([x, y]) => {
        const deltaX = x - capX;
        const deltaY = y - capY;
        return [capX + offsetX + deltaX * Math.cos(tilt) - deltaY * Math.sin(tilt), capY + offsetY + deltaX * Math.sin(tilt) + deltaY * Math.cos(tilt)];
      });
      // The opening left behind.
      trace(context, cap);
      context.fillStyle = "rgba(60,40,25,0.35)";
      context.fill();
      trace(context, moved);
      context.fillStyle = "rgba(250,245,230,0.95)";
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 2.2;
      context.stroke();
    }
  }

  function paper(context, time) {
    Ink.paper(context, SIZE);
    fruitFlesh(context);
    yeastPaste(context, 230, 880, 95, 4);
    const local = time - CUT;
    // On the beat: the cap pops in one beat (local 1.0 = film 3.0 s), the larva crawls out in four beats, one
    // peristaltic push per beat.
    const split = progress(local, 1.0, 1.5);
    const crawlOut = progress(local, 1.5, 3.5);
    const empty = progress(local, 2.5, 3.5);
    const egg = PAPER_EGG;
    // The path runs from the back of the egg, out of its front, and curves toward the yeast.
    const path = smoothPath([
      eggPoint(egg, 1.6, 0), eggPoint(egg, 0, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.5, 0.15), [300, 760], [250, 850], [230, 920],
    ]);
    const bodyLength = egg.halfLength * 2 * 0.86;
    const startHead = makePath([eggPoint(egg, 1.6, 0), eggPoint(egg, -0.84, 0)]).length;
    // It moves forward in pulses, one per peristaltic wave.
    const pulses = crawlOut * 4;
    const advance = (Math.floor(pulses) + easeInOut(pulses % 1)) / 4;
    // Stop with the head at the yeast, never past the end of the path.
    const headDistance = lerp(startHead, Math.min(startHead + 560, path.length - 40), advance) + Math.sin(local * 3) * 3 * (1 - crawlOut);
    const inside = local < 1.5;
    const swing = inside ? Math.sin(local * 4 * Math.PI) * 0.35 * progress(local, 0.0, 0.3) : Math.sin(local * 5) * 0.15;
    const body = bodyGeometry(path, headDistance, bodyLength, egg.halfWidth * 0.44, time, { crawling: !inside, swing });
    // Inside the egg, draw the larva under the translucent shell; once out, over it.
    if (inside) {
      drawLarvaPaper(context, body, time);
      paperEgg(context, time, split, 0);
    } else {
      paperEgg(context, time, split, empty);
      drawLarvaPaper(context, body, time);
    }
    Ink.finish(context, SIZE, 0.25);
  }

  function renderAt(context, time) {
    Ink.setTime(time);
    if (time < CUT) {
      blueprint(context, time);
    } else {
      paper(context, time);
    }
  }

  return { renderAt: Ink.onBeat(renderAt), DURATION, smoothPath, bodyGeometry, drawLarvaPaper, fruitFlesh, yeastCluster };
})();
