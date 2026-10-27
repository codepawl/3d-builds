import fs from 'node:fs';
const file = '<your folder>/popup-book/web/art1.js';
let s = fs.readFileSync(file, 'utf8');
const swap = (from, to, all = false) => {
  if (!s.includes(from)) { console.log('MISSING', from.slice(0, 60)); return; }
  s = all ? s.split(from).join(to) : s.replace(from, to);
};
swap('const SHIP_PX_PER_CM = 56.3;\nconst SHIP_CROP = { x: 86, y: 384, width: 3489, height: 426 };', 'const SHIP_CROP = { x: 86, y: 384, width: 3489, height: 426 };\nconst SHIP_PX_PER_CM = SHIP_CROP.width / 74;');
swap('depth: 6.5,\n    height: shipHeightCm,', 'depth: 7.9,\n    height: shipHeightCm,');
swap('platform: makeCard({ width: shipWidthCm, length: 6.5, thick: 0.1, front: paperMaterial(canvasToTexture(THREE, paintDeck(shipWidthCm * 40, 6.5 * 40), renderer)) })', 'platform: makeCard({ width: shipWidthCm, length: 7.9, thick: 0.1, front: paperMaterial(canvasToTexture(THREE, paintDeck(shipWidthCm * 40, 7.9 * 40), renderer)) })');
swap('const hullHeight = 3.2;\n  const windowCm = { left: -10.2, right: 11.3, bottom: 0.4, top: 2.8 };', 'const hullHeight = 3.8;\n  const windowCm = { left: -12.2, right: 13.5, bottom: 0.5, top: 3.4 };');
swap("depth: 8.2,\n    height: hullHeight,\n    halfWidth: 33.45,\n    strutHalfWidth: 33.45,\n    wall: makeCutout({ width: 67.8, length: hullHeight, texture: canvasToTexture(THREE, paintHullStrip(67.8, hullHeight, windowCm), renderer) }),", "depth: 9.6,\n    height: hullHeight,\n    halfWidth: 38.9,\n    strutHalfWidth: 38.9,\n    wall: makeCutout({ width: 78.7, length: hullHeight, texture: canvasToTexture(THREE, paintHullStrip(78.7, hullHeight, windowCm), renderer) }),");
swap("depth: 13,\n    height: 3.2,\n    halfWidth: 38.45,\n    strutHalfWidth: 38.45,\n    wall: makeCutout({ width: 77.8, length: 3.2, texture: canvasToTexture(THREE, paintWaveStrip(77.8, 3.2), renderer) }),", "depth: 15,\n    height: 3.4,\n    halfWidth: 40.9,\n    strutHalfWidth: 40.9,\n    wall: makeCutout({ width: 82.7, length: 3.4, texture: canvasToTexture(THREE, paintWaveStrip(82.7, 3.4), renderer) }),");
swap('const sliderWidth = 23.5;\n  const sliderHeight = 2.5;', 'const sliderWidth = 27.8;\n  const sliderHeight = 3.0;');
swap('slider.position.set(0, 0.3, 0.14);', 'slider.position.set(0, 0.35, 0.14);');
swap('const sliderTravel = 20;', 'const sliderTravel = 23.5;');
swap('const flapWidth = 4.7;\n  const flapHeight = 1.7;\n  const flapX = 17.3;', 'const flapWidth = 5.6;\n  const flapHeight = 2.0;\n  const flapX = 20.65;');
swap('[[3.9, 4.9, 0.5, 0.42], [3.5, 4.5, 1.0, 0.36], [3.1, 4.1, 1.5, 0.3]]', '[[4.6, 5.9, 0.6, 0.5], [4.2, 5.4, 1.2, 0.43], [3.7, 4.9, 1.8, 0.36]]');
swap('arch.position.set(8.4, 2.55, 0.1);', 'arch.position.set(10.0, 3.05, 0.1);');
swap('hingeAlong: 2.4,', 'hingeAlong: 3.0,');
// larger text
swap("note(context, floorX(-40.5), noteY, 1000, 'How the pull tab works', texts.slider, 1.05);\n  note(context, floorX(-40.5), noteY + 330, 1000, 'How the lift flap works', texts.flap, 1.05);", "note(context, floorX(-40.5), noteY, 1130, 'How the pull tab works', texts.slider, 1.3);\n  note(context, floorX(-40.5), noteY + 400, 1130, 'How the lift flap works', texts.flap, 1.3);");
swap("paragraph(context, 'Built in Belfast", "paragraph(context, 'Built in Belfast");
swap("135, 330, 1180, 46, `400 38px ${SERIF}`);", "135, 335, 1250, 54, `400 44px ${SERIF}`);");
swap("const columnTwo = 1480;\n  const columnThree = 2400;", "const columnTwo = 1480;\n  const columnThree = 2400;");
s = s.replace(/, 780, '([^']+)', texts\.(\w+), 1\.0,/g, ", 830, '$1', texts.$2, 1.3,");
swap('note(context, columnTwo, y + 30, 780,', 'note(context, columnTwo, y + 30, 830,');
swap('note(context, columnThree, y + 30, 780,', 'note(context, columnThree, y + 30, 830,');
swap('const columnThree = 2400;', 'const columnThree = 2380;');
fs.writeFileSync(file, s);
const file2 = '<your folder>/popup-book/web/art2.js';
let t = fs.readFileSync(file2, 'utf8');
t = t.replace(/, (760|720|1380), '([^']+)', texts\.(\w+), 1\.0,/g, (m, w, h, k) => `, ${w}, '${h}', texts.${k}, 1.3,`);
t = t.replace("1200, 'How the steam strips work', texts.strips, 1.05", "1130, 'How the steam strips work', texts.strips, 1.3").replace("1200, 'Reading the strip'", "1130, 'Reading the strip'").replace("floorZ(21) + 360", "floorZ(21) + 440").replace("they turn with the strip.', 1.05", "they turn with the strip.', 1.3");
t = t.replace("135, 330, 1380, 46, `400 38px", "135, 335, 1380, 54, `400 44px");
t = t.replace("note(context, 1700, 110, 760,", "note(context, 1620, 110, 800,").replace("note(context, 1700, y + 30, 760,", "note(context, 1620, y + 30, 800,").replace("note(context, 2520, 110, 720,", "note(context, 2480, 110, 780,").replace("note(context, 2520, y + 30, 720,", "note(context, 2480, y + 30, 780,");
fs.writeFileSync(file2, t);
