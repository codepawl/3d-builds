  // A wing: a long oval from the shoulder down the side of the abdomen, milky like a soap film, with soft rainbow
  // contours and faint veins. Local units are pixels on Kevin's 1080 frame (thorax 210 x 225).
  function wingOutline(side) {
    return ellipse(side * 105, 250, 82, 215, -side * 0.2, 60);
  }

  function wing(context, place, side, seed) {
    const outline = wingOutline(side);
    const placed = place(outline);
    context.save();
    tracePath(context, placed);
    // Milky film: whiter toward the edge, almost clear in the middle.
    const [centerX, centerY] = place([[side * 105, 250]])[0];
    const film = context.createRadialGradient(centerX, centerY, 20, centerX, centerY, 230);
    film.addColorStop(0, "rgba(250,248,240,0.10)");
    film.addColorStop(1, "rgba(250,248,240,0.38)");
    context.fillStyle = film;
    context.fill();
    context.clip();
    // Thin-film colours: soft nested loops, blurred a little so they glow instead of reading as wire.
    context.filter = "blur(1.2px)";
    ["#e45ac8", "#f5e25a", "#55d8d0", "#92e266", "#e45ac8", "#55d8d0"].forEach((color, layer) => {
      const shrink = 0.86 - layer * 0.12;
      const loop = outline.map(([pointX, pointY], index) => {
        const wobble = Math.sin(index * 0.35 + layer * 1.7 + seed) * 10 + Math.sin(index * 0.9 + layer) * 4;
        return [side * 105 + (pointX - side * 105) * shrink + wobble, 250 + (pointY - 250) * shrink * 0.92 + wobble * 0.8 - layer * 6];
      });
      tracePath(context, place(loop));
      context.strokeStyle = color;
      context.globalAlpha = 0.55;
      context.lineWidth = 2.2;
      context.stroke();
    });
    context.filter = "none";
    context.globalAlpha = 1;
    // Veins from the shoulder fanning toward the tip.
    context.strokeStyle = "rgba(60,45,35,0.55)";
    context.lineWidth = 1.2;
    [0.15, 0.4, 0.62, 0.82].forEach((spread) => {
      const vein = [[side * 40, 50], [side * (60 + 70 * spread), 240], [side * (70 + 95 * spread), 440]].map((point) => rotatePoint(point, -side * 0.06));
      tracePath(context, place(vein), false);
      context.stroke();
    });
    context.restore();
    tracePath(context, placed);
    context.strokeStyle = "rgba(45,40,45,0.75)";
    context.lineWidth = 1.8;
    context.stroke();
  }

  // Darken the far side of a shape with a soft gradient and a few hatch strokes, for form and contrast.
  function shadeForm(context, placedOutline, from, to, strength) {
    context.save();
    tracePath(context, placedOutline);
    context.clip();
    const gradient = context.createLinearGradient(from[0], from[1], to[0], to[1]);
    gradient.addColorStop(0, "rgba(40,18,6,0)");
    gradient.addColorStop(1, `rgba(40,18,6,${strength})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1080);
    context.restore();
  }

  function boxOf(points) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  function fly(context, { x, y, angle, scale = 1, seed = 1 }) {
    const place = (points) => points.map((point) => {
      const [rotatedX, rotatedY] = rotatePoint([point[0] * scale, point[1] * scale], angle);
      return [x + rotatedX, y + rotatedY];
    });
    const along = angle + Math.PI / 2;

    // A soft cast shadow on the orange, down and to the right of the body.
    context.save();
    context.filter = "blur(18px)";
    context.fillStyle = "rgba(90,25,10,0.28)";
    tracePath(context, place(ellipse(40, 230, 170, 330, 0, 40)).map(([px, py]) => [px + 30, py + 26]));
    context.fill();
    context.restore();

    // Legs: front pair reaching past the head, middle pair out to the sides, hind pair back.
    [-1, 1].forEach((side) => {
      leg(context, [[side * 60, -60], [side * 120, -150], [side * 160, -270], [side * 170, -330]], place);
      leg(context, [[side * 85, 20], [side * 190, -10], [side * 300, 5], [side * 350, -5]], place);
      leg(context, [[side * 70, 90], [side * 170, 170], [side * 230, 300], [side * 250, 360]], place);
    });

    // Abdomen: 225 x 350, banded, hatched, darker on the side away from the light.
    const abdomen = [];
    for (let index = 0; index <= 48; index += 1) {
      const turn = (index / 48) * Math.PI * 2;
      const lower = Math.sin(turn) > 0;
      const pinch = lower ? 1 - 0.45 * Math.sin(turn) ** 3 : 1;
      abdomen.push([Math.cos(turn) * 112 * pinch, 285 + Math.sin(turn) * (lower ? 185 : 165)]);
    }
    const abdomenPlaced = place(abdomen);
    context.save();
    tracePath(context, abdomenPlaced);
    context.fillStyle = "#c98d4e";
    context.fill();
    context.clip();
    for (let band = 0; band < 6; band += 1) {
      const top = 165 + band * 52;
      const bandPoints = [];
      for (let step = 0; step <= 20; step += 1) {
        const across = -130 + step * 13;
        bandPoints.push([across, top + 16 - (across / 130) ** 2 * 18]);
      }
      for (let step = 20; step >= 0; step -= 1) {
        const across = -130 + step * 13;
        bandPoints.push([across, top + 42 - (across / 130) ** 2 * 18]);
      }
      tracePath(context, place(bandPoints));
      context.fillStyle = "#4a2414";
      context.fill();
    }
    const abdomenBox = boxOf(abdomenPlaced);
    strokeField(context, abdomenBox, { count: 5200, color: "#2e1508", width: 1, length: [5, 12], angleAt: () => along + 0.15, seed: seed + 3, alpha: 0.45 });
    strokeField(context, abdomenBox, { count: 1600, color: "#f0c890", width: 1, length: [4, 9], angleAt: () => along, seed: seed + 4, alpha: 0.3 });
    context.restore();
    shadeForm(context, abdomenPlaced, place([[-110, 200]])[0], place([[120, 380]])[0], 0.55);
    tracePath(context, abdomenPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();

    // Thorax: 210 x 225, fur along the body, a darker lower half, then the scutellum.
    const thoraxPlaced = place(ellipse(0, 0, 105, 112, 0, 56));
    const [thoraxX, thoraxY] = place([[0, 0]])[0];
    context.save();
    tracePath(context, thoraxPlaced);
    const body = context.createRadialGradient(thoraxX - 35, thoraxY - 45, 10, thoraxX, thoraxY, 140);
    body.addColorStop(0, "#dcab6c");
    body.addColorStop(1, "#a06a36");
    context.fillStyle = body;
    context.fill();
    context.clip();
    const thoraxBox = boxOf(thoraxPlaced);
    strokeField(context, thoraxBox, { count: 4200, color: "#5a3a1c", width: 1, length: [5, 11], angleAt: (px) => along + (px - thoraxX) / 280, density: (px, py) => 0.35 + 0.65 * clamp((py - thoraxY + 100) / 200), seed: seed + 5, alpha: 0.5 });
    strokeField(context, thoraxBox, { count: 2000, color: "#f2d29a", width: 1, length: [4, 9], angleAt: (px) => along + (px - thoraxX) / 280, density: (px, py) => clamp(1 - (py - thoraxY + 60) / 160), seed: seed + 6, alpha: 0.4 });
    context.restore();
    shadeForm(context, thoraxPlaced, place([[-60, -60]])[0], place([[70, 110]])[0], 0.6);
    tracePath(context, thoraxPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    const scutellum = place(ellipse(0, 100, 52, 28, 0, 32));
    tracePath(context, scutellum);
    context.fillStyle = "rgba(118,58,24,0.9)";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 2.2;
    context.stroke();

    // Wings on top of the abdomen.
    [-1, 1].forEach((side) => wing(context, place, side, seed + side));

    // Head (about 140 wide), ocelli, short feathered antennae, then eyes of about 95 x 110.
    const headPlaced = place(ellipse(0, -140, 72, 52, 0, 40));
    tracePath(context, headPlaced);
    context.fillStyle = "#cc955b";
    context.fill();
    shadeForm(context, headPlaced, place([[-40, -170]])[0], place([[40, -100]])[0], 0.4);
    tracePath(context, headPlaced);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    context.fillStyle = "#a8282e";
    [[0, -160], [-11, -146], [11, -146]].forEach(([dotX, dotY]) => {
      const [px, py] = place([[dotX, dotY]])[0];
      context.beginPath();
      context.arc(px, py, 3.5, 0, Math.PI * 2);
      context.fill();
    });
    [-1, 1].forEach((side) => {
      const knob = place(ellipse(side * 24, -188, 13, 17, 0, 20));
      tracePath(context, knob);
      context.fillStyle = "#c08550";
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 1.8;
      context.stroke();
      const [fromX, fromY] = place([[side * 26, -200]])[0];
      const [toX, toY] = place([[side * 70, -245]])[0];
      const featherAngle = Math.atan2(toY - fromY, toX - fromX);
      context.strokeStyle = "#3b2a1c";
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      for (let step = 8; step < Math.hypot(toX - fromX, toY - fromY); step += 6) {
        const px = fromX + Math.cos(featherAngle) * step;
        const py = fromY + Math.sin(featherAngle) * step;
        [-0.9, 0.9].forEach((spread) => {
          context.moveTo(px, py);
          context.lineTo(px + Math.cos(featherAngle + spread) * 7, py + Math.sin(featherAngle + spread) * 7);
        });
      }
      context.stroke();
      const [eyeX, eyeY] = place([[side * 78, -150]])[0];
      compoundEye(context, eyeX, eyeY, 48 * scale, 55 * scale, angle + side * 0.3, seed + side);
    });
    // A few long bristles on the thorax.
    context.strokeStyle = "#2a1a10";
    context.lineWidth = 1.5;
    [[-55, -55, -95, -120], [55, -55, 95, -120], [-75, 30, -130, 0], [75, 30, 130, 0]].forEach(([fromX, fromY, toX, toY]) => {
      tracePath(context, place([[fromX, fromY], [toX, toY]]), false);
      context.stroke();
    });
  }

