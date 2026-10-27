import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createBattleLook } from "./battle-look.js";
import { PRESET_DEFINITIONS, clonePresetState, interpolatePresetStates } from "./presets.js";
import { createSkyAndLightingSystem, applyPresetToSkyAndLights } from "./skyAndLights.js";
import { createWaterAndSteamSystem, updateWaterAndSteamSystem } from "./waterAndSteam.js";
import { createWeatherAndWindSystem, attachPineWindShader, updateWeatherAndWindSystem } from "./weatherAndWind.js";
import { createCameraController } from "./cameraController.js";

const canvasElement = document.getElementById("scene-canvas");
const dslrButton = document.getElementById("btn-dslr");
const dofButton = document.getElementById("btn-dof");
const presetButtons = Array.from(document.querySelectorAll(".preset-button"));

const urlParams = new URLSearchParams(window.location.search);
const isCaptureMode = urlParams.get("capture") === "1";

const renderer = new THREE.WebGLRenderer({
  canvas: canvasElement,
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50.0, window.innerWidth / Math.max(1, window.innerHeight), 0.2, 240.0);

const lightingSystem = createSkyAndLightingSystem(scene, renderer);
const waterAndSteam = createWaterAndSteamSystem(scene);
const weatherSystem = createWeatherAndWindSystem(scene);

scene.onBeforeRender = () => {
  if (scene.overrideMaterial !== null) {
    waterAndSteam.steamMesh.visible = false;
    weatherSystem.snowMesh.visible = false;
    lightingSystem.skyMesh.visible = false;
  }
};

scene.onAfterRender = () => {
  waterAndSteam.steamMesh.visible = true;
  weatherSystem.snowMesh.visible = true;
  lightingSystem.skyMesh.visible = true;
};

const look = createBattleLook({
  renderer,
  scene,
  camera
});

const emissiveMaterials = {
  shojiMaterials: [],
  lanternMaterials: []
};

const appState = {
  currentPresetName: "blue",
  activeState: clonePresetState(PRESET_DEFINITIONS.blue),
  blendFromState: clonePresetState(PRESET_DEFINITIONS.blue),
  blendToState: clonePresetState(PRESET_DEFINITIONS.blue),
  blendProgress: 1.0,
  blendDuration: 1.15,
  dofEnabled: true,
  dslrEnabled: true,
  elapsedTime: 0.0
};

function updateToolbarUiState() {
  if (dslrButton) {
    dslrButton.classList.toggle("active", appState.dslrEnabled);
  }
  if (dofButton) {
    dofButton.classList.toggle("active", appState.dofEnabled);
  }
  for (const btn of presetButtons) {
    const presetAttr = btn.getAttribute("data-preset");
    btn.classList.toggle("active", presetAttr === appState.currentPresetName);
  }
}

function setPresetInternal(presetName, instant = false) {
  const targetDefinition = PRESET_DEFINITIONS[presetName];
  if (!targetDefinition) {
    return;
  }
  appState.currentPresetName = presetName;
  updateToolbarUiState();

  if (instant) {
    appState.activeState = clonePresetState(targetDefinition);
    appState.blendFromState = clonePresetState(targetDefinition);
    appState.blendToState = clonePresetState(targetDefinition);
    appState.blendProgress = 1.0;
    syncAllSystemsToCurrentState();
    return;
  }

  appState.blendFromState = clonePresetState(appState.activeState);
  appState.blendToState = clonePresetState(targetDefinition);
  appState.blendProgress = 0.0;
}

function setToggleInternal(toggleName, toggleValue) {
  const enabled = Boolean(toggleValue);
  if (toggleName === "dof") {
    appState.dofEnabled = enabled;
    look.setDof(enabled);
  } else if (toggleName === "dslr") {
    appState.dslrEnabled = enabled;
    look.setDslr(enabled);
  }
  updateToolbarUiState();
}

const cameraController = createCameraController(camera, canvasElement, {
  onSelectPreset(name) {
    setPresetInternal(name, false);
  },
  onToggleDof() {
    setToggleInternal("dof", !appState.dofEnabled);
  },
  onToggleDslr() {
    setToggleInternal("dslr", !appState.dslrEnabled);
  }
});

if (dslrButton) {
  dslrButton.addEventListener("click", () => {
    setToggleInternal("dslr", !appState.dslrEnabled);
  });
}

if (dofButton) {
  dofButton.addEventListener("click", () => {
    setToggleInternal("dof", !appState.dofEnabled);
  });
}

for (const btn of presetButtons) {
  btn.addEventListener("click", () => {
    const targetPreset = btn.getAttribute("data-preset");
    if (targetPreset) {
      setPresetInternal(targetPreset, false);
    }
  });
}

function syncAllSystemsToCurrentState() {
  renderer.toneMappingExposure = appState.activeState.exposure;
  applyPresetToSkyAndLights(lightingSystem, appState.activeState, appState.elapsedTime, emissiveMaterials, scene);
  updateWaterAndSteamSystem(waterAndSteam, appState.activeState, appState.elapsedTime);
  updateWeatherAndWindSystem(weatherSystem, appState.activeState, appState.elapsedTime);
}

function advanceSimulationAndRender(deltaTime) {
  const safeDt = Number.isFinite(deltaTime) ? Math.max(0.0, deltaTime) : 0.0;
  appState.elapsedTime += safeDt;

  if (appState.blendProgress < 1.0) {
    const stepFraction = safeDt / Math.max(appState.blendDuration, 0.001);
    appState.blendProgress = Math.min(1.0, appState.blendProgress + stepFraction);
    interpolatePresetStates(
      appState.activeState,
      appState.blendFromState,
      appState.blendToState,
      appState.blendProgress
    );
  }

  cameraController.update(safeDt);
  syncAllSystemsToCurrentState();
  look.render(safeDt);
}

function stepHook(deltaTime = 1.0 / 60.0, count = 1) {
  const iterations = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  for (let i = 0; i < iterations; i++) {
    advanceSimulationAndRender(deltaTime);
  }
}

const battleHook = {
  ready: false,
  setPreset(name, instant = false) {
    setPresetInternal(name, Boolean(instant));
    if (instant && battleHook.ready) {
      look.render(0.0);
    }
  },
  setToggle(name, value) {
    setToggleInternal(name, value);
    if (battleHook.ready) {
      look.render(0.0);
    }
  },
  placeCamera(progress, lateral = 0.0, orientation = {}) {
    cameraController.placeCamera(progress, lateral, orientation);
    if (battleHook.ready) {
      look.render(0.0);
    }
  },
  step(deltaTime, count = 1) {
    stepHook(deltaTime, count);
  }
};

window.battle = battleHook;

function handleWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  look.setSize(width, height);
  if (battleHook.ready) {
    look.render(0.0);
  }
}

window.addEventListener("resize", handleWindowResize);

function configureLoadedGltfScene(gltfScene) {
  gltfScene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    const meshName = child.name || "";
    const isMountain = meshName.includes("SnowyMountainRange");
    child.castShadow = !isMountain;
    child.receiveShadow = true;

    const mat = child.material;
    if (!mat) {
      return;
    }
    const matName = mat.name || "";
    if (matName.includes("ShojiPaper") || meshName.includes("ShojiGlowingScreens")) {
      emissiveMaterials.shojiMaterials.push(mat);
    }
    if (matName.includes("LanternGlow") || meshName.includes("Glow")) {
      emissiveMaterials.lanternMaterials.push(mat);
    }
    if (meshName.includes("PineFoliageClusters") || meshName.includes("PineBranchSnowCushions")) {
      attachPineWindShader(mat, weatherSystem.windSharedUniform);
    }
  });
  scene.add(gltfScene);
}

async function loadAllSceneAssets() {
  const loader = new GLTFLoader();
  const modelPaths = [
    "./public/models/onsen_pool_and_terrain.glb",
    "./public/models/ryokan_and_deck.glb",
    "./public/models/onsen_props.glb",
    "./public/models/winter_pines.glb"
  ];
  const loadedGltfs = await Promise.all(
    modelPaths.map((url) => loader.loadAsync(url))
  );
  for (const gltf of loadedGltfs) {
    configureLoadedGltfScene(gltf.scene);
  }
}

let lastFrameTimestamp = performance.now();

function runAnimationFrame(nowTimestamp) {
  if (isCaptureMode) {
    return;
  }
  const dt = Math.min(0.05, Math.max(0.001, (nowTimestamp - lastFrameTimestamp) * 0.001));
  lastFrameTimestamp = nowTimestamp;
  advanceSimulationAndRender(dt);
  requestAnimationFrame(runAnimationFrame);
}

async function initializeApplication() {
  await loadAllSceneAssets();
  setPresetInternal("blue", true);
  setToggleInternal("dslr", true);
  setToggleInternal("dof", true);
  cameraController.placeCamera(0.0, 0.0, { yawOffset: 0.0, pitch: 0.0 });
  advanceSimulationAndRender(0.016);
  battleHook.ready = true;

  if (!isCaptureMode) {
    lastFrameTimestamp = performance.now();
    requestAnimationFrame(runAnimationFrame);
  }
}

initializeApplication();
