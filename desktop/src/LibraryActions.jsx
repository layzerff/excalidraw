import { translate as __ui } from './i18n.mjs';
import React, {
  useLayoutEffect,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { onlineLibraryIndex } from './online-library-search.mjs';
import { createPortal } from 'react-dom';
import {
  CaptureUpdateAction,
  restoreElements,
  getCommonBounds,
  exportToSvg,
  serializeLibraryAsJSON,
  MIME_TYPES,
  restoreLibraryItems,
} from '@excalidraw/excalidraw';
import {
  libraryMetadata,
  searchLibrary,
  renameLibraryItem,
} from './library-search.mjs';
function Card({
  item,
  add,
  edit,
  selected,
  toggle,
  context,
  dragItems,
  insert,
}) {
  const [preview, setPreview] = useState('');
  const meta = libraryMetadata(item),
    label = meta.name || meta.internal || __ui('未命名素材');
  useEffect(() => {
    let alive = true;
    exportToSvg({
      elements: item.elements,
      appState: { exportBackground: false },
      files: {},
      exportPadding: 8,
    })
      .then((svg) => {
        if (alive)
          setPreview(
            'data:image/svg+xml;charset=utf-8,' +
              encodeURIComponent(svg.outerHTML),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [item]);
  return (
    <article
      className="library-search-card"
      data-library-id={item.id}
      data-selected={selected || undefined}
      onContextMenu={context}
    >
      <div
        className="library-drag-preview"
        draggable
        aria-label={label}
        title={__ui('拖入画布')}
        onClick={insert}
        onDragStart={(e) => {
          e.dataTransfer.setData(
            MIME_TYPES.excalidrawlib,
            serializeLibraryAsJSON(dragItems || [item]),
          );
          e.dataTransfer.effectAllowed = 'copy';
        }}
      >
        {preview ? (
          <img src={preview} alt={label} draggable={false} />
        ) : (
          <span>▧</span>
        )}
      </div>
      {toggle && (
        <input
          type="checkbox"
          aria-label={__ui('选择素材') + ' ' + label}
          checked={!!selected}
          onChange={toggle}
        />
      )}
      <strong title={label}>{label}</strong>
      {meta.tags.length > 0 && <small>{meta.tags.join(' · ')}</small>}
      <div className="library-card-actions">
        {add && <button onClick={add}>{__ui('保存素材')}</button>}
        {edit && <button onClick={edit}>{__ui('名称与标签')}</button>}
      </div>
    </article>
  );
}
function LibraryChevron({ open }) {
  return (
    <svg
      className="library-chevron"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={open ? 'm6 9 6 6 6-6' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}
function LibraryFolder() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 6h7l2 2h9v12H3Z" />
    </svg>
  );
}
function LibraryGlobe() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18" />
    </svg>
  );
}
function OnlineSearchCard({ reference, index, install }) {
  const [item, setItem] = useState(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    index
      .item(reference)
      .then((raw) => {
        const restored = restoreLibraryItems([raw], 'published')[0];
        if (alive)
          setItem(
            libraryMetadata(restored).name
              ? restored
              : renameLibraryItem(restored, reference.name, ''),
          );
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [reference, index]);
  return item ? (
    <Card item={item} add={() => install(item)} />
  ) : (
    <div className="library-search-card">
      <strong>{reference.name}</strong>
      <small>{failed ? __ui('素材加载失败') : __ui('正在加载…')}</small>
    </div>
  );
}
export function LibraryActions({
  stage,
  browse,
  load,
  api,
  bridge,
  items = [],
  documentId,
  onError,
}) {
  const [target, setTarget] = useState(null),
    [body, setBody] = useState(null),
    [query, setQuery] = useState(''),
    [manage, setManage] = useState(false),
    [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null),
    [picked, setPicked] = useState([]),
    [removeIds, setRemoveIds] = useState(null);
  const lastPicked = useRef(null);
  const [layout, setLayout] = useState({ width: 360, scale: 80 }),
    [panel, setPanel] = useState(null),
    [panelWidth, setPanelWidth] = useState(360);
  const layoutRef = useRef(layout),
    resize = useRef(null);
  layoutRef.current = layout;
  useEffect(() => {
    let alive = true;
    bridge
      .invoke('getSetting', 'libraryLayout')
      .then((raw) => {
        if (alive && raw) {
          try {
            const value = JSON.parse(raw);
            setLayout({
              width: Math.max(260, Math.min(1000, Number(value.width) || 360)),
              scale: Math.max(12, Math.min(180, Number(value.scale) || 80)),
            });
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bridge]);
  const saveLayout = (next) => {
    setLayout(next);
    layoutRef.current = next;
    bridge
      .invoke('setSetting', 'libraryLayout', JSON.stringify(next))
      .catch((e) => setMessage(e.message));
  };

  useEffect(() => {
    const win = stage.current?.ownerDocument.defaultView;
    if (!win) return;
    const move = (event) => {
      if (!resize.current) return;
      const max = Math.max(
        260,
        Math.min(1000, stage.current.getBoundingClientRect().width - 180),
      );
      const next = {
        ...layoutRef.current,
        width: Math.max(
          260,
          Math.min(
            max,
            resize.current.width + resize.current.x - event.clientX,
          ),
        ),
      };
      layoutRef.current = next;
      setLayout(next);
    };
    const end = () => {
      if (!resize.current) return;
      resize.current = null;
      saveLayout(layoutRef.current);
    };
    win.addEventListener('pointermove', move, true);
    win.addEventListener('pointerup', end, true);
    win.addEventListener('pointercancel', end, true);
    return () => {
      win.removeEventListener('pointermove', move, true);
      win.removeEventListener('pointerup', end, true);
      win.removeEventListener('pointercancel', end, true);
    };
  }, [stage]);
  const onlineIndex = useMemo(() => onlineLibraryIndex(bridge), [bridge]);
  const [onlineSearch, setOnlineSearch] = useState({
    results: [],
    working: false,
    done: 0,
    total: 0,
    failed: 0,
  });
  const [searchLimit, setSearchLimit] = useState(40),
    [searchRetry, setSearchRetry] = useState(0),
    [closedResults, setClosedResults] = useState({});
  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    setSearchRootOpen(true);
    setSearchLimit(40);
    setClosedResults({});
    if (!q) {
      setOnlineSearch({
        results: [],
        working: false,
        done: 0,
        total: 0,
        failed: 0,
      });
      return;
    }
    setOnlineSearch({
      results: [],
      working: true,
      done: 0,
      total: 0,
      failed: 0,
    });
    const win = stage.current.ownerDocument.defaultView;
    const timer = win.setTimeout(
      () =>
        onlineIndex
          .search(q, setOnlineSearch, () => cancelled)
          .catch((e) => {
            if (!cancelled)
              setOnlineSearch({
                results: [],
                working: false,
                done: 0,
                total: 0,
                failed: 1,
                error: e.message,
              });
          }),
      400,
    );
    return () => {
      cancelled = true;
      win.clearTimeout(timer);
    };
  }, [query, onlineIndex, stage, searchRetry]);
  const [header, setHeader] = useState(null);
  const [visibleItems, setVisibleItems] = useState(100);
  const [packageLimits, setPackageLimits] = useState({});
  const [searchRootOpen, setSearchRootOpen] = useState(true);
  const [catalog, setCatalog] = useState(null),
    [catalogOpen, setCatalogOpen] = useState(false),
    [expanded, setExpanded] = useState({}),
    [pending, setPending] = useState(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    setQuery('');
    setManage(false);
    setEditing(null);
    setPicked([]);
    setMenu(null);
  }, [documentId]);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const find = () => {
      setPanel(node.querySelector('.default-sidebar'));
      setHeader(node.querySelector('.default-sidebar .sidebar__header'));
      setTarget(node.querySelector('.library-menu-items-container'));
      setBody(node.querySelector('.library-menu-items-container__items'));
    };
    find();
    const o = new node.ownerDocument.defaultView.MutationObserver(find);
    o.observe(node, { childList: true, subtree: true });
    return () => o.disconnect();
  }, [stage]);
  useLayoutEffect(() => {
    const node = stage.current,
      side = target?.closest('.sidebar');
    if (!node || !side) return;
    node.classList.add('native-library-open');
    const adjust = () => {
      const max = Math.max(
        260,
        Math.min(1000, node.getBoundingClientRect().width - 180),
      );
      const width = Math.min(layout.width, max);
      node.style.setProperty('--library-panel-width', `${width}px`);
      setPanelWidth(width);
      const logo = node.ownerDocument.querySelector('.logo, .brand img');
      const minimum = Math.max(
        48,
        Math.min(80, logo?.getBoundingClientRect().width || 48),
      );
      const tile = Math.max(
        minimum,
        Math.min(180, (layout.scale * width) / 360),
      );
      node.style.setProperty('--library-tile-size', `${tile}px`);
      const count = Math.max(1, Math.floor((width - 78) / (tile + 10)));
      node.style.setProperty('--library-columns', String(count));
      node.style.setProperty(
        '--library-toolbar-max',
        `${Math.max(180, node.getBoundingClientRect().width - width - 48)}px`,
      );
    };
    adjust();
    const observer = new node.ownerDocument.defaultView.ResizeObserver(adjust);
    observer.observe(node);
    observer.observe(side);
    return () => {
      observer.disconnect();
      node.classList.remove('native-library-open');
    };
  }, [stage, target, layout]);
  useLayoutEffect(() => {
    target?.classList.toggle('local-library-filtering', true);
    return () => target?.classList.remove('local-library-filtering');
  }, [target, query, manage]);
  const [localOpen, setLocalOpen] = useState(true),
    [closedFolders, setClosedFolders] = useState({});
  const [organization, setOrganization] = useState({
      folders: [],
      assignments: {},
    }),
    [folderEdit, setFolderEdit] = useState(null);
  const [storage, setStorage] = useState(null),
    [moveTarget, setMoveTarget] = useState('');
  useEffect(() => {
    let alive = true;
    bridge
      .invoke('libraryRead', documentId)
      .then((v) => {
        if (alive)
          setOrganization({
            folders: v.folders,
            assignments: v.assignments || {},
          });
      })
      .catch((e) => setMessage(e.message));
    return () => {
      alive = false;
    };
  }, [bridge, documentId]);
  const organize = async (folders, assignments) => {
    const value = await bridge.invoke('libraryOrganize', folders, assignments);
    setOrganization({ folders: value.folders, assignments: value.assignments });
  };
  const folderMenu = (event, folder = null) => {
    event.preventDefault();
    event.stopPropagation();
    const win = stage.current.ownerDocument.defaultView;
    setMenu({
      kind: 'folder',
      folder,
      ids: [],
      x: Math.max(8, Math.min(event.clientX, win.innerWidth - 248)),
      y: Math.max(8, Math.min(event.clientY, win.innerHeight - 270)),
    });
  };
  const insertItem = (item) => {
    const editor = api.current;
    if (!editor || editor.getAppState().viewModeEnabled) return;
    const state = editor.getAppState(),
      win = stage.current.ownerDocument.defaultView;
    const ids = new Map(
      [
        ...new Set(item.elements.flatMap((e) => [e.id, ...(e.groupIds || [])])),
      ].map((id) => [id, win.crypto.randomUUID()]),
    );
    const binding = (b) =>
      b && ids.has(b.elementId)
        ? { ...b, elementId: ids.get(b.elementId) }
        : null;
    const raw = item.elements.map((e) => ({
      ...e,
      id: ids.get(e.id),
      index: null,
      groupIds: (e.groupIds || []).map((id) => ids.get(id)),
      containerId: ids.get(e.containerId) || null,
      frameId: ids.get(e.frameId) || null,
      boundElements:
        e.boundElements
          ?.filter((b) => ids.has(b.id))
          .map((b) => ({ ...b, id: ids.get(b.id) })) || null,
      ...(e.startBinding !== undefined
        ? {
            startBinding: binding(e.startBinding),
            endBinding: binding(e.endBinding),
          }
        : {}),
    }));
    const [minX, minY, maxX, maxY] = getCommonBounds(raw);
    const visibleWidth = Math.max(100, state.width - panelWidth);
    const x =
        visibleWidth / 2 / state.zoom.value - state.scrollX - (maxX - minX) / 2,
      y =
        state.height / 2 / state.zoom.value - state.scrollY - (maxY - minY) / 2;
    const elements = restoreElements(
      raw.map((e) => ({ ...e, x: e.x - minX + x, y: e.y - minY + y })),
      null,
    );
    editor.updateScene({
      elements: [...editor.getSceneElementsIncludingDeleted(), ...elements],
      appState: {
        selectedElementIds: Object.fromEntries(
          elements.map((e) => [e.id, true]),
        ),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };
  const renderCards = (list) => (
    <div className="library-search-grid">
      {list.slice(0, visibleItems).map((item) => (
        <Card
          key={item.id}
          item={item}
          selected={picked.includes(item.id)}
          toggle={(event) => {
            const id = item.id;
            if (event.nativeEvent.shiftKey && lastPicked.current) {
              const a = matches.findIndex((i) => i.id === lastPicked.current),
                b = matches.findIndex((i) => i.id === id);
              setPicked([
                ...new Set([
                  ...picked,
                  ...matches
                    .slice(Math.min(a, b), Math.max(a, b) + 1)
                    .map((i) => i.id),
                ]),
              ]);
            } else
              setPicked(
                picked.includes(id)
                  ? picked.filter((i) => i !== id)
                  : [...picked, id],
              );
            lastPicked.current = id;
          }}
          context={(event) =>
            atPointer(event, picked.includes(item.id) ? picked : [item.id])
          }
          dragItems={
            picked.includes(item.id)
              ? items.filter((i) => picked.includes(i.id))
              : undefined
          }
          insert={() => insertItem(item)}
          edit={manage ? () => editItem(item) : undefined}
        />
      ))}
    </div>
  );
  const renderFolders = (parent) =>
    organization.folders
      .filter((f) => (f.parent || null) === parent)
      .map((f) => {
        const open = !closedFolders[f.id],
          list = matches.filter((i) => organization.assignments[i.id] === f.id);
        return (
          <section className="local-library-folder" key={f.id}>
            <button
              className="online-library-package-heading"
              aria-expanded={open}
              onContextMenu={(e) => folderMenu(e, f)}
              onClick={() => setClosedFolders((v) => ({ ...v, [f.id]: open }))}
            >
              <LibraryChevron open={open} />
              <LibraryFolder />
              <span>{f.name}</span>
              <small>{list.length}</small>
            </button>
            {open && (
              <div className="library-folder-content">
                {renderCards(list)}
                {renderFolders(f.id)}
              </div>
            )}
          </section>
        );
      });
  const atPointer = (event, ids) => {
    event.preventDefault();
    event.stopPropagation();
    const win = stage.current.ownerDocument.defaultView;
    setMenu({
      ids,
      x: Math.min(event.clientX, win.innerWidth - 228),
      y: Math.min(event.clientY, win.innerHeight - 230),
    });
  };
  useEffect(() => {
    if (!target) return;
    const context = (event) => {
      const unit = event.target.closest('.library-unit[data-library-id]');
      if (!unit) return;
      const chosen = [
        ...target.querySelectorAll('.library-unit--selected[data-library-id]'),
      ].map((n) => n.dataset.libraryId);
      atPointer(
        event,
        chosen.includes(unit.dataset.libraryId)
          ? chosen
          : [unit.dataset.libraryId],
      );
    };
    target.addEventListener('contextmenu', context);
    return () => target.removeEventListener('contextmenu', context);
  }, [target]);
  useEffect(() => {
    if (!panel) return;
    const wheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const next = {
        ...layoutRef.current,
        scale: Math.max(
          12,
          Math.min(
            180,
            (layoutRef.current.scale || 80) *
              Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * 0.002),
          ),
        ),
      };
      saveLayout(next);
    };
    panel.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => panel.removeEventListener('wheel', wheel, true);
  }, [panel]);
  useEffect(() => {
    if (!menu) return;
    const doc = stage.current.ownerDocument;
    const close = (event) => {
      if (!event.target.closest('.library-context-menu')) setMenu(null);
    };
    const key = (event) => {
      if (event.key === 'Escape') setMenu(null);
    };
    doc.addEventListener('pointerdown', close);
    doc.addEventListener('keydown', key);
    return () => {
      doc.removeEventListener('pointerdown', close);
      doc.removeEventListener('keydown', key);
    };
  }, [menu, stage]);
  const editItem = (item) => {
    const m = libraryMetadata(item);
    setEditing({ id: item.id, name: m.name, tags: m.tags.join(', ') });
    setMenu(null);
  };
  const exportItems = (ids) => {
    const doc = stage.current.ownerDocument,
      win = doc.defaultView;
    const url = win.URL.createObjectURL(
      new Blob(
        [serializeLibraryAsJSON(items.filter((i) => ids.includes(i.id)))],
        { type: MIME_TYPES.excalidrawlib },
      ),
    );
    const link = doc.createElement('a');
    link.href = url;
    link.download = 'Local-Canvas-assets.excalidrawlib';
    doc.body.append(link);
    link.click();
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
    setMenu(null);
  };
  const perform = async (key, fn) => {
    setPending(key);
    setMessage('');
    try {
      return await fn();
    } catch (e) {
      setMessage(e.message);
      onError?.(e.message);
    } finally {
      setPending(null);
    }
  };
  const install = async (lib) => {
    const editor = api.current;
    if (!editor) return;
    await editor.updateLibrary({
      libraryItems: lib,
      merge: true,
      openLibraryMenu: true,
    });
    if (api.current === editor)
      editor.updateScene({
        appState: { openSidebar: { name: 'default', tab: 'library' } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
  };
  const matches = useMemo(() => searchLibrary(items, query), [items, query]);
  const openCatalog = async () => {
    const open = !catalogOpen;
    setCatalogOpen(open);
    if (open && !catalog)
      await perform('catalog', async () =>
        setCatalog(await onlineIndex.catalog()),
      );
  };
  const expand = async (entry) => {
    if (expanded[entry.source]) {
      setExpanded((p) => ({ ...p, [entry.source]: null }));
      return;
    }
    await perform(entry.source, async () => {
      const raw = await onlineIndex.packageItems(entry.source);
      setExpanded((p) => ({
        ...p,
        [entry.source]: restoreLibraryItems(raw, 'published').map((item, i) =>
          libraryMetadata(item).name || libraryMetadata(item).internal
            ? item
            : renameLibraryItem(item, `${entry.name} ${i + 1}`, ''),
        ),
      }));
    });
  };
  if (!target) return null;
  return (
    <>
      {panel &&
        createPortal(
          <div
            className="library-width-resizer"
            role="separator"
            aria-label={__ui('素材栏宽度')}
            aria-orientation="vertical"
            aria-valuenow={Math.round(panelWidth)}
            tabIndex={0}
            onPointerDown={(event) => {
              resize.current = { x: event.clientX, width: panelWidth };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                const max = Math.max(
                  260,
                  Math.min(
                    1000,
                    stage.current.getBoundingClientRect().width - 180,
                  ),
                );
                saveLayout({
                  ...layoutRef.current,
                  width: Math.max(
                    260,
                    Math.min(
                      max,
                      panelWidth + (event.key === 'ArrowLeft' ? 20 : -20),
                    ),
                  ),
                });
              }
            }}
          />,
          panel,
        )}
      {header &&
        createPortal(
          <button
            className="library-close-toggle"
            aria-label={__ui('关闭素材库')}
            title={__ui('关闭素材库')}
            onClick={() =>
              api.current?.toggleSidebar({
                name: 'default',
                tab: 'library',
                force: false,
              })
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M3 5h7l2 2 2-2h7v15h-7l-2 2-2-2H3Z M12 7v15" />
            </svg>
            <span>{__ui('素材库')}</span>
          </button>,
          header,
        )}
      {menu &&
        createPortal(
          <div
            role="menu"
            aria-label={__ui('素材操作')}
            className="library-context-menu"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.kind === 'folder' ? (
              <>
                <small>{menu.folder?.name || __ui('本地素材库')}</small>
                <button
                  role="menuitem"
                  onClick={() => {
                    setFolderEdit({
                      name: '',
                      parent: menu.folder?.id || null,
                    });
                    setMenu(null);
                  }}
                >
                  {__ui('新建素材文件夹')}
                </button>
                {menu.folder && (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setFolderEdit({ ...menu.folder });
                        setMenu(null);
                      }}
                    >
                      {__ui('重命名文件夹')}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() =>
                        perform('folder', async () => {
                          const f = menu.folder;
                          await organize(
                            organization.folders
                              .filter((x) => x.id !== f.id)
                              .map((x) =>
                                x.parent === f.id
                                  ? { ...x, parent: f.parent || null }
                                  : x,
                              ),
                            Object.fromEntries(
                              Object.entries(organization.assignments).map(
                                ([id, parent]) => [
                                  id,
                                  parent === f.id ? f.parent || null : parent,
                                ],
                              ),
                            ),
                          );
                          setMenu(null);
                        })
                      }
                    >
                      {__ui('删除文件夹（保留素材）')}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <small>
                  {menu.ids.length} {__ui('项已选')}
                </small>
                <button role="menuitem" onClick={() => exportItems(menu.ids)}>
                  {__ui('导出所选素材')}
                </button>
                {menu.ids.length === 1 && (
                  <button
                    role="menuitem"
                    onClick={() =>
                      editItem(items.find((i) => i.id === menu.ids[0]))
                    }
                  >
                    {__ui('名称与标签')}
                  </button>
                )}
                <label className="library-move-label">
                  {__ui('移动到文件夹')}
                  <select
                    aria-label={__ui('素材目标文件夹')}
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                  >
                    <option value="">{__ui('本地素材库')}</option>
                    {organization.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  role="menuitem"
                  onClick={() =>
                    perform('folder', async () => {
                      await organize(organization.folders, {
                        ...organization.assignments,
                        ...Object.fromEntries(
                          menu.ids.map((id) => [id, moveTarget || null]),
                        ),
                      });
                      setMenu(null);
                    })
                  }
                >
                  {__ui('确认移动')}
                </button>
                <button
                  role="menuitem"
                  className="danger-action"
                  onClick={() => {
                    setRemoveIds(menu.ids);
                    setMenu(null);
                  }}
                >
                  {__ui('删除所选素材')}
                </button>
              </>
            )}
            <button role="menuitem" onClick={() => setMenu(null)}>
              {__ui('取消')}
            </button>
          </div>,
          stage.current,
        )}
      {folderEdit &&
        createPortal(
          <div className="modal-backdrop">
            <form
              className="dialog library-dialog"
              onSubmit={(event) => {
                event.preventDefault();
                perform('folder', async () => {
                  const value = {
                    ...folderEdit,
                    id:
                      folderEdit.id ||
                      stage.current.ownerDocument.defaultView.crypto.randomUUID(),
                    name: folderEdit.name.trim(),
                  };
                  await organize(
                    folderEdit.id
                      ? organization.folders.map((f) =>
                          f.id === value.id ? value : f,
                        )
                      : [...organization.folders, value],
                    organization.assignments,
                  );
                  setFolderEdit(null);
                });
              }}
            >
              <h3>{__ui(folderEdit.id ? '重命名文件夹' : '新建素材文件夹')}</h3>
              <label>
                {__ui('名称')}
                <input
                  autoFocus
                  required
                  maxLength={200}
                  aria-label={__ui('素材文件夹名称')}
                  value={folderEdit.name}
                  onChange={(e) =>
                    setFolderEdit({ ...folderEdit, name: e.target.value })
                  }
                />
              </label>
              <div className="dialog-actions">
                <button type="submit">{__ui('保存')}</button>
                <button type="button" onClick={() => setFolderEdit(null)}>
                  {__ui('取消')}
                </button>
              </div>
            </form>
          </div>,
          stage.current,
        )}
      {storage &&
        createPortal(
          <div className="modal-backdrop">
            <section
              className="dialog library-dialog"
              role="dialog"
              aria-label={__ui('素材保存位置')}
            >
              <h3>{__ui('素材保存位置')}</h3>
              <p>{__ui('当前素材库文件')}</p>
              <code>{storage.file}</code>
              {storage.defaultFolder !== storage.folder && (
                <>
                  <p>{__ui('默认素材位置')}</p>
                  <code>{storage.defaultFolder}</code>
                </>
              )}
              <p>
                {__ui(
                  '默认位于工作区的 materials 文件夹。更改位置会复制素材与文件夹结构，并保留原文件。',
                )}
              </p>
              {storage.managed ? (
                <p>{__ui('NAS 版请在容器配置中修改 /data 映射目录。')}</p>
              ) : (
                <button
                  onClick={() =>
                    perform('storage', async () => {
                      const result = await bridge.invoke(
                        'changeLibraryStorage',
                      );
                      if (result) setStorage(result);
                    })
                  }
                >
                  {__ui('更改素材保存位置')}
                </button>
              )}
              <div className="dialog-actions">
                <button onClick={() => setStorage(null)}>{__ui('关闭')}</button>
              </div>
            </section>
          </div>,
          stage.current,
        )}
      {removeIds &&
        createPortal(
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-label={__ui('删除素材')}
              aria-modal="true"
            >
              <h3>
                {__ui('删除所选素材')} · {removeIds.length}
              </h3>
              <p>{__ui('仅从素材库移除，不影响画布上已插入的图形。')}</p>
              <div className="dialog-actions">
                <button
                  onClick={() =>
                    perform('delete', async () => {
                      await api.current.updateLibrary({
                        libraryItems: items.filter(
                          (i) => !removeIds.includes(i.id),
                        ),
                        merge: false,
                        openLibraryMenu: true,
                      });
                      setRemoveIds(null);
                      setPicked([]);
                    })
                  }
                >
                  {__ui('确定删除')}
                </button>
                <button onClick={() => setRemoveIds(null)}>
                  {__ui('取消')}
                </button>
              </div>
            </section>
          </div>,
          stage.current,
        )}
      {createPortal(
        <section className="local-library-manager">
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
              type="search"
              aria-label={__ui('搜索本地和在线素材')}
              placeholder={__ui('搜索本地和在线素材')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="local-library-actions">
            <button onClick={load}>{__ui('导入素材库文件')}</button>
            <button aria-pressed={manage} onClick={() => setManage(!manage)}>
              {__ui('名称与标签')}
            </button>
          </div>
          <div className="library-layout-controls">
            <small>{__ui('Ctrl + 滚轮调整素材大小')}</small>
            <button
              onClick={() =>
                perform('storage', async () =>
                  setStorage(await bridge.invoke('libraryStorageInfo')),
                )
              }
            >
              {__ui('素材保存位置')}
            </button>
          </div>
          {editing && (
            <form
              className="library-meta-editor"
              onSubmit={(e) => {
                e.preventDefault();
                perform('rename', async () => {
                  await api.current.updateLibrary({
                    libraryItems: items.map((i) =>
                      i.id === editing.id
                        ? renameLibraryItem(i, editing.name, editing.tags)
                        : i,
                    ),
                    merge: false,
                    openLibraryMenu: true,
                  });
                  setEditing(null);
                });
              }}
            >
              <label>
                {__ui('素材名称')}
                <input
                  aria-label={__ui('素材名称')}
                  maxLength={200}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label>
                {__ui('标签（逗号分隔）')}
                <input
                  aria-label={__ui('素材标签')}
                  value={editing.tags}
                  onChange={(e) =>
                    setEditing({ ...editing, tags: e.target.value })
                  }
                />
              </label>
              <div className="dialog-actions">
                <button type="submit" disabled={!!pending}>
                  {__ui('保存')}
                </button>
                <button type="button" onClick={() => setEditing(null)}>
                  {__ui('取消')}
                </button>
              </div>
            </form>
          )}
          {message && <p role="alert">{message}</p>}
        </section>,
        target,
      )}
      {body &&
        createPortal(
          <section
            className="local-library-results"
            onContextMenu={(e) => folderMenu(e)}
          >
            <button
              className="library-root-heading"
              aria-expanded={localOpen}
              onClick={() => setLocalOpen((v) => !v)}
            >
              <LibraryChevron open={localOpen} />
              <LibraryFolder />
              {__ui('本地素材库')}
              <small>{query.trim() ? matches.length : items.length}</small>
            </button>
            {localOpen && (
              <div className="local-library-content">
                {renderCards(
                  matches.filter(
                    (i) =>
                      !organization.folders.some(
                        (f) => f.id === organization.assignments[i.id],
                      ),
                  ),
                )}
                {renderFolders(null)}
                {matches.length > visibleItems && (
                  <button onClick={() => setVisibleItems((v) => v + 100)}>
                    {__ui('显示更多素材')}
                  </button>
                )}
                {!items.length && (
                  <p className="library-empty">{__ui('本地素材库为空')}</p>
                )}
                {query.trim() && !matches.length && (
                  <p className="library-empty">{__ui('没有匹配的本地素材')}</p>
                )}
              </div>
            )}
          </section>,
          body,
        )}
      {body &&
        createPortal(
          <>
            <section className="online-library-catalog">
              <button
                className="online-catalog-toggle library-root-heading"
                aria-expanded={query.trim() ? searchRootOpen : catalogOpen}
                onClick={() =>
                  query.trim() ? setSearchRootOpen((v) => !v) : openCatalog()
                }
              >
                <LibraryChevron
                  open={query.trim() ? searchRootOpen : catalogOpen}
                />
                <LibraryGlobe />
                {__ui('Excalidraw 在线素材库')}
                {query.trim() && <small>{onlineSearch.results.length}</small>}
              </button>
              {query.trim() ? (
                <div className="online-search-results" hidden={!searchRootOpen}>
                  {onlineSearch.working && (
                    <p role="status">
                      {__ui('正在搜索在线素材')} · {onlineSearch.done}/
                      {onlineSearch.total || '…'}
                    </p>
                  )}
                  {onlineSearch.failed > 0 && (
                    <p role="alert">
                      {__ui('部分素材包加载失败，在线结果不完整')}{' '}
                      <button onClick={() => setSearchRetry((v) => v + 1)}>
                        {__ui('重试')}
                      </button>
                    </p>
                  )}
                  {!onlineSearch.working && !onlineSearch.results.length && (
                    <p>{__ui('没有匹配的在线素材')}</p>
                  )}
                  {[
                    ...new Set(
                      onlineSearch.results
                        .slice(0, searchLimit)
                        .map((r) => r.source),
                    ),
                  ].map((source) => {
                    const refs = onlineSearch.results.filter(
                        (r) => r.source === source,
                      ),
                      visible = onlineSearch.results
                        .slice(0, searchLimit)
                        .filter((r) => r.source === source),
                      open = !closedResults[source];
                    return (
                      <div className="online-library-package" key={source}>
                        <button
                          className="online-library-package-heading"
                          aria-expanded={open}
                          onClick={() =>
                            setClosedResults((v) => ({ ...v, [source]: open }))
                          }
                        >
                          <LibraryChevron open={open} />
                          <LibraryFolder />
                          <span>{refs[0].packageName}</span>
                          <small>{refs.length}</small>
                        </button>
                        {open && (
                          <div className="library-search-grid">
                            {visible.map((reference) => (
                              <OnlineSearchCard
                                key={reference.source + '#' + reference.index}
                                reference={reference}
                                index={onlineIndex}
                                install={(item) =>
                                  perform('install', () => install([item]))
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {onlineSearch.results.length > searchLimit && (
                    <button onClick={() => setSearchLimit((v) => v + 40)}>
                      {__ui('显示更多素材')}
                    </button>
                  )}
                </div>
              ) : (
                catalogOpen && (
                  <>
                    <p>
                      {__ui(
                        '展开素材包后，可将缩略图拖入画布。保存素材后可离线使用。',
                      )}
                    </p>
                    {pending === 'catalog' && <p>{__ui('正在加载…')}</p>}
                    {!catalog && pending !== 'catalog' && (
                      <button
                        onClick={() =>
                          perform('catalog', async () =>
                            setCatalog(await onlineIndex.catalog()),
                          )
                        }
                      >
                        {__ui('重试')}
                      </button>
                    )}
                    {catalog?.map((entry) => (
                      <div
                        className="online-library-package"
                        key={entry.source}
                      >
                        <button
                          className="online-library-package-heading"
                          aria-expanded={!!expanded[entry.source]}
                          title={entry.description}
                          onClick={() => expand(entry)}
                          disabled={pending === entry.source}
                        >
                          <LibraryChevron open={!!expanded[entry.source]} />
                          <LibraryFolder />
                          <span>{entry.name}</span>
                        </button>
                        {expanded[entry.source] && (
                          <div className="library-search-grid">
                            {expanded[entry.source]
                              .slice(0, packageLimits[entry.source] || 100)
                              .map((item, i) => (
                                <Card
                                  key={item.id || i}
                                  item={item}
                                  add={() =>
                                    perform('install', () => install([item]))
                                  }
                                />
                              ))}
                          </div>
                        )}
                        {expanded[entry.source]?.length >
                          (packageLimits[entry.source] || 100) && (
                          <button
                            onClick={() =>
                              setPackageLimits((p) => ({
                                ...p,
                                [entry.source]: (p[entry.source] || 100) + 100,
                              }))
                            }
                          >
                            {__ui('显示更多素材')}
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )
              )}
            </section>
            <button
              className="open-web-library library-root-heading"
              onClick={browse}
            >
              <span className="library-chevron-spacer" />
              <LibraryGlobe />
              {__ui('打开网页素材库')} ↗
            </button>
          </>,
          body,
        )}
    </>
  );
}
