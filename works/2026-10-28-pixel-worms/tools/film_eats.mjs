// Prints the recorded film's eats and worm counts from shots/state_log.json: every eat time, and a table per beat.
import fs from 'node:fs';
const log = JSON.parse(fs.readFileSync(new URL('../shots/state_log.json', import.meta.url), 'utf8'));
const eats = [];
for (const entry of log) for (const eaten of entry.eaten) eats.push({ frame: entry.frame, kind: eaten.kind });
console.log(`eats: ${eats.length}`);
console.log(eats.map((eat) => `${(eat.frame / 60).toFixed(2)}${eat.kind[0]}`).join(' '));
const beats = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 26], [26, 30]];
for (const [from, to] of beats) {
  const inside = eats.filter((eat) => eat.frame >= from * 60 && eat.frame < to * 60).length;
  const startWorms = log[Math.max(0, from * 60 - 1)].worms;
  const endWorms = log[Math.min(log.length - 1, to * 60 - 1)].worms;
  console.log(`${from}-${to} s: eats ${inside}, worms ${startWorms} -> ${endWorms}`);
}
let longestGap = 0;
let gapStart = 0;
for (let index = 1; index < eats.length; index++) {
  const gap = (eats[index].frame - eats[index - 1].frame) / 60;
  if (eats[index].frame < 1200 && gap > longestGap) { longestGap = gap; gapStart = eats[index - 1].frame / 60; }
}
console.log(`longest gap between eats before 20 s: ${longestGap.toFixed(2)} s from ${gapStart.toFixed(2)} s`);
