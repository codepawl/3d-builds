// Minimal static file server for the project root: node tools/serve.mjs <port>
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.argv[2] || 5505);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const absolutePath = normalize(join(projectRoot, relativePath));
  if (!absolutePath.startsWith(projectRoot)) {
    return null;
  }
  return absolutePath;
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (filePath === null) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      throw new Error("not a file");
    }
    const body = await readFile(filePath);
    const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Serving ${projectRoot} at http://localhost:${port}/`);
});
