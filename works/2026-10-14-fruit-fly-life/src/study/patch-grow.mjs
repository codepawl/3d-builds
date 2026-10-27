// The fly grows out of its imaginal discs instead of fading in, over a longer blueprint shot (2.5 s, five beats).
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/metamorphosis.js`;
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};

// Timing in seconds of the shot (0 to 2.5).
swap("    const flash = 1 - progress(local, 0, 0.2);", "    const flash = 1 - progress(local, 0, 0.3);");
swap("    const breakdown = easeInOut(progress(local, 0.15, 0.7));", "    const breakdown = easeInOut(progress(local, 0.2, 1.0));");
swap("    const gather = easeInOut(progress(local, 0.5, 1.1));", "    const gather = easeInOut(progress(local, 0.7, 1.5));");
swap("    const grow = easeOut(progress(local, 0.55, 1.2));", "    const grow = easeOut(progress(local, 0.9, 1.5));");
swap("    const form = progress(local, 0.95, 1.4);", "    const form = progress(local, 1.4, 2.4);");
swap("        const unfold = progress(local, 1.0, 1.3);", "        const unfold = progress(local, 1.5, 2.1);");
swap("    context.fillText(`day ${5 + Math.floor((local / 1.4) * 4)}`, 820, 120);", "    context.fillText(`day ${5 + Math.floor((local / 2.5) * 4)}`, 820, 120);");
swap(`      context.globalAlpha = form * 0.8;
      context.globalCompositeOperation = "screen";
      context.filter = "grayscale(1) invert(1) brightness(0.8) sepia(1) hue-rotate(160deg) saturate(2)";
      context.drawImage(flyLayer, 0, 0);`,
`      // Each organ grows out of its own disc: a reveal that spreads from the disc, eyes first, then legs, then
      // wings; the thorax and abdomen fill in from the middle last. Staggered on the beat.
      const START = { eye: 1.4, leg: 1.6, wing: 1.8 };
      context.save();
      context.beginPath();
      DISCS.forEach((disc) => {
        const reach = easeOut(progress(local, START[disc.name], START[disc.name] + 0.5));
        if (reach > 0) {
          const [discX, discY] = flyPoint(disc.local);
          context.moveTo(discX + reach * 130, discY);
          context.arc(discX, discY, reach * 130, 0, Math.PI * 2);
        }
      });
      const body = easeOut(progress(local, 1.9, 2.4));
      if (body > 0) {
        const [bodyX, bodyY] = flyPoint([0, 120]);
        context.moveTo(bodyX + body * 260, bodyY);
        context.ellipse(bodyX, bodyY, body * 260, body * 260, 0, 0, Math.PI * 2);
      }
      context.clip();
      context.globalAlpha = 0.85;
      context.globalCompositeOperation = "screen";
      context.filter = "grayscale(1) invert(1) brightness(0.8) sepia(1) hue-rotate(160deg) saturate(2)";
      context.drawImage(flyLayer, 0, 0);
      context.restore();`);
// Longer blueprint shot; everything after it moves back one second.
swap("    { end: 5.0, camera: [0.95, 1.2, 0.05, 0, 20], draw: (context, local) => blueprintPupa(context, local * 1.4) },",
     "    { end: 6.0, camera: [0.95, 1.15, 0.04, 0, 20], draw: (context, local) => blueprintPupa(context, local * 2.5) },");
swap("    { end: 9.0, camera:", "    { end: 10.0, camera:");
swap("  const DURATION = 9;", "  const DURATION = 10;");
writeFileSync(path, text);
