// What the scene does at each timeline moment. A beat is a few shots: each shot names the world it shows
// (county map, village, farm, or a generic tavern or grocery), the camera, and the one caption line on screen.
// Every animation in the worlds runs on the time since its shot started, so selecting a moment again, forward or
// back, replays it. Captions are shortened from the event texts in data.js; facts stay as in the fact file.
import { END } from './data.js'

// Camera views in each world's own metres.
export const VIEWS = {
  villageMorning: { position: [-62, 40, 118], target: [12, 2, 40] },
  villageTruck: { position: [84, 24, 92], target: [46, 1, 44] },
  villageDoor: { position: [-18, 7, 66], target: [14, 2.5, 44.5], smoothTime: 2.4 },
  villageSlip: { position: [-30, 16, 78], target: [16, 6, 44] },
  farm: { position: [30, 13, 46], target: [-2, 3, -3] },
  farmFire: { position: [26, 10, 36], target: [-3, 4, -6], smoothTime: 3 },
  tavern: { position: [15, 6.5, 22], target: [-0.5, 2.2, -2], smoothTime: 3 },
  grocery: { position: [17, 7, 21], target: [2.6, 1.6, 3], smoothTime: 3 },
  // County map: metres from the store point, x east, z south.
  county: { position: [2800, 45000, 21500], target: [2800, 0, 3900] },
  route: { position: [-2400, 8600, 10400], target: [-3700, 0, 1700] },
  // Portrait variants, used when the frame is taller than wide: the subject stays inside the narrow frame.
  routePortrait: { position: [-3300, 12500, 12800], target: [-3500, 0, 1300] },
  villageTruckPortrait: { position: [112, 20, 70], target: [46, 1, 44] },
  end: { position: [1800, 47000, 15500], target: [1800, 0, 1200] },
}

// `place` views are made by the app from the place's map point; `distance` scales the default height.
export const BEATS = {
  e1940: { hold: 1.8, shots: [{ scale: 'county', place: 'farm', distance: 1.2, caption: 'George Gein dies, age 66.' }] },
  e1944: { hold: 1.8, shots: [{ scale: 'county', place: 'farm', distance: 1.2, caption: 'Henry Gein dies after a brush fire got out of control.' }] },
  e1945: { hold: 1.8, shots: [{ scale: 'county', place: 'farm', distance: 1.2, caption: 'Augusta Gein dies after strokes, age 67.' }] },
  e1947: { hold: 2.2, shots: [{ scale: 'county', view: 'county', caption: 'His own later account: night visits to local graveyards.' }] },
  e1954: {
    hold: 5.6,
    shots: [
      { scale: 'county', place: 'pinegrove', distance: 1.5, caption: 'Mary Hogan, tavern keeper, disappears late in the afternoon.' },
      { at: 1.6, scale: 'tavern', view: 'tavern', caption: 'Her tavern in the Town of Pine Grove is found empty. No suspect.' },
    ],
  },
  e1957morning: { hold: 3.0, shots: [{ scale: 'village', view: 'villageMorning', caption: 'Deer season opens. Bernice Worden, 58, minds her store.' }] },
  e0930: { hold: 3.4, shots: [{ scale: 'village', view: 'villageTruck', caption: "The store's truck drives out from the rear of the building." }] },
  e1700: { hold: 4.0, shots: [{ scale: 'village', view: 'villageDoor', caption: 'Her son Frank finds blood on the floor, his mother gone.' }] },
  eslip: {
    hold: 4.4,
    shots: [
      { scale: 'village', view: 'villageSlip', caption: 'The last receipt is a sales slip for antifreeze.' },
      { at: 1.9, scale: 'county', view: 'route', caption: 'Gein was due back for antifreeze, Frank says. The lead goes west.' },
    ],
  },
  enight: {
    hold: 7.0,
    shots: [
      { scale: 'county', view: 'route', caption: 'That night, deputies drive to the farm; Gein is not home.' },
      { at: 2.0, scale: 'grocery', view: 'grocery', caption: 'He is taken into custody at West Plainfield.' },
      { at: 4.3, scale: 'farm', view: 'farm', caption: 'The farm is searched by flood lamp. Sources differ on the order.' },
    ],
  },
  e1121: { hold: 2.2, shots: [{ scale: 'county', place: 'courthouse', distance: 2.4, caption: 'Arraigned in Wautoma; he pleads not guilty by reason of insanity.' }] },
  e1125: { hold: 1.9, shots: [{ scale: 'county', place: 'cemetery', distance: 0.45, smooth: 0.4, caption: 'Test graves opened at Plainfield Cemetery: the caskets are empty.' }] },
  e1958a: { hold: 1.2, shots: [{ scale: 'county', place: 'waupun', distance: 1.3, smooth: 0.35, caption: 'Found unfit for trial; committed to the hospital at Waupun.' }] },
  e1958fire: { hold: 2.8, shots: [{ scale: 'farm', view: 'farmFire', caption: 'The farmhouse burns, ten days before the auction.' }] },
  e1968: { hold: 1.8, shots: [{ scale: 'county', place: 'courthouse', distance: 0.55, slow: true, caption: 'Trial for Bernice Worden: found not guilty by reason of insanity.' }] },
  e1984: { hold: 1.8, shots: [{ scale: 'county', place: 'mendota', distance: 1.3, caption: 'Dies at Mendota Mental Health Institute, Madison, age 77.' }] },
  [END.id]: { hold: Infinity, shots: [{ scale: 'county', view: 'end', caption: 'Two women were killed: Mary Hogan, 1954, and Bernice Worden, 1957.' }] },
}

// The hour shown large on 16 Nov 1957. All times of day are approximate.
export const HOUR_TEXT = {
  e1957morning: 'MORNING',
  e0930: 'ABOUT 9:30 AM',
  e1700: 'ABOUT 5:00 PM',
  eslip: 'EVENING',
  enight: 'THAT NIGHT',
}

// Light per world and moment, for shots whose world differs from the event's own.
export function shotLight(moment, shot, eventLight) {
  if (shot.scale === 'tavern') return 'dusk'
  if (shot.scale === 'grocery' || shot.scale === 'farm') return 'night'
  return eventLight
}
