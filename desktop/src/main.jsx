import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  CaptureUpdateAction,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import {
  viewRect,
  targetView,
  interpolate,
  normalizeRect,
} from './navigation.mjs';

const root = document.getElementById('root');
const ownerWindow = root.ownerDocument.defaultView;
const bridge = ownerWindow.workspace;
function exportOptions(data, rect) {
  const frame = rect
    ? {
        id: '__export_region__',
        type: 'frame',
        ...rect,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: null,
        roundness: null,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        name: null,
      }
    : null;
  return {
    elements: frame ? [...data.elements, frame] : data.elements,
    appState: {
      ...data.appState,
      exportBackground: true,
      exportWithDarkMode: false,
    },
    files: data.files,
    exportPadding: rect ? 0 : 20,
    exportingFrame: frame,
    getDimensions: (width, height) => {
      const scale = Math.min(2, 8192 / Math.max(width, height));
      return {
        width: Math.ceil(width * scale),
        height: Math.ceil(height * scale),
        scale,
      };
    },
  };
}
function PanelIcon() {
  return (
    <svg
      width="22"
      height="18"
      viewBox="0 0 24 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M17 1v16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function App() {
  const [nodes, setNodes] = useState([]),
    [doc, setDoc] = useState(null),
    [folder, setFolder] = useState(null);
  const [status, setStatus] = useState('正在打开…'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState([]),
    [selecting, setSelecting] = useState(null),
    [selection, setSelection] = useState(null);
  const [duration, setDuration] = useState(2200),
    [trash, setTrash] = useState(false),
    [form, setForm] = useState(null);
  const [sidebar, setSidebar] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);
  const [currentScene, setCurrentScene] = useState(null);
  const [pen, setPen] = useState(false);
  const [inkCount, setInkCount] = useState(0);
  const [editingScene, setEditingScene] = useState(null);
  const [sceneMenu, setSceneMenu] = useState(null);
  const [exportMenu, setExportMenu] = useState(false);
  const [exportRegion, setExportRegion] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const dropPosition = useRef(null);
  const markDrop = (index) => {
    dropPosition.current = index;
    setDropAt(index);
  };
  const presentation = useRef(false),
    savedView = useRef(null),
    inkApi = useRef(null);
  const presentationTimer = useRef(null);
  const latest = useRef({});
  const clearInk = () => {
    inkApi.current?.updateScene({
      elements: [],
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    inkApi.current?.history.clear();
    setInkCount(0);
  };
  const renameScene = (id, value) => {
    const title = value.trim();
    if (title)
      updateScenes(scenes.map((s) => (s.id === id ? { ...s, title } : s)));
    setEditingScene(null);
  };
  const api = useRef(null),
    active = useRef(null),
    dirty = useRef(false),
    timer = useRef(null),
    frame = useRef(null),
    stage = useRef(null),
    drag = useRef(null),
    start = useRef(null);
  const run = async (fn) => {
    try {
      setError('');
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    }
  };
  const refresh = async () => {
    const list = await bridge.invoke('list');
    setNodes(list);
    return list;
  };
  const stop = () => {
    if (frame.current !== null) ownerWindow.cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  const flush = () => {
    ownerWindow.clearTimeout(timer.current);
    if (!dirty.current || !active.current) return;
    try {
      active.current.revision = bridge.save(
        active.current.id,
        active.current.data,
        active.current.revision,
      );
      dirty.current = false;
      setStatus('已保存到本机');
    } catch (e) {
      setStatus('保存失败');
      setError(e.message);
      throw e;
    }
  };
  const changed = (data) => {
    if (!active.current) return;
    active.current.data = data;
    dirty.current = true;
    setStatus('正在保存…');
    ownerWindow.clearTimeout(timer.current);
    timer.current = ownerWindow.setTimeout(() => {
      try {
        flush();
      } catch {}
    }, 500);
  };
  const manualSave = () => {
    if (!api.current || !active.current || presentation.current) return;
    stop();
    const focused = root.ownerDocument.activeElement;
    if (root.contains(focused)) focused.blur();
    const state = api.current.getAppState();
    const data = JSON.parse(
      serializeAsJSON(
        api.current.getSceneElements(),
        state,
        api.current.getFiles(),
        'local',
      ),
    );
    changed({
      ...active.current.data,
      elements: data.elements,
      files: data.files || {},
      appState: {
        ...data.appState,
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom,
      },
    });
    flush();
  };
  const switchDoc = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      flush();
      stop();
      setSelecting(null);
      setSelection(null);
      setExportMenu(false);
      setExportRegion(null);
      const next = await bridge.invoke('read', id);
      api.current = null;
      active.current = next;
      dirty.current = false;
      setScenes(next.data.scenes);
      setDoc(next);
      setStatus('已保存到本机');
      await bridge.invoke('setSetting', 'activeDocument', id);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!bridge) {
      setError(
        '请运行桌面应用：先 npm run build，再 npm start。浏览器预览不具备本地存储接口。',
      );
      return;
    }
    run(async () => {
      const list = await refresh();
      const saved = await bridge.invoke('getSetting', 'activeDocument');
      setSidebar((await bridge.invoke('getSetting', 'sceneSidebar')) !== false);
      const id =
        list.find((n) => n.id === saved && !n.deleted)?.id ||
        list.find((n) => n.kind === 'document' && !n.deleted)?.id;
      if (id) await switchDoc(id);
      else setStatus('请创建白板');
    });
    const close = (e) => {
      try {
        flush();
      } catch {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const key = (e) => {
      if (presentation.current) {
        if (e.key === 'Escape') latest.current.exitPresentation();
        if (e.key === 'ArrowRight') latest.current.step(1);
        if (e.key === 'ArrowLeft') latest.current.step(-1);
        if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(e.key))
          e.preventDefault();
      }
      if (e.key === 'Escape') {
        setExportMenu(false);
        setSceneMenu(null);
        stop();
        setSelecting(null);
        setSelection(null);
      }
    };
    const saveKey = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 's' &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        run(() => latest.current.manualSave());
      }
    };
    const periodic = ownerWindow.setInterval(() => {
      try {
        flush();
      } catch {}
    }, 2000);
    ownerWindow.addEventListener('beforeunload', close);
    ownerWindow.addEventListener('keydown', key);
    ownerWindow.addEventListener('keydown', saveKey, true);
    return () => {
      ownerWindow.clearInterval(periodic);
      ownerWindow.removeEventListener('beforeunload', close);
      ownerWindow.removeEventListener('keydown', key);
      ownerWindow.removeEventListener('keydown', saveKey, true);
      stop();
    };
  }, []);
  const updateScenes = (next) => {
    setScenes(next);
    changed({ ...active.current.data, scenes: next });
  };
  const addScene = (rect) => {
    if (selecting && selecting !== 'new')
      updateScenes(
        scenes.map((s) => (s.id === selecting ? { ...s, rect } : s)),
      );
    else
      updateScenes([
        ...scenes,
        {
          id: ownerWindow.crypto.randomUUID(),
          title: `场景 ${scenes.length + 1}`,
          rect,
        },
      ]);
    setSelecting(null);
    setSelection(null);
  };
  const navigate = (scene) => {
    if (!api.current) return;
    stop();
    setCurrentScene(scene.id);
    clearInk();
    const state = api.current.getAppState();
    const from = {
        zoom: state.zoom.value,
        scrollX: state.scrollX,
        scrollY: state.scrollY,
      },
      to = targetView(scene.rect, state.width, state.height);
    const began = ownerWindow.performance.now();
    const animate = (now) => {
      const t = Math.min(1, (now - began) / duration),
        v = interpolate(from, to, t);
      api.current?.updateScene({
        appState: {
          scrollX: v.scrollX,
          scrollY: v.scrollY,
          zoom: { value: v.zoom },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      inkApi.current?.updateScene({
        appState: {
          scrollX: v.scrollX,
          scrollY: v.scrollY,
          zoom: { value: v.zoom },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      frame.current = t < 1 ? ownerWindow.requestAnimationFrame(animate) : null;
    };
    frame.current = ownerWindow.requestAnimationFrame(animate);
  };
  const exitPresentation = async () => {
    ownerWindow.clearTimeout(presentationTimer.current);
    stop();
    presentation.current = false;
    setPresenting(false);
    setPresentationReady(false);
    setPen(false);
    clearInk();
    inkApi.current = null;
    if (root.ownerDocument.fullscreenElement)
      await root.ownerDocument.exitFullscreen();
    ownerWindow.requestAnimationFrame(() =>
      ownerWindow.requestAnimationFrame(() => {
        if (savedView.current)
          api.current?.updateScene({
            appState: savedView.current,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
      }),
    );
  };
  const step = (delta) => {
    const index = scenes.findIndex((s) => s.id === currentScene);
    const next = scenes[index + delta];
    if (next) navigate(next);
  };
  latest.current = { exitPresentation, step, manualSave };
  useEffect(() => {
    const changedFullscreen = () => {
      if (!root.ownerDocument.fullscreenElement && presentation.current)
        latest.current.exitPresentation();
    };
    root.ownerDocument.addEventListener('fullscreenchange', changedFullscreen);
    return () =>
      root.ownerDocument.removeEventListener(
        'fullscreenchange',
        changedFullscreen,
      );
  }, []);
  const beginPresentation = async () => {
    flush();
    const state = api.current.getAppState();
    savedView.current = {
      scrollX: state.scrollX,
      scrollY: state.scrollY,
      zoom: state.zoom,
    };
    await root.requestFullscreen();
    presentation.current = true;
    setPresentationReady(false);
    setPresenting(true);
    presentationTimer.current = ownerWindow.setTimeout(() => {
      navigate(scenes.find((s) => s.id === currentScene) || scenes[0]);
      setPresentationReady(true);
    }, 150);
  };
  useEffect(() => {
    if (presenting && pen)
      inkApi.current?.setActiveTool({ type: 'freedraw', locked: true });
  }, [presenting, pen]);
  const toggleSidebar = () => {
    setSidebar(!sidebar);
    run(() => bridge.invoke('setSetting', 'sceneSidebar', !sidebar));
  };
  const exportPDF = async (byScenes) => {
    flush();
    stop();
    setBusy(true);
    try {
      const data = active.current.data;
      const regions = byScenes ? scenes.map((s) => s.rect) : [exportRegion];
      const pages = [];
      for (const rect of regions) {
        const elements = [...data.elements];
        if (rect)
          elements.push({
            id: '__pdf_region__',
            type: 'frame',
            ...rect,
            angle: 0,
            strokeColor: 'transparent',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            index: null,
            roundness: null,
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false,
            name: null,
          });
        const blob = await exportToBlob({
          elements,
          appState: {
            ...data.appState,
            exportBackground: true,
            exportWithDarkMode: false,
          },
          files: data.files,
          mimeType: 'image/png',
          exportPadding: rect ? 0 : 20,
          exportingFrame: rect ? elements.at(-1) : undefined,
          getDimensions: (width, height) => {
            const scale = Math.min(2, 8192 / Math.max(width, height));
            return {
              width: Math.ceil(width * scale),
              height: Math.ceil(height * scale),
              scale,
            };
          },
        });
        pages.push(
          await new Promise((resolve, reject) => {
            const reader = new ownerWindow.FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
        );
      }
      await bridge.invoke('exportPDF', doc.title, pages);
    } finally {
      setBusy(false);
    }
  };
  const exportGraphic = async (format) => {
    flush();
    stop();
    setBusy(true);
    try {
      const options = exportOptions(active.current.data, exportRegion);
      let value;
      if (format === 'svg') value = (await exportToSvg(options)).outerHTML;
      else {
        const blob = await exportToBlob({ ...options, mimeType: 'image/png' });
        value = await new Promise((resolve, reject) => {
          const reader = new ownerWindow.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      await bridge.invoke('exportGraphic', doc.title, format, value);
    } finally {
      setBusy(false);
    }
  };
  const ask = (title, value, submit, options) =>
    setForm({ title, value, submit, options });
  const create = (kind) =>
    ask(kind === 'folder' ? '新建文件夹' : '新建白板', '', async (title) => {
      flush();
      const id = await bridge.invoke('create', kind, folder, title);
      await refresh();
      if (kind === 'document') await switchDoc(id);
    });
  const move = (node) =>
    ask(
      '移动到文件夹',
      node.parent || '',
      async (parent) => {
        await bridge.invoke('move', node.id, parent || null);
        await refresh();
      },
      [
        { id: '', title: '根目录' },
        ...nodes.filter(
          (n) => n.kind === 'folder' && !n.deleted && n.id !== node.id,
        ),
      ],
    );
  const tree = (parent = null, depth = 0) =>
    nodes
      .filter((n) => n.parent === parent && !n.deleted)
      .map((n) => (
        <React.Fragment key={n.id}>
          <div
            className={`tree-row ${doc?.id === n.id ? 'active' : ''} ${folder === n.id ? 'folder-selected' : ''}`}
            style={{ paddingLeft: 8 + depth * 15 }}
          >
            <button
              className="node-title"
              disabled={busy}
              onClick={() =>
                run(() =>
                  n.kind === 'document' ? switchDoc(n.id) : setFolder(n.id),
                )
              }
            >
              {n.kind === 'folder' ? '▾' : '▧'} {n.title}
            </button>
            <button
              title="操作"
              aria-label={`${n.title} 操作`}
              onClick={() => setForm({ title: n.title, node: n })}
            >
              ···
            </button>
          </div>
          {n.kind === 'folder' && tree(n.id, depth + 1)}
        </React.Fragment>
      ));
  const remove = async (node) => {
    flush();
    await bridge.invoke('trash', node.id, true);
    if (doc?.id === node.id) {
      stop();
      active.current = null;
      setDoc(null);
      setScenes([]);
    }
    if (folder === node.id) setFolder(null);
    await refresh();
  };
  return (
    <div
      className={`workspace ${!sidebar ? 'sidebar-hidden' : ''} ${presenting ? 'presenting' : ''}`}
    >
      <aside className="files">
        <div className="brand">
          <span className="logo">▧</span>
          <div>
            Local Canvas<small>本地无限画布</small>
          </div>
        </div>
        <div className="section-title">
          工作区 <span>离线 · 本机</span>
        </div>
        <div className="actions">
          <button onClick={() => create('document')}>＋ 白板</button>
          <button onClick={() => create('folder')}>＋ 文件夹</button>
          <button
            className="workspace-save"
            title="保存内容与当前视图（Cmd/Ctrl+S）"
            disabled={!doc || busy}
            onClick={() => run(manualSave)}
          >
            保存
          </button>
        </div>
        <button
          className={`root ${folder === null ? 'selected' : ''}`}
          onClick={() => setFolder(null)}
        >
          ⌂ 根目录
        </button>
        <div className="tree">{tree()}</div>
        <div className="file-tools">
          <button
            onClick={() =>
              run(async () => {
                flush();
                const id = await bridge.invoke('importDocument', folder);
                await refresh();
                if (id) await switchDoc(id);
              })
            }
          >
            导入文档
          </button>
          <button onClick={() => setTrash(!trash)}>回收站</button>
          <button
            onClick={() =>
              run(async () => {
                flush();
                await bridge.invoke('backup');
              })
            }
          >
            备份工作区
          </button>
          <button
            onClick={() =>
              run(async () => {
                flush();
                await bridge.invoke('restore');
                await refresh();
              })
            }
          >
            恢复备份
          </button>
        </div>
        <small className="hint">备份包含图片与场景。恢复会导入新文件夹。</small>
      </aside>
      <main>
        <header>
          <div>
            <strong>{doc?.title || '选择或创建一张白板'}</strong>
            <span className="save-state">{status}</span>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => run(flush)}>重试保存</button>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
        <div
          className="canvas"
          ref={stage}
          onPointerDownCapture={stop}
          onWheelCapture={stop}
          onKeyDownCapture={stop}
        >
          {doc ? (
            <Excalidraw
              key={doc.id}
              langCode="zh-CN"
              showDeprecatedFonts
              viewModeEnabled={presenting}
              excalidrawAPI={(value) => {
                api.current = value;
              }}
              initialData={{
                ...doc.data,
                appState: { ...doc.data.appState, collaborators: new Map() },
                scrollToContent: false,
              }}
              onLibraryChange={(libraryItems) => {
                if (active.current?.id === doc.id)
                  changed({ ...active.current.data, libraryItems });
              }}
              onChange={(elements, appState, files) => {
                if (presentation.current) return;
                if (active.current?.id !== doc.id) return;
                const data = JSON.parse(
                  serializeAsJSON(elements, appState, files, 'local'),
                );
                data.appState = {
                  ...data.appState,
                  scrollX: active.current.data.appState.scrollX ?? 0,
                  scrollY: active.current.data.appState.scrollY ?? 0,
                  zoom: active.current.data.appState.zoom ?? { value: 1 },
                };
                const next = {
                  ...active.current.data,
                  elements: data.elements,
                  appState: data.appState,
                  files: data.files || files,
                  scenes: active.current.data.scenes,
                };
                if (
                  JSON.stringify(next) !== JSON.stringify(active.current.data)
                )
                  changed(next);
              }}
            />
          ) : (
            <div className="empty">
              <span>▧</span>
              <h1>把想法放在同一张画布上</h1>
              <p>创建白板，自由绘制，再用场景整理你的思路。</p>
              <button onClick={() => create('document')}>创建第一张白板</button>
            </div>
          )}
          {selecting && (
            <div
              className="selection-layer"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const bounds = e.currentTarget.getBoundingClientRect();
                start.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  x: e.clientX - bounds.left,
                  y: e.clientY - bounds.top,
                };
                setSelection(null);
              }}
              onPointerMove={(e) => {
                if (!start.current) return;
                const b = e.currentTarget.getBoundingClientRect();
                setSelection(
                  normalizeRect(start.current, {
                    x: e.clientX - b.left,
                    y: e.clientY - b.top,
                  }),
                );
              }}
              onPointerUp={(e) => {
                if (!start.current) return;
                const a = viewportCoordsToSceneCoords(
                    start.current,
                    api.current.getAppState(),
                  ),
                  b = viewportCoordsToSceneCoords(e, api.current.getAppState());
                start.current = null;
                const rect = normalizeRect(a, b);
                if (rect.width > 1 && rect.height > 1) {
                  if (selecting === 'export') {
                    setExportRegion(rect);
                    setSelecting(null);
                    setSelection(null);
                    setExportMenu(true);
                  } else addScene(rect);
                }
              }}
              onPointerCancel={() => {
                start.current = null;
                setSelection(null);
              }}
            >
              <div className="selection-tip">
                {selecting === 'export' ? '拖出导出区域' : '拖出场景区域'} · Esc
                取消
              </div>
              {selection && (
                <div
                  className="selection-box"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </main>
      <aside className="scenes">
        <div className="section-title">场景</div>
        <p className="hint">为同一张白板保存不同区域，点击场景平滑导航。</p>
        <div className="scene-create">
          <button
            disabled={!doc || !scenes.length}
            onClick={() => run(beginPresentation)}
          >
            ▶ 演示
          </button>
          <button
            disabled={!doc}
            onClick={() => {
              stop();
              setSelecting('new');
            }}
          >
            ＋ 框选区域
          </button>
          <button
            disabled={!doc}
            onClick={() =>
              api.current && addScene(viewRect(api.current.getAppState()))
            }
          >
            保存当前视图
          </button>
        </div>
        <label className="duration">
          移动时长{' '}
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={500}>0.5 秒</option>
            <option value={1200}>1.2 秒</option>
            <option value={2200}>2.2 秒</option>
            <option value={3500}>3.5 秒</option>
            <option value={5000}>5 秒</option>
          </select>
        </label>
        <div
          className="scene-list"
          onDragOver={(e) => {
            e.preventDefault();
            const bounds = e.currentTarget.getBoundingClientRect();
            if (e.clientY > bounds.bottom - 35) e.currentTarget.scrollTop += 16;
            if (e.clientY < bounds.top + 35) e.currentTarget.scrollTop -= 16;
            if (e.target === e.currentTarget) markDrop(scenes.length);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const source = scenes.find((s) => s.id === drag.current);
            if (source && dropPosition.current !== null) {
              const next = scenes.filter((s) => s.id !== source.id);
              const index =
                dropPosition.current -
                (scenes.indexOf(source) < dropPosition.current ? 1 : 0);
              next.splice(index, 0, source);
              updateScenes(next);
            }
            drag.current = null;
            markDrop(null);
          }}
        >
          {scenes.map((s, i) => (
            <article
              className={`scene ${dropAt === i ? 'drop-before' : ''} ${dropAt === i + 1 && i === scenes.length - 1 ? 'drop-after' : ''}`}
              key={s.id}
              onContextMenu={(e) => {
                e.preventDefault();
                setSceneMenu({
                  id: s.id,
                  x: Math.min(e.clientX, ownerWindow.innerWidth - 170),
                  y: Math.min(e.clientY, ownerWindow.innerHeight - 200),
                });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const box = e.currentTarget.getBoundingClientRect();
                markDrop(i + (e.clientY > box.y + box.height / 2 ? 1 : 0));
              }}
            >
              <button
                className="drag-handle"
                title="拖动排序"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = s.id;
                  markDrop(null);
                }}
                onPointerMove={(e) => {
                  if (drag.current !== s.id) return;
                  const list = e.currentTarget.closest('.scene-list');
                  const bounds = list.getBoundingClientRect();
                  if (e.clientY < bounds.top + 35) list.scrollTop -= 16;
                  if (e.clientY > bounds.bottom - 35) list.scrollTop += 16;
                  const rows = Array.from(list.querySelectorAll('.scene'));
                  const index = rows.findIndex((row) => {
                    const box = row.getBoundingClientRect();
                    return e.clientY < box.top + box.height / 2;
                  });
                  markDrop(index < 0 ? scenes.length : index);
                }}
                onPointerUp={() => {
                  if (drag.current === s.id && dropPosition.current !== null) {
                    const next = scenes.filter((scene) => scene.id !== s.id);
                    const index =
                      dropPosition.current - (i < dropPosition.current ? 1 : 0);
                    next.splice(index, 0, s);
                    if (index !== i) updateScenes(next);
                  }
                  drag.current = null;
                  markDrop(null);
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  markDrop(null);
                }}
              >
                ⠿
              </button>
              {editingScene === s.id ? (
                <input
                  className="scene-title-input"
                  aria-label="场景标题"
                  autoFocus
                  defaultValue={s.title}
                  maxLength={200}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => renameScene(s.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.currentTarget.value = s.title;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button
                  className="scene-target"
                  title={s.title}
                  onClick={() => navigate(s)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    stop();
                    setEditingScene(s.id);
                  }}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{s.title}</strong>
                </button>
              )}
            </article>
          ))}
        </div>
        <small className="hint">拖拽排序 · 双击标题改名 · 右键更多操作。</small>
      </aside>
      {sceneMenu && (
        <div
          className="scene-menu-backdrop"
          onPointerDown={() => setSceneMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setSceneMenu(null);
          }}
        >
          <div
            role="menu"
            className="scene-context-menu"
            style={{ left: sceneMenu.x, top: sceneMenu.y }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSceneMenu(null);
            }}
          >
            <button
              role="menuitem"
              autoFocus
              onClick={() => {
                setEditingScene(sceneMenu.id);
                setSceneMenu(null);
              }}
            >
              改名
            </button>
            <button
              role="menuitem"
              onClick={() => {
                stop();
                setSelecting(sceneMenu.id);
                setSceneMenu(null);
              }}
            >
              重框
            </button>
            <button
              role="menuitem"
              disabled={scenes[0]?.id === sceneMenu.id}
              onClick={() => {
                const next = [...scenes];
                const i = next.findIndex((s) => s.id === sceneMenu.id);
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                updateScenes(next);
                setSceneMenu(null);
              }}
            >
              上移
            </button>
            <button
              role="menuitem"
              onClick={() => {
                updateScenes(scenes.filter((s) => s.id !== sceneMenu.id));
                setSceneMenu(null);
              }}
            >
              删除场景
            </button>
          </div>
        </div>
      )}
      {!presenting && (
        <>
          <button
            className="export-toggle"
            aria-label="导出"
            title="导出"
            disabled={!doc || busy}
            aria-expanded={exportMenu}
            onClick={() => setExportMenu(!exportMenu)}
          >
            <svg
              width="22"
              height="18"
              viewBox="0 0 24 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 13V2m-4 4 4-4 4 4M3 12v6h18v-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {exportMenu && (
            <div className="export-menu" role="dialog" aria-label="导出选项">
              <strong>导出</strong>
              <span className="hint">
                范围：{exportRegion ? '已框选区域' : '整张白板'}
              </span>
              <div className="actions">
                <button
                  onClick={() => {
                    setExportMenu(false);
                    setSelecting('export');
                    stop();
                  }}
                >
                  框选导出区域
                </button>
                <button onClick={() => setExportRegion(null)}>整张白板</button>
              </div>
              <button
                disabled={busy}
                onClick={() => run(() => exportGraphic('png'))}
              >
                导出 PNG
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => exportGraphic('svg'))}
              >
                导出 SVG
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => exportPDF(false))}
              >
                导出 PDF
              </button>
              <button
                disabled={busy || !scenes.length}
                onClick={() => run(() => exportPDF(true))}
              >
                场景 PDF
              </button>
              <small>可编辑格式保存完整白板，包含区域外内容。</small>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => {
                    flush();
                    return bridge.invoke(
                      'exportDocument',
                      doc.id,
                      active.current.data,
                      false,
                    );
                  })
                }
              >
                导出完整文档
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => {
                    flush();
                    return bridge.invoke(
                      'exportDocument',
                      doc.id,
                      active.current.data,
                      true,
                    );
                  })
                }
              >
                导出 .excalidraw
              </button>
              <button onClick={() => setExportMenu(false)}>关闭导出</button>
            </div>
          )}
          <button
            className="scene-panel-toggle"
            onClick={toggleSidebar}
            title={sidebar ? '隐藏场景' : '显示场景'}
            aria-label={sidebar ? '隐藏场景' : '显示场景'}
            aria-pressed={sidebar}
          >
            <PanelIcon />
          </button>
        </>
      )}
      {presenting && (
        <>
          <div
            className={`presentation-ink ${pen ? 'drawing' : ''}`}
            data-ink-count={inkCount}
            onPointerDownCapture={stop}
          >
            <Excalidraw
              langCode="zh-CN"
              viewModeEnabled={!pen}
              initialData={{
                elements: [],
                appState: {
                  viewBackgroundColor: 'transparent',
                  currentItemStrokeColor: '#e03131',
                  currentItemStrokeWidth: 2,
                  activeTool: { type: 'freedraw', locked: true },
                  ...savedView.current,
                },
              }}
              excalidrawAPI={(value) => {
                inkApi.current = value;
              }}
              onChange={(elements, state) => {
                setInkCount(elements.filter((e) => !e.isDeleted).length);
                if (!presentation.current || !api.current) return;
                const current = api.current.getAppState();
                if (
                  current.scrollX !== state.scrollX ||
                  current.scrollY !== state.scrollY ||
                  current.zoom.value !== state.zoom.value
                )
                  api.current.updateScene({
                    appState: {
                      scrollX: state.scrollX,
                      scrollY: state.scrollY,
                      zoom: state.zoom,
                    },
                    captureUpdate: CaptureUpdateAction.NEVER,
                  });
              }}
            />
          </div>
          <div className="presentation-controls">
            <button
              aria-label="上一场景"
              disabled={scenes.findIndex((s) => s.id === currentScene) <= 0}
              onClick={() => step(-1)}
            >
              ←
            </button>
            <span>
              {scenes.findIndex((s) => s.id === currentScene) + 1} /{' '}
              {scenes.length}
            </span>
            <button
              aria-label="下一场景"
              disabled={
                scenes.findIndex((s) => s.id === currentScene) >=
                scenes.length - 1
              }
              onClick={() => step(1)}
            >
              →
            </button>
            <button
              aria-pressed={pen}
              disabled={!presentationReady}
              onClick={() => {
                stop();
                setPen(!pen);
                if (!pen)
                  inkApi.current?.setActiveTool({
                    type: 'freedraw',
                    locked: true,
                  });
              }}
            >
              临时画笔
            </button>
            <button onClick={clearInk}>清除</button>
            <button onClick={() => run(exitPresentation)}>退出演示</button>
          </div>
        </>
      )}
      {trash && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>回收站</h2>
            {nodes
              .filter((n) => n.deleted)
              .map((n) => (
                <p key={n.id}>
                  {n.title}
                  <button
                    onClick={() =>
                      run(async () => {
                        await bridge.invoke('trash', n.id, false);
                        await refresh();
                      })
                    }
                  >
                    恢复
                  </button>
                </p>
              ))}
            <button onClick={() => setTrash(false)}>关闭</button>
          </section>
        </div>
      )}
      {form && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>{form.title}</h2>
            {form.node ? (
              <>
                <button
                  onClick={() =>
                    ask('重命名', form.node.title, async (title) => {
                      await bridge.invoke('rename', form.node.id, title);
                      const list = await refresh();
                      if (doc?.id === form.node.id)
                        setDoc({
                          ...doc,
                          title: list.find((n) => n.id === doc.id).title,
                        });
                    })
                  }
                >
                  重命名
                </button>
                <button onClick={() => move(form.node)}>移动</button>
                <button
                  onClick={() =>
                    run(async () => {
                      await remove(form.node);
                      setForm(null);
                    })
                  }
                >
                  移入回收站
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const value = form.value.trim();
                    if (!form.options && !value) throw new Error('请输入名称');
                    await form.submit(value);
                    setForm(null);
                  });
                }}
              >
                {form.options ? (
                  <select
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: e.target.value })
                    }
                  >
                    {form.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    autoFocus
                    maxLength={200}
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: e.target.value })
                    }
                  />
                )}
                <button type="submit">确定</button>
              </form>
            )}
            <button onClick={() => setForm(null)}>取消</button>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(root).render(<App />);
