import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// Set JS67_DIR to the folder where three.js, gl-matrix, esbuild and the 67.js engine are installed.
const checkoutDirectory = process.env.JS67_DIR;
if (!checkoutDirectory) {
  console.error("Set JS67_DIR to your 67.js checkout (with node_modules installed).");
  process.exit(1);
}
const dependencies = resolve(checkoutDirectory, "node_modules");
const { build } = await import(
  pathToFileURL(resolve(dependencies, "esbuild/lib/main.js")).href
);
const root = fileURLToPath(new URL("./", import.meta.url));
await mkdir(root + "dist/assets", { recursive: true });
await build({
  entryPoints: [root + "main.js"],
  outdir: root + "dist",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  nodePaths: [dependencies],
});
const html = (await readFile(root + "index.html", "utf8")).replace(
  /\s*<script type="importmap">[\s\S]*?<\/script>/,
  "",
);
await writeFile(root + "dist/index.html", html);
for (const file of ["style.css", "assets/spider.glb", "assets/inter.ttf"])
  await copyFile(root + file, root + "dist/" + file);
console.log("Static build ready: " + root + "dist");
