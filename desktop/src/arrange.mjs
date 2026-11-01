export function arrangeElements(elements, selectedIds, mode, gap, getBounds) {
  if (!['vertical', 'horizontal', 'grid'].includes(mode))
    throw new Error('无效的整理模式');
  if (!Number.isFinite(gap) || gap < 0 || gap > 1000)
    throw new Error('间距须为 0–1000');
  const live = elements.filter((e) => !e.isDeleted),
    selected = new Set(selectedIds);
  const groups = new Set(
    live
      .filter((e) => selected.has(e.id))
      .map((e) => e.groupIds?.at(-1))
      .filter(Boolean),
  );
  for (const e of live)
    if (e.groupIds?.some((g) => groups.has(g))) selected.add(e.id);
  const frames = new Set(
    live
      .filter(
        (e) => selected.has(e.id) && ['frame', 'magicframe'].includes(e.type),
      )
      .map((e) => e.id),
  );
  const owner = (e, seen = new Set()) => {
    if (seen.has(e.id)) return e.id;
    seen.add(e.id);
    if (frames.has(e.frameId)) return `frame:${e.frameId}`;
    if (frames.has(e.id)) return `frame:${e.id}`;
    if (e.containerId)
      return owner(
        live.find((c) => c.id === e.containerId) || { id: e.containerId },
        seen,
      );
    return e.groupIds?.length ? `group:${e.groupIds.at(-1)}` : e.id;
  };
  for (const e of live)
    if (frames.has(e.frameId) || (e.containerId && selected.has(e.containerId)))
      selected.add(e.id);
  const units = new Map();
  for (const e of live) {
    if (!selected.has(e.id)) continue;
    const key = owner(e);
    if (!units.has(key)) units.set(key, []);
    units.get(key).push(e);
  }
  const items = [...units.values()]
    .map((members) => {
      const [x, y, r, b] = getBounds(members);
      return { members, x, y, w: r - x, h: b - y };
    })
    .sort((a, b) =>
      mode === 'horizontal' ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x,
    );
  if (!items.length) throw new Error('请先框选或选中需要整理的元素');
  const ox = Math.min(...items.map((i) => i.x)),
    oy = Math.min(...items.map((i) => i.y));
  const cols =
    mode === 'vertical'
      ? 1
      : mode === 'horizontal'
        ? items.length
        : Math.ceil(Math.sqrt(items.length));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(...items.filter((_, i) => i % cols === c).map((i) => i.w)),
  );
  const heights = Array.from(
    { length: Math.ceil(items.length / cols) },
    (_, r) =>
      Math.max(...items.slice(r * cols, (r + 1) * cols).map((i) => i.h)),
  );
  const moves = new Map();
  items.forEach((u, i) => {
    const c = i % cols,
      r = Math.floor(i / cols);
    const dx = ox + widths.slice(0, c).reduce((a, b) => a + b + gap, 0) - u.x,
      dy = oy + heights.slice(0, r).reduce((a, b) => a + b + gap, 0) - u.y;
    u.members.forEach((e) => moves.set(e.id, { x: e.x + dx, y: e.y + dy }));
  });
  return { moves, ids: [...moves.keys()], unitCount: items.length };
}
