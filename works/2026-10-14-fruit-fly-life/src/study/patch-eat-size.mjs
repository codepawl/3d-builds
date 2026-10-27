import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    }
    text = text.split(from).join(to);
  }
  writeFileSync(path, text);
}

patch("src/larva.js", [
  ['    label(context, "segments", 860, 230,', '    label(context, "segments", 70, 110,'],
  ['    label(context, "trachea", 860, 265,', '    label(context, "trachea", 70, 145,'],
  ['    label(context, "mouth hooks", 860, 300,', '    label(context, "mouth hooks", 70, 180,'],
]);

patch("src/metamorphosis.js", [
  // The head plunges into the food on each beat: a quick thrust, then it pulls back while raking.
  ["    const rake = time < 2.5 ? Math.max(0, Math.sin(time * 4 * Math.PI)) * 22 : 0;",
   "    const beatPhase = (time / Ink.BEAT) % 1;\n    const rake = time < 2.5 ? (beatPhase < 0.25 ? easeOut(beatPhase / 0.25) : 1 - easeInOut((beatPhase - 0.25) / 0.75)) * 34 : 0;"],
  // The developing fly fills the case, centred on its body.
  ["    const FLY_SIZE = 0.62;", "    const FLY_SIZE = 0.95;"],
  ["      center[0] + (localX * Math.cos(FLY_ANGLE) - localY * Math.sin(FLY_ANGLE)) * FLY_SIZE,\n      center[1] + (localX * Math.sin(FLY_ANGLE) + localY * Math.cos(FLY_ANGLE)) * FLY_SIZE,\n    ];\n    const ellipseIn",
   "      center[0] + (localX * Math.cos(FLY_ANGLE) - (localY - 135) * Math.sin(FLY_ANGLE)) * FLY_SIZE,\n      center[1] + (localX * Math.sin(FLY_ANGLE) + (localY - 135) * Math.cos(FLY_ANGLE)) * FLY_SIZE,\n    ];\n    const ellipseIn"],
  // Segment lines and bands are clipped to the body they belong to.
  [`      const tube = ellipseIn([0, 120], 95, 400);
      trace(context, tube);
      context.stroke();
      for (let segment = 1; segment < 12; segment += 1) {`,
   `      const tube = ellipseIn([0, 135], 95, 340);
      trace(context, tube);
      context.stroke();
      context.save();
      trace(context, tube);
      context.clip();
      for (let segment = 1; segment < 12; segment += 1) {`],
  ["        const y = -280 + segment * 66.7;\n        trace(context, [flyPoint([-90, y]), flyPoint([0, y + 12]), flyPoint([90, y])], false);\n        context.stroke();\n      }",
   "        const y = -205 + segment * 56.7;\n        trace(context, [flyPoint([-100, y]), flyPoint([0, y + 12]), flyPoint([100, y])], false);\n        context.stroke();\n      }\n      context.restore();"],
  [`      if (index === 2) {
        for (let band = 1; band < 6; band += 1) {`,
   `      if (index === 2) {
        context.save();
        trace(context, shape);
        context.clip();
        for (let band = 1; band < 6; band += 1) {`],
  ["          trace(context, [flyPoint([-95, y]), flyPoint([0, y + 10]), flyPoint([95, y])], false);\n          context.stroke();\n        }\n      }",
   "          trace(context, [flyPoint([-130, y]), flyPoint([0, y + 10]), flyPoint([130, y])], false);\n          context.stroke();\n        }\n        context.restore();\n      }"],
]);
