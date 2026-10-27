// Truth control. Every visible text that states a fact names ids in facts.json; every fact has a source
// and a status; superlatives need verified facts; every drawn assembly says how it was drawn. `lint`
// fails the build on any break, and on visible page text that never went through the text registry.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lintFunctions } from "./causality.mjs";

const STATUSES = ["verified", "inferred"];
const PROVENANCE = ["sourced", "inferred", "simplified"];
const SUPERLATIVE = /\b(first|fastest|only|earliest|oldest|largest|biggest|smallest|best|unique|never before|invented)\b/i;
const URL = /^https?:\/\/\S+$/;
const IMAGE = /\.(jpe?g|png|webp|gif|svg)$/i;
const LEAST_IMAGES = 3;

function checkFact(id, fact, machineDir, problems) {
  if (!fact.text) problems.push(`fact "${id}" has no text`);
  if (!STATUSES.includes(fact.status)) problems.push(`fact "${id}" has status "${fact.status}", wanted verified or inferred`);
  const source = fact.source ?? "";
  const localSource = source && !URL.test(source) && existsSync(join(machineDir, source.split("#")[0]));
  if (!URL.test(source) && !localSource) problems.push(`fact "${id}" has no source (a URL, or a file in the machine folder)`);
  if (fact.status === "verified" && !fact.quote) problems.push(`fact "${id}" is verified but quotes nothing from its source`);
  if (fact.status === "inferred" && !fact.note && !fact.quote) problems.push(`fact "${id}" is inferred but says nothing about how`);
  if (fact.status !== "verified" && SUPERLATIVE.test(fact.text ?? "")) problems.push(`fact "${id}" makes a "${SUPERLATIVE.exec(fact.text)[0]}" claim but is not verified`);
}

function checkFactText(entry, facts, problems) {
  const where = `"${shorten(entry.text)}"`;
  if (!entry.facts.length) {
    problems.push(`text ${where} states something but names no fact`);
    return;
  }
  for (const id of entry.facts) {
    if (!facts[id]) problems.push(`text ${where} names fact "${id}", which facts.json does not have`);
  }
  const claim = SUPERLATIVE.exec(entry.text);
  if (!claim) return;
  const unverified = entry.facts.filter((id) => facts[id] && facts[id].status !== "verified");
  if (unverified.length) problems.push(`text ${where} says "${claim[0]}" but rests on unverified facts: ${unverified.join(", ")}`);
}

function checkReadouts(machine, entries, facts, problems) {
  const patterns = (machine.readouts ?? []).map((readout) => {
    for (const id of readout.facts ?? []) {
      if (!facts[id]) problems.push(`readout template ${readout.pattern} names fact "${id}", which facts.json does not have`);
    }
    if (!(readout.facts ?? []).length) problems.push(`readout template ${readout.pattern} names no fact`);
    return new RegExp(readout.pattern);
  });
  for (const entry of entries.filter((item) => item.kind === "readout")) {
    if (!patterns.some((pattern) => pattern.test(entry.text))) problems.push(`readout "${entry.text}" matches no readout template`);
  }
  return patterns;
}

function checkProvenance(machine, problems) {
  for (const [name, piece] of Object.entries(machine.pieces)) {
    const provenance = piece.provenance;
    if (!provenance || !PROVENANCE.includes(provenance.kind)) {
      problems.push(`assembly "${name}" has no provenance mark (sourced, inferred or simplified)`);
      continue;
    }
    if (!(provenance.facts ?? []).length) problems.push(`assembly "${name}" is marked ${provenance.kind} but names no fact`);
    if (provenance.kind === "simplified" && !provenance.note) problems.push(`assembly "${name}" is simplified but has no note for the page`);
  }
}

function shorten(text) {
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

// The text a reader sees in the built page: text nodes and aria labels, outside scripts and styles.
export function visibleTexts(html) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? html;
  const clean = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const found = [];
  for (const match of clean.matchAll(/>([^<>]+)</g)) found.push(match[1]);
  for (const match of clean.matchAll(/aria-label="([^"]+)"/g)) found.push(match[1]);
  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return found.map((text) => decode(text).trim()).filter((text) => text && /[A-Za-z]/.test(text));
}

const KIT_TEXTS = ["Take apart", "Put together", "Sound", "Sound on", "Simplified:", "Key switch. Enter or Space turns it."];

// A visible text is covered when nothing with letters is left once every registered text is cut out
// of it: a caption is several registered sentences joined, a note several notes.
function covered(text, registered) {
  let rest = text;
  for (const known of registered) {
    if (known && rest.includes(known)) rest = rest.split(known).join(" ");
  }
  return !/[A-Za-z]/.test(rest);
}

function checkUnregistered(html, entries, machine, problems) {
  const registered = entries.map((entry) => entry.text).concat(KIT_TEXTS, machine.uiTexts ?? []);
  registered.sort((first, second) => second.length - first.length);
  for (const text of visibleTexts(html)) {
    if (!covered(text, registered)) problems.push(`the page shows "${shorten(text)}", which no registered text covers`);
  }
}

// Reference images (references/reference-images.md): at least three real photos or drawings in
// reference/images/, each with a source entry in sources.json, and every assembly names the images it was
// drawn from. Returns how many images there are.
function readImageSources(folder, problems) {
  const sourcesPath = join(folder, "sources.json");
  if (!existsSync(sourcesPath)) {
    problems.push("reference/images/sources.json is missing (file, url, shows for each image)");
    return [];
  }
  return JSON.parse(readFileSync(sourcesPath, "utf8")).images ?? [];
}

function checkImageEntries(files, entries, problems) {
  const described = new Set(entries.map((entry) => entry.file));
  for (const file of files) {
    if (!described.has(file)) problems.push(`reference image ${file} has no entry in reference/images/sources.json`);
  }
  for (const entry of entries) {
    if (!files.includes(entry.file)) problems.push(`sources.json names ${entry.file}, which reference/images/ does not have`);
    if (!URL.test(entry.url ?? "") || !entry.shows) problems.push(`reference image ${entry.file} needs a url and a "shows" line`);
  }
}

function checkReferenceImages(machine, dir, problems) {
  const folder = join(dir, "reference", "images");
  const files = existsSync(folder) ? readdirSync(folder).filter((file) => IMAGE.test(file)) : [];
  if (files.length < LEAST_IMAGES) problems.push(`reference/images/ has ${files.length} images; collect at least ${LEAST_IMAGES} real photos or drawings before drawing`);
  if (files.length) checkImageEntries(files, readImageSources(folder, problems), problems);
  for (const [name, piece] of Object.entries(machine.pieces)) {
    const images = piece.provenance?.images ?? [];
    if (!images.length) problems.push(`assembly "${name}" names no reference image it was drawn from (provenance.images)`);
    for (const image of images) {
      if (!files.includes(image)) problems.push(`assembly "${name}" names reference image ${image}, which reference/images/ does not have`);
    }
  }
  return files.length;
}

// Returns the problems as sentences and a count of what was checked.
export function lintMachine({ machine, facts, dir }, builtPage) {
  const problems = [];
  const factTable = facts.facts ?? {};
  for (const [id, fact] of Object.entries(factTable)) checkFact(id, fact, dir, problems);
  const entries = builtPage.texts.entries;
  const factual = entries.filter((entry) => entry.kind === "fact");
  for (const entry of factual) checkFactText(entry, factTable, problems);
  for (const entry of entries.filter((item) => item.kind === "ui")) {
    if (SUPERLATIVE.test(entry.text)) problems.push(`ui text "${shorten(entry.text)}" makes a claim; give it facts instead`);
  }
  const patterns = checkReadouts(machine, entries, factTable, problems);
  checkProvenance(machine, problems);
  const images = checkReferenceImages(machine, dir, problems);
  problems.push(...lintFunctions(machine));
  checkUnregistered(builtPage.html, entries, machine, problems);
  const used = new Set(factual.flatMap((entry) => entry.facts));
  const unused = Object.keys(factTable).filter((id) => !used.has(id));
  return { problems, counts: { facts: Object.keys(factTable).length, texts: factual.length, ui: entries.length - factual.length, readoutTemplates: patterns.length, pieces: Object.keys(machine.pieces).length, images, unusedFacts: unused } };
}
