// Prints worm counts at set seconds and every predator and trap event (with kills) from shots/state_log.json.
import fs from 'node:fs';
const log = JSON.parse(fs.readFileSync(new URL('../shots/state_log.json', import.meta.url), 'utf8'));
console.log([0, 3, 6, 12, 20, 26, 30].map((second) => `${second}s=${log[Math.min(log.length - 1, second * 60)].worms}`).join(' '));
const events = log.flatMap((entry) => (entry.hazardEvents ?? []).map((event) => ({ ...event, frame: entry.frame })));
for (const event of events) console.log(`${event.time.toFixed(2)} s f${event.frame} ${event.kind} killed=${event.killed}`);
const totals = {};
for (const event of events) totals[event.kind] = (totals[event.kind] ?? 0) + event.killed;
console.log(JSON.stringify(totals));
