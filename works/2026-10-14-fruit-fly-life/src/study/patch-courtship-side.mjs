// He sings from her side, facing her, with the wing toward her head; after the cuddle he goes behind her new heading.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace("    const side = add(add(female, forward, -110), right, -175);", "    const side = add(add(female, forward, -30), right, -165);");
replace("      [cheek, behind, 3.6, 4.0],", "      [cheek, add(female, unit(FEMALE.angle - 0.9), -215), 3.6, 4.0],");
replace("const target = c < 3.0 ? add(female, forward, -60) : femaleHead;", "const target = c < 1.45 ? add(female, forward, -60) : c < 3.0 ? female : femaleHead;");
replace("const songSide = (female[0] - male[0]) * maleRight[0] + (female[1] - male[1]) * maleRight[1] > 0 ? 1 : -1;",
  "const songSide = (femaleHead[0] - male[0]) * maleRight[0] + (femaleHead[1] - male[1]) * maleRight[1] > 0 ? 1 : -1;");
writeFileSync(path, text);
