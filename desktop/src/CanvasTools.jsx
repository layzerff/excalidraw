import { translate as __ui } from './i18n.mjs';
import React, { useLayoutEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
export function CanvasTools({
  stage,
  order = [],
  onOrderChange,
  openVideo,
  disabled,
  balloon,
  toggleBalloon,
  nextNumber,
  setNextNumber,
}) {
  const [sorting, setSorting] = useState(false);
  const drag = useRef(null);
  const latestOrder = useRef(order);
  latestOrder.current = order;
  const [target, setTarget] = useState(null);
  const [panel, setPanel] = useState(null);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const find = () => {
      setTarget(
        node.querySelector('.excalidraw .App-toolbar .Stack_horizontal'),
      );
      setPanel(
        node.querySelector('.excalidraw .selected-shape-actions .panelColumn'),
      );
    };
    find();
    const observer = new node.ownerDocument.defaultView.MutationObserver(find);
    observer.observe(node, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [stage]);
  useLayoutEffect(() => {
    if (!target) return;
    function items() {
      const candidates = [...target.children];
      return candidates
        .map((node, index) => {
          if (node.classList.contains('toolbar-sort-toggle')) return null;
          const control = node.matches('input,button')
            ? node
            : node.querySelector('input,button');
          const id =
            node.dataset.localTool ||
            control?.getAttribute('data-testid') ||
            control?.value ||
            control?.getAttribute('aria-label');
          if (!id || (node.tagName === 'DIV' && !control)) return null;
          node.dataset.localTool = id;
          node.dataset.defaultOrder ||= String(index);
          return {
            node,
            id,
          };
        })
        .filter(Boolean);
    }
    const apply = () => {
      for (const { node, id } of items()) {
        const i = latestOrder.current.indexOf(id);
        node.style.order = String(
          i < 0 ? 100 + Number(node.dataset.defaultOrder) : i,
        );
        node.classList.toggle('toolbar-sortable', sorting);
      }
    };
    apply();
    const observer = new target.ownerDocument.defaultView.MutationObserver(
      apply,
    );
    observer.observe(target, {
      childList: true,
      subtree: true,
    });
    const down = (e) => {
      if (!sorting) return;
      const item = items().find(({ node }) => node.contains(e.target));
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      drag.current = item.id;
      target.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!drag.current) return;
      e.preventDefault();
      e.stopPropagation();
      const all = items().sort(
        (a, b) =>
          a.node.getBoundingClientRect().left -
          b.node.getBoundingClientRect().left,
      );
      const over = all.find(({ node }) => {
        const r = node.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right;
      });
      if (!over || over.id === drag.current) return;
      const next = all.map((x) => x.id),
        source = next.indexOf(drag.current),
        dest = next.indexOf(over.id);
      next.splice(source, 1);
      next.splice(dest, 0, drag.current);
      latestOrder.current = next;
      apply();
    };
    const up = (e) => {
      if (!drag.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      drag.current = null;
      if (target.hasPointerCapture(e.pointerId))
        target.releasePointerCapture(e.pointerId);
      onOrderChange(latestOrder.current);
    };
    const click = (e) => {
      if (sorting && items().some(({ node }) => node.contains(e.target))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    target.addEventListener('click', click, true);
    target.addEventListener('pointerdown', down, true);
    target.addEventListener('pointermove', move, true);
    target.addEventListener('pointerup', up, true);
    target.addEventListener('pointercancel', up, true);
    return () => {
      observer.disconnect();
      target.removeEventListener('click', click, true);
      target.removeEventListener('pointerdown', down, true);
      target.removeEventListener('pointermove', move, true);
      target.removeEventListener('pointerup', up, true);
      target.removeEventListener('pointercancel', up, true);
    };
  }, [target, order, sorting, onOrderChange]);
  return (
    <>
      {target &&
        createPortal(
          <>
            <button
              className="ToolIcon ToolIcon_type_button canvas-extra-tool"
              type="button"
              data-local-tool="embed"
              aria-label={__ui('嵌入网页 / 视频')}
              title={__ui('嵌入网页 / 视频')}
              disabled={disabled}
              onClick={openVideo}
            >
              <span className="ToolIcon__icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m10 9 5 3-5 3Z" />
                </svg>
              </span>
            </button>
            <button
              data-local-tool="balloon"
              className="ToolIcon ToolIcon_type_button canvas-extra-tool canvas-number-tool"
              type="button"
              aria-label={__ui('自增球标')}
              aria-pressed={balloon}
              title={__ui('自增球标：点击放置，Esc 退出')}
              disabled={disabled}
              onClick={toggleBalloon}
            >
              <span className="ToolIcon__icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="13" r="8" />
                  <path d="m8 10 2-1v8m-2 0h4M19 2v6m-3-3h6" />
                </svg>
              </span>
            </button>
            <button
              className="ToolIcon ToolIcon_type_button canvas-extra-tool toolbar-sort-toggle"
              type="button"
              style={{
                order: 1000,
              }}
              aria-label={__ui('调整工具栏顺序')}
              aria-pressed={sorting}
              title={__ui('调整工具栏顺序：开启后拖动图标，再次点击完成')}
              onClick={() => setSorting(!sorting)}
            >
              <span className="ToolIcon__icon">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {[8, 16].flatMap((x) =>
                    [6, 12, 18].map((y) => (
                      <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
                    )),
                  )}
                </svg>
              </span>
            </button>
          </>,
          target,
        )}
      {balloon &&
        panel &&
        createPortal(
          <section
            className="balloon-counter-settings"
            aria-label={__ui('球标设置')}
          >
            <label htmlFor="balloon-next-number">{__ui('下一编号')}</label>
            <input
              id="balloon-next-number"
              aria-label={__ui('下一球标编号')}
              type="number"
              min="1"
              max="999999"
              step="1"
              value={nextNumber}
              onChange={(e) => setNextNumber(e.target.value)}
            />
            <small>
              {__ui('点击画布放置 \xB7 Esc 退出 ')}
              <br />
              {__ui('修改编号后从该数字继续 ')}
            </small>
          </section>,
          panel,
        )}
    </>
  );
}
