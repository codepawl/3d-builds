// Every number that decides how hard play mode is. The bots override them with `?tune=name:value,name:value` while balancing.
export const TUNING = {
  // Growth by fission
  splitBase: 1.2, // food units that fill one belly of a lone worm
  splitSlope: 0.03,
  splitPower: 0.9,
  foodLife: 150, // seconds for a full belly to drain
  startBelly: 0.55,
  childBelly: 0.2,
  splitCooldown: 7,
  pinchSeconds: 1.2,
  bellyCap: 1.4,
  maxBiters: 6,
  shrinkSeconds: 15,
  dieSeconds: 40,
  // Director
  incomeBase: 0.05,
  incomePerMinute: 0.3,
  restSeconds: 12,
  respawnSeconds: 9,
  unlockScale: 1, // multiplies every unlock time
  hungerIconFraction: 0.2,
  // Late pressure: after lateStart seconds the budget fills faster, more opponents run at once, rests get shorter and `adapt` stops easing off.
  lateStart: 480,
  lateIncomeGain: 0.5, // extra income multiplier per minute past lateStart
  lateSlotsPerMinute: 0.5,
  lateRestCut: 0.1, // share of the rest taken off per minute past lateStart (at most 70%)
  lateAdaptFloor: 0.12, // raises the lowest `adapt` by this much per minute past lateStart (at most 0.9)
};

if (typeof location !== 'undefined') {
  const raw = new URLSearchParams(location.search).get('tune');
  for (const pair of raw ? raw.split(',') : []) {
    const [name, value] = pair.split(':');
    if (name in TUNING && Number.isFinite(Number(value))) TUNING[name] = Number(value);
  }
}

// Food units one worm needs to fill its belly (and so to split) in a swarm of `count`.
export function splitCost(count) {
  return TUNING.splitBase + TUNING.splitSlope * Math.pow(Math.max(1, count), TUNING.splitPower);
}
