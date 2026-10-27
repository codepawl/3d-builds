// Time-of-day presets. Every number here is blended when the preset changes.
import * as THREE from "three";

function directionFromAngles(azimuthDegrees, elevationDegrees) {
  const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  // Azimuth 0 points to +Z (behind the start camera), 90 to +X.
  return [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
}

export const PRESET_NAMES = ["morning", "golden", "blue", "night"];

export const PRESETS = {
  morning: {
    cloudCoverage: 0.38,
    cloudLit: [1.25, 1.22, 1.18],
    cloudShade: [0.52, 0.58, 0.68],
    sunDirection: directionFromAngles(105, 20),
    sunColor: [1.0, 0.96, 0.9],
    sunIntensity: 5.0,
    sunDiscAmount: 1.0,
    moonAmount: 0.0,
    skyZenith: [0.14, 0.33, 0.74],
    skyHorizon: [0.55, 0.7, 0.93],
    sunGlowColor: [1.0, 0.92, 0.8],
    sunGlowAmount: 0.6,
    starAmount: 0.0,
    hemisphereSky: [0.42, 0.6, 1.0],
    hemisphereGround: [0.55, 0.6, 0.7],
    hemisphereIntensity: 0.62,
    fogColor: [0.6, 0.72, 0.9],
    fogDensity: 0.0036,
    exposure: 0.85,
    lanternLight: 0.6,
    lanternEmissive: 1.2,
    windowEmissive: 0.55,
    windowLight: 0.4,
    steamColor: [0.82, 0.86, 0.92],
    steamOpacity: 0.3,
    snowfallColor: [0.92, 0.95, 1.0],
    waterColor: [0.2, 0.36, 0.3],
    environmentIntensity: 0.55,
    mountainTint: [1.0, 1.0, 1.0],
  },
  golden: {
    cloudCoverage: 0.46,
    cloudLit: [1.5, 0.9, 0.55],
    cloudShade: [0.42, 0.36, 0.42],
    sunDirection: directionFromAngles(-58, 7),
    sunColor: [1.0, 0.62, 0.34],
    sunIntensity: 4.4,
    sunDiscAmount: 1.0,
    moonAmount: 0.0,
    skyZenith: [0.24, 0.32, 0.56],
    skyHorizon: [0.98, 0.72, 0.52],
    sunGlowColor: [1.0, 0.6, 0.3],
    sunGlowAmount: 1.3,
    starAmount: 0.0,
    hemisphereSky: [0.48, 0.52, 0.75],
    hemisphereGround: [0.55, 0.45, 0.42],
    hemisphereIntensity: 0.4,
    fogColor: [0.82, 0.66, 0.58],
    fogDensity: 0.005,
    exposure: 0.95,
    lanternLight: 2.2,
    lanternEmissive: 3.0,
    windowEmissive: 1.4,
    windowLight: 1.4,
    steamColor: [0.88, 0.76, 0.7],
    steamOpacity: 0.32,
    snowfallColor: [1.0, 0.9, 0.8],
    waterColor: [0.2, 0.3, 0.26],
    environmentIntensity: 0.5,
    mountainTint: [1.0, 0.92, 0.88],
  },
  blue: {
    cloudCoverage: 0.42,
    cloudLit: [0.32, 0.34, 0.5],
    cloudShade: [0.12, 0.14, 0.24],
    sunDirection: directionFromAngles(-60, 32),
    sunColor: [0.5, 0.6, 0.95],
    sunIntensity: 0.32,
    sunDiscAmount: 0.0,
    moonAmount: 0.0,
    skyZenith: [0.06, 0.1, 0.26],
    skyHorizon: [0.3, 0.38, 0.62],
    sunGlowColor: [0.5, 0.42, 0.62],
    sunGlowAmount: 0.35,
    starAmount: 0.15,
    hemisphereSky: [0.32, 0.42, 0.8],
    hemisphereGround: [0.22, 0.25, 0.38],
    hemisphereIntensity: 0.62,
    fogColor: [0.2, 0.26, 0.42],
    fogDensity: 0.0075,
    exposure: 1.15,
    lanternLight: 4.0,
    lanternEmissive: 4.0,
    windowEmissive: 1.5,
    windowLight: 2.4,
    steamColor: [0.42, 0.48, 0.66],
    steamOpacity: 0.32,
    snowfallColor: [0.7, 0.78, 0.98],
    waterColor: [0.08, 0.14, 0.17],
    environmentIntensity: 0.9,
    mountainTint: [0.85, 0.9, 1.05],
  },
  night: {
    cloudCoverage: 0.3,
    cloudLit: [0.07, 0.08, 0.12],
    cloudShade: [0.015, 0.02, 0.035],
    sunDirection: directionFromAngles(150, 42),
    sunColor: [0.55, 0.66, 1.0],
    sunIntensity: 0.38,
    sunDiscAmount: 0.0,
    moonAmount: 1.0,
    skyZenith: [0.008, 0.012, 0.035],
    skyHorizon: [0.035, 0.05, 0.1],
    sunGlowColor: [0.3, 0.36, 0.55],
    sunGlowAmount: 0.25,
    starAmount: 1.0,
    hemisphereSky: [0.14, 0.18, 0.36],
    hemisphereGround: [0.06, 0.06, 0.09],
    hemisphereIntensity: 0.42,
    fogColor: [0.035, 0.045, 0.08],
    fogDensity: 0.0085,
    exposure: 1.3,
    lanternLight: 5.0,
    lanternEmissive: 4.5,
    windowEmissive: 1.3,
    windowLight: 2.8,
    steamColor: [0.12, 0.14, 0.22],
    steamOpacity: 0.36,
    snowfallColor: [0.45, 0.5, 0.66],
    waterColor: [0.03, 0.06, 0.08],
    environmentIntensity: 0.8,
    mountainTint: [0.8, 0.88, 1.1],
  },
};

function cloneValues(values) {
  const copy = {};
  for (const [key, value] of Object.entries(values)) {
    copy[key] = Array.isArray(value) ? value.slice() : value;
  }
  return copy;
}

function interpolateValue(fromValue, toValue, amount) {
  if (Array.isArray(fromValue)) {
    return fromValue.map((component, index) => component + (toValue[index] - component) * amount);
  }
  return fromValue + (toValue - fromValue) * amount;
}

// Holds the live preset values and blends them toward a target preset over time.
export class PresetBlender {
  constructor(initialName) {
    this.currentName = initialName;
    this.values = cloneValues(PRESETS[initialName]);
    this.startValues = cloneValues(this.values);
    this.targetValues = cloneValues(this.values);
    this.blendDuration = 2.6;
    this.blendElapsed = this.blendDuration;
  }

  setPreset(name, instant) {
    if (!PRESETS[name]) {
      return;
    }
    this.currentName = name;
    this.targetValues = cloneValues(PRESETS[name]);
    if (instant) {
      this.values = cloneValues(this.targetValues);
      this.blendElapsed = this.blendDuration;
      return;
    }
    this.startValues = cloneValues(this.values);
    this.blendElapsed = 0;
  }

  get isBlending() {
    return this.blendElapsed < this.blendDuration;
  }

  update(deltaTime) {
    if (!this.isBlending) {
      return false;
    }
    this.blendElapsed = Math.min(this.blendDuration, this.blendElapsed + deltaTime);
    const linear = this.blendElapsed / this.blendDuration;
    const eased = linear * linear * (3 - 2 * linear);
    for (const key of Object.keys(this.targetValues)) {
      this.values[key] = interpolateValue(this.startValues[key], this.targetValues[key], eased);
    }
    const sunDirection = new THREE.Vector3().fromArray(this.values.sunDirection).normalize();
    this.values.sunDirection = sunDirection.toArray();
    return true;
  }
}
