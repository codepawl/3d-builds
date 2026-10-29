// Renders a 512 px WebP thumbnail for every optimized glb, in headless Chrome with the same three.js look as the film.
// Usage: node render_thumbs.mjs [--limit N] [--only name1,name2]
// Env: GLB_DIR (default out/glb), THUMB_DIR (default out/thumbs), WEB_DIR, CHROME_PATH.
// Resumable: an asset whose thumbnail already exists is skipped. Failures go to <THUMB_DIR>/../thumb_failures.jsonl.
import { setPriority, constants as osConstants } from 'node:os';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL); // Chrome children inherit it
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { chromium } = createRequire(import.meta.url)('playwright');

const thumbsFolder = dirname(fileURLToPath(import.meta.url));
// The film's web folder (three.js vendor copy, studio.js, the HDRI): web/ in the working copy, src/web/ in 3d-builds.
const webFolder = process.env.WEB_DIR
  ?? [join(thumbsFolder, '..', '..', 'web'), join(thumbsFolder, '..', '..', 'src', 'web')].find((folder) => existsSync(folder));
const glbFolder = process.env.GLB_DIR ?? 'out/glb';
const outputFolder = process.env.THUMB_DIR ?? 'out/thumbs';
const failureLog = join(outputFolder, '..', 'thumb_failures.jsonl');
const chromePath = process.env.CHROME_PATH;
const ASSET_TIMEOUT_MS = 120000;

function readArgument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const CONTENT_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream',
};
const ROUTES = [['/web/', webFolder], ['/glb/', glbFolder], ['/thumbs/', thumbsFolder]];

function resolveRequest(urlPath) {
  for (const [prefix, root] of ROUTES) {
    if (!urlPath.startsWith(prefix)) continue;
    const file = normalize(join(root, urlPath.slice(prefix.length)));
    if (file.startsWith(normalize(root)) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

function startServer() {
  const server = createServer((request, response) => {
    const file = resolveRequest(decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (!file) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.goto(`http://127.0.0.1:${port}/thumbs/thumb.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}

function withTimeout(promise, milliseconds) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${milliseconds} ms`)), milliseconds); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

mkdirSync(outputFolder, { recursive: true });
let assetNames = readdirSync(glbFolder).filter((name) => name.endsWith('.glb')).map((name) => name.slice(0, -4)).sort();
const only = readArgument('--only');
if (only) assetNames = only.split(',');
assetNames = assetNames.filter((name) => !existsSync(join(outputFolder, `${name}.webp`)));
const limit = Number(readArgument('--limit') ?? assetNames.length);
assetNames = assetNames.slice(0, limit);

const server = await startServer();
const port = server.address().port;
function launchBrowser() {
  return chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
}

let browser = await launchBrowser();
let page = await openPage(browser, port);
const startedAt = Date.now();
let doneCount = 0;
let failedCount = 0;

for (const assetName of assetNames) {
  try {
    const dataUrl = await withTimeout(page.evaluate((name) => window.renderThumbnail(name), assetName), ASSET_TIMEOUT_MS);
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile(join(outputFolder, `${assetName}.webp`));
    doneCount += 1;
  } catch (error) {
    failedCount += 1;
    appendFileSync(failureLog, `${JSON.stringify({ asset: assetName, error: String(error.message ?? error) })}\n`);
    console.error(`failed ${assetName}: ${error.message}`);
    await page.close().catch(() => {});
    // A GPU process crash under a loaded machine takes the whole browser down; start a new one then.
    if (!browser.isConnected()) {
      await browser.close().catch(() => {});
      browser = await launchBrowser();
    }
    page = await openPage(browser, port);
  }
  if ((doneCount + failedCount) % 50 === 0) {
    const seconds = (Date.now() - startedAt) / 1000;
    console.log(`${doneCount + failedCount}/${assetNames.length} done, ${failedCount} failed, ${seconds.toFixed(0)} s`);
  }
}

console.log(`finished: ${doneCount} rendered, ${failedCount} failed, ${((Date.now() - startedAt) / 1000).toFixed(0)} s`);
await browser.close();
server.close();
