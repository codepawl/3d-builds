// Shared book dimensions, in centimetres. The gutter runs along x at y = 0, z = 0; the reader sits on the +z side.
export const PAGE_WIDTH = 84;
export const PAGE_DEPTH = 44;
export const PIXELS_PER_CM = 40;
export const CARD_THICKNESS = 0.24;
export const COVER_THICKNESS = 0.5;
export const REST_DEGREES = 112;

export function pagePixels() {
  return [PAGE_WIDTH * PIXELS_PER_CM, PAGE_DEPTH * PIXELS_PER_CM];
}
// near leaf (floor) texture: x from -42..42 left to right, top row at the gutter, bottom row at the front edge
export function floorX(centimetres) { return (centimetres + PAGE_WIDTH / 2) * PIXELS_PER_CM; }
export function floorZ(centimetres) { return centimetres * PIXELS_PER_CM; }
