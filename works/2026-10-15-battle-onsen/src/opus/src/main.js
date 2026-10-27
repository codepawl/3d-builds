// Shirayu Onsen: a rotenburo beside a small ryokan in the snowy mountains.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CameraRig } from "./camera-rig.js";
import { createBattleLook } from "./battle-look.js";
import { PRESET_NAMES, PresetBlender } from "./presets.js";
import { Sky } from "./sky.js";
import { Snowfall } from "./snowfall.js";
import { Spout } from "./spout.js";
import { Steam } from "./steam.js";
import { addDeckWeather, addStoneSnow } from "./surface-snow.js";
import { bindToolbar } from "./ui.js";
import { createPines, FAR_FOREST_LAYER, prepareFrondMaterial, windUniforms } from "./vegetation.js";
import { Water } from "./water.js";

const searchParameters = new URLSearchParams(window.location.search);
const captureMode = searchParameters.get("capture") === "1";
if (captureMode) {
  document.body.classList.add("is-capture");
}

const canvas = document.getElementById("scene-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// The sun only moves when a preset changes, so the shadow map is redrawn then and not every frame
// (see renderFrame); the shared look renders the scene several times a frame and never needs a new one.
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3500);
camera.layers.enable(1);
camera.layers.enable(FAR_FOREST_LAYER);
scene.fog = new THREE.FogExp2(0xbfcde0, 0.007);

const presetBlender = new PresetBlender("morning");
const sky = new Sky(renderer);
scene.add(sky.mesh);
// The shared camera and screen look (field of view, ambient occlusion, bloom, depth of field, tone mapping,
// vignette, grain, handheld sway). It is identical in every battle scene; nothing here adds another screen pass.
const look = createBattleLook({ renderer, scene, camera });

const lights = createLights();
const glowMaterials = { shoji: [], lanternGlow: [], mountain: [] };
let water = null;
let steam = null;
let snowfall = null;
let spout = null;
let rig = null;
let elapsedTime = 0;
let lanternFlicker = 1;
let environmentAge = 0;
let presetDirty = true;
let shadowFramesLeft = 2;

function createLights() {
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 0, -3);
  scene.add(sun);
  scene.add(sun.target);
  const createPointLight = (color, distance) => {
    const light = new THREE.PointLight(color, 1, distance, 2);
    scene.add(light);
    return light;
  };
  return {
    hemisphere,
    sun,
    lantern: createPointLight(0xff9a50, 14),
    paperLantern: createPointLight(0xffa860, 9),
    // One warm light in front of the middle bay stands in for all the lit shoji: each extra point light costs
    // every lit pixel of every pass.
    shojiLight: createPointLight(0xffb878, 15),
  };
}

function positionLights(layout) {
  lights.lantern.position.fromArray(layout.lights.lantern);
  lights.paperLantern.position.fromArray(layout.lights.paperLantern);
  lights.paperLantern.position.z += 0.4;
  lights.shojiLight.position.fromArray(layout.lights.windowsLower[1]);
  lights.shojiLight.position.y += 0.8;
  lights.shojiLight.position.z += 1.6;
}

function prepareSite(siteScene, waterLevel) {
  siteScene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
    const material = child.material;
    if (material.name === "shoji") {
      material.emissive.setRGB(1.0, 0.74, 0.46);
      glowMaterials.shoji.push(material);
    }
    if (material.name === "lantern_glow") {
      material.emissive.setRGB(1.0, 0.6, 0.3);
      glowMaterials.lanternGlow.push(material);
    }
    if (material.name === "frond") {
      prepareFrondMaterial(material);
    }
    if (material.name === "stone") {
      addStoneSnow(material, waterLevel);
    }
    if (material.name === "deck_wood") {
      addDeckWeather(material, waterLevel);
    }
    if (material.name === "snow" || material.name === "ground") {
      material.roughness = 0.92;
    }
  });
}

function prepareMountains(mountainScene) {
  mountainScene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.receiveShadow = false;
    child.castShadow = false;
    const material = child.material;
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `#ifdef USE_FOG
          float distantFogDepth = vFogDepth * 0.42;
          float distantFogFactor = 1.0 - exp( - fogDensity * fogDensity * distantFogDepth * distantFogDepth );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, distantFogFactor );
        #endif`
      );
    };
    glowMaterials.mountain.push(material);
  });
}

function applyPresetValues(values) {
  sky.applyPreset(values, elapsedTime);
  scene.fog.color.fromArray(values.fogColor);
  scene.fog.density = values.fogDensity;
  lights.hemisphere.color.fromArray(values.hemisphereSky);
  lights.hemisphere.groundColor.fromArray(values.hemisphereGround);
  lights.hemisphere.intensity = values.hemisphereIntensity;
  const sunDirection = new THREE.Vector3().fromArray(values.sunDirection);
  lights.sun.position.copy(lights.sun.target.position).addScaledVector(sunDirection, 80);
  lights.sun.color.fromArray(values.sunColor);
  lights.sun.intensity = values.sunIntensity * THREE.MathUtils.smoothstep(sunDirection.y, -0.02, 0.06);
  renderer.toneMappingExposure = values.exposure;
  scene.environmentIntensity = values.environmentIntensity;
  for (const material of glowMaterials.shoji) {
    material.emissiveIntensity = values.windowEmissive;
  }
  for (const material of glowMaterials.mountain) {
    material.color.fromArray(values.mountainTint);
  }
  lights.shojiLight.intensity = values.windowLight * 2.2;
  shadowFramesLeft = Math.max(shadowFramesLeft, 1);
  water?.applyPreset(values);
  spout?.applyPreset(values);
}

function applyFlickeringLights(values) {
  lanternFlicker = 1 + 0.05 * Math.sin(elapsedTime * 13.1) + 0.04 * Math.sin(elapsedTime * 7.3 + 1.0) + 0.03 * Math.sin(elapsedTime * 23.7 + 2.0);
  lights.lantern.intensity = values.lanternLight * lanternFlicker;
  lights.paperLantern.intensity = values.lanternLight * 0.55 * (2 - lanternFlicker);
  for (const material of glowMaterials.lanternGlow) {
    material.emissiveIntensity = values.lanternEmissive * lanternFlicker;
  }
  steam?.applyPreset(values, lanternFlicker);
  snowfall?.applyPreset(values, lanternFlicker);
}

function resize() {
  const width = Math.max(2, window.innerWidth);
  const height = Math.max(2, window.innerHeight);
  look.setSize(width, height);
  water?.setSize(width, height);
}

function advance(deltaTime) {
  elapsedTime += deltaTime;
  const blending = presetBlender.update(deltaTime);
  const values = presetBlender.values;
  if (blending || presetDirty) {
    applyPresetValues(values);
  }
  sky.material.uniforms.time.value = elapsedTime;
  applyFlickeringLights(values);
  environmentAge += deltaTime;
  if (presetDirty || (blending && environmentAge > 0.25)) {
    scene.environment = sky.updateEnvironment();
    environmentAge = 0;
  }
  presetDirty = false;
  rig.update(deltaTime);
  windUniforms.windTime.value = elapsedTime;
  water.update(elapsedTime);
  const viewportHeight = renderer.domElement.height;
  snowfall.update(elapsedTime, viewportHeight, camera);
  const focalLength = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  spout.update(elapsedTime, focalLength);
  steam.update(elapsedTime);
}

function renderFrame(deltaTime) {
  if (shadowFramesLeft > 0) {
    renderer.shadowMap.needsUpdate = true;
    shadowFramesLeft -= 1;
  }
  water.renderReflection(renderer, scene, camera);
  look.render(deltaTime);
}

function step(deltaTime, count) {
  const frameCount = Math.max(1, Math.floor(count || 1));
  for (let index = 0; index < frameCount; index += 1) {
    advance(deltaTime);
    renderFrame(deltaTime);
  }
}

async function loadAssets() {
  const loader = new GLTFLoader();
  const [layout, siteGltf, pinesGltf, mountainsGltf] = await Promise.all([
    fetch("public/assets/layout.json").then((response) => response.json()),
    loader.loadAsync("public/assets/site.glb"),
    loader.loadAsync("public/assets/pines.glb"),
    loader.loadAsync("public/assets/mountains.glb"),
  ]);
  return { layout, siteScene: siteGltf.scene, pinesScene: pinesGltf.scene, mountainScene: mountainsGltf.scene };
}

function setupWorld({ layout, siteScene, pinesScene, mountainScene }) {
  prepareSite(siteScene, layout.waterLevel);
  prepareMountains(mountainScene);
  scene.add(siteScene);
  scene.add(mountainScene);
  scene.add(createPines(pinesScene, layout));
  positionLights(layout);
  water = new Water(layout, renderer);
  scene.add(water.mesh);
  steam = new Steam(layout);
  scene.add(steam.mesh);
  snowfall = new Snowfall(layout);
  scene.add(snowfall.points);
  spout = new Spout(layout);
  scene.add(spout.group);
  rig = new CameraRig(camera, layout, canvas);
  rig.placeCamera(0, 0, { yawOffset: 0, pitch: -0.03 });
}

const battle = {
  ready: false,
  setPreset(name, instant) {
    if (!PRESET_NAMES.includes(name)) {
      return;
    }
    presetBlender.setPreset(name, Boolean(instant));
    if (instant) {
      presetDirty = true;
    }
    toolbar?.showPreset(name);
  },
  setToggle(name, value) {
    if (name === "dof") {
      look.setDof(value);
    } else if (name === "dslr") {
      look.setDslr(value);
    } else {
      return;
    }
    toolbar?.showToggles(look.dslr, look.dof);
  },
  placeCamera(progress, lateral, options = {}) {
    rig.placeCamera(progress, lateral, options);
  },
  step(deltaTime, count) {
    step(deltaTime, count);
  },
};
window.battle = battle;
window.sceneDebug = { renderer, scene, camera, lights, get steam() { return steam; }, get water() { return water; } };

let toolbar = null;

function startLoop() {
  let previousTimestamp = performance.now();
  const loop = (timestamp) => {
    const deltaTime = Math.min(0.1, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;
    advance(deltaTime);
    renderFrame(deltaTime);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function start() {
  resize();
  const assets = await loadAssets();
  setupWorld(assets);
  resize();
  toolbar = bindToolbar({
    onPreset: (name) => battle.setPreset(name, false),
    onToggleDslr: () => battle.setToggle("dslr", !look.dslr),
    onToggleDepthOfField: () => battle.setToggle("dof", !look.dof),
  });
  toolbar.showPreset(presetBlender.currentName);
  toolbar.showToggles(look.dslr, look.dof);
  window.addEventListener("resize", resize);
  step(1 / 60, 1);
  document.body.classList.add("is-loaded");
  if (captureMode) {
    document.querySelector(".loading")?.remove();
    battle.ready = true;
    return;
  }
  requestAnimationFrame(() => {
    battle.ready = true;
    startLoop();
  });
}

start().catch((error) => {
  console.error(error);
  const loadingLabel = document.getElementById("loading-label");
  if (loadingLabel) {
    loadingLabel.textContent = "The scene failed to load. Reload to try again.";
  }
});
