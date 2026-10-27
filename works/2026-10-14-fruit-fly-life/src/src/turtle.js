// A green sea turtle seen from above, drawn to its real anatomy: 5 vertebral scutes, 4 pairs of costal scutes,
// a ring of marginal scutes, rays in every scute, and skin made of dark plates with cream edges.
// Local units: the shell runs from y = -0.47 to 0.53 and the head points to -y; `size` is pixels per unit.
"use strict";

const Turtle = (() => {
  const { INK, wobblyPath, hash, lerp, shadeSide } = Ink;

  const PALETTE = {
    shell: "#5f4f27",
    scuteLight: "#7a6631",
    scuteDark: "#4b3d1d",
    ray: "rgba(214,176,92,0.55)",
    rayDark: "rgba(40,28,12,0.35)",
    plate: "#4b3f2c",
    plateEdge: "#e4d6ac",
    skin: "#c9b688",
  };

  const SHELL_HALF_LENGTH = 0.5;
  const SHELL_CENTER_Y = 0.03;
  const SHELL_HALF_WIDTH = 0.36;
  const INNER = 0.84;
  const VERTEBRAL_EDGE = 0.105;
  const VERTEBRAL_SEAMS = [-0.4, -0.24, -0.08, 0.08, 0.24, 0.42];
  const COSTAL_SEAMS = [-0.36, -0.16, 0.02, 0.2, 0.38];
  const MARGINALS_PER_SIDE = 12;

  // Half-width of the shell at height y, narrower toward the tail.
  function shellHalfWidth(y, scale = 1) {
    const along = (y - SHELL_CENTER_Y) / (SHELL_HALF_LENGTH * scale);
    if (Math.abs(along) >= 1) {
      return 0;
    }
    const taper = 1 - 0.18 * Math.max(0, along);
    return SHELL_HALF_WIDTH * scale * Math.sqrt(1 - along * along) * taper;
  }

  function outlinePoints(scale, count = 72) {
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const turn = (index / count) * Math.PI * 2 - Math.PI / 2;
      const y = SHELL_CENTER_Y + Math.sin(turn) * SHELL_HALF_LENGTH * scale;
      const side = Math.cos(turn) >= 0 ? 1 : -1;
      points.push([side * shellHalfWidth(y, scale) * Math.abs(Math.cos(turn)) / Math.max(1e-6, Math.sqrt(1 - Math.sin(turn) ** 2)), y]);
    }
    return points;
  }

  // Points down one side of the inner ring between two heights.
  function ringEdge(side, fromY, toY, steps = 8) {
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
      const y = lerp(fromY, toY, step / steps);
      points.push([side * shellHalfWidth(y, INNER), y]);
    }
    return points;
  }

  function vertebralScute(index) {
    const top = VERTEBRAL_SEAMS[index];
    const bottom = VERTEBRAL_SEAMS[index + 1];
    const middle = (top + bottom) / 2;
    const bulge = VERTEBRAL_EDGE + 0.02;
    return [[-VERTEBRAL_EDGE, top], [0, top - 0.025], [VERTEBRAL_EDGE, top], [bulge, middle], [VERTEBRAL_EDGE, bottom], [0, bottom - 0.025], [-VERTEBRAL_EDGE, bottom], [-bulge, middle]];
  }

  function costalScute(side, index) {
    const top = COSTAL_SEAMS[index];
    const bottom = COSTAL_SEAMS[index + 1];
    return [[side * VERTEBRAL_EDGE, top], ...ringEdge(side, top, bottom), [side * VERTEBRAL_EDGE, bottom]];
  }

  function marginalScutes() {
    const scutes = [];
    const outer = outlinePoints(1, MARGINALS_PER_SIDE * 2 * 3);
    const inner = outlinePoints(INNER, MARGINALS_PER_SIDE * 2 * 3);
    for (let index = 0; index < outer.length; index += 3) {
      const next = (index + 3) % outer.length;
      scutes.push([...outer.slice(index, index + 4 > outer.length ? outer.length : index + 4), outer[next], inner[next], ...inner.slice(index, index + 4).reverse()].filter(Boolean));
    }
    return scutes;
  }

  function centroid(points) {
    const sum = points.reduce(([sumX, sumY], [x, y]) => [sumX + x, sumY + y], [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }

  // Rays from a point near the scute's centre out to its edge, the green turtle's sunburst.
  function rays(context, polygon, place, seed, count = 26) {
    const [centerX, centerY] = centroid(polygon);
    const originX = centerX + (hash(seed, 1) - 0.5) * 0.03;
    const originY = centerY + 0.02;
    context.save();
    tracePath(context, place(polygon));
    context.clip();
    for (let ray = 0; ray < count; ray += 1) {
      const turn = (ray / count) * Math.PI * 2 + hash(seed, ray) * 0.4;
      const reach = 0.25;
      const bend = (hash(ray, seed, 3) - 0.5) * 0.07;
      const line = place([[originX, originY], [originX + Math.cos(turn) * reach * 0.5 + bend, originY + Math.sin(turn) * reach * 0.5], [originX + Math.cos(turn) * reach, originY + Math.sin(turn) * reach]]);
      context.strokeStyle = ray % 3 === 0 ? PALETTE.rayDark : PALETTE.ray;
      context.lineWidth = ray % 3 === 0 ? 1.4 : 0.8 + hash(ray, seed) * 1.6;
      wobblyPath(context, line, { wobble: 1.4, seed: seed * 31 + ray });
      context.stroke();
    }
    context.restore();
  }

  function tracePath(context, points) {
    context.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
  }

  // Skin as a mosaic of dark plates with cream edges, clipped to the limb's outline.
  function plates(context, outline, place, { cell = 0.035, seed = 1 } = {}) {
    const xs = outline.map((point) => point[0]);
    const ys = outline.map((point) => point[1]);
    const placed = place(outline);
    context.save();
    tracePath(context, placed);
    context.fillStyle = PALETTE.plateEdge;
    context.fill();
    context.clip();
    for (let row = 0; Math.min(...ys) + row * cell * 0.86 <= Math.max(...ys) + cell; row += 1) {
      for (let column = 0; Math.min(...xs) + column * cell <= Math.max(...xs) + cell; column += 1) {
        const x = Math.min(...xs) + column * cell + (row % 2) * cell * 0.5 + (hash(row, column, seed) - 0.5) * cell * 0.35;
        const y = Math.min(...ys) + row * cell * 0.86 + (hash(column, row, seed) - 0.5) * cell * 0.35;
        const radius = cell * (0.5 + hash(row, column, seed + 2) * 0.08);
        const hexagon = Array.from({ length: 6 }, (unused, corner) => {
          const turn = (corner / 6) * Math.PI * 2 + hash(row, column) * 0.5;
          return [x + Math.cos(turn) * radius, y + Math.sin(turn) * radius];
        });
        context.fillStyle = hash(row, column, seed + 5) > 0.8 ? "#5c4d36" : PALETTE.plate;
        tracePath(context, place(hexagon));
        context.fill();
      }
    }
    context.restore();
    wobblyPath(context, placed, { closed: true, wobble: 0.8, seed: seed + 9 });
    context.strokeStyle = INK;
    context.lineWidth = 2.4;
    context.stroke();
  }

  function flipperOutline(length, width) {
    const points = [];
    const steps = 18;
    for (let index = 0; index <= steps; index += 1) {
      const along = index / steps;
      points.push([along * length, -Math.sin(along * Math.PI) * width * (1 - along * 0.3) - along * along * width * 0.7]);
    }
    for (let index = steps; index >= 0; index -= 1) {
      const along = index / steps;
      points.push([along * length, Math.sin(along * Math.PI) * width * 0.5 - along * along * width * 0.7]);
    }
    return points;
  }

  function transform(points, { x = 0, y = 0, angle = 0 }) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(([pointX, pointY]) => [x + pointX * cos - pointY * sin, y + pointX * sin + pointY * cos]);
  }

  function drawTop(context, { x, y, angle = 0, size = 600, stroke = 0, seed = 1, swim = false }) {
    const place = (points) => transform(points.map(([pointX, pointY]) => [pointX * size, pointY * size]), { x, y, angle });
    const frontSwing = Math.sin(stroke) * (swim ? 0.75 : 0.45);
    const rearSwing = Math.sin(stroke + Math.PI / 2) * 0.25;

    // Limbs first, under the shell.
    [-1, 1].forEach((side) => {
      const frontAngle = side === 1 ? -0.4 + frontSwing : Math.PI + 0.4 - frontSwing;
      const front = transform(flipperOutline(0.6, 0.13).map(([px, py]) => [px, py * side]), { x: side * 0.22, y: -0.24, angle: frontAngle });
      plates(context, front, place, { cell: 0.04, seed: seed + side });
      shadeSide(context, place(front), { spacing: 4, alpha: 0.3, seed: seed + 40 + side });
      const rearAngle = side === 1 ? 0.8 + rearSwing : Math.PI - 0.8 - rearSwing;
      const rear = transform(flipperOutline(0.25, 0.1).map(([px, py]) => [px, py * side]), { x: side * 0.18, y: 0.38, angle: rearAngle });
      plates(context, rear, place, { cell: 0.03, seed: seed + 10 + side });
    });
    const tail = [[-0.025, 0.5], [0.025, 0.5], [0, 0.6]];
    plates(context, tail, place, { cell: 0.02, seed: seed + 20 });

    // Head: a mosaic of plates, a pair of large prefrontal scales, eyes.
    const headBob = Math.sin(stroke * 0.5) * 0.015;
    const head = Array.from({ length: 30 }, (unused, index) => {
      const turn = (index / 30) * Math.PI * 2;
      const narrowing = 1 - 0.25 * Math.max(0, -Math.sin(turn));
      return [Math.cos(turn) * 0.1 * narrowing, -0.58 + headBob + Math.sin(turn) * 0.14];
    });
    plates(context, head, place, { cell: 0.03, seed: seed + 30 });
    [-1, 1].forEach((side) => {
      const prefrontal = [[0, -0.69 + headBob], [side * 0.05, -0.66 + headBob], [side * 0.045, -0.6 + headBob], [0, -0.6 + headBob]];
      context.fillStyle = PALETTE.plate;
      tracePath(context, place(prefrontal));
      context.fill();
      context.strokeStyle = PALETTE.plateEdge;
      context.lineWidth = 2;
      context.stroke();
      const [eyeX, eyeY] = place([[side * 0.075, -0.6 + headBob]])[0];
      context.fillStyle = "#15100a";
      context.beginPath();
      context.ellipse(eyeX, eyeY, size * 0.017, size * 0.012, angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(255,248,225,0.8)";
      context.beginPath();
      context.arc(eyeX - size * 0.005, eyeY - size * 0.004, size * 0.004, 0, Math.PI * 2);
      context.fill();
    });

    // Shell: body, marginal ring, costal and vertebral scutes, rays, seams, shading.
    const outer = outlinePoints(1);
    context.fillStyle = PALETTE.shell;
    tracePath(context, place(outer));
    context.fill();
    marginalScutes().forEach((scute, index) => {
      context.fillStyle = index % 2 ? PALETTE.scuteDark : PALETTE.shell;
      tracePath(context, place(scute));
      context.fill();
    });
    const scutes = [];
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 4; index += 1) {
        scutes.push({ polygon: costalScute(side, index), tone: (index + (side > 0 ? 1 : 0)) % 2 });
      }
    });
    for (let index = 0; index < 5; index += 1) {
      scutes.push({ polygon: vertebralScute(index), tone: index % 2 });
    }
    context.save();
    tracePath(context, place(outlinePoints(INNER)));
    context.clip();
    scutes.forEach(({ polygon, tone }, index) => {
      context.fillStyle = tone ? PALETTE.scuteLight : PALETTE.scuteDark;
      tracePath(context, place(polygon));
      context.fill();
      rays(context, polygon, place, seed * 100 + index);
    });
    context.strokeStyle = INK;
    context.lineJoin = "round";
    context.lineWidth = 2;
    marginalScutes().forEach((scute, index) => {
      wobblyPath(context, place(scute), { closed: true, wobble: 0.5, seed: seed * 7 + index });
      context.stroke();
    });
    context.lineWidth = 2.6;
    scutes.forEach(({ polygon }, index) => {
      wobblyPath(context, place(polygon), { closed: true, wobble: 0.7, seed: seed * 13 + index });
      context.stroke();
    });
    context.restore();
    shadeSide(context, place(outer), { spacing: 4.5, alpha: 0.42, depth: 0.32, seed: seed + 50 });
    // A soft highlight along the ridge, where the light hits the shell.
    context.save();
    tracePath(context, place(outer));
    context.clip();
    const [ridgeX, ridgeY] = place([[-0.06, -0.12]])[0];
    const glow = context.createRadialGradient(ridgeX, ridgeY, 0, ridgeX, ridgeY, size * 0.32);
    glow.addColorStop(0, "rgba(255,236,190,0.22)");
    glow.addColorStop(1, "rgba(255,236,190,0)");
    context.fillStyle = glow;
    context.fillRect(ridgeX - size, ridgeY - size, size * 2, size * 2);
    context.restore();
    wobblyPath(context, place(outer), { closed: true, wobble: 1, seed: seed + 60 });
    context.strokeStyle = INK;
    context.lineWidth = 3.2;
    context.stroke();
  }

  return { drawTop };
})();
