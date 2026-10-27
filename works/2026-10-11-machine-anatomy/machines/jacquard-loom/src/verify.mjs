// Captures every stage of one pick with the page's deterministic clock, then tiles each region's six
// stages into one sheet, and runs the line-end check at rest and with the shed open.
//   node verify.mjs light|dark [desktop|phone]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..", "..", "tools", "anatomy", "scripts");
const theme = process.argv[2] === "dark" ? "dark" : "light";
const phone = process.argv[3] === "phone";
const page = join(HERE, theme === "dark" ? "jacquard-loom-anatomy-dark.html" : "jacquard-loom-anatomy.html");
const url = `${pathToFileURL(page).href}?clock=manual&picks=8`;
const shots = join(HERE, "shots");
const parts = join(shots, "parts");
mkdirSync(parts, { recursive: true });

const PICK_SECONDS = 6.5;
const STAGES = [
  ["turn", 0.09],
  ["press", 0.275],
  ["lift", 0.465],
  ["shuttle", 0.56],
  ["beat", 0.745],
  ["fall", 0.9],
];
const REGIONS = phone
  ? [["stages", null, 1.5]]
  : [
      ["stages", null, 1],
      ["head", [150, 215, 290, 200], 3],
      ["shed", [185, 385, 290, 200], 3],
      ["cloth", [360, 440, 230, 220], 3],
    ];
const prefix = `${theme}${phone ? "-phone" : ""}`;
const tile = (region, stage) => join(parts, `${prefix}-${region}-${stage}.png`);

const actions = [["wait", 600], ["eval", `window.__loom.advance(${PICK_SECONDS * 2})`]];
if (!phone) actions.push(["lines", join(shots, `lines-${theme}-rest.png`)]);
let phase = 0;
for (const [stage, until] of STAGES) {
  actions.push(["eval", `window.__loom.advance(${(PICK_SECONDS * (until - phase)).toFixed(4)}); JSON.stringify(window.__loom.state())`]);
  phase = until;
  for (const [region, box, scale] of REGIONS) actions.push(box ? ["shot", tile(region, stage), null, scale, box] : ["shot", tile(region, stage), null, scale]);
  if (stage === "lift" && !phone) actions.push(["lines", join(shots, `lines-${theme}-lift.png`)]);
}
const actionsFile = join(parts, `${prefix}-actions.json`);
writeFileSync(actionsFile, JSON.stringify(actions));

const size = phone ? ["--width", "390", "--height", "900"] : ["--width", "1440", "--height", "1100"];
const drive = spawnSync(process.execPath, [join(SCRIPTS, "drive.mjs"), url, "--actions", actionsFile, ...size], { encoding: "utf8" });
const log = `${drive.stdout}${drive.stderr}`;
console.log(log.split("\n").filter((line) => /line ends|iso-line|console|exception|error|state|readout/i.test(line)).slice(0, 60).join("\n"));

for (const [region] of REGIONS) {
  const inputs = STAGES.flatMap(([stage]) => ["-i", tile(region, stage)]);
  const layout = "0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0";
  const out = join(shots, `${prefix}-${region}.png`);
  const made = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `xstack=inputs=6:layout=${layout}`, "-frames:v", "1", out], { encoding: "utf8" });
  console.log(made.status === 0 ? `sheet ${out}` : `sheet failed ${made.stderr}`);
}
console.log(`drive exit ${drive.status}`);
