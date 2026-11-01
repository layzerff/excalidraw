export const FILL_TYPES = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'freedraw',
]);
export function densityOf(element) {
  const value = element?.customData?.localCanvasFillDensity;
  return Number.isFinite(value) ? Math.min(200, Math.max(10, value)) : 100;
}
export function fillGap(strokeWidth, density = 100) {
  return Math.max(
    0.5,
    (strokeWidth * 4 * 100) / Math.min(200, Math.max(10, density)),
  );
}
