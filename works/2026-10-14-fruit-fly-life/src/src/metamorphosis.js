// Beat 4, 8 s: the larva eats and grows (one molt), turns into a puparium that browns, the fly shows through the case,
// the cap pops, a pale fly with crumpled wings climbs out, and its wings unfold. Built from
// anatomy/fruit-fly-metamorphosis.md. Scale: 1 mm = 140 px.
"use strict";

const Metamorphosis = (() => {
  const { hash, lerp, clamp, progress, easeOut, easeInOut, easeIn } = Ink;
  const SIZE = 1080;
  const DURATION = 10;
  const NAVY = "#1d1f33";
  const PIXELS_PER_MM = 140;
  const CENTER = [700, 830];
  // The same heading as the fly in the opening frame, so the closing push needs no turn.
  const HEAD_DIRECTION = -0.41 - Math.PI / 2;
  const DIRECTION = [Math.cos(HEAD_DIRECTION), Math.sin(HEAD_DIRECTION)];
  const PUPA_HALF_LENGTH = 1.5 * PIXELS_PER_MM;
  const PUPA_HALF_WIDTH = 0.55 * PIXELS_PER_MM;
  const FLY_SCALE = PIXELS_PER_MM / 240;

  const along = (distance, across = 0) => [
    CENTER[0] + DIRECTION[0] * distance - DIRECTION[1] * across,
    CENTER[1] + DIRECTION[1] * distance + DIRECTION[0] * across,
  ];

  function trace(context, points, closed = true) {
    context.beginPath();
    points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    if (closed) {
      context.closePath();
    }
  }

  // ---------- larva ----------

  const PATH = Larva.smoothPath([along(-700), along(-200), along(200), along(420)]);
  const PATH_HEAD_AT_CENTER = 700;

  function larvaLength(time) {
    // Grows from about 1 mm to 4 mm, with a step at the molt; then the prepupa shortens to the case length.
    const growth = easeOut(progress(time, 0, 1.25)) * 0.45 + easeOut(progress(time, 1.35, 2.5)) * 0.55;
    const shorten = easeInOut(progress(time, 2.6, 2.95));
    const reach = Math.sin(Math.PI * progress(time, 2.7, 2.95)) * 0.6;
    return (lerp(lerp(1.0, 4.0, growth), 3.0, shorten) + reach) * PIXELS_PER_MM;
  }

  function larvaBody(time) {
    const length = larvaLength(time);
    // Feeding: the head rakes forward and back at the yeast; the prepupa sits with its head at the case's head end.
    const beatPhase = (time / Ink.BEAT) % 1;
    const rake = time < 2.5 ? (beatPhase < 0.25 ? easeOut(beatPhase / 0.25) : 1 - easeInOut((beatPhase - 0.25) / 0.75)) * 34 : 0;
    const headDistance = PATH_HEAD_AT_CENTER + PUPA_HALF_LENGTH * lerp(1.15, 1, progress(time, 2.4, 3.0)) + rake;
    const swing = time < 2.6 ? Math.sin(time * 5) * 0.2 : 0;
    return Larva.bodyGeometry(PATH, headDistance, length, length / 11, time, { crawling: time < 2.6, swing });
  }

  function moltedSkin(context, time) {
    const shed = progress(time, 1.25, 1.45);
    if (shed <= 0) {
      return;
    }
    // The old skin stays where the smaller larva lay, collapsed and translucent.
    const old = Larva.bodyGeometry(PATH, PATH_HEAD_AT_CENTER + PUPA_HALF_LENGTH * 1.15 - 30, larvaLength(1.2), larvaLength(1.2) / 14, 0);
    const offset = [80, 120];
    const points = old.outline.map(([x, y], index) => [x + offset[0] + Math.sin(index * 1.3) * 3, y + offset[1] + Math.cos(index * 1.7) * 3]);
    context.save();
    context.globalAlpha = 0.7 * shed * (1 - progress(time, 2.9, 3.3));
    trace(context, points);
    context.fillStyle = "rgba(250,246,234,0.55)";
    context.fill();
    context.strokeStyle = "rgba(60,50,40,0.6)";
    context.lineWidth = 1.4;
    context.stroke();
    context.restore();
  }

  // ---------- puparium ----------

  function pupaOutline(squeeze = 1) {
    const points = [];
    const radius = PUPA_HALF_WIDTH * squeeze;
    const straight = PUPA_HALF_LENGTH - PUPA_HALF_WIDTH;
    for (let step = 0; step <= 24; step += 1) {
      const turn = -Math.PI / 2 + (step / 24) * Math.PI;
      points.push(along(straight + Math.cos(turn) * radius, Math.sin(turn) * radius));
    }
    for (let step = 0; step <= 24; step += 1) {
      const turn = Math.PI / 2 + (step / 24) * Math.PI;
      points.push(along(-straight + Math.cos(turn) * radius * 0.92, Math.sin(turn) * radius * 0.92));
    }
    return points;
  }

  function drawImpact(context, impact) {
    if (impact <= 0.02) {
      return;
    }
    const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.9);
    context.strokeStyle = NAVY;
    context.lineCap = "round";
    context.lineWidth = 1.6 + impact * 1.4;
    context.beginPath();
    for (let ray = 0; ray < 14; ray += 1) {
      const angle = HEAD_DIRECTION + (ray / 13 - 0.5) * 3.0 + (hash(ray, 7) - 0.5) * 0.2;
      const inner = PUPA_HALF_WIDTH * 1.05 + hash(ray, 8) * 12;
      const outer = inner + 14 + impact * (30 + hash(ray, 9) * 30);
      context.moveTo(tipX + Math.cos(angle) * inner, tipY + Math.sin(angle) * inner);
      context.lineTo(tipX + Math.cos(angle) * outer, tipY + Math.sin(angle) * outer);
    }
    context.stroke();
  }

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

  function drawOpening(context, time, capOpen, outline) {
    const opening = PUPA_HALF_LENGTH * 0.62;
    const cap = outline.filter((point) => lengthwiseOf(point) > opening);
    const rim = [];
    for (let step = 0; step <= 16; step += 1) {
      const across = lerp(-PUPA_HALF_WIDTH, PUPA_HALF_WIDTH, step / 16);
      rim.push(along(opening + (step % 2 ? 7 : -5), across));
    }
    const hollow = [...rim, ...cap.slice().reverse()];
    trace(context, hollow);
    context.fillStyle = "#1a0c05";
    context.fill();
    trace(context, rim, false);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    const [hingeX, hingeY] = along(opening, -PUPA_HALF_WIDTH);
    const turn = -1.5 * Math.min(1.15, capOpen);
    const swing = (points) => points.map(([x, y]) => [hingeX + (x - hingeX) * Math.cos(turn) - (y - hingeY) * Math.sin(turn), hingeY + (x - hingeX) * Math.sin(turn) + (y - hingeY) * Math.cos(turn)]);
    const capShape = [...rim.slice().reverse(), ...cap];
    const outer = swing(capShape);
    trace(context, outer);
    context.fillStyle = caseColor(time);
    context.fill();
    // The inner lining shows as a cream band inside the rim.
    const lining = swing(capShape.map((point) => {
      const [x, y] = point;
      const [centerX, centerY] = along(PUPA_HALF_LENGTH * 0.82);
      return [lerp(x, centerX, 0.25), lerp(y, centerY, 0.25)];
    }));
    trace(context, lining);
    context.fillStyle = "#efe2c4";
    context.fill();
    context.strokeStyle = "rgba(60,30,10,0.7)";
    context.lineWidth = 1.4;
    context.stroke();
    trace(context, outer);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
  }

  function drawDebris(context, time) {
    const since = time - 5.82;
    if (since <= 0 || since > 0.9) {
      return;
    }
    const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.95);
    context.fillStyle = "#1a0c05";
    for (let piece = 0; piece < 22; piece += 1) {
      const angle = HEAD_DIRECTION + (hash(piece, 2) - 0.5) * 3.2;
      const speed = 160 + hash(piece, 3) * 260;
      const x = tipX + Math.cos(angle) * speed * since;
      const y = tipY + Math.sin(angle) * speed * since + 260 * since * since;
      const size = 1.5 + hash(piece, 4) * 4 * (1 - since);
      context.globalAlpha = 1 - progress(since, 0.6, 0.9);
      context.beginPath();
      if (piece % 3 === 0) {
        // A teardrop fleck pointing along its flight.
        const heading = Math.atan2(Math.sin(angle) * speed + 520 * since, Math.cos(angle) * speed);
        context.ellipse(x, y, size * 2.2, size, heading, 0, Math.PI * 2);
      } else {
        context.arc(x, y, size, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function caseColor(time) {
    const tan = progress(time, 3.0, 3.6);
    const brown = progress(time, 3.6, 4.2);
    const mix = (from, to, amount) => from.map((channel, index) => Math.round(lerp(channel, to[index], amount)));
    const color = mix(mix([244, 237, 221], [226, 190, 130], tan), [122, 64, 30], brown);
    return `rgb(${color.join(",")})`;
  }

  function lengthwiseOf([x, y]) {
    return (x - CENTER[0]) * DIRECTION[0] + (y - CENTER[1]) * DIRECTION[1];
  }

  function hatchStrip(context, outline, { fromAcross, toAcross, spacing, alpha, color = "#1c0c04", tilt = 0.25, width = 1.1 }) {
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.beginPath();
    for (let distance = -PUPA_HALF_LENGTH - 40; distance <= PUPA_HALF_LENGTH + 40; distance += spacing) {
      const jitter = (hash(distance, 3) - 0.5) * spacing * 0.5;
      const [startX, startY] = along(distance + jitter, fromAcross);
      const [endX, endY] = along(distance + jitter + (toAcross - fromAcross) * tilt, toAcross);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    }
    context.stroke();
    context.restore();
  }

  function drawPupa(context, time, { seeThrough = 0, capOpen = 0, impact = 0 }) {
    const outline = pupaOutline();
    // Long hatched cast shadow on the fruit, to the right of the case.
    context.save();
    context.strokeStyle = "rgba(70,25,8,0.45)";
    context.lineWidth = 1.2;
    context.beginPath();
    for (let distance = -PUPA_HALF_LENGTH; distance <= PUPA_HALF_LENGTH * 0.9; distance += 6) {
      const [startX, startY] = along(distance, PUPA_HALF_WIDTH * 0.9);
      const [endX, endY] = along(distance - 30, PUPA_HALF_WIDTH * 1.7 + hash(distance, 1) * 30);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    }
    context.stroke();
    context.restore();
    // Two tones: the lit face and a near-black shadow face along one side.
    trace(context, outline);
    context.fillStyle = caseColor(time);
    context.globalAlpha = 1 - 0.55 * seeThrough;
    context.fill();
    context.globalAlpha = 1;
    const brown = progress(time, 3.6, 4.2);
    context.save();
    trace(context, outline);
    context.clip();
    const shadowFace = [along(-PUPA_HALF_LENGTH - 20, PUPA_HALF_WIDTH * 0.35), along(PUPA_HALF_LENGTH + 20, PUPA_HALF_WIDTH * 0.35), along(PUPA_HALF_LENGTH + 20, PUPA_HALF_WIDTH * 1.2), along(-PUPA_HALF_LENGTH - 20, PUPA_HALF_WIDTH * 1.2)];
    trace(context, shadowFace);
    context.fillStyle = `rgba(40,16,6,${0.25 + 0.5 * brown})`;
    context.fill();
    context.restore();
    hatchStrip(context, outline, { fromAcross: PUPA_HALF_WIDTH * 0.1, toAcross: PUPA_HALF_WIDTH * 1.1, spacing: 3.5, alpha: 0.35 + 0.3 * brown });
    hatchStrip(context, outline, { fromAcross: -PUPA_HALF_WIDTH, toAcross: PUPA_HALF_WIDTH * 0.2, spacing: 9, alpha: 0.18, tilt: 0.05, color: "#5a2a10", width: 0.9 });
    // Curved segment bands.
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = "rgba(35,15,5,0.7)";
    context.lineWidth = 1.8;
    for (let segment = -5; segment <= 4; segment += 1) {
      const distance = segment * PUPA_HALF_LENGTH * 0.18;
      const [startX, startY] = along(distance, -PUPA_HALF_WIDTH);
      const [middleX, middleY] = along(distance - 14, 0);
      const [endX, endY] = along(distance, PUPA_HALF_WIDTH);
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(middleX, middleY, endX, endY);
      context.stroke();
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = NAVY;
    context.lineWidth = 3;
    context.stroke();
    // Construction lines: the axis and an offset outline.
    context.strokeStyle = "rgba(70,90,200,0.55)";
    context.lineWidth = 1.2;
    trace(context, [along(-PUPA_HALF_LENGTH * 1.4, 0), along(PUPA_HALF_LENGTH * 1.5, 0)], false);
    context.stroke();
    trace(context, pupaOutline(1.18).map(([x, y]) => [x - 6, y - 8]));
    context.stroke();
    // Anterior spiracles: stalks with fanned tips.
    const horns = progress(time, 3.1, 3.6);
    if (horns > 0 && capOpen < 0.5) {
      [-1, 1].forEach((side) => {
        const [baseX, baseY] = along(PUPA_HALF_LENGTH * 0.88, side * PUPA_HALF_WIDTH * 0.45);
        // Short stubs (about 0.1 mm) with finger-like tips: the anterior spiracles, not antennae.
        const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.88 + 16 * horns, side * PUPA_HALF_WIDTH * (0.45 + 0.12 * horns));
        context.strokeStyle = "#4a3020";
        context.lineWidth = 5;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(baseX, baseY);
        context.lineTo(tipX, tipY);
        context.stroke();
        const angle = Math.atan2(tipY - baseY, tipX - baseX);
        context.lineWidth = 1.8;
        context.beginPath();
        for (let ray = -3; ray <= 3; ray += 1) {
          context.moveTo(tipX, tipY);
          context.lineTo(tipX + Math.cos(angle + ray * 0.32) * 6 * horns, tipY + Math.sin(angle + ray * 0.32) * 6 * horns);
        }
        context.stroke();
      });
    }
    drawImpact(context, impact);
    // The nudges only crack the case along the cap's seam; the cap opens on the real pop.
    if (time < 5.82 && capOpen > 0) {
      drawCrack(context, Math.min(1, capOpen / 0.38));
    } else if (time >= 5.82) {
      drawOpening(context, time, capOpen, outline);
    }
  }

  // ---------- eclosion motion ----------

  function easeOutBackAmount(value) {
    const overshoot = 1.9;
    return value <= 0 ? 0 : value >= 1 ? 1 : 1 + (overshoot + 1) * (value - 1) ** 3 + overshoot * (value - 1) ** 2;
  }

  function easeOutBack(value) {
    const overshoot = 1.7;
    return 1 + (overshoot + 1) * (value - 1) ** 3 + overshoot * (value - 1) ** 2;
  }

  // How hard the last hit was: the small nudges give short lines, the pop the longest, then they fade.
  function impactAt(time) {
    if (time < 5.82) {
      return capLift(time) / 0.38 * 0.55;
    }
    return 1 - progress(time, 5.82, 6.15);
  }

  // Three nudges that grow (the fly pushing from inside), then the real pop with an overshoot.
  function capLift(time) {
    const nudge = (start, height) => height * Math.sin(Math.PI * clamp((time - start) / 0.16));
    if (time < 5.82) {
      return Math.max(0, nudge(5.3, 0.08), nudge(5.48, 0.2), nudge(5.65, 0.38));
    }
    return easeOutBack(clamp((time - 5.82) / 0.22));
  }

  // Out in five pushes, each faster than the last: the balloon swells, the body surges, then slips back a little.
  const PUSH_WEIGHTS = [0.12, 0.16, 0.2, 0.24, 0.28];
  function emergence(time) {
    const span = progress(time, 5.9, 6.9) * PUSH_WEIGHTS.length;
    if (span >= PUSH_WEIGHTS.length) {
      return { amount: 1, inflate: 0 };
    }
    if (span <= 0) {
      return { amount: 0, inflate: 0 };
    }
    const index = Math.floor(span);
    const phase = span - index;
    const push = phase < 0.55 ? easeOut(phase / 0.55) : 1 - 0.18 * Math.sin((Math.PI * (phase - 0.55)) / 0.45);
    const done = PUSH_WEIGHTS.slice(0, index).reduce((sum, weight) => sum + weight, 0);
    return { amount: done + PUSH_WEIGHTS[index] * push, inflate: phase < 0.55 ? Math.sin((Math.PI * phase) / 0.55) : 0 };
  }

  // The ptilinum: a pale balloon that swells out of the forehead on each push.
  function drawPtilinum(context, x, y, rock, inflate) {
    if (inflate <= 0.02) {
      return;
    }
    const heading = HEAD_DIRECTION + rock;
    const reach = 205 * FLY_SCALE;
    const centerX = x + Math.cos(heading) * reach;
    const centerY = y + Math.sin(heading) * reach;
    context.beginPath();
    context.ellipse(centerX, centerY, (8 + 16 * inflate), (10 + 20 * inflate), heading, 0, Math.PI * 2);
    context.fillStyle = "rgba(250,246,236,0.85)";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 1.6;
    context.stroke();
  }

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

  // ---------- the fly ----------

  let flyLayer = null;
  function flyCanvas() {
    if (!flyLayer) {
      flyLayer = document.createElement("canvas");
      flyLayer.width = SIZE;
      flyLayer.height = SIZE;
    }
    const layerContext = flyLayer.getContext("2d");
    layerContext.clearRect(0, 0, SIZE, SIZE);
    return layerContext;
  }

  function drawFly(context, time, { x, y, spread, pale, alpha = 1, clip = null, rock = 0, legSwing = 0, legsFree = [1, 1, 1], hideInside = false, wingOpen = 0, stretch = 0, legClock = null }) {
    const layer = flyCanvas();
    Fly.fly(layer, { x, y, angle: HEAD_DIRECTION + Math.PI / 2 + rock, scale: FLY_SCALE, seed: 31, wingSpread: spread, wingOpen, legSwing, legTime: legClock ?? time, legsFree });
    context.save();
    if (clip) {
      trace(context, clip);
      context.clip();
    }
    if (hideInside) {
      // Everything except the case below its opening: the part of the fly still inside stays hidden.
      context.beginPath();
      context.rect(-SIZE, -SIZE, SIZE * 3, SIZE * 3);
      const body = pupaOutline(1.04).filter((point) => lengthwiseOf(point) < PUPA_HALF_LENGTH * 0.62);
      body.forEach(([pointX, pointY], index) => (index ? context.lineTo(pointX, pointY) : context.moveTo(pointX, pointY)));
      context.closePath();
      context.clip("evenodd");
    }
    context.globalAlpha = alpha;
    // A newly emerged fly is pale and soft; colour comes in as it hardens.
    context.filter = `saturate(${lerp(1, 0.35, pale)}) brightness(${lerp(1, 1.35, pale)})`;
    if (stretch !== 0) {
      squashStretch(context, [x, y], HEAD_DIRECTION + rock, 1 + 0.14 * stretch, 1 - 0.09 * stretch);
    }
    context.drawImage(flyLayer, 0, 0);
    context.restore();
  }

  // ---------- frame ----------

  // The continuous story, in story seconds. The montage below cuts between it and other angles.
  function story(context, time, { inside = true } = {}) {
    // The closing push: the camera moves in on the fly and turns it into the opening frame's pose.
    const push = easeInOut(progress(time, 7.4, 7.95));
    const flyEndX = CENTER[0] + DIRECTION[0] * (PUPA_HALF_LENGTH * 0.25 + 1.45 * PUPA_HALF_LENGTH);
    const flyEndY = CENTER[1] + DIRECTION[1] * (PUPA_HALF_LENGTH * 0.25 + 1.45 * PUPA_HALF_LENGTH);
    context.save();
    if (push > 0) {
      context.translate(lerp(flyEndX, 495, push), lerp(flyEndY, 385, push));
      context.rotate((-0.41 - (HEAD_DIRECTION + Math.PI / 2)) * push);
      context.scale(lerp(1, 1 / FLY_SCALE, push), lerp(1, 1 / FLY_SCALE, push));
      context.translate(-flyEndX, -flyEndY);
    }
    const hit = impactAt(time);
    if (hit > 0.02 && push <= 0) {
      const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.9);
      const flinch = 1 + 0.045 * hit;
      const shakeX = (hash(Math.floor(time * 30), 1) - 0.5) * 8 * hit;
      const shakeY = (hash(Math.floor(time * 30), 2) - 0.5) * 8 * hit;
      context.translate(tipX + shakeX, tipY + shakeY);
      context.scale(flinch, flinch);
      context.translate(-tipX, -tipY);
    }
    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);
    const onOrange = progress(time, 2.45, 2.6);
    if (onOrange > 0) {
      context.save();
      context.globalAlpha = onOrange;
      Fly.ground(context);
      context.restore();
    }
    // The yeast is eaten away while the larva feeds.
    eatenYeast(context, time);
    emptyShell(context, time);
    moltedSkin(context, time);

    // Anticipation, then the morph with an overshoot; the finished case takes over when it lands.
    const morph = time < 2.95 ? 0 : easeOutBackAmount(clamp((time - 2.95) / 0.35));
    const larvaFade = time < 2.95 ? 1 : 0;
    const pupaShows = time >= 3.3 ? 1 : 0;
    const flyInside = inside ? progress(time, 4.2, 5.4) : 0;
    const capOpen = capLift(time);
    const { amount: climb, inflate } = emergence(time);
    // Wings: unfold and swing out with an overshoot, flutter while held, then fold back for the loop.
    const spread = easeOutBackAmount(progress(time, 6.95, 7.3));
    const opening = easeOutBackAmount(progress(time, 6.95, 7.25)) * 0.85;
    const closing = easeInOut(progress(time, 7.45, 7.65));
    const flutter = Math.sin(time * 42) * 0.07 * progress(time, 7.2, 7.25) * (1 - closing);
    const wingOpen = opening * (1 - closing) + flutter;
    // Rocking is strongest halfway out; the front legs flail once the thorax is free, then settle.
    const halfway = Math.sin(Math.PI * climb);
    const rock = Math.sin(time * 18) * 0.14 * halfway;
    const legSwing = clamp((climb - 0.3) / 0.2) * (climb < 1 ? 1 : 0);
    // Stretched long on each push, a little squashed while it slips back between pushes.
    const inflateOrSlip = climb > 0 && climb < 1 ? inflate - 0.4 * (1 - inflate) : 0;
    // Each pair unfolds only once its hips are past the opening: front, then middle, then hind.
    const legsFree = [clamp((climb - 0.3) / 0.12), clamp((climb - 0.5) / 0.12), clamp((climb - 0.72) / 0.12)];
    const pale = 1 - progress(time, 7.0, 8.0) * 0.7;

    const [outX, outY] = along(PUPA_HALF_LENGTH * 0.25 + climb * 1.45 * PUPA_HALF_LENGTH);
    const wiggle = Math.sin(time * 18 + 1) * 7 * halfway;
    const stillInside = climb > 0 && climb < 0.75;
    if (stillInside) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing, legsFree, hideInside: true, stretch: inflateOrSlip, legClock: climb * 2.244 });
      drawPtilinum(context, outX + wiggle, outY, rock, inflate);
    }
    if (pupaShows > 0) {
      context.save();
      context.globalAlpha = pupaShows;
      // Each push from inside jolts the case.
      context.translate(-DIRECTION[0] * inflate * 3, -DIRECTION[1] * inflate * 3);
      const wobble = springAfterHits(time);
      squashStretch(context, along(-PUPA_HALF_LENGTH), HEAD_DIRECTION, 1 - 0.07 * wobble, 1 + 0.07 * wobble);
      drawPupa(context, time, { seeThrough: flyInside * (1 - climb), capOpen, impact: impactAt(time) });
      context.restore();
    }
    if (time >= 2.95 && time < 3.3) {
      drawMorph(context, time, morph);
    }
    if (larvaFade > 0) {
      context.save();
      context.globalAlpha = larvaFade;
      Larva.drawLarvaPaper(context, larvaBody(time), time);
      context.restore();
    }
    // Inside the case: eyes first, then the whole fly ghosting through.
    const [insideX, insideY] = along(PUPA_HALF_LENGTH * 0.25);
    if (flyInside > 0 && climb <= 0) {
      drawFly(context, time, { x: insideX, y: insideY, spread: 0, pale: 0.4, alpha: 0.25 + 0.5 * flyInside, clip: pupaOutline(0.98) });
    }
    drawDebris(context, time);
    const guides = progress(time, 6.8, 7.0) * (1 - progress(time, 7.6, 7.85));
    if (guides > 0) {
      Fly.wingGuides(context, { x: outX + wiggle, y: outY, angle: HEAD_DIRECTION + Math.PI / 2 + rock, scale: FLY_SCALE, alpha: guides });
    }
    if (climb >= 0.75) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing, legsFree, hideInside: climb < 1, wingOpen, stretch: climb < 1 ? inflate : 0, legClock: climb * 2.244 });
      if (climb < 1) {
        drawPtilinum(context, outX + wiggle, outY, rock, inflate);
      }
    }
    context.restore();
    // Dissolve into the opening frame, so the film loops.
    const loop = progress(time, 7.85, 8.0);
    if (loop > 0) {
      context.save();
      context.globalAlpha = loop;
      Fly.frame(context);
      context.restore();
    }
    Ink.finish(context, SIZE, 0.25);
    if (push > 0.05) {
      return;
    }
    // Scale bar, 1 mm.
    context.strokeStyle = NAVY;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(70, 1010);
    context.lineTo(70 + PIXELS_PER_MM, 1010);
    context.moveTo(70, 1002);
    context.lineTo(70, 1018);
    context.moveTo(70 + PIXELS_PER_MM, 1002);
    context.lineTo(70 + PIXELS_PER_MM, 1018);
    context.stroke();
    context.fillStyle = NAVY;
    context.font = '24px Consolas, "Courier New", monospace';
    context.fillText("1 mm", 70, 990);
  }

  // ---------- the other angles ----------

  // Macro on the feeding head: the same story frame, magnified around the mouth hooks.
  function macroHead(context, storyTime, local) {
    const head = larvaBody(storyTime).spine[0];
    const zoom = lerp(3.2, 3.8, local);
    context.save();
    context.translate(540, 540);
    context.scale(zoom, zoom);
    context.translate(-head.x, -head.y);
    story(context, storyTime);
    context.restore();
  }

  // Seen from above through a lens: a dish of food with larvae crowding around it.
  function dish(context, local) {
    Ink.paper(context, SIZE);
    const centerX = 540;
    const centerY = 540;
    const radius = 470;
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = "#e3b56c";
    context.fill();
    context.clip();
    for (let ring = 0; ring < 40; ring += 1) {
      context.strokeStyle = `rgba(150,90,40,${0.08 + hash(ring, 1) * 0.08})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, 160 + ring * 8 + hash(ring, 2) * 4, 0, Math.PI * 2);
      context.stroke();
    }
    // The food, dark and lumpy.
    context.beginPath();
    for (let step = 0; step < 40; step += 1) {
      const turn = (step / 40) * Math.PI * 2;
      const reach = 150 + Math.sin(turn * 3) * 18 + Math.sin(turn * 7) * 8;
      context.lineTo(centerX + Math.cos(turn) * reach, centerY + Math.sin(turn) * reach * 1.15);
    }
    context.closePath();
    context.fillStyle = "#5a2e14";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 2.4;
    context.stroke();
    // Larvae pointing in at the food, wriggling.
    for (let larva = 0; larva < 14; larva += 1) {
      const turn = (larva / 14) * Math.PI * 2 + hash(larva, 3) * 0.3;
      const start = 330 + hash(larva, 4) * 80 - easeOut(local) * 70;
      const bend = Math.sin(local * 16 + larva) * 0.4;
      const points = [0, 1, 2, 3].map((index) => {
        const distance = start - index * 50;
        const angle = turn + bend * (index - 1.5) * 0.4;
        return [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance];
      });
      const path = Larva.smoothPath(points);
      const body = Larva.bodyGeometry(path, path.length, path.length * 0.98, 13, local * 3 + larva, { crawling: true });
      Larva.drawLarvaPaper(context, body, local * 3 + larva);
    }
    context.restore();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = NAVY;
    context.lineWidth = 5;
    context.stroke();
  }

  // Looking straight down the larva from its tail: segments recede like a telescope; the rear spiracles sit in the
  // middle of the tail plate.
  function endOn(context, local) {
    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);
    const pulse = 1 + Math.sin(local * 18) * 0.03;
    const near = [420, 650];
    const far = [860, 230];
    for (let ring = 11; ring >= 0; ring -= 1) {
      const amount = ring / 11;
      const x = lerp(near[0], far[0], amount ** 0.8);
      const y = lerp(near[1], far[1], amount ** 0.8);
      const radius = lerp(250, 60, amount) * (1 + 0.06 * Math.sin(local * 14 - ring * 0.9)) * pulse;
      context.beginPath();
      context.ellipse(x, y, radius, radius * 0.92, -0.75, 0, Math.PI * 2);
      context.fillStyle = ring === 0 ? "#f6f0e2" : "#efe6d2";
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 2;
      context.stroke();
    }
    // Tail plate: short radiating strokes and the two spiracles.
    context.strokeStyle = "rgba(60,45,35,0.55)";
    context.lineWidth = 1.2;
    context.beginPath();
    for (let ray = 0; ray < 36; ray += 1) {
      const angle = (ray / 36) * Math.PI * 2;
      context.moveTo(near[0] + Math.cos(angle) * 70, near[1] + Math.sin(angle) * 64);
      context.lineTo(near[0] + Math.cos(angle) * (150 + hash(ray, 5) * 40), near[1] + Math.sin(angle) * (138 + hash(ray, 5) * 36));
    }
    context.stroke();
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.ellipse(near[0] + side * 24, near[1], 14, 18, 0, 0, Math.PI * 2);
      context.fillStyle = "#1a120c";
      context.fill();
      context.strokeStyle = "#c8b48c";
      context.lineWidth = 2;
      context.stroke();
    });
    Ink.finish(context, SIZE, 0.25);
  }

  // Inside the puparium, as a blueprint: the larval body breaks down (tissue swirls) and the fly takes shape.
  const BLUE_LINE = "#b8dcea";
  // Each disc sits where its organ forms, in the fly's own coordinates (as in Fly.fly at scale 1).
  const DISCS = [
    { local: [-72, -142], name: "eye", size: 1.0 }, { local: [72, -142], name: "eye", size: 1.0 },
    { local: [-90, 80], name: "wing", size: 1.3 }, { local: [90, 80], name: "wing", size: 1.3 },
    { local: [-30, -50], name: "leg", size: 0.7 }, { local: [30, -50], name: "leg", size: 0.7 },
    { local: [-40, 15], name: "leg", size: 0.7 }, { local: [40, 15], name: "leg", size: 0.7 },
    { local: [-35, 70], name: "leg", size: 0.7 }, { local: [35, 70], name: "leg", size: 0.7 },
  ];

  // The empty eggshell from the hatching, still lying on the flesh near where the larva started feeding.
  function emptyShell(context, time) {
    const fade = 1 - progress(time, 2.3, 2.6);
    if (fade <= 0) {
      return;
    }
    const [x, y] = along(-90, 190);
    context.save();
    context.globalAlpha = fade;
    context.translate(x, y);
    context.rotate(HEAD_DIRECTION + 0.5);
    context.beginPath();
    context.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(250,245,230,0.85)";
    context.fill();
    context.strokeStyle = "#1d1f33";
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = "rgba(80,60,40,0.6)";
    context.lineWidth = 1.4;
    [[-30, -8, -5, 6], [5, -10, 25, 4], [-10, 10, 18, -2]].forEach(([fromX, fromY, toX, toY]) => {
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.quadraticCurveTo((fromX + toX) / 2, fromY - 8, toX, toY);
      context.stroke();
    });
    [-1, 1].forEach((side) => {
      context.strokeStyle = "#1d1f33";
      context.beginPath();
      context.moveTo(-66, side * 6);
      context.lineTo(-110, side * 22);
      context.stroke();
    });
    context.restore();
  }

  function eatenYeast(context, time) {
    const head = larvaBody(time).spine[0];
    // The near edge sits at the mouth, so each plunge goes into the paste.
    const [centerX, centerY] = along(PUPA_HALF_LENGTH * 1.15 + 100);
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
      // A bite hole deepens where the mouth works; the rest of the paste stays put.
      const gnawed = towardLarva ** 6 * eaten * 0.55 + towardLarva ** 3 * 0.07 * Math.abs(Math.sin(turn * 18 + bites));
      const reach = 110 * lumpy * Math.max(0.05, 1 - gnawed);
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

  function instars(context, local) {
    Ink.paper(context, SIZE);
    context.fillStyle = "rgba(233,194,124,0.35)";
    context.fillRect(0, 0, SIZE, SIZE);
    const rulerY = 900;
    const startX = 170;
    context.strokeStyle = NAVY;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(startX, rulerY);
    context.lineTo(startX + 4 * PIXELS_PER_MM * 1.25, rulerY);
    for (let tick = 0; tick <= 40; tick += 1) {
      const x = startX + (tick / 10) * PIXELS_PER_MM * 1.25;
      context.moveTo(x, rulerY);
      context.lineTo(x, rulerY - (tick % 10 === 0 ? 22 : tick % 5 === 0 ? 14 : 8));
    }
    context.stroke();
    context.fillStyle = NAVY;
    context.font = '24px Consolas, "Courier New", monospace';
    for (let millimetre = 0; millimetre <= 4; millimetre += 1) {
      context.fillText(`${millimetre} mm`, startX + millimetre * PIXELS_PER_MM * 1.25 - 20, rulerY + 36);
    }
    [[1, 230, "1st instar"], [2, 460, "2nd instar"], [4, 690, "3rd instar"]].forEach(([millimetres, y, name], index) => {
      const appear = easeOutBackAmount(progress(local, index * 0.28, index * 0.28 + 0.25));
      if (appear <= 0) {
        return;
      }
      const length = millimetres * PIXELS_PER_MM * 1.25 * appear;
      const path = Larva.smoothPath([[startX + length + 40, y], [startX, y]]);
      const body = Larva.bodyGeometry(path, length, length, length / 11, local * 3 + index, { crawling: true });
      Larva.drawLarvaPaper(context, body, local * 3 + index);
      context.fillStyle = NAVY;
      context.fillText(name, startX, y - length / 11 - 26);
    });
    Ink.finish(context, SIZE, 0.25);
  }

  function blueprintPupa(context, local) {
    context.fillStyle = "#0d1322";
    context.fillRect(0, 0, SIZE, SIZE);
    const center = [540, 560];
    const angle = -0.35 + local * 0.05;
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
    // The fly's frame: head toward the case's head end (+u).
    const FLY_SIZE = 0.85;
    const FLY_ANGLE = angle + Math.PI / 2;
    const flyPoint = ([localX, localY]) => [
      center[0] + (localX * Math.cos(FLY_ANGLE) - (localY - 135) * Math.sin(FLY_ANGLE)) * FLY_SIZE,
      center[1] + (localX * Math.sin(FLY_ANGLE) + (localY - 135) * Math.cos(FLY_ANGLE)) * FLY_SIZE,
    ];
    const ellipseIn = (centerLocal, radiusX, radiusY) => Array.from({ length: 40 }, (unused, step) => {
      const turn = (step / 40) * Math.PI * 2;
      return flyPoint([centerLocal[0] + Math.cos(turn) * radiusX, centerLocal[1] + Math.sin(turn) * radiusY]);
    });
    const flash = 1 - progress(local, 0, 0.3);
    const gatherBody = easeInOut(progress(local, 0.3, 1.1));
    const eversion = easeOutBackAmount(progress(local, 0.8, 1.3));
    const eyes = easeOut(progress(local, 1.2, 1.6));
    const legs = progress(local, 1.3, 2.1);
    const wings = easeOut(progress(local, 1.6, 2.3));

    if (flash > 0) {
      trace(context, outline);
      context.fillStyle = `rgba(240,236,224,${0.85 * flash})`;
      context.fill();
    }
    context.save();
    trace(context, outline);
    context.clip();
    context.strokeStyle = BLUE_LINE;
    context.lineWidth = 2.4;
    // The larva: a segmented tube that fades as the three body parts take over.
    if (gatherBody < 1) {
      context.globalAlpha = 1 - gatherBody;
      const tube = ellipseIn([0, 135], 95, 340);
      trace(context, tube);
      context.stroke();
      context.save();
      trace(context, tube);
      context.clip();
      for (let segment = 1; segment < 12; segment += 1) {
        const y = -205 + segment * 56.7;
        trace(context, [flyPoint([-100, y]), flyPoint([0, y + 12]), flyPoint([100, y])], false);
        context.stroke();
      }
      context.restore();
      context.globalAlpha = 1;
    }
    // Head, thorax and abdomen gather out of the segments.
    const parts = [
      { from: [0, -60], to: [0, -140], fromRadius: [40, 25], toRadius: [100, 60], amount: eversion },
      { from: [0, -40], to: [0, 0], fromRadius: [90, 100], toRadius: [98, 122], amount: gatherBody },
      { from: [0, 300], to: [0, 285], fromRadius: [95, 260], toRadius: [112, 185], amount: gatherBody },
    ];
    parts.forEach(({ from, to, fromRadius, toRadius, amount }, index) => {
      if (amount <= 0) {
        return;
      }
      const shape = ellipseIn([lerp(from[0], to[0], amount), lerp(from[1], to[1], amount)], lerp(fromRadius[0], toRadius[0], amount), lerp(fromRadius[1], toRadius[1], amount));
      trace(context, shape);
      context.globalAlpha = Math.min(1, amount * 1.5);
      context.fillStyle = "rgba(169,214,232,0.08)";
      context.fill();
      context.stroke();
      if (index === 2) {
        context.save();
        trace(context, shape);
        context.clip();
        for (let band = 1; band < 6; band += 1) {
          const y = lerp(from[1], to[1], amount) - 150 + band * 55;
          trace(context, [flyPoint([-130, y]), flyPoint([0, y + 10]), flyPoint([130, y])], false);
          context.stroke();
        }
        context.restore();
      }
      context.globalAlpha = 1;
    });
    // Discs: a small glow where each organ starts, fading as it grows.
    const discGlow = (localPoint, start) => {
      const glow = progress(local, start - 0.3, start) * (1 - progress(local, start + 0.2, start + 0.5));
      if (glow > 0) {
        const [x, y] = flyPoint(localPoint);
        context.fillStyle = `rgba(120,220,170,${0.8 * glow})`;
        context.beginPath();
        context.arc(x, y, 9, 0, Math.PI * 2);
        context.fill();
      }
    };
    // Eyes.
    [-1, 1].forEach((side) => {
      discGlow([side * 72, -142], 1.2);
      if (eyes > 0) {
        trace(context, ellipseIn([side * 72, -142], 42 * eyes, 52 * eyes));
        context.fillStyle = "rgba(255,122,102,0.35)";
        context.fill();
        context.strokeStyle = "#ff7a66";
        context.stroke();
        context.strokeStyle = BLUE_LINE;
      }
    });
    // Legs: three segments each, growing one after another, folded back along the body as they lie in the pupa.
    const LEG_ROOTS = [[30, -50], [40, 15], [35, 70]];
    [-1, 1].forEach((side) => {
      LEG_ROOTS.forEach((root, pair) => {
        discGlow([side * root[0], root[1]], 1.3 + pair * 0.1);
        let [x, y] = [side * root[0], root[1]];
        const points = [[x, y]];
        [[0.9, 80], [1.35, 90], [1.55, 70]].forEach(([segmentAngle, length], segment) => {
          const grown = clamp((legs - pair * 0.1) * 3 - segment);
          if (grown <= 0) {
            return;
          }
          x += side * Math.cos(segmentAngle) * length * grown;
          y += Math.sin(segmentAngle) * length * grown;
          points.push([x, y]);
        });
        if (points.length > 1) {
          trace(context, points.map(flyPoint), false);
          context.lineWidth = 3;
          context.stroke();
          context.fillStyle = BLUE_LINE;
          points.slice(1).forEach((point) => {
            const [jointX, jointY] = flyPoint(point);
            context.beginPath();
            context.arc(jointX, jointY, 3.5, 0, Math.PI * 2);
            context.fill();
          });
          context.lineWidth = 2.4;
        }
      });
    });
    // Wing pads: buds at the shoulders that lengthen back along the body.
    [-1, 1].forEach((side) => {
      discGlow([side * 90, 70], 1.6);
      if (wings > 0) {
        trace(context, ellipseIn([side * 100, 70 + 110 * wings], 18 + 30 * wings, 20 + 120 * wings));
        context.fillStyle = "rgba(169,214,232,0.12)";
        context.fill();
        context.stroke();
      }
    });
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
    context.fillText(`day ${5 + Math.floor((local / 2.5) * 4)}`, 110, 140);
    const caption = local < 1.2 ? "head turns out" : local < 1.6 ? "eyes" : local < 2.0 ? "legs" : "wings";
    context.globalAlpha = local > 0.8 ? 0.8 : 0;
    context.fillText(caption, 110, 180);
    context.globalAlpha = 1;
  }

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
      Fly.fly(layer, { x: point(80, 0)[0], y: point(80, 0)[1], angle: angle + Math.PI / 2, scale: 0.64, seed: 31, wingSpread: 0, legsFree: [0, 0, 0], eyePigment: stage === 2 ? 0 : stage === 3 ? easeOut(within) : 1 });
      const looks = [
        "grayscale(1) brightness(1.45) contrast(0.8)",
        "grayscale(0.6) brightness(1.3) contrast(0.85)",
        "saturate(0.9) brightness(0.95)",
      ];
      context.filter = looks[stage - 2];
      context.drawImage(flyLayer, 0, 0);
      context.filter = "none";

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

  // ---------- the montage: fast cuts between angles ----------

  // A camera that never stands still: zoom from one scale to another, a slow turn, a drift, and a small kick at the
  // start of each shot so the cut lands with energy. Scale stays above 1 so turning never shows the frame's edge.
  function applyShotCamera(context, shot, local) {
    if (!shot.camera) {
      return;
    }
    const [fromScale, toScale, turn, driftX, driftY] = shot.camera;
    const weight = shot.fadeCameraAt ? 1 - easeInOut(progress(local, shot.fadeCameraAt, shot.fadeCameraAt + 0.15)) : 1;
    const kick = 1 + 0.05 * (1 - easeOut(clamp(local * 5)));
    const scale = lerp(1, Math.max(1.06, lerp(fromScale, toScale, easeInOut(local))) * kick, weight);
    context.translate(540 + driftX * (local - 0.5) * weight, 540 + driftY * (local - 0.5) * weight);
    context.rotate(turn * (local - 0.5) * weight);
    context.scale(scale, scale);
    context.translate(-540, -540);
  }

  const SHOTS = [
    { end: 1.0, camera: [1.0, 1.15, 0.03, -40, 20], draw: (context, local, time) => story(context, time * 2.0) },
    { end: 1.5, camera: [1.0, 1.1, -0.05, 30, -30], draw: (context, local) => macroHead(context, 0.7 + local * 0.3, local) },
    { end: 2.5, camera: [1.0, 1.08, 0.02, 0, 0], draw: (context, local) => instars(context, local) },
    { end: 3.5, camera: [1.2, 1.0, 0.04, 40, -40], draw: (context, local) => story(context, 2.5 + local * 1.7) },
    { end: 6.0, camera: [1.0, 1.08, 0.02, 0, 10], draw: (context, local) => cutawayPupa(context, local * 2.5) },
    { end: 10.0, camera: [1.12, 1.0, 0.02, -20, 30], fadeCameraAt: 0.5, draw: (context, local) => story(context, 5.2 + local * 2.8, { inside: false }) },
  ];

  function renderAt(context, time) {
    Ink.setTime(time);
    let start = 0;
    for (const shot of SHOTS) {
      if (time < shot.end || shot === SHOTS[SHOTS.length - 1]) {
        const local = clamp((time - start) / (shot.end - start));
        context.save();
        applyShotCamera(context, shot, local);
        shot.draw(context, local, time);
        context.restore();
        return;
      }
      start = shot.end;
    }
  }

  return { renderAt: Ink.onBeat(renderAt), DURATION };
})();
