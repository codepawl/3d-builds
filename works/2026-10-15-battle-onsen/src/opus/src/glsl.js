// Shared GLSL snippets.

export const valueNoiseGlsl = /* glsl */ `
  float hashValue(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    vec2 smoothFraction = fraction * fraction * (3.0 - 2.0 * fraction);
    float bottomLeft = hashValue(cell);
    float bottomRight = hashValue(cell + vec2(1.0, 0.0));
    float topLeft = hashValue(cell + vec2(0.0, 1.0));
    float topRight = hashValue(cell + vec2(1.0, 1.0));
    return mix(mix(bottomLeft, bottomRight, smoothFraction.x), mix(topLeft, topRight, smoothFraction.x), smoothFraction.y);
  }
  float fractalNoise(vec2 point) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      total += valueNoise(point) * amplitude;
      point = point * 2.03 + vec2(1.7, 9.2);
      amplitude *= 0.5;
    }
    return total;
  }
`;
