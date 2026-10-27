  // A leg in real segments: coxa, femur, tibia, five tarsomeres and a pair of claws. `joints` gives the hip, the
  // knee, the ankle and the tip in the fly's frame; each segment is a tapered tube with an outline, a shaded side,
  // a visible joint and bristles.
  function leg(context, joints, place) {
    const [hip, knee, ankle, tip] = place(joints);
    const coxaEnd = [lerp(hip[0], knee[0], 0.18), lerp(hip[1], knee[1], 0.18)];
    const segments = [
      { from: hip, to: coxaEnd, startWidth: 13, endWidth: 11, bristles: 0 },
      { from: coxaEnd, to: knee, startWidth: 10, endWidth: 8, bristles: 9 },
      { from: knee, to: ankle, startWidth: 7.5, endWidth: 6, bristles: 8 },
    ];
    for (let index = 0; index < 5; index += 1) {
      const startAmount = index / 5;
      const endAmount = (index + 1) / 5;
      segments.push({
        from: [lerp(ankle[0], tip[0], startAmount), lerp(ankle[1], tip[1], startAmount)],
        to: [lerp(ankle[0], tip[0], endAmount), lerp(ankle[1], tip[1], endAmount)],
        startWidth: lerp(5, 3.4, startAmount),
        endWidth: lerp(4.4, 3, endAmount),
        bristles: 0,
      });
    }
    segments.forEach((segment, index) => legSegment(context, segment, index));
    // Claws: two small hooks at the tip.
    const tipAngle = Math.atan2(tip[1] - ankle[1], tip[0] - ankle[0]);
    context.strokeStyle = "#2a1a10";
    context.lineWidth = 1.6;
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.moveTo(tip[0], tip[1]);
      context.quadraticCurveTo(
        tip[0] + Math.cos(tipAngle + side * 0.5) * 9, tip[1] + Math.sin(tipAngle + side * 0.5) * 9,
        tip[0] + Math.cos(tipAngle + side * 1.3) * 11, tip[1] + Math.sin(tipAngle + side * 1.3) * 11,
      );
      context.stroke();
    });
  }

  function legSegment(context, { from, to, startWidth, endWidth, bristles }, index) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // A tube that swells a little in the middle, the way a femur does.
    const left = [];
    const right = [];
    for (let step = 0; step <= 10; step += 1) {
      const amount = step / 10;
      const half = (lerp(startWidth, endWidth, amount) / 2) * (1 + 0.18 * Math.sin(amount * Math.PI));
      const x = lerp(from[0], to[0], amount);
      const y = lerp(from[1], to[1], amount);
      left.push([x + normalX * half, y + normalY * half]);
      right.push([x - normalX * half, y - normalY * half]);
    }
    const outline = [...left, ...right.reverse()];
    tracePath(context, outline);
    context.fillStyle = index % 2 ? "#7a5634" : "#6a4a2c";
    context.fill();
    // Shade the lower side with strokes along the segment.
    context.save();
    tracePath(context, outline);
    context.clip();
    context.strokeStyle = "rgba(30,15,6,0.65)";
    context.lineWidth = 0.9;
    context.beginPath();
    for (let line = 0; line < Math.max(2, length / 5); line += 1) {
      const amount = (line + 0.5) / Math.max(2, length / 5);
      const half = lerp(startWidth, endWidth, amount) / 2;
      const x = lerp(from[0], to[0], amount) - normalX * half * 0.35;
      const y = lerp(from[1], to[1], amount) - normalY * half * 0.35;
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * 6 - normalX * half * 0.6, y + Math.sin(angle) * 6 - normalY * half * 0.6);
    }
    context.stroke();
    context.restore();
    tracePath(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 1.3;
    context.stroke();
    // The joint at the far end: a small darker ring.
    context.fillStyle = "#2e1c10";
    context.beginPath();
    context.ellipse(to[0], to[1], endWidth * 0.55, endWidth * 0.45, angle, 0, Math.PI * 2);
    context.fill();
    // Bristles on the outer side, leaning toward the tip.
    if (bristles > 0) {
      context.strokeStyle = "#2a1a10";
      context.lineWidth = 1;
      context.beginPath();
      for (let bristle = 0; bristle < bristles; bristle += 1) {
        const amount = (bristle + 0.5) / bristles;
        const half = lerp(startWidth, endWidth, amount) / 2;
        const x = lerp(from[0], to[0], amount) + normalX * half;
        const y = lerp(from[1], to[1], amount) + normalY * half;
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle + 0.9) * 7, y + Math.sin(angle + 0.9) * 7);
      }
      context.stroke();
    }
  }
