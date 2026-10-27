// He sits on her abdomen, not on her head; the camera looks away to the open table; eggs spaced clear of her wings.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace("const onBack = add(pair.female, forward, -70);", "const onBack = add(pair.female, forward, -115);");
replace("const shotX = lerp(focusX + lookAway * 330, tip[0], closing);\n    const shotY = lerp(focusY - lookAway * 120, tip[1], closing);",
  "const shotX = lerp(focusX - lookAway * 300, tip[0], closing);\n    const shotY = lerp(focusY + lookAway * 260, tip[1], closing);");
replace("const female = add(pair.female, forward, 70 * stroll);", "const female = add(pair.female, forward, 150 * stroll);");
replace("const layAt = add(pair.female, forward, 70 * easeInOut(progress(layTime, 5.5, 7.0)) - 150);", "const layAt = add(pair.female, forward, 150 * easeInOut(progress(layTime, 5.5, 7.0)) - 185);");
replace("legTime: (70 * stroll) / 12,", "legTime: (150 * stroll) / 12,");
replace("const tip = pair ? add(pair.female, unit(FEMALE.angle - 0.9), -150) : LANDING;", "const tip = pair ? add(pair.female, unit(FEMALE.angle - 0.9), 150 - 185) : LANDING;");
writeFileSync(path, text);
