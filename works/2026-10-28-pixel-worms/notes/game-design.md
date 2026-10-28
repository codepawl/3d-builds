# Pixel Worms: play-mode design, passes B and C

Play mode only. `?film` and `?manual` keep the old rules (food releases worms, scheduled hawk and fox).

## Growth by fission (`src/growth.js`)

- Every worm has a belly, 0 to 1.4 (1 = full). A new worm starts at 0.2, the first worm at 0.55.
- A piece of meat hands its food, as it is bitten, only to the worms whose heads are within reach of it (at most 6, the emptiest first). Food is turned into belly by `splitCost(count) = 1.2 + 0.03 * count^0.9` food units per full belly, so a chicken (5 food) is about three splits for a lone worm, about one for a swarm of 100 and a fraction of one for 300; a cow (20) is what a big swarm needs.
- A fuller worm is longer (0.20 to 0.285 m per segment). A worm that is full and off cooldown pinches in the middle for 1.2 s (the middle thins, the worm slows), then splits: the back half becomes a new worm that crawls off to the side. Both get a 7 s cooldown.
- Hunger: every belly drains in 150 s (`foodLife`). At 0 a worm shrinks over 15 s and dies after 40 s more. A bite of food resets the clock. The HUD shows a hunger icon only when a fifth of the swarm is starving.
- Caps: 600 desktop, 250 phone (`swarm.limit`). Food that finds only full bellies is lost.

## Opponents (`src/opponents.js`, `src/hazards.js`)

Each has a telegraph (shadow, wind-up, dust line, sound) that ends in an attack. A dodge started just before it lands is a parry (the attacker is stunned and can be eaten); a later dodge only makes it miss.

| Opponent | From | Attack | Telegraph | Counter |
|---|---|---|---|---|
| Birds (robin, starling) | 1:05 | peck one edge worm, 2 pecks each | shadow grows, chirp | 4 heads on a landed bird eat it |
| Hen | 1:35 | 3 pecks at one edge worm | winds back, cluck | 6 heads |
| Hawk, fox | 2:00 | existing | existing | existing |
| Crows (3 to 6) | 2:30 | dive one after another | a shadow each, caw | 5 heads on a landed crow |
| Farmer | 3:10 | hoe chops 6 + count/15 worms (at most 60) in a circle, 3 chops | hoe goes up, ring on the ground | parry, or a swarm that surrounds him |
| Bear traps, salt | 2:50, 3:40 | existing | existing | go round |
| Hedgehog | 5:00 | rolls into the swarm | curls and spins up, squeal | under 300 worms: steer away; 300 or more eat it |
| Badger | 5:30 | digs in as a moving mound, then 3 big bites | mound line, grunt, then the head rises | 3 parries, or a swarm that is huge |
| Mower | 6:00 | straight lane across the field | dust line plus engine sound, then it drives | leave the lane, or dodge |

Beaten opponents burst into meat (chunks), so fighting back is food.

## Director (`src/director.js`)

A pressure budget fills at `(0.05 + 0.3 * minutes) * (0.7 + 0.35 * log10(count)) * adapt` per second and is spent on unlocked opponents (cost per kind, caps per kind and in total). After a big fight there is a 12 s rest. `adapt` runs 0.35 to 1.8: it falls with recent losses (decaying with a 25 s time constant) and rises when the swarm grew fast over the last 30 s. Concurrent opponents: 1 + one per 100 s + one per 200 worms (at most 5). Birds and hens fade to a tenth of their weight after 2:30 and 4:00, so the cheap early kinds do not farm the swarm all game. A new opponent shows a pixel toast and its icon beside the stats the first time it appears. Prey respawn one at a time at their homes, away from the swarm.

## Bots (`tools/playtest.mjs`)

Headless Chromium, `?play&bot&seed=N`, manual clock, fixed 1/60 s steps, no draw. Bots: idle, simple (nearest creature, no abilities), good (hunts food-weighted, lunges at fleeing prey, dodges at the end of a telegraph, leaves lanes and salt).

## Late pressure (pass C)

After `lateStart` (480 s) the director gets harder every minute (`src/tuning.js`, `src/director.js`): income x(1 + 0.5 per minute), a budget cap that grows by 4 per minute, one more concurrent opponent group per two minutes, rests 10% shorter per minute (at most 70%), and `adapt` cannot fall below 0.35 + 0.12 per minute (at most +0.9). Before 8:00 nothing changes, so idle and simple stay as they were.

## Balance results

8 seeds per bot, 16 minute cap: `node tools/playtest.mjs --seeds 1,2,3,4,5,6,7,8 --minutes 16` (about 2 minutes of wall time at below-normal priority; serve the build first with `npx vite preview --port 4177 --host 127.0.0.1`).

| bot | survival median | min | max | peak swarm median | peak max | first cap (600) |
|---|---|---|---|---|---|---|
| idle | 1:07 | 1:07 | 1:07 | 1 | 1 | never |
| simple | 4:55 | 1:13 | 9:42 | 61 | 89 | never |
| good | 13:08 | 12:57 | 13:27 | 150 | 169 | never |

- Pass B: good bot alive at 14:00 in all 8 seeds. Pass C: all 8 die between 12:57 and 13:27 (target 10 to 16 minutes); idle is unchanged and simple's median is unchanged (4:55; its longest run went from 10:13 to 9:42).
- idle: the first bird flock arrives at about 1:05 and takes the lone worm.
- simple: bimodal. Two seeds (1:13, 1:22) never caught their first chicken and the first birds finished them; the rest die between 4:19 and 9:42.
- good: swarm 8 at 25 s, about 100 at 1:40, peak 127 to 169 around 2 to 4 minutes, cut to 40 to 60 by mid opponents and rebuilt, then worn down after 8:00 by the late pressure. The deaths are close together (12:57 to 13:27) because the late ramp is deterministic; widen it with a lower `lateIncomeGain` if a wider spread is wanted.
- Nobody reaches the cap: the field gives about 4k food in 14 minutes, the cap needs 5.7k.
- The bots run with `?bot`, which never starts the tutorial.
- Re-run the bots after any change to `src/tuning.js`, `src/director.js` or `src/opponents.js`.

## Onboarding (`src/tutorial.js`)

Play mode, first run only (localStorage `pixel-worms-tutorial-done`), replayed by "How to play" next to Credits, `?notutorial` turns it off, `?bot` never has it. Four steps, each once: a pulsing ring ahead with "Move the mouse" ("Drag to steer"), an arrow and "Eat" on a chicken (then "Full worms split in two" at the first fission), "Left click to lunge" on the first fleeing creature with the lunge button pulsing, and at the first telegraph a 30% slow-down for up to 2 s with the spot outlined and the dodge button pulsing. The director holds real opponents back until the lunge step is done or 60 s have passed. Labels are DOM text projected from world points every frame and clamped to the screen. Skip is at the top centre.

## Frame rate (pass C)

`node tools/perf_play.mjs` (play mode, 1440x900, below-normal priority, swarm held at about 625 and 6 to 13 opponents stocked): the draw calls were the cost. Every box of an opponent was its own mesh (a hedgehog alone has about 40) and every creature, off screen or not, was drawn twice (shadow and picture). Now each opponent model is merged into one mesh per moving part (`bakeBoxes` in `src/blocks.js`, vertex colours, one shared material) and creatures outside the camera view (plus 7 m for their shadows) are not drawn or posed (`Creatures.applyPose`).

| | before | after |
|---|---|---|
| draw calls per frame (picture + shadow every other frame) | 2270 | 500 to 1000 |
| render per frame | 9.0 to 10.2 ms | 5.8 to 7.2 ms |
| real-time fps (rAF) | 55 to 57 at about 450 worms | 56 to 57 at 624 worms |

The rest of the frame is the swarm simulation (4.6 ms of 5.4 ms) and the worm mesh, which pass C did not touch. The fps in the headless browser tops out near 57 to 59, so the frame is no longer render bound (about 12.6 ms of work per 16.7 ms frame).

## Readability (pass C)

Opponents are about 1.3x bigger (hen 1.8, farmer 1.9, hedgehog 2.1, badger 2.2, birds 1.5, crows 2.2, mower 1.6, hawk 1.7, fox 2.6). Crows are small birds with a head, beak, tail, short legs and wings that fold on the sides when they sit and beat in the air. The mower is a red riding mower with a driver and a spray of grass cubes; its pixels carry alpha 0.85, which the post pass reads as an accent and keeps out of the quiet-world grade (that grade turns every red grey except worms). The lane is a pale strip with red edge lines, and a dust line grows behind the mower.

## Left

- Frame rate: the swarm step (4.6 ms at 625 worms) is now the biggest single cost; the worm mesh update is next.
- Nobody has listened to the new sounds (crow caw, mower engine, chicken squeak, hedgehog squeal, badger grunt).
- The pinch is a thinning of the middle plus a swelling of both ends; it reads in motion but could be stronger.
- The tutorial was checked with bots steering the swarm, not with a real mouse or finger.
