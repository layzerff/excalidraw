import React, { useRef, useState } from 'react';
import { translate as ui } from './i18n.mjs';
export function textScaleBase(elements, text) {
  const container = elements.find(
    (e) => !e.isDeleted && e.id === text.containerId,
  );
  if (container) {
    const width = Math.max(
      1,
      container.width / (container.type === 'ellipse' ? Math.SQRT2 : 1) - 12,
    );
    const height = Math.max(
      1,
      container.height / (container.type === 'ellipse' ? Math.SQRT2 : 1) - 12,
    );
    const aspect = Math.max(0.2, text.width / Math.max(1, text.fontSize));
    const lines = Math.max(
      1,
      (text.originalText || text.text || '').split('\n').length,
    );
    return Math.max(
      1,
      Math.min(width / aspect, height / ((text.lineHeight || 1.25) * lines)),
    );
  }
  const saved = text.customData?.localCanvasTextScale;
  return saved &&
    Math.abs((saved.base * saved.ratio) / 100 - text.fontSize) < 0.2
    ? saved.base
    : text.fontSize * 2;
}
export function performTextScale(
  elements,
  state,
  value,
  app,
  nativeChange,
  clone,
) {
  const base = new Map(value.bases);
  const next = nativeChange(
    elements,
    state,
    app,
    (text) =>
      Math.max(
        1,
        ((base.get(text.id) || textScaleBase(elements, text)) * value.ratio) /
          100,
      ),
    value.fallback,
  );
  next.elements = next.elements.map((e, i) =>
    e !== elements[i] && e.type === 'text'
      ? clone(e, {
          customData: {
            ...e.customData,
            localCanvasTextScale: {
              ratio: value.ratio,
              base: base.get(e.id) || textScaleBase(elements, e),
            },
          },
        })
      : e,
  );
  return next;
}
export function TextScale({ elements, appState, updateData }) {
  const texts = elements.filter(
    (e) =>
      !e.isDeleted &&
      e.type === 'text' &&
      (appState.selectedElementIds[e.id] ||
        appState.selectedElementIds[e.containerId] ||
        appState.editingTextElement?.id === e.id),
  );
  const key = texts.map((e) => e.id).join(',');
  const session = useRef(null),
    active = useRef(false);
  const [, render] = useState(0);
  const [numberDraft, setNumberDraft] = useState(null);
  if (!session.current || session.current.key !== key) {
    const bases = texts.map((e) => [e.id, textScaleBase(elements, e)]);
    const first = texts[0],
      base = bases[0]?.[1];
    session.current = {
      key,
      bases,
      fallbackBase: appState.currentItemFontSize * 2,
      ratio: first
        ? Math.max(10, Math.min(100, Math.round((first.fontSize / base) * 100)))
        : 50,
    };
  }
  const s = session.current;
  if (
    !active.current &&
    !texts.length &&
    Math.abs(appState.currentItemFontSize - (s.fallbackBase * s.ratio) / 100) >
      0.2
  ) {
    s.fallbackBase = appState.currentItemFontSize * 2;
    s.ratio = 50;
  }
  // Rebase after native preset or manual resize, but never during this slider's gesture.
  if (!active.current && texts[0]) {
    const current = texts[0],
      expected = (s.bases[0]?.[1] * s.ratio) / 100;
    if (Math.abs(current.fontSize - expected) > 0.2) {
      s.bases = texts.map((e) => [e.id, textScaleBase(elements, e)]);
      s.ratio = Math.max(
        10,
        Math.min(100, Math.round((current.fontSize / s.bases[0][1]) * 100)),
      );
    }
  }
  const change = (value) => {
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio < 10 || ratio > 100) return;
    active.current = true;
    s.ratio = ratio;
    updateData({
      localCanvasTextScale: true,
      ratio,
      bases: s.bases,
      fallback: Math.max(1, (s.fallbackBase * ratio) / 100),
    });
    render((n) => n + 1);
  };
  return (
    <div
      className="text-scale-control"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <label>
        {ui('字号比例')}
        <span>{s.ratio}%</span>
      </label>
      <div>
        <input
          type="range"
          min="10"
          max="100"
          step="1"
          aria-label={ui('字号比例')}
          value={s.ratio}
          onChange={(e) => {
            setNumberDraft(null);
            change(e.target.value);
          }}
          onKeyUp={() => {
            active.current = false;
          }}
          onPointerUp={() => {
            active.current = false;
          }}
          onBlur={() => {
            active.current = false;
          }}
        />
        <input
          type="number"
          min="10"
          max="100"
          step="1"
          aria-label={ui('字号比例数值')}
          value={numberDraft ?? s.ratio}
          onChange={(e) => {
            setNumberDraft(e.target.value);
            if (e.target.value !== '') change(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={() => {
            active.current = false;
            setNumberDraft(null);
          }}
        />
      </div>
    </div>
  );
}
