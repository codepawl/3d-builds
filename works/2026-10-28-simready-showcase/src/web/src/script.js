// The film's input script: when each real click, drag and key press happens (seconds on the virtual clock).
// film.mjs reads it through window.__script and performs the inputs; film.js reads it to seek to a time for stills,
// and sound/make_sound.py reads out/cue_events.json, which film.mjs derives from effectCues() below.
export const SCRIPT = {
  beats: [0, 8.0, 18.4, 25.0], // vise slider, progress (NVIDIA original to ours), whole set, end card
  endSeconds: 29.0,
  grab: 1.2, // the cursor is already gliding to the handle on the first frame
  // each segment moves the handle to x over `frames` frames; a segment with only `hold` pauses
  dragSegments: [{ to: 1500, frames: 30 }, { hold: 6 }, { to: 520, frames: 42 }, { hold: 4 }, { to: 960, frames: 24 }],
  handleStartX: 960,
  closeupKey: 5.7,
  stepClicks: [9.0, 10.8, 12.6, 14.4], // export to glb, dedupe instances, textures to WebP, meshopt geometry
  setClick: 19.5,
};

export const REPO_NAME = 'huggingface.co/codepawl/simready-glb';

/** Soft sound cues that are not mouse or keyboard inputs: transitions and slides. Times in film seconds. */
export function effectCues(script = SCRIPT) {
  const cues = [];
  for (const cut of script.beats.slice(1)) cues.push({ time: cut - 0.2, kind: 'whoosh', name: 'transition' });
  let frame = 0;
  for (const segment of script.dragSegments) {
    if (segment.hold === undefined) cues.push({ time: script.grab + frame / 30, kind: 'whoosh', name: 'slide' });
    frame += segment.hold ?? segment.frames;
  }
  cues.push({ time: script.closeupKey + 0.05, kind: 'whoosh', name: 'closeup' });
  return cues.sort((a, b) => a.time - b.time);
}
