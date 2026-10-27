// The cast: a sea turtle seen from above (adult and hatchling), a hatchling seen from the side, eggs, sargassum,
// a gull, a ghost crab and a jellyfish. Each draws at the origin in its own units; callers place it.
"use strict";

const Creatures = (() => {
  const { INK, inkShape, ellipsePoints, wobblyPath, hatchArea, hash, lerp } = Ink;

  const ADULT = { shell: "#7c6a3a", scuteLight: "#8d7943", scuteDark: "#6a5a30", skin: "#b9a173", skinDark: "#8f7a52" };
  const HATCHLING = { shell: "#463f33", scuteLight: "#514a3c", scuteDark: "#3a342b", skin: "#5d574b", skinDark: "#46413a" };

  function transform(points, { x = 0, y = 0, angle = 0, scale = 1 }) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(([pointX, pointY]) => [x + (pointX * cos - pointY * sin) * scale, y + (pointX * sin + pointY * cos) * scale]);
  }

  // A flipper: a curved paddle from its root, pointing along +x.
  function flipperPoints(length, width) {
    const points = [];
    const steps = 14;
    for (let index = 0; index <= steps; index += 1) {
      const along = index / steps;
      points.push([along * length, -Math.sin(along * Math.PI) * width * (1 - along * 0.35) - along * along * width * 0.6]);
    }
    for (let index = steps; index >= 0; index -= 1) {
      const along = index / steps;
      points.push([along * length, Math.sin(along * Math.PI) * width * 0.45 - along * along * width * 0.6]);
    }
    return points;
  }

  // Seen from above, head up (-y). size is the shell length in pixels; stroke is the flipper phase in radians.
  function turtleTop(context, { x, y, angle = 0, size = 300, stroke = 0, hatchling = false, seed = 1, swim = false }) {
    const colors = hatchling ? HATCHLING : ADULT;
    const scale = size;
    const place = (points) => transform(points, { x, y, angle, scale });
    const width = hatchling ? 1.6 : 2.4;
    // Crawling on sand the front flippers row together; swimming they beat like wings.
    const frontSwing = swim ? Math.sin(stroke) * 0.75 : Math.sin(stroke) * 0.45;
    const rearSwing = Math.sin(stroke + Math.PI / 2) * 0.25;

    [-1, 1].forEach((side) => {
      const front = flipperPoints(0.62, 0.13).map(([px, py]) => [px, py * side]);
      const frontAngle = side === 1 ? -0.35 + frontSwing : Math.PI + 0.35 - frontSwing;
      const frontPlaced = place(transform(front, { x: 0.24 * side, y: -0.22, angle: frontAngle }));
      inkShape(context, frontPlaced, {
        fill: colors.skin, hatch: { angle: 1.1, spacing: hatchling ? 4 : 6, alpha: 0.3 }, width, seed: seed + side,
      });
      if (!hatchling) {
        Ink.shadeSide(context, frontPlaced, { spacing: 4, alpha: 0.4, seed: seed + 60 + side });
        // Rows of scales along the leading edge.
        context.strokeStyle = "rgba(42,31,23,0.55)";
        context.lineWidth = 1.1;
        for (let scale = 1; scale < 7; scale += 1) {
          const along = scale / 7;
          const [scaleX, scaleY] = place(transform([[along * 0.62, -Math.sin(along * Math.PI) * 0.06 - along * along * 0.08]], { x: 0.24 * side, y: -0.22, angle: frontAngle }))[0];
          context.beginPath();
          context.arc(scaleX, scaleY, size * 0.014 * (1.2 - along * 0.6), 0, Math.PI * 2);
          context.stroke();
        }
      }
      const rear = flipperPoints(0.26, 0.09).map(([px, py]) => [px, py * side]);
      const rearAngle = side === 1 ? 0.75 + rearSwing : Math.PI - 0.75 - rearSwing;
      inkShape(context, place(transform(rear, { x: 0.2 * side, y: 0.36, angle: rearAngle })), {
        fill: colors.skinDark, width, seed: seed + 5 + side,
      });
    });

    // Head and neck.
    const headBob = Math.sin(stroke * 0.5) * 0.02;
    const headPlaced = place(ellipsePoints(0, -0.57 + headBob, 0.11, 0.15, 0, 24));
    inkShape(context, headPlaced, {
      fill: colors.skin, hatch: { angle: 0.3, spacing: hatchling ? 4 : 5, alpha: 0.25, cross: true }, width, seed: seed + 9,
    });
    if (!hatchling) {
      // Head scutes: a centre seam that forks, and side plates.
      const plates = [
        [[0, -0.69], [0, -0.6], [-0.05, -0.53]], [[0, -0.6], [0.05, -0.53]],
        [[-0.08, -0.6], [-0.04, -0.56], [-0.06, -0.48]], [[0.08, -0.6], [0.04, -0.56], [0.06, -0.48]],
      ];
      context.strokeStyle = INK;
      context.lineWidth = width * 0.6;
      plates.forEach((plate, index) => {
        wobblyPath(context, place(plate.map(([px, py]) => [px, py + headBob])), { wobble: 0.4, seed: seed + 70 + index });
        context.stroke();
      });
      Ink.shadeSide(context, headPlaced, { spacing: 3.5, alpha: 0.35, depth: 0.3, seed: seed + 75 });
    }
    [-1, 1].forEach((side) => {
      const [eyeX, eyeY] = place([[0.065 * side, -0.62 + headBob]])[0];
      context.fillStyle = INK;
      context.beginPath();
      context.arc(eyeX, eyeY, Math.max(1.5, scale * 0.016), 0, Math.PI * 2);
      context.fill();
    });
    inkShape(context, place([[-0.03, 0.47], [0.03, 0.47], [0, 0.56]]), { fill: colors.skinDark, width, seed: seed + 11 });

    // Shell: outline, marginal ring, five vertebral scutes and the costal seams between them.
    const shell = [];
    for (let index = 0; index < 56; index += 1) {
      const turn = (index / 56) * Math.PI * 2;
      const taper = 1 - 0.18 * Math.max(0, Math.sin(turn));
      shell.push([Math.cos(turn) * 0.36 * taper, Math.sin(turn) * 0.5 + 0.03]);
    }
    const shellPlaced = place(shell);
    inkShape(context, shellPlaced, { fill: colors.shell, hatch: { angle: -0.6, spacing: hatchling ? 3.5 : 5, alpha: 0.22 }, width, seed: seed + 13 });
    // Costal scutes: four plates down each side, alternating tone, each with growth arcs.
    [-1, 1].forEach((side) => {
      for (let plate = 0; plate < 4; plate += 1) {
        const top = -0.33 + plate * 0.17;
        const bottom = top + 0.17;
        const outer = 0.29 - Math.abs(plate - 1.5) * 0.025;
        const costal = [[0.09 * side, top + 0.02], [outer * side, top - 0.01], [(outer - 0.01) * side, bottom], [0.09 * side, bottom + 0.02]];
        context.save();
        context.globalAlpha = 0.55;
        inkShape(context, place(costal), { fill: (plate + (side > 0 ? 0 : 1)) % 2 ? colors.scuteDark : colors.scuteLight, line: null, seed: seed + 90 + plate * side });
        context.restore();
        context.strokeStyle = "rgba(42,31,23,0.35)";
        context.lineWidth = Math.max(0.8, width * 0.45);
        for (let ring = 1; ring <= 3; ring += 1) {
          const shrink = ring * 0.22;
          const middleX = (0.09 + outer) / 2;
          const middleY = (top + bottom) / 2;
          const ringPoints = costal.map(([px, py]) => [lerp(px, middleX * side, shrink), lerp(py, middleY, shrink)]);
          wobblyPath(context, place(ringPoints), { closed: true, wobble: 0.3, seed: seed + 100 + ring + plate * 7 * side });
          context.stroke();
        }
      }
    });
    if (!hatchling) {
      Ink.shadeSide(context, shellPlaced, { spacing: 5, alpha: 0.42, depth: 0.3, seed: seed + 14 });
    }
    const inner = shell.map(([px, py]) => [px * 0.84, (py - 0.03) * 0.86 + 0.03]);
    wobblyPath(context, place(inner), { closed: true, wobble: 0.7, seed: seed + 15 });
    context.strokeStyle = INK;
    context.lineWidth = width * 0.7;
    context.stroke();
    // Marginal scute ticks.
    context.beginPath();
    for (let index = 0; index < 56; index += 2) {
      const [outerX, outerY] = place([shell[index]])[0];
      const [innerX, innerY] = place([inner[index]])[0];
      context.moveTo(outerX, outerY);
      context.lineTo(innerX, innerY);
    }
    context.stroke();
    const vertebralCenters = [-0.3, -0.13, 0.03, 0.19, 0.33];
    vertebralCenters.forEach((centerY, index) => {
      const halfWidth = 0.1 - Math.abs(index - 2) * 0.012;
      const halfHeight = 0.085;
      const hexagon = [
        [-halfWidth, centerY - halfHeight * 0.6], [0, centerY - halfHeight], [halfWidth, centerY - halfHeight * 0.6],
        [halfWidth, centerY + halfHeight * 0.6], [0, centerY + halfHeight], [-halfWidth, centerY + halfHeight * 0.6],
      ];
      inkShape(context, place(hexagon), {
        fill: index % 2 ? colors.scuteDark : colors.scuteLight, width: width * 0.8, seed: seed + 20 + index, wobble: 0.6,
      });
      context.strokeStyle = "rgba(42,31,23,0.4)";
      context.lineWidth = Math.max(0.8, width * 0.45);
      [0.7, 0.45, 0.22].forEach((ring, ringIndex) => {
        wobblyPath(context, place(hexagon.map(([px, py]) => [px * ring, centerY + (py - centerY) * ring])), { closed: true, wobble: 0.3, seed: seed + 40 + index * 3 + ringIndex });
        context.stroke();
      });
      context.strokeStyle = INK;
      context.lineWidth = width * 0.7;
      if (index < vertebralCenters.length - 1) {
        [-1, 1].forEach((side) => {
          const seam = place([[halfWidth * side, centerY + halfHeight * 0.6], [0.25 * side, centerY + halfHeight * 0.9]]);
          wobblyPath(context, seam, { wobble: 0.6, seed: seed + 30 + index * side });
          context.stroke();
        });
      }
    });
  }

  // A hatchling seen from the side, facing +x, for the digging cross-section.
  function hatchlingSide(context, { x, y, size = 60, stroke = 0, angle = 0, seed = 1 }) {
    const place = (points) => transform(points, { x, y, angle, scale: size });
    const flipperAngle = -0.6 + Math.sin(stroke) * 0.7;
    inkShape(context, place(transform(flipperPoints(0.55, 0.12), { x: 0.15, y: 0.05, angle: flipperAngle + Math.PI * 0.55 })), {
      fill: HATCHLING.skin, width: 1.6, seed: seed + 1,
    });
    const dome = [];
    for (let index = 0; index <= 20; index += 1) {
      const turn = Math.PI + (index / 20) * Math.PI;
      dome.push([Math.cos(turn) * 0.45, Math.sin(turn) * 0.26]);
    }
    dome.push([0.42, 0.06], [-0.42, 0.06]);
    inkShape(context, place(dome), { fill: HATCHLING.shell, hatch: { angle: -0.8, spacing: 3, alpha: 0.3 }, width: 1.6, seed: seed + 2 });
    inkShape(context, place(ellipsePoints(0.56, -0.02, 0.13, 0.1, 0.2, 18)), { fill: HATCHLING.skin, width: 1.6, seed: seed + 3 });
    const [eyeX, eyeY] = place([[0.6, -0.05]])[0];
    context.fillStyle = INK;
    context.beginPath();
    context.arc(eyeX, eyeY, Math.max(1.2, size * 0.025), 0, Math.PI * 2);
    context.fill();
  }

  // A round, leathery turtle egg; crack runs 0..1.
  function egg(context, { x, y, radius = 20, crack = 0, seed = 1, line = INK, fill = "#f4eedc" }) {
    inkShape(context, ellipsePoints(x, y, radius, radius * 0.97, 0, 28), {
      fill, hatch: { angle: 0.9, spacing: Math.max(3, radius * 0.18), alpha: 0.2 }, line, width: Math.max(1.2, radius * 0.08), seed,
    });
    context.save();
    context.globalAlpha = 0.5;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.ellipse(x - radius * 0.35, y - radius * 0.4, radius * 0.25, radius * 0.15, -0.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (crack > 0) {
      const points = [];
      const steps = 7;
      for (let index = 0; index <= steps * crack; index += 1) {
        const along = index / steps;
        points.push([x - radius * 0.8 + along * radius * 1.6, y - radius * 0.1 + (index % 2 ? -1 : 1) * radius * 0.18]);
      }
      if (points.length > 1) {
        wobblyPath(context, points, { wobble: 0.5, seed: seed + 4 });
        context.strokeStyle = line;
        context.lineWidth = Math.max(1, radius * 0.07);
        context.stroke();
      }
    }
  }

  // A sprig of sargassum: a wavy stem with narrow leaves and round air bladders.
  function sargassum(context, { x, y, angle = 0, size = 200, sway = 0, seed = 1 }) {
    const random = Ink.seededRandom(seed);
    const stem = [];
    const steps = 18;
    for (let index = 0; index <= steps; index += 1) {
      const along = index / steps;
      stem.push([along * size, Math.sin(along * 5 + seed + sway) * size * 0.05]);
    }
    const placed = transform(stem, { x, y, angle });
    wobblyPath(context, placed, { wobble: 0.8, seed });
    context.strokeStyle = "#6a4a16";
    context.lineWidth = 2.6;
    context.stroke();
    for (let index = 1; index < steps; index += 1) {
      const [stemX, stemY] = stem[index];
      const side = index % 2 ? 1 : -1;
      const leafAngle = side * (0.7 + random() * 0.5) + Math.sin(sway + index) * 0.15;
      const leafLength = size * (0.12 + random() * 0.08);
      const leaf = ellipsePoints(leafLength / 2, 0, leafLength / 2, leafLength * 0.13, 0, 14);
      inkShape(context, transform(transform(leaf, { x: stemX, y: stemY, angle: leafAngle }), { x, y, angle }), {
        fill: index % 3 ? "#c08f2f" : "#a87a24", width: 1.4, seed: seed + index, wobble: 0.5,
      });
      if (random() < 0.55) {
        const bladder = transform([[stemX + side * size * 0.04, stemY - side * size * 0.05]], { x, y, angle })[0];
        inkShape(context, ellipsePoints(bladder[0], bladder[1], size * 0.022, size * 0.022, 0, 12), {
          fill: "#d9a945", width: 1.2, seed: seed + 40 + index, wobble: 0.3,
        });
      }
    }
  }

  // A gull from above: a wide M of wings, beating with flap.
  function gull(context, { x, y, size = 160, flap = 0, angle = 0, seed = 1, shadow = false }) {
    // Long, swept wings; the span shortens as they beat.
    const span = 0.75 + Math.cos(flap) * 0.25;
    const wing = (side) => [
      [0.03, -0.06], [0.2, -0.11], [0.38, -0.09], [0.52, 0.0], [0.4, 0.0], [0.22, 0.04], [0.03, 0.06],
    ].map(([px, py]) => [px * span * side, py]);
    const tail = [[-0.04, 0.12], [0.04, 0.12], [0.06, 0.24], [-0.06, 0.24]];
    const color = shadow ? "rgba(20,14,8,0.32)" : "#f2efe6";
    const line = shadow ? null : INK;
    context.save();
    if (shadow) {
      context.filter = "blur(5px)";
    }
    [-1, 1].forEach((side) => inkShape(context, transform(wing(side), { x, y, angle, scale: size }), { fill: color, line, width: 1.8, seed: seed + side }));
    inkShape(context, transform(ellipsePoints(0, 0.03, 0.045, 0.13, 0, 16), { x, y, angle, scale: size }), { fill: color, line, width: 1.8, seed: seed + 3 });
    inkShape(context, transform(tail, { x, y, angle, scale: size }), { fill: color, line, width: 1.8, seed: seed + 4 });
    context.restore();
  }

  // A ghost crab from above.
  function crab(context, { x, y, size = 60, step = 0, angle = 0, seed = 1 }) {
    context.strokeStyle = INK;
    context.lineWidth = 1.6;
    [-1, 1].forEach((side) => {
      for (let leg = 0; leg < 4; leg += 1) {
        const swing = Math.sin(step + leg * 1.3) * 0.15;
        const base = transform([[0.2 * side, -0.1 + leg * 0.09]], { x, y, angle, scale: size })[0];
        const knee = transform([[0.42 * side, -0.2 + leg * 0.14 + swing]], { x, y, angle, scale: size })[0];
        const foot = transform([[0.55 * side, 0.02 + leg * 0.14 + swing]], { x, y, angle, scale: size })[0];
        wobblyPath(context, [base, knee, foot], { wobble: 0.5, seed: seed + leg * side });
        context.stroke();
      }
    });
    inkShape(context, transform(ellipsePoints(0, 0, 0.26, 0.2, 0, 20), { x, y, angle, scale: size }), {
      fill: "#e3d2a8", hatch: { angle: 0.4, spacing: 3, alpha: 0.25 }, width: 1.6, seed: seed + 9,
    });
  }

  // A moon jellyfish from above, faint and glassy.
  function jellyfish(context, { x, y, size = 80, pulse = 0, seed = 1 }) {
    const squeeze = 1 + Math.sin(pulse) * 0.08;
    context.save();
    context.globalAlpha = 0.75;
    inkShape(context, ellipsePoints(x, y, size * squeeze, size / squeeze, 0, 32), {
      fill: "rgba(220,230,245,0.45)", line: "rgba(40,50,70,0.8)", width: 1.5, seed,
    });
    for (let lobe = 0; lobe < 4; lobe += 1) {
      const turn = (lobe / 4) * Math.PI * 2 + 0.4;
      const ring = ellipsePoints(x + Math.cos(turn) * size * 0.35, y + Math.sin(turn) * size * 0.35, size * 0.18, size * 0.12, turn, 16);
      inkShape(context, ring, { fill: "rgba(230,170,200,0.55)", line: "rgba(120,60,90,0.7)", width: 1.2, seed: seed + lobe });
    }
    context.restore();
  }

  return { turtleTop, hatchlingSide, egg, sargassum, gull, crab, jellyfish, transform };
})();
