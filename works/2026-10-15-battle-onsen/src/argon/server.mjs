import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDirectory = path.dirname(currentFilePath);
const portNumber = 5506;

const mimeTypesByExtension = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveSafeFilePath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://localhost:${portNumber}`);
  let relativePathname = decodeURIComponent(parsedUrl.pathname);
  if (relativePathname === "/") {
    relativePathname = "/index.html";
  }
  const candidatePath = path.normalize(path.join(rootDirectory, relativePathname));
  if (!candidatePath.startsWith(rootDirectory)) {
    return null;
  }
  return candidatePath;
}

function handleHttpRequest(request, response) {
  const targetPath = resolveSafeFilePath(request.url || "/");
  if (!targetPath) {
    response.writeHead(403, { "Content-Type": "text/plain" });
    response.end("Forbidden");
    return;
  }
  fs.stat(targetPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not Found");
      return;
    }
    const extension = path.extname(targetPath).toLowerCase();
    const contentType = mimeTypesByExtension[extension] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    const fileStream = fs.createReadStream(targetPath);
    fileStream.pipe(response);
  });
}

const httpServer = http.createServer(handleHttpRequest);
httpServer.listen(portNumber, "127.0.0.1", () => {
  console.log(`Static server listening on http://127.0.0.1:${portNumber}`);
});
