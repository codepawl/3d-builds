// The film's "player", shared by the recorder and the fast probe. It runs inside the page: for each frame it says where in the
// world the cursor should point (a waypoint, a roof, or one creature to hunt), and turns that into a smoothed screen position,
// so the swarm is driven by a believable hand and not by a teleporting target.
//
// The route is a list of legs in film_plan.json, each running until its `until` frame:
//   { type: 'point', x, z, y }                          point the cursor at a spot (y > 1 aims at a roof)
//   { type: 'hunt', kinds, near: [x, z], radius, fallback: [x, z] }
//        eat one creature at a time: the one of those kinds, within `radius` of `near`, closest to the swarm front;
//        when none is left the cursor goes to `fallback`
// Frames are 60 per second. `speedKeys`, `eatGapKeys` and `growthKeys` are lists of [frame, value] interpolated between keys: the swarm crawl speed scale
// (1 = as in play), the minimum seconds between two eats (0 = as in play) and the worms each eat adds (a multiplier).
(() => {
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const FPS = 60;
  const cursor = { x: 1010, y: 760 };

  // A hunt commits to one creature for a while; one that outruns the swarm is put on a skip list.
  const commitment = { name: null, since: 0 };
  const skipUntil = new Map();

  function chooseCreature(frame, front, leg) {
    const alive = window.__app.creatures();
    const commitFrames = leg.commit ?? 180;
    if (commitment.name !== null) {
      const kept = alive.find((creature) => creature.id === commitment.name);
      if (kept && frame - commitment.since < commitFrames) return kept;
      if (kept) skipUntil.set(commitment.name, frame + 240);
    }
    let best = null;
    let bestDistance = Infinity;
    for (const creature of alive) {
      if (!leg.kinds.includes(creature.kind)) continue;
      if ((skipUntil.get(creature.id) ?? -1) > frame) continue;
      if (Math.hypot(creature.x - leg.near[0], creature.z - leg.near[1]) > leg.radius) continue;
      const distance = Math.hypot(creature.x - front.x, creature.z - front.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = creature;
      }
    }
    commitment.name = best ? best.id : null;
    commitment.since = frame;
    return best;
  }

  function keysAt(frame, keys, fallback) {
    if (!keys || keys.length === 0) return fallback;
    if (frame <= keys[0][0]) return keys[0][1];
    for (let index = 1; index < keys.length; index++) {
      if (frame <= keys[index][0]) {
        const [fromFrame, fromScale] = keys[index - 1];
        const [toFrame, toScale] = keys[index];
        return fromScale + ((toScale - fromScale) * (frame - fromFrame)) / (toFrame - fromFrame);
      }
    }
    return keys[keys.length - 1][1];
  }

  // Where the cursor should point this frame, in world metres, and what it is doing.
  function goalFor(frame, plan) {
    window.__app.setSwarmSpeed(keysAt(frame, plan.speedKeys, 1));
    window.__app.setEatGap(keysAt(frame, plan.eatGapKeys, 0));
    window.__app.setGrowth(keysAt(frame, plan.growthKeys, 1));
    window.__app.setSwarmSpread(keysAt(frame, plan.spreadKeys, 1));
    window.__app.setFleeScale(keysAt(frame, plan.fleeKeys, 1));
    const front = window.__app.state().front;
    const leg = plan.legs.find((candidate) => frame < candidate.until) ?? plan.legs[plan.legs.length - 1];
    if (leg.type === 'point') return { x: leg.x, z: leg.z, y: leg.y ?? 0.6, label: leg.label ?? 'point' };
    // Stay on a fresh carcass for about a second so the chunks are seen being eaten, then go for the next creature.
    const fresh = window.__app.chunks().filter((chunk) => chunk.age < 0.7 && Math.hypot(chunk.x - front.x, chunk.z - front.z) < 9);
    if (fresh.length > 0) {
      fresh.sort((a, b) => Math.hypot(a.x - front.x, a.z - front.z) - Math.hypot(b.x - front.x, b.z - front.z));
      return { x: fresh[0].x, z: fresh[0].z, y: 0.3, label: `${leg.label ?? 'hunt'}-carcass` };
    }
    const creature = chooseCreature(frame, front, leg);
    if (!creature) return { x: leg.fallback[0], z: leg.fallback[1], y: 0.6, label: `${leg.label ?? 'hunt'}-fallback` };
    return { x: creature.x, z: creature.z, y: 0.5, label: `${leg.label ?? 'hunt'}-${creature.kind}` };
  }

  // Move the smoothed cursor a step toward the screen position of a world goal. Returns the new client position.
  function nextCursor(goal) {
    const app = window.__app;
    const screen = app.worldToScreen(goal.x, goal.z, goal.y);
    const desiredX = screen.behind ? 1700 : clamp(screen.x, 40, 1880);
    const desiredY = screen.behind ? 800 : clamp(screen.y, 300, 1040);
    const dx = desiredX - cursor.x;
    const dy = desiredY - cursor.y;
    const distance = Math.hypot(dx, dy);
    const stepLength = Math.min(distance, Math.max(3, distance * (window.__film.ease ?? 0.12)), window.__film.maxStep ?? 38);
    if (distance > 0.5) {
      cursor.x += (dx / distance) * stepLength;
      cursor.y += (dy / distance) * stepLength;
    }
    return { x: Math.round(cursor.x * 10) / 10, y: Math.round(cursor.y * 10) / 10 };
  }

  window.__film = { FPS, goalFor, nextCursor, cursor, ease: 0.12, maxStep: 38 };
})();
