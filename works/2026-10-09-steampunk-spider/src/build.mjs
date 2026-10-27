import { build } from "file:///<your 67js checkout>/node_modules/esbuild/lib/main.js";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
  nodePaths: ["<your 67js checkout>/node_modules"],
});
const html = (await readFile(root + "index.html", "utf8")).replace(
  /\s*<script type="importmap">[\s\S]*?<\/script>/,
  "",
);
await writeFile(root + "dist/index.html", html);
for (const file of ["style.css", "assets/spider.glb", "assets/inter.ttf"])
  await copyFile(root + file, root + "dist/" + file);
console.log("Static build ready: " + root + "dist");
