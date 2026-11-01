import { match as pinyinMatch } from 'pinyin-pro';

// UTF-16 offsets match Excalidraw text slices. Never rewrite document text.
export function matchText(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const lower = text.toLowerCase(),
    ranges = [];
  let start = 0;
  while (start <= lower.length - q.length) {
    const i = lower.indexOf(q, start);
    if (i < 0) break;
    ranges.push([i, i + q.length]);
    start = i + q.length;
  }
  if (ranges.length) return { kind: 'text', rank: 0, ranges };
  if (text.includes('\n')) {
    const map = [];
    let compact = '';
    for (let i = 0; i < text.length; i++)
      if (text[i] !== '\n') {
        compact += text[i];
        map.push(i);
      }
    const found = matchText(compact, query);
    return found
      ? {
          ...found,
          ranges: found.ranges.map(([a, b]) => [map[a], map[b - 1] + 1]),
        }
      : null;
  }

  // Native library supports full pinyin, initials and mixed pinyin. Keep Latin
  // lookups of Latin labels ahead of phonetic matches and avoid 1-letter noise.
  const phonetic = q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'’-]/g, '');
  if (!/^[a-z]{2,}$/.test(phonetic) || !/[\u3400-\u9fff]/.test(text))
    return null;
  const indices = pinyinMatch(text, phonetic, { continuous: true });
  if (!indices?.length) return null;
  const spans = [];
  for (const i of indices) {
    const last = spans.at(-1);
    if (last && last[1] === i) last[1] = i + 1;
    else spans.push([i, i + 1]);
  }
  return { kind: 'pinyin', rank: 1, ranges: spans };
}
export function searchElements(elements, query) {
  if (!query.trim()) return [];
  return elements
    .filter((e) => !e.isDeleted && e.type === 'text')
    .flatMap((element) => {
      const match = matchText(element.text || '', query);
      return match ? [{ element, ...match }] : [];
    })
    .sort((a, b) => a.rank - b.rank);
}
export function highlightParts(text, ranges) {
  const parts = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), highlight: false });
    parts.push({ text: text.slice(start, end), highlight: true });
    cursor = end;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), highlight: false });
  return parts;
}
// Supply the installed 0.18.1 native search renderer with its own SearchMatch[]
// structure. Canvas font metrics preserve exact prefix widths and alignment;
// the native renderer handles element/group rotation and viewport transforms.
export function nativeSearchMatches(matches, focusedId, measure) {
  return matches.map(({ element: e, ranges }) => {
    const lines = e.text.split('\n'),
      height =
        (e.lineHeight ||
          e.height / Math.max(1, lines.length) / e.fontSize ||
          1.25) * e.fontSize;
    let cursor = 0;
    const matchedLines = [];
    lines.forEach((line, lineIndex) => {
      const lineStart = cursor,
        lineEnd = cursor + line.length;
      const lineWidth = measure(line, e);
      const align =
        e.textAlign === 'center'
          ? (e.width - lineWidth) / 2
          : e.textAlign === 'right'
            ? e.width - lineWidth
            : 0;
      for (const [start, end] of ranges) {
        const a = Math.max(start, lineStart),
          b = Math.min(end, lineEnd);
        if (a < b)
          matchedLines.push({
            offsetX: align + measure(line.slice(0, a - lineStart), e),
            offsetY: lineIndex * height,
            width: measure(line.slice(a - lineStart, b - lineStart), e),
            height,
          });
      }
      cursor = lineEnd + 1;
    });
    return { id: e.id, focus: e.id === focusedId, matchedLines };
  });
}
