import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
  getCommonBounds,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import { THEMES, themeId, themeStyle } from './themes.mjs';
import { sceneRange, selectedBinding, followScenes } from './scenes.mjs';
import { ShellIcon, ThemePaletteIcon } from './ShellIcon.jsx';
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
function FolderIcon({ open }) {
  return (
    <svg
      className="folder-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d={
          open
            ? 'M3 7V5h7l2 2h9v3H6L3 20V7Zm0 13 3-10h17l-3 10H3Z'
            : 'M3 20V5h7l2 2h9v13H3Z'
        }
        fill="#dce9df"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function App() {
  const [uiTheme, setUITheme] = useState('github');
  const [fileSidebar, setFileSidebar] = useState(true);
  const middleClick = useRef(null);
  const [canvasDark, setCanvasDark] = useState(false);
  useLayoutEffect(() => {
    const element = root.ownerDocument.documentElement;
    element.dataset.uiTheme = uiTheme;
    for (const [key, value] of Object.entries(themeStyle(uiTheme)))
      element.style.setProperty(key, value);
    element.style.colorScheme = THEMES[uiTheme].dark ? 'dark' : 'light';
  }, [uiTheme]);
  const [loopPresentation, setLoopPresentation] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [nodes, setNodes] = useState([]),
    [doc, setDoc] = useState(null),
    [folder, setFolder] = useState(null);
  const [status, setStatus] = useState('正在打开…'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState([]),
    [selecting, setSelecting] = useState(null),
    [selection, setSelection] = useState(null);
  const [duration, setDuration] = useState(500),
    [trash, setTrash] = useState(false),
    [form, setForm] = useState(null);
  const [sidebar, setSidebar] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);
  const [layers, setLayers] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [dwellTime, setDwellTime] = useState(3000);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [storageDialog, setStorageDialog] = useState(false);
  const [storagePending, setStoragePending] = useState(false);
  const [fileMenu, setFileMenu] = useState(null);
  const [menuPending, setMenuPending] = useState(false);
  const [menuError, setMenuError] = useState('');
  const menuPanel = useRef(null),
    menuTrigger = useRef(null);
  const closeFileMenu = () => {
    setFileMenu(null);
    if (menuTrigger.current?.isConnected) menuTrigger.current.focus();
  };
  useLayoutEffect(() => {
    if (!fileMenu) return;
    const field = menuPanel.current?.querySelector(
      fileMenu.mode === 'rename'
        ? 'input'
        : fileMenu.mode === 'move'
          ? 'select'
          : '[role="menuitem"], button',
    );
    field?.focus();
    if (field?.tagName === 'INPUT') field.select();
  }, [fileMenu?.node?.id, fileMenu?.mode]);
  const [fileInfo, setFileInfo] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState([]);
  const [dropFolder, setDropFolder] = useState(undefined);
  const [widths, setWidths] = useState({ left: 240, right: 230 });
  const fileDrag = useRef(null),
    resizeDrag = useRef(null),
    widthRef = useRef(widths);
  const [currentScene, setCurrentScene] = useState(null);
  const [pen, setPen] = useState(false);
  const [inkCount, setInkCount] = useState(0);
  const [editingScene, setEditingScene] = useState(null);
  const [sceneMenu, setSceneMenu] = useState(null);
  const [selectedScenes, setSelectedScenes] = useState([]);
  const sceneAnchor = useRef(null);
  const [sceneDeletion, setSceneDeletion] = useState(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
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
  const inkStyle = useRef({
    currentItemStrokeColor: '#e03131',
    currentItemStrokeWidth: 2,
    currentItemOpacity: 100,
    currentItemBackgroundColor: 'transparent',
  });
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
  const manualSave = (writeFile = true) => {
    if (
      !api.current ||
      !active.current ||
      presentation.current ||
      storagePending ||
      busy
    )
      return;
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
    if (writeFile && bridge.saveFile(active.current.id, active.current.data))
      setStatus('已保存到原文件');
  };
  const saveAs = async () => {
    if (
      !api.current ||
      !active.current ||
      busy ||
      presentation.current ||
      storagePending
    )
      return;
    manualSave(false);
    const link = await bridge.invoke(
      'saveAsDocument',
      active.current.id,
      active.current.data,
    );
    if (link) setStatus('已另存为文件');
  };
  const switchDoc = async (id) => {
    if (busy) return;
    if (active.current?.id === id && api.current) {
      flush();
      setFolder(nodes.find((node) => node.id === id)?.parent || null);
      return;
    }
    setBusy(true);
    try {
      flush();
      stop();
      setSelecting(null);
      setSelection(null);
      setSelectedScenes([]);
      sceneAnchor.current = null;
      setSceneMenu(null);
      setSceneDeletion(null);
      setExportMenu(false);
      setExportRegion(null);
      const next = await bridge.invoke('read', id);
      api.current = null;
      setEditorReady(false);
      setEditorEpoch((value) => value + 1);
      active.current = next;
      dirty.current = false;
      setScenes(next.data.scenes);
      setDoc(next);
      setReadOnly(false);
      setFolder(next.parent || null);
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
      const theme = themeId(await bridge.invoke('getSetting', 'uiTheme'));
      setUITheme(theme);
      setCanvasDark(THEMES[theme].dark);
      setFileSidebar(
        (await bridge.invoke('getSetting', 'fileSidebar')) !== 'false',
      );
      setLoopPresentation(
        (await bridge.invoke('getSetting', 'loopPresentation')) === 'true',
      );
      const list = await refresh();
      setStorageInfo(await bridge.invoke('storageInfo'));
      const savedWidths = await bridge.invoke('getSetting', 'sidebarWidths');
      if (
        savedWidths &&
        Number.isFinite(savedWidths.left) &&
        Number.isFinite(savedWidths.right)
      ) {
        const next = {
          left: Math.min(460, Math.max(220, savedWidths.left)),
          right: Math.min(420, Math.max(200, savedWidths.right)),
        };
        widthRef.current = next;
        setWidths(next);
      }
      const collapsed = await bridge.invoke('getSetting', 'collapsedFolders');
      if (Array.isArray(collapsed)) setCollapsedFolders(collapsed);
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
        setFileMenu(null);
        stop();
        setSelecting(null);
        setSelection(null);
      }
    };
    const saveKey = (e) => {
      if (
        e.key === 'Escape' &&
        root.ownerDocument.querySelector('.HelpDialog')
      ) {
        e.preventDefault();
        e.stopPropagation();
        api.current?.updateScene({
          appState: { openDialog: null },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        return;
      }
      if (
        e.altKey &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'd'
      ) {
        e.preventDefault();
        e.stopPropagation();
        setCanvasDark((value) => !value);
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'e' &&
        !presentation.current &&
        active.current
      ) {
        e.preventDefault();
        e.stopPropagation();
        setExportMenu(true);
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 's' &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        run(() =>
          e.shiftKey ? latest.current.saveAs() : latest.current.manualSave(),
        );
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
    setSelectedScenes((ids) =>
      ids.filter((id) => next.some((scene) => scene.id === id)),
    );
    changed({ ...active.current.data, scenes: next });
  };
  const addScene = (rect) => {
    if (selecting && selecting !== 'new')
      updateScenes(
        scenes.map((s) => {
          if (s.id !== selecting) return s;
          const { binding, ...fixed } = s;
          return { ...fixed, rect };
        }),
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
      const t = Math.min(
          1,
          (now - began) / (presentation.current ? duration : 500),
        ),
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
  const addElementScene = () => {
    if (!api.current || !active.current) return;
    const elements = api.current.getSceneElements();
    const binding = selectedBinding(elements, api.current.getAppState());
    if (!binding.elementIds.length) {
      api.current.setActiveTool({ type: 'selection' });
      setStatus('先在画布选中元素或组合，再点“选择元素”添加场景');
      return;
    }
    const scene = {
      id: ownerWindow.crypto.randomUUID(),
      title: `元素场景 ${scenes.length + 1}`,
      rect: { x: 0, y: 0, width: 1, height: 1 },
      binding,
    };
    updateScenes(followScenes([...scenes, scene], elements, getCommonBounds));
  };
  const rebuildSceneBinding = (id) => {
    if (!api.current || !active.current) return;
    stop();
    const elements = api.current.getSceneElements();
    const binding = selectedBinding(elements, api.current.getAppState());
    setSceneMenu(null);
    if (!binding.elementIds.length) {
      setStatus('先在画布选中元素或组合，再右键场景选择“重建跟随”');
      return;
    }
    updateScenes(
      followScenes(
        scenes.map((scene) =>
          scene.id === id ? { ...scene, binding } : scene,
        ),
        elements,
        getCommonBounds,
      ),
    );
    setStatus('已按当前所选元素或组合重建场景跟随');
  };
  const exitPresentation = async () => {
    ownerWindow.clearTimeout(presentationTimer.current);
    stop();
    presentation.current = false;
    setPresenting(false);
    setLayers(false);
    setAutoPlay(false);
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
  const selectScene = (scene, event) => {
    if (event.shiftKey) {
      setSelectedScenes(sceneRange(scenes, sceneAnchor.current, scene.id));
      if (!sceneAnchor.current) sceneAnchor.current = scene.id;
      return;
    }
    sceneAnchor.current = scene.id;
    setSelectedScenes([scene.id]);
    navigate(scene);
  };
  const fitOnMiddleDoubleClick = (event) => {
    stop();
    if (
      event.button !== 1 ||
      !api.current ||
      event.target.closest(
        'button,input,select,textarea,a,[role="menu"],.App-menu,.layer-ui__wrapper,.excalidraw-textEditorContainer',
      )
    )
      return;
    const now = ownerWindow.performance.now(),
      previous = middleClick.current;
    middleClick.current = { time: now, x: event.clientX, y: event.clientY };
    if (
      previous &&
      now - previous.time < 400 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 8
    ) {
      event.preventDefault();
      event.stopPropagation();
      middleClick.current = null;
      setAutoPlay(false);
      const elements = api.current.getSceneElements();
      if (!elements.length) return;
      const options = {
        fitToViewport: true,
        viewportZoomFactor: 0.85,
        maxZoom: 1,
        animate: false,
      };
      api.current.scrollToContent(elements, options);
      inkApi.current?.scrollToContent(elements, options);
    }
  };
  const confirmSceneDeletion = async () => {
    if (!sceneDeletion || sceneDeletion.documentId !== active.current?.id)
      return;
    const index = scenes.findIndex((scene) => scene.id === currentScene);
    const next = scenes.filter(
      (scene) => !sceneDeletion.ids.includes(scene.id),
    );
    stop();
    setAutoPlay(false);
    updateScenes(next);
    setSceneDeletion(null);
    setSelectedScenes([]);
    sceneAnchor.current = null;
    if (presentation.current && !next.length) await exitPresentation();
    else if (sceneDeletion.ids.includes(currentScene)) {
      if (presentation.current)
        navigate(next[Math.min(Math.max(index, 0), next.length - 1)]);
      else setCurrentScene(null);
    }
  };
  latest.current = { exitPresentation, step, manualSave, saveAs };
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
    if (!api.current || !scenes.length)
      throw new Error('编辑器尚未准备好，请重新选择白板后重试');
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
      navigate(scenes[0]);
      setPresentationReady(true);
    }, 150);
  };
  useEffect(() => {
    if (!presenting || !autoPlay || !presentationReady) return;
    const index = scenes.findIndex((s) => s.id === currentScene);
    if (index >= scenes.length - 1 && !loopPresentation) {
      setAutoPlay(false);
      return;
    }
    const timer = ownerWindow.setTimeout(
      () =>
        index >= scenes.length - 1
          ? navigate(scenes[0])
          : latest.current.step(1),
      duration + dwellTime,
    );
    return () => ownerWindow.clearTimeout(timer);
  }, [
    presenting,
    autoPlay,
    presentationReady,
    currentScene,
    duration,
    dwellTime,
    scenes,
    loopPresentation,
  ]);
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
  const create = (kind, parent = folder) =>
    ask(kind === 'folder' ? '新建文件夹' : '新建白板', '', async (title) => {
      flush();
      const id = await bridge.invoke('create', kind, parent, title);
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
  const openFileMenu = (event, node = null) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    menuTrigger.current = event.currentTarget;
    setMenuError('');
    setFileMenu({
      node,
      mode: 'actions',
      x: Math.min(event.clientX || bounds.right, ownerWindow.innerWidth - 292),
      y: Math.min(
        event.clientY || bounds.bottom,
        ownerWindow.innerHeight - 340,
      ),
    });
  };
  const menuMode = (mode) => {
    setMenuError('');
    setFileMenu({ ...fileMenu, mode });
  };
  const performMenuAction = async (action) => {
    if (menuPending) return;
    setMenuPending(true);
    setMenuError('');
    try {
      await action();
      closeFileMenu();
    } catch (error) {
      setMenuError(error.message);
    } finally {
      setMenuPending(false);
    }
  };
  const moveNode = async (id, parent) => {
    flush();
    await bridge.invoke('move', id, parent);
    setCollapsedFolders((ids) => ids.filter((value) => value !== parent));
    await refresh();
  };
  const folderPath = (node) => {
    const titles = [node.title];
    let parent = node.parent;
    while (parent) {
      const ancestor = nodes.find((item) => item.id === parent);
      if (!ancestor) break;
      titles.unshift(ancestor.title);
      parent = ancestor.parent;
    }
    return titles.join(' / ');
  };
  const canMoveTo = (node, target) => {
    let current = target;
    while (current) {
      if (current.id === node.id) return false;
      current = nodes.find((item) => item.id === current.parent);
    }
    return true;
  };
  const dropOn = (event, parent) => {
    event.preventDefault();
    event.stopPropagation();
    const id = fileDrag.current;
    fileDrag.current = null;
    setDropFolder(undefined);
    if (id && id !== parent) run(() => moveNode(id, parent));
  };
  const resizeHandle = (side) => (
    <div
      className={`sidebar-resizer ${side}`}
      role="separator"
      aria-label={side === 'left' ? '左侧栏宽度' : '右侧栏宽度'}
      aria-orientation="vertical"
      aria-valuenow={widths[side]}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeDrag.current = {
          x: event.clientX,
          width: widthRef.current[side],
        };
      }}
      onPointerMove={(event) => {
        if (!resizeDrag.current) return;
        const value = Math.max(
          side === 'left' ? 220 : 200,
          Math.min(
            side === 'left' ? 460 : 420,
            resizeDrag.current.width +
              (event.clientX - resizeDrag.current.x) *
                (side === 'left' ? 1 : -1),
          ),
        );
        widthRef.current = { ...widthRef.current, [side]: value };
        setWidths(widthRef.current);
      }}
      onPointerUp={() => {
        resizeDrag.current = null;
        run(() =>
          bridge.invoke('setSetting', 'sidebarWidths', widthRef.current),
        );
      }}
      onLostPointerCapture={() => {
        resizeDrag.current = null;
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const direction =
          (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1);
        const value = Math.max(
          side === 'left' ? 220 : 200,
          Math.min(
            side === 'left' ? 460 : 420,
            widthRef.current[side] + direction * 10,
          ),
        );
        widthRef.current = { ...widthRef.current, [side]: value };
        setWidths(widthRef.current);
        run(() =>
          bridge.invoke('setSetting', 'sidebarWidths', widthRef.current),
        );
      }}
    />
  );
  const activeAncestors = new Set();
  let ancestor = nodes.find((node) => node.id === doc?.id)?.parent;
  while (ancestor && !activeAncestors.has(ancestor)) {
    activeAncestors.add(ancestor);
    ancestor = nodes.find((node) => node.id === ancestor)?.parent;
  }
  const tree = (parent = null, depth = 0) =>
    nodes
      .filter((n) => n.parent === parent && !n.deleted)
      .map((n) => (
        <React.Fragment key={n.id}>
          <div
            className={`tree-row ${n.kind === 'folder' ? 'folder-row' : ''} ${doc?.id === n.id ? 'active' : ''} ${activeAncestors.has(n.id) ? 'folder-selected' : ''} ${dropFolder === n.id ? 'drop-target' : ''}`}
            data-depth={depth}
            style={{
              paddingLeft: 8 + depth * 28,
              '--tree-highlight-start': `${depth ? 22 + (depth - 1) * 28 : 0}px`,
            }}
            onContextMenu={(event) => openFileMenu(event, n)}
            draggable={!busy}
            onDragStart={(event) => {
              fileDrag.current = n.id;
              event.dataTransfer.setData('text/plain', n.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              fileDrag.current = null;
              setDropFolder(undefined);
            }}
            onDragOver={(event) => {
              if (fileDrag.current && n.kind === 'folder') {
                event.preventDefault();
                setDropFolder(n.id);
              }
            }}
            onDrop={(event) => {
              if (n.kind === 'folder') dropOn(event, n.id);
            }}
          >
            {Array.from({ length: depth }, (_, level) => (
              <span
                key={level}
                className="tree-guide"
                style={{ left: 21 + level * 28 }}
                aria-hidden="true"
              />
            ))}
            {n.kind !== 'folder' && (
              <span className="tree-toggle-spacer" aria-hidden="true" />
            )}
            {n.kind === 'folder' && (
              <button
                className="folder-toggle"
                aria-label={`${collapsedFolders.includes(n.id) ? '展开' : '收起'} ${n.title}`}
                aria-expanded={!collapsedFolders.includes(n.id)}
                disabled={
                  !nodes.some(
                    (child) => child.parent === n.id && !child.deleted,
                  )
                }
                onClick={() => {
                  const next = collapsedFolders.includes(n.id)
                    ? collapsedFolders.filter((id) => id !== n.id)
                    : [...collapsedFolders, n.id];
                  setCollapsedFolders(next);
                  run(() =>
                    bridge.invoke('setSetting', 'collapsedFolders', next),
                  );
                }}
              >
                <ShellIcon
                  name="chevron"
                  theme={uiTheme}
                  open={!collapsedFolders.includes(n.id)}
                />
              </button>
            )}
            <button
              className="node-title"
              disabled={busy}
              onClick={() =>
                run(() =>
                  n.kind === 'document' ? switchDoc(n.id) : setFolder(n.id),
                )
              }
            >
              <ShellIcon
                name={n.kind === 'folder' ? 'folder' : 'document'}
                theme={uiTheme}
                open={!collapsedFolders.includes(n.id)}
              />{' '}
              {n.title}
            </button>
            <button
              title="操作"
              aria-label={`${n.title} 操作`}
              aria-haspopup="menu"
              aria-expanded={fileMenu?.node?.id === n.id}
              onClick={(event) => openFileMenu(event, n)}
            >
              ···
            </button>
          </div>
          {n.kind === 'folder' &&
            !collapsedFolders.includes(n.id) &&
            tree(n.id, depth + 1)}
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
      data-theme={uiTheme}
      className={`workspace ${!sidebar ? 'sidebar-hidden' : ''} ${!fileSidebar ? 'files-hidden' : ''} ${presenting ? 'presenting' : ''} ${layers ? 'show-layers' : ''}`}
      style={{
        ...themeStyle(uiTheme),
        '--files-width': `${widths.left}px`,
        '--scenes-width': `${widths.right}px`,
      }}
    >
      <aside className="files">
        {resizeHandle('left')}
        <div className="brand">
          <img className="logo" src="./app-icon.png" alt="Canvas 标志" />
          <div>
            Local Canvas<small>本地无限画布 · v0.4.1</small>
          </div>
        </div>
        <div className="section-title">
          工作区 <span>离线 · 本机</span>
        </div>
        <div className="actions">
          <button
            className="workspace-save"
            title="保存内容与当前视图（Cmd/Ctrl+S）"
            disabled={!doc || busy}
            onClick={() => run(manualSave)}
          >
            保存
          </button>
          <button disabled={!doc || busy} onClick={() => run(saveAs)}>
            另存为
          </button>
        </div>
        <button
          className="open-document"
          onClick={() =>
            run(async () => {
              flush();
              const id = await bridge.invoke('openDocument', folder);
              await refresh();
              if (id) await switchDoc(id);
            })
          }
        >
          打开文件…
        </button>
        <button
          className={`root ${folder === null ? 'selected' : ''} ${dropFolder === null ? 'drop-target' : ''}`}
          onClick={() => setFolder(null)}
          onContextMenu={(event) => openFileMenu(event)}
          onDragOver={(event) => {
            if (fileDrag.current) {
              event.preventDefault();
              setDropFolder(null);
            }
          }}
          onDrop={(event) => dropOn(event, null)}
          title="右键新建白板或文件夹；拖入此处移回根目录"
        >
          <ShellIcon name="home" theme={uiTheme} size={18} /> 根目录
        </button>
        <div className="tree">{tree()}</div>
        <details className="workspace-tools">
          <summary>工作区管理</summary>
          <div className="file-tools">
            <button onClick={() => setStorageDialog(true)}>保存位置</button>
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
        </details>
      </aside>
      <main>
        <header>
          <button
            className="left-panel-toggle"
            aria-label={fileSidebar ? '隐藏文件栏' : '显示文件栏'}
            title={fileSidebar ? '隐藏文件栏' : '显示文件栏'}
            onClick={() => {
              const next = !fileSidebar;
              setFileSidebar(next);
              run(() =>
                bridge.invoke('setSetting', 'fileSidebar', String(next)),
              );
            }}
          >
            <PanelIcon />
          </button>
          <div className="document-heading">
            <strong>{doc?.title || '选择或创建一张白板'}</strong>
            <span className="save-state">{status}</span>
          </div>
          <div className="header-actions">
            {doc && (
              <button
                className="file-info-button"
                onClick={() =>
                  run(async () =>
                    setFileInfo(await bridge.invoke('fileInfo', doc.id)),
                  )
                }
              >
                文件信息
              </button>
            )}
            {doc && (
              <button
                className="file-info-button"
                disabled={!editorReady || presenting}
                aria-pressed={readOnly}
                title="画布只读：禁止移动、编辑和删除全部元素；仍可平移缩放"
                onClick={() => {
                  stop();
                  setReadOnly(!readOnly);
                }}
              >
                {readOnly ? '解除只读' : '画布只读'}
              </button>
            )}
            <label className="theme-picker">
              <ThemePaletteIcon />
              <select
                aria-label="界面主题"
                value={uiTheme}
                onChange={(event) => {
                  const id = themeId(event.target.value);
                  setUITheme(id);
                  setCanvasDark(THEMES[id].dark);
                  run(() => bridge.invoke('setSetting', 'uiTheme', id));
                }}
              >
                {Object.entries(THEMES).map(([id, theme]) => (
                  <option key={id} value={id}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </label>
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
          onPointerDownCapture={fitOnMiddleDoubleClick}
          onWheelCapture={stop}
          onKeyDownCapture={stop}
        >
          {doc ? (
            <Excalidraw
              key={`${doc.id}:${editorEpoch}`}
              langCode="zh-CN"
              showDeprecatedFonts
              theme={canvasDark ? 'dark' : 'light'}
              UIOptions={{
                canvasActions: {
                  saveToActiveFile: false,
                  saveAsImage: false,
                  export: false,
                },
              }}
              viewModeEnabled={presenting || readOnly}
              excalidrawAPI={(value) => {
                api.current = value;
                setEditorReady(true);
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
                if (presentation.current || storagePending) return;
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
                  scenes: followScenes(
                    active.current.data.scenes,
                    elements,
                    getCommonBounds,
                  ),
                };
                if (next.scenes !== active.current.data.scenes)
                  setScenes(next.scenes);
                if (
                  JSON.stringify(next) !== JSON.stringify(active.current.data)
                )
                  changed(next);
              }}
            >
              <MainMenu>
                <MainMenu.DefaultItems.LoadScene />
                <MainMenu.DefaultItems.SearchMenu />
                <MainMenu.DefaultItems.Help />
                <MainMenu.DefaultItems.ClearCanvas />
                <MainMenu.Separator />
                <MainMenu.ItemLink
                  href="https://github.com/layzerff/excalidraw"
                  onSelect={(event) => {
                    event.preventDefault();
                    run(() => bridge.invoke('openProject'));
                  }}
                >
                  GitHub
                </MainMenu.ItemLink>
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ToggleTheme
                  onSelect={(theme) => setCanvasDark(theme === 'dark')}
                />
                <MainMenu.DefaultItems.ChangeCanvasBackground />
              </MainMenu>
            </Excalidraw>
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
        {!presenting && resizeHandle('right')}
        <div className="section-title">场景</div>
        <p className="hint">为同一张白板保存不同区域，点击场景平滑导航。</p>
        <div className="scene-create">
          <button
            disabled={!doc || !scenes.length || !editorReady}
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
            onClick={() => run(addElementScene)}
            title="先选中画布中的元素或组合，场景将跟随它们移动"
          >
            ＋ 选择元素
          </button>
          <button
            className="scene-current-view"
            disabled={!doc}
            onClick={() =>
              api.current && addScene(viewRect(api.current.getAppState()))
            }
          >
            添加当前视图为场景
          </button>
        </div>
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
              className={`scene ${selectedScenes.includes(s.id) ? 'scene-selected' : ''} ${dropAt === i ? 'drop-before' : ''} ${dropAt === i + 1 && i === scenes.length - 1 ? 'drop-after' : ''}`}
              data-scene-id={s.id}
              data-selected={selectedScenes.includes(s.id)}
              key={s.id}
              onContextMenu={(e) => {
                e.preventDefault();
                const ids = selectedScenes.includes(s.id)
                  ? selectedScenes
                  : [s.id];
                if (!selectedScenes.includes(s.id)) {
                  setSelectedScenes(ids);
                  sceneAnchor.current = s.id;
                }
                setSceneMenu({
                  id: s.id,
                  ids,
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
                      e.stopPropagation();
                      e.currentTarget.value = s.title;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button
                  className="scene-target"
                  title={s.title}
                  onClick={(event) => selectScene(s, event)}
                  aria-pressed={selectedScenes.includes(s.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    stop();
                    setEditingScene(s.id);
                  }}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{s.title}</strong>
                  {s.binding && (
                    <small className="scene-binding" title="跟随关联元素和组合">
                      跟随
                    </small>
                  )}
                </button>
              )}
            </article>
          ))}
        </div>
        <small className="hint">
          拖拽排序 · Shift 连选 · 双击改名 · 右键操作。
        </small>
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
              if (e.key === 'Escape') {
                e.stopPropagation();
                setSceneMenu(null);
              }
            }}
          >
            {sceneMenu.ids.length === 1 && (
              <>
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
                  {scenes.find((scene) => scene.id === sceneMenu.id)?.binding
                    ? '重框（解除跟随）'
                    : '重框'}
                </button>
                <button
                  role="menuitem"
                  title="以画布当前选中的元素或组合重新建立跟随"
                  onClick={() => rebuildSceneBinding(sceneMenu.id)}
                >
                  重建跟随
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
              </>
            )}
            <button
              role="menuitem"
              className="danger-action"
              autoFocus={sceneMenu.ids.length > 1}
              onClick={() => {
                stop();
                setAutoPlay(false);
                setSceneDeletion({ ids: sceneMenu.ids, documentId: doc.id });
                setSceneMenu(null);
              }}
            >
              {sceneMenu.ids.length > 1
                ? `删除已选场景（${sceneMenu.ids.length}）`
                : '删除场景'}
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
            onPointerDownCapture={fitOnMiddleDoubleClick}
          >
            <Excalidraw
              langCode="zh-CN"
              theme={canvasDark ? 'dark' : 'light'}
              viewModeEnabled={!pen}
              key={currentScene}
              handleKeyboardGlobally
              initialData={{
                elements: [],
                appState: {
                  viewBackgroundColor: 'transparent',
                  currentItemStrokeColor: '#e03131',
                  currentItemStrokeWidth: 2,
                  ...inkStyle.current,
                  activeTool: { type: 'freedraw', locked: true },
                  ...savedView.current,
                },
              }}
              excalidrawAPI={(value) => {
                inkApi.current = value;
              }}
              onChange={(elements, state) => {
                inkStyle.current = {
                  currentItemStrokeColor: state.currentItemStrokeColor,
                  currentItemStrokeWidth: state.currentItemStrokeWidth,
                  currentItemOpacity: state.currentItemOpacity,
                  currentItemBackgroundColor: state.currentItemBackgroundColor,
                };
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
              aria-pressed={layers}
              onClick={() => {
                setLayers(!layers);
                setAutoPlay(false);
              }}
            >
              图层
            </button>
            <button
              disabled={!presentationReady || scenes.length < 2}
              aria-pressed={autoPlay}
              onClick={() => {
                if (!autoPlay && currentScene === scenes.at(-1)?.id)
                  navigate(scenes[0]);
                setPen(false);
                setAutoPlay(!autoPlay);
              }}
            >
              {autoPlay ? '暂停自动演示' : '自动演示'}
            </button>
            <button
              aria-label="循环演示"
              aria-pressed={loopPresentation}
              title="开启后自动演示到末页会返回首页继续播放"
              onClick={() => {
                const next = !loopPresentation;
                setLoopPresentation(next);
                run(() =>
                  bridge.invoke('setSetting', 'loopPresentation', String(next)),
                );
              }}
            >
              循环{loopPresentation ? '：开' : '：关'}
            </button>
            <label>
              移动{' '}
              <select
                aria-label="演示移动时长"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[500, 1000, 1500, 2000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms / 1000} 秒
                  </option>
                ))}
              </select>
            </label>
            <label className="auto-hint">
              停留{' '}
              <select
                aria-label="自动演示停留时间"
                value={dwellTime}
                onChange={(e) => setDwellTime(Number(e.target.value))}
              >
                {[1000, 2000, 3000, 5000, 10000, 15000, 30000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms / 1000} 秒
                  </option>
                ))}
              </select>
            </label>
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
                setAutoPlay(false);
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
      {fileMenu && (
        <div
          className="file-menu-backdrop"
          onPointerDown={() => !menuPending && closeFileMenu()}
          onContextMenu={(event) => {
            event.preventDefault();
            setFileMenu(null);
          }}
        >
          <section
            ref={menuPanel}
            className="file-menu"
            role={fileMenu.mode === 'actions' ? 'menu' : 'dialog'}
            aria-label={`${fileMenu.node?.title || '根目录'} 操作`}
            style={{
              left: Math.max(8, fileMenu.x),
              top: Math.max(8, fileMenu.y),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const fields = [
                  ...event.currentTarget.querySelectorAll(
                    'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
                  ),
                ];
                if (!fields.length) return;
                const first = fields[0],
                  last = fields.at(-1);
                if (
                  event.shiftKey &&
                  root.ownerDocument.activeElement === first
                ) {
                  event.preventDefault();
                  last.focus();
                } else if (
                  !event.shiftKey &&
                  root.ownerDocument.activeElement === last
                ) {
                  event.preventDefault();
                  first.focus();
                }
              }
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (!menuPending) closeFileMenu();
              }
              if (
                fileMenu.mode !== 'actions' ||
                !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
              )
                return;
              event.preventDefault();
              const items = [
                ...event.currentTarget.querySelectorAll('[role="menuitem"]'),
              ];
              const index = items.indexOf(root.ownerDocument.activeElement);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (index +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }}
          >
            <div className="file-menu-heading">
              <span>{fileMenu.node?.title || '根目录'}</span>
              <small>
                {fileMenu.node?.kind === 'document' ? '白板' : '文件夹'}
              </small>
            </div>
            {fileMenu.mode === 'actions' &&
              (!fileMenu.node || fileMenu.node.kind === 'folder') && (
                <>
                  <button
                    role="menuitem"
                    onClick={() => {
                      create('document', fileMenu.node?.id || null);
                      setFileMenu(null);
                    }}
                  >
                    新建白板
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      create('folder', fileMenu.node?.id || null);
                      setFileMenu(null);
                    }}
                  >
                    新建文件夹
                  </button>
                </>
              )}
            {fileMenu.mode === 'actions' && fileMenu.node && (
              <>
                {fileMenu.node.kind === 'folder' && <hr />}
                <button role="menuitem" onClick={() => menuMode('rename')}>
                  重命名
                  <span className="menu-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button role="menuitem" onClick={() => menuMode('move')}>
                  移动到文件夹
                  <span className="menu-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <hr />
                <button
                  role="menuitem"
                  className="danger-action"
                  onClick={() => menuMode('trash')}
                >
                  移入回收站
                </button>
              </>
            )}
            {fileMenu.mode !== 'actions' && (
              <button
                className="menu-back"
                disabled={menuPending}
                onClick={() => menuMode('actions')}
              >
                ‹ 返回操作
              </button>
            )}
            {fileMenu.mode === 'rename' && fileMenu.node && (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = new ownerWindow.FormData(event.currentTarget)
                      .get('title')
                      .trim();
                    if (title)
                      performMenuAction(async () => {
                        await bridge.invoke('rename', fileMenu.node.id, title);
                        await refresh();
                        if (doc?.id === fileMenu.node.id)
                          setDoc({ ...doc, title });
                      });
                  }}
                >
                  <label>
                    重命名
                    <input
                      name="title"
                      aria-label="文件名称"
                      defaultValue={fileMenu.node.title}
                      maxLength={200}
                      required
                      disabled={menuPending}
                    />
                  </label>
                  <div className="menu-form-actions">
                    <button
                      type="button"
                      disabled={menuPending}
                      onClick={closeFileMenu}
                    >
                      取消
                    </button>
                    <button
                      className="primary-action"
                      type="submit"
                      disabled={menuPending}
                    >
                      保存名称
                    </button>
                  </div>
                </form>
              </>
            )}
            {fileMenu.mode === 'move' && fileMenu.node && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const parent =
                    new ownerWindow.FormData(event.currentTarget).get(
                      'parent',
                    ) || null;
                  performMenuAction(() => moveNode(fileMenu.node.id, parent));
                }}
              >
                <label>
                  移动到
                  <select
                    name="parent"
                    aria-label="移动到文件夹"
                    defaultValue={fileMenu.node.parent || ''}
                    disabled={menuPending}
                  >
                    <option value="">根目录</option>
                    {nodes
                      .filter(
                        (n) =>
                          n.kind === 'folder' &&
                          !n.deleted &&
                          canMoveTo(fileMenu.node, n),
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {folderPath(n)}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="menu-help">
                  只调整工作区目录，不移动磁盘上的关联文件。
                </p>
                <div className="menu-form-actions">
                  <button
                    type="button"
                    disabled={menuPending}
                    onClick={closeFileMenu}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="primary-action"
                    disabled={menuPending}
                  >
                    移动到此处
                  </button>
                </div>
              </form>
            )}
            {fileMenu.mode === 'trash' && (
              <div className="menu-confirm">
                <h3>移入回收站？</h3>
                <p>
                  可在工作区回收站恢复。磁盘上的关联文件不会被删除；非空文件夹需先移出内容。
                </p>
                <div className="menu-form-actions">
                  <button disabled={menuPending} onClick={closeFileMenu}>
                    取消
                  </button>
                  <button
                    className="danger-button"
                    disabled={menuPending}
                    onClick={() =>
                      performMenuAction(() => remove(fileMenu.node))
                    }
                  >
                    移入回收站
                  </button>
                </div>
              </div>
            )}
            {menuError && (
              <p className="menu-error" role="alert">
                {menuError}
              </p>
            )}
          </section>
        </div>
      )}
      {sceneDeletion && (
        <div
          className="modal-backdrop"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') setSceneDeletion(null);
            if (event.key === 'Tab') {
              event.preventDefault();
              const buttons = [
                ...event.currentTarget.querySelectorAll('button'),
              ];
              const index = buttons.indexOf(root.ownerDocument.activeElement);
              buttons[
                (index + (event.shiftKey ? -1 : 1) + buttons.length) %
                  buttons.length
              ]?.focus();
            }
          }}
        >
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="scene-delete-title"
            aria-describedby="scene-delete-description"
          >
            <h2 id="scene-delete-title">
              删除 {sceneDeletion.ids.length} 个场景？
            </h2>
            <p id="scene-delete-description">
              只删除所选场景的导航区域，不删除白板上的文字或图形。
            </p>
            <ul>
              {scenes
                .filter((scene) => sceneDeletion.ids.includes(scene.id))
                .slice(0, 5)
                .map((scene) => (
                  <li key={scene.id}>{scene.title}</li>
                ))}
            </ul>
            {sceneDeletion.ids.length > 5 && (
              <p>另有 {sceneDeletion.ids.length - 5} 个场景。</p>
            )}
            <div className="menu-form-actions">
              <button autoFocus onClick={() => setSceneDeletion(null)}>
                取消
              </button>
              <button
                className="danger-button"
                onClick={() => run(confirmSceneDeletion)}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
      {fileInfo && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>文件信息</h2>
            <p>
              文件位置：
              <span className="storage-path">
                {fileInfo.file ||
                  '尚未另存为独立文件，请使用“另存为”选择位置。'}
              </span>
            </p>
            <p>
              内容自动保存到本机工作区；手动保存同时记录当前视图，并写回已关联的文件。
            </p>
            <p>
              本机恢复副本：
              <span className="storage-path">{fileInfo.database}</span>
            </p>
            <button onClick={() => setFileInfo(null)}>关闭</button>
          </section>
        </div>
      )}
      {trash && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>回收站</h2>
            {!nodes.some((node) => node.deleted) && <p>回收站为空。</p>}
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
            {emptyTrashConfirm ? (
              <div
                className="menu-confirm"
                role="alertdialog"
                aria-label="确认清空回收站"
              >
                <h3>永久清空回收站？</h3>
                <p>
                  将删除 {nodes.filter((node) => node.deleted).length}{' '}
                  项及其历史版本，无法在回收站恢复。磁盘上的关联文件和已有备份保留。
                </p>
                <div className="menu-form-actions">
                  <button autoFocus onClick={() => setEmptyTrashConfirm(false)}>
                    取消清空
                  </button>
                  <button
                    className="danger-button"
                    onClick={() =>
                      run(async () => {
                        await bridge.invoke('emptyTrash');
                        setEmptyTrashConfirm(false);
                        await refresh();
                      })
                    }
                  >
                    确认永久清空
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger-button"
                disabled={!nodes.some((node) => node.deleted)}
                onClick={() => setEmptyTrashConfirm(true)}
              >
                清空回收站
              </button>
            )}
            <button
              onClick={() => {
                setEmptyTrashConfirm(false);
                setTrash(false);
              }}
            >
              关闭
            </button>
          </section>
        </div>
      )}
      {storageDialog && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>工作区保存位置</h2>
            <p>
              自动保存到本机 SQLite 工作区；另存为可选择完整白板文件的位置。
            </p>
            <p className="storage-path">{storageInfo?.database}</p>
            <p>
              自动备份：
              <span className="storage-path">{storageInfo?.backups}</span>
            </p>
            {storagePending ? (
              <>
                <p>已完整迁移，原位置保留。请重启使用新工作区。</p>
                <button onClick={() => run(() => bridge.invoke('restart'))}>
                  重启应用
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      manualSave();
                      setBusy(true);
                      try {
                        const result = await bridge.invoke('changeStorage');
                        if (result) {
                          setStoragePending(true);
                          setStorageInfo({
                            database: `${result.folder}/workspace.sqlite`,
                            backups: `${result.folder}/backups`,
                          });
                        } else setBusy(false);
                      } catch (e) {
                        setBusy(false);
                        throw e;
                      }
                    })
                  }
                >
                  更改工作区位置
                </button>
                <button disabled={busy} onClick={() => setStorageDialog(false)}>
                  关闭
                </button>
              </>
            )}
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
