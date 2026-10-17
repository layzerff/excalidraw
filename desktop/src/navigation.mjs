export function viewRect(state) {
  return {
    x: -state.scrollX,
    y: -state.scrollY,
    width: state.width / state.zoom.value,
    height: state.height / state.zoom.value,
  };
}
export function targetView(rect, width, height) {
  const zoom = Math.min(
    30,
    Math.max(0.1, Math.min(width / rect.width, height / rect.height) * 0.92),
  );
  return {
    zoom,
    scrollX: width / (2 * zoom) - rect.x - rect.width / 2,
    scrollY: height / (2 * zoom) - rect.y - rect.height / 2,
  };
}
export function interpolate(from, to, t) {
  const ease = t * t * (3 - 2 * t);
  const zoom = Math.exp(
    Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * ease,
  );
  return {
    zoom,
    scrollX: from.scrollX + (to.scrollX - from.scrollX) * ease,
    scrollY: from.scrollY + (to.scrollY - from.scrollY) * ease,
  };
}
export function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
