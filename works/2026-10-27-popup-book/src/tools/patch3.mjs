import fs from 'node:fs';
const base = '<your folder>/popup-book/web/';
function patch(name, edits) {
  let s = fs.readFileSync(base + name, 'utf8');
  for (const [from, to] of edits) {
    if (!s.includes(from)) { console.log('MISSING in', name, from.slice(0, 70)); continue; }
    s = s.replace(from, to);
  }
  fs.writeFileSync(base + name, s);
}
patch('pop.js', [
  [`    const apex = circleIntersection(hinge, this.panelLength, farPoint, this.panelLength);
    const alongA = { y: (apex.y - hinge.y) / this.panelLength, z: (apex.z - hinge.z) / this.panelLength };
    const alongB = { y: (apex.y - farPoint.y) / this.panelLength, z: (apex.z - farPoint.z) / this.panelLength };
    const lift = 0.05 + this.order * 0.03;
    orientFrame(this.frameA, hinge, alongA, this.x, lift);
    orientFrame(this.frameB, farPoint, alongB, this.x, -lift);
    this.apex = apex;`,
   `    const standing = circleIntersection(hinge, this.panelLength, farPoint, this.panelLength);
    // Near a closed book the panels cannot lie flat at fixed length, so they fold down onto the leaves (the same
    // way card does when it creases): the apex slides to the middle of the two hinges and the panels shorten.
    const middle = { y: (hinge.y + farPoint.y) / 2, z: (hinge.z + farPoint.z) / 2 };
    const raw = Math.min(1, psi / ((55 * Math.PI) / 180));
    const blend = raw * raw * (3 - 2 * raw);
    const apex = { y: middle.y + (standing.y - middle.y) * blend, z: middle.z + (standing.z - middle.z) * blend };
    const lengthA = Math.max(1e-3, Math.hypot(apex.y - hinge.y, apex.z - hinge.z));
    const lengthB = Math.max(1e-3, Math.hypot(apex.y - farPoint.y, apex.z - farPoint.z));
    const lift = 0.05 + this.order * 0.03;
    orientFrame(this.frameA, hinge, { y: (apex.y - hinge.y) / lengthA, z: (apex.z - hinge.z) / lengthA }, this.x, lift);
    orientFrame(this.frameB, farPoint, { y: (apex.y - farPoint.y) / lengthB, z: (apex.z - farPoint.z) / lengthB }, this.x, -lift);
    this.frameA.scale.y = lengthA / this.panelLength;
    this.frameB.scale.y = lengthB / this.panelLength;
    this.apex = apex;`],
  ['const strut = makeCard({ width: 0.8, length: depth, thick: 0.06, front: new THREE.MeshStandardMaterial({ color: 0xe6dac0, roughness: 1 }) });', 'const strut = makeCard({ width: 0.6, length: depth, thick: 0.06, front: new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 1 }) });'],
]);
patch('art1.js', [
  ["  note(context, floorX(-40.5), noteY, 1130, 'How the pull tab works', texts.slider, 1.6);\n  note(context, floorX(-40.5), noteY + 400, 1130, 'How the lift flap works', texts.flap, 1.6);\n", ''],
  ["'Why four was survivable and six was not'", "'Why four, and not six'"],
  ['(118 * Math.PI) / 180', '(105 * Math.PI) / 180'],
]);
patch('art2.js', [
  ["  note(context, floorX(-40.5), floorZ(21), 1130, 'How the steam strips work', texts.strips, 1.6);\n", ''],
  ["  note(context, floorX(-40.5), floorZ(21) + 440, 1130, 'Reading the strip', 'Blue marks are feedwater, white marks are steam, pale grey marks are wet exhaust steam in the condenser. The three paper wheels are the turbine rotors and the generator rotor; they turn with the strip.', 1.6);\n", ''],
  ["overlayContext.lineWidth = run.type === 'steam' ? 22 : 17;", "overlayContext.lineWidth = run.type === 'steam' ? 34 : 28;"],
  ["overlayContext.lineWidth = run.type === 'steam' ? 16 : 11;", "overlayContext.lineWidth = run.type === 'steam' ? 25 : 20;"],
  ["  for (const tabX of [0, width - ear]) wash(context, rectPath(tabX, 0, ear, pixels * 1.3), '#e6dac0'", "  wash(context, rectPath(ear, height * 0.86, width - ear * 2, height * 0.14), '#a79c85', { seed: 8, alpha: 0.9, layers: 2, pool: 0.4 });\n  hatch(context, ear, height * 0.86, width - ear * 2, height * 0.14, 7, 0.3, 4);\n  for (const tabX of [0, width - ear]) wash(context, rectPath(tabX, 0, ear, pixels * 1.3), '#e6dac0'"],
]);
patch('main.js', [
  ['(open ? 1.04 : 1.1)', '(open ? 1.04 : 1.3)'],
  ['(open ? 86 : 70)', '(open ? 86 : 96)'],
]);
