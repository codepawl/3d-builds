  // Sketchy shading: clusters of short parallel strokes, each cluster at its own angle and length, scattered with
  // more clusters where it is darker. No rings, no single direction, nothing that reads as a pattern.
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

  // Smooth closed curve through control points (Catmull-Rom), for organic outlines such as a wing.
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

  // A folded wing: hinged at the side of the thorax just in front of the scutellum, narrow at the base, widest about
  // two thirds along, round tip. The leading edge lies outside; the trailing edge crosses the midline over the other wing.
  function wingOutline(side) {
    const controls = [
      [78, 55], [108, 150], [126, 280], [116, 420], [80, 520], [35, 565],
      [0, 545], [-22, 470], [-30, 360], [-12, 230], [22, 130], [52, 70],
    ];
    return smoothClosed(controls.map(([x, y]) => [side * x, y]));
  }

  function wing(context, place, side, seed) {
    const outline = wingOutline(side);
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
    sketchShade(context, box, { darkness: (x, y) => (1 - shade(x, y)) ** 2, clusters: 2600, color: "#fff2df", alpha: 0.7, baseAngle: -0.9, spread: 1.4, seed: 11, width: 1.3 });
    sketchShade(context, box, { darkness: (x, y) => shade(x, y) ** 1.6 * 1.3, clusters: 5200, color: "#cc4560", alpha: 0.7, baseAngle: 0.5, spread: 1.6, seed: 12, width: 1.4 });
    sketchShade(context, box, { darkness: (x, y) => shade(x, y) ** 3 * 1.4, clusters: 3200, color: "#8e2a3c", alpha: 0.65, baseAngle: 0.9, spread: 1.4, seed: 13, width: 1.3 });
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
