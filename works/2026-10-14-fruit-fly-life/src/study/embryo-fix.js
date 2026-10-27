  // Dorsal appendages: two tubes from the dorsal surface near the front, spreading in a V ahead of the egg and
  // flaring into broad flat paddles (SEM of the eggshell, Yakoby lab). Length about 0.4 of the egg.
  function dorsalAppendages(context) {
    const forward = AXIS + Math.PI;
    [-1, 1].forEach((side) => {
      const [rootX, rootY] = toScreen(-0.72, -0.62 + side * 0.18);
      const direction = forward + side * 0.22 - 0.18;
      const length = 300;
      const [bendX, bendY] = [rootX + Math.cos(direction - side * 0.08) * length * 0.5, rootY + Math.sin(direction - side * 0.08) * length * 0.5];
      const [tipX, tipY] = [rootX + Math.cos(direction) * length, rootY + Math.sin(direction) * length];
      context.strokeStyle = COLORS.line;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(rootX, rootY);
      context.quadraticCurveTo(bendX, bendY, tipX, tipY);
      context.stroke();
      // The paddle: a long flattened blade along the last third of the tube.
      const paddleStart = 0.62;
      const [startX, startY] = [rootX + Math.cos(direction) * length * paddleStart, rootY + Math.sin(direction) * length * paddleStart];
      const normal = direction + Math.PI / 2;
      const blade = [];
      for (let step = 0; step <= 12; step += 1) {
        const amount = step / 12;
        const along = lerp(0, length * (1 - paddleStart) + 30, amount);
        const width = Math.sin(amount * Math.PI) ** 0.6 * 30;
        blade.push([startX + Math.cos(direction) * along + Math.cos(normal) * width, startY + Math.sin(direction) * along + Math.sin(normal) * width]);
      }
      for (let step = 12; step >= 0; step -= 1) {
        const amount = step / 12;
        const along = lerp(0, length * (1 - paddleStart) + 30, amount);
        const width = Math.sin(amount * Math.PI) ** 0.6 * 12;
        blade.push([startX + Math.cos(direction) * along - Math.cos(normal) * width, startY + Math.sin(direction) * along - Math.sin(normal) * width]);
      }
      trace(context, blade);
      context.fillStyle = "rgba(169,214,232,0.18)";
      context.fill();
      context.lineWidth = 2;
      context.stroke();
    });
    // Micropyle: a small nipple at the very front; operculum: a cap line around the front; dorsal ridge along the back.
    const [noseX, noseY] = toScreen(-1.03, 0);
    context.beginPath();
    context.arc(noseX, noseY, 7, 0, Math.PI * 2);
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = COLORS.faint;
    context.lineWidth = 1.5;
    trace(context, [toScreen(-0.86, shellV(-0.86, true)), toScreen(-0.9, 0), toScreen(-0.86, shellV(-0.86, false))], false);
    context.stroke();
    trace(context, Array.from({ length: 20 }, (unused, index) => toScreen(-0.8 + index * 0.08, shellV(-0.8 + index * 0.08, true) * 0.7)), false);
    context.stroke();
  }

  // Cycle 14 seen on the surface: a sheet of cells over the whole egg, the field the stripes are read from.
  function cellField() {
    const cells = [];
    for (let row = -16; row <= 16; row += 1) {
      for (let column = -46; column <= 46; column += 1) {
        const u = column * 0.021 + (row % 2) * 0.0105;
        const v = row * 0.058;
        const limit = shellV(u, v < 0) * 0.94;
        if (Math.abs(u) < 0.96 && Math.abs(v) < Math.abs(limit)) {
          cells.push([u, v]);
        }
      }
    }
    return cells;
  }

  // Stripes made of the cells themselves, gently curved with the egg: 7 eve stripes about as wide as their gaps,
  // then 14 one-cell engrailed stripes, all in the trunk (Wikipedia "Pair rule" figure, fluorescence images).
  function stripes(context, time) {
    const sheet = progress(time, 3.0, 3.4);
    if (sheet <= 0) {
      return;
    }
    const eve = progress(time, 3.4, 4.2);
    const en = progress(time, 4.2, 5.0);
    cellField().forEach(([u, v], index) => {
      const bent = u + 0.035 * v * v;
      let color = null;
      let strength = 0;
      for (let stripe = 0; stripe < 7; stripe += 1) {
        const center = -0.4 + stripe * 0.16;
        if (Math.abs(bent - center) < 0.042) {
          color = COLORS.eve;
          strength = clamp(eve * 7 - stripe * 0.6);
        }
      }
      for (let stripe = 0; stripe < 14; stripe += 1) {
        const center = -0.44 + stripe * 0.08;
        if (Math.abs(bent - center) < 0.011 && en > 0) {
          const appears = clamp(en * 14 - stripe * 0.6);
          if (appears > 0) {
            color = COLORS.en;
            strength = appears;
          }
        }
      }
      const [x, y] = toScreen(u, v);
      context.globalAlpha = sheet * 0.55;
      context.fillStyle = COLORS.glow;
      context.beginPath();
      context.arc(x, y, 2.2, 0, Math.PI * 2);
      context.fill();
      if (color && strength > 0) {
        context.globalAlpha = strength * (0.75 + hash(index, 9) * 0.25);
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, 4.6, 0, Math.PI * 2);
        context.fill();
      }
    });
    context.globalAlpha = 1;
    label(context, "eve", 860, 160, { color: COLORS.eve, size: 26, alpha: eve });
    label(context, "en", 940, 160, { color: COLORS.en, size: 26, alpha: en });
  }
