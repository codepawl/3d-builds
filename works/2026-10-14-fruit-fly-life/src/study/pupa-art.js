  // The puparium as a capsule: straight sides, round ends (Kevin's design and the photos), a little narrower at the tail.
  function pupaOutline(squeeze = 1) {
    const points = [];
    const radius = PUPA_HALF_WIDTH * squeeze;
    const straight = PUPA_HALF_LENGTH - PUPA_HALF_WIDTH;
    for (let step = 0; step <= 24; step += 1) {
      const turn = -Math.PI / 2 + (step / 24) * Math.PI;
      points.push(along(straight + Math.cos(turn) * radius, Math.sin(turn) * radius));
    }
    for (let step = 0; step <= 24; step += 1) {
      const turn = Math.PI / 2 + (step / 24) * Math.PI;
      points.push(along(-straight + Math.cos(turn) * radius * 0.92, Math.sin(turn) * radius * 0.92));
    }
    return points;
  }

  // Signed distance along the body for a screen point (+ toward the head).
  function lengthwiseOf([x, y]) {
    return (x - CENTER[0]) * DIRECTION[0] + (y - CENTER[1]) * DIRECTION[1];
  }

  function hatchStrip(context, outline, { fromAcross, toAcross, spacing, alpha, color = "#1c0c04", tilt = 0.25, width = 1.1 }) {
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.beginPath();
    for (let distance = -PUPA_HALF_LENGTH - 40; distance <= PUPA_HALF_LENGTH + 40; distance += spacing) {
      const jitter = (hash(distance, 3) - 0.5) * spacing * 0.5;
      const [startX, startY] = along(distance + jitter, fromAcross);
      const [endX, endY] = along(distance + jitter + (toAcross - fromAcross) * tilt, toAcross);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    }
    context.stroke();
    context.restore();
  }

  function drawPupa(context, time, { seeThrough = 0, capOpen = 0, impact = 0 }) {
    const outline = pupaOutline();
    // Long hatched cast shadow on the fruit, to the right of the case.
    context.save();
    context.strokeStyle = "rgba(70,25,8,0.45)";
    context.lineWidth = 1.2;
    context.beginPath();
    for (let distance = -PUPA_HALF_LENGTH; distance <= PUPA_HALF_LENGTH * 0.9; distance += 6) {
      const [startX, startY] = along(distance, PUPA_HALF_WIDTH * 0.9);
      const [endX, endY] = along(distance - 30, PUPA_HALF_WIDTH * 1.7 + hash(distance, 1) * 30);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    }
    context.stroke();
    context.restore();
    // Two tones: the lit face and a near-black shadow face along one side.
    trace(context, outline);
    context.fillStyle = caseColor(time);
    context.globalAlpha = 1 - 0.55 * seeThrough;
    context.fill();
    context.globalAlpha = 1;
    const brown = progress(time, 3.6, 4.2);
    context.save();
    trace(context, outline);
    context.clip();
    const shadowFace = [along(-PUPA_HALF_LENGTH - 20, PUPA_HALF_WIDTH * 0.35), along(PUPA_HALF_LENGTH + 20, PUPA_HALF_WIDTH * 0.35), along(PUPA_HALF_LENGTH + 20, PUPA_HALF_WIDTH * 1.2), along(-PUPA_HALF_LENGTH - 20, PUPA_HALF_WIDTH * 1.2)];
    trace(context, shadowFace);
    context.fillStyle = `rgba(40,16,6,${0.25 + 0.5 * brown})`;
    context.fill();
    context.restore();
    hatchStrip(context, outline, { fromAcross: PUPA_HALF_WIDTH * 0.1, toAcross: PUPA_HALF_WIDTH * 1.1, spacing: 3.5, alpha: 0.35 + 0.3 * brown });
    hatchStrip(context, outline, { fromAcross: -PUPA_HALF_WIDTH, toAcross: PUPA_HALF_WIDTH * 0.2, spacing: 9, alpha: 0.18, tilt: 0.05, color: "#5a2a10", width: 0.9 });
    // Curved segment bands.
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = "rgba(35,15,5,0.7)";
    context.lineWidth = 1.8;
    for (let segment = -5; segment <= 4; segment += 1) {
      const distance = segment * PUPA_HALF_LENGTH * 0.18;
      const [startX, startY] = along(distance, -PUPA_HALF_WIDTH);
      const [middleX, middleY] = along(distance - 14, 0);
      const [endX, endY] = along(distance, PUPA_HALF_WIDTH);
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(middleX, middleY, endX, endY);
      context.stroke();
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 3;
    context.stroke();
    // Construction lines: the axis and an offset outline.
    context.strokeStyle = "rgba(70,90,200,0.55)";
    context.lineWidth = 1.2;
    trace(context, [along(-PUPA_HALF_LENGTH * 1.4, 0), along(PUPA_HALF_LENGTH * 1.5, 0)], false);
    context.stroke();
    trace(context, pupaOutline(1.18).map(([x, y]) => [x - 6, y - 8]));
    context.stroke();
    // Anterior spiracles: stalks with fanned tips.
    const horns = progress(time, 3.1, 3.6);
    if (horns > 0 && capOpen < 0.5) {
      [-1, 1].forEach((side) => {
        const [baseX, baseY] = along(PUPA_HALF_LENGTH * 0.88, side * PUPA_HALF_WIDTH * 0.45);
        const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.88 + 48 * horns, side * PUPA_HALF_WIDTH * (0.45 + 0.5 * horns));
        context.strokeStyle = "#4a3020";
        context.lineWidth = 4;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(baseX, baseY);
        context.lineTo(tipX, tipY);
        context.stroke();
        const angle = Math.atan2(tipY - baseY, tipX - baseX);
        context.lineWidth = 1.8;
        context.beginPath();
        for (let ray = -3; ray <= 3; ray += 1) {
          context.moveTo(tipX, tipY);
          context.lineTo(tipX + Math.cos(angle + ray * 0.28) * 11 * horns, tipY + Math.sin(angle + ray * 0.28) * 11 * horns);
        }
        context.stroke();
      });
    }
    drawImpact(context, impact);
    if (capOpen > 0) {
      drawOpening(context, time, capOpen, outline);
    }
  }

  // Impact lines: dashes radiating from the head end, longer for a harder hit.
  function drawImpact(context, impact) {
    if (impact <= 0.02) {
      return;
    }
    const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.9);
    context.strokeStyle = NAVY;
    context.lineCap = "round";
    context.lineWidth = 1.6 + impact * 1.4;
    context.beginPath();
    for (let ray = 0; ray < 14; ray += 1) {
      const angle = HEAD_DIRECTION + (ray / 13 - 0.5) * 3.0 + (hash(ray, 7) - 0.5) * 0.2;
      const inner = PUPA_HALF_WIDTH * 1.05 + hash(ray, 8) * 12;
      const outer = inner + 14 + impact * (30 + hash(ray, 9) * 30);
      context.moveTo(tipX + Math.cos(angle) * inner, tipY + Math.sin(angle) * inner);
      context.lineTo(tipX + Math.cos(angle) * outer, tipY + Math.sin(angle) * outer);
    }
    context.stroke();
  }

  // The torn opening: a zigzag rim, a dark hollow, and the cap with its wall thickness swinging on its hinge.
  function drawOpening(context, time, capOpen, outline) {
    const opening = PUPA_HALF_LENGTH * 0.62;
    const cap = outline.filter((point) => lengthwiseOf(point) > opening);
    const rim = [];
    for (let step = 0; step <= 16; step += 1) {
      const across = lerp(-PUPA_HALF_WIDTH, PUPA_HALF_WIDTH, step / 16);
      rim.push(along(opening + (step % 2 ? 7 : -5), across));
    }
    const hollow = [...rim, ...cap.slice().reverse()];
    trace(context, hollow);
    context.fillStyle = "#1a0c05";
    context.fill();
    trace(context, rim, false);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    const [hingeX, hingeY] = along(opening, -PUPA_HALF_WIDTH);
    const turn = -1.5 * Math.min(1.15, capOpen);
    const swing = (points) => points.map(([x, y]) => [hingeX + (x - hingeX) * Math.cos(turn) - (y - hingeY) * Math.sin(turn), hingeY + (x - hingeX) * Math.sin(turn) + (y - hingeY) * Math.cos(turn)]);
    const capShape = [...rim.slice().reverse(), ...cap];
    const outer = swing(capShape);
    trace(context, outer);
    context.fillStyle = caseColor(time);
    context.fill();
    // The inner lining shows as a cream band inside the rim.
    const lining = swing(capShape.map((point) => {
      const [x, y] = point;
      const [centerX, centerY] = along(PUPA_HALF_LENGTH * 0.82);
      return [lerp(x, centerX, 0.25), lerp(y, centerY, 0.25)];
    }));
    trace(context, lining);
    context.fillStyle = "#efe2c4";
    context.fill();
    context.strokeStyle = "rgba(60,30,10,0.7)";
    context.lineWidth = 1.4;
    context.stroke();
    trace(context, outer);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
  }

  // Crumbs and ink flecks thrown out by the pop: ballistic, falling, fading.
  function drawDebris(context, time) {
    const since = time - 5.82;
    if (since <= 0 || since > 0.9) {
      return;
    }
    const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.95);
    context.fillStyle = "#1a0c05";
    for (let piece = 0; piece < 22; piece += 1) {
      const angle = HEAD_DIRECTION + (hash(piece, 2) - 0.5) * 3.2;
      const speed = 160 + hash(piece, 3) * 260;
      const x = tipX + Math.cos(angle) * speed * since;
      const y = tipY + Math.sin(angle) * speed * since + 260 * since * since;
      const size = 1.5 + hash(piece, 4) * 4 * (1 - since);
      context.globalAlpha = 1 - progress(since, 0.6, 0.9);
      context.beginPath();
      if (piece % 3 === 0) {
        // A teardrop fleck pointing along its flight.
        const heading = Math.atan2(Math.sin(angle) * speed + 520 * since, Math.cos(angle) * speed);
        context.ellipse(x, y, size * 2.2, size, heading, 0, Math.PI * 2);
      } else {
        context.arc(x, y, size, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
  }
