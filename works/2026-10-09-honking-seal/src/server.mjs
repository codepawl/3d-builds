import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cartoonShaders } from "./toon-shader.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
// Set JS67_DIR to the folder where three.js, gl-matrix, esbuild and the 67.js engine are installed.
const checkoutDirectory = process.env.JS67_DIR;
if (!checkoutDirectory) {
  console.error("Set JS67_DIR to your 67.js checkout (with node_modules installed).");
  process.exit(1);
}
const threeDirectory = resolve(checkoutDirectory, "node_modules/three");
const engineDirectory = resolve(checkoutDirectory, "src");
const matrixDirectory = resolve(checkoutDirectory, "node_modules/gl-matrix/esm");
const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    let root = directory;
    let relativePath = pathname === "/" ? "/index.html" : pathname;
    if (pathname.startsWith("/vendor/three/")) {
      root = threeDirectory;
      relativePath = pathname.slice("/vendor/three".length);
    } else if (pathname.startsWith("/vendor/67/")) {
      root = engineDirectory;
      relativePath = pathname.slice("/vendor/67".length);
    } else if (pathname.startsWith("/vendor/gl-matrix/")) {
      root = matrixDirectory;
      relativePath = pathname.slice("/vendor/gl-matrix".length);
    }
    const filename = resolve(root, "." + relativePath);
    if (!filename.startsWith(resolve(root) + sep)) {
      response.writeHead(403).end();
      return;
    }
    let content = await readFile(filename);
    if (pathname === "/vendor/67/shaders.js")
      content = cartoonShaders(content.toString("utf8"));
    response.writeHead(200, {
      "Content-Type":
        contentTypes[extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(Number(process.env.PORT || 5178), "127.0.0.1", () => {
  console.log(`Seal Squeeze http://127.0.0.1:${server.address().port}`);
});
