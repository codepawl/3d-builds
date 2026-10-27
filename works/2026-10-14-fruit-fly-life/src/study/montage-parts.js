  // ---------- the other angles ----------

  // Macro on the feeding head: the same story frame, magnified around the mouth hooks.
  function macroHead(context, storyTime, local) {
    const head = larvaBody(storyTime).spine[0];
    const zoom = lerp(3.2, 3.8, local);
    context.save();
    context.translate(540, 540);
    context.scale(zoom, zoom);
    context.translate(-head.x, -head.y);
    story(context, storyTime);
    context.restore();
  }

  // Seen from above through a lens: a dish of food with larvae crowding around it.
  function dish(context, local) {
    Ink.paper(context, SIZE);
    const centerX = 540;
    const centerY = 540;
    const radius = 470;
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = "#e3b56c";
    context.fill();
    context.clip();
    for (let ring = 0; ring < 40; ring += 1) {
      context.strokeStyle = `rgba(150,90,40,${0.08 + hash(ring, 1) * 0.08})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, 160 + ring * 8 + hash(ring, 2) * 4, 0, Math.PI * 2);
      context.stroke();
    }
    // The food, dark and lumpy.
    context.beginPath();
    for (let step = 0; step < 40; step += 1) {
      const turn = (step / 40) * Math.PI * 2;
      const reach = 150 + Math.sin(turn * 3) * 18 + Math.sin(turn * 7) * 8;
      context.lineTo(centerX + Math.cos(turn) * reach, centerY + Math.sin(turn) * reach * 1.15);
    }
    context.closePath();
    context.fillStyle = "#5a2e14";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    // Larvae pointing in at the food, wriggling.
    for (let larva = 0; larva < 14; larva += 1) {
      const turn = (larva / 14) * Math.PI * 2 + hash(larva, 3) * 0.3;
      const start = 330 + hash(larva, 4) * 80;
      const bend = Math.sin(local * 14 + larva) * 0.25;
      const points = [0, 1, 2, 3].map((index) => {
        const distance = start - index * 50;
        const angle = turn + bend * (index - 1.5) * 0.4;
        return [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance];
      });
      const path = Larva.smoothPath(points);
      const body = Larva.bodyGeometry(path, path.length, path.length * 0.98, 13, local * 3 + larva, { crawling: true });
      Larva.drawLarvaPaper(context, body, local * 3 + larva);
    }
    context.restore();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = NAVY;
    context.lineWidth = 5;
    context.stroke();
  }

  // Looking straight down the larva from its tail: segments recede like a telescope; the rear spiracles sit in the
  // middle of the tail plate.
  function endOn(context, local) {
    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);
    const pulse = 1 + Math.sin(local * 18) * 0.03;
    const near = [420, 650];
    const far = [860, 230];
    for (let ring = 11; ring >= 0; ring -= 1) {
      const amount = ring / 11;
      const x = lerp(near[0], far[0], amount ** 0.8);
      const y = lerp(near[1], far[1], amount ** 0.8);
      const radius = lerp(250, 60, amount) * (ring % 2 ? 1 : pulse);
      context.beginPath();
      context.ellipse(x, y, radius, radius * 0.92, -0.75, 0, Math.PI * 2);
      context.fillStyle = ring === 0 ? "#f6f0e2" : "#efe6d2";
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 2;
      context.stroke();
    }
    // Tail plate: short radiating strokes and the two spiracles.
    context.strokeStyle = "rgba(60,45,35,0.55)";
    context.lineWidth = 1.2;
    context.beginPath();
    for (let ray = 0; ray < 36; ray += 1) {
      const angle = (ray / 36) * Math.PI * 2;
      context.moveTo(near[0] + Math.cos(angle) * 70, near[1] + Math.sin(angle) * 64);
      context.lineTo(near[0] + Math.cos(angle) * (150 + hash(ray, 5) * 40), near[1] + Math.sin(angle) * (138 + hash(ray, 5) * 36));
    }
    context.stroke();
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.ellipse(near[0] + side * 24, near[1], 14, 18, 0, 0, Math.PI * 2);
      context.fillStyle = "#1a120c";
      context.fill();
      context.strokeStyle = "#c8b48c";
      context.lineWidth = 2;
      context.stroke();
    });
    Ink.finish(context, SIZE, 0.25);
  }

  // Inside the puparium, as a blueprint: the larval body breaks down (tissue swirls) and the fly takes shape.
  const BLUE_LINE = "#b8dcea";
  function blueprintPupa(context, local) {
    context.fillStyle = "#0d1322";
    context.fillRect(0, 0, SIZE, SIZE);
    const center = [540, 560];
    const angle = -0.35;
    const outline = Array.from({ length: 64 }, (unused, step) => {
      const turn = (step / 64) * Math.PI * 2;
      const lengthwise = Math.cos(turn);
      const width = Math.sign(Math.sin(turn)) * Math.abs(Math.sin(turn)) ** 0.7 * 150;
      const x = lengthwise * 380;
      return [center[0] + x * Math.cos(angle) - width * Math.sin(angle), center[1] + x * Math.sin(angle) + width * Math.cos(angle)];
    });
    const flash = 1 - progress(local, 0, 0.25);
    context.save();
    trace(context, outline);
    context.fillStyle = `rgba(240,236,224,${0.9 * flash})`;
    context.fill();
    context.clip();
    // Larval tissue breaking down: dots swirling on spirals, fading as the fly forms.
    const swirl = progress(local, 0.15, 1.1);
    for (let dot = 0; dot < 520; dot += 1) {
      const arm = dot % 3;
      const radius = 20 + (dot / 520) * 300;
      const turn = radius * 0.03 + arm * 2.1 + swirl * 3;
      const x = center[0] + Math.cos(turn) * radius * 1.1;
      const y = center[1] + Math.sin(turn) * radius * 0.45;
      context.fillStyle = dot % 5 ? `rgba(120,220,170,${0.7 * (1 - progress(local, 0.8, 1.3))})` : "rgba(230,120,220,0.7)";
      context.beginPath();
      context.arc(x, y, 2.4, 0, Math.PI * 2);
      context.fill();
    }
    // The fly forming: drawn on its own layer, turned into light lines, faded in.
    const form = progress(local, 0.6, 1.3);
    if (form > 0) {
      const layer = flyCanvas();
      Fly.fly(layer, { x: center[0] - 30, y: center[1], angle: angle - Math.PI / 2, scale: 0.42, seed: 31, wingSpread: 0 });
      context.globalAlpha = form * 0.8;
      context.globalCompositeOperation = "screen";
      context.filter = "grayscale(1) invert(1) brightness(0.8) sepia(1) hue-rotate(160deg) saturate(2)";
      context.drawImage(flyLayer, 0, 0);
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = BLUE_LINE;
    context.lineWidth = 4;
    context.stroke();
    if (flash > 0) {
      context.strokeStyle = `rgba(184,220,234,${flash})`;
      context.lineWidth = 1.5;
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
    context.fillText(`day ${5 + Math.floor((local / 1.4) * 4)}`, 820, 120);
  }

  // ---------- the montage: fast cuts between angles ----------

  const SHOTS = [
    { end: 1.0, draw: (context, local, time) => story(context, time * 2.0) },
    { end: 1.4, draw: (context, local) => macroHead(context, 2.0 + local * 0.3, local) },
    { end: 1.85, draw: (context, local) => dish(context, local) },
    { end: 2.25, draw: (context, local) => endOn(context, local) },
    { end: 3.35, draw: (context, local) => story(context, 2.5 + local * 1.7) },
    { end: 4.75, draw: (context, local) => blueprintPupa(context, local * 1.4) },
    { end: 8.0, draw: (context, local) => story(context, 5.2 + local * 2.8, { inside: false }) },
  ];

  function renderAt(context, time) {
    Ink.setTime(time);
    let start = 0;
    for (const shot of SHOTS) {
      if (time < shot.end || shot === SHOTS[SHOTS.length - 1]) {
        shot.draw(context, clamp((time - start) / (shot.end - start)), time);
        return;
      }
      start = shot.end;
    }
  }

  return { renderAt, DURATION };
