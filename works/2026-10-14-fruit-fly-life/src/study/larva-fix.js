  // The gut: a tube coiled into loops (a prolate trochoid laid along the body), the way the folded midgut looks.
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

  // Sketched shading down the far side of the body, in clusters of short strokes, plus a pale sheen on top.
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

  // Fruit flesh as flat polygon cells with thin outlines and a few texture strokes, low in contrast like a print.
  function fruitFlesh(context) {
    context.fillStyle = "#e6b873";
    context.fillRect(0, 0, SIZE, SIZE);
    const tones = ["#e9bd78", "#e2b06a", "#ecc685", "#dfab64"];
    for (let row = -1; row < 11; row += 1) {
      for (let column = -1; column < 10; column += 1) {
        const x = column * 120 + (row % 2) * 60 + (hash(row, column, 1) - 0.5) * 40;
        const y = row * 104 + (hash(column, row, 2) - 0.5) * 34;
        const radius = 66 + hash(row, column, 3) * 12;
        const turn = hash(row, column, 4) * Math.PI;
        const corners = 6 + Math.floor(hash(row, column, 5) * 2);
        const polygon = Array.from({ length: corners }, (unused, corner) => {
          const angle = turn + (corner / corners) * Math.PI * 2;
          const reach = radius * (0.85 + hash(row, column, corner) * 0.2);
          return [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.9];
        });
        trace(context, polygon);
        context.fillStyle = tones[Math.floor(hash(row, column, 6) * tones.length)];
        context.fill();
        context.strokeStyle = "rgba(150,92,40,0.45)";
        context.lineWidth = 1.5;
        context.stroke();
        context.strokeStyle = "rgba(160,100,45,0.25)";
        context.lineWidth = 1;
        context.beginPath();
        for (let stroke = 0; stroke < 9; stroke += 1) {
          const startX = x + (hash(stroke, row, column) - 0.5) * radius * 1.1;
          const startY = y + (hash(column, stroke, row) - 0.5) * radius * 0.9;
          const tilt = turn + (hash(stroke, column) - 0.5) * 0.8;
          context.moveTo(startX, startY);
          context.lineTo(startX + Math.cos(tilt) * 12, startY + Math.sin(tilt) * 12);
        }
        context.stroke();
      }
    }
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
      for (let wrinkle = 0; wrinkle < 7; wrinkle += 1) {
        const u = -0.6 + wrinkle * 0.2;
        trace(context, [eggPoint(egg, u, -0.7 * squash), eggPoint(egg, u + 0.08, 0), eggPoint(egg, u - 0.04, 0.8 * squash)], false);
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
