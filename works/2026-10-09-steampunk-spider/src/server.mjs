import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const directory = dirname(fileURLToPath(import.meta.url));
// Set JS67_DIR to the folder where three.js, gl-matrix, esbuild and the 67.js engine are installed.
const checkoutDirectory = process.env.JS67_DIR;
if (!checkoutDirectory) {
  console.error("Set JS67_DIR to your 67.js checkout (with node_modules installed).");
  process.exit(1);
}
const vendor = resolve(checkoutDirectory, "node_modules/three");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".ttf": "font/ttf",
  ".png": "image/png",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const isVendor = url.pathname.startsWith("/vendor/three/");
    const root = isVendor ? vendor : directory;
    const relative = isVendor
      ? url.pathname.slice("/vendor/three".length)
      : url.pathname === "/"
        ? "/index.html"
        : url.pathname;
    const file = resolve(root, "." + decodeURIComponent(relative));
    if (!file.startsWith(resolve(root) + sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(5186, "127.0.0.1", () => console.log("SPDR http://127.0.0.1:5186"));
