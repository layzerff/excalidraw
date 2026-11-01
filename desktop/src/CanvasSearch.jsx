import { translate as __ui } from './i18n.mjs';
import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  searchElements,
  highlightParts,
  nativeSearchMatches,
} from './search.mjs';
import { CaptureUpdateAction, FONT_FAMILY } from '@excalidraw/excalidraw';
export function CanvasSearch({
  api,
  elements,
  disabled,
  inputRef,
  documentId,
}) {
  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [documentId]);
  const [focusedId, setFocusedId] = useState(null);
  const metrics = useRef(null);
  const lastHighlights = useRef(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  const matches = useMemo(
    () => searchElements(elements, query),
    [query, elements],
  );
  useLayoutEffect(() => {
    const editor = api.current;
    if (!editor) return;
    if (!metrics.current)
      metrics.current = inputRef.current?.ownerDocument
        .createElement('canvas')
        .getContext('2d');
    const measure = (text, e) => {
      const context = metrics.current;
      if (!context) return text.length * e.fontSize;
      const name =
        Object.keys(FONT_FAMILY).find((k) => FONT_FAMILY[k] === e.fontFamily) ||
        'Excalifont';
      context.font = `${e.fontSize}px "${name}", "Xiaolai", sans-serif`;
      return context.measureText(text).width;
    };
    const highlights = disabled
      ? []
      : nativeSearchMatches(matches, focusedId, measure);
    const key = JSON.stringify(highlights);
    if (
      lastHighlights.current?.editor === editor &&
      lastHighlights.current.key === key
    )
      return;
    lastHighlights.current = { editor, key };
    if (!highlights.length && !editor.getAppState().searchMatches?.length)
      return;
    // Highlight geometry is unobserved UI state. NEVER would rebase pending
    // element edits and can swallow a density preview before it is committed.
    editor.updateScene({
      appState: { searchMatches: highlights },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  }, [matches, focusedId, disabled, api, inputRef, documentId, fontEpoch]);
  useEffect(() => {
    setFocusedId(null);
  }, [query, documentId]);
  useEffect(() => {
    const doc = inputRef.current?.ownerDocument;
    if (!doc?.fonts) return;
    let alive = true;
    const refresh = () => {
      if (alive) setFontEpoch((v) => v + 1);
    };
    doc.fonts.ready.then(refresh);
    doc.fonts.addEventListener('loadingdone', refresh);
    return () => {
      alive = false;
      doc.fonts.removeEventListener('loadingdone', refresh);
    };
  }, [documentId, inputRef]);
  function focus(element) {
    if (!api.current) return;
    setFocusedId(element.id);
    api.current.updateScene({
      appState: {
        selectedElementIds: {
          [element.id]: true,
        },
        selectedGroupIds: {},
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.current.scrollToContent(element, {
      fitToContent: true,
      animate: true,
      duration: 500,
      maxZoom: 1,
    });
  }
  return (
    <section className="workspace-search">
      <label className="workspace-search-field">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          aria-label={__ui('搜索画布文字')}
          placeholder={__ui('搜索')}
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) focus(matches[0].element);
          }}
        />
      </label>
      {query.trim() && (
        <div
          className="workspace-search-results"
          aria-label={__ui('画布搜索结果')}
        >
          <small>
            {matches.length ? __ui('匹配结果') : __ui('未找到匹配文字')} ·{' '}
            {matches.length}
          </small>
          {matches.slice(0, 100).map(({ element: e, ranges, kind }) => (
            <button
              key={e.id}
              title={e.text}
              aria-pressed={focusedId === e.id}
              onClick={() => focus(e)}
            >
              <span>
                {highlightParts(e.text, ranges).map((part, i) =>
                  part.highlight ? (
                    <mark key={i}>{part.text}</mark>
                  ) : (
                    <React.Fragment key={i}>{part.text}</React.Fragment>
                  ),
                )}
              </span>
              {kind === 'pinyin' && (
                <small className="search-match-kind">{__ui('拼音')}</small>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
