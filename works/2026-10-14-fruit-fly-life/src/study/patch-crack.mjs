import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const from = "    if (capOpen > 0) {\n      drawOpening(context, time, capOpen, outline);\n    }";
if (!text.includes(from)) {
  throw new Error("opening call not found");
}
text = text.replace(from, `    // The nudges only crack the case along the cap's seam; the cap opens on the real pop.
    if (time < 5.82 && capOpen > 0) {
      drawCrack(context, Math.min(1, capOpen / 0.38));
    } else if (time >= 5.82) {
      drawOpening(context, time, capOpen, outline);
    }`);
text = text.replace("  // The torn opening:", `  function drawCrack(context, strength) {
    const opening = PUPA_HALF_LENGTH * 0.62;
    const crack = [];
    const reach = lerp(0.3, 1, strength);
    for (let step = 0; step <= 16; step += 1) {
      const across = lerp(-PUPA_HALF_WIDTH, PUPA_HALF_WIDTH, step / 16) * reach;
      crack.push(along(opening + (step % 2 ? 6 : -4) * strength, across));
    }
    trace(context, crack, false);
    context.strokeStyle = "#120804";
    context.lineWidth = 1.2 + strength * 2;
    context.stroke();
  }

  // The torn opening:`);
writeFileSync(path, text);
