  // Inside the puparium, as a blueprint, following the biology: the larval cells (big cells with nuclei) break down
  // into fragments (histolysis); the fragments drift with small random motion and are drawn toward the imaginal discs
  // (folded sacs of small cells: eye-antenna, wing, legs); the discs grow, unfold, and the fly takes shape around them.
  const BLUE_LINE = "#b8dcea";
  const DISCS = [
    { u: 0.62, v: -0.28, name: "eye", size: 1.0 }, { u: 0.62, v: 0.28, name: "eye", size: 1.0 },
    { u: 0.2, v: -0.55, name: "wing", size: 1.3 }, { u: 0.2, v: 0.55, name: "wing", size: 1.3 },
    { u: 0.05, v: -0.25, name: "leg", size: 0.7 }, { u: 0.05, v: 0.25, name: "leg", size: 0.7 },
    { u: -0.12, v: -0.25, name: "leg", size: 0.7 }, { u: -0.12, v: 0.25, name: "leg", size: 0.7 },
    { u: -0.28, v: -0.22, name: "leg", size: 0.7 }, { u: -0.28, v: 0.22, name: "leg", size: 0.7 },
  ];

  function blueprintPupa(context, local) {
    context.fillStyle = "#0d1322";
    context.fillRect(0, 0, SIZE, SIZE);
    const center = [540, 560];
    const angle = -0.35 + local * 0.12;
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
    const flash = 1 - progress(local, 0, 0.2);
    const breakdown = easeInOut(progress(local, 0.15, 0.7));
    const gather = easeInOut(progress(local, 0.5, 1.1));
    const grow = easeOut(progress(local, 0.55, 1.2));
    const form = progress(local, 0.95, 1.4);
    context.save();
    trace(context, outline);
    context.fillStyle = `rgba(240,236,224,${0.85 * flash})`;
    context.fill();
    context.clip();
    // Larval cells: a packed sheet of large polygons with nuclei, shrinking and breaking apart.
    for (let row = -5; row <= 5; row += 1) {
      for (let column = -9; column <= 9; column += 1) {
        const u = column * 0.105 + (row % 2) * 0.052;
        const v = row * 0.19;
        if (Math.abs(u) > 0.95 || Math.abs(v) > 0.95) {
          continue;
        }
        const index = (row + 5) * 19 + column + 9;
        const lysis = clamp(breakdown * 1.6 - hash(index, 1) * 0.6);
        if (lysis >= 1) {
          continue;
        }
        const [x, y] = toScreen(u, v);
        const radius = 34 * (1 - lysis * 0.7);
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = (corner / 6) * Math.PI * 2 + angle + hash(index, 2) * 0.4;
          const reach = radius * (0.85 + hash(index, corner) * 0.25);
          context.lineTo(x + Math.cos(turn) * reach, y + Math.sin(turn) * reach);
        }
        context.closePath();
        context.strokeStyle = `rgba(169,214,232,${0.55 * (1 - lysis)})`;
        context.lineWidth = 1.4;
        context.stroke();
        context.fillStyle = `rgba(230,120,220,${0.7 * (1 - lysis)})`;
        context.beginPath();
        context.arc(x + (hash(index, 3) - 0.5) * 10, y + (hash(index, 4) - 0.5) * 10, 6 * (1 - lysis * 0.5), 0, Math.PI * 2);
        context.fill();
      }
    }
    // Fragments: released as cells break, jiggling (Brownian), then drawn to the nearest disc.
    for (let piece = 0; piece < 420; piece += 1) {
      const release = hash(piece, 5) * 0.6;
      const freed = clamp((breakdown - release) / 0.3);
      if (freed <= 0) {
        continue;
      }
      const startU = (hash(piece, 6) - 0.5) * 1.8;
      const startV = (hash(piece, 7) - 0.5) * 1.8;
      const disc = DISCS[piece % DISCS.length];
      const pull = clamp((gather - hash(piece, 8) * 0.3) / 0.7);
      const jitterU = Math.sin(local * 9 + piece * 1.7) * 0.012 + Math.sin(local * 5.3 + piece) * 0.01;
      const jitterV = Math.cos(local * 8.1 + piece * 2.3) * 0.025;
      const u = lerp(startU, disc.u + (hash(piece, 9) - 0.5) * 0.08 * disc.size, easeInOut(pull)) + jitterU * (1 - pull);
      const v = lerp(startV, disc.v + (hash(piece, 10) - 0.5) * 0.12 * disc.size, easeInOut(pull)) + jitterV * (1 - pull);
      const [x, y] = toScreen(u, v);
      context.fillStyle = pull > 0.9 ? "rgba(120,220,170,0.9)" : `rgba(169,214,232,${0.6 * freed})`;
      context.beginPath();
      context.arc(x, y, 1.8 + hash(piece, 11) * 1.6, 0, Math.PI * 2);
      context.fill();
    }
    // Imaginal discs: folded sacs (concentric rings of small cells) that grow, then flatten out as they unfold.
    if (grow > 0) {
      DISCS.forEach((disc, index) => {
        const [x, y] = toScreen(disc.u, disc.v);
        const unfold = progress(local, 1.0, 1.3);
        for (let ring = 1; ring <= 3; ring += 1) {
          const radius = ring * 9 * disc.size * grow * (1 + unfold * 0.6);
          context.strokeStyle = `rgba(120,220,170,${0.85 * (1 - unfold * 0.7)})`;
          context.lineWidth = 1.4;
          context.beginPath();
          context.ellipse(x, y, radius * (disc.name === "wing" ? 1.6 : 1), radius, angle + index, 0, Math.PI * 2);
          context.stroke();
        }
      });
    }
    // The fly taking shape around the discs, in light lines.
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
    context.fillText(`day ${5 + Math.floor((local / 1.4) * 4)}`, 820, 120);
  }
