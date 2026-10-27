// Weather on surfaces, decided per pixel in the standard material's fragment shader:
// - stone: upward-facing surfaces turn white with a noisy, soft edge, except close to the hot water where the
//   steam keeps the rocks bare and wet. Vertex colours carry the bare stone only.
// - deck: the open planks are wet and darker with a soft sheen, and snow drifts along the outer edges;
//   the planks under the ryokan's eaves stay dry.
import { valueNoiseGlsl } from "./glsl.js";

const POOL_RADIUS_X = 4.3;
const POOL_RADIUS_Z = 3.0;

const stoneWeatherGlsl = /* glsl */ `
  {
    vec3 worldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec2 noisePoint = weatherWorldPosition.xz * 3.1 + weatherWorldPosition.y * 1.7;
    float edgeNoise = fractalNoise(noisePoint) - 0.5;
    float fineNoise = valueNoise(noisePoint * 6.0) - 0.5;
    float poolRatio = length(weatherWorldPosition.xz / vec2(${POOL_RADIUS_X.toFixed(2)}, ${POOL_RADIUS_Z.toFixed(2)}));
    float melt = smoothstep(1.05, 1.22, poolRatio + 0.08 * edgeNoise);
    float aboveSpray = smoothstep(weatherWaterLevel + 0.22, weatherWaterLevel + 0.38, weatherWorldPosition.y);
    float cover = smoothstep(0.5, 0.68, worldNormal.y + 0.35 * edgeNoise + 0.06 * fineNoise);
    float snowAmount = cover * melt * aboveSpray;
    vec3 snowColor = vec3(0.9, 0.92, 0.96) * (0.94 + 0.12 * fineNoise);
    diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowAmount);
    roughnessFactor = mix(roughnessFactor, 0.8, snowAmount);
  }
`;

const deckWeatherGlsl = /* glsl */ `
  {
    vec3 worldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float facingUp = smoothstep(0.7, 0.9, worldNormal.y);
    vec2 planePoint = weatherWorldPosition.xz;
    float sheltered = smoothstep(-7.9, -8.5, planePoint.y) * step(planePoint.x, 7.2);
    float nearOuterEdge = max(smoothstep(-4.9, -3.95, planePoint.y), smoothstep(7.3, 8.35, planePoint.x));
    float drift = fractalNoise(planePoint * vec2(1.3, 2.6)) + 0.55 * nearOuterEdge;
    float fineNoise = valueNoise(planePoint * 18.0) - 0.5;
    float snowAmount = smoothstep(0.78, 0.9, drift + 0.05 * fineNoise) * (1.0 - sheltered) * facingUp;
    float wetAmount = (1.0 - snowAmount) * (1.0 - sheltered) * facingUp;
    diffuseColor.rgb *= 1.0 - 0.32 * wetAmount;
    roughnessFactor = mix(roughnessFactor, 0.32, wetAmount);
    vec3 snowColor = vec3(0.9, 0.92, 0.96) * (0.95 + 0.1 * fineNoise);
    diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowAmount);
    roughnessFactor = mix(roughnessFactor, 0.8, snowAmount);
  }
`;

function injectWeather(material, waterLevel, weatherGlsl, cacheKey) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.weatherWaterLevel = { value: waterLevel };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 weatherWorldPosition;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        weatherWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 weatherWorldPosition;
        uniform float weatherWaterLevel;
        ${valueNoiseGlsl}`
      )
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${weatherGlsl}`);
  };
  material.customProgramCacheKey = () => cacheKey;
}

export function addStoneSnow(material, waterLevel) {
  injectWeather(material, waterLevel, stoneWeatherGlsl, "stone-weather");
}

export function addDeckWeather(material, waterLevel) {
  injectWeather(material, waterLevel, deckWeatherGlsl, "deck-weather");
}
