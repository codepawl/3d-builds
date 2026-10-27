// Tiny static server for web/, shared by the still and reel tools.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' };
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function startServer() {
  const webRoot = path.join(projectRoot, 'web');
  const server = http.createServer((request, response) => {
    const file = path.join(webRoot, decodeURIComponent(request.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
