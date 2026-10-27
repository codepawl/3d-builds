// Paints the radar picture onto the ground: the rotating sweep with its fading trail, range rings
// and the airway and approach lines. Drawn in the terrain's own shader so it follows hills and sea.
import * as THREE from 'three'

const MAX_SEGMENTS = 16
const SWEEP_SECONDS = 4.8

export function createMapUniforms(site) {
  const segments = Array.from({ length: MAX_SEGMENTS }, () => new THREE.Vector4())
  const kinds = new Array(MAX_SEGMENTS).fill(0)
  site.airways.slice(0, MAX_SEGMENTS).forEach((airway, index) => {
    segments[index].set(airway.from[0], airway.from[1], airway.to[0], airway.to[1])
    kinds[index] = airway.kind === 'final' ? 2 : 1
  })
  return {
    uSweep: { value: 0 },
    uRadar: { value: new THREE.Vector3(site.radar.x, site.radar.z, site.radar.range) },
    uRing: { value: site.nm * (site.id === 'CTR' ? 20 : site.id === 'APP' ? 5 : 2) },
    uNm: { value: site.nm },
    uSegments: { value: segments },
    uSegmentKinds: { value: kinds },
    uSegmentCount: { value: Math.min(MAX_SEGMENTS, site.airways.length) },
  }
}

export function advanceSweep(uniforms, elapsed) {
  uniforms.uSweep.value = ((elapsed / SWEEP_SECONDS) % 1) * Math.PI * 2
}

const VERTEX_HEAD = /* glsl */ `
varying vec3 vMapWorld;
`

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vMapWorld;
uniform float uSweep;
uniform vec3 uRadar;
uniform float uRing;
uniform float uNm;
uniform vec4 uSegments[${MAX_SEGMENTS}];
uniform float uSegmentKinds[${MAX_SEGMENTS}];
uniform int uSegmentCount;
`

const FRAGMENT_BODY = /* glsl */ `
{
  vec2 point = vMapWorld.xz;
  vec2 fromRadar = point - uRadar.xy;
  float radius = length(fromRadar);
  float inRange = 1.0 - smoothstep(uRadar.z * 0.94, uRadar.z, radius);
  float angle = atan(fromRadar.x, -fromRadar.y);
  float behind = mod(uSweep - angle, 6.2831853);
  float trail = exp(-behind * 2.4) * inRange;
  float edge = (1.0 - smoothstep(0.0, 0.035, behind)) * inRange;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.32, 0.92, 0.70), clamp(trail * 0.30 + edge * 0.35, 0.0, 0.6));

  float pixel = length(vec2(fwidth(point.x), fwidth(point.y)));
  float ringDistance = abs(mod(radius + uRing * 0.5, uRing) - uRing * 0.5);
  float ring = (1.0 - smoothstep(pixel * 0.6, pixel * 1.6, ringDistance)) * inRange * step(uRing * 0.5, radius);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.38, 0.48, 0.66), ring * 0.32);

  for (int index = 0; index < ${MAX_SEGMENTS}; index++) {
    if (index >= uSegmentCount) break;
    vec4 segment = uSegments[index];
    vec2 start = segment.xy;
    vec2 along = segment.zw - start;
    float lengthSquared = max(dot(along, along), 1.0);
    float t = clamp(dot(point - start, along) / lengthSquared, 0.0, 1.0);
    float away = length(point - (start + along * t));
    float kind = uSegmentKinds[index];
    if (kind > 1.5) {
      float core = 1.0 - smoothstep(pixel * 1.0, pixel * 2.2, away);
      float band = (1.0 - smoothstep(0.0, uNm * 0.5, away)) * 0.22;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.16, 0.31, 0.85), clamp(core * 0.85 + band, 0.0, 1.0));
    } else {
      float dash = step(0.42, fract(t * sqrt(lengthSquared) / (uNm * 0.9)));
      float line = (1.0 - smoothstep(pixel * 0.7, pixel * 1.8, away)) * dash;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.30, 0.38, 0.56), line * 0.6);
    }
  }
}
`

export function applyMapShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vMapWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>\n${FRAGMENT_BODY}`,
    )
  }
  material.customProgramCacheKey = () => 'radar-map'
  return material
}
