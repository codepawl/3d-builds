  // Orange flesh under magnification: juicy, saturated plant cells (50 to 100 µm, the right size at this scale),
  // rounded and translucent, each with a wet highlight; a few juice droplets and a broad sheen across the surface.
  // No rings inside the cells: those read as wood (An, 2026-10-14).
  function fruitFlesh(context) {
    const base = context.createLinearGradient(0, 0, SIZE, SIZE);
    base.addColorStop(0, "#f7a54a");
    base.addColorStop(1, "#e87425");
    context.fillStyle = base;
    context.fillRect(0, 0, SIZE, SIZE);
    for (let row = -1; row < 12; row += 1) {
      for (let column = -1; column < 11; column += 1) {
        const x = column * 104 + (row % 2) * 52 + (hash(row, column, 1) - 0.5) * 30;
        const y = row * 92 + (hash(column, row, 2) - 0.5) * 26;
        const radiusX = 50 + hash(row, column, 3) * 10;
        const radiusY = 44 + hash(row, column, 4) * 10;
        const tilt = hash(row, column, 5) * Math.PI;
        // Rounded blob: an ellipse with a gentle wobble.
        const blob = Array.from({ length: 28 }, (unused, step) => {
          const turn = (step / 28) * Math.PI * 2;
          const wobble = 1 + 0.06 * Math.sin(turn * 3 + row + column);
          const localX = Math.cos(turn) * radiusX * wobble;
          const localY = Math.sin(turn) * radiusY * wobble;
          return [x + localX * Math.cos(tilt) - localY * Math.sin(tilt), y + localX * Math.sin(tilt) + localY * Math.cos(tilt)];
        });
        const fill = context.createRadialGradient(x - radiusX * 0.3, y - radiusY * 0.35, 4, x, y, radiusX * 1.1);
        fill.addColorStop(0, "rgba(255,214,140,0.95)");
        fill.addColorStop(0.6, "rgba(250,160,70,0.9)");
        fill.addColorStop(1, "rgba(222,96,34,0.95)");
        trace(context, blob);
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = "rgba(170,60,20,0.55)";
        context.lineWidth = 1.6;
        context.stroke();
        // Wet highlight: a short bright arc near the top left.
        context.strokeStyle = "rgba(255,250,235,0.85)";
        context.lineWidth = 3;
        context.lineCap = "round";
        context.beginPath();
        context.ellipse(x - radiusX * 0.15, y - radiusY * 0.15, radiusX * 0.6, radiusY * 0.55, tilt, Math.PI * 1.1, Math.PI * 1.45);
        context.stroke();
        context.fillStyle = "rgba(255,255,255,0.8)";
        context.beginPath();
        context.arc(x - radiusX * 0.42, y - radiusY * 0.4, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Juice droplets.
    for (let drop = 0; drop < 9; drop += 1) {
      const x = hash(drop, 31) * SIZE;
      const y = hash(drop, 32) * SIZE;
      const radius = 8 + hash(drop, 33) * 14;
      context.fillStyle = "rgba(255,236,200,0.55)";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(190,80,25,0.6)";
      context.lineWidth = 1.4;
      context.stroke();
      context.fillStyle = "rgba(255,255,255,0.95)";
      context.beginPath();
      context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.25, 0, Math.PI * 2);
      context.fill();
    }
    // A broad sheen across the wet surface.
    const sheen = context.createLinearGradient(0, SIZE * 0.2, SIZE, SIZE * 0.6);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,248,230,0.18)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = sheen;
    context.fillRect(0, 0, SIZE, SIZE);
  }
