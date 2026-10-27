  // Food as it really is for a larva: a smear of yeast paste on the fruit (single yeast cells are about 5 µm, too
  // small to draw at this scale). Each beat the larva plunges its head in and rakes with its mouth hooks; the near
  // edge is gnawed back in scallops and crumbs fly.
  function eatenYeast(context, time) {
    const head = larvaBody(time).spine[0];
    const [centerX, centerY] = along(PUPA_HALF_LENGTH + 190);
    const eaten = progress(time, 0.2, 2.5);
    if (eaten >= 1) {
      return;
    }
    const bites = Math.floor(eaten * 9);
    const outline = [];
    for (let step = 0; step < 60; step += 1) {
      const turn = (step / 60) * Math.PI * 2;
      // How far this edge point faces the larva (1 = straight at it).
      const towardLarva = Math.max(0, -(Math.cos(turn) * DIRECTION[0] + Math.sin(turn) * DIRECTION[1]));
      const lumpy = 1 + 0.12 * Math.sin(turn * 5 + 1) + 0.06 * Math.sin(turn * 11);
      const gnawed = towardLarva * eaten * 0.9 + towardLarva * 0.08 * Math.abs(Math.sin(turn * 18 + bites));
      const reach = 110 * lumpy * Math.max(0.05, 1 - gnawed) * (1 - eaten * 0.35);
      outline.push([centerX + Math.cos(turn) * reach, centerY + Math.sin(turn) * reach * 0.8]);
    }
    trace(context, outline);
    context.fillStyle = "#e8d6a8";
    context.fill();
    context.save();
    trace(context, outline);
    context.clip();
    context.fillStyle = "rgba(150,110,60,0.45)";
    for (let speck = 0; speck < 260; speck += 1) {
      context.fillRect(centerX + (hash(speck, 1) - 0.5) * 240, centerY + (hash(speck, 2) - 0.5) * 200, 1.6, 1.6);
    }
    context.strokeStyle = "rgba(120,80,40,0.35)";
    context.lineWidth = 1;
    context.beginPath();
    for (let cluster = 0; cluster < 40; cluster += 1) {
      const x = centerX + (hash(cluster, 3) - 0.5) * 220;
      const y = centerY + (hash(cluster, 4) - 0.5) * 180;
      for (let stroke = 0; stroke < 4; stroke += 1) {
        context.moveTo(x + stroke * 3, y);
        context.lineTo(x + stroke * 3 + 6, y + 8);
      }
    }
    context.stroke();
    context.restore();
    trace(context, outline);
    context.strokeStyle = "rgba(110,70,30,0.8)";
    context.lineWidth = 2;
    context.stroke();
    // Crumbs thrown up by the rake, right after each plunge.
    const phase = (time / Ink.BEAT) % 1;
    if (phase < 0.4) {
      context.fillStyle = "rgba(200,170,110,0.9)";
      for (let crumb = 0; crumb < 6; crumb += 1) {
        const angle = Math.atan2(DIRECTION[1], DIRECTION[0]) + Math.PI + (hash(crumb, Math.floor(time / Ink.BEAT)) - 0.5) * 2.2;
        const distance = 10 + phase * 70 * (0.5 + hash(crumb, 5));
        context.beginPath();
        context.arc(head.x + Math.cos(angle) * distance, head.y + Math.sin(angle) * distance, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
