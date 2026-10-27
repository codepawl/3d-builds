// The camera settles on the pair within a beat or two so the singer stays in frame; hearts stay where the heads met.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace("const drift = c > 0 ? easeInOut(progress(c, 0, 4)) : 0;", "const drift = c > 0 ? easeInOut(progress(c, 0, 1.2)) : 0;");
replace("const scale = lerp(1, 1.8, push) * lerp(1, 1.25, drift);", "const scale = lerp(1, 1.8, push) * lerp(1, 1.1, easeInOut(progress(c, 0, 4)));");
replace("hearts: add(mix(male, femaleHead, 0.5), [0, -30]),", "hearts: add(mix(cheek, femaleHead, 0.5), [0, -30]),");
writeFileSync(path, text);
