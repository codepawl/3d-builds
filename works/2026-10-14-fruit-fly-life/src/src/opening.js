// Beat 1, 2 s: the opening frame comes alive. The fly stands on the orange, the camera pushes toward its abdomen,
// she lays an egg on the beat, and the camera punches in on the egg (the next beat is the egg as a blueprint).
"use strict";

const Opening = (() => {
  const { lerp, clamp, progress, easeOut, easeInOut } = Ink;
  const SIZE = 1080;
  const DURATION = 2;
  const FLY = { x: 495, y: 385, angle: -0.41 };

  function toScreen([localX, localY]) {
    return [
      FLY.x + localX * Math.cos(FLY.angle) - localY * Math.sin(FLY.angle),
      FLY.y + localX * Math.sin(FLY.angle) + localY * Math.cos(FLY.angle),
    ];
  }

  // A fruit fly egg seen from above: white, long, two dorsal filaments with paddle tips.
  function egg(context, [x, y], angle, size) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(size, size);
    [-1, 1].forEach((side) => {
      context.strokeStyle = "#1d1f33";
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
    context.strokeStyle = "#1d1f33";
    context.lineWidth = 2.2;
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.beginPath();
    context.ellipse(-10, -4, 12, 3, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function renderAt(context, time) {
    Ink.setTime(time);
    const tip = toScreen([0, 500]);
    const eggPlace = toScreen([20, 660]);
    // Slow push toward the abdomen, then a punch in on the egg.
    const push = easeInOut(progress(time, 0, 1.5));
    const punch = easeOut(progress(time, 1.5, 2.0));
    const focusX = lerp(lerp(540, tip[0], push), eggPlace[0], punch);
    const focusY = lerp(lerp(540, tip[1], push), eggPlace[1], punch);
    const scale = lerp(1, 1.6, push) * lerp(1, 4.5, punch);
    context.save();
    context.translate(540, 540);
    context.scale(scale, scale);
    context.translate(-focusX, -focusY);
    Fly.ground(context);
    // Zooming in, the orange's surface resolves into the juicy cells the egg hatches on.
    const resolve = progress(time, 1.55, 1.85);
    if (resolve > 0) {
      context.save();
      context.globalAlpha = resolve;
      context.translate(eggPlace[0], eggPlace[1]);
      context.scale(0.25, 0.25);
      context.translate(-540, -540);
      Larva.fruitFlesh(context);
      context.restore();
    }
    // The egg slides out of the ovipositor on the beat at 1.0 s.
    const lay = easeOut(progress(time, 0.95, 1.25));
    if (lay > 0) {
      const [startX, startY] = tip;
      egg(context, [lerp(startX, eggPlace[0], lay), lerp(startY, eggPlace[1], lay)], FLY.angle + Math.PI / 2, lerp(0.5, 1, lay));
    }
    // The abdomen dips to lay, and the legs shift a little.
    const dip = Math.sin(Math.PI * progress(time, 0.75, 1.25));
    Fly.fly(context, { x: FLY.x - Math.sin(FLY.angle) * dip * 6, y: FLY.y + Math.cos(FLY.angle) * dip * 6, angle: FLY.angle, scale: 1, seed: 21, legSwing: 0.08 * dip, legTime: time });
    context.restore();
    // White flash into the blueprint.
    const flash = progress(time, 1.85, 2.0);
    if (flash > 0) {
      context.fillStyle = `rgba(13,19,34,${flash})`;
      context.fillRect(0, 0, SIZE, SIZE);
    }
    Ink.finish(context, SIZE, 0.25 * (1 - flash));
  }

  return { renderAt: Ink.onBeat(renderAt), DURATION };
})();
