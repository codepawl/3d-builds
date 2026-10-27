import { build } from "file:///<your 67js checkout>/node_modules/esbuild/lib/main.js";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cartoonShaders } from "./toon-shader.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const dependencies = "<your 67js checkout>/node_modules";
const destination = resolve(directory, "dist");
await mkdir(resolve(destination, "assets"), { recursive: true });
const result = await build({
  entryPoints: [resolve(directory, "main.js")],
  outdir: destination,
  bundle: true,
  splitting: true,
  minify: true,
  metafile: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  nodePaths: [dependencies],
  plugins: [
    {
      name: "local-vendors",
      setup(builder) {
        builder.onLoad(
          { filter: /67js[\\/]src[\\/]shaders\.js$/ },
          async ({ path }) => ({
            contents: cartoonShaders(await readFile(path, "utf8")),
            loader: "js",
          }),
        );
        builder.onResolve({ filter: /^\/vendor\// }, ({ path }) => {
          if (path.startsWith("/vendor/three/"))
            return {
              path: resolve(
                dependencies,
                "three",
                path.slice("/vendor/three/".length),
              ),
            };
          if (path.startsWith("/vendor/67/"))
            return {
              path: resolve(
                "<your 67js checkout>/src",
                path.slice("/vendor/67/".length),
              ),
            };
        });
      },
    },
  ],
});
const html = (await readFile(resolve(directory, "index.html"), "utf8")).replace(
  /\s*<script type="importmap">[\s\S]*?<\/script>/,
  "",
);
await writeFile(resolve(destination, "index.html"), html);
await copyFile(
  resolve(directory, "style.css"),
  resolve(destination, "style.css"),
);
await copyFile(
  resolve(directory, "assets/inter.ttf"),
  resolve(destination, "assets/inter.ttf"),
);
await writeFile(
  resolve(destination, "manifest.json"),
  JSON.stringify(
    Object.keys(result.metafile.outputs).map((filename) =>
      filename.replaceAll("\\", "/").split("/dist/").pop(),
    ),
    null,
    2,
  ),
);
console.log("Static website built in " + destination);
