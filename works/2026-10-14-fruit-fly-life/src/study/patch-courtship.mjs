// Courtship for beat 5: a male (smaller, rounded abdomen with a black tip) and the song wing (one wing held out to the
// side and vibrated, the other folded).
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/fly.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
}

replace("eyePigment = 1, wingBeat = 0, height = 0 }) {", "eyePigment = 1, wingBeat = 0, height = 0, male = false, songSide = 0, songOpen = 0, songTime = 0 }) {");
// The male's abdomen is shorter and rounder.
replace("      abdomen.push([Math.cos(turn) * 112 * pinch, 285 + Math.sin(turn) * (lower ? 185 : 165)]);",
  "      const malePinch = male && lower ? 1 - 0.25 * Math.sin(turn) ** 3 : 1;\n      abdomen.push([Math.cos(turn) * 112 * pinch / malePinch * (male ? 0.92 : 1), 285 + Math.sin(turn) * (lower ? (male ? 140 : 185) : 165)]);");
// His last segments are fused into one black cap.
replace(`    const abdomenBox = boxOf(abdomenPlaced);`, `    if (male) {
      const cap = [];
      for (let step = 0; step <= 20; step += 1) {
        const across = -130 + step * 13;
        cap.push([across, 330 - (across / 130) ** 2 * 18]);
      }
      cap.push([130, 520], [-130, 520]);
      tracePath(context, place(cap));
      context.fillStyle = "#1c0e08";
      context.fill();
    }
    const abdomenBox = boxOf(abdomenPlaced);`);
replace("      [-1, 1].forEach((side) => wing(context, place, side, seed + side, wingSpread, wingOpen));\n    }",
`      [-1, 1].forEach((side) => {
        if (side !== songSide || songOpen <= 0) {
          wing(context, place, side, seed + side, wingSpread, wingOpen);
          return;
        }
        // The song wing: swung out to about 90° and vibrating, a few faint copies around it.
        const open = songOpen * 1.5;
        [-0.12, 0.12].forEach((offset, copy) => {
          const turn = -side * (open + offset * Math.sin(songTime * 90 + copy));
          const outline = wingOutline(side).map(([pointX, pointY]) => {
            const deltaX = pointX - side * 75;
            const deltaY = pointY - 60;
            return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
          });
          tracePath(context, place(outline));
          context.strokeStyle = "rgba(60,70,110,0.3)";
          context.lineWidth = 1;
          context.stroke();
        });
        wing(context, place, side, seed + side, wingSpread, open + 0.05 * Math.sin(songTime * 120));
      });
    }`);
writeFileSync(path, text);
