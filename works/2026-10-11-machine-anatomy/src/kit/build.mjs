// The build, lint and audit commands. Paths and names come from the machine folder and its machine.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPage, drawMachine, loadMachine } from "./page.mjs";
import { formatSuffix } from "./film.mjs";
import { lintMachine } from "./truth.mjs";

export function baseName(machine) {
  return `${machine.slug}-anatomy`;
}

export function pageFileName(machine, { film = false, format = "16:9", theme } = {}) {
  const themePart = theme && theme !== (machine.theme ?? "light") ? `-${theme}` : "";
  return `${baseName(machine)}${film ? `-film${formatSuffix(format)}` : ""}${themePart}.html`;
}

function writePage(loaded, options) {
  const built = buildPage(loaded, options);
  const file = join(loaded.dir, pageFileName(loaded.machine, options));
  writeFileSync(file, built.html);
  if (built.publish && !options.theme) {
    mkdirSync(join(loaded.dir, "publish"), { recursive: true });
    writeFileSync(join(loaded.dir, "publish", `${baseName(loaded.machine)}.html`), built.publish);
  }
  const items = built.built.items.length;
  const solids = (built.html.match(/class="iso-solid/g) ?? []).length;
  console.log(`wrote ${file} · ${built.theme} · ${built.style} · ${(built.html.length / 1024).toFixed(0)} KB · ${items} items · ${solids} static solids · scale ${built.built.projection.scale.toFixed(3)} · order cycles assembled ${built.built.measured.cycles}`);
  return built;
}

// Builds the page, its publish fragment and the film page in each requested format. Lint runs first and
// stops the build when any text is not tied to a fact.
export async function buildCommand(dir, { formats = ["16:9"], theme, style, skipLint = false } = {}) {
  const loaded = await loadMachine(dir);
  if (!skipLint) {
    const failures = await lintCommand(dir, { quiet: true });
    if (failures) {
      console.log(`build stopped: lint found ${failures} problems (node cli.mjs lint ${dir})`);
      return 1;
    }
  }
  writePage(loaded, { film: false, theme, style });
  for (const format of formats) writePage(loaded, { film: true, format, theme, style });
  return 0;
}

export async function lintCommand(dir, { quiet = false } = {}) {
  const loaded = await loadMachine(dir);
  const results = [buildPage(loaded, { film: false }), buildPage(loaded, { film: true })].map((built) => lintMachine(loaded, built));
  const problems = Array.from(new Set(results.flatMap((result) => result.problems)));
  const counts = results[0].counts;
  for (const problem of problems) console.log(`FAIL ${problem}`);
  if (!quiet || problems.length) console.log(`lint · ${counts.facts} facts · ${counts.texts} factual texts · ${counts.ui} ui and readout texts · ${counts.readoutTemplates} readout templates · ${counts.pieces} assemblies with provenance · ${counts.images} reference images · unused facts: ${counts.unusedFacts.join(", ") || "none"}`);
  console.log(problems.length ? `lint failed: ${problems.length} problems` : "lint passed");
  return problems.length;
}

// Replays the exploded view: the measured order at rest, order cycles and block pass-through in every
// frame of the springs, opening, closing and reversing at every stagger boundary.
export async function auditCommand(dir) {
  const loaded = await loadMachine(dir);
  const drawn = drawMachine(loaded, { film: false });
  const { explode, items, axes, measured, listed } = drawn;
  const result = explode.auditExplode(items, axes);
  const blocks = items.filter((item) => item.block).length;
  console.log(`order cycles assembled: ${measured.cycles}${measured.loop ? ` (${measured.loop.map((index) => listed[index].label).join(" | ")})` : ""}`);
  console.log(`depth order at rest: ${result.contradictions.length} pairs of different assemblies drawn the wrong way round`);
  result.contradictions.slice(0, 20).forEach((line) => console.log(`  ${line}`));
  console.log(`order cycles in flight: ${result.cycles} frames${result.worstCycle ? ` (last: ${result.worstCycle})` : ""}`);
  for (const [ring, count] of Array.from(result.loops).sort((first, second) => second[1] - first[1]).slice(0, 14)) console.log(`  ${count} frames · ${ring}`);
  console.log(`blocks through blocks in flight: ${result.through.size} pairs`);
  for (const [pair, worst] of result.through) console.log(`  ${pair}  ${worst.depth.toFixed(2)} deep · ${worst.where}`);
  console.log(`blocks sunk apart: ${result.sunkApart.length} pairs`);
  result.sunkApart.forEach(([pair, depth]) => console.log(`  ${pair}  ${depth.toFixed(2)} deep`));
  console.log(`explode audit · ${items.length} items · ${blocks} blocks · ${result.flights} flights · ${result.frames} frames`);
  const problems = measured.cycles + result.contradictions.length + result.cycles + result.through.size + result.sunkApart.length;
  console.log(problems ? `explode audit failed: ${problems} problems` : "explode audit passed");
  return problems ? 1 : 0;
}
