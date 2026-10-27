// Beat 5 ending (An: "đừng cho giao phối chi tiết quá"): he climbs on her back for one beat, the camera looks away
// to a "20 min" clock, he flies off, she lays eggs one per beat while a day and a night pass, and the film closes on
// the opening frame.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}

replace("const DURATION = 6.5;", "const DURATION = 10;");
replace("// saccades, then courtship (orient, follow, tap, sing, cuddle).", "// saccades, courtship (orient, follow, tap, sing, cuddle), a discreet mating, egg laying, and back to the opening.");

// Camera: look away during the mating, then push in on her abdomen tip for the loop.
replace(`    // The view never leaves the drawn table: clamp the focus by half the visible width.`, `    const lookAway = Math.sin(Math.PI * progress(c, 4.4, 5.1));
    const closing = easeInOut(progress(c, 6.8, 7.5));
    const tip = pair ? add(pair.female, unit(FEMALE.angle - 0.9), -150) : LANDING;
    const shotScale = scale * lerp(1, 2.2, closing);
    const shotX = lerp(focusX + lookAway * 330, tip[0], closing);
    const shotY = lerp(focusY - lookAway * 120, tip[1], closing);
    // The view never leaves the drawn table: clamp the focus by half the visible width.`);
replace(`    const halfView = 540 / scale;
    const viewX = clamp(focusX, halfView, SIZE - halfView);
    const viewY = clamp(focusY, halfView, SIZE - halfView);
    context.save();
    context.translate(540, 540);
    context.scale(scale, scale);`, `    const halfView = 540 / shotScale;
    const viewX = clamp(shotX, halfView, SIZE - halfView);
    const viewY = clamp(shotY, halfView, SIZE - halfView);
    context.save();
    context.translate(540, 540);
    context.scale(shotScale, shotScale);`);

replace("    } else {\n      const femaleWalk = Math.sin(Math.PI * progress(c, 0.5, 1.0));", "    } else if (c >= 4.0) {\n      matingAndEggs(context, c, time, pair);\n    } else {\n      const femaleWalk = Math.sin(Math.PI * progress(c, 0.5, 1.0));");

// Overlays that sit on the screen, not the table: the clock, the night, the tally, and the dissolve to the opening.
replace(`    // A flash on the cut.
    const flash = 1 - progress(local, 0, 0.15);`, `    if (c >= 4.0) {
      screenOverlays(context, c);
    }
    // A flash on the cut.
    const flash = 1 - progress(local, 0, 0.15);`);

replace("  function aerial(context, time) {", `  // A fruit fly egg from above: white, long, two dorsal filaments with paddle tips (as in the opening).
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

  // c 4.0 to 7.5: he climbs on her back, he flies off, she walks on laying an egg on each beat.
  function matingAndEggs(context, c, time, pair) {
    const herAngle = FEMALE.angle - 0.9;
    const forward = unit(herAngle);
    // She walks slowly on between eggs; each egg is pushed out of her tip on a beat, abdomen dipping.
    const stroll = easeInOut(progress(c, 5.5, 7.0));
    const female = add(pair.female, forward, 70 * stroll);
    LAYS.forEach((layTime, index) => {
      const pop = progress(c, layTime, layTime + 0.18);
      if (pop <= 0) {
        return;
      }
      const overshoot = 1 + 0.25 * Math.sin(Math.PI * pop);
      const layAt = add(pair.female, forward, 70 * easeInOut(progress(layTime, 5.5, 7.0)) - 150);
      egg(context, layAt, herAngle + Math.PI / 2 + (index - 1) * 0.15, AERIAL_SCALE * 0.9 * pop * overshoot);
    });
    const dip = LAYS.reduce((most, layTime) => Math.max(most, Math.sin(Math.PI * progress(c, layTime - 0.15, layTime + 0.1))), 0);
    context.save();
    context.translate(female[0], female[1]);
    context.rotate(herAngle);
    context.scale(1 + 0.05 * dip, 1 - 0.06 * dip);
    context.rotate(-herAngle);
    context.translate(-female[0], -female[1]);
    Fly.fly(context, {
      x: female[0], y: female[1], angle: herAngle, scale: AERIAL_SCALE * 1.08, seed: 33,
      legSwing: 0.3 * Math.sin(Math.PI * stroll), legTime: (70 * stroll) / 12,
    });
    context.restore();
    // Him: a hop onto her back (one beat), then a jump off into flight, out of the frame.
    const mount = easeInOut(progress(c, 4.0, 4.4));
    const leave = easeIn(progress(c, 5.1, 5.6));
    if (leave >= 1) {
      return;
    }
    const onBack = add(pair.female, forward, -70);
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

  // Screen-space pieces of the ending: the discreet clock, a day and a night passing, the egg tally, the dissolve.
  function screenOverlays(context, c) {
    // While the camera looks away: a pocket-watch face sweeping once round, "20 min".
    const clock = Math.sin(Math.PI * progress(c, 4.45, 5.05));
    if (clock > 0) {
      const [x, y] = [800, 250];
      context.globalAlpha = clock;
      context.fillStyle = "#f6efe0";
      context.beginPath();
      context.arc(x, y, 70, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = NAVY;
      context.lineWidth = 3;
      context.stroke();
      for (let mark = 0; mark < 12; mark += 1) {
        const turn = (mark / 12) * Math.PI * 2;
        context.lineWidth = mark % 3 ? 1.5 : 3;
        context.beginPath();
        context.moveTo(x + Math.cos(turn) * 56, y + Math.sin(turn) * 56);
        context.lineTo(x + Math.cos(turn) * 64, y + Math.sin(turn) * 64);
        context.stroke();
      }
      const sweep = -Math.PI / 2 + progress(c, 4.45, 5.05) * Math.PI * 2 * (20 / 60);
      context.strokeStyle = "#d9364f";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(sweep) * 50, y + Math.sin(sweep) * 50);
      context.stroke();
      context.fillStyle = NAVY;
      context.font = "600 30px Georgia, serif";
      context.textAlign = "center";
      context.fillText("20 min", x, y + 112);
      context.globalAlpha = 1;
    }
    // A day and a night pass while she lays: the light cools to night and warms back.
    const night = Math.sin(Math.PI * progress(c, 5.6, 6.9));
    if (night > 0) {
      context.fillStyle = \`rgba(24,30,70,\${0.38 * night})\`;
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
        const top = 70 + Math.floor(group / 5) * 70;
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
    // The push on her tip dissolves into the opening frame, so the film starts again.
    const dissolve = progress(c, 7.1, 7.5);
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

  function aerial(context, time) {`);
replace("  const { lerp, clamp, progress, easeOut, easeInOut, hash } = Ink;", "  const { lerp, clamp, progress, easeOut, easeIn, easeInOut, hash } = Ink;");
writeFileSync(path, text);
