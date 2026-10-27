// Scaffolds a new machine folder from the Edison example, the most complete working machine: the agent
// then replaces its model, layout, figure, live hooks, facts and texts. Kit imports are rewritten so the
// folder can live anywhere.
//   node cli.mjs new machines/watt-engine --title "Watt's steam engine, 1788"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const KIT_DIR = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATE = join(KIT_DIR, "..", "examples", "edison-light-bulb");
const SOURCES = ["machine.mjs", "model.mjs", "layout.mjs", "figure.mjs", "live.js", "facts.json", "test-model.mjs", "verify-machine.mjs"];

function kitImportPath(dir) {
  const path = relative(dir, KIT_DIR).split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

export async function newCommand(dir, { title } = {}) {
  if (existsSync(join(dir, "machine.mjs"))) {
    console.log(`${dir} already holds a machine; nothing written`);
    return 1;
  }
  mkdirSync(join(dir, "reference"), { recursive: true });
  const slug = basename(dir).replace(/-anatomy$/, "");
  const kitPath = kitImportPath(dir);
  for (const name of SOURCES) {
    const source = readFileSync(join(TEMPLATE, name), "utf8").split('"../../kit/').join(`"${kitPath}/`);
    writeFileSync(join(dir, name), source);
  }
  const machineFile = join(dir, "machine.mjs");
  let machine = readFileSync(machineFile, "utf8").replace('slug: "edison-light-bulb"', `slug: "${slug}"`);
  if (title) machine = machine.replace("Edison's carbon-filament lamp, 1879–80", title);
  writeFileSync(machineFile, machine);
  writeFileSync(join(dir, "reference", "notes.md"), `# ${title ?? slug}: research notes\n\nSources read, with URLs and quotes. Every fact in facts.json points here or at its URL.\n`);
  copyFileSync(join(TEMPLATE, "..", "..", ".gitignore"), join(dir, ".gitignore"));
  console.log(`scaffolded ${dir} from the Edison example. Replace, in order: reference/notes.md, facts.json, model.mjs and test-model.mjs, layout.mjs, figure.mjs, live.js, machine.mjs (texts, pieces, film story). Then: node cli.mjs lint|test|build|audit|verify ${dir}`);
  return 0;
}
