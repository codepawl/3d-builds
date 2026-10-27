#!/usr/bin/env node
// machine-anatomy command line. Every command takes the machine folder (the one with machine.mjs).
//   node cli.mjs new <folder> [--title "..."]          scaffold a new machine from the template
//   node cli.mjs build <folder> [--format 16:9,9:16,square] [--theme light] [--style line]
//   node cli.mjs lint <folder>                         every visible fact tied to facts.json
//   node cli.mjs test <folder>                         the machine's model tests (test-model.mjs)
//   node cli.mjs audit <folder>                        exploded-view paint order and pass-through
//   node cli.mjs verify <folder>                       the built page in headless Chrome
//   node cli.mjs record <folder> [--format 9:16] [--style dither] [--theme light] [--no-sound]
//   node cli.mjs compare <folder> [--variant <shots folder>]   reference images beside film stills
//   node cli.mjs remux <folder> [--format ...] [--style ...]   new sound on the recorded frames
//   node cli.mjs style-sheet <folder> [--out examples/style-sheet.png]
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { KIT_NAME } from "./kit/name.mjs";

const [command, folder, ...rest] = process.argv.slice(2);

function option(name, fallback = null) {
  const at = rest.indexOf(`--${name}`);
  return at >= 0 ? rest[at + 1] : fallback;
}

const flag = (name) => rest.includes(`--${name}`);

function usage() {
  console.log(`${KIT_NAME}: node cli.mjs <new|build|lint|test|audit|verify|record|compare|remux|style-sheet> <machine folder> [options]`);
  return 1;
}

async function main() {
  if (!command || !folder) return usage();
  const dir = resolve(folder);
  const look = { theme: option("theme") ?? undefined, style: option("style") ?? undefined };
  if (command === "new") return (await import("./kit/new.mjs")).newCommand(dir, { title: option("title") });
  if (command === "build") {
    const formats = (option("format") ?? "16:9").split(",");
    return (await import("./kit/build.mjs")).buildCommand(dir, { formats, ...look, skipLint: flag("skip-lint") });
  }
  if (command === "lint") return (await import("./kit/build.mjs")).lintCommand(dir);
  if (command === "audit") return (await import("./kit/build.mjs")).auditCommand(dir);
  if (command === "test") return spawnSync(process.execPath, [join(dir, "test-model.mjs")], { stdio: "inherit" }).status;
  if (command === "verify") return (await import("./kit/verify.mjs")).verifyCommand(dir);
  if (command === "record") return (await import("./kit/record.mjs")).recordCommand(dir, { format: option("format", "16:9"), ...look, sound: !flag("no-sound"), checkOnly: flag("check") });
  if (command === "remux") return (await import("./kit/remux.mjs")).remuxCommand(dir, { format: option("format", "16:9"), ...look });
  if (command === "compare") return (await import("./kit/compare.mjs")).compareCommand(dir, { variant: option("variant") });
  if (command === "style-sheet") return (await import("./kit/style-sheet.mjs")).styleSheetCommand(dir, { out: option("out") });
  return usage();
}

process.exitCode = await main();
