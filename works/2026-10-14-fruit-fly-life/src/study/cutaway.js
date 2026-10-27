  // Inside the puparium as a hand-drawn cutaway, in the film's own ink style: one real stage per beat, each cut with a
  // flash and a zoom kick. Day 4 white larva in a fresh case, day 5 prepupa, day 6 pale pharate adult with legs and
  // wings folded, day 7 eyes turn red, day 8 bristles and wings darken. 2.5 s.
  const CUTAWAY_STAGES = [
    { label: "day 4  the case hardens" },
    { label: "day 5  prepupa" },
    { label: "day 6  legs and wings form" },
    { label: "day 7  eyes turn red" },
    { label: "day 8  bristles darken" },
  ];

  function cutawayPupa(context, local) {
    const stage = Math.min(4, Math.floor(local / 0.5));
    const within = (local - stage * 0.5) / 0.5;
    Ink.paper(context, SIZE);
    context.fillStyle = "rgba(233,194,124,0.3)";
    context.fillRect(0, 0, SIZE, SIZE);
    const center = [540, 560];
    const angle = -0.42;
    const halfLength = 430;
    const halfWidth = 165;
    const direction = [Math.cos(angle), Math.sin(angle)];
    const point = (along, across) => [center[0] + direction[0] * along - direction[1] * across, center[1] + direction[1] * along + direction[0] * across];
    const capsule = (scale) => {
      const points = [];
      const radius = halfWidth * scale;
      const straight = halfLength - halfWidth;
      for (let step = 0; step <= 24; step += 1) {
        const turn = -Math.PI / 2 + (step / 24) * Math.PI;
        points.push(point(straight + Math.cos(turn) * radius, Math.sin(turn) * radius));
      }
      for (let step = 0; step <= 24; step += 1) {
        const turn = Math.PI / 2 + (step / 24) * Math.PI;
        points.push(point(-straight + Math.cos(turn) * radius * 0.92, Math.sin(turn) * radius * 0.92));
      }
      return points;
    };
    const breathe = 1 + 0.012 * Math.sin(local * Math.PI * 4);
    context.save();
    context.translate(center[0], center[1]);
    context.scale(breathe, breathe);
    context.translate(-center[0], -center[1]);
    // The case wall: brown outside, then the cut face, then the hollow.
    const outer = capsule(1);
    const inner = capsule(0.9);
    trace(context, outer);
    context.fillStyle = stage === 0 ? "#d9b27a" : "#7a4020";
    context.fill();
    hatchStrip(context, outer, { fromAcross: 0, toAcross: halfWidth * 1.2, spacing: 4, alpha: 0.35 });
    trace(context, inner);
    context.fillStyle = "#f3e7cc";
    context.fill();
    context.save();
    trace(context, inner);
    context.clip();
    // Shadow inside the hollow, on the far wall.
    context.strokeStyle = "rgba(90,50,20,0.3)";
    context.lineWidth = 1;
    context.beginPath();
    for (let distance = -halfLength; distance <= halfLength; distance += 5) {
      const [startX, startY] = point(distance, -halfWidth * 0.9);
      const [endX, endY] = point(distance + 20, -halfWidth * 0.55);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    }
    context.stroke();
    // The animal at this stage.
    if (stage <= 1) {
      const length = stage === 0 ? 720 : 560;
      const path = Larva.smoothPath([point(halfLength * 0.82, 0), point(-halfLength * 0.82, 0)]);
      const start = stage === 0 ? path.length : path.length - (720 - 560) / 2;
      const body = Larva.bodyGeometry(path, start, length, stage === 0 ? 62 : 80, local * 2, {});
      Larva.drawLarvaPaper(context, body, local * 2);
    } else {
      const layer = flyCanvas();
      Fly.fly(layer, { x: point(-40, 0)[0], y: point(-40, 0)[1], angle: angle + Math.PI / 2, scale: 0.95, seed: 31, wingSpread: 0, legsFree: [0, 0, 0] });
      const looks = [
        "grayscale(1) brightness(1.45) contrast(0.8)",
        "grayscale(0.6) brightness(1.3) contrast(0.85)",
        "saturate(0.9) brightness(0.95)",
      ];
      context.filter = looks[stage - 2];
      context.drawImage(flyLayer, 0, 0);
      context.filter = "none";
      if (stage === 3) {
        // The eyes colour from the inside out during this beat.
        context.globalCompositeOperation = "multiply";
        [-1, 1].forEach((side) => {
          const [eyeX, eyeY] = [
            point(-40, 0)[0] + (side * 72 * Math.cos(angle + Math.PI / 2) - (-142) * Math.sin(angle + Math.PI / 2)) * 0.95,
            point(-40, 0)[1] + (side * 72 * Math.sin(angle + Math.PI / 2) + (-142) * Math.cos(angle + Math.PI / 2)) * 0.95,
          ];
          context.fillStyle = "rgba(200,40,50,0.75)";
          context.beginPath();
          context.arc(eyeX, eyeY, 50 * easeOut(within), 0, Math.PI * 2);
          context.fill();
        });
        context.globalCompositeOperation = "source-over";
      }
    }
    context.restore();
    trace(context, inner);
    context.strokeStyle = NAVY;
    context.lineWidth = 2;
    context.stroke();
    trace(context, outer);
    context.lineWidth = 3;
    context.stroke();
    context.restore();
    // A flash on each cut.
    const flash = 1 - clamp(within / 0.15);
    if (flash > 0 && local > 0.05) {
      context.fillStyle = `rgba(255,250,235,${0.55 * flash})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
    context.fillStyle = NAVY;
    context.font = '30px Consolas, "Courier New", monospace';
    context.fillText(CUTAWAY_STAGES[stage].label, 70, 110);
    // Stage ticks: five dots, filled up to now.
    for (let dot = 0; dot < 5; dot += 1) {
      context.beginPath();
      context.arc(80 + dot * 26, 140, 7, 0, Math.PI * 2);
      context.fillStyle = dot <= stage ? NAVY : "rgba(29,31,51,0.2)";
      context.fill();
    }
  }
