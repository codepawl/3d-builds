// Balance by bots, not guesses. Runs the real game headless (play mode on a manual clock, fixed 1/60 s steps, nothing drawn) with
// three bot players and reports how long each survives and how big the swarm gets.
//   idle   never moves
//   simple always steers at the nearest creature, never uses abilities
//   good   hunts the best food, lunges at fleeing prey, dodges at the end of a telegraph, leaves mower lanes, keeps off salt and traps
// Usage: node tools/playtest.mjs [--base http://127.0.0.1:4177] [--bots idle,simple,good] [--seeds 1,2,3] [--minutes 14]
//                                [--tune name:value,name:value] [--parallel 2] [--json out.json]
// Serve the build first (npx vite preview --port 4177 --host 127.0.0.1). Playwright comes from PLAYWRIGHT_FROM or demo-harness.
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';

// Below-normal priority, so the machine stays usable; the browser it starts inherits it.
os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);

const harness = process.env.PLAYWRIGHT_FROM ?? import.meta.url;
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? harness);
const { chromium } = require('playwright');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const base = argument('base', 'http://127.0.0.1:4177');
const bots = argument('bots', 'idle,simple,good').split(',');
const seeds = argument('seeds', '1,2,3').split(',').map(Number);
const maxSeconds = Number(argument('minutes', '14')) * 60;
const tune = argument('tune', '');
const parallel = Number(argument('parallel', '2'));
const jsonPath = argument('json', '');

// Runs inside the page. Each bot is a function (field, helpers) that sets the aim and may use abilities.
function installBots() {
  const FOOD = { chicken: 5, rabbit: 5, pig: 12, deer: 16, cow: 20, villager: 18 };
  const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const api = window.__app.bot;

  // Pushes the aim away from salt, traps and mower lanes.
  function avoid(field, aim) {
    let { x, z } = aim;
    const front = field.front;
    for (const trap of field.traps) {
      const gap = distance(x, z, trap.x, trap.z);
      if (gap < 4) {
        x += ((x - trap.x) / (gap + 0.1)) * (4 - gap) * 1.5;
        z += ((z - trap.z) / (gap + 0.1)) * (4 - gap) * 1.5;
      }
    }
    if (field.salt) {
      const gap = distance(x, z, field.salt.x, field.salt.z);
      if (gap < field.salt.radius + 3.5) {
        x += ((x - field.salt.x) / (gap + 0.1)) * (field.salt.radius + 3.5 - gap) * 1.5;
        z += ((z - field.salt.z) / (gap + 0.1)) * (field.salt.radius + 3.5 - gap) * 1.5;
      }
    }
    for (const lane of field.lanes) {
      // Signed distance across the lane from the swarm front.
      const across = (front.x - lane.x) * -lane.directionZ + (front.z - lane.z) * lane.directionX;
      if (Math.abs(across) < lane.halfWidth + 6) {
        const side = across >= 0 ? 1 : -1;
        const push = lane.halfWidth + 9 - Math.abs(across);
        return { x: front.x + -lane.directionZ * side * push * 1.6, z: front.z + lane.directionX * side * push * 1.6, urgent: true };
      }
    }
    return { x, z, urgent: false };
  }

  function nearestCreature(field, filter = () => true) {
    let best = null;
    let bestGap = Infinity;
    for (const creature of field.creatures) {
      if (!filter(creature)) continue;
      const gap = distance(creature.x, creature.z, field.front.x, field.front.z);
      if (gap < bestGap) {
        bestGap = gap;
        best = creature;
      }
    }
    return best ? { creature: best, gap: bestGap } : null;
  }

  const strategies = {
    idle(field) {
      api.aim(field.front.x, field.front.z);
    },
    simple(field) {
      const found = nearestCreature(field);
      if (found) api.aim(found.creature.x, found.creature.z);
      else api.aim(field.front.x, field.front.z);
    },
    good(field) {
      // Dodge at the end of a telegraph (inside the parry window) when the attack is near the swarm.
      for (const attack of field.incoming) {
        if (attack.eta > 0.04 && attack.eta < 0.28 && distance(attack.x, attack.z, field.front.x, field.front.z) < 16 && api.dodgeReady()) {
          api.dodge();
          break;
        }
      }
      // Meat on the ground first, then the creature worth the most for its distance.
      let aim = null;
      let hunted = null;
      let nearestChunk = null;
      let nearestChunkGap = 14;
      for (const chunk of field.chunks) {
        const gap = distance(chunk.x, chunk.z, field.front.x, field.front.z);
        if (gap < nearestChunkGap) {
          nearestChunkGap = gap;
          nearestChunk = chunk;
        }
      }
      if (nearestChunk) {
        aim = { x: nearestChunk.x, z: nearestChunk.z };
      } else {
        let bestScore = -1;
        for (const creature of field.creatures) {
          const gap = distance(creature.x, creature.z, field.front.x, field.front.z);
          if (gap > 70) continue;
          const nearTrap = field.traps.some((trap) => distance(trap.x, trap.z, creature.x, creature.z) < 4) || (field.salt && distance(field.salt.x, field.salt.z, creature.x, creature.z) < field.salt.radius + 3);
          if (nearTrap) continue;
          const score = (FOOD[creature.kind] ?? 8) / (gap + 12);
          if (score > bestScore) {
            bestScore = score;
            hunted = creature;
          }
        }
        if (hunted) aim = { x: hunted.x, z: hunted.z };
      }
      if (!aim) aim = { x: field.front.x, z: field.front.z };
      if (hunted && hunted.fleeing && api.lungeReady()) {
        const gap = distance(hunted.x, hunted.z, field.front.x, field.front.z);
        if (gap > 3 && gap < 12) api.lungeAt(hunted.x, hunted.z);
      }
      const safe = avoid(field, aim);
      api.aim(safe.x, safe.z);
    },
  };

  window.__bots = {
    // Steps the game up to `seconds` of sim time, deciding every 6 ticks. Returns progress and stops early when the run ends.
    run(name, seconds, capCount) {
      const strategy = strategies[name];
      const ticks = Math.round(seconds * 60);
      let capAt = null;
      let sample = null;
      const samples = [];
      for (let tick = 0; tick < ticks; tick++) {
        if (tick % 6 === 0) strategy(api.field());
        window.__app.step(1, false);
        if (tick % 300 === 0) {
          const report = api.report();
          samples.push([Math.round(report.seconds), report.count]);
          if (report.state !== 'playing') break;
        }
        const count = window.__debug.swarm.count;
        if (capAt === null && count >= window.__debug.swarm.limit) capAt = api.report().seconds;
      }
      sample = api.report();
      return { report: sample, samples, capAt };
    },
  };
}

async function runOne(browser, name, seed) {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 200)));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text().slice(0, 200)));
  const query = `?bot&seed=${seed}${tune ? `&tune=${tune}` : ''}`;
  await page.goto(`${base}/${query}`, { waitUntil: 'domcontentloaded' });
  for (let attempt = 0; attempt < 600; attempt++) {
    if (await page.evaluate(() => window.__app?.sceneReady)) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(installBots);
  const samples = [];
  let capAt = null;
  let report = null;
  let elapsed = 0;
  const started = Date.now();
  while (elapsed < maxSeconds) {
    const chunk = await page.evaluate(([bot, seconds]) => window.__bots.run(bot, seconds), [name, Math.min(30, maxSeconds - elapsed)]);
    report = chunk.report;
    samples.push(...chunk.samples);
    if (capAt === null && chunk.capAt !== null) capAt = chunk.capAt;
    elapsed = report.seconds;
    if (report.state !== 'playing') break;
    if (chunk.samples.length === 0) break;
  }
  await context.close();
  return { bot: name, seed, survived: report.seconds, ended: report.state !== 'playing', peak: report.peak, finalCount: report.count, capAt, report, samples, errors, wallSeconds: (Date.now() - started) / 1000 };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const jobs = bots.flatMap((name) => seeds.map((seed) => ({ name, seed })));
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const result = await runOne(browser, job.name, job.seed);
    results.push(result);
    const survival = result.ended ? clock(result.survived) : `${clock(result.survived)}+ (alive)`;
    console.log(`${job.name} seed ${job.seed}: survived ${survival}, peak ${result.peak}, end ${result.finalCount}, cap ${result.capAt === null ? '-' : clock(result.capAt)}, ${result.wallSeconds.toFixed(0)} s wall${result.errors.length ? ', ERRORS ' + result.errors[0] : ''}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
await browser.close();

console.log('\n| bot | seeds | survival median | min | max | peak median | peak max | first cap |');
console.log('|---|---|---|---|---|---|---|---|');
for (const name of bots) {
  const runs = results.filter((result) => result.bot === name);
  const caps = runs.filter((run) => run.capAt !== null).map((run) => run.capAt);
  console.log(`| ${name} | ${runs.length} | ${clock(median(runs.map((run) => run.survived)))} | ${clock(Math.min(...runs.map((run) => run.survived)))} | ${clock(Math.max(...runs.map((run) => run.survived)))} | ${median(runs.map((run) => run.peak))} | ${Math.max(...runs.map((run) => run.peak))} | ${caps.length ? clock(Math.min(...caps)) : 'none'} |`);
}
if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(results, null, 1));
