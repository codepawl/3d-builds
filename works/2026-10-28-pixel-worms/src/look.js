import * as THREE from 'three';

export const BAYER_GLSL = `
float bayer4(vec2 pixel) {
  vec2 cell = mod(floor(pixel), 4.0);
  float index = cell.x + cell.y * 4.0;
  float values[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (values[int(index)] + 0.5) / 16.0;
}`;

// Stepped gradient map: flat tone bands, no smoothing.
function createToonGradient(tones, darkest) {
  const data = new Uint8Array(tones * 4);
  for (let tone = 0; tone < tones; tone++) {
    const level = darkest + (1 - darkest) * (tone / (tones - 1));
    data.set([Math.round(level * 255), Math.round(level * 255), Math.round(level * 255), 255], tone * 4);
  }
  const texture = new THREE.DataTexture(data, tones, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const gradient = createToonGradient(3, 0.5);

export function makeToonMaterial(options = {}) {
  const material = new THREE.MeshToonMaterial({ gradientMap: gradient, ...options });
  if (material.map) {
    material.map.magFilter = THREE.NearestFilter;
    material.map.minFilter = THREE.NearestFilter;
    material.map.generateMipmaps = false;
  }
  return material;
}

// Ordered Bayer dissolve in low-res pixels. controller.set(0..1): 0 solid, 1 gone.
export function addDitherDissolve(material, controller) {
  controller.uniform = { value: 0 };
  controller.set = (amount) => {
    controller.uniform.value = amount;
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ditherAmount = controller.uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float ditherAmount;\n${BAYER_GLSL}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (bayer4(gl_FragCoord.xy) < ditherAmount) discard;');
  };
  material.customProgramCacheKey = () => 'dither-dissolve';
  return controller;
}

// A hard one-pixel specular glint on top of the toon bands, for the wet look of the worms. Also tags the pixels with alpha 0.5.
export function addGlint(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#if NUM_DIR_LIGHTS > 0
        vec3 glintHalf = normalize(directionalLights[0].direction + normalize(vViewPosition));
        float glint = step(0.972, dot(normalize(normal), glintHalf));
        outgoingLight += glint * vec3(1.0, 0.78, 0.74) * ${strength.toFixed(2)};
      #endif
      #include <opaque_fragment>`,
    ).replace('#include <fog_fragment>', '#include <fog_fragment>\n  gl_FragColor.a = 0.5;');
  };
  material.customProgramCacheKey = () => 'glint';
  return material;
}

// Shared by every prop: where the swarm sits on the low-res screen and how far it is from the camera. A prop fragment
// that is nearer than the swarm and sits over it on screen, or is very close to the camera, dissolves in Bayer dither.
export const propFadeUniforms = {
  swarmScreen: { value: new THREE.Vector2(240, 135) },
  swarmDepth: { value: 12 },
  lowSize: { value: new THREE.Vector2(640, 360) },
  strength: { value: 1 },
};

export function addPropFade(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.propSwarmScreen = propFadeUniforms.swarmScreen;
    shader.uniforms.propSwarmDepth = propFadeUniforms.swarmDepth;
    shader.uniforms.propLowSize = propFadeUniforms.lowSize;
    shader.uniforms.propStrength = propFadeUniforms.strength;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform vec2 propSwarmScreen;\nuniform float propSwarmDepth;\nuniform vec2 propLowSize;\nuniform float propStrength;\n${BAYER_GLSL}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    float propDistance = length(vViewPosition);
    float nearCamera = 1.0 - smoothstep(3.0, 6.5, propDistance);
    vec2 offsetFromSwarm = (gl_FragCoord.xy - propSwarmScreen) / propLowSize.y;
    float overSwarm = 1.0 - smoothstep(0.7, 1.0, length(offsetFromSwarm / vec2(1.0, 0.7)));
    float inFront = 1.0 - smoothstep(propSwarmDepth - 4.0, propSwarmDepth - 1.0, propDistance);
    float fadeAmount = max(nearCamera, overSwarm * inFront * propStrength);
    if (bayer4(gl_FragCoord.xy) < fadeAmount) discard;
  }`);
  };
  material.customProgramCacheKey = () => 'prop-fade';
  return material;
}
