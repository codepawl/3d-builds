// Renders the test diorama frame by frame (virtual clock) in headless Chrome and encodes one mp4 per preset.
// Usage: node record.mjs <presets comma list> [fps=60] [frames limit]   -> out/raw/<preset>.mp4
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { constants, setPriority } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const threeBuild = resolve(here, '../pixel-battles/node_modules/three/build');
const playwrightModule = pathToFileURL(resolve(here, '../../demo-harness/node_modules/playwright-core/index.mjs')).href;
const { chromium } = await import(playwrightModule);
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
try { setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL); } catch {}

const presetNames = (process.argv[2] ?? 'A,B,C').split(',');
const fps = Number(process.argv[3] ?? 60);
const outputDirectory = join(here, 'out', 'raw');
mkdirSync(outputDirectory, { recursive: true });

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.startsWith('/three/') ? join(threeBuild, path.slice(7)) : join(here, path === '/' ? 'test/index.html' : path);
  try {
    const body = readFileSync(file);
    response.writeHead(200, { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    console.log('[server] 404', path);
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--run-all-compositor-stages-before-draw'],
});
for (const presetName of presetNames) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) console.log(`[page ${message.type()}] ${message.text()}`); });
  page.on('pageerror', error => console.log(`[page error] ${error.message}`));
  await page.goto(`${origin}/test/index.html?preset=${presetName}`);
  await page.waitForFunction(() => window.reelReady === true, null, { timeout: 60_000 });
  const duration = await page.evaluate(() => window.DURATION);
  const output = join(outputDirectory, `${presetName}.mp4`);
  const ffmpeg = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(fps), output], { stdio: ['pipe', 'ignore', 'pipe'] });
  let errors = '';
  ffmpeg.stderr.on('data', chunk => { errors += chunk; });
  const finished = new Promise((resolveClose, rejectClose) => ffmpeg.on('close', code => (code === 0 ? resolveClose() : rejectClose(new Error(errors.slice(-1500))))));
  const frameCount = Math.round(duration * fps);
  for (let frame = 0; frame < frameCount; frame++) {
    await page.evaluate(time => window.renderAt(time), frame / fps);
    const png = await page.screenshot({ type: 'png', timeout: 180_000 });
    if (!ffmpeg.stdin.write(png)) await new Promise(resolveDrain => ffmpeg.stdin.once('drain', resolveDrain));
  }
  ffmpeg.stdin.end();
  await finished;
  await page.close();
  console.log('recorded', output);
}
await browser.close();
server.close();
