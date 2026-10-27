// Beat 5, the adult's life (6.5 s): takeoff from the opening's orange, a quick aerial flight to a cut orange in
// saccades, courtship (orient, follow, tap, sing, cuddle), a discreet mating, egg laying, and back to the opening. Straight runs and 90° turns that shrink by the golden ratio each beat, so the squared path
// converges like a golden spiral on the point where he lands (on the frame's φ lines). Behaviour notes:
// anatomy/fruit-fly-adult-life.md.
"use strict";

const Adult = (() => {
  const { lerp, clamp, progress, easeOut, easeIn, easeInOut, hash } = Ink;
  const SIZE = 1080;
  const DURATION = 16.5;
  const GOLDEN = 0.618;
  const NAVY = "#1d1f33";
  const CONSTRUCTION = "rgba(90,120,190,ALPHA)";
  // The opening frame's fly.
  const START_POSE = { x: 495, y: 385, angle: -0.41 };

  // Aerial layout: the whole orange he leaves at bottom left, a cut half where the female feeds.
  const WHOLE = { x: 110, y: 880, radius: 300 };
  const HALF = { x: 690, y: 430, radius: 335 };
  // He lands just below and left of the frame's φ crossing, she feeds just above and right of it.
  const LANDING = [SIZE * 0.618 - 75, SIZE * 0.382 + 60];
  // The pair straddles the φ crossing (668, 413), a body length and a half apart.
  const FEMALE = { x: SIZE * 0.618 + 75, y: SIZE * 0.382 - 60, angle: 0.94 };
  const AERIAL_SCALE = 0.28;
  const RUN_LENGTH = 700;
  const RUNS = 6;
  const POV_START = 1.0;
  const OVERVIEW_START = 2.5;
  const FLIGHT_START = 5.0;
  // A run per half beat, so he lands at 2.5 s and the time goes to the courtship.
  const RUN_TIME = Ink.BEAT / 2;
  const COURTSHIP_START = FLIGHT_START + RUNS * RUN_TIME;

  // Corners of the squared spiral. Run k heads in direction k (right, up, left, down, ...) for RUN_LENGTH * φ^-k; the
  // runs sum to a geometric series whose limit is LANDING, which fixes the start: start = LANDING - L / (1 - r·i).
  function flightCorners() {
    const directions = [[1, 0], [0, -1], [-1, 0], [0, 1]];
    const sumX = 1 / (1 + GOLDEN * GOLDEN);
    const sumY = -GOLDEN / (1 + GOLDEN * GOLDEN);
    const corners = [[LANDING[0] - RUN_LENGTH * sumX, LANDING[1] - RUN_LENGTH * sumY]];
    for (let run = 0; run < RUNS - 1; run += 1) {
      const [lastX, lastY] = corners[corners.length - 1];
      const [directionX, directionY] = directions[run % 4];
      const length = RUN_LENGTH * GOLDEN ** run;
      corners.push([lastX + directionX * length, lastY + directionY * length]);
    }
    corners.push(LANDING);
    return corners;
  }
  const CORNERS = flightCorners();

  // Heading for a fly whose head points along local -y.
  function headingOf([fromX, fromY], [toX, toY]) {
    return Math.atan2(toX - fromX, -(toY - fromY));
  }

  // A cut orange seen from above: rind with pores, white pith, eleven segments of juice vesicles pointing to the core.
  function halfOrange(context, { x, y, radius }) {
    context.save();
    context.filter = "blur(22px)";
    context.fillStyle = "rgba(80,40,20,0.22)";
    context.beginPath();
    context.ellipse(x + 28, y + 34, radius * 1.02, radius * 0.98, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    const disc = (scale, color) => {
      context.beginPath();
      context.arc(x, y, radius * scale, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    };
    disc(1, "#e3702a");
    for (let pore = 0; pore < 240; pore += 1) {
      const turn = hash(pore, 3) * Math.PI * 2;
      const reach = radius * (0.95 + hash(pore, 4) * 0.045);
      context.fillStyle = "rgba(150,60,20,0.5)";
      context.beginPath();
      context.arc(x + Math.cos(turn) * reach, y + Math.sin(turn) * reach, 1.4, 0, Math.PI * 2);
      context.fill();
    }
    disc(0.93, "#fbead2");
    disc(0.885, "#f39a3c");
    const SEGMENTS = 11;
    context.save();
    context.beginPath();
    context.arc(x, y, radius * 0.885, 0, Math.PI * 2);
    context.clip();
    // Vesicles: teardrops along each segment, tip toward the core, larger toward the rind.
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const middle = (segment / SEGMENTS) * Math.PI * 2 + 0.2;
      const halfWidth = Math.PI / SEGMENTS;
      for (let ring = 0; ring < 9; ring += 1) {
        const reach = radius * (0.16 + ring * 0.088);
        const across = Math.max(1, Math.round(1 + ring * 0.9));
        for (let slot = 0; slot < across; slot += 1) {
          const turn = middle + ((slot + 0.5) / across - 0.5) * halfWidth * 1.7 + (hash(segment, ring, slot) - 0.5) * 0.04;
          const centerX = x + Math.cos(turn) * reach;
          const centerY = y + Math.sin(turn) * reach;
          const length = 14 + ring * 2.2;
          const width = 5 + ring * 0.9;
          context.save();
          context.translate(centerX, centerY);
          context.rotate(turn);
          context.beginPath();
          context.moveTo(-length, 0);
          context.quadraticCurveTo(-length * 0.2, -width, length * 0.6, -width * 0.6);
          context.quadraticCurveTo(length, 0, length * 0.6, width * 0.6);
          context.quadraticCurveTo(-length * 0.2, width, -length, 0);
          const lit = hash(segment, ring, slot + 9);
          context.fillStyle = lit > 0.5 ? "rgba(255,190,100,0.85)" : "rgba(246,160,70,0.85)";
          context.fill();
          context.strokeStyle = "rgba(196,84,30,0.55)";
          context.lineWidth = 1.1;
          context.stroke();
          context.fillStyle = "rgba(255,250,235,0.85)";
          context.beginPath();
          context.arc(length * 0.3, -width * 0.25, 1.4, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
      }
    }
    // Membranes between the segments, slightly bowed, meeting in a pale core.
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const turn = ((segment + 0.5) / SEGMENTS) * Math.PI * 2 + 0.2;
      context.strokeStyle = "rgba(255,244,226,0.95)";
      context.lineWidth = 3.4;
      context.beginPath();
      context.moveTo(x + Math.cos(turn) * radius * 0.07, y + Math.sin(turn) * radius * 0.07);
      context.quadraticCurveTo(
        x + Math.cos(turn + 0.04) * radius * 0.5, y + Math.sin(turn + 0.04) * radius * 0.5,
        x + Math.cos(turn) * radius * 0.9, y + Math.sin(turn) * radius * 0.9,
      );
      context.stroke();
    }
    disc(0.075, "#fdf1de");
    // Sketched shadow on the side away from the light (top left).
    Fly.sketchShade(context, [x - radius, y - radius, x + radius, y + radius], {
      darkness: (pointX, pointY) => clamp(((pointX - x) + (pointY - y)) / (radius * 1.4)) ** 2 * 1.2,
      clusters: 520, color: "#b4402c", alpha: 0.55, baseAngle: 0.6, spread: 1.3, seed: 41, width: 1.2,
    });
    context.restore();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = NAVY;
    context.lineWidth = 2.6;
    context.stroke();
    context.strokeStyle = CONSTRUCTION.replace("ALPHA", "0.5");
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(x + 8, y - 10, radius + 20, 0, Math.PI * 2);
    context.stroke();
  }

  // The aerial background never changes: draw it once.
  let aerialLayer = null;
  // The towel is drawn as vectors every frame (sharp at any zoom); the cut orange is cached on a transparent layer.
  function aerialBackground(context) {
    Kitchen.towel(context);
    if (!aerialLayer) {
      aerialLayer = document.createElement("canvas");
      aerialLayer.width = SIZE;
      aerialLayer.height = SIZE;
      const layer = aerialLayer.getContext("2d");
      halfOrange(layer, HALF);
    }
    context.drawImage(aerialLayer, 0, 0);
  }

  // Takeoff (0 to 1 s). Beat 1: wings rise and the body crouches. Beat 2: the middle legs push, the wings blur and he
  // lifts toward the camera while his shadow stays behind on the orange.
  function takeoff(context, time) {
    const rise = progress(time, 0.05, 0.4);
    const lift = easeInOut(progress(time, 0.5, 1.0));
    const launch = progress(time, 0.5, 0.62);
    // The camera tilts up after him and gives a small kick at the launch.
    const kick = Math.exp(-Math.max(0, time - 0.5) * 12) * (time > 0.5 ? 1 : 0);
    const cameraScale = 1 + 0.03 * kick + 0.08 * lift;
    context.save();
    context.translate(540, 540);
    context.scale(cameraScale, cameraScale);
    context.translate(-540 + Math.sin(time * 70) * 5 * kick, -540 - 60 * lift);
    Fly.ground(context);
    // Launch ticks around the feet.
    if (launch > 0 && launch < 1) {
      context.strokeStyle = `rgba(29,31,51,${1 - launch})`;
      context.lineWidth = 2.4;
      context.lineCap = "round";
      for (let tick = 0; tick < 10; tick += 1) {
        const turn = (tick / 10) * Math.PI * 2 + 0.3;
        const inner = 190 + launch * 90;
        const outer = inner + 40 * (1 - launch);
        context.beginPath();
        context.moveTo(START_POSE.x + Math.cos(turn) * inner, START_POSE.y + 60 + Math.sin(turn) * inner);
        context.lineTo(START_POSE.x + Math.cos(turn) * outer, START_POSE.y + 60 + Math.sin(turn) * outer);
        context.stroke();
      }
    }
    // Crouch before the jump (squash along the body), stretch as he leaves.
    const crouch = Math.sin(Math.PI * progress(time, 0.2, 0.55));
    const stretch = Math.sin(Math.PI * progress(time, 0.5, 0.8));
    const squash = 1 - 0.06 * crouch + 0.08 * stretch;
    const x = lerp(START_POSE.x, 330, lift);
    const y = lerp(START_POSE.y, 90, lift) + Math.sin(time * 40) * 3 * lift;
    context.save();
    context.translate(x, y);
    context.rotate(START_POSE.angle);
    context.scale(1 / Math.sqrt(squash), squash);
    context.rotate(-START_POSE.angle);
    context.translate(-x, -y);
    Fly.fly(context, {
      x, y, angle: START_POSE.angle - 0.25 * lift, scale: 1 + 0.45 * lift, seed: 21,
      wingOpen: time < 0.5 ? 0.9 * Ink.easeOut(rise) : 0, wingBeat: time < 0.5 ? 0 : 1,
      legSwing: 0.5 * stretch, legTime: time, height: 320 * lift,
    });
    context.restore();
    context.restore();
  }

  // The flight (1 to 2.5 s): one run per half beat, a 50 ms saccade at each corner, the last run a landing.
  function flightState(time) {
    const run = clamp(Math.floor((time - FLIGHT_START) / RUN_TIME), 0, RUNS - 1);
    const runStart = FLIGHT_START + run * RUN_TIME;
    const along = progress(time, runStart, runStart + RUN_TIME);
    const from = CORNERS[run];
    const to = CORNERS[run + 1];
    const heading = headingOf(from, to);
    const previous = run > 0 ? headingOf(CORNERS[run - 1], from) : heading;
    // The saccade: the body snaps round in 50 ms with a small overshoot.
    const snap = progress(time, runStart, runStart + 0.05);
    const overshoot = Math.sin(Math.PI * progress(time, runStart + 0.05, runStart + 0.12)) * 0.12;
    let turn = heading - previous;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const angle = previous + turn * snap + Math.sign(turn) * overshoot;
    const landing = run === RUNS - 1 ? easeOut(along) : along;
    return {
      x: lerp(from[0], to[0], landing),
      y: lerp(from[1], to[1], landing),
      angle,
      run,
      // Touchdown: the wings stop and fold back over the abdomen.
      landed: run === RUNS - 1 ? progress(time, runStart + 0.12, runStart + RUN_TIME) : 0,
    };
  }

  const unit = (angle) => [Math.sin(angle), -Math.cos(angle)];
  const add = ([fromX, fromY], [byX, byY], amount = 1) => [fromX + byX * amount, fromY + byY * amount];
  const mix = (from, to, amount) => [lerp(from[0], to[0], amount), lerp(from[1], to[1], amount)];

  // Courtship in the order flies do it (Bastock and Manning 1955), one step per beat or two, in courtship time c.
  function courtship(c) {
    const forward = unit(FEMALE.angle);
    const right = [-forward[1], forward[0]];
    // She feeds, walks a few steps on, stops to listen, then turns her head to him.
    const walk = easeInOut(progress(c, 0.5, 1.0));
    const female = add([FEMALE.x, FEMALE.y], forward, 45 * walk);
    const femaleTurn = -0.9 * easeOut(progress(c, 3.0, 3.35));
    // His marks: behind her abdomen to tap, at her side to sing, by her head to cuddle, then behind her to mount.
    // At this scale her abdomen reaches about 140 px behind her centre and his head about 40 px ahead of his.
    const behind = add(female, forward, -215);
    const side = add(add(female, forward, -30), right, -165);
    const femaleHead = add(female, unit(FEMALE.angle - 0.9), 45);
    const cheek = add(femaleHead, unit(FEMALE.angle - 0.9 - Math.PI / 2), 95);
    const walks = [
      [LANDING, behind, 0.5, 1.05],
      [behind, side, 1.45, 1.75],
      [side, cheek, 3.0, 3.3],
      [cheek, add(female, unit(FEMALE.angle - 0.9), -215), 3.6, 4.0],
    ];
    let male = LANDING;
    let walked = 0;
    let moving = 0;
    walks.forEach(([from, to, start, end]) => {
      if (c < start) {
        return;
      }
      const amount = easeInOut(progress(c, start, end));
      male = mix(from, to, amount);
      walked += Math.hypot(to[0] - from[0], to[1] - from[1]) * amount;
      moving = Math.max(moving, Math.sin(Math.PI * progress(c, start, end)));
    });
    // He always faces her: orienting is the first step. Before the cuddle he faces her abdomen, then her head.
    const target = c < 1.45 ? add(female, forward, -60) : c < 3.0 ? female : femaleHead;
    const orient = easeOut(progress(c, 0, 0.35));
    const maleAngle = lerp(0, headingOf(male, target), orient);
    const tap = c >= 1.0 && c < 1.45 ? Math.max(0, Math.sin(Math.PI * (((c - 1.0) / 0.225) % 1))) : 0;
    const sing = easeOut(progress(c, 1.75, 1.95)) * (1 - progress(c, 2.9, 3.0));
    // The song wing is his right wing: its tip sits out to his right side.
    const maleRight = [Math.cos(maleAngle), Math.sin(maleAngle)];
    const songSide = (femaleHead[0] - male[0]) * maleRight[0] + (femaleHead[1] - male[1]) * maleRight[1] > 0 ? 1 : -1;
    return {
      female,
      femaleAngle: FEMALE.angle + femaleTurn,
      femaleListen: progress(c, 1.9, 2.2) * (1 - progress(c, 3.4, 3.6)),
      male, maleAngle, walked, moving, tap, sing,
      tapPoint: add(female, forward, -150),
      songSide,
      wingTip: add(male, maleRight, 110 * songSide),
      hearts: add(mix(cheek, femaleHead, 0.5), [0, -30]),
    };
  }

  // The pulse song: a train of pulses each beat, rings spreading from his wing toward her.
  function songRings(context, c, [x, y]) {
    [1.95, 2.45].forEach((trainStart) => {
      for (let pulse = 0; pulse < 5; pulse += 1) {
        const born = trainStart + pulse * 0.06;
        const age = (c - born) / 0.5;
        if (age < 0 || age > 1) {
          continue;
        }
        context.strokeStyle = pulse % 2 ? `rgba(228,90,200,${1 - age})` : `rgba(240,170,40,${1 - age})`;
        context.lineWidth = 2.4 * (1 - age) + 0.6;
        context.beginPath();
        context.arc(x, y, 10 + age * 150, 0, Math.PI * 2);
        context.stroke();
      }
    });
  }

  function heart(context, x, y, size) {
    context.save();
    context.translate(x, y);
    context.scale(size, size);
    context.beginPath();
    context.moveTo(0, 6);
    context.bezierCurveTo(-14, -4, -8, -16, 0, -8);
    context.bezierCurveTo(8, -16, 14, -4, 0, 6);
    context.fillStyle = "#d9364f";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 1.6 / size;
    context.stroke();
    context.restore();
  }

  // Three small hearts pop up between their heads, one after another, with an overshoot.
  function cuddleHearts(context, c, [x, y]) {
    [[3.1, -22], [3.25, 18], [3.4, -2]].forEach(([born, offset]) => {
      const age = c - born;
      if (age <= 0 || age > 0.9) {
        return;
      }
      const pop = Math.min(1, age / 0.18);
      const overshoot = 1 + 0.4 * Math.sin(Math.PI * pop);
      context.globalAlpha = 1 - progress(age, 0.6, 0.9);
      heart(context, x + offset + Math.sin(age * 8) * 4, y - age * 60, 1.1 * pop * overshoot);
      context.globalAlpha = 1;
    });
  }

  // A fruit fly egg from above: white, long, two dorsal filaments with paddle tips (as in the opening).
  function egg(context, [x, y], angle, size) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(size, size);
    [-1, 1].forEach((side) => {
      context.strokeStyle = NAVY;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-34, side * 4);
      context.lineTo(-58, side * 16);
      context.stroke();
      context.fillStyle = "#f4eedf";
      context.beginPath();
      context.ellipse(-62, side * 18, 8, 4, side * 0.4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
    context.beginPath();
    context.ellipse(0, 0, 36, 13, 0, 0, Math.PI * 2);
    context.fillStyle = "#f7f2e6";
    context.fill();
    context.strokeStyle = NAVY;
    context.lineWidth = 2.2;
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.beginPath();
    context.ellipse(-10, -4, 12, 3, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const LAYS = [5.75, 6.25, 6.75];
  const HATCHES = [7.0, 7.25, 7.5];

  function eggPlace(pair, index) {
    const forward = unit(FEMALE.angle - 0.9);
    return add(pair.female, forward, 150 * easeInOut(progress(LAYS[index], 5.5, 7.0)) - 185);
  }

  // A first-instar larva (about 0.6 mm, so a quarter of the fly's length here): a white segmented worm whose body
  // wave runs one beat, crawling along its heading and sinking into the flesh as it burrows.
  function hatchling(context, [x, y], angle, crawl, sink, time) {
    const length = 52;
    const forward = [Math.cos(angle), Math.sin(angle)];
    context.save();
    context.globalAlpha = 1 - sink;
    for (let segment = 0; segment < 9; segment += 1) {
      const along = (segment / 8 - 0.5) * length + crawl;
      const wave = Math.sin(time * Math.PI * 4 - segment * 0.8) * 3;
      const radius = (5.5 - Math.abs(segment - 3) * 0.45) * (1 - 0.5 * sink);
      const pointX = x + forward[0] * along - forward[1] * wave;
      const pointY = y + forward[1] * along + forward[0] * wave;
      context.beginPath();
      context.arc(pointX, pointY, Math.max(1, radius), 0, Math.PI * 2);
      context.fillStyle = "#fbf6ea";
      context.fill();
      context.strokeStyle = "#1d1f33";
      context.lineWidth = 1.2;
      context.stroke();
    }
    context.restore();
  }

  // c 4.0 to 7.5: he climbs on her back, he flies off, she walks on laying an egg on each beat.
  function matingAndEggs(context, c, time, pair) {
    const herAngle = FEMALE.angle - 0.9;
    const forward = unit(herAngle);
    // She walks slowly on between eggs; each egg is pushed out of her tip on a beat, abdomen dipping.
    const stroll = easeInOut(progress(c, 5.5, 7.0));
    const female = add(pair.female, forward, 150 * stroll);
    LAYS.forEach((layTime, index) => {
      const pop = progress(c, layTime, layTime + 0.18);
      if (pop <= 0) {
        return;
      }
      const overshoot = 1 + 0.25 * Math.sin(Math.PI * pop);
      const layAt = add(pair.female, forward, 150 * easeInOut(progress(layTime, 5.5, 7.0)) - 185);
      const eggAngle = herAngle + Math.PI / 2 + (index - 1) * 0.15;
      egg(context, layAt, eggAngle, AERIAL_SCALE * 0.9 * pop * overshoot);
      const hatch = progress(c, HATCHES[index], HATCHES[index] + 1.0);
      if (hatch > 0) {
        // The front cap lifts (a dark gap at the egg's front end), then the larva comes out and crawls off.
        const front = [Math.cos(eggAngle), Math.sin(eggAngle)];
        const capAt = add(layAt, front, 10);
        context.fillStyle = "rgba(60,30,20,0.6)";
        context.beginPath();
        context.ellipse(capAt[0], capAt[1], 3.5, 3, eggAngle, 0, Math.PI * 2);
        context.fill();
        // Each larva leaves its shell in its own direction, fanning out into the flesh.
        hatchling(context, layAt, eggAngle + (index - 1) * 1.1 + 0.5, 20 + 70 * easeInOut(hatch), progress(hatch, 0.65, 1), c);
      }
    });
    const dip = LAYS.reduce((most, layTime) => Math.max(most, Math.sin(Math.PI * progress(c, layTime - 0.15, layTime + 0.1))), 0);
    const age = progress(c, 8.0, 9.0);
    const fall = easeOut(progress(c, 8.95, 9.2));
    const tremble = Math.sin(c * 40) * 2 * age * (1 - fall);
    context.save();
    context.filter = `saturate(${1 - 0.65 * age}) brightness(${1 - 0.2 * age})`;
    context.translate(female[0], female[1]);
    context.rotate(herAngle + 0.7 * fall);
    context.scale((1 + 0.05 * dip) * (1 - 0.1 * fall), (1 - 0.06 * dip) * (1 - 0.15 * fall));
    context.rotate(-herAngle);
    context.translate(-female[0] + tremble, -female[1]);
    Fly.fly(context, {
      x: female[0], y: female[1], angle: herAngle, scale: AERIAL_SCALE * 1.08, seed: 33,
      legSwing: 0.3 * Math.sin(Math.PI * stroll), legTime: (150 * stroll) / 12,
      legsFree: [1 - fall, 1 - fall, 1 - fall], wingOpen: 0.35 * fall,
    });
    context.restore();
    // Him: a hop onto her back (one beat), then a jump off into flight, out of the frame.
    const mount = easeInOut(progress(c, 4.0, 4.4));
    const leave = easeIn(progress(c, 5.0, 5.5));
    if (leave >= 1) {
      return;
    }
    const onBack = add(pair.female, forward, -115);
    const hop = Math.sin(Math.PI * progress(c, 4.0, 4.4)) * 18;
    const seated = mix(pair.male, onBack, mount);
    const away = add(onBack, [-0.6, -0.8], 700 * leave);
    const position = mix(seated, away, leave);
    const angle = lerp(lerp(pair.maleAngle, herAngle, mount), headingOf(onBack, away), progress(c, 5.1, 5.2));
    Fly.fly(context, {
      x: position[0], y: position[1] - hop, angle, scale: AERIAL_SCALE * (1 + 0.08 * mount + 0.3 * leave), seed: 21, male: true,
      wingBeat: c > 5.05 ? 1 : 0, height: 20 * mount + 200 * leave, legTime: time,
      legSwing: 0.3 * Math.sin(Math.PI * progress(c, 4.0, 4.4)),
    });
    // A pop of hearts as he settles, kept small.
    [[4.35, -16], [4.45, 14]].forEach(([born, offset]) => {
      const age = c - born;
      if (age > 0 && age < 0.6) {
        context.globalAlpha = 1 - progress(age, 0.35, 0.6);
        heart(context, onBack[0] + offset, onBack[1] - 50 - age * 70, 0.9 * Math.min(1, age / 0.15));
        context.globalAlpha = 1;
      }
    });
  }

  // Screen-space pieces of the ending: a day and a night passing, the egg tally, the dissolve.
  // He drowned in the wine glass: a close shot of the wine, his body floating with legs curled and wings flat.
  function wineShot(context, c) {
    const local = c - 8.45;
    context.fillStyle = "#55101f";
    context.fillRect(0, 0, SIZE, SIZE);
    // The glass rim curving across the top left, with a highlight.
    context.strokeStyle = "rgba(240,248,252,0.8)";
    context.lineWidth = 26;
    context.beginPath();
    context.arc(1300, 1300, 1500, Math.PI * 1.02, Math.PI * 1.48);
    context.stroke();
    context.strokeStyle = NAVY;
    context.lineWidth = 3;
    context.stroke();
    // Ripples spreading from him, slower and slower.
    for (let ring = 0; ring < 3; ring += 1) {
      const age = (local * 0.8 + ring * 0.33) % 1;
      context.strokeStyle = `rgba(255,220,225,${0.35 * (1 - age)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(560, 560, 120 + age * 260, 90 + age * 200, 0.3, 0, Math.PI * 2);
      context.stroke();
    }
    context.save();
    context.filter = "saturate(0.5) brightness(0.85)";
    Fly.fly(context, { x: 560, y: 520, angle: 2.4 + local * 0.15, scale: 0.75, seed: 21, male: true, legsFree: [0, 0, 0], wingOpen: 0.5 });
    context.restore();
    const flash = 1 - progress(local, 0, 0.12);
    if (flash > 0) {
      context.fillStyle = `rgba(250,246,236,${0.7 * flash})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }

  function screenOverlays(context, c) {
    if (c >= 8.45 && c < 8.95) {
      wineShot(context, c);
      return;
    }
    // Weeks pass: the light flickers between day and night, quickly, while she ages.
    const weeks = progress(c, 8.0, 9.0) * (1 - progress(c, 9.0, 9.1));
    if (weeks > 0) {
      const night = 0.5 + 0.5 * Math.sin(c * Math.PI * 2 * 5);
      context.fillStyle = `rgba(24,30,70,${0.25 * night * weeks})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
    // The day counter, bottom left on the empty towel: day 1 as the eggs hatch, then racing to day 50.
    const dayShown = c >= 6.9 && c < 9.6;
    if (dayShown) {
      const day = c < 8.0 ? 1 : Math.round(lerp(1, 50, progress(c, 8.0, 9.2)));
      context.globalAlpha = Math.min(progress(c, 6.9, 7.1), 1 - progress(c, 9.4, 9.6));
      context.fillStyle = NAVY;
      context.font = "600 46px Georgia, serif";
      context.textAlign = "left";
      context.fillText(`day ${day}`, 70, 1010);
      context.globalAlpha = 1;
    }
    // A day and a night pass while she lays: the light cools to night and warms back.
    const night = Math.sin(Math.PI * progress(c, 5.6, 6.9));
    if (night > 0) {
      context.fillStyle = `rgba(24,30,70,${0.38 * night})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
    // The tally of eggs in the top corner: one mark per egg, then the count races to about fifty a day.
    const marks = c < 6.75 ? LAYS.filter((layTime) => c >= layTime).length : Math.round(lerp(3, 50, progress(c, 6.75, 7.2)));
    const tallyFade = 1 - progress(c, 7.2, 7.4);
    if (marks > 0 && tallyFade > 0) {
      context.globalAlpha = tallyFade;
      context.strokeStyle = NAVY;
      context.lineWidth = 3;
      context.lineCap = "round";
      for (let mark = 0; mark < marks; mark += 1) {
        const group = Math.floor(mark / 5);
        const within = mark % 5;
        const left = 640 + (group % 5) * 78;
        const top = 900 + Math.floor(group / 5) * 70 - Math.floor((marks - 1) / 25) * 70;
        context.beginPath();
        if (within < 4) {
          context.moveTo(left + within * 14, top);
          context.lineTo(left + within * 14 - 3, top + 46);
        } else {
          context.moveTo(left - 10, top + 36);
          context.lineTo(left + 54, top + 8);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    }
    // The push ends on the empty shells; the next beat (rebirth.js) replays her children's life and closes the loop.
    const dissolve = 0;
    if (dissolve > 0) {
      // Drawn once on its own layer: the fly's wings reset globalAlpha, so the fade is applied to the whole layer.
      if (!openingLayer) {
        openingLayer = document.createElement("canvas");
        openingLayer.width = SIZE;
        openingLayer.height = SIZE;
        const layer = openingLayer.getContext("2d");
        Fly.ground(layer);
        Fly.fly(layer, { x: START_POSE.x, y: START_POSE.y, angle: START_POSE.angle, scale: 1, seed: 21 });
      }
      context.globalAlpha = dissolve;
      context.drawImage(openingLayer, 0, 0);
      context.globalAlpha = 1;
    }
  }
  let openingLayer = null;

  function aerial(context, time) {
    const local = time - FLIGHT_START;
    const state = flightState(time);
    // The camera pushes along the spiral toward the landing point.
    const push = easeInOut(progress(local, 0, 1.5));
    const c = time - COURTSHIP_START;
    const pair = c > 0 ? courtship(c) : null;
    // During courtship the camera keeps drifting in on the pair.
    const drift = c > 0 ? easeInOut(progress(c, 0, 1.2)) : 0;
    const scale = lerp(1, 1.8, push) * lerp(1, 0.92, easeInOut(progress(c, 0, 1.5))) * lerp(1, 1.15, easeInOut(progress(c, 3.5, 5.5)));
    // Framing: the subject sits on a φ crossing of the frame with lead room on the side it faces. The ratio guides
    // the camera only; nothing of it is drawn (An: "k nên hiện mà nên dùng để làm guide").
    // Courtship faces up and right, so the pair sits at the lower-left crossing; while she lays she walks up, so she
    // sits low with the eggs trailing behind her and room above her head.
    const eggPhase = easeInOut(progress(c, 5.2, 5.8));
    const herNow = pair ? add(pair.female, unit(FEMALE.angle - 0.9), 150 * easeInOut(progress(c, 5.5, 7.0))) : LANDING;
    const subject = pair ? mix(mix(pair.male, pair.female, 0.5), add(herNow, [0, 40]), eggPhase) : LANDING;
    const anchor = mix([SIZE * 0.5, SIZE * 0.46], [SIZE * 0.5, SIZE * 0.45], eggPhase);
    const aimX = subject[0] - (anchor[0] - 540) / scale;
    const aimY = subject[1] - (anchor[1] - 540) / scale;
    const focusX = lerp(lerp(540, LANDING[0], push), aimX, drift);
    const focusY = lerp(lerp(540, LANDING[1], push), aimY, drift);
    const closing = easeInOut(progress(c, 9.25, 10.0));
    const tip = pair ? eggPlace(pair, 1) : LANDING;
    const shotScale = scale * lerp(1, 2.2, closing);
    const shotX = lerp(focusX, tip[0], closing);
    const shotY = lerp(focusY, tip[1], closing);
    // The view never leaves the drawn table: clamp the focus by half the visible width.
    const halfView = 540 / shotScale;
    const viewX = clamp(shotX, halfView, SIZE - halfView);
    const viewY = clamp(shotY, halfView, SIZE - halfView);
    context.save();
    context.translate(540, 540);
    context.scale(shotScale, shotScale);
    context.translate(-viewX, -viewY);
    aerialBackground(context);
    // The trail he has flown (the φ grid and spiral only shape the path and the camera; they are not drawn).
    context.strokeStyle = `rgba(29,31,51,${0.55 * (1 - progress(c, 0.3, 1.0))})`;
    context.lineWidth = 2;
    context.setLineDash([3, 9]);
    context.beginPath();
    context.moveTo(CORNERS[0][0], CORNERS[0][1]);
    for (let run = 0; run < state.run; run += 1) {
      context.lineTo(CORNERS[run + 1][0], CORNERS[run + 1][1]);
    }
    context.lineTo(state.x, state.y);
    context.stroke();
    context.setLineDash([]);
    // She feeds on the cut orange, head down into the vesicles.
    if (!pair) {
      Fly.fly(context, { x: FEMALE.x, y: FEMALE.y, angle: FEMALE.angle, scale: AERIAL_SCALE * 1.08, seed: 33 });
      const bob = Math.sin(time * 26) * 2 * (1 - state.landed);
      Fly.fly(context, {
        x: state.x, y: state.y + bob, angle: state.angle, scale: AERIAL_SCALE, seed: 21, male: true,
        wingBeat: state.landed < 0.6 ? 1 - state.landed : 0, wingOpen: state.landed < 1 ? 0.5 * (1 - state.landed) : 0,
        height: 50 * (1 - state.landed), legTime: time,
      });
    } else if (c >= 4.0) {
      matingAndEggs(context, c, time, pair);
    } else {
      const femaleWalk = Math.sin(Math.PI * progress(c, 0.5, 1.0));
      Fly.fly(context, {
        x: pair.female[0], y: pair.female[1], angle: pair.femaleAngle, scale: AERIAL_SCALE * 1.08, seed: 33,
        wingOpen: 0.25 * pair.femaleListen, legSwing: 0.35 * femaleWalk, legTime: (45 * progress(c, 0.5, 1.0)) / 12,
      });
      songRings(context, c, pair.wingTip);
      // A tick where his front leg touches her abdomen.
      if (pair.tap > 0.8) {
        context.strokeStyle = NAVY;
        context.lineWidth = 2;
        for (let tick = 0; tick < 5; tick += 1) {
          const turn = tick * 1.25;
          context.beginPath();
          context.moveTo(pair.tapPoint[0] + Math.cos(turn) * 14, pair.tapPoint[1] + Math.sin(turn) * 14);
          context.lineTo(pair.tapPoint[0] + Math.cos(turn) * 26, pair.tapPoint[1] + Math.sin(turn) * 26);
          context.stroke();
        }
      }
      // His legs follow the distance he walks; the tap is a reach of the front pair.
      Fly.fly(context, {
        x: pair.male[0], y: pair.male[1], angle: pair.maleAngle, scale: AERIAL_SCALE, seed: 21, male: true,
        legSwing: 0.35 * pair.moving + 0.6 * pair.tap, legTime: pair.walked / 12 + c * 2 * pair.tap,
        songSide: pair.songSide, songOpen: pair.sing, songTime: time,
      });
      cuddleHearts(context, c, pair.hearts);
    }
    context.restore();
    if (c >= 4.0) {
      screenOverlays(context, c);
    }
  }

  // ---------- The fly's view (1.0 to 2.5 s).
  // Its path over the counter in world units: away from the oranges, a saccade on each half beat, toward the sink.
  const POV_PATH = [[300, 1150], [-1300, 1150], [-1300, -500], [-2700, -800]];
  const POV_TIMES = [POV_START, 1.75, 2.25, OVERVIEW_START];
  const FOCAL = 600;
  const HORIZON = 360;

  function povState(time) {
    const leg = clamp(POV_TIMES.findIndex((start, index) => time < POV_TIMES[index + 1]), 0, POV_PATH.length - 2);
    const along = progress(time, POV_TIMES[leg], POV_TIMES[leg + 1]);
    const from = POV_PATH[leg];
    const to = POV_PATH[leg + 1];
    const heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const previous = leg > 0 ? Math.atan2(from[1] - POV_PATH[leg - 1][1], from[0] - POV_PATH[leg - 1][0]) : heading;
    let turn = heading - previous;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    // The saccade: the view snaps round in about 50 ms and banks into the turn, then levels.
    const snap = easeOut(progress(time, POV_TIMES[leg], POV_TIMES[leg] + 0.06));
    const bank = Math.sin(Math.PI * progress(time, POV_TIMES[leg] - 0.04, POV_TIMES[leg] + 0.2)) * Math.sign(turn) * 0.35;
    return {
      x: lerp(from[0], to[0], along),
      y: lerp(from[1], to[1], along),
      heading: previous + turn * snap,
      roll: leg > 0 ? bank : 0,
      // Just off the orange it climbs from 4 mm to about 15 mm above the counter.
      height: lerp(350, 1250, easeOut(progress(time, POV_START, POV_START + 0.6))) + Math.sin(time * 9) * 25,
    };
  }

  // The counter in perspective, one strip per few screen rows ("mode 7"): each row is a line on the counter at the
  // distance the row sees, drawn from the kitchen texture with its own affine transform.
  function counterInPerspective(context, state) {
    const texture = Kitchen.getTexture();
    const scaleToTexture = Kitchen.TEXTURE_SCALE;
    const forward = [Math.cos(state.heading), Math.sin(state.heading)];
    const right = [-forward[1], forward[0]];
    context.fillStyle = "#e9e2d2";
    context.fillRect(-400, HORIZON, 1880, 1300);
    for (let row = HORIZON + 2; row < 1500; row += row < HORIZON + 80 ? 2 : 3) {
      const distance = (state.height * FOCAL) / (row - HORIZON);
      const rowX = right[0] * (distance / FOCAL) * scaleToTexture;
      const rowY = right[1] * (distance / FOCAL) * scaleToTexture;
      const startWorldX = state.x + forward[0] * distance + right[0] * (-540 * distance / FOCAL);
      const startWorldY = state.y + forward[1] * distance + right[1] * (-540 * distance / FOCAL);
      const startU = (startWorldX - Kitchen.BOX.left) * scaleToTexture;
      const startV = (startWorldY - Kitchen.BOX.top) * scaleToTexture;
      const norm = rowX * rowX + rowY * rowY;
      context.save();
      context.beginPath();
      context.rect(-400, row, 1880, 3.5);
      context.clip();
      context.transform(rowX / norm, -rowY / norm, rowY / norm, rowX / norm,
        -(rowX * startU + rowY * startV) / norm, row - (-rowY * startU + rowX * startV) / norm);
      context.drawImage(texture, 0, 0);
      context.restore();
    }
    // Haze toward the far end of the counter.
    for (let band = 0; band < 10; band += 1) {
      context.fillStyle = `rgba(236,232,222,${0.09 * (10 - band) / 10 * 2})`;
      context.fillRect(-400, HORIZON + band * 8, 1880, 8);
    }
  }

  // The tiled wall above the counter, sliding with the heading; the window shows when the fly faces the wall.
  function wallInPerspective(context, state) {
    context.fillStyle = "#d6e5e8";
    context.fillRect(-400, -600, 1880, HORIZON + 600);
    const slide = state.heading * FOCAL;
    context.strokeStyle = "rgba(29,31,51,0.3)";
    context.lineWidth = 2;
    for (let line = -6; line < 30; line += 1) {
      const x = ((line * 90 - slide) % 2160 + 2160) % 2160 - 540;
      context.beginPath();
      context.moveTo(x, -600);
      context.lineTo(x, HORIZON);
      context.stroke();
    }
    for (let line = 0; line < 12; line += 1) {
      context.beginPath();
      context.moveTo(-400, HORIZON - line * 55);
      context.lineTo(1480, HORIZON - line * 55);
      context.stroke();
    }
    // The window is on the wall the counter's top edge meets (heading straight up the world, -90°).
    let facing = state.heading + Math.PI / 2;
    facing = Math.atan2(Math.sin(facing), Math.cos(facing));
    if (Math.abs(facing) < 1.2) {
      const centerX = 540 - facing * FOCAL;
      context.fillStyle = "#bfe0f2";
      context.fillRect(centerX - 210, HORIZON - 330, 420, 260);
      context.fillStyle = "rgba(255,255,255,0.6)";
      context.fillRect(centerX - 180, HORIZON - 300, 120, 200);
      context.strokeStyle = "#1d1f33";
      context.lineWidth = 6;
      context.strokeRect(centerX - 210, HORIZON - 330, 420, 260);
      context.beginPath();
      context.moveTo(centerX, HORIZON - 330);
      context.lineTo(centerX, HORIZON - 70);
      context.stroke();
    }
    context.fillStyle = "#c8b9a0";
    context.fillRect(-400, HORIZON - 10, 1880, 10);
  }

  // The edge of the view broken into hexagon facets, as a compound eye sees: clear in the middle, a mosaic outward.
  function compoundEyeMask(context) {
    const radius = 20;
    const width = radius * Math.sqrt(3);
    for (let row = -1; row < SIZE / (radius * 1.5) + 1; row += 1) {
      for (let column = -1; column < SIZE / width + 1; column += 1) {
        const x = column * width + (row % 2) * width / 2;
        const y = row * radius * 1.5;
        const reach = Math.hypot(x - 540, y - 540);
        const amount = clamp((reach - 430) / 260);
        if (amount <= 0) {
          continue;
        }
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = Math.PI / 6 + (corner * Math.PI) / 3;
          context.lineTo(x + Math.cos(turn) * radius, y + Math.sin(turn) * radius);
        }
        context.closePath();
        context.fillStyle = `rgba(120,30,40,${0.28 * amount * amount})`;
        context.fill();
        context.strokeStyle = `rgba(29,31,51,${0.45 * amount})`;
        context.lineWidth = 1.5;
        context.stroke();
      }
    }
  }

  let sceneLayer = null;

  // Each facet takes the colour at its centre of the hidden scene; a thin dark rim separates the facets.
  function facetMosaic(context, scene) {
    const pixels = scene.getContext("2d").getImageData(0, 0, SIZE, SIZE).data;
    const radius = 15;
    const width = radius * Math.sqrt(3);
    for (let row = -1; row < SIZE / (radius * 1.5) + 1; row += 1) {
      for (let column = -1; column < SIZE / width + 1; column += 1) {
        const x = column * width + (row % 2) * width / 2;
        const y = row * radius * 1.5;
        // Average seven points across the facet, as an ommatidium pools the light over its whole lens.
        const colour = [0, 0, 0];
        [[0, 0], [1, 0], [-1, 0], [0.5, 0.87], [-0.5, 0.87], [0.5, -0.87], [-0.5, -0.87]].forEach(([dx, dy]) => {
          const sampleX = clamp(Math.round(x + dx * radius * 0.55), 0, SIZE - 1);
          const sampleY = clamp(Math.round(y + dy * radius * 0.55), 0, SIZE - 1);
          const index = (sampleY * SIZE + sampleX) * 4;
          colour[0] += pixels[index] / 7;
          colour[1] += pixels[index + 1] / 7;
          colour[2] += pixels[index + 2] / 7;
        });
        const edge = clamp((Math.hypot(x - 540, y - 540) - 380) / 400);
        const shade = 1 - 0.35 * edge;
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = Math.PI / 6 + (corner * Math.PI) / 3;
          context.lineTo(x + Math.cos(turn) * radius, y + Math.sin(turn) * radius);
        }
        context.closePath();
        context.fillStyle = `rgb(${Math.round(colour[0] * shade)},${Math.round(colour[1] * shade)},${Math.round(colour[2] * shade)})`;
        context.fill();
        context.strokeStyle = "rgba(40,20,25,0.35)";
        context.lineWidth = 1.4;
        context.stroke();
        // A small glint on each facet's lens.
        context.fillStyle = "rgba(255,255,255,0.12)";
        context.beginPath();
        context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function pov(context, time) {
    const state = povState(time);
    if (!sceneLayer) {
      sceneLayer = document.createElement("canvas");
      sceneLayer.width = SIZE;
      sceneLayer.height = SIZE;
    }
    const scene = sceneLayer.getContext("2d");
    scene.save();
    scene.translate(540, 540);
    scene.rotate(state.roll);
    scene.translate(-540, -540);
    wallInPerspective(scene, state);
    counterInPerspective(scene, state);
    scene.restore();
    context.fillStyle = "#1d1f33";
    context.fillRect(0, 0, SIZE, SIZE);
    facetMosaic(context, sceneLayer);
    // A flash on the cut in.
    const flash = 1 - progress(time, POV_START, POV_START + 0.12);
    if (flash > 0) {
      context.fillStyle = `rgba(250,246,236,${0.8 * flash})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }

  // ---------- The kitchen from above (2.5 to 5.0 s).
  // A tour past the sink, the mug, the wine glass and the fruit bowl, then down to the towel where his approach to
  // the cut orange begins. One run per beat, a saccade at each corner.
  const TOUR = [[-2700, -800], [-2100, 2000], [2300, 2200], [2700, -900], [1500, -100], CORNERS[0]];

  function tourState(time) {
    const run = clamp(Math.floor((time - OVERVIEW_START) / Ink.BEAT), 0, TOUR.length - 2);
    const runStart = OVERVIEW_START + run * Ink.BEAT;
    const along = progress(time, runStart, runStart + Ink.BEAT);
    const from = TOUR[run];
    const to = TOUR[run + 1];
    const heading = headingOf(from, to);
    const previous = run > 0 ? headingOf(TOUR[run - 1], from) : heading;
    let turn = heading - previous;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const snap = progress(time, runStart, runStart + 0.05);
    return { x: lerp(from[0], to[0], along), y: lerp(from[1], to[1], along), angle: previous + turn * snap, run };
  }

  function overview(context, time) {
    const state = tourState(time);
    // Wide on the whole counter for two beats, then a zoom that follows him down and lands exactly on the aerial
    // shot's first frame (scale 1, centred on the towel square).
    const zoom = easeInOut(progress(time, 3.5, FLIGHT_START));
    const scale = 0.105 * Math.pow(1 / 0.105, zoom);
    const wideFocus = [500, 450];
    const follow = mix(wideFocus, [state.x, state.y], progress(time, 3.2, 3.8) * 0.6);
    const focus = mix(follow, [540, 540], zoom);
    context.save();
    context.translate(540, 540);
    context.scale(scale, scale);
    context.translate(-focus[0], -focus[1]);
    Kitchen.draw(context);
    aerialBackground(context);
    // The path he has flown, as a dotted trail.
    context.strokeStyle = "rgba(29,31,51,0.55)";
    context.lineWidth = 2.4 / scale;
    context.setLineDash([3 / scale, 9 / scale]);
    context.beginPath();
    context.moveTo(TOUR[0][0], TOUR[0][1]);
    for (let run = 0; run < state.run; run += 1) {
      context.lineTo(TOUR[run + 1][0], TOUR[run + 1][1]);
    }
    context.lineTo(state.x, state.y);
    context.stroke();
    context.setLineDash([]);
    Fly.fly(context, { x: FEMALE.x, y: FEMALE.y, angle: FEMALE.angle, scale: AERIAL_SCALE * 1.08, seed: 33 });
    // At the wide scale he is a speck: a ring marks him, fading as the camera comes down to him.
    const marker = 1 - zoom;
    if (marker > 0.02) {
      context.strokeStyle = `rgba(217,54,79,${0.9 * marker})`;
      context.lineWidth = 3 / scale;
      context.beginPath();
      context.arc(state.x, state.y, 28 / scale, 0, Math.PI * 2);
      context.stroke();
    }
    Fly.fly(context, {
      x: state.x, y: state.y + Math.sin(time * 26) * 2, angle: state.angle, scale: AERIAL_SCALE, seed: 21, male: true,
      wingBeat: 1, height: 50, legTime: time,
    });
    context.restore();
    const flash = 1 - progress(time, OVERVIEW_START, OVERVIEW_START + 0.12);
    if (flash > 0) {
      context.fillStyle = `rgba(250,246,236,${0.8 * flash})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }

  function renderAt(context, time) {
    Ink.setTime(time);
    if (time < POV_START) {
      takeoff(context, time);
    } else if (time < OVERVIEW_START) {
      pov(context, time);
    } else if (time < FLIGHT_START) {
      overview(context, time);
    } else {
      aerial(context, time);
    }
    Ink.finish(context, SIZE, 0.22);
  }

  return { renderAt: Ink.onBeat(renderAt), DURATION, CORNERS };
})();
