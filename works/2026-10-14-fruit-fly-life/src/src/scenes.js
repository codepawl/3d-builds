// The life of a sea turtle in nine scenes, 30 seconds, 1080x1080. renderAt(context, time) draws one frame.
"use strict";

const Film = (() => {
  const SIZE = 1080;
  const { INK, paper, finish, inkShape, ellipsePoints, wobblyPath, hatchArea, flecks, hash, clamp, lerp, progress, easeInOut, easeOut, easeIn } = Ink;
  const { turtleTop, hatchlingSide, egg, sargassum, gull, crab, jellyfish } = Creatures;

  const BLUEPRINT = { ground: "#0c1424", line: "#a9d6e8", faint: "rgba(169,214,232,0.28)", amber: "#f2b134", coral: "#ff7a66" };
  const NIGHT_SAND = "#d8bf8f";

  // Sound cues the score is built from: [seconds, kind].
  const CUES = [];
  const cue = (time, kind) => CUES.push([Math.round(time * 1000) / 1000, kind]);

  // ---------- shared grounds ----------

  // Moonlight: a cool wash that leaves a warm pool of light where the moon falls.
  function nightWash(context, strength = 0.42, moon = [760, 180]) {
    context.save();
    context.globalCompositeOperation = "multiply";
    const gradient = context.createRadialGradient(moon[0], moon[1], 80, moon[0], moon[1], SIZE * 1.1);
    gradient.addColorStop(0, `rgba(205,200,235,${strength * 0.5})`);
    gradient.addColorStop(1, `rgba(70,85,150,${strength})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, SIZE, SIZE);
    context.restore();
  }

  function sand(context, box, { color = NIGHT_SAND, seed = 3 } = {}) {
    context.fillStyle = color;
    context.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    Ink.blotches(context, box, { colors: ["rgba(214,160,96,ALPHA)", "rgba(160,120,90,ALPHA)", "rgba(240,220,170,ALPHA)", "rgba(120,110,140,ALPHA)"], count: 22, alpha: 0.35, seed });
    // Wind ripples in the sand.
    context.save();
    context.strokeStyle = "rgba(90,66,40,0.28)";
    context.lineWidth = 1.3;
    // Broken strokes, not ruled lines: each ripple is drawn only in a few stretches.
    context.beginPath();
    for (let ripple = 0; ripple < 38; ripple += 1) {
      const rippleY = box.top + ((ripple + 0.5) / 38) * (box.bottom - box.top);
      let drawing = false;
      for (let step = 0; step <= 30; step += 1) {
        const rippleX = box.left + (step / 30) * (box.right - box.left);
        const pointY = rippleY + Math.sin(step * 0.9 + ripple * 1.7 + seed) * 7;
        const visible = hash(Math.floor(step / 3), ripple, seed) > 0.45;
        if (visible && drawing) {
          context.lineTo(rippleX, pointY);
        } else if (visible) {
          context.moveTo(rippleX, pointY);
        }
        drawing = visible;
      }
    }
    context.stroke();
    context.restore();
    flecks(context, box, { count: 1600, alpha: 0.32, length: 3, seed });
    flecks(context, box, { count: 500, alpha: 0.22, length: 7, seed: seed + 1, color: "#6a5536" });
    flecks(context, box, { count: 300, alpha: 0.5, length: 2, seed: seed + 2, color: "#fff6dc", width: 2 });
  }

  function blueprintGround(context) {
    context.fillStyle = BLUEPRINT.ground;
    context.fillRect(0, 0, SIZE, SIZE);
    context.save();
    context.strokeStyle = "rgba(169,214,232,0.06)";
    context.lineWidth = 1;
    context.beginPath();
    for (let line = 0; line <= SIZE; line += 54) {
      context.moveTo(line, 0);
      context.lineTo(line, SIZE);
      context.moveTo(0, line);
      context.lineTo(SIZE, line);
    }
    context.stroke();
    context.restore();
  }

  function label(context, text, x, y, { size = 26, color = BLUEPRINT.line, align = "left", alpha = 1 } = {}) {
    context.save();
    context.globalAlpha *= alpha;
    context.fillStyle = color;
    context.font = `${size}px Consolas, "Courier New", monospace`;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.fillText(text, x, y);
    context.restore();
  }

  function tally(context, count, x, y, { color = BLUEPRINT.line, height = 26, perRow = 30 } = {}) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / perRow);
      const inRow = index % perRow;
      const group = Math.floor(inRow / 5);
      const position = inRow % 5;
      const baseX = x + group * 44 + position * 8;
      const baseY = y + row * (height + 12);
      if (position === 4) {
        context.moveTo(baseX - 36, baseY + height * 0.8);
        context.lineTo(baseX + 4, baseY + height * 0.2);
      } else {
        context.moveTo(baseX, baseY);
        context.lineTo(baseX, baseY + height);
      }
    }
    context.stroke();
    context.restore();
  }

  function zoomInto(context, focusX, focusY, scale) {
    context.translate(SIZE / 2, SIZE / 2);
    context.scale(scale, scale);
    context.translate(-focusX, -focusY);
  }

  // ---------- scene 1: laying eggs, close on the nest ----------

  const NEST = { x: 560, y: 760 };
  function layingEggs(context, time) {
    const zoom = lerp(1.15, 2.1, easeInOut(progress(time, 1.8, 3.4)));
    context.save();
    zoomInto(context, lerp(540, NEST.x, progress(time, 1.8, 3.4)), lerp(560, NEST.y, progress(time, 1.8, 3.4)), zoom);
    paper(context, SIZE);
    sand(context, { left: -200, top: -200, right: SIZE + 200, bottom: SIZE + 200 });
    inkShape(context, ellipsePoints(NEST.x, NEST.y, 120, 74, 0.05, 30), {
      fill: "#8d7d5c", hatch: { angle: 0.8, spacing: 4, alpha: 0.5, cross: true }, seed: 71,
    });
    const eggsLaid = Math.floor(progress(time, 0.3, 3.0) * 14);
    for (let index = 0; index < eggsLaid; index += 1) {
      const turn = index * 2.4;
      const radius = 18 + (index % 5) * 14;
      egg(context, { x: NEST.x + Math.cos(turn) * radius * 1.4, y: NEST.y + 14 + Math.sin(turn) * radius * 0.7, radius: 16, seed: 80 + index });
    }
    // The egg on its way down.
    const dropPhase = (progress(time, 0.3, 3.0) * 14) % 1;
    if (time > 0.3 && time < 3.0) {
      egg(context, { x: NEST.x + 4, y: lerp(NEST.y - 120, NEST.y, easeIn(dropPhase)), radius: 16, seed: 99 });
    }
    turtleTop(context, { x: 520, y: 300, angle: -0.12, size: 760, stroke: time * 2.2, seed: 7 });
    context.restore();
    nightWash(context, 0.3);
  }

  // ---------- scene 2: the embryo, and the temperature that picks its sex ----------

  function cellLayout(count, radius) {
    const positions = [];
    for (let index = 0; index < count; index += 1) {
      const distance = radius * Math.sqrt((index + 0.5) / count);
      const turn = index * 2.39996;
      positions.push([Math.cos(turn) * distance, Math.sin(turn) * distance]);
    }
    return positions;
  }

  function embryo(context, time, { center = [470, 560], eggRadius = 300, start = 0 } = {}) {
    const [centerX, centerY] = center;
    const local = time - start;
    // Shell, ticks around it.
    const drawn = clamp(local / 0.6);
    context.strokeStyle = BLUEPRINT.line;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(centerX, centerY, eggRadius, -Math.PI / 2, -Math.PI / 2 + drawn * Math.PI * 2);
    context.stroke();
    context.strokeStyle = BLUEPRINT.faint;
    context.lineWidth = 1.5;
    context.beginPath();
    for (let tick = 0; tick < 120 * drawn; tick += 1) {
      const turn = (tick / 120) * Math.PI * 2 - Math.PI / 2;
      const inner = eggRadius + 12;
      const outer = eggRadius + (tick % 10 === 0 ? 30 : 20);
      context.moveTo(centerX + Math.cos(turn) * inner, centerY + Math.sin(turn) * inner);
      context.lineTo(centerX + Math.cos(turn) * outer, centerY + Math.sin(turn) * outer);
    }
    context.stroke();
    return { centerX, centerY, local };
  }

  function embryoScene(context, time) {
    const start = 3.4;
    blueprintGround(context);
    const { centerX, centerY, local } = embryo(context, time, { start });
    // Cells divide: 1, 2, 4 ... 128, each split sliding out of its parent.
    const division = clamp((local - 0.3) / 1.8) * 7;
    const generation = Math.floor(division);
    const split = easeOut(division - generation);
    const cellFade = 1 - progress(local, 2.1, 2.8);
    if (cellFade > 0) {
      const count = 2 ** Math.min(7, generation + 1);
      const now = cellLayout(count, 210);
      const before = cellLayout(Math.max(1, count / 2), 210);
      context.save();
      context.globalAlpha = cellFade;
      now.forEach(([x, y], index) => {
        const [parentX, parentY] = before[Math.floor(index / 2)] || [0, 0];
        const cellX = centerX + lerp(parentX, x, generation >= 7 ? 1 : split);
        const cellY = centerY + lerp(parentY, y, generation >= 7 ? 1 : split);
        const radius = Math.max(3, 38 / Math.sqrt(count));
        context.fillStyle = "rgba(169,214,232,0.18)";
        context.beginPath();
        context.arc(cellX, cellY, radius * 1.8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#e9f6fb";
        context.beginPath();
        context.arc(cellX, cellY, radius * 0.55, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    }
    // The embryo curls around its yolk.
    const grow = progress(local, 2.2, 4.4);
    if (grow > 0) {
      const yolkRadius = lerp(150, 70, grow);
      inkShape(context, ellipsePoints(centerX + 30, centerY + 20, yolkRadius, yolkRadius, 0, 30), {
        fill: "rgba(242,177,52,0.22)", line: BLUEPRINT.amber, width: 2, seed: 120,
      });
      context.strokeStyle = BLUEPRINT.line;
      context.lineWidth = 3;
      const sweep = easeOut(grow) * Math.PI * 1.35;
      context.beginPath();
      context.arc(centerX + 30, centerY + 20, yolkRadius + 40, Math.PI * 0.9, Math.PI * 0.9 + sweep);
      context.stroke();
      context.beginPath();
      context.arc(centerX + 30, centerY + 20, yolkRadius + 85 * grow, Math.PI * 0.95, Math.PI * 0.95 + sweep * 0.95);
      context.stroke();
      const headTurn = Math.PI * 0.9 + sweep;
      const headX = centerX + 30 + Math.cos(headTurn) * (yolkRadius + 62 * grow);
      const headY = centerY + 20 + Math.sin(headTurn) * (yolkRadius + 62 * grow);
      context.beginPath();
      context.arc(headX, headY, 10 + 26 * grow, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = BLUEPRINT.line;
      context.beginPath();
      context.arc(headX + 8 * grow, headY - 6 * grow, 3 + 3 * grow, 0, Math.PI * 2);
      context.fill();
      if (grow > 0.5) {
        const flipper = progress(grow, 0.5, 1);
        [0.3, 0.75].forEach((along) => {
          const turn = Math.PI * 0.9 + sweep * along;
          const rootX = centerX + 30 + Math.cos(turn) * (yolkRadius + 85 * grow);
          const rootY = centerY + 20 + Math.sin(turn) * (yolkRadius + 85 * grow);
          context.beginPath();
          context.moveTo(rootX, rootY);
          context.lineTo(rootX + Math.cos(turn) * 70 * flipper, rootY + Math.sin(turn) * 70 * flipper + 30 * flipper);
          context.stroke();
        });
      }
    }
    // The thermometer: warmer than 29 °C makes females, cooler makes males.
    const level = lerp(24, 31, easeInOut(progress(local, 0.4, 4.4)));
    const tubeX = 905;
    const toY = (degrees) => lerp(830, 250, (degrees - 23) / 11);
    context.strokeStyle = BLUEPRINT.line;
    context.lineWidth = 2.5;
    context.strokeRect(tubeX - 16, 230, 32, 610);
    context.beginPath();
    context.arc(tubeX, 870, 36, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = BLUEPRINT.coral;
    context.beginPath();
    context.arc(tubeX, 870, 26, 0, Math.PI * 2);
    context.fill();
    context.fillRect(tubeX - 8, toY(level), 16, 860 - toY(level));
    for (let degrees = 24; degrees <= 33; degrees += 1) {
      context.fillStyle = degrees === 29 ? BLUEPRINT.amber : BLUEPRINT.faint;
      context.fillRect(tubeX + 20, toY(degrees) - 1, degrees === 29 ? 46 : 18, degrees === 29 ? 3 : 2);
    }
    label(context, "29°C", tubeX + 74, toY(29), { color: BLUEPRINT.amber, size: 28 });
    const warm = progress(level, 28.6, 29.6);
    label(context, "♂", tubeX - 60, toY(26.5), { size: 44, align: "center", alpha: lerp(1, 0.25, warm) });
    label(context, "♀", tubeX - 60, toY(31.5), { size: 44, align: "center", color: BLUEPRINT.coral, alpha: lerp(0.25, 1, warm) });
    // Days in the sand.
    tally(context, Math.floor(progress(local, 0.2, 4.6) * 60), 60, 70);
  }

  // ---------- scene 3: hatching and digging up through the sand ----------

  function hatchScene(context, time) {
    const local = time - 8.2;
    paper(context, SIZE);
    const surfaceY = 230;
    // Night sky with a moon.
    context.fillStyle = "#1b2440";
    context.fillRect(0, 0, SIZE, surfaceY);
    for (let star = 0; star < 60; star += 1) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + star);
      context.fillStyle = `rgba(240,236,220,${0.3 + twinkle * 0.5})`;
      context.fillRect(hash(star, 1) * SIZE, hash(star, 2) * (surfaceY - 30), 2, 2);
    }
    inkShape(context, ellipsePoints(820, 110, 46, 46, 0, 28), { fill: "#f3ecd2", line: "#d8cfb0", width: 2, seed: 140 });
    // Sand in layers.
    sand(context, { left: 0, top: surfaceY, right: SIZE, bottom: SIZE }, { color: "#cbbb95", seed: 33 });
    context.strokeStyle = "rgba(90,70,40,0.35)";
    context.lineWidth = 1.4;
    for (let layer = 0; layer < 9; layer += 1) {
      const points = [];
      for (let step = 0; step <= 24; step += 1) {
        points.push([step * 45, surfaceY + 80 + layer * 90 + Math.sin(step * 0.7 + layer) * 10]);
      }
      wobblyPath(context, points, { wobble: 0.8, seed: 150 + layer });
      context.stroke();
    }
    wobblyPath(context, [[0, surfaceY], [SIZE, surfaceY]], { wobble: 1, seed: 160 });
    context.strokeStyle = INK;
    context.lineWidth = 2.6;
    context.stroke();
    // The chamber and its eggs.
    const chamber = { x: 540, y: 880 };
    inkShape(context, ellipsePoints(chamber.x, chamber.y, 230, 120, 0, 34), {
      fill: "#9c8a64", hatch: { angle: 0.9, spacing: 5, alpha: 0.45, cross: true }, seed: 161,
    });
    const eggSpots = [[-140, 20], [-70, -30], [0, 30], [70, -25], [140, 25], [-100, 70], [40, 75], [110, 70]];
    const hatchers = [2, 3, 1];
    eggSpots.forEach(([offsetX, offsetY], index) => {
      const order = hatchers.indexOf(index);
      const crackTime = order >= 0 ? 0.2 + order * 0.3 : 99;
      const crack = progress(local, crackTime, crackTime + 0.3);
      const gone = order >= 0 && local > crackTime + 0.55;
      if (!gone) {
        egg(context, { x: chamber.x + offsetX, y: chamber.y + offsetY, radius: 34, crack, seed: 170 + index });
      } else {
        // Broken shell halves left behind.
        inkShape(context, ellipsePoints(chamber.x + offsetX - 10, chamber.y + offsetY + 12, 26, 12, 0.3, 16), { fill: "#f1ead6", width: 1.6, seed: 190 + index });
      }
    });
    // Hatchlings climb, leaving tunnels.
    hatchers.forEach((eggIndex, order) => {
      const [offsetX, offsetY] = eggSpots[eggIndex];
      const climb = easeInOut(progress(local, 0.75 + order * 0.3, 2.85 + order * 0.08));
      if (climb <= 0) {
        return;
      }
      const startX = chamber.x + offsetX;
      const startY = chamber.y + offsetY;
      const pathAt = (amount) => [startX + Math.sin(amount * 7 + order * 2) * 26 + (order - 1) * amount * 80, lerp(startY, surfaceY - 6, amount)];
      // Loosened sand behind it: paler, grainy, edged with dots.
      context.fillStyle = "rgba(236,222,186,0.3)";
      for (let step = 0; step <= 40; step += 1) {
        const amount = (step / 40) * climb;
        const [tunnelX, tunnelY] = pathAt(amount);
        context.beginPath();
        context.arc(tunnelX, tunnelY, 24, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = "rgba(70,52,30,0.6)";
      for (let step = 0; step <= 60; step += 1) {
        const amount = (step / 60) * climb;
        const [tunnelX, tunnelY] = pathAt(amount);
        [-1, 1].forEach((side) => context.fillRect(tunnelX + side * (24 + hash(step, side) * 6), tunnelY, 2.5, 2.5));
      }
      const [hatchX, hatchY] = pathAt(climb);
      const [aheadX, aheadY] = pathAt(Math.min(1, climb + 0.02));
      hatchlingSide(context, { x: hatchX, y: hatchY, size: 80, stroke: time * 14 + order, angle: Math.atan2(aheadY - hatchY, aheadX - hatchX), seed: 200 + order });
      // Sand kicked loose.
      flecks(context, { left: hatchX - 40, top: hatchY + 10, right: hatchX + 40, bottom: hatchY + 60 }, { count: 30, alpha: 0.6, length: 4, seed: 210 + order + Math.floor(time * 8) });
    });
    nightWash(context, 0.3);
  }

  // ---------- scene 4: the run to the sea ----------

  const RUNNERS = Array.from({ length: 26 }, (unused, index) => ({
    x: 90 + hash(index, 7) * 900,
    y: -40 + hash(index, 8) * 520,
    speed: 150 + hash(index, 9) * 120,
    delay: hash(index, 10) * 0.5,
    wander: hash(index, 11) * 6,
  }));
  const CRAB_VICTIM = 6;
  const GULL_VICTIM = 15;

  function runnerAt(runner, local) {
    const moving = Math.max(0, local - runner.delay);
    const y = runner.y + moving * runner.speed;
    // They head for the moon's reflection, the brightest horizon.
    const x = lerp(runner.x, 540 + (runner.x - 540) * 0.45, clamp(moving / 3)) + Math.sin(moving * 4 + runner.wander) * 10;
    return { x, y, moving };
  }

  function runScene(context, time) {
    const local = time - 11.2;
    paper(context, SIZE);
    sand(context, { left: 0, top: 0, right: SIZE, bottom: 700 }, { seed: 41 });
    // Wet sand, then the surf line that runs in and out, then the sea.
    const surf = 760 + Math.sin(time * 1.6) * 28;
    context.fillStyle = "#a99c7c";
    context.fillRect(0, 680, SIZE, surf - 680);
    context.fillStyle = "#24445c";
    context.fillRect(0, surf, SIZE, SIZE - surf);
    hatchArea(context, { left: 0, top: surf, right: SIZE, bottom: SIZE }, { angle: 0.02, spacing: 9, color: "#9fc3d6", alpha: 0.18, seed: 44 });
    const foam = [];
    for (let step = 0; step <= 36; step += 1) {
      foam.push([step * 30, surf + Math.sin(step * 0.9 + time * 2) * 9]);
    }
    wobblyPath(context, foam, { wobble: 2, seed: 45 });
    context.strokeStyle = "#f4f1e6";
    context.lineWidth = 7;
    context.stroke();
    // Moonlight on the water.
    context.save();
    context.strokeStyle = "rgba(250,246,228,0.85)";
    context.lineWidth = 2;
    context.beginPath();
    for (let glint = 0; glint < 70; glint += 1) {
      const glintY = surf + 20 + hash(glint, 3) * (SIZE - surf - 20);
      const spread = 60 + (glintY - surf) * 0.5;
      const glintX = 540 + (hash(glint, 4, Math.floor(time * 6)) - 0.5) * spread;
      const length = 10 + hash(glint, 5) * 26;
      context.moveTo(glintX - length / 2, glintY);
      context.lineTo(glintX + length / 2, glintY);
    }
    context.stroke();
    context.restore();
    // Tracks, then the hatchlings themselves.
    const crabCatch = 1.4;
    const gullTime = 1.9;
    RUNNERS.forEach((runner, index) => {
      const { x, y, moving } = runnerAt(runner, local);
      const takenByCrab = index === CRAB_VICTIM && local > crabCatch;
      const takenByGull = index === GULL_VICTIM && local > gullTime + 0.35;
      const inSea = y > surf + 20;
      context.strokeStyle = "rgba(60,45,25,0.45)";
      context.lineWidth = 1.5;
      context.beginPath();
      for (let mark = 0; mark < moving * 9; mark += 1) {
        const back = runnerAt(runner, runner.delay + mark / 9);
        if (back.y > 700) {
          break;
        }
        const side = mark % 2 ? 1 : -1;
        context.moveTo(back.x + side * 8, back.y);
        context.lineTo(back.x + side * 13, back.y + 4);
      }
      context.stroke();
      if (takenByCrab || takenByGull || inSea) {
        return;
      }
      turtleTop(context, { x, y, angle: Math.PI + Math.sin(moving * 4 + runner.wander) * 0.2, size: 54, stroke: moving * 12, hatchling: true, seed: 300 + index });
    });
    const victim = runnerAt(RUNNERS[CRAB_VICTIM], Math.min(local, crabCatch));
    const crabX = lerp(victim.x - 260, victim.x, easeOut(progress(local, 0, crabCatch)));
    const crabY = lerp(victim.y + 40, victim.y, easeOut(progress(local, 0, crabCatch)));
    crab(context, { x: crabX - (local > crabCatch ? (local - crabCatch) * 160 : 0), y: crabY, size: 110, step: time * 16, angle: 0.2, seed: 330 });
    if (local > gullTime - 0.5 && local < gullTime + 1.4) {
      const sweep = progress(local, gullTime - 0.5, gullTime + 1.4);
      // The gull's head is local -y, so turn it to face its line of flight.
      const flight = Math.atan2(620 - 250, -200 - 1250);
      gull(context, { x: lerp(1250, -200, sweep), y: lerp(250, 620, sweep), size: 360, flap: time * 9, angle: flight + Math.PI / 2, seed: 340, shadow: true });
    }
    nightWash(context, 0.32);
    // Inset: of a thousand hatchlings, about one grows up.
    const inset = progress(local, 2.35, 2.75);
    if (inset > 0) {
      const radius = 170 * easeOut(inset);
      const insetX = 860;
      const insetY = 210;
      context.save();
      context.beginPath();
      context.arc(insetX, insetY, radius, 0, Math.PI * 2);
      context.fillStyle = BLUEPRINT.ground;
      context.fill();
      context.clip();
      const thinning = progress(local, 2.7, 3.35);
      for (let dot = 0; dot < 1000; dot += 1) {
        const column = dot % 40;
        const row = Math.floor(dot / 40);
        const survivor = dot === 517;
        const alive = survivor || hash(dot, 21) > thinning;
        if (!alive) {
          continue;
        }
        context.fillStyle = survivor && thinning > 0.5 ? BLUEPRINT.amber : BLUEPRINT.line;
        context.fillRect(insetX - 140 + column * 7, insetY - 95 + row * 7.6, survivor && thinning > 0.5 ? 6 : 3, survivor && thinning > 0.5 ? 6 : 3);
      }
      context.restore();
      context.strokeStyle = BLUEPRINT.line;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(insetX, insetY, radius, 0, Math.PI * 2);
      context.stroke();
      label(context, "1 in 1,000", insetX, insetY + 130, { align: "center", size: 26, alpha: progress(local, 2.9, 3.1) });
    }
  }

  // ---------- scene 5: the lost years in floating sargassum ----------

  const SPRIGS = Array.from({ length: 16 }, (unused, index) => ({
    x: hash(index, 51) * 1180 - 50,
    y: hash(index, 52) * 1180 - 50,
    angle: hash(index, 53) * Math.PI * 2,
    size: 200 + hash(index, 54) * 140,
  }));

  function sargassumScene(context, time) {
    const local = time - 14.6;
    const gradient = context.createLinearGradient(0, 0, 0, SIZE);
    gradient.addColorStop(0, "#3f8aa0");
    gradient.addColorStop(1, "#1f5b74");
    context.fillStyle = gradient;
    context.fillRect(0, 0, SIZE, SIZE);
    hatchArea(context, { left: 0, top: 0, right: SIZE, bottom: SIZE }, { angle: 0.15, spacing: 12, color: "#cfe9ef", alpha: 0.12, seed: 60 });
    flecks(context, { left: 0, top: 0, right: SIZE, bottom: SIZE }, { count: 160, color: "#fffbe8", alpha: 0.5, length: 9, seed: 61 + Math.floor(time * 5), width: 2 });
    const drift = local * 14;
    SPRIGS.forEach((sprig, index) => {
      sargassum(context, { x: sprig.x + drift, y: sprig.y - drift * 0.4, angle: sprig.angle + Math.sin(time * 0.6 + index) * 0.06, size: sprig.size, sway: time * 1.2, seed: 400 + index });
    });
    // A young turtle rests in the weed, growing a little.
    turtleTop(context, { x: 520 + Math.sin(local * 0.8) * 30 + drift, y: 560 - drift * 0.4, angle: 0.5 + Math.sin(local) * 0.1, size: lerp(140, 210, progress(local, 0, 3.6)), stroke: time * 3, hatchling: local < 2, seed: 450, swim: true });
    sargassum(context, { x: 470 + drift, y: 640 - drift * 0.4, angle: -0.3, size: 260, sway: time * 1.2, seed: 470 });
    Ink.finish(context, SIZE, 0.3);
  }

  // ---------- scene 6: the magnetic map that brings it home ----------

  function globeScene(context, time) {
    const local = time - 18.2;
    blueprintGround(context);
    const centerX = 540;
    const centerY = 580;
    const radius = 300;
    // Field lines of Earth's magnetic dipole: r = L sin²θ.
    const flow = time * 40;
    context.save();
    context.setLineDash([6, 10]);
    context.lineDashOffset = -flow;
    context.strokeStyle = BLUEPRINT.faint;
    context.lineWidth = 1.6;
    [1.35, 1.75, 2.4, 3.4].forEach((shell) => {
      [-1, 1].forEach((side) => {
        context.beginPath();
        for (let step = 0; step <= 120; step += 1) {
          const theta = (step / 120) * Math.PI;
          const distance = shell * radius * Math.sin(theta) ** 2;
          if (distance < radius * 0.98) {
            continue;
          }
          const pointX = centerX + side * distance * Math.sin(theta);
          const pointY = centerY - distance * Math.cos(theta);
          context.lineTo(pointX, pointY);
        }
        context.stroke();
      });
    });
    context.restore();
    // The globe: rim, latitudes, turning meridians.
    context.fillStyle = BLUEPRINT.ground;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = BLUEPRINT.line;
    context.lineWidth = 3;
    context.stroke();
    context.lineWidth = 1.2;
    context.strokeStyle = BLUEPRINT.faint;
    [-60, -30, 0, 30, 60].forEach((latitude) => {
      const radians = (latitude * Math.PI) / 180;
      context.beginPath();
      context.ellipse(centerX, centerY - Math.sin(radians) * radius, Math.cos(radians) * radius, Math.cos(radians) * radius * 0.12, 0, 0, Math.PI * 2);
      context.stroke();
    });
    for (let meridian = 0; meridian < 6; meridian += 1) {
      const longitude = (meridian / 6) * Math.PI + time * 0.25;
      context.beginPath();
      context.ellipse(centerX, centerY, Math.abs(Math.cos(longitude)) * radius, radius, 0, 0, Math.PI * 2);
      context.stroke();
    }
    label(context, "N", centerX, centerY - radius - 34, { align: "center" });
    label(context, "S", centerX, centerY + radius + 34, { align: "center" });
    // The ocean loop it rides for years, and home.
    const loopX = 470;
    const loopY = 470;
    const loopAt = (turn) => [loopX + Math.cos(turn) * 150 * Math.cos(-0.35) - Math.sin(turn) * 85 * Math.sin(-0.35), loopY + Math.cos(turn) * 150 * Math.sin(-0.35) + Math.sin(turn) * 85 * Math.cos(-0.35)];
    const travel = easeInOut(progress(local, 0.4, 3.2));
    const startTurn = Math.PI * 0.75;
    context.save();
    context.setLineDash([10, 8]);
    context.strokeStyle = "rgba(242,177,52,0.45)";
    context.lineWidth = 2.5;
    context.beginPath();
    for (let step = 0; step <= 80; step += 1) {
      const [pointX, pointY] = loopAt(startTurn + (step / 80) * Math.PI * 2);
      context.lineTo(pointX, pointY);
    }
    context.stroke();
    context.restore();
    context.strokeStyle = BLUEPRINT.amber;
    context.lineWidth = 4;
    context.beginPath();
    for (let step = 0; step <= 80 * travel; step += 1) {
      const [pointX, pointY] = loopAt(startTurn + (step / 80) * Math.PI * 2);
      context.lineTo(pointX, pointY);
    }
    context.stroke();
    const [homeX, homeY] = loopAt(startTurn);
    const [turtleX, turtleY] = loopAt(startTurn + travel * Math.PI * 2);
    context.fillStyle = BLUEPRINT.coral;
    context.beginPath();
    context.arc(homeX, homeY, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(turtleX, turtleY, 7, 0, Math.PI * 2);
    context.fill();
    const arrived = progress(local, 3.2, 3.6);
    if (arrived > 0) {
      [0, 0.33, 0.66].forEach((delay) => {
        const ring = clamp(arrived - delay * 0.5);
        context.strokeStyle = `rgba(255,122,102,${1 - ring})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(homeX, homeY, 10 + ring * 70, 0, Math.PI * 2);
        context.stroke();
      });
    }
    tally(context, Math.floor(progress(local, 0.3, 3.3) * 25), 60, 70);
    label(context, "years", 60, 140, { size: 22, alpha: 0.7 });
  }

  // ---------- scene 7: grown, in the open ocean ----------

  function oceanScene(context, time) {
    const local = time - 21.8;
    const gradient = context.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, "#2b6f8c");
    gradient.addColorStop(1, "#123d55");
    context.fillStyle = gradient;
    context.fillRect(0, 0, SIZE, SIZE);
    // Light shafts and caustics.
    context.save();
    context.globalAlpha = 0.08;
    context.fillStyle = "#e8f6ff";
    for (let shaft = 0; shaft < 5; shaft += 1) {
      const offset = shaft * 260 + Math.sin(time * 0.5 + shaft) * 40 - 200;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset + 120, 0);
      context.lineTo(offset + 520, SIZE);
      context.lineTo(offset + 360, SIZE);
      context.fill();
    }
    context.restore();
    context.save();
    context.strokeStyle = "rgba(220,245,255,0.22)";
    context.lineWidth = 1.6;
    for (let ripple = 0; ripple < 46; ripple += 1) {
      const baseY = (ripple / 46) * SIZE;
      context.beginPath();
      for (let step = 0; step <= 20; step += 1) {
        const pointX = step * 56;
        context.lineTo(pointX, baseY + Math.sin(step * 0.8 + time * 1.4 + ripple) * 12 + Math.sin(step * 2.1 - time + ripple * 2) * 5);
      }
      context.stroke();
    }
    context.restore();
    const swim = easeInOut(progress(local, 0, 3.2));
    const turtleX = lerp(200, 700, swim);
    const turtleY = lerp(880, 420, swim);
    const eaten = progress(local, 2.65, 2.9);
    if (eaten < 1) {
      context.save();
      context.globalAlpha = 1 - eaten;
      jellyfish(context, { x: 790, y: 300, size: 70 * (1 - eaten * 0.6), pulse: time * 4, seed: 500 });
      context.restore();
    }
    turtleTop(context, { x: turtleX, y: turtleY, angle: 0.82, size: lerp(440, 600, swim), stroke: time * 3.6, seed: 510, swim: true });
    Ink.finish(context, SIZE, 0.35);
  }

  // ---------- scene 8: home again, to the same beach ----------

  function returnScene(context, time) {
    const local = time - 25.0;
    const zoom = lerp(1, 2.4, easeIn(progress(local, 2.3, 3.4)));
    const crawl = easeOut(progress(local, 0, 2.1));
    const turtleY = lerp(1060, 430, crawl);
    const nestX = 540;
    const nestY = turtleY + 0.6 * 560;
    context.save();
    zoomInto(context, lerp(540, nestX, progress(local, 2.3, 3.4)), lerp(540, nestY, progress(local, 2.3, 3.4)), zoom);
    paper(context, SIZE);
    sand(context, { left: -300, top: -300, right: SIZE + 300, bottom: SIZE + 300 }, { seed: 81 });
    // The surf she came out of.
    const surf = 980 + Math.sin(time * 1.6) * 20;
    context.fillStyle = "#24445c";
    context.fillRect(-300, surf, SIZE + 600, 500);
    const foam = [];
    for (let step = 0; step <= 50; step += 1) {
      foam.push([-300 + step * 34, surf + Math.sin(step * 0.9 + time * 2) * 9]);
    }
    wobblyPath(context, foam, { wobble: 2, seed: 545 });
    context.strokeStyle = "#f4f1e6";
    context.lineWidth = 7;
    context.stroke();
    // Flipper tracks behind her.
    context.strokeStyle = "rgba(60,45,25,0.5)";
    context.lineWidth = 3;
    context.beginPath();
    for (let markY = turtleY + 300; markY < 1060; markY += 26) {
      [-1, 1].forEach((side) => {
        context.moveTo(540 + side * 170, markY);
        context.lineTo(540 + side * 120, markY + 16);
      });
    }
    context.stroke();
    const digging = progress(local, 2.1, 3.4);
    if (digging > 0) {
      inkShape(context, ellipsePoints(nestX, nestY, 90 * digging, 56 * digging, 0, 24), { fill: "#8d7d5c", hatch: { angle: 0.8, spacing: 4, alpha: 0.5 }, seed: 520 });
      flecks(context, { left: nestX - 160, top: nestY - 40, right: nestX + 160, bottom: nestY + 120 }, { count: 90, alpha: 0.7, length: 6, seed: 530 + Math.floor(time * 10), width: 2 });
    }
    turtleTop(context, { x: 540, y: turtleY, angle: 0, size: 560, stroke: crawl < 1 ? time * 4 : time * 2.4, seed: 540 });
    context.restore();
    nightWash(context, 0.32);
  }

  // ---------- scene 9: back to an egg, signed ----------

  function endScene(context, time) {
    blueprintGround(context);
    const { centerX, centerY, local } = embryo(context, time, { start: 28.4, center: [540, 540], eggRadius: 280 });
    const glow = 0.5 + 0.5 * Math.sin(time * 6);
    context.fillStyle = `rgba(169,214,232,${0.15 + glow * 0.15})`;
    context.beginPath();
    context.arc(centerX, centerY, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e9f6fb";
    context.beginPath();
    context.arc(centerX, centerY, 11, 0, Math.PI * 2);
    context.fill();
    const typed = "opus 5.5".slice(0, Math.floor(progress(local, 0.6, 1.2) * 8));
    label(context, typed, 1020, 1010, { align: "right", size: 30 });
  }

  // ---------- timeline ----------

  const SCENES = [
    { start: 0, end: 3.4, draw: layingEggs },
    { start: 3.4, end: 8.2, draw: embryoScene },
    { start: 8.2, end: 11.2, draw: hatchScene },
    { start: 11.2, end: 14.6, draw: runScene },
    { start: 14.6, end: 18.2, draw: sargassumScene },
    { start: 18.2, end: 21.8, draw: globeScene },
    { start: 21.8, end: 25.0, draw: oceanScene },
    { start: 25.0, end: 28.4, draw: returnScene },
    { start: 28.4, end: 30.0, draw: endScene },
  ];
  const DURATION = 30;

  SCENES.forEach((scene) => cue(scene.start, "cut"));
  for (let index = 0; index < 14; index += 1) {
    cue(0.3 + (index * 2.7) / 14, "egg");
  }
  for (let generation = 1; generation <= 7; generation += 1) {
    cue(3.4 + 0.3 + ((generation - 0.5) / 7) * 1.8, "divide");
  }
  cue(5.9, "embryo");
  cue(3.4 + 0.4 + 4.0 * 0.62, "warm");
  [0, 1, 2].forEach((order) => cue(8.2 + 0.2 + order * 0.3, "crack"));
  cue(11.2 + 1.4, "snap");
  cue(11.2 + 1.4, "whoosh-prep");
  cue(11.2 + 1.9, "whoosh");
  cue(11.2 + 2.35, "blip");
  for (let step = 0; step < 10; step += 1) {
    cue(18.2 + 0.4 + step * 0.28, "arp");
  }
  cue(18.2 + 3.2, "home");
  cue(21.8 + 2.65, "gulp");
  for (let step = 0; step < 5; step += 1) {
    cue(25.0 + 0.1 + step * 0.42, "step");
  }
  cue(25.0 + 2.2, "dig");
  cue(28.4 + 0.6, "sign");

  function renderAt(context, time) {
    Ink.setTime(time);
    const scene = SCENES.find((candidate) => time >= candidate.start && time < candidate.end) || SCENES[SCENES.length - 1];
    context.save();
    context.clearRect(0, 0, SIZE, SIZE);
    scene.draw(context, time);
    context.restore();
  }

  return { SIZE, DURATION, CUES: CUES.filter(([, kind]) => kind !== "whoosh-prep").sort((first, second) => first[0] - second[0]), SCENES, renderAt };
})();
