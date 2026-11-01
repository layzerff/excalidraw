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

// Keep cascade history only for the current editor's undo session. Reopening a
// document starts a fresh native undo history, so deleted scenes stay deleted.
export function cascadeScenes(scenes, before, after, archive) {
  const live = new Set(after.filter((e) => !e.isDeleted).map((e) => e.id));
  const removed = before.filter((e) => !e.isDeleted && !live.has(e.id));
  const removedIds = new Set(removed.map((e) => e.id));
  const removedGroups = new Set(removed.flatMap((e) => e.groupIds || []));
  const deleted = scenes.filter(
    (s) =>
      s.binding &&
      (s.binding.elementIds.some((id) => removedIds.has(id)) ||
        s.binding.groupIds.some((id) => removedGroups.has(id))),
  );
  for (const s of deleted)
    archive.set(s.id, {
      scene: s,
      index: scenes.indexOf(s),
      removed: removed
        .filter(
          (e) =>
            s.binding.elementIds.includes(e.id) ||
            e.groupIds?.some((g) => s.binding.groupIds.includes(g)),
        )
        .map((e) => e.id),
    });
  let next = scenes.filter((s) => !deleted.includes(s));
  for (const [id, entry] of archive) {
    if (entry.removed.length && entry.removed.every((id) => live.has(id))) {
      if (!next.some((s) => s.id === id))
        next.splice(Math.min(entry.index, next.length), 0, entry.scene);
      archive.delete(id);
    }
  }
  return {
    scenes: deleted.length || next.length !== scenes.length ? next : scenes,
    deleted,
  };
}
