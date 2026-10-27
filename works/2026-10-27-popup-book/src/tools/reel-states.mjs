// The reel's script: for a time in seconds, the book state and camera. Beat times are reported to the caller.
const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const between = (seconds, from, to) => smooth((seconds - from) / (to - from));
const mix = (a, b, x) => a + (b - a) * x;
// zoom is a distance, so it eases geometrically: equal steps feel like equal dolly moves
const mixZoom = (a, b, x) => a * Math.pow(b / a, x);

export const BEATS = {
  coverOpens: [2.4, 5.6], popUpHold: [5.6, 8.0], pullTab: [8.0, 11.0], flap: [12.2, 13.4], volvelle: [14.6, 17.0],
  pageTurn: [18.0, 21.0], steamTab: [22.8, 26.4], pushOut: [26.8, 30],
};

// Close framings, found with window.book.locate (the world centre of each detail) and sized so the whole detail
// fills most of the 16:9 frame: visible width at the target is about 153 cm x zoom.
const BOILER_BOX = { zoom: 0.16, yaw: 0.0, pitch: 0.15, focusX: 3.9, focusY: -10.1, focusZ: 7.7 };
const BRIDGE_FLAP = { zoom: 0.062, yaw: -0.05, pitch: -0.08, focusX: 24.2, focusY: -5.2, focusZ: 4.5 };
const VOLVELLE_CARD = { zoom: 0.3, yaw: 0.0, pitch: 0.3, focusX: 25.4, focusY: -12.4, focusZ: 27.3 };
const STEAM_LOOP = { zoom: 0.31, yaw: 0.0, pitch: 0.12, focusX: -8.0, focusY: -7.3, focusZ: -0.25 };
const FRAME_KEYS = ['yaw', 'pitch', 'focusX', 'focusY', 'focusZ'];

function blend(s, from, to, x, zoomFrom = from.zoom, zoomTo = to.zoom) {
  s.zoom = mixZoom(zoomFrom, zoomTo, x);
  for (const key of FRAME_KEYS) s[key] = mix(from[key], to[key], x);
}

export function stateAt(seconds) {
  const s = {};
  s.t = between(seconds, 2.4, 5.6) + between(seconds, 18.0, 21.0);
  s.slide = between(seconds, 8.0, 11.0);
  s.flap = between(seconds, 12.2, 13.4) * (1 - between(seconds, 15.4, 15.6));
  const wheelStops = between(seconds, 14.6, 15.1) + between(seconds, 15.4, 15.9) + between(seconds, 16.5, 17.0);
  s.wheelAngle = -(Math.PI / 4) * wheelStops;
  s.steam = between(seconds, 22.8, 26.4);
  s.zoom = 1.0;
  s.yaw = 0;
  s.pitch = 0;
  s.focusX = 0;
  s.focusY = 0;
  s.focusZ = 0;
  if (seconds < 2.4) {
    s.zoom = mix(1.12, 1.0, between(seconds, 0, 2.4));
    s.yaw = mix(-0.2, -0.06, between(seconds, 0, 2.4));
    s.pitch = -0.04;
  } else if (seconds < 8.0) {
    // the cover opens and the first pop-up rises: a low camera that sweeps sideways, so the layers show their depth
    const open = between(seconds, 2.4, 5.6);
    s.zoom = mix(1.0, 0.9, open) * mix(1, 0.88, between(seconds, 5.6, 8.0));
    s.yaw = mix(-0.06, 0.16, open) + mix(0, -0.34, between(seconds, 5.2, 8.0));
    s.pitch = mix(-0.04, -0.12, open) + mix(0, 0.03, between(seconds, 5.6, 8.0));
    s.focusY = mix(0, -1.5, between(seconds, 5.6, 8.0));
  } else if (seconds < 12.0) {
    // pull tab: dolly in on the whole revealed boiler box
    const overview = { zoom: 0.79, yaw: -0.18, pitch: -0.09, focusX: 0, focusY: -1.5, focusZ: 0 };
    blend(s, overview, BOILER_BOX, between(seconds, 8.0, 9.8));
  } else if (seconds < 14.4) {
    blend(s, BOILER_BOX, BRIDGE_FLAP, between(seconds, 12.0, 12.9));
  } else if (seconds < 18.0) {
    const k = between(seconds, 14.0, 14.9);
    const back = between(seconds, 17.2, 17.9);
    blend(s, BRIDGE_FLAP, VOLVELLE_CARD, k);
    const overview = { zoom: 0.9, yaw: -0.06, pitch: 0, focusX: 0, focusY: 0, focusZ: 0 };
    if (back > 0) blend(s, VOLVELLE_CARD, overview, back);
  } else if (seconds < 22.8) {
    // page two rises: low again, sliding sideways
    s.zoom = mix(0.9, 0.78, between(seconds, 18.0, 22.8));
    s.yaw = mix(-0.06, -0.2, between(seconds, 18.0, 22.8));
    s.pitch = mix(0.0, -0.1, between(seconds, 18.5, 22.8));
    s.focusY = mix(0, -1, between(seconds, 18.0, 22.8));
  } else if (seconds < 26.6) {
    const overview = { zoom: 0.78, yaw: -0.2, pitch: -0.1, focusX: 0, focusY: -1, focusZ: 0 };
    blend(s, overview, STEAM_LOOP, between(seconds, 22.8, 24.2));
  } else {
    const finish = { zoom: 1.1, yaw: -0.14, pitch: -0.04, focusX: 0, focusY: 0, focusZ: 0 };
    blend(s, STEAM_LOOP, finish, between(seconds, 26.8, 30));
  }
  s.caption = null;
  if (seconds >= 8.4 && seconds < 12.0) s.caption = 'slider';
  else if (seconds >= 12.5 && seconds < 14.6) s.caption = 'flap';
  else if (seconds >= 14.8 && seconds < 17.6) s.caption = 'wheel';
  else if (seconds >= 23.0 && seconds < 27.2) s.caption = 'steam';
  return s;
}
