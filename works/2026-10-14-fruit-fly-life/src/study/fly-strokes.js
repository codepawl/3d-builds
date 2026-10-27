  // Shade by strokes, not gradients: short and long pen strokes that crowd toward the dark side.
  function shadeForm(context, placedOutline, from, to, strength) {
    const box = boxOf(placedOutline);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const directionX = (to[0] - from[0]) / length;
    const directionY = (to[1] - from[1]) / length;
    const darkness = (x, y) => clamp(((x - from[0]) * directionX + (y - from[1]) * directionY) / length);
    const strokeAngle = Math.atan2(directionY, directionX) + Math.PI / 2 + 0.35;
    context.save();
    tracePath(context, placedOutline);
    context.clip();
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    strokeField(context, box, { count: Math.round(area / 6), color: "#2b1406", width: 1.1, length: [6, 22], angleAt: () => strokeAngle, density: (x, y) => darkness(x, y) ** 1.4 * strength * 1.6, seed: Math.round(from[0] + from[1]), alpha: 0.6 });
    strokeField(context, box, { count: Math.round(area / 14), color: "#160904", width: 1.3, length: [10, 28], angleAt: () => strokeAngle + 0.5, density: (x, y) => darkness(x, y) ** 2.5 * strength * 1.4, seed: Math.round(from[0] * 3 + from[1]), alpha: 0.55 });
    context.restore();
  }

  // A wing: almost clear, with only a thin edge, faint veins and crisp rainbow contours.
  function wing(context, place, side, seed) {
    const outline = wingOutline(side);
    const placed = place(outline);
    context.save();
    tracePath(context, placed);
    context.fillStyle = "rgba(255,255,255,0.05)";
    context.fill();
    context.clip();
    ["#e45ac8", "#f5e25a", "#55d8d0", "#92e266", "#e45ac8", "#55d8d0", "#f5e25a"].forEach((color, layer) => {
      const shrink = 0.88 - layer * 0.11;
      const loop = outline.map(([pointX, pointY], index) => {
        const wobble = Math.sin(index * 0.35 + layer * 1.7 + seed) * 11 + Math.sin(index * 0.9 + layer) * 5;
        return [side * 100 + (pointX - side * 100) * shrink + wobble, 280 + (pointY - 280) * shrink * 0.9 + wobble * 0.8 - layer * 8];
      });
      tracePath(context, place(loop));
      context.strokeStyle = color;
      context.globalAlpha = 0.85;
      context.lineWidth = 1.5;
      context.stroke();
    });
    context.globalAlpha = 1;
    context.strokeStyle = "rgba(60,45,35,0.35)";
    context.lineWidth = 1;
    [0.15, 0.4, 0.62, 0.82].forEach((spread) => {
      const vein = [[side * 40, 50], [side * (60 + 70 * spread), 260], [side * (70 + 95 * spread), 480]].map((point) => rotatePoint(point, -side * 0.06));
      tracePath(context, place(vein), false);
      context.stroke();
    });
    context.restore();
    tracePath(context, placed);
    context.strokeStyle = "rgba(45,40,45,0.6)";
    context.lineWidth = 1.4;
    context.stroke();
  }

  // A water drop: pale body, a darker lower rim drawn in strokes, a cast shadow and a sharp highlight.
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

  function orange(context, centerX, centerY, radius) {
    const outline = ellipse(centerX, centerY, radius, radius, 0, 160);
    context.save();
    tracePath(context, outline);
    context.fillStyle = "#ef9d63";
    context.fill();
    context.clip();
    // Flat bands of tone, the way a print lays colour, before any strokes.
    [[0.95, "#f2a46a"], [0.75, "#ec9058"], [0.55, "#e47f4c"]].forEach(([scale, color]) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(centerX + radius * 0.2, centerY + radius * 0.2, radius * scale, 0, Math.PI * 2);
      context.fill();
    });
    context.strokeStyle = "rgba(120,50,20,0.22)";
    context.lineWidth = 1;
    for (let ring = 1; ring < 26; ring += 1) {
      context.beginPath();
      context.arc(centerX + radius * 0.35, centerY + radius * 0.35, ring * radius * 0.06, 0, Math.PI * 2);
      context.stroke();
    }
    const light = [150, 520];
    const shade = (x, y) => clamp((Math.hypot(x - light[0], y - light[1]) - 150) / 850);
    const tangent = (x, y) => Math.atan2(y - centerY, x - centerX) + Math.PI / 2;
    const box = [centerX - radius, centerY - radius, centerX + radius, centerY + radius];
    // Light: short pale flecks. Shadow: long red strokes, then longer dark ones, crowding as it gets darker.
    strokeField(context, box, { count: 9000, color: "#fff2df", width: 1.4, length: [4, 10], angleAt: () => -0.9, density: (x, y) => (1 - shade(x, y)) ** 2 * 1.2, seed: 11, alpha: 0.75 });
    strokeField(context, box, { count: 26000, color: "#cc4560", width: 1.5, length: [8, 30], angleAt: tangent, density: (x, y) => shade(x, y) ** 1.3, seed: 12, alpha: 0.7 });
    strokeField(context, box, { count: 12000, color: "#8e2a3c", width: 1.4, length: [12, 40], angleAt: tangent, density: (x, y) => shade(x, y) ** 2.2, seed: 13, alpha: 0.65 });
    strokeField(context, box, { count: 1400, color: "#7a3a1a", width: 1, length: [1, 2], angleAt: () => 0, seed: 14, alpha: 0.5 });
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
