const collator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});
export const SORT_MODES = ['custom', 'name', 'created'];
export function sortNodes(nodes, mode) {
  return [...nodes].sort((a, b) => {
    const result =
      mode === 'name'
        ? collator.compare(a.title, b.title)
        : mode === 'created'
          ? a.created - b.created
          : a.position - b.position;
    return result || a.id.localeCompare(b.id);
  });
}
