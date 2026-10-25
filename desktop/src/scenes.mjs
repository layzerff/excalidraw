export function sceneRange(scenes, anchorId, targetId) {
  const anchor = scenes.findIndex((scene) => scene.id === anchorId);
  const target = scenes.findIndex((scene) => scene.id === targetId);
  if (target < 0) return [];
  if (anchor < 0) return [targetId];
  return scenes
    .slice(Math.min(anchor, target), Math.max(anchor, target) + 1)
    .map((scene) => scene.id);
}

export function selectedBinding(elements, state) {
  const groupIds = Object.keys(state.selectedGroupIds || {}).filter(
    (id) => state.selectedGroupIds[id],
  );
  const selected = elements.filter(
    (element) =>
      !element.isDeleted &&
      (state.selectedElementIds?.[element.id] ||
        element.groupIds?.some((id) => groupIds.includes(id))),
  );
  return { elementIds: selected.map((element) => element.id), groupIds };
}

export function followScenes(scenes, elements, getBounds) {
  let changed = false;
  const live = elements.filter((element) => !element.isDeleted);
  const next = scenes.map((scene) => {
    if (!scene.binding) return scene;
    const selected = live.filter(
      (element) =>
        scene.binding.elementIds.includes(element.id) ||
        element.groupIds?.some((id) => scene.binding.groupIds.includes(id)),
    );
    if (!selected.length) return scene; // Preserve the last view; undo can restore the same IDs.
    const [left, top, right, bottom] = getBounds(selected);
    if (![left, top, right, bottom].every(Number.isFinite)) return scene;
    const rect = {
      x: left - 24,
      y: top - 24,
      width: Math.max(1, right - left) + 48,
      height: Math.max(1, bottom - top) + 48,
    };
    if (Object.keys(rect).every((key) => rect[key] === scene.rect[key]))
      return scene;
    changed = true;
    return { ...scene, rect };
  });
  return changed ? next : scenes;
}
