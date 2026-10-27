import fs from 'node:fs';
const file = '<your folder>/popup-book/web/main.js';
let s = fs.readFileSync(file, 'utf8');
const swap = (from, to) => { if (!s.includes(from)) console.log('MISSING', from.slice(0, 50)); s = s.replace(from, to); };
swap('const view = { yaw: 0, pitch: 0, zoom: 1 };', 'const view = { yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0 };');
swap('const target = new THREE.Vector3(0, mix(-0.5, 12), mix(22, 6));', 'const target = new THREE.Vector3(view.focusX * smooth, mix(-0.5, 12) + view.focusY * smooth, mix(22, 6));');
swap('Object.assign(view, { yaw: next.yaw ?? view.yaw, pitch: next.pitch ?? view.pitch, zoom: next.zoom ?? view.zoom });', 'Object.assign(view, { yaw: next.yaw ?? view.yaw, pitch: next.pitch ?? view.pitch, zoom: next.zoom ?? view.zoom, focusX: next.focusX ?? view.focusX, focusY: next.focusY ?? view.focusY });');
fs.writeFileSync(file, s);
