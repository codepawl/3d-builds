// The fly's view is a hexagon mosaic all over (An: "theo view con ruồi á thì nó có view hexagon"): the scene is drawn
// on a hidden layer, then each ommatidium, a hexagon about 26 px across (about 1,700 in the frame, close to the 800
// per eye times two), shows the one colour it sees at its centre. Facets toward the edge of the field darken a little.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace(`  function pov(context, time) {
    const state = povState(time);
    context.save();
    context.translate(540, 540);
    context.rotate(state.roll);
    context.translate(-540, -540);
    wallInPerspective(context, state);
    counterInPerspective(context, state);
    context.restore();
    compoundEyeMask(context);`, `  let sceneLayer = null;

  // Each facet takes the colour at its centre of the hidden scene; a thin dark rim separates the facets.
  function facetMosaic(context, scene) {
    const pixels = scene.getContext("2d").getImageData(0, 0, SIZE, SIZE).data;
    const radius = 15;
    const width = radius * Math.sqrt(3);
    for (let row = -1; row < SIZE / (radius * 1.5) + 1; row += 1) {
      for (let column = -1; column < SIZE / width + 1; column += 1) {
        const x = column * width + (row % 2) * width / 2;
        const y = row * radius * 1.5;
        const sampleX = clamp(Math.round(x), 0, SIZE - 1);
        const sampleY = clamp(Math.round(y), 0, SIZE - 1);
        const offset = (sampleY * SIZE + sampleX) * 4;
        const edge = clamp((Math.hypot(x - 540, y - 540) - 380) / 400);
        const shade = 1 - 0.35 * edge;
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const turn = Math.PI / 6 + (corner * Math.PI) / 3;
          context.lineTo(x + Math.cos(turn) * radius, y + Math.sin(turn) * radius);
        }
        context.closePath();
        context.fillStyle = \`rgb(\${Math.round(pixels[offset] * shade)},\${Math.round(pixels[offset + 1] * shade)},\${Math.round(pixels[offset + 2] * shade)})\`;
        context.fill();
        context.strokeStyle = "rgba(40,20,25,0.35)";
        context.lineWidth = 1.4;
        context.stroke();
        // A small glint on each facet's lens.
        context.fillStyle = "rgba(255,255,255,0.12)";
        context.beginPath();
        context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function pov(context, time) {
    const state = povState(time);
    if (!sceneLayer) {
      sceneLayer = document.createElement("canvas");
      sceneLayer.width = SIZE;
      sceneLayer.height = SIZE;
    }
    const scene = sceneLayer.getContext("2d");
    scene.save();
    scene.translate(540, 540);
    scene.rotate(state.roll);
    scene.translate(-540, -540);
    wallInPerspective(scene, state);
    counterInPerspective(scene, state);
    scene.restore();
    context.fillStyle = "#1d1f33";
    context.fillRect(0, 0, SIZE, SIZE);
    facetMosaic(context, sceneLayer);`);
writeFileSync(path, text);
