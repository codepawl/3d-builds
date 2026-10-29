// Serves the viewer Space with the local dataset folder, to check it before upload.
// Usage: node serve_space.mjs [port] [data-folder] ; then open http://127.0.0.1:<port>/?base=/data/
// Env: SPACE_DIR (default ../../space), DATA_DIR (default out).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const spaceFolder = process.env.SPACE_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'space');
const dataFolder = process.argv[3] ?? process.env.DATA_DIR ?? 'out';
const port = Number(process.argv[2] ?? 5541);
const CONTENT_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.md': 'text/markdown',
};

function resolveRequest(urlPath) {
  const [root, relative] = urlPath.startsWith('/data/') ? [dataFolder, urlPath.slice(6)] : [spaceFolder, urlPath.slice(1) || 'index.html'];
  const file = normalize(join(root, relative));
  if (!file.startsWith(normalize(root)) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

createServer((request, response) => {
  const file = resolveRequest(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  if (!file) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': statSync(file).size,
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`space on http://127.0.0.1:${port}/?base=/data/`));
