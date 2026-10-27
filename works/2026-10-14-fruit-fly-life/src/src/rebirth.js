// Beat 6, 4 s: after the parents die, their children's life runs again at speed, so the film closes as a cycle. The
// push onto the empty shells cuts to an egg hatching on the flesh, the larva eats and grows, pupates, and a new fly
// climbs out and opens her wings; that fly dissolves into the opening frame, where she lays her own eggs.
// The earlier beats are replayed frame for frame (their bare scenes), sped up; only the line boil keeps real time.
"use strict";

const Rebirth = (() => {
  const { progress, beatTime } = Ink;
  const SIZE = 1080;
  const DURATION = 4;
  // Each piece replays a stretch of an earlier beat's own film time, squeezed into a length of this beat.
  const PIECES = [
    { scene: () => Larva, from: 2.0, to: 6.0, length: 1.2 },
    { scene: () => Metamorphosis, from: 0.0, to: 3.5, length: 1.0 },
    { scene: () => Metamorphosis, from: 6.0, to: 10.0, length: 1.8 },
  ];
  const DISSOLVE_START = 3.5;

  let openingLayer = null;
  function openingFrame() {
    if (!openingLayer) {
      openingLayer = document.createElement("canvas");
      openingLayer.width = SIZE;
      openingLayer.height = SIZE;
      Opening.renderAt.raw(openingLayer.getContext("2d"), beatTime(0));
    }
    return openingLayer;
  }

  function renderAt(context, time) {
    let start = 0;
    let piece = PIECES[PIECES.length - 1];
    for (const candidate of PIECES) {
      if (time < start + candidate.length) {
        piece = candidate;
        break;
      }
      start += candidate.length;
    }
    if (piece === PIECES[PIECES.length - 1]) {
      start = DURATION - piece.length;
    }
    const sourceTime = piece.from + (piece.to - piece.from) * Math.min(1, (time - start) / piece.length);
    context.save();
    piece.scene().renderAt.raw(context, beatTime(sourceTime));
    context.restore();
    const dissolve = progress(time, DISSOLVE_START, DURATION);
    if (dissolve > 0) {
      context.globalAlpha = dissolve;
      context.drawImage(openingFrame(), 0, 0);
      context.globalAlpha = 1;
    }
    Ink.sketchPass(context, time, SIZE);
  }

  return { renderAt, DURATION, PIECES };
})();
