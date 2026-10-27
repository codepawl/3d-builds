// Records one side's airport page over http on the harness's virtual clock.
// Usage: node record.mjs <side folder> <seconds> "<caption>" [speed]
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFolder } from '../pokemon-duel/serve.mjs';
import { recordPage } from '../../demo-harness/src/record.js';
import { toMp4 } from '../../demo-harness/src/compose.js';
const here = dirname(fileURLToPath(import.meta.url));
const [side, seconds = '20', caption = '', speed = ''] = process.argv.slice(2);
// A speed button press before the first frame, when the page has one marked data-speed.
const prepare = speed ? (page) => page.click(`[data-speed="${speed}"]`) : undefined;
const folder = join(here, side);
const server = await serveFolder(folder);
const capture = join(folder, 'airport.capture.mkv');
const { errors } = await recordPage({ url: `${server.origin}/index.html`, videoPath: capture, seconds: Number(seconds), readyTimeoutMs: 60_000, prepare });
server.close();
await toMp4({ input: capture, output: join(folder, 'airport.mp4'), caption });
console.log('recorded', join(folder, 'airport.mp4'), 'errors', JSON.stringify(errors));
