  // Yeast being eaten: each cell is pulled into the mouth on a beat and vanishes; the larva lunges and rakes on
  // every beat.
  function eatenYeast(context, time) {
    const head = larvaBody(time).spine[0];
    const [clusterX, clusterY] = along(PUPA_HALF_LENGTH + 150);
    for (let cell = 0; cell < 18; cell += 1) {
      const turn = cell * 2.4;
      const distance = 14 + Math.sqrt(cell) * 22;
      const homeX = clusterX + Math.cos(turn) * distance;
      const homeY = clusterY + Math.sin(turn) * distance * 0.8;
      // Nearest cells go first, one bite per beat-ish.
      const eatAt = 0.25 + (cell / 18) * 2.1;
      const pull = easeIn(progress(time, eatAt - 0.2, eatAt));
      if (pull >= 1) {
        continue;
      }
      const x = lerp(homeX, head.x, pull);
      const y = lerp(homeY, head.y, pull);
      const shrink = 1 - pull * 0.8;
      context.fillStyle = "#f5ecd6";
      context.beginPath();
      context.ellipse(x, y, (13 + hash(cell, 1) * 5) * shrink, (10 + hash(cell, 2) * 3) * shrink, hash(cell, 3) * Math.PI, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 1.6;
      context.stroke();
      context.fillStyle = "rgba(120,90,60,0.5)";
      context.beginPath();
      context.arc(x + 2, y + 1, 3.5 * shrink, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Three larval instars on a millimetre ruler: the larva grows by shedding its skin twice.
  function instars(context, local) {
    Ink.paper(context, SIZE);
    context.fillStyle = "rgba(233,194,124,0.35)";
    context.fillRect(0, 0, SIZE, SIZE);
    const rulerY = 900;
    const startX = 170;
    context.strokeStyle = NAVY;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(startX, rulerY);
    context.lineTo(startX + 4 * PIXELS_PER_MM * 1.25, rulerY);
    for (let tick = 0; tick <= 40; tick += 1) {
      const x = startX + (tick / 10) * PIXELS_PER_MM * 1.25;
      context.moveTo(x, rulerY);
      context.lineTo(x, rulerY - (tick % 10 === 0 ? 22 : tick % 5 === 0 ? 14 : 8));
    }
    context.stroke();
    context.fillStyle = NAVY;
    context.font = '24px Consolas, "Courier New", monospace';
    for (let millimetre = 0; millimetre <= 4; millimetre += 1) {
      context.fillText(`${millimetre} mm`, startX + millimetre * PIXELS_PER_MM * 1.25 - 20, rulerY + 36);
    }
    [[1, 230, "1st instar"], [2, 460, "2nd instar"], [4, 690, "3rd instar"]].forEach(([millimetres, y, name], index) => {
      const appear = easeOutBackAmount(progress(local, index * 0.28, index * 0.28 + 0.25));
      if (appear <= 0) {
        return;
      }
      const length = millimetres * PIXELS_PER_MM * 1.25 * appear;
      const path = Larva.smoothPath([[startX + length + 40, y], [startX, y]]);
      const body = Larva.bodyGeometry(path, length, length, length / 11, local * 3 + index, { crawling: true });
      Larva.drawLarvaPaper(context, body, local * 3 + index);
      context.fillStyle = NAVY;
      context.fillText(name, startX, y - length / 11 - 26);
      // The shed skin of the previous instar behind it.
      if (index > 0) {
        context.strokeStyle = "rgba(60,50,40,0.45)";
        context.setLineDash([5, 5]);
        context.lineWidth = 1.4;
        const previous = [1, 2][index - 1] * PIXELS_PER_MM * 1.25;
        context.beginPath();
        context.ellipse(startX + previous / 2, y + 60, previous / 2, previous / 22 + 6, 0, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }
    });
    Ink.finish(context, SIZE, 0.25);
  }

  // Inside the puparium, as a blueprint: the larva itself turns into the fly. Its twelve segments gather into head,
  // thorax and abdomen; the head turns out from inside the thorax (head eversion); eyes, legs (segment by segment,
  // folded along the body) and wing pads grow out of their discs. Drawn in the fly's own frame. 2.5 s.
  function blueprintPupa(context, local) {
    context.fillStyle = "#0d1322";
    context.fillRect(0, 0, SIZE, SIZE);
    const center = [540, 560];
    const angle = -0.35 + local * 0.05;
    const halfLength = 380;
    const halfWidth = 150;
    const toScreen = (u, v) => {
      const x = u * halfLength;
      const y = v * halfWidth;
      return [center[0] + x * Math.cos(angle) - y * Math.sin(angle), center[1] + x * Math.sin(angle) + y * Math.cos(angle)];
    };
    const outline = [];
    for (let step = 0; step <= 24; step += 1) {
      const turn = -Math.PI / 2 + (step / 24) * Math.PI;
      outline.push(toScreen((halfLength - halfWidth + Math.cos(turn) * halfWidth) / halfLength, Math.sin(turn)));
    }
    for (let step = 0; step <= 24; step += 1) {
      const turn = Math.PI / 2 + (step / 24) * Math.PI;
      outline.push(toScreen((-(halfLength - halfWidth) + Math.cos(turn) * halfWidth * 0.92) / halfLength, Math.sin(turn) * 0.92));
    }
    // The fly's frame: head toward the case's head end (+u).
    const FLY_SIZE = 0.62;
    const FLY_ANGLE = angle + Math.PI / 2;
    const flyPoint = ([localX, localY]) => [
      center[0] + (localX * Math.cos(FLY_ANGLE) - localY * Math.sin(FLY_ANGLE)) * FLY_SIZE,
      center[1] + (localX * Math.sin(FLY_ANGLE) + localY * Math.cos(FLY_ANGLE)) * FLY_SIZE,
    ];
    const ellipseIn = (centerLocal, radiusX, radiusY) => Array.from({ length: 40 }, (unused, step) => {
      const turn = (step / 40) * Math.PI * 2;
      return flyPoint([centerLocal[0] + Math.cos(turn) * radiusX, centerLocal[1] + Math.sin(turn) * radiusY]);
    });
    const flash = 1 - progress(local, 0, 0.3);
    const gatherBody = easeInOut(progress(local, 0.3, 1.1));
    const eversion = easeOutBackAmount(progress(local, 0.8, 1.3));
    const eyes = easeOut(progress(local, 1.2, 1.6));
    const legs = progress(local, 1.3, 2.1);
    const wings = easeOut(progress(local, 1.6, 2.3));

    if (flash > 0) {
      trace(context, outline);
      context.fillStyle = `rgba(240,236,224,${0.85 * flash})`;
      context.fill();
    }
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = BLUE_LINE;
    context.lineWidth = 2.4;
    // The larva: a segmented tube that fades as the three body parts take over.
    if (gatherBody < 1) {
      context.globalAlpha = 1 - gatherBody;
      const tube = ellipseIn([0, 120], 95, 400);
      trace(context, tube);
      context.stroke();
      for (let segment = 1; segment < 12; segment += 1) {
        const y = -280 + segment * 66.7;
        trace(context, [flyPoint([-90, y]), flyPoint([0, y + 12]), flyPoint([90, y])], false);
        context.stroke();
      }
      context.globalAlpha = 1;
    }
    // Head, thorax and abdomen gather out of the segments.
    const parts = [
      { from: [0, -60], to: [0, -140], fromRadius: [40, 25], toRadius: [100, 60], amount: eversion },
      { from: [0, -40], to: [0, 0], fromRadius: [90, 100], toRadius: [98, 122], amount: gatherBody },
      { from: [0, 300], to: [0, 285], fromRadius: [95, 260], toRadius: [112, 185], amount: gatherBody },
    ];
    parts.forEach(({ from, to, fromRadius, toRadius, amount }, index) => {
      if (amount <= 0) {
        return;
      }
      const shape = ellipseIn([lerp(from[0], to[0], amount), lerp(from[1], to[1], amount)], lerp(fromRadius[0], toRadius[0], amount), lerp(fromRadius[1], toRadius[1], amount));
      trace(context, shape);
      context.globalAlpha = Math.min(1, amount * 1.5);
      context.fillStyle = "rgba(169,214,232,0.08)";
      context.fill();
      context.stroke();
      if (index === 2) {
        for (let band = 1; band < 6; band += 1) {
          const y = lerp(from[1], to[1], amount) - 150 + band * 55;
          trace(context, [flyPoint([-95, y]), flyPoint([0, y + 10]), flyPoint([95, y])], false);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    });
    // Discs: a small glow where each organ starts, fading as it grows.
    const discGlow = (localPoint, start) => {
      const glow = progress(local, start - 0.3, start) * (1 - progress(local, start + 0.2, start + 0.5));
      if (glow > 0) {
        const [x, y] = flyPoint(localPoint);
        context.fillStyle = `rgba(120,220,170,${0.8 * glow})`;
        context.beginPath();
        context.arc(x, y, 9, 0, Math.PI * 2);
        context.fill();
      }
    };
    // Eyes.
    [-1, 1].forEach((side) => {
      discGlow([side * 72, -142], 1.2);
      if (eyes > 0) {
        trace(context, ellipseIn([side * 72, -142], 42 * eyes, 52 * eyes));
        context.fillStyle = "rgba(255,122,102,0.35)";
        context.fill();
        context.strokeStyle = "#ff7a66";
        context.stroke();
        context.strokeStyle = BLUE_LINE;
      }
    });
    // Legs: three segments each, growing one after another, folded back along the body as they lie in the pupa.
    const LEG_ROOTS = [[30, -50], [40, 15], [35, 70]];
    [-1, 1].forEach((side) => {
      LEG_ROOTS.forEach((root, pair) => {
        discGlow([side * root[0], root[1]], 1.3 + pair * 0.1);
        let [x, y] = [side * root[0], root[1]];
        const points = [[x, y]];
        [[0.9, 80], [1.35, 90], [1.55, 70]].forEach(([segmentAngle, length], segment) => {
          const grown = clamp((legs - pair * 0.1) * 3 - segment);
          if (grown <= 0) {
            return;
          }
          x += side * Math.cos(segmentAngle) * length * grown;
          y += Math.sin(segmentAngle) * length * grown;
          points.push([x, y]);
        });
        if (points.length > 1) {
          trace(context, points.map(flyPoint), false);
          context.lineWidth = 3;
          context.stroke();
          context.fillStyle = BLUE_LINE;
          points.slice(1).forEach((point) => {
            const [jointX, jointY] = flyPoint(point);
            context.beginPath();
            context.arc(jointX, jointY, 3.5, 0, Math.PI * 2);
            context.fill();
          });
          context.lineWidth = 2.4;
        }
      });
    });
    // Wing pads: buds at the shoulders that lengthen back along the body.
    [-1, 1].forEach((side) => {
      discGlow([side * 90, 70], 1.6);
      if (wings > 0) {
        trace(context, ellipseIn([side * 100, 70 + 110 * wings], 18 + 30 * wings, 20 + 120 * wings));
        context.fillStyle = "rgba(169,214,232,0.12)";
        context.fill();
        context.stroke();
      }
    });
    context.restore();
    trace(context, outline);
    context.strokeStyle = BLUE_LINE;
    context.lineWidth = 4;
    context.stroke();
    if (flash > 0) {
      context.strokeStyle = `rgba(242,177,52,${flash})`;
      context.lineWidth = 1.6;
      context.beginPath();
      for (let ray = 0; ray < 40; ray += 1) {
        const turn = (ray / 40) * Math.PI * 2;
        context.moveTo(center[0] + Math.cos(turn) * 420, center[1] + Math.sin(turn) * 210);
        context.lineTo(center[0] + Math.cos(turn) * (480 + hash(ray, 6) * 60), center[1] + Math.sin(turn) * (250 + hash(ray, 6) * 40));
      }
      context.stroke();
    }
    context.fillStyle = BLUE_LINE;
    context.font = '28px Consolas, "Courier New", monospace';
    context.fillText(`day ${5 + Math.floor((local / 2.5) * 4)}`, 60, 80);
    const caption = local < 1.2 ? "head turns out" : local < 1.6 ? "eyes" : local < 2.0 ? "legs" : "wings";
    context.globalAlpha = local > 0.8 ? 0.8 : 0;
    context.fillText(caption, 60, 120);
    context.globalAlpha = 1;
  }
