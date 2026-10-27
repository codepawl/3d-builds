/** Local shader customization for the pinned 67.js renderer. */
export function cartoonShaders(source) {
  const marker = "  float metallic = surface.x;";
  if (!source.includes(marker)) throw new Error("67.js shader hook changed.");
  return source.replace(
    marker,
    `
  if (surface.w == 0.0) {
    float lightAmount = dot(normal, normalize(vec3(-3.0, 5.0, 5.0)));
    float shade = 0.70 + smoothstep(-0.50, 0.85, lightAmount) * 0.30;
    vec3 cartoonColor = color * shade;
    outputColor = vec4(pow(max(cartoonColor, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
    return;
  }
` + marker,
  );
}
