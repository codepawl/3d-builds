// One collision check for everything that must stay readable on screen: the text and frames the kit lays
// over the figure (legend rows, badges, step marks, step labels, trace strip, readout, corner texts, the
// zoom frame) against each other and against the machine's assemblies, and, while the machine is apart,
// the assemblies against each other. `measureScene` runs inside the page (record and verify pass it to
// page.evaluate); `collisionProblems` turns the samples into failures. Overlap that is physically real
// (a part inside another, a cable crossing) is declared in machine.mjs `film.overlapAllowed` as
// [first, second, reason]; nothing else may overlap (references/film.md, "Nothing covers anything").

// Runs in the page. Returns [{ first, second, area }] for this frame. `pieces` also tests assembly
// against assembly (only meaningful when the machine is apart); `step` is the sampling grid in pixels.
export function measureScene({ pieces = false, step = 12, least = 120 } = {}) {
  const width = innerWidth;
  const height = innerHeight;
  const config = window.__anatomy.pieces;
  const opacityOf = (element) => {
    let share = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) share *= Number(getComputedStyle(node).opacity);
    return share;
  };
  const overlays = [];
  const add = (name, element, kind, ofPiece = null) => {
    if (!element || opacityOf(element) < 0.15) return;
    const rect = element.getBoundingClientRect();
    const box = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(width, rect.right), bottom: Math.min(height, rect.bottom) };
    if (box.right - box.left < 2 || box.bottom - box.top < 2) return;
    overlays.push({ name, element, kind, ofPiece, ...box });
  };
  document.querySelectorAll(".ma-film-legend li").forEach((row, index) => add(`legend row ${index + 1}`, row, "text"));
  document.querySelectorAll("[data-badge]").forEach((badge) => add(`badge ${badge.textContent}`, badge, "badge", badge.getAttribute("data-badge")));
  document.querySelectorAll("[data-stepmark]").forEach((mark) => add(`step mark ${mark.textContent}`, mark, "badge"));
  document.querySelectorAll(".ma-steps li").forEach((row, index) => add(`step label ${index + 1}`, row, "text"));
  add("trace strip", document.querySelector(".ma-trace"), "text");
  add("readout", document.querySelector("[data-readout]"), "text");
  document.querySelectorAll(".iso-plate-corner").forEach((corner) => add(`corner ${corner.getAttribute("data-corner") ?? ""}`.trim(), corner, "text"));
  const zoomShown = Number(getComputedStyle(document.querySelector('[data-dyn="zoom"]') ?? document.body).opacity) > 0.15;
  if (zoomShown) add("zoom frame", document.querySelector('[data-dyn="zoom-edge"]'), "zoom");

  const found = new Map();
  const note = (first, second, area) => {
    const key = [first, second].sort().join("|");
    found.set(key, { first, second, area: (found.get(key)?.area ?? 0) + area });
  };
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (let first = 0; first < overlays.length; first++) {
    for (let second = first + 1; second < overlays.length; second++) {
      const nested = overlays[first].element.contains(overlays[second].element) || overlays[second].element.contains(overlays[first].element);
      const area = nested ? 0 : overlap(overlays[first], overlays[second]);
      if (area > 4) note(overlays[first].name, overlays[second].name, area);
    }
  }
  const pieceAt = (element) => {
    const item = element.closest?.(".ma-item");
    if (!item || element.closest("[class^='ma-fx'],[class*=' ma-fx']") || opacityOf(element) < 0.15) return null;
    return item.getAttribute("data-piece");
  };
  const isScenery = (name) => config[name]?.badge === false;
  for (const overlay of overlays) {
    for (let y = overlay.top + step / 2; y < overlay.bottom; y += step) {
      for (let x = overlay.left + step / 2; x < overlay.right; x += step) {
        const hits = new Set(document.elementsFromPoint(x, y).map(pieceAt).filter(Boolean));
        for (const piece of hits) {
          if (overlay.ofPiece === piece) continue;
          if (overlay.kind !== "text" && isScenery(piece)) continue;
          note(overlay.name, isScenery(piece) ? `scenery (${piece})` : `assembly ${piece}`, step * step);
        }
      }
    }
  }
  if (pieces) {
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const hits = [...new Set(document.elementsFromPoint(x, y).map(pieceAt).filter((name) => name && !isScenery(name)))];
        for (let first = 0; first < hits.length; first++) {
          for (let second = first + 1; second < hits.length; second++) note(`assembly ${hits[first]}`, `assembly ${hits[second]}`, step * step);
        }
      }
    }
  }
  return [...found.values()].filter((entry) => entry.area >= (entry.first.startsWith("assembly") || entry.second.startsWith("assembly") || entry.second.startsWith("scenery") ? least : 4)).map((entry) => ({ ...entry, area: Math.round(entry.area) }));
}

function allowedKey(first, second) {
  return [first, second].sort().join("|");
}

// Samples: [{ at, label, collisions }]. Returns one sentence per colliding pair, with its first time, the
// largest area and how many samples it showed in, skipping the declared physical overlaps.
// An entry ["*", "board", reason] excuses anything drawn over a ground piece every part stands on.
export function collisionProblems(samples, allowed = []) {
  const excused = new Set(allowed.filter(([first]) => first !== "*").map(([first, second]) => allowedKey(`assembly ${first}`, `assembly ${second}`)));
  const grounds = new Set(allowed.filter(([first]) => first === "*").map(([, second]) => `assembly ${second}`));
  const pairs = new Map();
  for (const sample of samples) {
    for (const collision of sample.collisions) {
      const key = allowedKey(collision.first, collision.second);
      if (excused.has(key) || grounds.has(collision.first) || grounds.has(collision.second)) continue;
      const seen = pairs.get(key) ?? { ...collision, at: sample.at, label: sample.label, count: 0, largest: 0 };
      seen.count += 1;
      seen.largest = Math.max(seen.largest, collision.area);
      pairs.set(key, seen);
    }
  }
  return [...pairs.values()].map((pair) => `${pair.first} overlaps ${pair.second} at ${pair.label ?? `${pair.at.toFixed(2)} s`} (up to ${pair.largest} px², ${pair.count} samples)`);
}
