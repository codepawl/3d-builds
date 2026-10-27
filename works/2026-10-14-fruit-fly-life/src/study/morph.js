  // ---------- cartoon helpers ----------

  // A damped spring set off by each hit: positive squashes along the body, then it rings out.
  const HITS = [[3.3, 1.0], [5.3, 0.3], [5.48, 0.6], [5.65, 1.0], [5.82, 1.5]];
  function springAfterHits(time) {
    return HITS.reduce((sum, [start, strength]) => {
      const since = time - start;
      return since > 0 ? sum + strength * Math.exp(-since * 9) * Math.sin(since * 35) : sum;
    }, 0);
  }

  // Scale along the body axis and across it, about a point: squash and stretch.
  function squashStretch(context, [pivotX, pivotY], heading, along, across) {
    context.translate(pivotX, pivotY);
    context.rotate(heading);
    context.scale(along, across);
    context.rotate(-heading);
    context.translate(-pivotX, -pivotY);
  }

  // Resample a closed outline to `count` points by arc length, starting at the point furthest toward the head and
  // running in a fixed direction, so two outlines can be blended point by point.
  function resample(outline, count) {
    let area = 0;
    outline.forEach(([x, y], index) => {
      const [nextX, nextY] = outline[(index + 1) % outline.length];
      area += x * nextY - nextX * y;
    });
    const ordered = area < 0 ? outline.slice().reverse() : outline.slice();
    let start = 0;
    ordered.forEach((point, index) => {
      if (lengthwiseOf(point) > lengthwiseOf(ordered[start])) {
        start = index;
      }
    });
    const ring = [...ordered.slice(start), ...ordered.slice(0, start)];
    const lengths = [0];
    for (let index = 1; index <= ring.length; index += 1) {
      const [fromX, fromY] = ring[index - 1];
      const [toX, toY] = ring[index % ring.length];
      lengths.push(lengths[index - 1] + Math.hypot(toX - fromX, toY - fromY));
    }
    const total = lengths[lengths.length - 1];
    const result = [];
    let segment = 1;
    for (let step = 0; step < count; step += 1) {
      const target = (step / count) * total;
      while (lengths[segment] < target) {
        segment += 1;
      }
      const amount = (target - lengths[segment - 1]) / Math.max(1e-6, lengths[segment] - lengths[segment - 1]);
      const [fromX, fromY] = ring[segment - 1];
      const [toX, toY] = ring[segment % ring.length];
      result.push([lerp(fromX, toX, amount), lerp(fromY, toY, amount)]);
    }
    return result;
  }

  // The larva turning into the puparium on screen: its outline flows into the capsule (with an overshoot), the skin
  // goes from white to the case's tan, the segment grooves stay, hatching comes in on the shadow side.
  function drawMorph(context, time, amount) {
    const count = 120;
    const larva = resample(larvaBody(time).outline, count);
    const pupa = resample(pupaOutline(), count);
    const shape = larva.map(([x, y], index) => [lerp(x, pupa[index][0], amount), lerp(y, pupa[index][1], amount)]);
    const mix = clamp(amount);
    const white = [244, 237, 221];
    const target = caseColor(time).match(/\d+/g).map(Number);
    const color = white.map((channel, index) => Math.round(lerp(channel, target[index], mix)));
    trace(context, shape);
    context.fillStyle = `rgb(${color.join(",")})`;
    context.fill();
    hatchStrip(context, shape, { fromAcross: PUPA_HALF_WIDTH * 0.1, toAcross: PUPA_HALF_WIDTH * 1.1, spacing: 4, alpha: 0.35 * mix });
    context.strokeStyle = "rgba(35,15,5,0.6)";
    context.lineWidth = 1.6;
    for (let groove = 1; groove <= 10; groove += 1) {
      const index = Math.round((groove / 11) * (count / 2));
      const [leftX, leftY] = shape[index];
      const [rightX, rightY] = shape[count - index];
      const [middleX, middleY] = [(leftX + rightX) / 2 - DIRECTION[0] * 10, (leftY + rightY) / 2 - DIRECTION[1] * 10];
      context.beginPath();
      context.moveTo(leftX, leftY);
      context.quadraticCurveTo(middleX, middleY, rightX, rightY);
      context.stroke();
    }
    trace(context, shape);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
  }
