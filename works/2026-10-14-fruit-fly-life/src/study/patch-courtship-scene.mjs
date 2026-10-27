// Beat 5: a quicker flight (An: "bay hơi lâu") and the courtship after landing: orient, follow, tap, sing, cuddle.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}

replace("// Beat 5, the adult's life. Piece 1 (4 s): takeoff from the opening's orange, then an aerial shot where he flies to a\n// cut orange in saccades.",
  "// Beat 5, the adult's life (6.5 s): takeoff from the opening's orange, a quick aerial flight to a cut orange in\n// saccades, then courtship (orient, follow, tap, sing, cuddle).");
replace("const DURATION = 4;", "const DURATION = 6.5;");
replace("const FEMALE = { x: SIZE * 0.618 + 75, y: SIZE * 0.382 - 60, angle: -2.2 };", "const FEMALE = { x: SIZE * 0.618 + 75, y: SIZE * 0.382 - 60, angle: 0.94 };");
replace("  const FLIGHT_START = 1.0;", "  const FLIGHT_START = 1.0;\n  // A run per half beat, so he lands at 2.5 s and the time goes to the courtship.\n  const RUN_TIME = Ink.BEAT / 2;\n  const COURTSHIP_START = FLIGHT_START + RUNS * RUN_TIME;");
replace("  // The flight (1 to 4 s): one run per beat, a 50 ms saccade at each corner, the last run a landing.", "  // The flight (1 to 2.5 s): one run per half beat, a 50 ms saccade at each corner, the last run a landing.");
replace("const run = clamp(Math.floor((time - FLIGHT_START) / Ink.BEAT), 0, RUNS - 1);\n    const runStart = FLIGHT_START + run * Ink.BEAT;\n    const along = progress(time, runStart, runStart + Ink.BEAT);",
  "const run = clamp(Math.floor((time - FLIGHT_START) / RUN_TIME), 0, RUNS - 1);\n    const runStart = FLIGHT_START + run * RUN_TIME;\n    const along = progress(time, runStart, runStart + RUN_TIME);");
replace("progress(time, runStart + 0.05, runStart + 0.15)) * 0.12;", "progress(time, runStart + 0.05, runStart + 0.12)) * 0.12;");
replace("landed: run === RUNS - 1 ? progress(time, runStart + 0.22, runStart + 0.36) : 0,", "landed: run === RUNS - 1 ? progress(time, runStart + 0.12, runStart + RUN_TIME) : 0,");

replace("  function aerial(context, time) {", `  const unit = (angle) => [Math.sin(angle), -Math.cos(angle)];
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
    const behind = add(female, forward, -150);
    const side = add(add(female, forward, -60), right, -110);
    const cheek = add(add(female, forward, 20), right, -105);
    const walks = [
      [LANDING, behind, 0.5, 1.05],
      [behind, side, 1.45, 1.75],
      [side, cheek, 3.0, 3.3],
      [cheek, behind, 3.6, 4.0],
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
    const target = c < 3.0 ? add(female, forward, -40) : add(female, forward, 70);
    const orient = easeOut(progress(c, 0, 0.35));
    const maleAngle = lerp(0, headingOf(male, target), orient);
    const tap = c >= 1.0 && c < 1.45 ? Math.max(0, Math.sin(Math.PI * (((c - 1.0) / 0.225) % 1))) : 0;
    const sing = easeOut(progress(c, 1.75, 1.95)) * (1 - progress(c, 2.9, 3.0));
    // The song wing is his right wing: its tip sits out to his right side.
    const maleRight = [Math.cos(maleAngle), Math.sin(maleAngle)];
    return {
      female,
      femaleAngle: FEMALE.angle + femaleTurn,
      femaleListen: progress(c, 1.9, 2.2) * (1 - progress(c, 3.4, 3.6)),
      male, maleAngle, walked, moving, tap, sing,
      tapPoint: add(female, forward, -95),
      wingTip: add(male, maleRight, 110),
      hearts: add(mix(male, female, 0.5), [0, -40]),
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
        context.strokeStyle = pulse % 2 ? \`rgba(228,90,200,\${1 - age})\` : \`rgba(240,170,40,\${1 - age})\`;
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

  function aerial(context, time) {`);
replace(`    const push = easeInOut(progress(local, 0, 3));
    const scale = lerp(1, 1.8, push);
    const focusX = lerp(540, LANDING[0], push);
    const focusY = lerp(540, LANDING[1], push);`, `    const push = easeInOut(progress(local, 0, 1.5));
    const c = time - COURTSHIP_START;
    const pair = c > 0 ? courtship(c) : null;
    // During courtship the camera keeps drifting in on the pair.
    const drift = c > 0 ? easeInOut(progress(c, 0, 4)) : 0;
    const pairCenter = pair ? mix(pair.male, pair.female, 0.5) : LANDING;
    const scale = lerp(1, 1.8, push) * lerp(1, 1.25, drift);
    const focusX = lerp(lerp(540, LANDING[0], push), pairCenter[0], drift);
    const focusY = lerp(lerp(540, LANDING[1], push), pairCenter[1], drift);`);
replace("goldenSpiral(context, progress(local, 0, 3), guide);", "goldenSpiral(context, progress(local, 0, 1.5), guide * (1 - progress(c, 0.5, 1.5)));");
replace(`    context.strokeStyle = "rgba(29,31,51,0.55)";
    context.lineWidth = 2;
    context.setLineDash([3, 9]);`, `    context.strokeStyle = \`rgba(29,31,51,\${0.55 * (1 - progress(c, 0.3, 1.0))})\`;
    context.lineWidth = 2;
    context.setLineDash([3, 9]);`);
replace(`    Fly.fly(context, { x: FEMALE.x, y: FEMALE.y, angle: FEMALE.angle, scale: AERIAL_SCALE * 1.08, seed: 33 });
    const bob = Math.sin(time * 26) * 2 * (1 - state.landed);
    Fly.fly(context, {
      x: state.x, y: state.y + bob, angle: state.angle, scale: AERIAL_SCALE, seed: 21,
      wingBeat: state.landed < 0.6 ? 1 - state.landed : 0, wingOpen: state.landed < 1 ? 0.5 * (1 - state.landed) : 0,
      height: 50 * (1 - state.landed), legTime: time,
    });`, `    if (!pair) {
      Fly.fly(context, { x: FEMALE.x, y: FEMALE.y, angle: FEMALE.angle, scale: AERIAL_SCALE * 1.08, seed: 33 });
      const bob = Math.sin(time * 26) * 2 * (1 - state.landed);
      Fly.fly(context, {
        x: state.x, y: state.y + bob, angle: state.angle, scale: AERIAL_SCALE, seed: 21, male: true,
        wingBeat: state.landed < 0.6 ? 1 - state.landed : 0, wingOpen: state.landed < 1 ? 0.5 * (1 - state.landed) : 0,
        height: 50 * (1 - state.landed), legTime: time,
      });
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
        songSide: 1, songOpen: pair.sing, songTime: time,
      });
      cuddleHearts(context, c, pair.hearts);
    }`);
writeFileSync(path, text);
