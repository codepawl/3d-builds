import { readFileSync, writeFileSync } from "node:fs";
const swapIn = (path, pairs) => {
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${path}: ${from.slice(0, 60)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
};
const root = process.argv[2];
swapIn(`${root}/src/fly.js`, [
  ["  function frame(context) {\n    background(context);\n    orange(context, 820, 1180, 860);\n    ruler(context);\n    droplet(context, 262, 772);\n",
   "  // The opening scene without the fly: paper, the orange, the ruler, the droplet.\n  function ground(context) {\n    background(context);\n    orange(context, 820, 1180, 860);\n    ruler(context);\n    droplet(context, 262, 772);\n  }\n\n  function frame(context) {\n    ground(context);\n"],
  ["  return { frame, fly };", "  return { frame, fly, ground };"],
]);
swapIn(`${root}/src/metamorphosis.js`, [
  // Background: fruit flesh while the larva feeds, the orange of the opening once it pupates.
  [`    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);`, `    // The closing push: the camera moves in on the fly and turns it into the opening frame's pose.
    const push = easeInOut(progress(time, 7.0, 7.9));
    const flyEndX = CENTER[0] + DIRECTION[0] * (PUPA_HALF_LENGTH * 0.25 + 2.4 * PUPA_HALF_LENGTH);
    const flyEndY = CENTER[1] + DIRECTION[1] * (PUPA_HALF_LENGTH * 0.25 + 2.4 * PUPA_HALF_LENGTH);
    context.save();
    if (push > 0) {
      context.translate(lerp(flyEndX, 495, push), lerp(flyEndY, 385, push));
      context.rotate((-0.41 - (HEAD_DIRECTION + Math.PI / 2)) * push);
      context.scale(lerp(1, 1 / FLY_SCALE, push), lerp(1, 1 / FLY_SCALE, push));
      context.translate(-flyEndX, -flyEndY);
    }
    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);
    const onOrange = progress(time, 2.9, 3.3);
    if (onOrange > 0) {
      context.save();
      context.globalAlpha = onOrange;
      Fly.ground(context);
      context.restore();
    }`],
  [`    Ink.finish(context, SIZE, 0.25);
    // Scale bar, 1 mm.`, `    context.restore();
    // Dissolve into the opening frame, so the film loops.
    const loop = progress(time, 7.75, 8.0);
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
    // Scale bar, 1 mm.`],
]);
