import { mkdir, readFile, copyFile, writeFile, readdir, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const worker = process.argv[2];
if (!worker)
  throw new Error("Pass the dedicated Honking Seal Worker directory.");
const source = resolve(worker, "source");
const assets = resolve(worker, "assets");
await mkdir(resolve(source, "assets"), { recursive: true });
await mkdir(resolve(assets, "assets"), { recursive: true });
for (const filename of [
  "index.html",
  "style.css",
  "main.js",
  "audio.js",
  "melody.js",
  "seal-model.js",
  "cartoon.js",
  "renderer-67.js",
  "toon-shader.mjs",
  "interaction.test.mjs",
  "assets/inter.ttf",
]) {
  await copyFile(resolve(directory, filename), resolve(source, filename));
}
const manifest = JSON.parse(
  await readFile(resolve(directory, "dist/manifest.json"), "utf8"),
);
for (const filename of [
  ...manifest,
  "index.html",
  "style.css",
  "assets/inter.ttf",
  "assets/card.png",
]) {
  await copyFile(
    resolve(directory, "dist", filename),
    resolve(assets, filename),
  );
}
for (const filename of await readdir(assets)) {
  if (filename.endsWith('.js') && !manifest.includes(filename)) {
    await unlink(resolve(assets, filename));
  }
}
await writeFile(
  resolve(assets, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/
  Cache-Control: no-cache
/main.js
  Cache-Control: no-cache
/style.css
  Cache-Control: no-cache
`,
);
console.log("Prepared only the dedicated Honking Seal Worker.");
