// Practice piece: the opening frame of Kevin Ngo's "life of a fruit fly", redrawn to learn the look (not for posting).
// The look comes from thousands of short strokes, thin outlines, visible construction lines and iridescent wings.
"use strict";

const Fly = (() => {
  const { hash, lerp, clamp } = Ink;
  const NAVY = "#1d1f33";

  function rotatePoint([x, y], angle) {
    return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
  }

  function tracePath(context, points, closed = true) {
    context.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    if (closed) {
      context.closePath();
    }
  }

  function ellipse(centerX, centerY, radiusX, radiusY, rotation = 0, count = 48) {
    return Array.from({ length: count }, (unused, index) => {
      const turn = (index / count) * Math.PI * 2;
      const [x, y] = rotatePoint([Math.cos(turn) * radiusX, Math.sin(turn) * radiusY], rotation);
      return [centerX + x, centerY + y];
    });
  }

  // Many short strokes inside a clip; `density` decides, per point, whether a stroke lands there.
  function strokeField(context, box, { count, color, width = 1, length = [6, 14], angleAt, density = () => 1, seed = 1, alpha = 1 }) {
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.beginPath();
    for (let index = 0; index < count; index += 1) {
      const x = lerp(box[0], box[2], hash(index, seed, 1));
      const y = lerp(box[1], box[3], hash(index, seed, 2));
      if (hash(index, seed, 3) > density(x, y)) {
        continue;
      }
      const angle = angleAt(x, y) + (hash(index, seed, 4) - 0.5) * 0.4;
      const strokeLength = lerp(length[0], length[1], hash(index, seed, 5));
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * strokeLength, y + Math.sin(angle) * strokeLength);
    }
    context.stroke();
    context.restore();
  }

  function background(context) {
    context.fillStyle = "#ece6d8";
    context.fillRect(0, 0, 1080, 1080);
    // Diagonal bands of pale yellow, each built from fine parallel lines.
    const direction = -0.62;
    for (let band = -3; band < 5; band += 1) {
      const offset = band * 330 + 120;
      context.save();
      context.translate(540, 540);
      context.rotate(direction);
      context.beginPath();
      context.rect(-1000, offset - 70, 2000, 120);
      context.clip();
      context.fillStyle = "rgba(240,214,150,0.45)";
      context.fillRect(-1000, offset - 70, 2000, 120);
      context.strokeStyle = "rgba(214,170,80,0.35)";
      context.lineWidth = 1;
      context.beginPath();
      for (let line = -70; line < 50; line += 3) {
        context.moveTo(-1000, offset + line + hash(line, band) * 1.5);
        context.lineTo(1000, offset + line);
      }
      context.stroke();
      context.restore();
    }
    strokeField(context, [0, 0, 1080, 1080], { count: 900, color: "#9c8f74", width: 0.8, length: [1, 3], angleAt: () => 0.4, seed: 7, alpha: 0.4 });
  }

  function orange(context, centerX, centerY, radius) {
    const outline = ellipse(centerX, centerY, radius, radius, 0, 160);
    context.save();
    tracePath(context, outline);
    context.fillStyle = "#ef9d63";
    context.fill();
    context.clip();
    const box = [0, 0, 1080, 1080];
    // Uneven washes of tone, not rings.
    Ink.blotches(context, { left: 0, top: 200, right: 1080, bottom: 1080 }, { colors: ["rgba(246,176,120,ALPHA)", "rgba(222,120,72,ALPHA)", "rgba(200,90,70,ALPHA)"], count: 18, alpha: 0.5, seed: 9 });
    const light = [150, 520];
    const shade = (x, y) => clamp((Math.hypot(x - light[0], y - light[1]) - 220) / 900);
    // Light: scattered pale flecks at loose angles. Shadow: sketched clusters in red, then darker red in the core.
    sketchShade(context, box, { darkness: (x, y) => (1 - shade(x, y)) ** 2, clusters: 650, color: "#fff2df", alpha: 0.7, baseAngle: -0.9, spread: 1.4, seed: 11, width: 1.3 });
    sketchShade(context, box, { darkness: (x, y) => shade(x, y) ** 2.4 * 1.4, clusters: 1500, color: "#cc4560", alpha: 0.7, baseAngle: 0.5, spread: 1.6, seed: 12, width: 1.4 });
    sketchShade(context, box, { darkness: (x, y) => shade(x, y) ** 3 * 1.4, clusters: 900, color: "#8e2a3c", alpha: 0.65, baseAngle: 0.9, spread: 1.4, seed: 13, width: 1.3 });
    context.restore();
    tracePath(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    context.strokeStyle = "rgba(120,140,190,0.55)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(centerX - 6, centerY - 14, radius + 22, 0, Math.PI * 2);
    context.stroke();
  }

  function droplet(context, x, y) {
    context.save();
    context.filter = "blur(3px)";
    context.fillStyle = "rgba(120,40,15,0.35)";
    context.beginPath();
    context.ellipse(x + 8, y + 10, 30, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    const outline = ellipse(x, y, 30, 24, 0, 40);
    context.save();
    tracePath(context, outline);
    context.fillStyle = "#f7d9bf";
    context.fill();
    context.clip();
    strokeField(context, [x - 32, y - 26, x + 32, y + 26], { count: 900, color: "#c0622f", width: 1, length: [4, 10], angleAt: () => 0.1, density: (px, py) => clamp((py - y + 4) / 26) ** 1.2, seed: 41, alpha: 0.7 });
    strokeField(context, [x - 32, y - 26, x + 32, y + 26], { count: 500, color: "#ffffff", width: 1.2, length: [3, 7], angleAt: () => -0.6, density: (px, py) => clamp((y - py) / 22), seed: 42, alpha: 0.7 });
    context.restore();
    tracePath(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.ellipse(x - 11, y - 9, 7, 4.5, -0.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + 9, y + 9, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  function ruler(context) {
    context.strokeStyle = "rgba(90,90,110,0.55)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(40, 780);
    context.lineTo(40, 1030);
    for (let tick = 0; tick <= 25; tick += 1) {
      const y = 780 + tick * 10;
      context.moveTo(40, y);
      context.lineTo(tick % 5 === 0 ? 50 : 45, y);
    }
    context.stroke();
  }

  // A leg: three segments with bristles along them and a forked tip, in the fly's frame.
  function leg(context, joints, place) {
    const [hip, knee, ankle, tip] = place(joints);
    const coxaEnd = [lerp(hip[0], knee[0], 0.18), lerp(hip[1], knee[1], 0.18)];
    const segments = [
      { from: hip, to: coxaEnd, startWidth: 13, endWidth: 11, bristles: 0 },
      { from: coxaEnd, to: knee, startWidth: 10, endWidth: 8, bristles: 9 },
      { from: knee, to: ankle, startWidth: 7.5, endWidth: 6, bristles: 8 },
    ];
    for (let index = 0; index < 5; index += 1) {
      const startAmount = index / 5;
      const endAmount = (index + 1) / 5;
      segments.push({
        from: [lerp(ankle[0], tip[0], startAmount), lerp(ankle[1], tip[1], startAmount)],
        to: [lerp(ankle[0], tip[0], endAmount), lerp(ankle[1], tip[1], endAmount)],
        startWidth: lerp(5, 3.4, startAmount),
        endWidth: lerp(4.4, 3, endAmount),
        bristles: 0,
      });
    }
    segments.forEach((segment, index) => legSegment(context, segment, index));
    // Claws: two small hooks at the tip.
    const tipAngle = Math.atan2(tip[1] - ankle[1], tip[0] - ankle[0]);
    context.strokeStyle = "#2a1a10";
    context.lineWidth = 1.6;
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.moveTo(tip[0], tip[1]);
      context.quadraticCurveTo(
        tip[0] + Math.cos(tipAngle + side * 0.5) * 9, tip[1] + Math.sin(tipAngle + side * 0.5) * 9,
        tip[0] + Math.cos(tipAngle + side * 1.3) * 11, tip[1] + Math.sin(tipAngle + side * 1.3) * 11,
      );
      context.stroke();
    });
  }

  function legSegment(context, { from, to, startWidth, endWidth, bristles }, index) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // A tube that swells a little in the middle, the way a femur does.
    const left = [];
    const right = [];
    for (let step = 0; step <= 10; step += 1) {
      const amount = step / 10;
      const half = (lerp(startWidth, endWidth, amount) / 2) * (1 + 0.18 * Math.sin(amount * Math.PI));
      const x = lerp(from[0], to[0], amount);
      const y = lerp(from[1], to[1], amount);
      left.push([x + normalX * half, y + normalY * half]);
      right.push([x - normalX * half, y - normalY * half]);
    }
    const outline = [...left, ...right.reverse()];
    tracePath(context, outline);
    context.fillStyle = index % 2 ? "#7a5634" : "#6a4a2c";
    context.fill();
    // Shade the lower side with strokes along the segment.
    context.save();
    tracePath(context, outline);
    context.clip();
    context.strokeStyle = "rgba(30,15,6,0.65)";
    context.lineWidth = 0.9;
    context.beginPath();
    for (let line = 0; line < Math.max(2, length / 5); line += 1) {
      const amount = (line + 0.5) / Math.max(2, length / 5);
      const half = lerp(startWidth, endWidth, amount) / 2;
      const x = lerp(from[0], to[0], amount) - normalX * half * 0.35;
      const y = lerp(from[1], to[1], amount) - normalY * half * 0.35;
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * 6 - normalX * half * 0.6, y + Math.sin(angle) * 6 - normalY * half * 0.6);
    }
    context.stroke();
    context.restore();
    tracePath(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 1.3;
    context.stroke();
    // The joint at the far end: a small darker ring.
    context.fillStyle = "#2e1c10";
    context.beginPath();
    context.ellipse(to[0], to[1], endWidth * 0.55, endWidth * 0.45, angle, 0, Math.PI * 2);
    context.fill();
    // Bristles on the outer side, leaning toward the tip.
    if (bristles > 0) {
      context.strokeStyle = "#2a1a10";
      context.lineWidth = 1;
      context.beginPath();
      for (let bristle = 0; bristle < bristles; bristle += 1) {
        const amount = (bristle + 0.5) / bristles;
        const half = lerp(startWidth, endWidth, amount) / 2;
        const x = lerp(from[0], to[0], amount) + normalX * half;
        const y = lerp(from[1], to[1], amount) + normalY * half;
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle + 0.9) * 7, y + Math.sin(angle + 0.9) * 7);
      }
      context.stroke();
    }
  }

  // pigment 0 is the white eye of a young pupa, 1 the adult's red.
  function eyeColor(red, white, pigment) {
    const parse = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    const [from, to] = [parse(white), parse(red)];
    return `rgb(${from.map((channel, index) => Math.round(lerp(channel, to[index], pigment))).join(",")})`;
  }

  function compoundEye(context, centerX, centerY, radiusX, radiusY, rotation, seed, pigment = 1) {
    const outline = ellipse(centerX, centerY, radiusX, radiusY, rotation, 48);
    context.save();
    tracePath(context, outline);
    context.fillStyle = eyeColor("#8e1520", "#e8dfc8", pigment);
    context.fill();
    context.clip();
    const facet = 7.5;
    for (let row = -14; row <= 14; row += 1) {
      for (let column = -14; column <= 14; column += 1) {
        const [offsetX, offsetY] = rotatePoint([column * facet + (row % 2) * facet * 0.5, row * facet * 0.87], rotation);
        const x = centerX + offsetX;
        const y = centerY + offsetY;
        const lightness = clamp(1 - Math.hypot(x - (centerX - radiusX * 0.35), y - (centerY - radiusY * 0.35)) / (radiusX * 0.5));
        context.fillStyle = lightness > 0.2 ? eyeColor("#f08c8c", "#fffaf0", pigment) : hash(row, column, seed) > 0.5 ? eyeColor("#b52532", "#f2ead6", pigment) : eyeColor("#a01c2a", "#ebe2cc", pigment);
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = (corner / 6) * Math.PI * 2 + Math.PI / 6;
          context.lineTo(x + Math.cos(turn) * facet * 0.5, y + Math.sin(turn) * facet * 0.5);
        }
        context.closePath();
        context.fill();
        context.strokeStyle = "rgba(70,5,12,0.55)";
        context.lineWidth = 0.8;
        context.stroke();
      }
    }
    // The dark pseudopupil.
    context.fillStyle = eyeColor("#2a0508", "#cfc4aa", pigment);
    [[0, 0], [-6, 4], [6, 4], [0, 8], [-4, -5]].forEach(([dotX, dotY]) => {
      const [rotatedX, rotatedY] = rotatePoint([dotX + radiusX * 0.05, dotY + radiusY * 0.2], rotation);
      context.beginPath();
      context.arc(centerX + rotatedX, centerY + rotatedY, 3.2, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
    tracePath(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
  }

  // A wing: a long oval from the shoulder down the side of the abdomen, milky like a soap film, with soft rainbow
  // contours and faint veins. Local units are pixels on Kevin's 1080 frame (thorax 210 x 225).
  function smoothClosed(controls, perSegment = 8) {
    const points = [];
    const count = controls.length;
    for (let index = 0; index < count; index += 1) {
      const previous = controls[(index - 1 + count) % count];
      const current = controls[index];
      const next = controls[(index + 1) % count];
      const after = controls[(index + 2) % count];
      for (let step = 0; step < perSegment; step += 1) {
        const t = step / perSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        points.push([0, 1].map((axis) => 0.5 * ((2 * current[axis]) + (-previous[axis] + next[axis]) * t + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - after[axis]) * t2 + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + after[axis]) * t3)));
      }
    }
    return points;
  }

  function wingOutline(side) {
    const controls = [
      [78, 55], [108, 150], [126, 280], [116, 420], [80, 520], [35, 565],
      [0, 545], [-22, 470], [-30, 360], [-12, 230], [22, 130], [52, 70],
    ];
    return smoothClosed(controls.map(([x, y]) => [side * x, y]));
  }

  function wing(context, place, side, seed, spread = 1, open = 0) {
    // Opening swings the whole wing (veins too) outward about its hinge.
    if (open !== 0) {
      const flatPlace = place;
      const turn = -side * open;
      place = (points) => flatPlace(points.map(([pointX, pointY]) => {
        const deltaX = pointX - side * 75;
        const deltaY = pointY - 60;
        return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
      }));
    }
    // A wing not yet expanded is a small crumpled pad near the hinge: shrink toward the hinge and add folds.
    const hingeX = side * 75;
    const hingeY = 60;
    const outline = wingOutline(side).map(([pointX, pointY], index) => {
      const crumple = (1 - spread) * Math.sin(index * 1.7) * 14;
      return [hingeX + (pointX - hingeX) * (0.45 + 0.55 * spread) + crumple, hingeY + (pointY - hingeY) * (0.3 + 0.7 * spread) + crumple * 0.6];
    });
    const placed = place(outline);
    context.save();
    tracePath(context, placed);
    context.fillStyle = "rgba(255,255,255,0.09)";
    context.fill();
    context.clip();
    // Rainbow film in the middle of the wing, a few soft loops.
    ["#e45ac8", "#f5e25a", "#55d8d0", "#92e266"].forEach((color, layer) => {
      const shrink = 0.6 - layer * 0.1;
      const loop = outline.map(([pointX, pointY], index) => {
        const wobble = Math.sin(index * 0.3 + layer * 1.7 + seed) * 6 + Math.sin(index * 0.8 + layer) * 2;
        return [side * 45 + (pointX - side * 45) * shrink + wobble, 320 + (pointY - 320) * shrink + wobble * 0.8 - layer * 8];
      });
      tracePath(context, place(loop));
      context.strokeStyle = color;
      context.globalAlpha = 0.85;
      context.lineWidth = 1.5;
      context.stroke();
    });
    context.globalAlpha = 1;
    // Veins fan from the hinge toward the tip.
    context.strokeStyle = "rgba(60,45,35,0.4)";
    context.lineWidth = 1;
    [[110, 300, 105, 440], [80, 300, 70, 500], [45, 300, 35, 540], [10, 280, -5, 470]].forEach(([middleX, middleY, endX, endY]) => {
      tracePath(context, place([[side * 75, 60], [side * middleX, middleY], [side * endX, endY]]), false);
      context.stroke();
    });
    context.restore();
    tracePath(context, placed);
    context.strokeStyle = "rgba(45,40,45,0.75)";
    context.lineWidth = 1.4;
    context.stroke();
  }

  // Darken the far side of a shape with a soft gradient and a few hatch strokes, for form and contrast.
  function sketchShade(context, box, { darkness, clusters, color, alpha = 0.6, baseAngle = 0.7, spread = 1.1, seed = 1, width = 1 }) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.globalAlpha = alpha;
    context.beginPath();
    for (let cluster = 0; cluster < clusters; cluster += 1) {
      const x = lerp(box[0], box[2], hash(cluster, seed, 1));
      const y = lerp(box[1], box[3], hash(cluster, seed, 2));
      const amount = darkness(x, y);
      // A little noise so the edge of a shadow breaks up like a hand would leave it.
      if (hash(cluster, seed, 3) > amount * (0.75 + hash(Math.floor(x / 40), Math.floor(y / 40), seed) * 0.5)) {
        continue;
      }
      const angle = baseAngle + (hash(cluster, seed, 4) - 0.5) * spread;
      const strokes = 3 + Math.floor(hash(cluster, seed, 5) * (3 + amount * 6));
      const length = 6 + hash(cluster, seed, 6) * (8 + amount * 22);
      const gap = 2.2 + hash(cluster, seed, 7) * 1.6;
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      for (let stroke = 0; stroke < strokes; stroke += 1) {
        const offset = (stroke - strokes / 2) * gap;
        const jitter = (hash(cluster, stroke, seed) - 0.5) * length * 0.4;
        const startX = x + normalX * offset + Math.cos(angle) * jitter;
        const startY = y + normalY * offset + Math.sin(angle) * jitter;
        const strokeLength = length * (0.7 + hash(stroke, cluster, seed) * 0.5);
        context.moveTo(startX, startY);
        context.lineTo(startX + Math.cos(angle) * strokeLength, startY + Math.sin(angle) * strokeLength);
      }
    }
    context.stroke();
    context.restore();
  }

  function shadeForm(context, placedOutline, from, to, strength) {
    const box = boxOf(placedOutline);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const directionX = (to[0] - from[0]) / length;
    const directionY = (to[1] - from[1]) / length;
    const darkness = (x, y) => clamp(((x - from[0]) * directionX + (y - from[1]) * directionY) / length) ** 1.3 * strength * 1.8;
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    context.save();
    tracePath(context, placedOutline);
    context.clip();
    sketchShade(context, box, { darkness, clusters: Math.round(area / 90), color: "#2b1406", alpha: 0.55, baseAngle: Math.atan2(directionY, directionX) + 1.2, seed: Math.round(from[0] + from[1]) });
    context.restore();
  }

  function boxOf(points) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  function fly(context, { x, y, angle, scale = 1, seed = 1, wingSpread = 1, wingOpen = 0, legSwing = 0, legTime = 0, legsFree = [1, 1, 1], eyePigment = 1, wingBeat = 0, height = 0, male = false, songSide = 0, songOpen = 0, songTime = 0 }) {
    const place = (points) => points.map((point) => {
      const [rotatedX, rotatedY] = rotatePoint([point[0] * scale, point[1] * scale], angle);
      return [x + rotatedX, y + rotatedY];
    });
    const along = angle + Math.PI / 2;

    // A soft cast shadow on the orange, down and to the right of the body.
    context.save();
    // Off the ground the shadow drops away, spreads and fades.
    context.filter = `blur(${18 + height * 0.08}px)`;
    context.fillStyle = `rgba(90,25,10,${0.18 / (1 + height / 150)})`;
    tracePath(context, place(ellipse(40, 230, 170, 330, 0, 40)).map(([px, py]) => [px + 30 + height * 0.6, py + 26 + height]));
    context.fill();
    context.restore();

    // Legs built from segment angles, so every knee bends the way a fly's does. Hips sit under the thorax near the
    // midline; the knee is always the outermost point and the bend opens toward the body. Angles are for the right
    // side (0 = straight out, negative = forward); lengths at 1 mm = 240 px (femur and tibia about 0.5 mm each).
    const LEGS = [
      { hip: [30, -50], femur: [-0.9, 85], tibia: [-1.3, 80], tarsus: [-1.45, 60] },
      { hip: [40, 15], femur: [-0.2, 100], tibia: [0.4, 85], tarsus: [0.65, 60] },
      { hip: [35, 70], femur: [0.6, 105], tibia: [1.1, 95], tarsus: [1.3, 65] },
    ];
    // legSwing makes the legs reach and grab (front pair most), the two sides out of step.
    const SWING_BY_PAIR = [0.7, 0.4, 0.25];
    // Folded against the body, pointing back, as the legs lie inside the pupal case.
    const FOLDED = [1.3, 1.55, 1.6];
    [-1, 1].forEach((side) => {
      LEGS.forEach(({ hip, femur, tibia, tarsus }, pair) => {
        const swing = legSwing * SWING_BY_PAIR[pair] * Math.sin(legTime * 14 + (side > 0 ? 0 : Math.PI / 2) + pair * 1.3);
        const joints = [[side * hip[0], hip[1]]];
        [femur, tibia, tarsus].forEach(([segmentAngle, length], segment) => {
          const [lastX, lastY] = joints[joints.length - 1];
          const free = legsFree[pair];
          const bent = lerp(FOLDED[segment], segmentAngle, free) + swing * free * (1 + segment * 0.4);
          const reach = length * lerp(0.75, 1, free);
          joints.push([lastX + side * Math.cos(bent) * reach, lastY + Math.sin(bent) * reach]);
        });
        leg(context, joints, place);
      });
    });

    // Abdomen: 225 x 350, banded, hatched, darker on the side away from the light.
    const abdomen = [];
    for (let index = 0; index <= 48; index += 1) {
      const turn = (index / 48) * Math.PI * 2;
      const lower = Math.sin(turn) > 0;
      const pinch = lower ? 1 - 0.45 * Math.sin(turn) ** 3 : 1;
      const malePinch = male && lower ? 1 - 0.25 * Math.sin(turn) ** 3 : 1;
      abdomen.push([Math.cos(turn) * 112 * pinch / malePinch * (male ? 0.92 : 1), 285 + Math.sin(turn) * (lower ? (male ? 140 : 185) : 165)]);
    }
    const abdomenPlaced = place(abdomen);
    context.save();
    tracePath(context, abdomenPlaced);
    context.fillStyle = "#c98d4e";
    context.fill();
    context.clip();
    for (let band = 0; band < 6; band += 1) {
      const top = 165 + band * 52;
      const bandPoints = [];
      for (let step = 0; step <= 20; step += 1) {
        const across = -130 + step * 13;
        bandPoints.push([across, top + 16 - (across / 130) ** 2 * 18]);
      }
      for (let step = 20; step >= 0; step -= 1) {
        const across = -130 + step * 13;
        bandPoints.push([across, top + 42 - (across / 130) ** 2 * 18]);
      }
      tracePath(context, place(bandPoints));
      context.fillStyle = "#4a2414";
      context.fill();
    }
    if (male) {
      const cap = [];
      for (let step = 0; step <= 20; step += 1) {
        const across = -130 + step * 13;
        cap.push([across, 330 - (across / 130) ** 2 * 18]);
      }
      cap.push([130, 520], [-130, 520]);
      tracePath(context, place(cap));
      context.fillStyle = "#1c0e08";
      context.fill();
    }
    const abdomenBox = boxOf(abdomenPlaced);
    strokeField(context, abdomenBox, { count: 5200, color: "#2e1508", width: 1, length: [5, 12], angleAt: () => along + 0.15, seed: seed + 3, alpha: 0.45 });
    strokeField(context, abdomenBox, { count: 1600, color: "#f0c890", width: 1, length: [4, 9], angleAt: () => along, seed: seed + 4, alpha: 0.3 });
    context.restore();
    shadeForm(context, abdomenPlaced, place([[-110, 200]])[0], place([[120, 380]])[0], 0.32);
    tracePath(context, abdomenPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();

    // Thorax: 210 x 225, fur along the body, a darker lower half, then the scutellum.
    const thoraxPlaced = place(ellipse(0, 0, 98, 122, 0, 56));
    const [thoraxX, thoraxY] = place([[0, 0]])[0];
    context.save();
    tracePath(context, thoraxPlaced);
    const body = context.createRadialGradient(thoraxX - 35, thoraxY - 45, 10, thoraxX, thoraxY, 140);
    body.addColorStop(0, "#dcab6c");
    body.addColorStop(1, "#a06a36");
    context.fillStyle = body;
    context.fill();
    context.clip();
    const thoraxBox = boxOf(thoraxPlaced);
    strokeField(context, thoraxBox, { count: 4200, color: "#5a3a1c", width: 1, length: [5, 11], angleAt: (px) => along + (px - thoraxX) / 280, density: (px, py) => 0.35 + 0.65 * clamp((py - thoraxY + 100) / 200), seed: seed + 5, alpha: 0.5 });
    strokeField(context, thoraxBox, { count: 2000, color: "#f2d29a", width: 1, length: [4, 9], angleAt: (px) => along + (px - thoraxX) / 280, density: (px, py) => clamp(1 - (py - thoraxY + 60) / 160), seed: seed + 6, alpha: 0.4 });
    context.restore();
    shadeForm(context, thoraxPlaced, place([[-60, -60]])[0], place([[70, 110]])[0], 0.3);
    tracePath(context, thoraxPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    const scutellum = place(ellipse(0, 100, 52, 28, 0, 32));
    tracePath(context, scutellum);
    context.fillStyle = "rgba(118,58,24,0.9)";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 2.2;
    context.stroke();

    // Wings on top of the abdomen.
    // At 200 beats a second every frame catches a new phase: the wings read as a fan of faint outlines between the
    // top and the bottom of the stroke, strongest at the two ends.
    if (wingBeat > 0) {
      const STROKE_TOP = -0.15;
      const STROKE_BOTTOM = 1.45;
      [-1, 1].forEach((side) => {
        for (let ghost = 0; ghost <= 12; ghost += 1) {
          const open = lerp(STROKE_TOP, STROKE_BOTTOM, ghost / 12);
          // The ends of the stroke are where the wing slows down and turns, so they show strongest.
          const dwell = ghost === 0 || ghost === 12 ? 2.4 : 1;
          const turn = -side * open;
          const outline = wingOutline(side).map(([pointX, pointY]) => {
            const deltaX = pointX - side * 75;
            const deltaY = pointY - 60;
            return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
          });
          tracePath(context, place(outline));
          context.fillStyle = `rgba(255,255,255,${0.04 * wingBeat * dwell})`;
          context.fill();
          context.strokeStyle = `rgba(60,70,110,${0.16 * wingBeat * dwell})`;
          context.lineWidth = 1;
          context.stroke();
        }

      });
    } else {
      [-1, 1].forEach((side) => {
        if (side !== songSide || songOpen <= 0) {
          wing(context, place, side, seed + side, wingSpread, wingOpen);
          return;
        }
        // The song wing: swung out to about 90° and vibrating, a few faint copies around it.
        const open = songOpen * 1.5;
        [-0.12, 0.12].forEach((offset, copy) => {
          const turn = -side * (open + offset * Math.sin(songTime * 90 + copy));
          const outline = wingOutline(side).map(([pointX, pointY]) => {
            const deltaX = pointX - side * 75;
            const deltaY = pointY - 60;
            return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
          });
          tracePath(context, place(outline));
          context.strokeStyle = "rgba(60,70,110,0.3)";
          context.lineWidth = 1;
          context.stroke();
        });
        wing(context, place, side, seed + side, wingSpread, open + 0.05 * Math.sin(songTime * 120));
      });
    }

    // Head (about 140 wide), ocelli, short feathered antennae, then eyes of about 95 x 110.
    const headPlaced = place(ellipse(0, -140, 100, 56, 0, 40));
    tracePath(context, headPlaced);
    context.fillStyle = "#cc955b";
    context.fill();
    shadeForm(context, headPlaced, place([[-40, -170]])[0], place([[40, -100]])[0], 0.22);
    tracePath(context, headPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    context.fillStyle = "#a8282e";
    [[0, -160], [-11, -146], [11, -146]].forEach(([dotX, dotY]) => {
      const [px, py] = place([[dotX, dotY]])[0];
      context.beginPath();
      context.arc(px, py, 3.5, 0, Math.PI * 2);
      context.fill();
    });
    [-1, 1].forEach((side) => {
      const knob = place(ellipse(side * 18, -186, 11, 15, 0, 20));
      tracePath(context, knob);
      context.fillStyle = "#c08550";
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 1.8;
      context.stroke();
      const [fromX, fromY] = place([[side * 20, -198]])[0];
      const [toX, toY] = place([[side * 58, -240]])[0];
      const featherAngle = Math.atan2(toY - fromY, toX - fromX);
      context.strokeStyle = "#3b2a1c";
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      for (let step = 8; step < Math.hypot(toX - fromX, toY - fromY); step += 6) {
        const px = fromX + Math.cos(featherAngle) * step;
        const py = fromY + Math.sin(featherAngle) * step;
        [-0.9, 0.9].forEach((spread) => {
          context.moveTo(px, py);
          context.lineTo(px + Math.cos(featherAngle + spread) * 7, py + Math.sin(featherAngle + spread) * 7);
        });
      }
      context.stroke();
      const [eyeX, eyeY] = place([[side * 72, -142]])[0];
      compoundEye(context, eyeX, eyeY, 37 * scale, 57 * scale, angle + side * 0.12, seed + side, eyePigment);
    });
    // A few long bristles on the thorax.
    context.strokeStyle = "#2a1a10";
    context.lineWidth = 1.5;
    [[-55, -55, -95, -120], [55, -55, 95, -120], [-75, 30, -130, 0], [75, 30, 130, 0]].forEach(([fromX, fromY, toX, toY]) => {
      tracePath(context, place([[fromX, fromY], [toX, toY]]), false);
      context.stroke();
    });
  }

  // The opening scene without the fly: paper, the orange, the ruler, the droplet.
  function ground(context) {
    background(context);
    orange(context, 820, 1180, 860);
    ruler(context);
    droplet(context, 262, 772);
  }

  function frame(context) {
    ground(context);
    fly(context, { x: 495, y: 385, angle: -0.41, scale: 1, seed: 21 });
    // Construction lines over the fly.
    context.strokeStyle = "rgba(110,130,180,0.5)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(380, 120);
    context.lineTo(700, 900);
    context.moveTo(250, 650);
    context.lineTo(980, 330);
    context.stroke();
  }

  // Blue construction outlines of the wings at full size, drawn before they unfold into them.
  function wingGuides(context, { x, y, angle, scale = 1, alpha = 1 }) {
    const place = (points) => points.map((point) => {
      const [rotatedX, rotatedY] = rotatePoint([point[0] * scale, point[1] * scale], angle);
      return [x + rotatedX, y + rotatedY];
    });
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = "rgba(70,90,200,0.75)";
    context.lineWidth = 1.4;
    context.setLineDash([6, 5]);
    [-1, 1].forEach((side) => {
      tracePath(context, place(wingOutline(side)));
      context.stroke();
    });
    context.restore();
  }

  return { frame, fly, ground, wingGuides, background, orange, sketchShade, strokeField, tracePath, ellipse };
})();
