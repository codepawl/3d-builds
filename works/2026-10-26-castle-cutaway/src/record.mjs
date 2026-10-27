// Records the castle page on the harness's virtual clock at 1920x1080, 30 fps, 20 s. No caption is burned in.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveFolder } from '../pokemon-duel/serve.mjs';
import { recordPage } from '../../demo-harness/src/record.js';
import { toMp4 } from '../../demo-harness/src/compose.js';
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const server = await serveFolder(here);
const capture = join(here, 'out', 'castle.capture.mkv');
const { errors } = await recordPage({ url: `${server.origin}/index.html`, videoPath: capture, seconds: 20, readyTimeoutMs: 90_000, viewport: { width: 1920, height: 1080 } });
server.close();
await toMp4({ input: capture, output: join(here, 'out', 'castle.mp4'), caption: '' });
console.log('recorded', join(here, 'out', 'castle.mp4'), 'errors', JSON.stringify(errors));
