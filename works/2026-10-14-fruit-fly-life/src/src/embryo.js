// The fruit fly egg as a blueprint, 6 s: nuclei divide the way live imaging shows (round, condense to a plate,
// split, pull apart, round up), move to the surface, divide again in waves while the camera moves in close, then the
// seven even-skipped and fourteen engrailed stripes appear. Built from anatomy/fruit-fly-embryo.md and the mitosis
// notes there. renderAt(context, seconds) draws one frame.
"use strict";

const Embryo = (() => {
  const { hash, lerp, clamp, progress, easeOut, easeInOut } = Ink;
  const SIZE = 1080;
  const DURATION = 6;
  const COLORS = { ground: "#0d1322", line: "#b8dcea", faint: "rgba(169,214,232,0.22)", glow: "#eef8fc", eve: "#4fd37f", en: "#e05cc8", pole: "#f2b134", spindle: "rgba(150,200,255,0.55)" };
  const CENTER = [560, 580];
  const AXIS = -0.62;
  const HALF_LENGTH = 440;
  const HALF_WIDTH = 158;

  // ---------- geometry ----------

  function toScreen(u, v) {
    const along = u * HALF_LENGTH;
    const across = v * HALF_WIDTH;
    return [CENTER[0] + along * Math.cos(AXIS) - across * Math.sin(AXIS), CENTER[1] + along * Math.sin(AXIS) + across * Math.cos(AXIS)];
  }

  function shellV(u, dorsal) {
    const round = Math.sqrt(Math.max(0, 1 - u * u)) ** 0.85;
    return (dorsal ? -0.86 : 1.0) * round;
  }

  function insideShell(u, v, inset = 0.92) {
    return Math.abs(u) < inset && Math.abs(v) < Math.abs(shellV(u / inset * 0.98, v < 0)) * inset;
  }

  function shellPoints(inset = 1, count = 140) {
    const points = [];
    for (let index = 0; index <= count / 2; index += 1) {
      const u = -Math.cos((index / (count / 2)) * Math.PI);
      points.push(toScreen(u * inset, shellV(u, true) * inset));
    }
    for (let index = count / 2; index >= 0; index -= 1) {
      const u = -Math.cos((index / (count / 2)) * Math.PI);
      points.push(toScreen(u * inset, shellV(u, false) * inset));
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

  function label(context, text, x, y, { color = COLORS.line, size = 24, alpha = 1, align = "left" } = {}) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.font = `${size}px Consolas, "Courier New", monospace`;
    context.textAlign = align;
    context.fillText(text, x, y);
    context.restore();
  }

  // ---------- camera: wide, then in close on the dorsal surface, then back out ----------

  const CLOSE_FOCUS = [0.15, -0.25];
  function camera(time) {
    // A slow push from the first frame, then a quick punch in to the surface, then back out for the stripes.
    const creep = easeInOut(progress(time, 0, 2.5)) * 0.25;
    const punch = easeOut(progress(time, 2.5, 2.8));
    const zoomOut = easeInOut(progress(time, 4.1, 4.7));
    const amount = Math.max(creep, punch) * (1 - zoomOut);
    const [focusX, focusY] = toScreen(CLOSE_FOCUS[0] + Math.max(0, time - 2.8) * 0.03, CLOSE_FOCUS[1]);
    return { scale: lerp(1, 3.2, amount), focusX: lerp(SIZE / 2, focusX, amount), focusY: lerp(SIZE / 2, focusY, amount), amount };
  }

  function applyCamera(context, view) {
    context.translate(SIZE / 2, SIZE / 2);
    context.scale(view.scale, view.scale);
    context.translate(-view.focusX, -view.focusY);
  }

  // ---------- drafting ground, shell, appendages ----------

  function ground(context) {
    context.fillStyle = COLORS.ground;
    context.fillRect(0, 0, SIZE, SIZE);
  }

  function grid(context) {
    context.strokeStyle = "rgba(169,214,232,0.05)";
    context.lineWidth = 1;
    context.beginPath();
    for (let line = -540; line <= SIZE + 540; line += 45) {
      context.moveTo(line, -540);
      context.lineTo(line, SIZE + 540);
      context.moveTo(-540, line);
      context.lineTo(SIZE + 540, line);
    }
    context.stroke();
  }

  function constructionLines(context, time) {
    const drawn = easeOut(progress(time, 0, 0.6));
    context.strokeStyle = COLORS.faint;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(CENTER[0], CENTER[1], HALF_LENGTH * 1.08, -Math.PI / 2, -Math.PI / 2 + drawn * Math.PI * 2);
    context.stroke();
    trace(context, [toScreen(-1.3 * drawn, 0), toScreen(1.3 * drawn, 0)], false);
    context.stroke();
    trace(context, [toScreen(0.1, -1.6 * drawn), toScreen(0.1, 1.6 * drawn)], false);
    context.stroke();
  }

  function shell(context, time) {
    const drawn = easeOut(progress(time, 0, 0.5));
    const points = shellPoints();
    context.strokeStyle = COLORS.line;
    context.lineWidth = 4;
    context.lineJoin = "round";
    trace(context, points.slice(0, Math.max(2, Math.floor(points.length * drawn))), drawn >= 1);
    context.stroke();
    if (drawn < 1) {
      return;
    }
    // Chorion print, faint polygons.
    context.save();
    trace(context, points);
    context.clip();
    context.strokeStyle = "rgba(169,214,232,0.08)";
    context.lineWidth = 1;
    for (let row = -14; row <= 14; row += 1) {
      for (let column = -28; column <= 28; column += 1) {
        const [x, y] = toScreen(column * 0.045 + (row % 2) * 0.0225, row * 0.08);
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = (corner / 6) * Math.PI * 2 + AXIS;
          context.lineTo(x + Math.cos(turn) * 11, y + Math.sin(turn) * 11);
        }
        context.closePath();
        context.stroke();
      }
    }
    context.restore();
    dorsalAppendages(context, progress(time, 0.3, 0.8));
  }

  // Two tubes from the dorsal surface near the front, a V ahead of the egg, flaring into flat paddles (eggshell SEM).
  function dorsalAppendages(context, grow) {
    if (grow <= 0) {
      return;
    }
    const forward = AXIS + Math.PI;
    [-1, 1].forEach((side) => {
      const [rootX, rootY] = toScreen(-0.73 + side * 0.03, shellV(-0.73 + side * 0.03, true) * 0.96);
      const direction = forward - side * 0.16 - 0.22;
      const length = 330 * easeOut(grow);
      const [bendX, bendY] = [rootX + Math.cos(direction - side * 0.08) * length * 0.5, rootY + Math.sin(direction - side * 0.08) * length * 0.5];
      const [tipX, tipY] = [rootX + Math.cos(direction) * length, rootY + Math.sin(direction) * length];
      context.strokeStyle = COLORS.line;
      context.lineWidth = 3.2;
      context.beginPath();
      context.moveTo(rootX, rootY);
      context.quadraticCurveTo(bendX, bendY, tipX, tipY);
      context.stroke();
      const paddleStart = 0.62;
      const [startX, startY] = [rootX + Math.cos(direction) * length * paddleStart, rootY + Math.sin(direction) * length * paddleStart];
      const normal = direction + Math.PI / 2;
      const blade = [];
      for (let step = 0; step <= 12; step += 1) {
        const amount = step / 12;
        const along = lerp(0, length * (1 - paddleStart) + 34, amount);
        const width = Math.sin(amount * Math.PI) ** 0.6 * 34;
        blade.push([startX + Math.cos(direction) * along + Math.cos(normal) * width, startY + Math.sin(direction) * along + Math.sin(normal) * width]);
      }
      for (let step = 12; step >= 0; step -= 1) {
        const amount = step / 12;
        const along = lerp(0, length * (1 - paddleStart) + 34, amount);
        const width = Math.sin(amount * Math.PI) ** 0.6 * 13;
        blade.push([startX + Math.cos(direction) * along - Math.cos(normal) * width, startY + Math.sin(direction) * along - Math.sin(normal) * width]);
      }
      trace(context, blade);
      context.fillStyle = "rgba(169,214,232,0.18)";
      context.fill();
      context.lineWidth = 2.2;
      context.stroke();
    });
    const [noseX, noseY] = toScreen(-1.03, 0);
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(noseX, noseY, 8, 0, Math.PI * 2);
    context.stroke();
  }

  // ---------- mitosis, drawn from live imaging ----------

  // One nucleus through one division. phase 0..1: round, condense into a plate across the split axis, the plate
  // splits into two that pull apart along the axis (with spindle rays), then the daughters round up at their places.
  function dividing(context, parent, children, phase, radius) {
    const [parentX, parentY] = parent;
    const axis = Math.atan2(children[1][1] - children[0][1], children[1][0] - children[0][0]);
    if (phase <= 0) {
      nucleus(context, parentX, parentY, radius);
      return;
    }
    if (phase >= 1) {
      children.forEach(([x, y]) => nucleus(context, x, y, radius * 0.85));
      return;
    }
    const condense = easeOut(clamp(phase / 0.3));
    const split = easeInOut(clamp((phase - 0.3) / 0.4));
    const settle = easeOut(clamp((phase - 0.7) / 0.3));
    if (split <= 0) {
      // Metaphase plate: a short bright bar across the axis.
      bar(context, parentX, parentY, axis + Math.PI / 2, lerp(radius, radius * 1.7, condense), lerp(radius, radius * 0.42, condense));
      spindle(context, parentX, parentY, axis, radius * 2.2, condense * 0.7);
      spindle(context, parentX, parentY, axis + Math.PI, radius * 2.2, condense * 0.7);
      return;
    }
    children.forEach(([childX, childY], index) => {
      const pullX = lerp(parentX, lerp(parentX, childX, 0.55), split);
      const pullY = lerp(parentY, lerp(parentY, childY, 0.55), split);
      const x = lerp(pullX, childX, settle);
      const y = lerp(pullY, childY, settle);
      const halfLength = lerp(radius * 1.6, radius * 0.85, settle);
      const halfThickness = lerp(radius * 0.4, radius * 0.85, settle);
      bar(context, x, y, axis + Math.PI / 2, halfLength, halfThickness);
      if (settle < 1) {
        spindle(context, x, y, axis + (index ? 0 : Math.PI), radius * 1.6, (1 - settle) * 0.8);
      }
    });
    // The thin bridge between the two as they separate.
    if (settle < 0.8) {
      context.strokeStyle = `rgba(150,200,255,${0.4 * (1 - settle)})`;
      context.lineWidth = 1;
      trace(context, children.map(([x, y]) => [lerp(parentX, x, split * 0.55), lerp(parentY, y, split * 0.55)]), false);
      context.stroke();
    }
  }

  function nucleus(context, x, y, radius) {
    context.fillStyle = "rgba(169,214,232,0.2)";
    context.beginPath();
    context.arc(x, y, radius * 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = COLORS.glow;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function bar(context, x, y, angle, halfLength, halfThickness) {
    context.fillStyle = "rgba(169,214,232,0.22)";
    context.beginPath();
    context.ellipse(x, y, halfLength * 1.8, halfThickness * 2.4, angle, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = COLORS.glow;
    context.beginPath();
    context.ellipse(x, y, halfLength, halfThickness, angle, 0, Math.PI * 2);
    context.fill();
  }

  // Thin rays fanning out from a spindle pole: the aster.
  function spindle(context, x, y, axis, length, strength) {
    if (strength <= 0.02) {
      return;
    }
    context.strokeStyle = COLORS.spindle;
    context.globalAlpha = strength;
    context.lineWidth = 0.9;
    context.beginPath();
    for (let ray = -4; ray <= 4; ray += 1) {
      const angle = axis + ray * 0.22;
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
    context.stroke();
    context.globalAlpha = 1;
  }

  // ---------- cycles 1 to 7, inside the yolk ----------

  function interiorLayout(count) {
    return Array.from({ length: count }, (unused, index) => {
      const distance = Math.sqrt((index + 0.5) / count) * 0.62;
      const turn = index * 2.39996;
      return [Math.cos(turn) * distance, Math.sin(turn) * distance * 0.8];
    });
  }

  const INTERIOR_START = 0.5;
  const CYCLE_LENGTH = 0.25;

  function interiorCycles(context, time) {
    if (time < INTERIOR_START || time >= 2.3) {
      return null;
    }
    const cycleFloat = (time - INTERIOR_START) / CYCLE_LENGTH;
    const cycle = Math.min(6, Math.floor(cycleFloat));
    const phase = cycleFloat >= 7 ? 1 : clamp(cycleFloat - cycle);
    const parents = interiorLayout(2 ** cycle);
    const children = interiorLayout(2 ** (cycle + 1));
    const radius = Math.max(4, 22 / Math.sqrt(2 ** cycle));
    parents.forEach((parent, index) => {
      const pair = [children[index * 2], children[index * 2 + 1]].map((point) => toScreen(...point));
      dividing(context, toScreen(...parent), pair, phase, radius);
    });
    return { cycle: Math.min(7, cycle + 1) };
  }

  // ---------- cycles 8 to 13, at the surface, dividing in waves ----------

  // Each surface nucleus splits into two along its own axis; the axis drifts smoothly across the egg, so neighbours
  // divide in similar directions, as in the live imaging.
  function relax(points, spacingPixels, iterations = 8) {
    const scaleU = HALF_LENGTH;
    const scaleV = HALF_WIDTH;
    let current = points.map((point) => [...point]);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const buckets = new Map();
      current.forEach(([u, v], index) => {
        const key = `${Math.floor((u * scaleU) / spacingPixels)},${Math.floor((v * scaleV) / spacingPixels)}`;
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(index);
      });
      current = current.map(([u, v], index) => {
        const cellX = Math.floor((u * scaleU) / spacingPixels);
        const cellY = Math.floor((v * scaleV) / spacingPixels);
        let pushX = 0;
        let pushY = 0;
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            (buckets.get(`${cellX + offsetX},${cellY + offsetY}`) || []).forEach((other) => {
              if (other === index) {
                return;
              }
              const deltaX = (u - current[other][0]) * scaleU;
              const deltaY = (v - current[other][1]) * scaleV;
              const distance = Math.hypot(deltaX, deltaY) || 0.01;
              if (distance < spacingPixels) {
                const strength = (spacingPixels - distance) / spacingPixels;
                pushX += (deltaX / distance) * strength * spacingPixels * 0.25;
                pushY += (deltaY / distance) * strength * spacingPixels * 0.25;
              }
            });
          }
        }
        let nextU = u + pushX / scaleU;
        let nextV = v + pushY / scaleV;
        if (!insideShell(nextU, nextV)) {
          nextU = u;
          nextV = v;
        }
        return [nextU, nextV];
      });
    }
    return current;
  }

  function surfaceGenerations() {
    const sheet = [];
    for (let row = -8; row <= 8; row += 1) {
      for (let column = -14; column <= 14; column += 1) {
        const point = [column * 0.075 + (row % 2) * 0.0375, row * 0.2];
        if (insideShell(...point)) {
          sheet.push(point);
        }
      }
    }
    const generations = [relax(sheet.slice(0, 128), 60)];
    for (let level = 1; level <= 4; level += 1) {
      const spacing = 0.16 / Math.SQRT2 ** level;
      const next = [];
      generations[level - 1].forEach(([u, v], index) => {
        const axis = Math.sin(u * 3 + level) * 1.2 + Math.cos(v * 4) * 0.8 + hash(index, level) * 0.6;
        [-1, 1].forEach((side) => {
          let childU = u + side * Math.cos(axis) * spacing * 0.5;
          let childV = v + side * Math.sin(axis) * spacing * 0.5 * (HALF_LENGTH / HALF_WIDTH);
          if (!insideShell(childU, childV)) {
            childU = u * 0.97;
            childV = v * 0.97;
          }
          next.push([childU, childV]);
        });
      });
      generations.push(relax(next, 60 / Math.SQRT2 ** level));
    }
    return generations;
  }
  const SURFACE = surfaceGenerations();
  const SURFACE_START = 2.8;
  const SURFACE_CYCLE = 0.32;

  function surfaceCycles(context, time) {
    const migrate = easeInOut(progress(time, 2.3, 2.8));
    if (migrate <= 0 || time >= 4.5) {
      return null;
    }
    const interior = interiorLayout(128);
    if (time < SURFACE_START) {
      SURFACE[0].forEach((point, index) => {
        const [x, y] = toScreen(lerp(interior[index][0], point[0], migrate), lerp(interior[index][1], point[1], migrate));
        nucleus(context, x, y, 4.5);
      });
      return { cycle: 8 };
    }
    const cycleFloat = (time - SURFACE_START) / SURFACE_CYCLE;
    const level = Math.min(3, Math.floor(cycleFloat));
    const local = cycleFloat - level;
    const parents = SURFACE[level];
    const children = SURFACE[level + 1];
    const radius = 4.5 / Math.SQRT2 ** (level * 0.6);
    parents.forEach((parent, index) => {
      // The wave: nuclei near the poles start first, the middle last.
      const delay = (1 - Math.abs(parent[0])) * 0.35;
      const phase = cycleFloat >= 4 ? 1 : clamp((local - delay) / 0.6);
      const pair = [children[index * 2], children[index * 2 + 1]].map((point) => toScreen(...point));
      dividing(context, toScreen(...parent), pair, phase, radius);
    });
    return { cycle: Math.min(13, 9 + level) };
  }

  // ---------- pole cells, cellularization, stripes ----------

  function poleCells(context, time) {
    const pole = progress(time, 2.4, 3.0);
    if (pole <= 0) {
      return;
    }
    for (let cell = 0; cell < 14; cell += 1) {
      const turn = (cell / 14) * Math.PI * 1.4 - Math.PI * 0.7;
      const [x, y] = toScreen(0.9 + Math.cos(turn) * 0.035, Math.sin(turn) * 0.3);
      context.fillStyle = `rgba(242,177,52,${0.85 * pole})`;
      context.beginPath();
      context.arc(x, y, 8 * easeOut(pole), 0, Math.PI * 2);
      context.fill();
    }
  }

  function cellField() {
    const cells = [];
    for (let row = -16; row <= 16; row += 1) {
      for (let column = -46; column <= 46; column += 1) {
        const u = column * 0.021 + (row % 2) * 0.0105;
        const v = row * 0.058;
        if (insideShell(u, v, 0.94)) {
          cells.push([u, v]);
        }
      }
    }
    return cells;
  }
  const CELLS = cellField();

  // Stripes made of the cells, gently curved, trunk only: 7 eve stripes about as wide as their gaps, then 14 en.
  function stripes(context, time) {
    const sheet = progress(time, 4.3, 4.7);
    if (sheet <= 0) {
      return;
    }
    const eve = progress(time, 4.7, 5.3);
    const en = progress(time, 5.3, 5.9);
    CELLS.forEach(([u, v], index) => {
      const bent = u + 0.035 * v * v;
      let color = null;
      let strength = 0;
      for (let stripe = 0; stripe < 7; stripe += 1) {
        if (Math.abs(bent - (-0.4 + stripe * 0.16)) < 0.042) {
          color = COLORS.eve;
          strength = clamp(eve * 7 - stripe * 0.6);
        }
      }
      for (let stripe = 0; stripe < 14; stripe += 1) {
        const appears = clamp(en * 14 - stripe * 0.6);
        if (Math.abs(bent - (-0.44 + stripe * 0.08)) < 0.011 && appears > 0) {
          color = COLORS.en;
          strength = appears;
        }
      }
      const [x, y] = toScreen(u, v);
      context.globalAlpha = sheet * 0.6;
      context.fillStyle = COLORS.glow;
      context.beginPath();
      context.arc(x, y, 2.6, 0, Math.PI * 2);
      context.fill();
      if (color && strength > 0) {
        context.globalAlpha = strength * (0.75 + hash(index, 9) * 0.25);
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, 5.4, 0, Math.PI * 2);
        context.fill();
      }
    });
    context.globalAlpha = 1;
  }

  // ---------- screen-space overlays: lineage tree, counter, ruler, scale bar ----------

  function lineageTree(context, generations, alpha) {
    if (generations <= 0 || alpha <= 0) {
      return;
    }
    const top = 70;
    const centerX = 220;
    const width = 300;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = COLORS.line;
    context.lineWidth = 1.2;
    context.beginPath();
    for (let level = 0; level < generations; level += 1) {
      const nodes = 2 ** level;
      const y = top + level * 16;
      for (let node = 0; node < nodes; node += 1) {
        const x = centerX - width / 2 + (width / nodes) * (node + 0.5);
        const childGap = width / nodes / 4;
        context.moveTo(x, y);
        context.lineTo(x, y + 8);
        context.moveTo(x - childGap, y + 8);
        context.lineTo(x + childGap, y + 8);
        context.moveTo(x - childGap, y + 8);
        context.lineTo(x - childGap, y + 16);
        context.moveTo(x + childGap, y + 8);
        context.lineTo(x + childGap, y + 16);
      }
    }
    context.stroke();
    context.restore();
  }

  function ruler(context, view) {
    if (view.amount < 0.2) {
      return;
    }
    const alpha = clamp((view.amount - 0.2) / 0.5);
    const slide = (1 - alpha) * 200;
    const startX = 660 + slide;
    const startY = 980;
    const angle = -1.0;
    const perMicrometre = 1.52 * view.scale;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(startX + Math.cos(angle) * 420, startY + Math.sin(angle) * 420);
    for (let tick = 0; tick * perMicrometre <= 420; tick += 1) {
      const along = tick * perMicrometre;
      const length = tick % 10 === 0 ? 22 : tick % 5 === 0 ? 14 : 8;
      const x = startX + Math.cos(angle) * along;
      const y = startY + Math.sin(angle) * along;
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle + Math.PI / 2) * length, y + Math.sin(angle + Math.PI / 2) * length);
    }
    context.stroke();
    context.restore();
    label(context, "10 µm", startX + Math.cos(angle) * 10 * perMicrometre + 28, startY + Math.sin(angle) * 10 * perMicrometre + 8, { alpha, size: 22 });
  }

  function scaleBar(context, view) {
    const length = 100 * 1.52 * view.scale;
    if (length > 400) {
      return;
    }
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(80, 1010);
    context.lineTo(80 + length, 1010);
    context.moveTo(80, 1002);
    context.lineTo(80, 1018);
    context.moveTo(80 + length, 1002);
    context.lineTo(80 + length, 1018);
    context.stroke();
    label(context, "100 µm", 80, 990);
  }

  // ---------- frame ----------

  function renderAt(context, time) {
    Ink.setTime(time);
    const view = camera(time);
    ground(context);
    context.save();
    applyCamera(context, view);
    grid(context);
    constructionLines(context, time);
    shell(context, time);
    const inside = interiorCycles(context, time);
    const surface = surfaceCycles(context, time);
    poleCells(context, time);
    stripes(context, time);
    context.restore();
    const cycle = time >= 4.3 ? 14 : surface ? surface.cycle : inside ? inside.cycle : 1;
    lineageTree(context, Math.min(cycle, 8), clamp(progress(time, 0.6, 1.0) - progress(time, 4.3, 4.6)));
    label(context, `cycle ${cycle}`, 220, 240, { size: 28, align: "center" });
    ruler(context, view);
    scaleBar(context, view);
    label(context, "eve", 180, 280, { color: COLORS.eve, size: 26, alpha: progress(time, 4.7, 5.3) });
    label(context, "en", 250, 280, { color: COLORS.en, size: 26, alpha: progress(time, 5.3, 5.9) });
  }

  return { renderAt: Ink.onBeat(renderAt), DURATION };
})();
