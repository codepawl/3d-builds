  // Spread points to even spacing, the way daughter nuclei push apart after a division. Distances are measured in
  // screen pixels so the result is even on screen; points stay inside the shell.
  function relax(points, spacingPixels, iterations = 8) {
    const scaleU = HALF_LENGTH;
    const scaleV = HALF_WIDTH;
    let current = points.map((point) => [...point]);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const buckets = new Map();
      current.forEach(([u, v], index) => {
        const key = `${Math.floor((u * scaleU) / spacingPixels)},${Math.floor((v * scaleV) / spacingPixels)}`;
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(index);
      });
      current = current.map(([u, v], index) => {
        const cellX = Math.floor((u * scaleU) / spacingPixels);
        const cellY = Math.floor((v * scaleV) / spacingPixels);
        let pushX = 0;
        let pushY = 0;
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            (buckets.get(`${cellX + offsetX},${cellY + offsetY}`) || []).forEach((other) => {
              if (other === index) {
                return;
              }
              const deltaX = (u - current[other][0]) * scaleU;
              const deltaY = (v - current[other][1]) * scaleV;
              const distance = Math.hypot(deltaX, deltaY) || 0.01;
              if (distance < spacingPixels) {
                const strength = (spacingPixels - distance) / spacingPixels;
                pushX += (deltaX / distance) * strength * spacingPixels * 0.25;
                pushY += (deltaY / distance) * strength * spacingPixels * 0.25;
              }
            });
          }
        }
        let nextU = u + pushX / scaleU;
        let nextV = v + pushY / scaleV;
        if (!insideShell(nextU, nextV)) {
          nextU = u;
          nextV = v;
        }
        return [nextU, nextV];
      });
    }
    return current;
  }
