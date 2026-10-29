// Converts every NVIDIA SimReady asset to a web-ready glb, one asset at a time per worker, and logs what each step did.
// Usage: node run.mjs <asset-list.txt> <work-root> [workers=2]
// Per asset: download the USD, payloads and textures (not the duplicate source_assets copy), Blender USD -> glb,
// optimize.mjs, then delete the download. Results: <work-root>/out/glb/<asset>.glb and <work-root>/out/manifest.jsonl.
// Assets already in the manifest are skipped, so the run can be stopped and started again.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'https://huggingface.co/datasets/nvidia/simready-assets';
const API = 'https://huggingface.co/api/datasets/nvidia/simready-assets/tree/main';
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const MAX_TEXTURE_EDGE = 1024;
// A few heavy assets (robot trolleys, coilovers) need more than 30 minutes in the glTF export, so the retry pass sets
// BLENDER_TIMEOUT_MINUTES higher.
const BLENDER_TIMEOUT_MS = Number(process.env.BLENDER_TIMEOUT_MINUTES ?? 30) * 60 * 1000;
// Threads per Blender, so two workers leave half of the 12 threads free for the rest of the machine.
const BLENDER_THREADS = Number(process.env.BLENDER_THREADS ?? 3);
const here = path.dirname(fileURLToPath(import.meta.url));

const [listPath, workRoot, workerCountText] = process.argv.slice(2);
const workerCount = Number(workerCountText ?? 2);
const outputFolder = path.join(workRoot, 'out');
const glbFolder = path.join(outputFolder, 'glb');
const manifestPath = path.join(outputFolder, 'manifest.jsonl');
const failuresPath = path.join(outputFolder, 'failures.jsonl');
fs.mkdirSync(glbFolder, { recursive: true });

function readDoneAssets() {
  if (!fs.existsSync(manifestPath)) return new Set();
  const lines = fs.readFileSync(manifestPath, 'utf8').split('\n').filter(Boolean);
  return new Set(lines.map((line) => JSON.parse(line).asset));
}

async function fetchWithRetry(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`HTTP ${response.status} ${url}`);
      if (attempt >= 5) throw new Error(`HTTP ${response.status} ${url}`);
    } catch (error) {
      if (attempt >= 5 || String(error).includes('HTTP 4')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
  }
}

async function listFiles(asset) {
  const files = [];
  let url = `${API}/${asset}?recursive=true&limit=1000`;
  while (url) {
    const response = await fetchWithRetry(url);
    for (const entry of await response.json()) {
      if (entry.type === 'file') files.push({ path: entry.path, size: entry.size, hash: entry.lfs?.oid ?? entry.oid });
    }
    const link = response.headers.get('link') ?? '';
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return files;
}

function isNeeded(filePath) {
  if (filePath.endsWith('LICENSE.txt')) return true;
  if (!filePath.includes('/simready_usd/')) return false;
  return !filePath.includes('/.thumbs/') && !filePath.includes('/source_assets/');
}

// Many assets ship byte-identical textures, so every file is kept once in a cache named by its content hash and
// copied from there. The line tops out near 10 MB/s, and without this most of the run was re-downloading shared files.
const cacheFolder = path.join(workRoot, 'cache');
fs.mkdirSync(cacheFolder, { recursive: true });
const cacheStats = { hits: 0, savedBytes: 0 };
const downloadsInFlight = new Map();

async function fetchIntoCache(file) {
  const cached = path.join(cacheFolder, file.hash);
  if (fs.existsSync(cached)) return cached;
  if (!downloadsInFlight.has(file.hash)) {
    const partial = `${cached}.part-${process.pid}-${Math.random().toString(36).slice(2)}`;
    const job = fetchWithRetry(`${REPOSITORY}/resolve/main/${file.path}`)
      .then((response) => pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial)))
      .then(() => fs.renameSync(partial, cached))
      .finally(() => downloadsInFlight.delete(file.hash));
    downloadsInFlight.set(file.hash, job);
  }
  await downloadsInFlight.get(file.hash);
  return cached;
}

async function download(file, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const alreadyCached = fs.existsSync(path.join(cacheFolder, file.hash));
  const cached = await fetchIntoCache(file);
  if (alreadyCached) {
    cacheStats.hits += 1;
    cacheStats.savedBytes += file.size;
  }
  fs.copyFileSync(cached, target);
}

// Kills the child and everything it started. child.kill() alone can leave a Blender process holding a core on Windows.
function killTree(child) {
  if (process.platform === 'win32') spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    // Set on each child, not only inherited: a parent started at Normal gave its Blender children Normal priority.
    try {
      os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch (error) {
      console.log(`could not lower priority of ${child.pid}: ${error.message}`);
    }
    let output = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else if (timedOut) reject(new Error(`${path.basename(command)} timed out after ${timeoutMs / 60000} min: ${output.slice(-600)}`));
      else reject(new Error(`${path.basename(command)} exit ${code}: ${output.slice(-600)}`));
    });
  });
}

async function processAsset(asset) {
  const startedAt = Date.now();
  const assetFolder = path.join(workRoot, 'raw', asset);
  const files = await listFiles(asset);
  const neededFiles = files.filter((file) => isNeeded(file.path));
  const licenseFile = files.find((file) => file.path.endsWith('LICENSE.txt'));
  // Most root files are .usd, but bolts, nuts and dishware ship a .usda root.
  const mainUsd = neededFiles.find((file) => /\/simready_usd\/[^/]+\.usd[ac]?$/.test(file.path));
  if (!mainUsd) throw new Error('no main USD file');

  // Four downloads at a time: one stream from the Hub tops out near 6 MB/s.
  const pending = [...neededFiles];
  const downloadNext = async () => {
    while (pending.length > 0) {
      const file = pending.shift();
      await download(file, path.join(workRoot, 'raw', file.path));
    }
  };
  await Promise.all([downloadNext(), downloadNext(), downloadNext(), downloadNext()]);
  const license = licenseFile
    ? fs.readFileSync(path.join(workRoot, 'raw', licenseFile.path), 'utf8').split('\n')[0].trim()
    : 'missing';
  if (!license.startsWith('Attribution 4.0 International')) throw new Error(`licence is not CC BY 4.0: ${license}`);

  const blenderGlb = path.join(assetFolder, `${asset}.blender.glb`);
  const outputGlb = path.join(glbFolder, `${asset}.glb`);
  const blenderStartedAt = Date.now();
  // --python-exit-code: without it a Python error in usd_to_glb.py still exits 0 and leaves no glb behind.
  await run(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '-t', String(BLENDER_THREADS), '--python', path.join(here, 'usd_to_glb.py'), '--',
    path.join(workRoot, 'raw', mainUsd.path), blenderGlb], BLENDER_TIMEOUT_MS);
  const blenderSeconds = (Date.now() - blenderStartedAt) / 1000;
  const optimizeOutput = await run(process.execPath, [path.join(here, 'optimize.mjs'), blenderGlb, outputGlb,
    String(MAX_TEXTURE_EDGE)], BLENDER_TIMEOUT_MS);
  const result = JSON.parse(optimizeOutput.split('\n').find((line) => line.startsWith('{')));

  fs.rmSync(assetFolder, { recursive: true, force: true });
  return {
    asset,
    license: 'CC-BY-4.0',
    source: { folderBytes: files.reduce((sum, file) => sum + file.size, 0),
      downloadedBytes: neededFiles.reduce((sum, file) => sum + file.size, 0), files: files.length },
    blender: result.before,
    optimized: result.after,
    prototypesRemoved: result.prototypesRemoved,
    duplicateNodesRemoved: result.duplicateNodesRemoved,
    bounds: result.bounds,
    blenderSeconds,
    totalSeconds: (Date.now() - startedAt) / 1000,
  };
}

const assets = fs.readFileSync(listPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const done = readDoneAssets();
const queue = assets.filter((asset) => !done.has(asset));
console.log(`assets ${assets.length}, done ${done.size}, to do ${queue.length}, workers ${workerCount}`);

async function worker() {
  while (queue.length > 0) {
    const asset = queue.shift();
    try {
      const entry = await processAsset(asset);
      fs.appendFileSync(manifestPath, JSON.stringify(entry) + '\n');
      console.log(`ok ${asset} ${(entry.source.folderBytes / 1e6).toFixed(0)}MB -> ${(entry.optimized.bytes / 1e6).toFixed(1)}MB ${entry.totalSeconds.toFixed(0)}s, left ${queue.length}, cache hits ${cacheStats.hits} saved ${(cacheStats.savedBytes / 1e9).toFixed(1)}GB`);
    } catch (error) {
      fs.appendFileSync(failuresPath, JSON.stringify({ asset, error: String(error).slice(0, 800), at: new Date().toISOString() }) + '\n');
      fs.rmSync(path.join(workRoot, 'raw', asset), { recursive: true, force: true });
      console.log(`failed ${asset}: ${String(error).slice(0, 200)}`);
    }
  }
}

await Promise.all(Array.from({ length: workerCount }, worker));
console.log('finished');
