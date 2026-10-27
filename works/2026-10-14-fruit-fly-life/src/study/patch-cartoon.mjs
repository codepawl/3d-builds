// Wings that open out after emerging, the larva morphing into the case on screen, and cartoon squash and stretch.
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

patch("src/fly.js", [
  ["  function wing(context, place, side, seed, spread = 1) {",
   `  function wing(context, place, side, seed, spread = 1, open = 0) {
    // Opening swings the whole wing (veins too) outward about its hinge.
    if (open !== 0) {
      const flatPlace = place;
      const turn = -side * open;
      place = (points) => flatPlace(points.map(([pointX, pointY]) => {
        const deltaX = pointX - side * 75;
        const deltaY = pointY - 60;
        return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
      }));
    }`],
  ["wingSpread = 1, legSwing = 0, legTime = 0, legsFree = [1, 1, 1] }) {", "wingSpread = 1, wingOpen = 0, legSwing = 0, legTime = 0, legsFree = [1, 1, 1] }) {"],
  ["wing(context, place, side, seed + side, wingSpread));", "wing(context, place, side, seed + side, wingSpread, wingOpen));"],
]);

patch("src/metamorphosis.js", [
  // Fly drawing: wing opening and squash and stretch along the body.
  ["legsFree = [1, 1, 1], hideInside = false }) {", "legsFree = [1, 1, 1], hideInside = false, wingOpen = 0, stretch = 0 }) {"],
  ["wingSpread: spread, legSwing, legTime: time, legsFree });", "wingSpread: spread, wingOpen, legSwing, legTime: time, legsFree });"],
  ["    context.filter = `saturate(${lerp(1, 0.35, pale)}) brightness(${lerp(1, 1.35, pale)})`;\n    context.drawImage(flyLayer, 0, 0);",
   "    context.filter = `saturate(${lerp(1, 0.35, pale)}) brightness(${lerp(1, 1.35, pale)})`;\n    if (stretch !== 0) {\n      squashStretch(context, [x, y], HEAD_DIRECTION + rock, 1 + 0.14 * stretch, 1 - 0.09 * stretch);\n    }\n    context.drawImage(flyLayer, 0, 0);"],
  // Timing: the camera push and the loop wait for the wings.
  ["    const push = easeInOut(progress(time, 7.0, 7.9));", "    const push = easeInOut(progress(time, 7.4, 7.95));"],
  ["    const loop = progress(time, 7.75, 8.0);", "    const loop = progress(time, 7.85, 8.0);"],
  // Background reaches the orange before the morph, as the wandering larva leaves the food.
  ["    const onOrange = progress(time, 2.9, 3.3);", "    const onOrange = progress(time, 2.45, 2.6);"],
  ["    const larvaFade = 1 - progress(time, 2.9, 3.3);\n    const pupaShows = progress(time, 2.9, 3.3);",
   "    // Anticipation, then the morph with an overshoot; the finished case takes over when it lands.\n    const morph = time < 2.95 ? 0 : easeOutBackAmount(clamp((time - 2.95) / 0.35));\n    const larvaFade = time < 2.95 ? 1 : 0;\n    const pupaShows = time >= 3.3 ? 1 : 0;"],
  ["    const spread = easeInOut(progress(time, 6.95, 7.8));",
   `    // Wings: unfold and swing out with an overshoot, flutter while held, then fold back for the loop.
    const spread = easeOutBackAmount(progress(time, 6.95, 7.3));
    const opening = easeOutBackAmount(progress(time, 6.95, 7.25)) * 0.85;
    const closing = easeInOut(progress(time, 7.45, 7.65));
    const flutter = Math.sin(time * 42) * 0.07 * progress(time, 7.2, 7.25) * (1 - closing);
    const wingOpen = opening * (1 - closing) + flutter;`],
  // Squash the case with the spring; draw the morph between larva and case.
  ["      drawPupa(context, time, { seeThrough: flyInside * (1 - climb), capOpen, impact: impactAt(time) });",
   "      const wobble = springAfterHits(time);\n      squashStretch(context, along(-PUPA_HALF_LENGTH), HEAD_DIRECTION, 1 - 0.07 * wobble, 1 + 0.07 * wobble);\n      drawPupa(context, time, { seeThrough: flyInside * (1 - climb), capOpen, impact: impactAt(time) });"],
  ["    if (larvaFade > 0) {", "    if (time >= 2.95 && time < 3.3) {\n      drawMorph(context, time, morph);\n    }\n    if (larvaFade > 0) {"],
]);

// The fly's stretch on each push and its wing opening, at both places it is drawn while emerging and after.
let text = readFileSync(`${root}/src/metamorphosis.js`, "utf8");
text = text.split("spread, pale, rock, legSwing, legsFree, hideInside: true });").join("spread, pale, rock, legSwing, legsFree, hideInside: true, stretch: inflate - 0.4 * (1 - inflate) * (climb > 0 && climb < 1 ? 1 : 0) });");
text = text.split("spread, pale, rock, legSwing, legsFree, hideInside: climb < 1 });").join("spread, pale, rock, legSwing, legsFree, hideInside: climb < 1, wingOpen, stretch: climb < 1 ? inflate : -0.6 * springAfterHits(time + 0) * 0 });");
// Anticipation: the larva stretches long just before it contracts.
text = text.replace("    const shorten = easeInOut(progress(time, 2.6, 3.2));\n    return lerp(lerp(1.0, 4.0, growth), 3.0, shorten) * PIXELS_PER_MM;",
  "    const shorten = easeInOut(progress(time, 2.6, 2.95));\n    const reach = Math.sin(Math.PI * progress(time, 2.7, 2.95)) * 0.6;\n    return (lerp(lerp(1.0, 4.0, growth), 3.0, shorten) + reach) * PIXELS_PER_MM;");
text = text.replace("  // ---------- eclosion motion ----------", `  // ---------- eclosion motion ----------

  function easeOutBackAmount(value) {
    const overshoot = 1.9;
    return value <= 0 ? 0 : value >= 1 ? 1 : 1 + (overshoot + 1) * (value - 1) ** 3 + overshoot * (value - 1) ** 2;
  }`);
writeFileSync(`${root}/src/metamorphosis.js`, text);
