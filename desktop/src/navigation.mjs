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
    Math.max(0.0005, Math.min(width / rect.width, height / rect.height) * 0.92),
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

// Proportional zoom keeps wheel movement equally fine at 100%, 10% and overview
// scales. Cap one event to prevent coarse mouse wheels from making huge jumps.
export function fineWheelZoom(zoom, delta, mode = 0, step = 5) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? 700 : 1);
  return Math.min(
    zoom > 30 ? Number.MAX_VALUE : 30,
    Math.max(
      zoom < 0.0005 ? Number.MIN_VALUE : 0.0005,
      zoom *
        Math.pow(
          1 + Math.min(50, Math.max(1, Number(step) || 5)) / 100,
          -Math.max(-120, Math.min(120, pixels)) / 120,
        ),
    ),
  );
}

// Overview is a geometric fit, independent from wheel/button zoom limits.
export function overviewView(bounds, width, height, padding = 0.85) {
  const [x1, y1, x2, y2] = bounds;
  if (
    ![x1, y1, x2, y2, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const zoom =
    Math.min(
      width / Math.max(1e-12, x2 - x1),
      height / Math.max(1e-12, y2 - y1),
    ) * padding;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  return {
    zoom: { value: zoom },
    scrollX: width / (2 * zoom) - (x1 + x2) / 2,
    scrollY: height / (2 * zoom) - (y1 + y2) / 2,
  };
}
