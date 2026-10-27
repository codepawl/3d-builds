import * as THREE from "three";

export const PRESET_DEFINITIONS = {
  morning: {
    name: "morning",
    sunDirection: new THREE.Vector3(0.56, 0.48, 0.67).normalize(),
    sunColor: new THREE.Vector3 ? new THREE.Color(0xfcfaf2) : null,
    sunIntensity: 2.65,
    hemisphereSkyColor: new THREE.Color(0x8cb0d9),
    hemisphereGroundColor: new THREE.Color(0x5a7394),
    hemisphereIntensity: 1.35,
    ambientColor: new THREE.Color(0x7490b5),
    ambientIntensity: 0.52,
    skyZenithColor: new THREE.Color(0x386296),
    skyMidColor: new THREE.Color(0x7fa5d1),
    skyHorizonColor: new THREE.Color(0xdbe6f2),
    cloudLitColor: new THREE.Color(0xfafcff),
    cloudShadowColor: new THREE.Color(0x93adc9),
    sunDiscColor: new THREE.Color(0xfffdf6),
    starVisibility: 0.0,
    fogColor: new THREE.Color(0xd5e1ed),
    fogDensity: 0.0052,
    shojiEmissiveColor: new THREE.Color(0xffe6c2),
    shojiEmissiveIntensity: 0.08,
    lanternEmissiveColor: new THREE.Color(0xffdba8),
    lanternEmissiveIntensity: 0.35,
    lanternPointIntensity: 0.20,
    shojiPointIntensity: 0.12,
    waterDeepColor: new THREE.Color(0x143632),
    waterShallowColor: new THREE.Color(0x2b5e56),
    waterSkyReflectTint: new THREE.Color(0xa8c5e3),
    waterWarmGlowWeight: 0.08,
    steamBaseColor: new THREE.Color(0xeef4fa),
    steamWarmColor: new THREE.Color(0xf7ece0),
    steamWarmWeight: 0.08,
    steamOpacity: 0.10,
    snowTint: new THREE.Color(0xf2f6fa),
    exposure: 0.96
  },
  golden: {
    name: "golden",
    sunDirection: new THREE.Vector3(-0.64, 0.26, 0.72).normalize(),
    sunColor: new THREE.Color(0xfff0d6),
    sunIntensity: 2.55,
    hemisphereSkyColor: new THREE.Color(0x8aa4c4),
    hemisphereGroundColor: new THREE.Color(0x586d8a),
    hemisphereIntensity: 1.25,
    ambientColor: new THREE.Color(0x7088a6),
    ambientIntensity: 0.48,
    skyZenithColor: new THREE.Color(0x365278),
    skyMidColor: new THREE.Color(0x8fa8c4),
    skyHorizonColor: new THREE.Color(0xe3d5c3),
    cloudLitColor: new THREE.Color(0xfff6e8),
    cloudShadowColor: new THREE.Color(0x8398b3),
    sunDiscColor: new THREE.Color(0xfff3db),
    starVisibility: 0.0,
    fogColor: new THREE.Color(0xcfd8e2),
    fogDensity: 0.0055,
    shojiEmissiveColor: new THREE.Color(0xffcf8c),
    shojiEmissiveIntensity: 0.38,
    lanternEmissiveColor: new THREE.Color(0xffce88),
    lanternEmissiveIntensity: 0.85,
    lanternPointIntensity: 0.55,
    shojiPointIntensity: 0.35,
    waterDeepColor: new THREE.Color(0x133330),
    waterShallowColor: new THREE.Color(0x285951),
    waterSkyReflectTint: new THREE.Color(0xb8c8d9),
    waterWarmGlowWeight: 0.22,
    steamBaseColor: new THREE.Color(0xeaf0f6),
    steamWarmColor: new THREE.Color(0xf7eadc),
    steamWarmWeight: 0.14,
    steamOpacity: 0.11,
    snowTint: new THREE.Color(0xf0f4f8),
    exposure: 0.96
  },
  blue: {
    name: "blue",
    sunDirection: new THREE.Vector3(-0.45, 0.35, 0.82).normalize(),
    sunColor: new THREE.Color(0x8aa8d4),
    sunIntensity: 0.98,
    hemisphereSkyColor: new THREE.Color(0x5878a3),
    hemisphereGroundColor: new THREE.Color(0x324766),
    hemisphereIntensity: 1.22,
    ambientColor: new THREE.Color(0x46628a),
    ambientIntensity: 0.54,
    skyZenithColor: new THREE.Color(0x162947),
    skyMidColor: new THREE.Color(0x32507a),
    skyHorizonColor: new THREE.Color(0x6685ad),
    cloudLitColor: new THREE.Color(0x8aa6cc),
    cloudShadowColor: new THREE.Color(0x294166),
    sunDiscColor: new THREE.Color(0xb8cfed),
    starVisibility: 0.28,
    fogColor: new THREE.Color(0x3b5882),
    fogDensity: 0.0060,
    shojiEmissiveColor: new THREE.Color(0xffc982),
    shojiEmissiveIntensity: 0.68,
    lanternEmissiveColor: new THREE.Color(0xffc67d),
    lanternEmissiveIntensity: 1.18,
    lanternPointIntensity: 0.95,
    shojiPointIntensity: 0.65,
    waterDeepColor: new THREE.Color(0x0e2926),
    waterShallowColor: new THREE.Color(0x1e4a43),
    waterSkyReflectTint: new THREE.Color(0x5c7da8),
    waterWarmGlowWeight: 0.42,
    steamBaseColor: new THREE.Color(0xaec2dc),
    steamWarmColor: new THREE.Color(0xf5dec4),
    steamWarmWeight: 0.20,
    steamOpacity: 0.13,
    snowTint: new THREE.Color(0xc4d6eb),
    exposure: 1.00
  },
  night: {
    name: "night",
    sunDirection: new THREE.Vector3(0.28, 0.42, -0.86).normalize(),
    sunColor: new THREE.Color(0x9ab6de),
    sunIntensity: 0.72,
    hemisphereSkyColor: new THREE.Color(0x344c70),
    hemisphereGroundColor: new THREE.Color(0x1d2c42),
    hemisphereIntensity: 0.82,
    ambientColor: new THREE.Color(0x283c59),
    ambientIntensity: 0.46,
    skyZenithColor: new THREE.Color(0x060d1a),
    skyMidColor: new THREE.Color(0x12223b),
    skyHorizonColor: new THREE.Color(0x253c5e),
    cloudLitColor: new THREE.Color(0x415b82),
    cloudShadowColor: new THREE.Color(0x0d182b),
    sunDiscColor: new THREE.Color(0xeef5ff),
    starVisibility: 0.92,
    fogColor: new THREE.Color(0x162640),
    fogDensity: 0.0058,
    shojiEmissiveColor: new THREE.Color(0xffc478),
    shojiEmissiveIntensity: 0.80,
    lanternEmissiveColor: new THREE.Color(0xffc073),
    lanternEmissiveIntensity: 1.32,
    lanternPointIntensity: 1.15,
    shojiPointIntensity: 0.78,
    waterDeepColor: new THREE.Color(0x081c1a),
    waterShallowColor: new THREE.Color(0x153832),
    waterSkyReflectTint: new THREE.Color(0x2d4466),
    waterWarmGlowWeight: 0.55,
    steamBaseColor: new THREE.Color(0x6e85a6),
    steamWarmColor: new THREE.Color(0xf2d6b8),
    steamWarmWeight: 0.25,
    steamOpacity: 0.14,
    snowTint: new THREE.Color(0x8da4c4),
    exposure: 1.02
  }
};

export function clonePresetState(preset) {
  return {
    name: preset.name,
    sunDirection: preset.sunDirection.clone(),
    sunColor: preset.sunColor.clone(),
    sunIntensity: preset.sunIntensity,
    hemisphereSkyColor: preset.hemisphereSkyColor.clone(),
    hemisphereGroundColor: preset.hemisphereGroundColor.clone(),
    hemisphereIntensity: preset.hemisphereIntensity,
    ambientColor: preset.ambientColor.clone(),
    ambientIntensity: preset.ambientIntensity,
    skyZenithColor: preset.skyZenithColor.clone(),
    skyMidColor: preset.skyMidColor.clone(),
    skyHorizonColor: preset.skyHorizonColor.clone(),
    cloudLitColor: preset.cloudLitColor.clone(),
    cloudShadowColor: preset.cloudShadowColor.clone(),
    sunDiscColor: preset.sunDiscColor.clone(),
    starVisibility: preset.starVisibility,
    fogColor: preset.fogColor.clone(),
    fogDensity: preset.fogDensity,
    shojiEmissiveColor: preset.shojiEmissiveColor.clone(),
    shojiEmissiveIntensity: preset.shojiEmissiveIntensity,
    lanternEmissiveColor: preset.lanternEmissiveColor.clone(),
    lanternEmissiveIntensity: preset.lanternEmissiveIntensity,
    lanternPointIntensity: preset.lanternPointIntensity,
    shojiPointIntensity: preset.shojiPointIntensity,
    waterDeepColor: preset.waterDeepColor.clone(),
    waterShallowColor: preset.waterShallowColor.clone(),
    waterSkyReflectTint: preset.waterSkyReflectTint.clone(),
    waterWarmGlowWeight: preset.waterWarmGlowWeight,
    steamBaseColor: preset.steamBaseColor.clone(),
    steamWarmColor: preset.steamWarmColor.clone(),
    steamWarmWeight: preset.steamWarmWeight,
    steamOpacity: preset.steamOpacity,
    snowTint: preset.snowTint.clone(),
    exposure: preset.exposure
  };
}

export function interpolatePresetStates(targetOut, fromState, toState, alpha) {
  const t = alpha * alpha * (3.0 - 2.0 * alpha);
  targetOut.sunDirection.lerpVectors(fromState.sunDirection, toState.sunDirection, t).normalize();
  targetOut.sunColor.lerpColors(fromState.sunColor, toState.sunColor, t);
  targetOut.sunIntensity = THREE.MathUtils.lerp(fromState.sunIntensity, toState.sunIntensity, t);
  targetOut.hemisphereSkyColor.lerpColors(fromState.hemisphereSkyColor, toState.hemisphereSkyColor, t);
  targetOut.hemisphereGroundColor.lerpColors(fromState.hemisphereGroundColor, toState.hemisphereGroundColor, t);
  targetOut.hemisphereIntensity = THREE.MathUtils.lerp(fromState.hemisphereIntensity, toState.hemisphereIntensity, t);
  targetOut.ambientColor.lerpColors(fromState.ambientColor, toState.ambientColor, t);
  targetOut.ambientIntensity = THREE.MathUtils.lerp(fromState.ambientIntensity, toState.ambientIntensity, t);
  targetOut.skyZenithColor.lerpColors(fromState.skyZenithColor, toState.skyZenithColor, t);
  targetOut.skyMidColor.lerpColors(fromState.skyMidColor, toState.skyMidColor, t);
  targetOut.skyHorizonColor.lerpColors(fromState.skyHorizonColor, toState.skyHorizonColor, t);
  targetOut.cloudLitColor.lerpColors(fromState.cloudLitColor, toState.cloudLitColor, t);
  targetOut.cloudShadowColor.lerpColors(fromState.cloudShadowColor, toState.cloudShadowColor, t);
  targetOut.sunDiscColor.lerpColors(fromState.sunDiscColor, toState.sunDiscColor, t);
  targetOut.starVisibility = THREE.MathUtils.lerp(fromState.starVisibility, toState.starVisibility, t);
  targetOut.fogColor.lerpColors(fromState.fogColor, toState.fogColor, t);
  targetOut.fogDensity = THREE.MathUtils.lerp(fromState.fogDensity, toState.fogDensity, t);
  targetOut.shojiEmissiveColor.lerpColors(fromState.shojiEmissiveColor, toState.shojiEmissiveColor, t);
  targetOut.shojiEmissiveIntensity = THREE.MathUtils.lerp(fromState.shojiEmissiveIntensity, toState.shojiEmissiveIntensity, t);
  targetOut.lanternEmissiveColor.lerpColors(fromState.lanternEmissiveColor, toState.lanternEmissiveColor, t);
  targetOut.lanternEmissiveIntensity = THREE.MathUtils.lerp(fromState.lanternEmissiveIntensity, toState.lanternEmissiveIntensity, t);
  targetOut.lanternPointIntensity = THREE.MathUtils.lerp(fromState.lanternPointIntensity, toState.lanternPointIntensity, t);
  targetOut.shojiPointIntensity = THREE.MathUtils.lerp(fromState.shojiPointIntensity, toState.shojiPointIntensity, t);
  targetOut.waterDeepColor.lerpColors(fromState.waterDeepColor, toState.waterDeepColor, t);
  targetOut.waterShallowColor.lerpColors(fromState.waterShallowColor, toState.waterShallowColor, t);
  targetOut.waterSkyReflectTint.lerpColors(fromState.waterSkyReflectTint, toState.waterSkyReflectTint, t);
  targetOut.waterWarmGlowWeight = THREE.MathUtils.lerp(fromState.waterWarmGlowWeight, toState.waterWarmGlowWeight, t);
  targetOut.steamBaseColor.lerpColors(fromState.steamBaseColor, toState.steamBaseColor, t);
  targetOut.steamWarmColor.lerpColors(fromState.steamWarmColor, toState.steamWarmColor, t);
  targetOut.steamWarmWeight = THREE.MathUtils.lerp(fromState.steamWarmWeight, toState.steamWarmWeight, t);
  targetOut.steamOpacity = THREE.MathUtils.lerp(fromState.steamOpacity, toState.steamOpacity, t);
  targetOut.snowTint.lerpColors(fromState.snowTint, toState.snowTint, t);
  targetOut.exposure = THREE.MathUtils.lerp(fromState.exposure, toState.exposure, t);
}
