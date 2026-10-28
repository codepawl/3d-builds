// Loading progress for the pixel loader in index.html. Every model and texture goes through this one manager, so the bar
// fills from real loads; the last tenth is the "building world" step that main.js reports when the first frame is drawn.
import * as THREE from 'three';

// About how many files a normal start loads (models, their textures); the manager's own total grows as loads begin.
const EXPECTED_FILES = 90;
const FILES_SHARE = 0.9;
const loader = document.getElementById('loading');
let shown = 0;

function show(fraction) {
  shown = Math.max(shown, Math.min(1, fraction));
  if (loader) loader.style.setProperty('--p', shown.toFixed(3));
}

export const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => show((FILES_SHARE * loaded) / Math.max(total, EXPECTED_FILES));

export function reportWorldBuilt() {
  show(1);
}

// Fades the loader out and removes it once the fade ends.
export function hideLoader() {
  if (!loader) return;
  show(1);
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 600);
}
