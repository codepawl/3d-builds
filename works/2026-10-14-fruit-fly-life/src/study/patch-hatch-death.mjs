// Beat 5 ending, in the real order: the eggs hatch about a day after laying and the larvae burrow into the fruit;
// weeks later the parents die (he in the wine glass, she on the orange beside the empty shells); the camera pushes
// in and the film returns to its opening frame, a fly of the next generation laying her eggs.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}

replace("const DURATION = 14;", "const DURATION = 16.5;");

// Egg places as a function, so the hatching can find them.
replace("  const LAYS = [5.75, 6.25, 6.75];", `  const LAYS = [5.75, 6.25, 6.75];
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
  }`);

// Eggs hatch: each shell opens at the front and its larva wriggles out and burrows; the shells stay.
replace(`      egg(context, layAt, herAngle + Math.PI / 2 + (index - 1) * 0.15, AERIAL_SCALE * 0.9 * pop * overshoot);
    });`, `      const eggAngle = herAngle + Math.PI / 2 + (index - 1) * 0.15;
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
        hatchling(context, layAt, eggAngle, 20 + 70 * easeInOut(hatch), progress(hatch, 0.65, 1), c);
      }
    });`);

// She ages (colour drains, a slower walk), then topples, legs curling in, and lies still beside the shells.
replace(`    context.save();
    context.translate(female[0], female[1]);
    context.rotate(herAngle);
    context.scale(1 + 0.05 * dip, 1 - 0.06 * dip);
    context.rotate(-herAngle);
    context.translate(-female[0], -female[1]);
    Fly.fly(context, {
      x: female[0], y: female[1], angle: herAngle, scale: AERIAL_SCALE * 1.08, seed: 33,
      legSwing: 0.3 * Math.sin(Math.PI * stroll), legTime: (150 * stroll) / 12,
    });
    context.restore();`, `    const age = progress(c, 8.0, 9.0);
    const fall = easeOut(progress(c, 8.95, 9.2));
    const tremble = Math.sin(c * 40) * 2 * age * (1 - fall);
    context.save();
    context.filter = \`saturate(\${1 - 0.65 * age}) brightness(\${1 - 0.2 * age})\`;
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
    context.restore();`);

// The camera: the closing push now comes after the deaths, onto the shells the larvae left.
replace("const closing = easeInOut(progress(c, 6.8, 7.5));", "const closing = easeInOut(progress(c, 9.25, 10.0));");
replace("const tip = pair ? add(pair.female, unit(FEMALE.angle - 0.9), 150 - 185) : LANDING;", "const tip = pair ? eggPlace(pair, 1) : LANDING;");
replace("const dissolve = progress(c, 7.1, 7.5);", "const dissolve = progress(c, 9.6, 10.0);");

// Screen pieces: a day counter, a fast day-night flicker while weeks pass, and the cut to the wine glass.
replace("  function screenOverlays(context, c) {", `  // He drowned in the wine glass: a close shot of the wine, his body floating with legs curled and wings flat.
  function wineShot(context, c) {
    const local = c - 8.45;
    context.fillStyle = "#6e1427";
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
      context.strokeStyle = \`rgba(255,220,225,\${0.35 * (1 - age)})\`;
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
      context.fillStyle = \`rgba(250,246,236,\${0.7 * flash})\`;
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
      context.fillStyle = \`rgba(24,30,70,\${0.25 * night * weeks})\`;
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
      context.fillText(\`day \${day}\`, 70, 1010);
      context.globalAlpha = 1;
    }`);
writeFileSync(path, text);
