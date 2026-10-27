// Spacing for the courtship: he never overlaps her, sings with the wing nearer her, and the cuddle is head to head.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace(`    const behind = add(female, forward, -150);
    const side = add(add(female, forward, -60), right, -110);
    const cheek = add(add(female, forward, 20), right, -105);`,
`    // At this scale her abdomen reaches about 140 px behind her centre and his head about 40 px ahead of his.
    const behind = add(female, forward, -215);
    const side = add(add(female, forward, -110), right, -175);
    const femaleHead = add(female, unit(FEMALE.angle - 0.9), 45);
    const cheek = add(femaleHead, unit(FEMALE.angle - 0.9 - Math.PI / 2), 95);`);
replace("const target = c < 3.0 ? add(female, forward, -40) : add(female, forward, 70);", "const target = c < 3.0 ? add(female, forward, -60) : femaleHead;");
replace(`    const maleRight = [Math.cos(maleAngle), Math.sin(maleAngle)];`, `    const maleRight = [Math.cos(maleAngle), Math.sin(maleAngle)];
    const songSide = (female[0] - male[0]) * maleRight[0] + (female[1] - male[1]) * maleRight[1] > 0 ? 1 : -1;`);
replace("      wingTip: add(male, maleRight, 110),", "      songSide,\n      wingTip: add(male, maleRight, 110 * songSide),");
replace("      tapPoint: add(female, forward, -95),", "      tapPoint: add(female, forward, -150),");
replace("hearts: add(mix(male, female, 0.5), [0, -40]),", "hearts: add(mix(male, femaleHead, 0.5), [0, -30]),");
replace("songSide: 1, songOpen: pair.sing,", "songSide: pair.songSide, songOpen: pair.sing,");
writeFileSync(path, text);
