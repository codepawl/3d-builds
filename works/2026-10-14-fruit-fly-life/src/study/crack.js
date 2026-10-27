  // A crack along the cap's seam that deepens with each nudge.
  function drawCrack(context, strength) {
    const opening = PUPA_HALF_LENGTH * 0.62;
    const crack = [];
    const reach = lerp(0.3, 1, strength);
    for (let step = 0; step <= 16; step += 1) {
      const across = lerp(-PUPA_HALF_WIDTH, PUPA_HALF_WIDTH, step / 16) * reach;
      crack.push(along(opening + (step % 2 ? 6 : -4) * strength, across));
    }
    trace(context, crack, false);
    context.strokeStyle = "#120804";
    context.lineWidth = 1.2 + strength * 2;
    context.stroke();
  }
