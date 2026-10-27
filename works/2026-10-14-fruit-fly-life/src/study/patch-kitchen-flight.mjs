// Beat 5: after the takeoff, the fly's own view as it flies over the kitchen counter (1.0 to 2.5 s), then the whole
// kitchen from above as it tours the sink, the mug, the wine glass and the fruit bowl, zooming down without a cut onto
// the cut orange where the female feeds (2.5 to 5.0 s). Everything after shifts by 4 s.
import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
const path = `${root}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}

replace("const DURATION = 10;", "const DURATION = 14;");
replace("  const FLIGHT_START = 1.0;", `  const POV_START = 1.0;
  const OVERVIEW_START = 2.5;
  const FLIGHT_START = 5.0;`);
// The approach over the towel now continues the overview's zoom, so no flash on it.
replace(`    // A flash on the cut.
    const flash = 1 - progress(local, 0, 0.15);
    if (flash > 0) {
      context.fillStyle = \`rgba(250,246,236,\${0.8 * flash})\`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }`, "  }");

replace("  function renderAt(context, time) {", `  // ---------- The fly's view (1.0 to 2.5 s).
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
      context.fillStyle = \`rgba(236,232,222,\${0.09 * (10 - band) / 10 * 2})\`;
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
        const amount = clamp((reach - 360) / 260);
        if (amount <= 0) {
          continue;
        }
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = Math.PI / 6 + (corner * Math.PI) / 3;
          context.lineTo(x + Math.cos(turn) * radius, y + Math.sin(turn) * radius);
        }
        context.closePath();
        context.fillStyle = \`rgba(120,30,40,\${0.55 * amount * amount})\`;
        context.fill();
        context.strokeStyle = \`rgba(29,31,51,\${0.6 * amount})\`;
        context.lineWidth = 1.5;
        context.stroke();
      }
    }
  }

  function pov(context, time) {
    const state = povState(time);
    context.save();
    context.translate(540, 540);
    context.rotate(state.roll);
    context.translate(-540, -540);
    wallInPerspective(context, state);
    counterInPerspective(context, state);
    context.restore();
    compoundEyeMask(context);
    // A flash on the cut in.
    const flash = 1 - progress(time, POV_START, POV_START + 0.12);
    if (flash > 0) {
      context.fillStyle = \`rgba(250,246,236,\${0.8 * flash})\`;
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
      context.strokeStyle = \`rgba(217,54,79,\${0.9 * marker})\`;
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
      context.fillStyle = \`rgba(250,246,236,\${0.8 * flash})\`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }

  function renderAt(context, time) {`);
replace(`    if (time < FLIGHT_START) {
      takeoff(context, time);
    } else {`, `    if (time < POV_START) {
      takeoff(context, time);
    } else if (time < OVERVIEW_START) {
      pov(context, time);
    } else if (time < FLIGHT_START) {
      overview(context, time);
    } else {`);
writeFileSync(path, text);

const page = `${root}/study/adult.html`;
let html = readFileSync(page, "utf8");
if (!html.includes("kitchen.js")) {
  html = html.replace('<script src="../src/adult.js"></script>', '<script src="../src/kitchen.js"></script>\n<script src="../src/adult.js"></script>');
  writeFileSync(page, html);
}
