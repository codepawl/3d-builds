// Eclosion motion learned from real-time footage (Insects Limited, Matt Lindsay): the cap lifts in nudges that grow
// before it pops; the fly pushes out in pulses with the ptilinum (a balloon on its forehead) swelling on each push and
// slipping back a little after; it rocks side to side; once the thorax is out, the front legs flail and grab.
import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 60)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

patch("src/fly.js", [
  ["  function fly(context, { x, y, angle, scale = 1, seed = 1, wingSpread = 1 }) {",
   "  function fly(context, { x, y, angle, scale = 1, seed = 1, wingSpread = 1, legSwing = 0, legTime = 0 }) {"],
  [`    [-1, 1].forEach((side) => {
      LEGS.forEach(({ hip, femur, tibia, tarsus }) => {
        const joints = [[side * hip[0], hip[1]]];
        [femur, tibia, tarsus].forEach(([segmentAngle, length]) => {
          const [lastX, lastY] = joints[joints.length - 1];
          joints.push([lastX + side * Math.cos(segmentAngle) * length, lastY + Math.sin(segmentAngle) * length]);
        });`,
   `    // legSwing makes the legs reach and grab (front pair most), the two sides out of step.
    const SWING_BY_PAIR = [0.7, 0.4, 0.25];
    [-1, 1].forEach((side) => {
      LEGS.forEach(({ hip, femur, tibia, tarsus }, pair) => {
        const swing = legSwing * SWING_BY_PAIR[pair] * Math.sin(legTime * 14 + (side > 0 ? 0 : Math.PI / 2) + pair * 1.3);
        const joints = [[side * hip[0], hip[1]]];
        [femur, tibia, tarsus].forEach(([segmentAngle, length], segment) => {
          const [lastX, lastY] = joints[joints.length - 1];
          const bent = segmentAngle + swing * (1 + segment * 0.4);
          joints.push([lastX + side * Math.cos(bent) * length, lastY + Math.sin(bent) * length]);
        });`],
]);

patch("src/metamorphosis.js", [
  ["  const DURATION = 8;", "  const DURATION = 9;"],
  // Fly drawing takes a rock angle and leg motion.
  ["  function drawFly(context, time, { x, y, spread, pale, alpha = 1, clip = null }) {\n    const layer = flyCanvas();\n    Fly.fly(layer, { x, y, angle: HEAD_DIRECTION + Math.PI / 2, scale: FLY_SCALE, seed: 31, wingSpread: spread });",
   "  function drawFly(context, time, { x, y, spread, pale, alpha = 1, clip = null, rock = 0, legSwing = 0 }) {\n    const layer = flyCanvas();\n    Fly.fly(layer, { x, y, angle: HEAD_DIRECTION + Math.PI / 2 + rock, scale: FLY_SCALE, seed: 31, wingSpread: spread, legSwing, legTime: time });"],
  // The burst only on the real pop, not on the small nudges.
  ["    if (capOpen > 0 && capOpen < 1) {", "    if (capOpen > 0.5 && capOpen < 1) {"],
  [`    const capOpen = progress(time, 5.6, 5.9);
    const climb = easeInOut(progress(time, 5.8, 6.7));
    const spread = easeInOut(progress(time, 6.7, 7.8));`,
   `    const capOpen = capLift(time);
    const { amount: climb, inflate } = emergence(time);
    const spread = easeInOut(progress(time, 6.95, 7.8));
    // Rocking is strongest halfway out; the front legs flail once the thorax is free, then settle.
    const halfway = Math.sin(Math.PI * climb);
    const rock = Math.sin(time * 18) * 0.14 * halfway;
    const legSwing = clamp((climb - 0.3) / 0.2) * (1 - progress(time, 6.9, 7.3));`],
  [`    const wiggle = Math.sin(time * 24) * 4 * (1 - progress(time, 6.4, 6.7));`,
   `    const wiggle = Math.sin(time * 18 + 1) * 7 * halfway;`],
  [`    if (stillInside) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale });
    }
    if (pupaShows > 0) {
      context.save();
      context.globalAlpha = pupaShows;`,
   `    if (stillInside) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });
      drawPtilinum(context, outX + wiggle, outY, rock, inflate);
    }
    if (pupaShows > 0) {
      context.save();
      context.globalAlpha = pupaShows;
      // Each push from inside jolts the case.
      context.translate(-DIRECTION[0] * inflate * 3, -DIRECTION[1] * inflate * 3);`],
  [`    if (climb >= 0.75) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale });
    }`,
   `    if (climb >= 0.75) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });
      if (climb < 1) {
        drawPtilinum(context, outX + wiggle, outY, rock, inflate);
      }
    }`],
  ["  // ---------- the fly ----------", `  // ---------- eclosion motion ----------

  function easeOutBack(value) {
    const overshoot = 1.7;
    return 1 + (overshoot + 1) * (value - 1) ** 3 + overshoot * (value - 1) ** 2;
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

  // ---------- the fly ----------`],
  // The last shot runs longer, so the emergence plays near real speed.
  ["    { end: 8.0, camera: [1.12, 1.0, 0.02, -20, 30], fadeCameraAt: 0.5,",
   "    { end: 9.0, camera: [1.12, 1.0, 0.02, -20, 30], fadeCameraAt: 0.5,"],
]);
