import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

// The lineage tree and labels move to the empty top left, off the egg.
patch("src/embryo.js", [
  ["    const centerX = 880;", "    const centerX = 220;"],
  ["    label(context, `cycle ${cycle}`, 880, 240, { size: 28, align: \"center\" });", "    label(context, `cycle ${cycle}`, 220, 240, { size: 28, align: \"center\" });"],
  ["    label(context, \"eve\", 840, 280,", "    label(context, \"eve\", 180, 280,"],
  ["    label(context, \"en\", 910, 280,", "    label(context, \"en\", 250, 280,"],
]);

patch("src/metamorphosis.js", [
  // Eating: a lunge and rake on every beat, and the yeast pulled in cell by cell.
  ["    const rake = time < 2.6 ? Math.sin(time * 9) * 10 : 0;", "    const rake = time < 2.5 ? Math.max(0, Math.sin(time * 4 * Math.PI)) * 22 : 0;"],
  [`    context.save();
    context.globalAlpha = 1 - progress(time, 0.3, 2.6);
    const [yeastX, yeastY] = along(PUPA_HALF_LENGTH + 120);
    Larva.yeastCluster(context, yeastX, yeastY, time);
    context.restore();`, "    eatenYeast(context, time);"],
  // Shots: the instar card replaces the dish and the end-on view.
  ["    { end: 2.0, camera: [1.05, 1.2, 0.12, 0, 0], draw: (context, local) => dish(context, local) },\n    { end: 2.5, camera: [1.05, 1.25, -0.08, 30, 30], draw: (context, local) => endOn(context, local) },",
   "    { end: 2.5, camera: [1.0, 1.08, 0.02, 0, 0], draw: (context, local) => instars(context, local) },"],
]);
