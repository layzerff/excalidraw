export function balloonNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 999999)
    throw new Error('球标编号须为 1–999999 的整数');
  return number;
}
export function balloonSkeleton(point, state, number, size) {
  balloonNumber(number);
  const fontSize = size?.fontSize || state.currentItemFontSize || 20;
  const diameter =
    Math.max(size?.width || 0, size?.height || 0, size?.diameter || 0) ||
    Math.max(56, fontSize * (2.4 + (String(number).length - 1) * 0.8));
  return {
    type: 'ellipse',
    x: point.x - diameter / 2,
    y: point.y - diameter / 2,
    width: diameter,
    height: diameter,
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roughness: state.currentItemRoughness,
    opacity: state.currentItemOpacity,
    customData: { localCanvasBalloon: true },
    label: {
      text: String(number),
      fontSize,
      fontFamily: state.currentItemFontFamily,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: state.currentItemStrokeColor,
      opacity: state.currentItemOpacity,
    },
  };
}

export function resizedBalloon(before, after, state) {
  if (!state.isResizing && !state.resizingElement) return null;
  const old = new Map(before.map((e) => [e.id, e]));
  const changed = after.filter(
    (e) =>
      !e.isDeleted &&
      e.type === 'ellipse' &&
      e.customData?.localCanvasBalloon &&
      old.has(e.id) &&
      (Math.abs(old.get(e.id).width - e.width) > 0.01 ||
        Math.abs(old.get(e.id).height - e.height) > 0.01),
  );
  const source = changed.at(-1);
  if (!source) return null;
  const text = after.find(
    (e) => e.type === 'text' && !e.isDeleted && e.containerId === source.id,
  );
  return {
    width: source.width,
    height: source.height,
    diameter: Math.max(source.width, source.height),
    fontSize: text?.fontSize || 20,
  };
}

const PRESET_FACTORS = { 16: 0.56, 20: 0.72, 28: 0.86, 36: 1 };
export function balloonPresetSize(elements, text, preset) {
  const container = elements.find(
    (e) =>
      e.id === text.containerId &&
      !e.isDeleted &&
      e.type === 'ellipse' &&
      e.customData?.localCanvasBalloon,
  );
  if (!container || !PRESET_FACTORS[preset]) return preset;
  const available = Math.max(
    1,
    Math.min(container.width, container.height) / Math.SQRT2 - 10,
  );
  const aspect = Math.max(0.2, text.width / Math.max(1, text.fontSize));
  const fit = available / Math.max(aspect, text.lineHeight || 1.25);
  return Math.max(1, Math.round(fit * PRESET_FACTORS[preset] * 10) / 10);
}
export function balloonPresetValue(elements, text) {
  const container = elements.find(
    (e) => e.id === text.containerId && e.customData?.localCanvasBalloon,
  );
  if (!container) return text.fontSize;
  return [16, 20, 28, 36].sort(
    (a, b) =>
      Math.abs(balloonPresetSize(elements, text, a) - text.fontSize) -
      Math.abs(balloonPresetSize(elements, text, b) - text.fontSize),
  )[0];
}
export function restyledBalloon(before, after, state) {
  const old = new Map(before.map((e) => [e.id, e]));
  const text = after.find(
    (e) =>
      e.type === 'text' &&
      !e.isDeleted &&
      old.has(e.id) &&
      e.fontSize !== old.get(e.id).fontSize &&
      (state.selectedElementIds?.[e.id] ||
        state.selectedElementIds?.[e.containerId]),
  );
  const ellipse =
    text &&
    after.find(
      (e) =>
        e.id === text.containerId &&
        e.customData?.localCanvasBalloon &&
        !e.isDeleted,
    );
  return ellipse
    ? {
        width: ellipse.width,
        height: ellipse.height,
        diameter: Math.max(ellipse.width, ellipse.height),
        fontSize: text.fontSize,
      }
    : null;
}

// The official converter may grow a label's container independently on each
// axis. Restore a true circle and center the native measured label afterward.
export function circularBalloons(elements, center) {
  const changes = new Map();
  for (const ellipse of elements) {
    if (
      ellipse.isDeleted ||
      ellipse.type !== 'ellipse' ||
      !ellipse.customData?.localCanvasBalloon
    )
      continue;
    const label = elements.find(
      (e) => e.type === 'text' && !e.isDeleted && e.containerId === ellipse.id,
    );
    const diameter = Math.max(
      ellipse.width,
      ellipse.height,
      label ? Math.hypot(label.width + 12, label.height + 12) : 0,
    );
    const cx = center?.x ?? ellipse.x + ellipse.width / 2,
      cy = center?.y ?? ellipse.y + ellipse.height / 2;
    if (
      Math.abs(ellipse.width - ellipse.height) > 1e-6 ||
      diameter > ellipse.width + 1e-6 ||
      center
    )
      changes.set(ellipse.id, {
        ...ellipse,
        x: cx - diameter / 2,
        y: cy - diameter / 2,
        width: diameter,
        height: diameter,
      });
    if (label && (changes.has(ellipse.id) || center))
      changes.set(label.id, {
        ...label,
        x: cx - label.width / 2,
        y: cy - label.height / 2,
      });
  }
  return elements.map((e) => changes.get(e.id) || e);
}
