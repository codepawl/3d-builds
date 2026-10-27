import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { cartoonShaders } from "./toon-shader.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
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
                resolve(checkoutDirectory, "src"),
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
