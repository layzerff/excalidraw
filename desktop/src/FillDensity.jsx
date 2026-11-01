import React, { useLayoutEffect, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw';
import { translate as __ui } from './i18n.mjs';
import { densityOf, FILL_TYPES } from './fill-density.mjs';
export function FillDensity({
  stage,
  api,
  value,
  defaults = {},
  setValue,
  signal,
  ink = false,
}) {
  const [target, setTarget] = useState(null),
    [draft, setDraft] = useState(value);
  const finishTimer = useRef(null),
    pointerActive = useRef(false),
    commitRef = useRef(() => {});
  const timer = useRef(null),
    editing = useRef(false),
    latest = useRef(value),
    affected = useRef([]),
    types = useRef([]);
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const find = () => {
      const input = root.querySelector(
        '[data-testid="fill-hachure"],[name="fill-style"]',
      );
      const fieldset = input?.closest('fieldset');
      const parent =
        fieldset?.parentElement ||
        (ink
          ? root.querySelector('.selected-shape-actions .panelColumn')
          : null);
      if (!parent) {
        setTarget(null);
        return;
      }
      let slot = parent.querySelector(':scope > .local-fill-density-slot');
      if (!slot) {
        slot = root.ownerDocument.createElement('div');
        slot.className = 'local-fill-density-slot';
        if (fieldset) fieldset.after(slot);
        else parent.append(slot);
      }
      setTarget(slot);
    };
    find();
    const o = new root.ownerDocument.defaultView.MutationObserver(find);
    o.observe(root, { childList: true, subtree: true });
    return () => o.disconnect();
  }, [stage, ink]);
  const editor = api.current,
    state = editor?.getAppState(),
    elements = editor?.getSceneElements() || [],
    selected = elements.filter(
      (e) => state?.selectedElementIds[e.id] && FILL_TYPES.has(e.type),
    );
  const ids = selected.map((e) => e.id).join(','),
    shown = selected.length
      ? densityOf(selected[0])
      : (defaults[state?.activeTool.type] ?? 100);
  useEffect(() => {
    if (!editing.current) {
      setDraft(shown);
      latest.current = shown;
    }
  }, [shown, ids]);
  useEffect(
    () => () => {
      if (timer.current)
        stage.current?.ownerDocument.defaultView.clearTimeout(timer.current);
    },
    [stage],
  );
  const apply = (next) => {
    const current = api.current;
    if (!current) return;
    const all = current.getSceneElementsIncludingDeleted();
    if (!editing.current) return;
    const changed = all.map((e) =>
      !e.isDeleted && affected.current.includes(e.id) && FILL_TYPES.has(e.type)
        ? newElementWith(e, {
            customData: { ...e.customData, localCanvasFillDensity: next },
          })
        : e,
    );
    if (changed.some((e, i) => e !== all[i]))
      current.updateScene({
        elements: changed,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
  };
  const commit = () => {
    if (!editing.current) return;
    const win = stage.current?.ownerDocument.defaultView;
    if (timer.current) win?.clearTimeout(timer.current);
    if (finishTimer.current) win?.clearTimeout(finishTimer.current);
    finishTimer.current = null;
    timer.current = null;
    apply(latest.current);
    setValue(latest.current, types.current);
    affected.current = [];
    editing.current = false;
  };
  const change = (next) => {
    if (!editing.current) {
      const editor = api.current;
      const selection = editor?.getAppState().selectedElementIds || {};
      const chosen = (editor?.getSceneElements() || []).filter(
        (e) => selection[e.id] && FILL_TYPES.has(e.type),
      );
      affected.current = chosen.map((e) => e.id);
      types.current = [
        ...new Set(
          chosen.length
            ? chosen.map((e) =>
                e.customData?.localCanvasBalloon ? 'balloon' : e.type,
              )
            : [editor?.getAppState().activeTool.type].filter((type) =>
                FILL_TYPES.has(type),
              ),
        ),
      ];
    }
    editing.current = true;
    latest.current = next;
    setDraft(next);
    const win = stage.current.ownerDocument.defaultView;
    if (finishTimer.current) win.clearTimeout(finishTimer.current);
    if (!pointerActive.current)
      finishTimer.current = win.setTimeout(() => commitRef.current(), 150);
    if (timer.current) return;
    timer.current = stage.current.ownerDocument.defaultView.setTimeout(() => {
      timer.current = null;
      apply(latest.current);
    }, 32);
  };
  commitRef.current = commit;
  useEffect(() => {
    const win = stage.current?.ownerDocument.defaultView;
    if (!win) return;
    const end = () => {
      pointerActive.current = false;
      commitRef.current();
    };
    win.addEventListener('pointerup', end, true);
    win.addEventListener('pointercancel', end, true);
    win.addEventListener('blur', end);
    return () => {
      win.removeEventListener('pointerup', end, true);
      win.removeEventListener('pointercancel', end, true);
      win.removeEventListener('blur', end);
      if (finishTimer.current) win.clearTimeout(finishTimer.current);
    };
  }, [stage]);
  return target
    ? createPortal(
        <div
          className="fill-density-control"
          onPointerDown={(e) => {
            pointerActive.current = true;
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>
            {__ui('填充密度')}
            <output>{draft}%</output>
          </span>
          <input
            type="range"
            min="10"
            max="200"
            step="1"
            aria-label={__ui('填充密度')}
            value={draft}
            onInput={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              change(Number(e.target.value));
            }}
            onPointerUp={commit}
            onPointerCancel={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
          <small>{__ui('100% 为原生默认密度；实心保持铺满')}</small>
        </div>,
        target,
      )
    : null;
}
