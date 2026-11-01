import { translate as __ui } from './i18n.mjs';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  DefaultSidebar,
  MainMenu,
  CaptureUpdateAction,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
  getCommonBounds,
  newElementWith,
  restoreElements,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import { THEMES, themeId, themeStyle } from './themes.mjs';
import {
  sceneRange,
  selectedBinding,
  followScenes,
  cascadeScenes,
} from './scenes.mjs';
import { GitHubMark, ShellIcon, ThemePaletteIcon } from './ShellIcon.jsx';
import { sortNodes, SORT_MODES } from './tree.mjs';
import { parseVideo } from './videos.mjs';
import { parseEmbed, embedOrigins } from './embeds.mjs';
import { setLanguage, translate } from './i18n.mjs';
import { useDavConnection } from './useDavConnection.jsx';
import { FillDensity } from './FillDensity.jsx';
import { FILL_TYPES, densityOf } from './fill-density.mjs';
import { CanvasSearch } from './CanvasSearch.jsx';
import { LibraryActions } from './LibraryActions.jsx';
import { VideoEmbed, VideoControls } from './VideoLayer.jsx';
import { arrangeElements } from './arrange.mjs';
import { Settings } from './Settings.jsx';
import { CanvasTools } from './CanvasTools.jsx';
import {
  circularBalloons,
  balloonNumber,
  balloonSkeleton,
  resizedBalloon,
  restyledBalloon,
} from './balloons.mjs';
import { WebdavSettings } from './WebdavSettings.jsx';
import {
  overviewView,
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
function VideoIcon() {
  return (
    <svg
      width="20"
      height="20"
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
  );
}
function LayoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
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
  const defaults = {
    reduceMotion: false,
    wheelZoomStep: 5,
    fillDensityDefaults: {},
    startReadOnly: false,
    skipCascadeNotice: false,
    autoCheckUpdates: true,
    autoDownloadUpdates: false,
    updateChannel: 'stable',
    language: 'zh-CN',
  };
  const [preferences, setPreferences] = useState(defaults),
    [preferencesReady, setPreferencesReady] = useState(false),
    [settings, setSettings] = useState(false);
  useLayoutEffect(() => {
    setLanguage(preferences.language);
    root.ownerDocument.documentElement.lang =
      preferences.language === 'en' ? 'en' : 'zh-CN';
  }, [preferences.language]);
  useLayoutEffect(() => {
    root.ownerDocument.documentElement.dataset.wheelZoomStep = String(
      preferences.wheelZoomStep || 5,
    );
  }, [preferences.wheelZoomStep]);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const preferenceRef = useRef(preferences);
  preferenceRef.current = preferences;
  const [cascadeNotice, setCascadeNotice] = useState(null),
    [skipCascade, setSkipCascade] = useState(false);
  const sceneArchive = useRef(new Map()),
    sceneObserved = useRef(false);
  const [overview, setOverview] = useState(null);
  const changePreferences = (next) => {
    setLanguage(next.language);
    setPreferences(next);
    run(() =>
      bridge.invoke('setSetting', 'appPreferences', JSON.stringify(next)),
    );
  };
  const changeTheme = (id) => {
    setUITheme(id);
    setCanvasDark(THEMES[id].dark);
    run(() => bridge.invoke('setSetting', 'uiTheme', id));
  };
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
  const [status, setStatus] = useState(__ui('正在打开…')),
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
  const [sortMode, setSortMode] = useState('custom');
  const [treeDrop, setTreeDrop] = useState(null);
  const [davDialog, setDavDialog] = useState(false);
  const [approvedOrigins, setApprovedOrigins] = useState([]);
  const [consent, setConsent] = useState(null);
  const [libraryInstall, setLibraryInstall] = useState(null);
  const [toolbarOrder, setToolbarOrder] = useState([]);
  const [fillDensity, setFillDensity] = useState(100);
  const [fillSignal, setFillSignal] = useState('');
  const densityRef = useRef(100);
  densityRef.current = preferences.fillDensityDefaults || {};
  const rememberDensity = (next, types) => {
    setFillDensity(next);
    changePreferences({
      ...preferenceRef.current,
      fillDensityDefaults: {
        ...densityRef.current,
        ...Object.fromEntries(types.map((type) => [type, next])),
      },
    });
  };
  const pendingFillDefaults = useRef(new WeakMap());
  const tagFillDensity = (elements, state, editor) => {
    if (!editor) return;
    const born = state.newElement;
    if (born) {
      if (
        (densityRef.current[born.type] ?? 100) !== 100 &&
        FILL_TYPES.has(born.type)
      ) {
        const pending = pendingFillDefaults.current.get(editor) || new Map();
        pending.set(born.id, densityRef.current[born.type]);
        pendingFillDefaults.current.set(editor, pending);
      }
      return;
    }
    const pending = pendingFillDefaults.current.get(editor);
    if (
      !pending?.size ||
      state.resizingElement ||
      state.selectedElementsAreBeingDragged
    )
      return;
    const originDoc = active.current?.id;
    ownerWindow.requestAnimationFrame(() => {
      const currentState = editor.getAppState();
      if (
        active.current?.id !== originDoc ||
        currentState.newElement ||
        currentState.resizingElement ||
        currentState.selectedElementsAreBeingDragged
      )
        return;
      // Never replace native elements during pointer drawing. Excalidraw keeps
      // a mutable gesture reference; replacing it mid-gesture strands that
      // reference and leaves the zero-sized first frame in the scene.
      const all = editor.getSceneElementsIncludingDeleted();
      const changed = all.map((e) =>
        !e.isDeleted &&
        pending.has(e.id) &&
        e.customData?.localCanvasFillDensity === undefined
          ? newElementWith(e, {
              customData: {
                ...e.customData,
                localCanvasFillDensity: pending.get(e.id),
              },
            })
          : e,
      );
      pending.clear();
      if (changed.some((e, i) => e !== all[i]))
        editor.updateScene({
          elements: changed,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
    });
  };
  const [libraryItemsView, setLibraryItemsView] = useState([]);
  const searchInput = useRef(null);
  const {
    state: davState,
    online: davOnline,
    report: reportDav,
    check: checkDav,
  } = useDavConnection(bridge, ownerWindow);
  const [connectionMenu, setConnectionMenu] = useState(false);
  const connectionPanel = useRef(null);
  useEffect(() => {
    if (!connectionMenu) return;
    const close = (e) => {
      if (!connectionPanel.current?.contains(e.target))
        setConnectionMenu(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') setConnectionMenu(false);
    };
    root.ownerDocument.addEventListener('pointerdown', close);
    root.ownerDocument.addEventListener('keydown', key);
    return () => {
      root.ownerDocument.removeEventListener('pointerdown', close);
      root.ownerDocument.removeEventListener('keydown', key);
    };
  }, [connectionMenu]);
  const [videoDialog, setVideoDialog] = useState(false);
  const [videoURL, setVideoURL] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoView, setVideoView] = useState(null);
  const [videoPauseEpoch, setVideoPauseEpoch] = useState(0);
  const [balloon, setBalloon] = useState(false);
  const [nextBalloon, setNextBalloon] = useState(1);
  const balloonPointer = useRef(null),
    spacePressed = useRef(false);
  const [arrangeDialog, setArrangeDialog] = useState(false);
  const [arrangeMode, setArrangeMode] = useState('grid');
  const [arrangeGap, setArrangeGap] = useState(32);
  const [arrangeScene, setArrangeScene] = useState(false);
  const [arrangeIds, setArrangeIds] = useState([]);
  const [dropFolder, setDropFolder] = useState(undefined);
  const [widths, setWidths] = useState({
    left: 240,
    right: 230,
  });
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
    inkApi = useRef(null),
    inkStage = useRef(null);
  const presentationTimer = useRef(null);
  const inkStyle = useRef({
    currentItemStrokeColor: '#e03131',
    currentItemStrokeWidth: 2,
    currentItemOpacity: 100,
    currentItemBackgroundColor: 'transparent',
    currentItemRoughness: 1,
    currentItemStrokeStyle: 'solid',
    currentItemFillStyle: 'hachure',
  });
  const latest = useRef({});
  const clearInk = () => {
    inkApi.current?.updateScene({
      elements: [],
      appState: {
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    inkApi.current?.history.clear();
    setInkCount(0);
  };
  const renameScene = (id, value) => {
    const title = value.trim();
    if (title)
      updateScenes(
        scenes.map((s) =>
          s.id === id
            ? {
                ...s,
                title,
              }
            : s,
        ),
      );
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
  const pendingSave = useRef(null);
  const flush = () => {
    ownerWindow.clearTimeout(timer.current);
    if (pendingSave.current) return pendingSave.current.then(() => flush());
    if (!dirty.current || !active.current) return;
    const current = active.current,
      data = current.data;
    const finish = (revision) => {
      current.revision = revision;
      if (active.current === current && current.data === data)
        dirty.current = false;
      setStatus(
        dirty.current
          ? __ui('正在保存…')
          : bridge.kind === 'web'
            ? __ui('已保存到 NAS 工作区')
            : __ui('已保存到本机'),
      );
    };
    const fail = (e) => {
      setStatus(__ui('保存失败'));
      setError(e.message);
      throw e;
    };
    try {
      const result = bridge.save(current.id, data, current.revision);
      if (result?.then) {
        const task = result
          .then(finish)
          .catch(fail)
          .finally(() => {
            pendingSave.current = null;
          });
        pendingSave.current = task;
        return task;
      }
      finish(result);
    } catch (e) {
      fail(e);
    }
  };
  const changed = (data) => {
    if (!active.current) return;
    active.current.data = data;
    dirty.current = true;
    setStatus(__ui('正在保存…'));
    ownerWindow.clearTimeout(timer.current);
    timer.current = ownerWindow.setTimeout(() => {
      Promise.resolve()
        .then(flush)
        .catch(() => {});
    }, 500);
  };
  const manualSave = async (writeFile = true) => {
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
    await flush();
    if (
      writeFile &&
      (await bridge.saveFile(active.current.id, active.current.data))
    )
      setStatus(__ui('已保存到原文件'));
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
    await manualSave(false);
    const link = await bridge.invoke(
      'saveAsDocument',
      active.current.id,
      active.current.data,
    );
    if (link) setStatus(__ui('已另存为文件'));
  };
  const switchDoc = async (id) => {
    if (busy) return;
    if (active.current?.id === id && api.current) {
      await flush();
      setFolder(nodes.find((node) => node.id === id)?.parent || null);
      return;
    }
    setBusy(true);
    try {
      await flush();
      stop();
      setSelecting(null);
      setSelection(null);
      setSelectedScenes([]);
      sceneAnchor.current = null;
      setSceneMenu(null);
      setSceneDeletion(null);
      setExportMenu(false);
      setExportRegion(null);
      setBalloon(false);
      setOverview(null);
      sceneArchive.current.clear();
      sceneObserved.current = false;
      setCascadeNotice(null);
      setVideoView(null);
      const next = await bridge.invoke('read', id);
      const materialLibrary = await bridge.invoke('libraryRead', id);
      next.data.libraryItems = materialLibrary.libraryItems;
      await bridge.invoke('setEmbedOrigins', []);
      setApprovedOrigins([]);
      const origins = embedOrigins(next.data.elements);
      setConsent(origins.length ? origins : null);
      api.current = null;
      setEditorReady(false);
      setEditorEpoch((value) => value + 1);
      active.current = next;
      setNextBalloon(next.data.balloonNext || 1);
      setLibraryItemsView(next.data.libraryItems || []);
      dirty.current = false;
      setScenes(next.data.scenes);
      setDoc(next);
      setReadOnly(preferenceRef.current.startReadOnly);
      setFolder(next.parent || null);
      setStatus(
        bridge.kind === 'web'
          ? __ui('已保存到 NAS 工作区')
          : __ui('已保存到本机'),
      );
      await bridge.invoke('setSetting', 'activeDocument', id);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!bridge) {
      setError(
        __ui(
          '请运行桌面应用：先 npm run build，再 npm start。浏览器预览不具备本地存储接口。',
        ),
      );
      return;
    }
    run(async () => {
      const savedPrefs = await bridge.invoke('getSetting', 'appPreferences');
      try {
        const value = {
          ...defaults,
          ...JSON.parse(savedPrefs || '{}'),
        };
        setLanguage(value.language);
        preferenceRef.current = value;
        setPreferences(value);
      } catch {}
      setPreferencesReady(true);
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
      const sorting = await bridge.invoke('getSetting', 'treeSort');
      try {
        const order = JSON.parse(
          (await bridge.invoke('getSetting', 'toolbarOrder')) || '[]',
        );
        if (Array.isArray(order)) setToolbarOrder(order);
      } catch {}
      const davInfo = await bridge.invoke('webdavInfo');
      reportDav(davInfo ? 'configured' : 'unconfigured');
      if (SORT_MODES.includes(sorting)) setSortMode(sorting);
      if (Array.isArray(collapsed)) setCollapsedFolders(collapsed);
      const saved = await bridge.invoke('getSetting', 'activeDocument');
      setSidebar((await bridge.invoke('getSetting', 'sceneSidebar')) !== false);
      const id =
        list.find((n) => n.id === saved && !n.deleted)?.id ||
        list.find((n) => n.kind === 'document' && !n.deleted)?.id;
      if (id) await switchDoc(id);
      else setStatus(__ui('请创建白板'));
    });
    const close = (e) => {
      if (bridge.kind === 'web' && (dirty.current || pendingSave.current)) {
        Promise.resolve()
          .then(flush)
          .catch(() => {});
        e.preventDefault();
        e.returnValue = '';
        return;
      }
      try {
        /* sync desktop close */ flush();
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
          appState: {
            openDialog: null,
          },
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
        e.key.toLowerCase() === 'f' &&
        !presentation.current
      ) {
        e.preventDefault();
        e.stopPropagation();
        setFileSidebar(true);
        ownerWindow.requestAnimationFrame(() => searchInput.current?.focus());
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
      Promise.resolve()
        .then(flush)
        .catch(() => {});
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
  useEffect(() => {
    if (
      !preferencesReady ||
      !preferences.autoCheckUpdates ||
      bridge.kind === 'web'
    )
      return;
    let cancelled = false;
    const check = async () => {
      try {
        const info = await bridge.invoke(
          'checkUpdates',
          preferenceRef.current.updateChannel,
        );
        if (!cancelled && info.status === 'available') {
          setUpdateAvailable(info.candidate.version);
          if (
            info.candidate?.asset &&
            preferenceRef.current.autoDownloadUpdates
          )
            await bridge.invoke('downloadUpdate');
        }
      } catch {}
    };
    const timeout = ownerWindow.setTimeout(check, 5000),
      interval = ownerWindow.setInterval(check, 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      ownerWindow.clearTimeout(timeout);
      ownerWindow.clearInterval(interval);
    };
  }, [
    preferencesReady,
    preferences.autoCheckUpdates,
    preferences.autoDownloadUpdates,
    preferences.updateChannel,
  ]);
  const updateScenes = (next) => {
    setScenes(next);
    setSelectedScenes((ids) =>
      ids.filter((id) => next.some((scene) => scene.id === id)),
    );
    changed({
      ...active.current.data,
      scenes: next,
    });
  };
  const addScene = (rect) => {
    if (selecting && selecting !== 'new')
      updateScenes(
        scenes.map((s) => {
          if (s.id !== selecting) return s;
          const { binding, ...fixed } = s;
          return {
            ...fixed,
            rect,
          };
        }),
      );
    else
      updateScenes([
        ...scenes,
        {
          id: ownerWindow.crypto.randomUUID(),
          title: '' + __ui('场景 ') + (scenes.length + 1),
          rect,
        },
      ]);
    setSelecting(null);
    setSelection(null);
  };
  const navigate = (scene) => {
    if (!api.current) return;
    setVideoPauseEpoch((value) => value + 1);
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
          preferenceRef.current.reduceMotion
            ? 1
            : (now - began) / (presentation.current ? duration : 500),
        ),
        v = interpolate(from, to, t);
      api.current?.updateScene({
        appState: {
          scrollX: v.scrollX,
          scrollY: v.scrollY,
          zoom: {
            value: v.zoom,
          },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      inkApi.current?.updateScene({
        appState: {
          scrollX: v.scrollX,
          scrollY: v.scrollY,
          zoom: {
            value: v.zoom,
          },
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
      api.current.setActiveTool({
        type: 'selection',
      });
      setStatus(__ui('先在画布选中元素或组合，再点“选择元素”添加场景'));
      return;
    }
    const scene = {
      id: ownerWindow.crypto.randomUUID(),
      title: '' + __ui('元素场景 ') + (scenes.length + 1),
      rect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
      binding,
    };
    updateScenes(followScenes([...scenes, scene], elements, getCommonBounds));
  };
  const toggleBalloon = () => {
    if (!api.current || readOnly || presenting) return;
    const enabled = !balloon;
    setBalloon(enabled);
    api.current.setActiveTool(
      enabled
        ? {
            type: 'ellipse',
            locked: true,
          }
        : {
            type: 'selection',
          },
    );
    api.current.updateScene({
      appState: {
        selectedElementIds: {},
        selectedGroupIds: {},
        activeEmbeddable: null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };
  const setBalloonNumber = (value) => {
    setNextBalloon(value);
    try {
      const number = balloonNumber(value);
      changed({
        ...active.current.data,
        balloonNext: number,
      });
    } catch {}
  };
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space') spacePressed.current = true;
      if (e.key === 'Escape' && balloon) {
        setBalloon(false);
        balloonPointer.current = null;
        api.current?.setActiveTool({
          type: 'selection',
        });
      }
    };
    const up = (e) => {
      if (e.code === 'Space') spacePressed.current = false;
    };
    const blur = () => {
      spacePressed.current = false;
      balloonPointer.current = null;
    };
    ownerWindow.addEventListener('keydown', down, true);
    ownerWindow.addEventListener('keyup', up, true);
    ownerWindow.addEventListener('blur', blur);
    return () => {
      ownerWindow.removeEventListener('keydown', down, true);
      ownerWindow.removeEventListener('keyup', up, true);
      ownerWindow.removeEventListener('blur', blur);
    };
  }, [balloon]);
  const placeBalloon = (event) => {
    const began = balloonPointer.current;
    if (!began || began.id !== event.pointerId) return;
    balloonPointer.current = null;
    event.preventDefault();
    event.stopPropagation();
    if (
      Math.hypot(event.clientX - began.x, event.clientY - began.y) > 6 ||
      !api.current ||
      readOnly ||
      presenting
    )
      return;
    run(() => {
      const number = balloonNumber(nextBalloon),
        state = api.current.getAppState();
      const point = viewportCoordsToSceneCoords(event, state);
      const added = circularBalloons(
        convertToExcalidrawElements([
          {
            ...balloonSkeleton(
              point,
              state,
              number,
              active.current.data.balloonSize,
            ),
            customData: {
              localCanvasBalloon: true,
              localCanvasFillDensity: densityRef.current.balloon ?? 100,
            },
          },
        ]),
        point,
      );
      const group = ownerWindow.crypto.randomUUID();
      const members = added.map((el) =>
        newElementWith(el, {
          groupIds: [group],
          ...(el.type === 'ellipse'
            ? {
                customData: {
                  ...el.customData,
                  localCanvasBalloon: true,
                },
              }
            : {}),
        }),
      );
      const following = number === 999999 ? number : number + 1;
      // Write metadata before the editor callback serializes the same insertion.
      active.current.data = {
        ...active.current.data,
        balloonNext: following,
      };
      setNextBalloon(following);
      api.current.updateScene({
        elements: [
          ...api.current.getSceneElementsIncludingDeleted(),
          ...members,
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
  };
  const openArrange = () => {
    if (!api.current || readOnly || presenting) return;
    setBalloon(false);
    setArrangeIds(
      selectedBinding(api.current.getSceneElements(), api.current.getAppState())
        .elementIds,
    );
    setArrangeDialog(true);
  };
  const applyArrange = () =>
    run(() => {
      if (!api.current || readOnly || presenting) return;
      const original = api.current.getSceneElementsIncludingDeleted();
      const result = arrangeElements(
        original,
        arrangeIds,
        arrangeMode,
        Number(arrangeGap),
        getCommonBounds,
      );
      if (original.some((el) => result.moves.has(el.id) && el.locked))
        throw new Error(__ui('所选元素或组合包含锁定元素，请先解锁'));
      const elements = original.map((el) =>
        result.moves.has(el.id)
          ? newElementWith(el, result.moves.get(el.id))
          : el,
      );
      api.current.updateScene({
        elements,
        appState: {
          selectedElementIds: Object.fromEntries(
            result.ids.map((id) => [id, true]),
          ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      if (arrangeScene) {
        const scene = {
          id: ownerWindow.crypto.randomUUID(),
          title: '' + __ui('元素场景 ') + (scenes.length + 1),
          rect: {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
          binding: {
            elementIds: result.ids,
            groupIds: [],
          },
        };
        updateScenes(
          followScenes(
            [...active.current.data.scenes, scene],
            elements,
            getCommonBounds,
          ),
        );
      }
      setArrangeDialog(false);
      setStatus(
        '' +
          __ui('已整理 ') +
          result.unitCount +
          __ui(' 个元素或组合') +
          (arrangeScene ? '并添加到演示列表' : ''),
      );
    });
  const rebuildSceneBinding = (id) => {
    if (!api.current || !active.current) return;
    stop();
    const elements = api.current.getSceneElements();
    const binding = selectedBinding(elements, api.current.getAppState());
    setSceneMenu(null);
    if (!binding.elementIds.length) {
      setStatus(__ui('先在画布选中元素或组合，再右键场景选择“重建跟随”'));
      return;
    }
    updateScenes(
      followScenes(
        scenes.map((scene) =>
          scene.id === id
            ? {
                ...scene,
                binding,
              }
            : scene,
        ),
        elements,
        getCommonBounds,
      ),
    );
    setStatus(__ui('已按当前所选元素或组合重建场景跟随'));
  };
  const exitPresentation = async () => {
    setVideoPauseEpoch((value) => value + 1);
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
    middleClick.current = {
      time: now,
      x: event.clientX,
      y: event.clientY,
    };
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
      const fitAll = () => {
        const state = api.current.getAppState();
        const side =
          !presentation.current &&
          stage.current?.querySelector('.default-sidebar');
        const availableWidth = Math.max(
          1,
          state.width - (side ? side.getBoundingClientRect().width : 0),
        );
        const view = overviewView(
          getCommonBounds(elements),
          availableWidth,
          state.height,
        );
        if (!view) return;
        api.current.updateScene({
          appState: view,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        inkApi.current?.updateScene({
          appState: view,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      };
      if (presentation.current) {
        fitAll();
        return;
      }
      if (overview) {
        const state = api.current.getAppState(),
          point = viewportCoordsToSceneCoords(event, state),
          zoom = overview.zoom;
        const view = {
          zoom: {
            value: zoom,
          },
          scrollX: state.width / (2 * zoom) - point.x,
          scrollY: state.height / (2 * zoom) - point.y,
        };
        api.current.updateScene({
          appState: view,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        api.current.setActiveTool({
          type: 'selection',
        });
        setOverview(null);
        return;
      }
      setOverview({
        zoom: api.current.getAppState().zoom.value,
      });
      setBalloon(false);
      api.current.setActiveTool({
        type: 'hand',
      });
      fitAll();
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
  const finishSceneDrag = () => {
    const id = drag.current,
      position = dropPosition.current;
    drag.current = null;
    markDrop(null);
    if (!id || position === null) return;
    const source = scenes.find((s) => s.id === id),
      from = scenes.findIndex((s) => s.id === id);
    if (!source) return;
    const next = scenes.filter((s) => s.id !== id),
      index = position - (from < position ? 1 : 0);
    if (index !== from) {
      next.splice(index, 0, source);
      updateScenes(next);
    }
  };
  latest.current = {
    exitPresentation,
    step,
    manualSave,
    saveAs,
    finishSceneDrag,
  };
  useEffect(() => {
    // Completing a drag at the window also covers native fullscreen transitions
    // and a captured handle being re-rendered while the layers panel changes.
    const finish = () => {
      if (drag.current) latest.current.finishSceneDrag();
    };
    const cancel = () => {
      drag.current = null;
      markDrop(null);
    };
    ownerWindow.addEventListener('pointerup', finish, true);
    ownerWindow.addEventListener('pointercancel', cancel, true);
    return () => {
      ownerWindow.removeEventListener('pointerup', finish, true);
      ownerWindow.removeEventListener('pointercancel', cancel, true);
    };
  }, []);
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
      throw new Error(__ui('编辑器尚未准备好，请重新选择白板后重试'));
    await flush();
    setOverview(null);
    setBalloon(false);
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
    if (presenting && pen) {
      inkApi.current?.setActiveTool({
        type: 'freedraw',
        locked: true,
      });
      inkStage.current?.focus();
    }
  }, [presenting, pen]);
  const toggleSidebar = () => {
    setSidebar(!sidebar);
    run(() => bridge.invoke('setSetting', 'sceneSidebar', !sidebar));
  };
  const exportPDF = async (byScenes) => {
    await flush();
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
    await flush();
    stop();
    setBusy(true);
    try {
      const options = exportOptions(active.current.data, exportRegion);
      let value;
      if (format === 'svg') value = (await exportToSvg(options)).outerHTML;
      else {
        const blob = await exportToBlob({
          ...options,
          mimeType: 'image/png',
        });
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
    setForm({
      title,
      value,
      submit,
      options,
    });
  const create = (kind, parent = folder) =>
    ask(
      kind === 'folder' ? __ui('新建文件夹') : __ui('新建白板'),
      '',
      async (title) => {
        await flush();
        const id = await bridge.invoke('create', kind, parent, title);
        await refresh();
        if (kind === 'document') await switchDoc(id);
      },
    );
  const move = (node) =>
    ask(
      __ui('移动到文件夹'),
      node.parent || '',
      async (parent) => {
        await bridge.invoke('move', node.id, parent || null);
        await refresh();
      },
      [
        {
          id: '',
          title: __ui('根目录'),
        },
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
    setFileMenu({
      ...fileMenu,
      mode,
    });
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
    await flush();
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
      aria-label={side === 'left' ? __ui('左侧栏宽度') : __ui('右侧栏宽度')}
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
        widthRef.current = {
          ...widthRef.current,
          [side]: value,
        };
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
        widthRef.current = {
          ...widthRef.current,
          [side]: value,
        };
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
    sortNodes(
      nodes.filter((n) => n.parent === parent && !n.deleted),
      sortMode,
    ).map((n) => (
      <React.Fragment key={n.id}>
        <div
          className={`tree-row ${n.kind === 'folder' ? 'folder-row' : ''} ${doc?.id === n.id ? 'active' : ''} ${activeAncestors.has(n.id) ? 'folder-selected' : ''} ${dropFolder === n.id ? 'drop-target' : ''} ${treeDrop?.id === n.id ? `tree-drop-${treeDrop.edge}` : ''}`}
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
            setTreeDrop(null);
            setDropFolder(undefined);
          }}
          onDragOver={(event) => {
            const source = nodes.find((node) => node.id === fileDrag.current);
            const box = event.currentTarget.getBoundingClientRect();
            if (
              sortMode === 'custom' &&
              source &&
              source.id !== n.id &&
              source.parent === n.parent &&
              (n.kind !== 'folder' ||
                event.clientY - box.top < 9 ||
                box.bottom - event.clientY < 9)
            ) {
              event.preventDefault();
              setDropFolder(undefined);
              setTreeDrop({
                id: n.id,
                edge:
                  event.clientY < box.top + box.height / 2 ? 'before' : 'after',
              });
              return;
            }
            setTreeDrop(null);
            if (fileDrag.current && n.kind === 'folder') {
              event.preventDefault();
              setDropFolder(n.id);
            }
          }}
          onDrop={(event) => {
            if (treeDrop?.id === n.id) {
              event.preventDefault();
              event.stopPropagation();
              const ids = sortNodes(
                nodes.filter((v) => v.parent === n.parent && !v.deleted),
                'custom',
              )
                .map((v) => v.id)
                .filter((id) => id !== fileDrag.current);
              ids.splice(
                ids.indexOf(n.id) + (treeDrop.edge === 'after' ? 1 : 0),
                0,
                fileDrag.current,
              );
              fileDrag.current = null;
              setTreeDrop(null);
              run(async () => {
                await bridge.invoke('reorder', n.parent, ids);
                await refresh();
              });
              return;
            }
            if (n.kind === 'folder') dropOn(event, n.id);
          }}
        >
          {Array.from(
            {
              length: depth,
            },
            (_, level) => (
              <span
                key={level}
                className="tree-guide"
                style={{
                  left: 21 + level * 28,
                }}
                aria-hidden="true"
              />
            ),
          )}
          {n.kind !== 'folder' && (
            <span className="tree-toggle-spacer" aria-hidden="true" />
          )}
          {n.kind === 'folder' && (
            <button
              className="folder-toggle"
              aria-label={`${collapsedFolders.includes(n.id) ? __ui('展开') : __ui('收起')} ${n.title}`}
              aria-expanded={!collapsedFolders.includes(n.id)}
              disabled={
                !nodes.some((child) => child.parent === n.id && !child.deleted)
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
            title={n.title}
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
            <span className="node-name">{n.title}</span>
          </button>
          <button
            title={__ui('操作')}
            aria-label={'' + n.title + __ui(' 操作')}
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
    await flush();
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
  const approveOrigins = async (origins) => {
    const next = [...new Set([...approvedOrigins, ...origins])];
    await bridge.invoke('setEmbedOrigins', next);
    setApprovedOrigins(next);
    setConsent(null);
  };
  const importLibrary = async (value) => {
    if (!api.current) return;
    const file = value || (await bridge.invoke('importLibrary'));
    if (file)
      await api.current.updateLibrary({
        libraryItems: new Blob([JSON.stringify(file)], {
          type: 'application/json',
        }),
        merge: true,
        openLibraryMenu: true,
      });
  };
  const browseLibraries = () => run(() => bridge.invoke('openLibraries'));
  useEffect(() => {
    const timer = ownerWindow.setInterval(() => {
      if (!active.current || libraryInstall) return;
      bridge
        .invoke('pendingLibrary')
        .then((value) => {
          if (value) setLibraryInstall(value);
        })
        .catch(() => {});
    }, 1200);
    return () => ownerWindow.clearInterval(timer);
  }, [libraryInstall]);
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
          <button
            className="logo-settings"
            aria-label={__ui('打开设置')}
            title={__ui('设置')}
            onClick={() => setSettings(true)}
          >
            <img
              className="logo"
              src="./app-icon.png"
              alt={__ui('Canvas 标志')}
            />
            {updateAvailable && (
              <span
                className="update-dot"
                title={'' + __ui('有可用更新 ') + updateAvailable}
                aria-hidden="true"
              />
            )}
          </button>
          <div>
            Local Canvas
            <small>
              {__ui('本地无限画布 \xB7 v')}
              {import.meta.env.VITE_APP_VERSION || '0.4.1'}
            </small>
          </div>
        </div>
        <div className="section-title">
          {__ui('工作区')}{' '}
          <div className="connection-status" ref={connectionPanel}>
            <button
              className="network-status"
              aria-label={__ui('连接状态')}
              aria-expanded={connectionMenu}
              onClick={() => {
                setConnectionMenu(!connectionMenu);
                if (!connectionMenu) checkDav();
              }}
            >
              <i className={davOnline ? 'online' : ''} aria-hidden="true" />
              {davOnline ? __ui('在线') : __ui('离线')}
            </button>
            {connectionMenu && (
              <section
                className="connection-popover"
                aria-label={__ui('连接详情')}
              >
                <strong>{__ui('连接状态')}</strong>
                <p>
                  {davOnline ? __ui('WebDAV 已连接') : __ui('WebDAV 未连接')}
                </p>
                <p>
                  {__ui(
                    {
                      unconfigured: 'WebDAV 未配置',
                      configured: 'WebDAV 已配置，尚未验证连接',
                      transferring: 'WebDAV 正在传输',
                      success: 'WebDAV 最近连接成功',
                      error: 'WebDAV 最近操作失败',
                    }[davState.status],
                  )}
                </p>
                {davState.time && <small>{davState.time}</small>}
                <p>
                  {__ui(
                    '状态按 WebDAV 实际连接验证，约每分钟复查。立即同步上传完整备份，不进行双向合并或覆盖。',
                  )}
                </p>
                <button
                  disabled={
                    davState.status === 'unconfigured' ||
                    davState.status === 'transferring'
                  }
                  onClick={() =>
                    run(async () => {
                      reportDav('transferring');
                      try {
                        await bridge.invoke('webdavTest');
                        reportDav('success');
                      } catch (e) {
                        reportDav('error');
                        throw e;
                      }
                    })
                  }
                >
                  {__ui('测试连接')}
                </button>
                <button
                  disabled={
                    davState.status === 'unconfigured' ||
                    davState.status === 'transferring'
                  }
                  onClick={() =>
                    run(async () => {
                      reportDav('transferring');
                      try {
                        await flush();
                        await bridge.invoke('webdavBackup');
                        reportDav('success');
                      } catch (e) {
                        reportDav('error');
                        throw e;
                      }
                    })
                  }
                >
                  {__ui('立即同步（上传备份）')}
                </button>
                <button
                  onClick={() => {
                    setConnectionMenu(false);
                    setSettings(true);
                  }}
                >
                  {__ui('打开设置')}
                </button>
              </section>
            )}
          </div>
        </div>
        <div className="actions">
          <button
            className="workspace-save"
            title={__ui('保存内容与当前视图（Cmd/Ctrl+S）')}
            disabled={!doc || busy}
            onClick={() => run(manualSave)}
          >
            {__ui('保存 ')}
          </button>
          <button disabled={!doc || busy} onClick={() => run(saveAs)}>
            {__ui('另存为 ')}
          </button>
        </div>
        <button
          className="open-document"
          onClick={() =>
            run(async () => {
              await flush();
              const id = await bridge.invoke('openDocument', folder);
              await refresh();
              if (id) await switchDoc(id);
            })
          }
        >
          {__ui('打开文件… ')}
        </button>
        <CanvasSearch
          api={api}
          elements={videoView?.elements || []}
          disabled={!doc || presenting}
          inputRef={searchInput}
          documentId={doc?.id}
        />
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
          title={__ui('右键新建白板或文件夹；拖入此处移回根目录')}
        >
          <ShellIcon name="home" theme={uiTheme} size={18} />
          {__ui(' 根目录 ')}
        </button>
        <label className="tree-sort">
          {__ui('目录排序 ')}
          <select
            aria-label={__ui('目录排序')}
            value={sortMode}
            onChange={(e) => {
              const value = e.target.value;
              setSortMode(value);
              run(() => bridge.invoke('setSetting', 'treeSort', value));
            }}
          >
            <option value="custom">{__ui('自定义（拖拽排序）')}</option>
            <option value="name">{__ui('名称 A–Z')}</option>
            <option value="created">{__ui('创建时间（从早到晚）')}</option>
          </select>
        </label>
        <div className="tree">{tree()}</div>
        <details className="workspace-tools">
          <summary>{__ui('工作区管理')}</summary>
          <div className="file-tools">
            <button onClick={() => setStorageDialog(true)}>
              {__ui('保存位置')}
            </button>
            <button
              onClick={() =>
                run(async () => {
                  await flush();
                  const id = await bridge.invoke('importDocument', folder);
                  await refresh();
                  if (id) await switchDoc(id);
                })
              }
            >
              {__ui('导入文档 ')}
            </button>
            <button onClick={() => setTrash(!trash)}>{__ui('回收站')}</button>
            <button
              onClick={() =>
                run(async () => {
                  await flush();
                  await bridge.invoke('backup');
                })
              }
            >
              {__ui('备份工作区 ')}
            </button>
            <button
              onClick={() =>
                run(async () => {
                  await flush();
                  await bridge.invoke('restore');
                  await refresh();
                })
              }
            >
              {__ui('恢复备份 ')}
            </button>
          </div>
        </details>
      </aside>
      <main>
        <header>
          <button
            className="left-panel-toggle"
            aria-label={fileSidebar ? __ui('隐藏文件栏') : __ui('显示文件栏')}
            title={fileSidebar ? __ui('隐藏文件栏') : __ui('显示文件栏')}
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
            <strong>{doc?.title || __ui('选择或创建一张白板')}</strong>
            <span className="save-state">{translate(status)}</span>
          </div>
          <div className="header-actions">
            {doc && (
              <button
                className="arrange-trigger"
                disabled={!editorReady || presenting || readOnly}
                onClick={() => openArrange()}
                title={__ui('框选后自动等距整理')}
              >
                <LayoutIcon />
                {__ui('自动整理 ')}
              </button>
            )}
            {doc && (
              <button
                className="file-info-button"
                onClick={() =>
                  run(async () =>
                    setFileInfo(await bridge.invoke('fileInfo', doc.id)),
                  )
                }
              >
                {__ui('文件信息 ')}
              </button>
            )}
            {doc && (
              <button
                className="file-info-button"
                disabled={!editorReady || presenting}
                aria-pressed={readOnly}
                title={__ui(
                  '画布只读：禁止移动、编辑和删除全部元素；仍可平移缩放',
                )}
                onClick={() => {
                  stop();
                  setReadOnly(!readOnly);
                }}
              >
                {readOnly ? __ui('解除只读') : __ui('画布只读')}
              </button>
            )}
            <label className="theme-picker">
              <ThemePaletteIcon />
              <select
                aria-label={__ui('界面主题')}
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
            {translate(error)}
            <button onClick={() => run(flush)}>{__ui('重试保存')}</button>
            {active.current && (
              <button
                onClick={() =>
                  run(() =>
                    bridge.invoke(
                      'exportDocument',
                      active.current.id,
                      active.current.data,
                      false,
                    ),
                  )
                }
              >
                {__ui('导出未保存副本 ')}
              </button>
            )}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
        <div
          className={`canvas ${balloon ? 'balloon-mode' : ''}`}
          ref={stage}
          onClickCapture={(e) => {
            if (
              balloon &&
              e.target.closest('.App-toolbar') &&
              !e.target.closest('.canvas-number-tool')
            ) {
              setBalloon(false);
              balloonPointer.current = null;
            }
          }}
          onContextMenuCapture={(e) => {
            if (
              !overview ||
              presenting ||
              e.target.closest(
                'button,input,select,textarea,a,.layer-ui__wrapper',
              )
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setOverview(null);
            middleClick.current = null;
            api.current?.setActiveTool({ type: 'selection' });
          }}
          onPointerDownCapture={(e) => {
            if (
              overview &&
              !presenting &&
              e.button === 2 &&
              !e.target.closest(
                'button,input,select,textarea,a,.layer-ui__wrapper',
              )
            ) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (e.target.closest('canvas')) stop();
            fitOnMiddleDoubleClick(e);
            if (
              !balloon ||
              presenting ||
              readOnly ||
              e.button !== 0 ||
              spacePressed.current ||
              e.ctrlKey ||
              e.metaKey ||
              e.altKey ||
              e.target.closest(
                'button,input,select,textarea,a,.layer-ui__wrapper,.excalidraw-textEditorContainer',
              )
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            balloonPointer.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
            };
          }}
          onPointerUpCapture={placeBalloon}
          onPointerCancelCapture={() => {
            balloonPointer.current = null;
          }}
          onWheelCapture={stop}
          onKeyDownCapture={stop}
        >
          {doc ? (
            <Excalidraw
              key={`${doc.id}:${editorEpoch}`}
              langCode={preferences.language === 'en' ? 'en' : 'zh-CN'}
              showDeprecatedFonts
              validateEmbeddable={(link) => !!parseEmbed(link)}
              renderEmbeddable={(element) =>
                parseEmbed(element.link) ? (
                  <VideoEmbed
                    link={element.link}
                    pauseEpoch={videoPauseEpoch}
                    bridge={bridge}
                    allowed={approvedOrigins.includes(
                      parseEmbed(element.link)?.origin,
                    )}
                    requestConsent={(origin) => setConsent([origin])}
                  />
                ) : null
              }
              theme={canvasDark ? 'dark' : 'light'}
              UIOptions={{
                dockedSidebarBreakpoint: 0,
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
                appState: {
                  ...doc.data.appState,
                  collaborators: new Map(),
                },
                scrollToContent: false,
              }}
              onLibraryChange={(libraryItems) => {
                setLibraryItemsView(libraryItems);
                bridge
                  .invoke('librarySave', libraryItems)
                  .catch((e) => setError(e.message));
                if (active.current?.id === doc.id)
                  changed({
                    ...active.current.data,
                    libraryItems,
                  });
              }}
              onChange={(elements, appState, files) => {
                setFillSignal(
                  appState.activeTool.type +
                    '|' +
                    Object.keys(appState.selectedElementIds).join(',') +
                    elements
                      .filter((e) => appState.selectedElementIds[e.id])
                      .map((e) => densityOf(e))
                      .join(','),
                );
                tagFillDensity(elements, appState, api.current);
                if (
                  !appState.viewModeEnabled &&
                  !appState.newElement &&
                  !appState.isResizing &&
                  !appState.resizingElement &&
                  !appState.selectedElementsAreBeingDragged &&
                  elements.some(
                    (e) =>
                      !e.isDeleted &&
                      e.type === 'ellipse' &&
                      e.customData?.localCanvasBalloon &&
                      Math.abs(e.width - e.height) > 1e-6,
                  )
                ) {
                  const editor = api.current,
                    documentId = doc.id;
                  ownerWindow.requestAnimationFrame(() => {
                    if (
                      !editor ||
                      api.current !== editor ||
                      active.current?.id !== documentId
                    )
                      return;
                    const current = editor.getAppState();
                    if (
                      current.viewModeEnabled ||
                      current.newElement ||
                      current.isResizing ||
                      current.resizingElement ||
                      current.selectedElementsAreBeingDragged
                    )
                      return;
                    const original = editor.getSceneElementsIncludingDeleted(),
                      rounded = circularBalloons(original);
                    if (rounded.some((e, i) => e !== original[i]))
                      editor.updateScene({
                        elements: rounded.map((e, i) =>
                          e === original[i]
                            ? e
                            : newElementWith(original[i], e),
                        ),
                        captureUpdate: CaptureUpdateAction.NEVER,
                      });
                  });
                }
                if (active.current?.id === doc.id) {
                  const videos = elements;
                  const next = {
                    elements: videos,
                    state: {
                      scrollX: appState.scrollX,
                      scrollY: appState.scrollY,
                      zoom: appState.zoom,
                      width: appState.width,
                      height: appState.height,
                      activeEmbeddable: appState.activeEmbeddable,
                    },
                  };
                  setVideoView((previous) =>
                    (!videos.length && !previous?.elements.length) ||
                    (previous?.elements === elements &&
                      previous?.state.scrollX === appState.scrollX &&
                      previous?.state.scrollY === appState.scrollY &&
                      previous?.state.zoom.value === appState.zoom.value &&
                      previous?.state.width === appState.width &&
                      previous?.state.height === appState.height &&
                      previous?.state.activeEmbeddable ===
                        appState.activeEmbeddable)
                      ? previous
                      : next,
                  );
                }
                if (balloon && appState.activeTool.type !== 'ellipse')
                  setBalloon(false);
                if (presentation.current || storagePending) return;
                if (active.current?.id !== doc.id) return;
                const data = JSON.parse(
                  serializeAsJSON(elements, appState, files, 'local'),
                );
                data.appState = {
                  ...data.appState,
                  scrollX: active.current.data.appState.scrollX ?? 0,
                  scrollY: active.current.data.appState.scrollY ?? 0,
                  zoom: active.current.data.appState.zoom ?? {
                    value: 1,
                  },
                };
                const previous = active.current.data;
                const size =
                  resizedBalloon(previous.elements, elements, appState) ||
                  restyledBalloon(previous.elements, elements, appState);
                const cascade = sceneObserved.current
                  ? cascadeScenes(
                      previous.scenes,
                      previous.elements,
                      elements,
                      sceneArchive.current,
                    )
                  : {
                      scenes: previous.scenes,
                      deleted: [],
                    };
                sceneObserved.current = true;
                const next = {
                  ...previous,
                  ...(size
                    ? {
                        balloonSize: size,
                      }
                    : {}),
                  elements: data.elements,
                  appState: data.appState,
                  files: data.files || files,
                  scenes: followScenes(
                    cascade.scenes,
                    elements,
                    getCommonBounds,
                  ),
                };
                if (
                  cascade.deleted.length &&
                  !preferenceRef.current.skipCascadeNotice
                ) {
                  setSkipCascade(false);
                  setCascadeNotice(cascade.deleted.map((s) => s.title));
                }
                if (next.scenes !== active.current.data.scenes)
                  setScenes(next.scenes);
                if (
                  JSON.stringify(next) !== JSON.stringify(active.current.data)
                )
                  changed(next);
              }}
            >
              <DefaultSidebar docked onDock={false} />
              <MainMenu>
                <MainMenu.DefaultItems.LoadScene />
                <MainMenu.DefaultItems.Help />
                <MainMenu.DefaultItems.ClearCanvas />
                <MainMenu.Item
                  icon={<VideoIcon />}
                  onSelect={() => {
                    setVideoError('');
                    setVideoURL('');
                    setVideoDialog(true);
                  }}
                >
                  {__ui('嵌入网页 / 视频 ')}
                </MainMenu.Item>
                <MainMenu.Item
                  icon={<LayoutIcon />}
                  onSelect={() => openArrange()}
                >
                  {__ui('自动整理元素 ')}
                </MainMenu.Item>
                <MainMenu.Separator />
                <MainMenu.ItemLink
                  icon={<GitHubMark />}
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
              <h1>{__ui('把想法放在同一张画布上')}</h1>
              <p>{__ui('创建白板，自由绘制，再用场景整理你的思路。')}</p>
              <button onClick={() => create('document')}>
                {__ui('创建第一张白板')}
              </button>
            </div>
          )}
          {doc && (
            <CanvasTools
              stage={stage}
              order={toolbarOrder}
              onOrderChange={(order) => {
                setToolbarOrder(order);
                run(() =>
                  bridge.invoke(
                    'setSetting',
                    'toolbarOrder',
                    JSON.stringify(order),
                  ),
                );
              }}
              balloon={balloon}
              toggleBalloon={toggleBalloon}
              nextNumber={nextBalloon}
              setNextNumber={setBalloonNumber}
              disabled={presenting || readOnly}
              openVideo={() => {
                setVideoError('');
                setVideoURL('');
                setVideoDialog(true);
              }}
            />
          )}
          {doc && (
            <FillDensity
              stage={stage}
              api={api}
              value={fillDensity}
              defaults={preferences.fillDensityDefaults}
              setValue={rememberDensity}
              signal={fillSignal}
            />
          )}
          {presenting && pen && (
            <FillDensity
              stage={inkStage}
              api={inkApi}
              value={fillDensity}
              defaults={preferences.fillDensityDefaults}
              setValue={rememberDensity}
              signal={fillSignal}
              ink
            />
          )}
          {doc && (
            <LibraryActions
              stage={stage}
              api={api}
              bridge={bridge}
              items={libraryItemsView}
              documentId={doc.id}
              onError={setError}
              browse={browseLibraries}
              load={() => run(() => importLibrary())}
            />
          )}
          {doc && (
            <VideoControls
              state={videoView?.state}
              elements={videoView?.elements || []}
              exit={() =>
                api.current?.updateScene({
                  appState: {
                    activeEmbeddable: null,
                  },
                  captureUpdate: CaptureUpdateAction.NEVER,
                })
              }
            />
          )}
          {overview && !presenting && (
            <div className="overview-hint">
              {__ui(
                '全览定位：拖动画布，双击中键恢复编辑比例；右键保留当前视图',
              )}{' '}
              <button
                onClick={() => {
                  const st = api.current?.getAppState();
                  if (st) {
                    const center = {
                      x: st.width / (2 * st.zoom.value) - st.scrollX,
                      y: st.height / (2 * st.zoom.value) - st.scrollY,
                    };
                    api.current.updateScene({
                      appState: {
                        zoom: {
                          value: overview.zoom,
                        },
                        scrollX: st.width / (2 * overview.zoom) - center.x,
                        scrollY: st.height / (2 * overview.zoom) - center.y,
                      },
                      captureUpdate: CaptureUpdateAction.NEVER,
                    });
                    api.current.setActiveTool({
                      type: 'selection',
                    });
                  }
                  setOverview(null);
                }}
              >
                {__ui('返回当前中心编辑 ')}
              </button>
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
                  } else if (selecting === 'arrange') {
                    const ids = api.current
                      .getSceneElements()
                      .filter((el) => {
                        if (el.locked) return false;
                        const [x, y, r, b] = getCommonBounds([el]);
                        return (
                          x >= rect.x &&
                          y >= rect.y &&
                          r <= rect.x + rect.width &&
                          b <= rect.y + rect.height
                        );
                      })
                      .map((el) => el.id);
                    setArrangeIds(ids);
                    setSelecting(null);
                    setSelection(null);
                    setArrangeDialog(true);
                  } else addScene(rect);
                }
              }}
              onPointerCancel={() => {
                start.current = null;
                setSelection(null);
              }}
            >
              <div className="selection-tip">
                {selecting === 'export'
                  ? __ui('拖出导出区域')
                  : selecting === 'arrange'
                    ? __ui('框住需要整理的完整元素')
                    : __ui('拖出场景区域')}{' '}
                {__ui('\xB7 Esc 取消 ')}
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
        <div className="section-title">{__ui('场景')}</div>
        <p className="hint">
          {__ui('为同一张白板保存不同区域，点击场景平滑导航。')}
        </p>
        <div className="scene-create">
          <button
            disabled={!doc || !scenes.length || !editorReady}
            onClick={() => run(beginPresentation)}
          >
            {__ui('▶ 演示 ')}
          </button>
          <button
            disabled={!doc}
            onClick={() => {
              stop();
              setSelecting('new');
            }}
          >
            {__ui('＋ 框选区域 ')}
          </button>
          <button
            disabled={!doc}
            onClick={() => run(addElementScene)}
            title={__ui('先选中画布中的元素或组合，场景将跟随它们移动')}
          >
            {__ui('＋ 选择元素 ')}
          </button>
          <button
            className="scene-current-view"
            disabled={!doc}
            onClick={() =>
              api.current && addScene(viewRect(api.current.getAppState()))
            }
          >
            {__ui('添加当前视图为场景 ')}
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
                title={__ui('拖动排序')}
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
                onPointerUp={finishSceneDrag}
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
                  aria-label={__ui('场景标题')}
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
                    <small
                      className="scene-binding"
                      title={__ui('跟随关联元素和组合')}
                    >
                      {__ui('跟随 ')}
                    </small>
                  )}
                </button>
              )}
            </article>
          ))}
        </div>
        <small className="hint">
          {__ui('拖拽排序 \xB7 Shift 连选 \xB7 双击改名 \xB7 右键操作。 ')}
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
            style={{
              left: sceneMenu.x,
              top: sceneMenu.y,
            }}
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
                  {__ui('改名 ')}
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
                    ? __ui('重框（解除跟随）')
                    : __ui('重框')}
                </button>
                <button
                  role="menuitem"
                  title={__ui('以画布当前选中的元素或组合重新建立跟随')}
                  onClick={() => rebuildSceneBinding(sceneMenu.id)}
                >
                  {__ui('重建跟随 ')}
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
                  {__ui('上移 ')}
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
                setSceneDeletion({
                  ids: sceneMenu.ids,
                  documentId: doc.id,
                });
                setSceneMenu(null);
              }}
            >
              {sceneMenu.ids.length > 1
                ? '' +
                  __ui('删除已选场景（') +
                  sceneMenu.ids.length +
                  __ui('）')
                : __ui('删除场景')}
            </button>
          </div>
        </div>
      )}
      {!presenting && (
        <>
          <button
            className="export-toggle"
            aria-label={__ui('导出')}
            title={__ui('导出')}
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
            <div
              className="export-menu"
              role="dialog"
              aria-label={__ui('导出选项')}
            >
              <strong>{__ui('导出')}</strong>
              <span className="hint">
                {__ui('范围：')}
                {exportRegion ? __ui('已框选区域') : __ui('整张白板')}
              </span>
              <div className="actions">
                <button
                  onClick={() => {
                    setExportMenu(false);
                    setSelecting('export');
                    stop();
                  }}
                >
                  {__ui('框选导出区域 ')}
                </button>
                <button onClick={() => setExportRegion(null)}>
                  {__ui('整张白板')}
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => run(() => exportGraphic('png'))}
              >
                {__ui('导出 PNG ')}
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => exportGraphic('svg'))}
              >
                {__ui('导出 SVG ')}
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => exportPDF(false))}
              >
                {__ui('导出 PDF ')}
              </button>
              <button
                disabled={busy || !scenes.length}
                onClick={() => run(() => exportPDF(true))}
              >
                {__ui('场景 PDF ')}
              </button>
              <small>{__ui('可编辑格式保存完整白板，包含区域外内容。')}</small>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await flush();
                    return bridge.invoke(
                      'exportDocument',
                      doc.id,
                      active.current.data,
                      false,
                    );
                  })
                }
              >
                {__ui('导出完整文档 ')}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await flush();
                    return bridge.invoke(
                      'exportDocument',
                      doc.id,
                      active.current.data,
                      true,
                    );
                  })
                }
              >
                {__ui('导出 .excalidraw ')}
              </button>
              <button onClick={() => setExportMenu(false)}>
                {__ui('关闭导出')}
              </button>
            </div>
          )}
          <button
            className="scene-panel-toggle"
            onClick={toggleSidebar}
            title={sidebar ? __ui('隐藏场景') : __ui('显示场景')}
            aria-label={sidebar ? __ui('隐藏场景') : __ui('显示场景')}
            aria-pressed={sidebar}
          >
            <PanelIcon />
          </button>
        </>
      )}
      {presenting && (
        <>
          <div
            ref={inkStage}
            tabIndex={-1}
            className={`presentation-ink ${pen ? 'drawing' : ''}`}
            data-ink-count={inkCount}
            onWheelCapture={stop}
            onKeyDownCapture={stop}
            onPointerDownCapture={(event) => {
              fitOnMiddleDoubleClick(event);
              if (event.target.closest('canvas')) {
                stop();
                if (event.button === 0)
                  event.currentTarget
                    .querySelector('.excalidraw')
                    ?.focus({ preventScroll: true });
              }
            }}
          >
            <Excalidraw
              langCode={preferences.language === 'en' ? 'en' : 'zh-CN'}
              theme={canvasDark ? 'dark' : 'light'}
              viewModeEnabled={!pen}
              name="Local Canvas presentation ink"
              handleKeyboardGlobally={false}
              initialData={{
                elements: [],
                appState: {
                  viewBackgroundColor: 'transparent',
                  currentItemStrokeColor: '#e03131',
                  currentItemStrokeWidth: 2,
                  ...inkStyle.current,
                  activeTool: {
                    type: 'freedraw',
                    locked: true,
                  },
                  ...(api.current
                    ? {
                        scrollX: api.current.getAppState().scrollX,
                        scrollY: api.current.getAppState().scrollY,
                        zoom: api.current.getAppState().zoom,
                      }
                    : savedView.current),
                },
              }}
              excalidrawAPI={(value) => {
                inkApi.current = value;
              }}
              onChange={(elements, state) => {
                setFillSignal(
                  state.activeTool.type +
                    '|' +
                    Object.keys(state.selectedElementIds).join(',') +
                    elements
                      .filter((e) => state.selectedElementIds[e.id])
                      .map((e) => densityOf(e))
                      .join(','),
                );
                tagFillDensity(elements, state, inkApi.current);
                inkStyle.current = {
                  currentItemStrokeColor: state.currentItemStrokeColor,
                  currentItemStrokeWidth: state.currentItemStrokeWidth,
                  currentItemOpacity: state.currentItemOpacity,
                  currentItemBackgroundColor: state.currentItemBackgroundColor,
                  currentItemStrokeStyle: state.currentItemStrokeStyle,
                  currentItemRoughness: state.currentItemRoughness,
                  currentItemFillStyle: state.currentItemFillStyle,
                };
                setInkCount(elements.filter((e) => !e.isDeleted).length);
                if (
                  !presentation.current ||
                  !api.current ||
                  !pen ||
                  !presentationReady ||
                  frame.current !== null
                )
                  return;
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
              {__ui('图层 ')}
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
              {autoPlay ? __ui('暂停自动演示') : __ui('自动演示')}
            </button>
            <button
              aria-label={__ui('循环演示')}
              aria-pressed={loopPresentation}
              title={__ui('开启后自动演示到末页会返回首页继续播放')}
              onClick={() => {
                const next = !loopPresentation;
                setLoopPresentation(next);
                run(() =>
                  bridge.invoke('setSetting', 'loopPresentation', String(next)),
                );
              }}
            >
              {__ui('循环')}
              {loopPresentation ? __ui('：开') : __ui('：关')}
            </button>
            <label>
              {__ui('移动')}{' '}
              <select
                aria-label={__ui('演示移动时长')}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[500, 1000, 1500, 2000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms / 1000}
                    {__ui(' 秒 ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="auto-hint">
              {__ui('停留')}{' '}
              <select
                aria-label={__ui('自动演示停留时间')}
                value={dwellTime}
                onChange={(e) => setDwellTime(Number(e.target.value))}
              >
                {[1000, 2000, 3000, 5000, 10000, 15000, 30000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms / 1000}
                    {__ui(' 秒 ')}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label={__ui('上一场景')}
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
              aria-label={__ui('下一场景')}
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
              {__ui('临时画笔 ')}
            </button>
            <button onClick={clearInk}>{__ui('清除')}</button>
            <button onClick={() => run(exitPresentation)}>
              {__ui('退出演示')}
            </button>
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
            aria-label={'' + (fileMenu.node?.title || '根目录') + __ui(' 操作')}
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
              <span>{fileMenu.node?.title || __ui('根目录')}</span>
              <small>
                {fileMenu.node?.kind === 'document'
                  ? __ui('白板')
                  : __ui('文件夹')}
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
                    {__ui('新建白板 ')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      create('folder', fileMenu.node?.id || null);
                      setFileMenu(null);
                    }}
                  >
                    {__ui('新建文件夹 ')}
                  </button>
                </>
              )}
            {fileMenu.mode === 'actions' && fileMenu.node && (
              <>
                {fileMenu.node.kind === 'folder' && <hr />}
                <button role="menuitem" onClick={() => menuMode('rename')}>
                  {__ui('重命名 ')}
                  <span className="menu-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button role="menuitem" onClick={() => menuMode('move')}>
                  {__ui('移动到文件夹 ')}
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
                  {__ui('移入回收站 ')}
                </button>
              </>
            )}
            {fileMenu.mode !== 'actions' && (
              <button
                className="menu-back"
                disabled={menuPending}
                onClick={() => menuMode('actions')}
              >
                {__ui('‹ 返回操作 ')}
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
                          setDoc({
                            ...doc,
                            title,
                          });
                      });
                  }}
                >
                  <label>
                    {__ui('重命名 ')}
                    <input
                      name="title"
                      aria-label={__ui('文件名称')}
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
                      {__ui('取消 ')}
                    </button>
                    <button
                      className="primary-action"
                      type="submit"
                      disabled={menuPending}
                    >
                      {__ui('保存名称 ')}
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
                  {__ui('移动到 ')}
                  <select
                    name="parent"
                    aria-label={__ui('移动到文件夹')}
                    defaultValue={fileMenu.node.parent || ''}
                    disabled={menuPending}
                  >
                    <option value="">{__ui('根目录')}</option>
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
                  {__ui('只调整工作区目录，不移动磁盘上的关联文件。 ')}
                </p>
                <div className="menu-form-actions">
                  <button
                    type="button"
                    disabled={menuPending}
                    onClick={closeFileMenu}
                  >
                    {__ui('取消 ')}
                  </button>
                  <button
                    type="submit"
                    className="primary-action"
                    disabled={menuPending}
                  >
                    {__ui('移动到此处 ')}
                  </button>
                </div>
              </form>
            )}
            {fileMenu.mode === 'trash' && (
              <div className="menu-confirm">
                <h3>{__ui('移入回收站？')}</h3>
                <p>
                  {__ui(
                    '可在工作区回收站恢复。磁盘上的关联文件不会被删除；非空文件夹需先移出内容。 ',
                  )}
                </p>
                <div className="menu-form-actions">
                  <button disabled={menuPending} onClick={closeFileMenu}>
                    {__ui('取消 ')}
                  </button>
                  <button
                    className="danger-button"
                    disabled={menuPending}
                    onClick={() =>
                      performMenuAction(() => remove(fileMenu.node))
                    }
                  >
                    {__ui('移入回收站 ')}
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
              {__ui('删除 ')}
              {sceneDeletion.ids.length}
              {__ui(' 个场景？ ')}
            </h2>
            <p id="scene-delete-description">
              {__ui('只删除所选场景的导航区域，不删除白板上的文字或图形。 ')}
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
              <p>
                {__ui('另有 ')}
                {sceneDeletion.ids.length - 5}
                {__ui(' 个场景。')}
              </p>
            )}
            <div className="menu-form-actions">
              <button autoFocus onClick={() => setSceneDeletion(null)}>
                {__ui('取消 ')}
              </button>
              <button
                className="danger-button"
                onClick={() => run(confirmSceneDeletion)}
              >
                {__ui('确认删除 ')}
              </button>
            </div>
          </section>
        </div>
      )}
      {fileInfo && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>{__ui('文件信息')}</h2>
            <p>
              {__ui('文件位置： ')}
              <span className="storage-path">
                {fileInfo.file ||
                  __ui('尚未另存为独立文件，请使用“另存为”选择位置。')}
              </span>
            </p>
            <p>
              {__ui(
                '内容自动保存到本机工作区；手动保存同时记录当前视图，并写回已关联的文件。 ',
              )}
            </p>
            <p>
              {__ui('本机恢复副本： ')}
              <span className="storage-path">{fileInfo.database}</span>
            </p>
            <button onClick={() => setFileInfo(null)}>{__ui('关闭')}</button>
          </section>
        </div>
      )}
      {trash && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>{__ui('回收站')}</h2>
            {!nodes.some((node) => node.deleted) && (
              <p>{__ui('回收站为空。')}</p>
            )}
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
                    {__ui('恢复 ')}
                  </button>
                </p>
              ))}
            {emptyTrashConfirm ? (
              <div
                className="menu-confirm"
                role="alertdialog"
                aria-label={__ui('确认清空回收站')}
              >
                <h3>{__ui('永久清空回收站？')}</h3>
                <p>
                  {__ui('将删除 ')}
                  {nodes.filter((node) => node.deleted).length}{' '}
                  {__ui(
                    '项及其历史版本，无法在回收站恢复。磁盘上的关联文件和已有备份保留。 ',
                  )}
                </p>
                <div className="menu-form-actions">
                  <button autoFocus onClick={() => setEmptyTrashConfirm(false)}>
                    {__ui('取消清空 ')}
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
                    {__ui('确认永久清空 ')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger-button"
                disabled={!nodes.some((node) => node.deleted)}
                onClick={() => setEmptyTrashConfirm(true)}
              >
                {__ui('清空回收站 ')}
              </button>
            )}
            <button
              onClick={() => {
                setEmptyTrashConfirm(false);
                setTrash(false);
              }}
            >
              {__ui('关闭 ')}
            </button>
          </section>
        </div>
      )}
      {arrangeDialog && (
        <div className="modal-backdrop">
          <section
            className="modal arrange-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={__ui('自动整理元素')}
          >
            <h2>{__ui('自动整理元素')}</h2>
            <p>
              {__ui(
                '按视觉边界等距排列，组合、绑定文字和画框内容一起移动。可用撤销恢复。 ',
              )}
            </p>
            <div className="dialog-actions">
              <button
                onClick={() => {
                  setArrangeDialog(false);
                  setSelecting('arrange');
                }}
              >
                {__ui('框选元素 ')}
              </button>
              <span>
                {__ui('已选择 ')}
                {arrangeIds.length}
                {__ui(' 个元素')}
              </span>
            </div>
            <label>
              {__ui('整理模式 ')}
              <select
                aria-label={__ui('整理模式')}
                value={arrangeMode}
                onChange={(e) => setArrangeMode(e.target.value)}
              >
                <option value="vertical">{__ui('纵向整理')}</option>
                <option value="horizontal">{__ui('横向整理')}</option>
                <option value="grid">{__ui('阵列整理')}</option>
              </select>
            </label>
            <label>
              {__ui('元素间距 ')}
              <input
                aria-label={__ui('元素间距')}
                type="number"
                min="0"
                max="1000"
                value={arrangeGap}
                onChange={(e) => setArrangeGap(e.target.value)}
              />
            </label>
            <label className="dav-http">
              <input
                type="checkbox"
                checked={arrangeScene}
                onChange={(e) => setArrangeScene(e.target.checked)}
              />
              {__ui('整理后添加到演示列表（跟随所选元素） ')}
            </label>
            <div className="dialog-actions">
              <button disabled={!arrangeIds.length} onClick={applyArrange}>
                {__ui('应用整理 ')}
              </button>
              <button onClick={() => setArrangeDialog(false)}>
                {__ui('取消')}
              </button>
            </div>
          </section>
        </div>
      )}
      {settings && (
        <Settings
          bridge={bridge}
          close={() => setSettings(false)}
          theme={uiTheme}
          setTheme={changeTheme}
          preferences={preferences}
          setPreferences={changePreferences}
          openStorage={() => {
            setSettings(false);
            setStorageDialog(true);
          }}
          openDav={() => {
            setSettings(false);
            setDavDialog(true);
          }}
          resetBalloon={() => {
            if (active.current)
              changed({
                ...active.current.data,
                balloonSize: undefined,
              });
            setStatus(__ui('已恢复默认球标尺寸'));
          }}
          onUpdate={setUpdateAvailable}
          saveBeforeInstall={async () => {
            await manualSave();
            await flush();
          }}
        />
      )}
      {cascadeNotice && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={__ui('跟随场景已删除')}
          >
            <h2>{__ui('跟随场景已删除')}</h2>
            <p>{__ui('所关联的元素已删除，同时移除了以下场景：')}</p>
            <ul>
              {cascadeNotice.map((title, i) => (
                <li key={i}>{title}</li>
              ))}
            </ul>
            <p>{__ui('关闭提示后，撤销元素删除也会恢复对应场景。')}</p>
            <label className="dav-http">
              <input
                type="checkbox"
                checked={skipCascade}
                onChange={(e) => setSkipCascade(e.target.checked)}
              />
              {__ui('以后不再提示 ')}
            </label>
            <button
              autoFocus
              onClick={() => {
                if (skipCascade)
                  changePreferences({
                    ...preferences,
                    skipCascadeNotice: true,
                  });
                setCascadeNotice(null);
              }}
            >
              {__ui('知道了 ')}
            </button>
          </section>
        </div>
      )}
      {davDialog && (
        <WebdavSettings
          bridge={bridge}
          close={() => setDavDialog(false)}
          beforeTransfer={flush}
          restored={refresh}
          onStatus={reportDav}
        />
      )}
      {consent && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-label={__ui('加载外部网页')}
            aria-modal="true"
          >
            <h2>{__ui('加载外部网页？')}</h2>
            <p>
              {__ui(
                '这些站点将收到你的网络请求，可能使用 Cookie 或加载其他资源。只批准你信任的内容；本次批准仅在当前文档打开期间有效。',
              )}
            </p>
            <ul>
              {consent.map((origin) => (
                <li key={origin}>
                  <code>{origin}</code>
                </li>
              ))}
            </ul>
            <div className="dialog-actions">
              <button onClick={() => run(() => approveOrigins(consent))}>
                {__ui('允许加载')}
              </button>
              <button onClick={() => setConsent(null)}>
                {__ui('保持阻止')}
              </button>
            </div>
          </section>
        </div>
      )}
      {libraryInstall && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-label={__ui('安装素材库')}
            aria-modal="true"
          >
            <h2>{__ui('安装素材库？')}</h2>
            <p>
              {__ui('从官方目录下载并合并到当前白板素材库。请遵守素材许可。')}
            </p>
            <p className="library-source">{libraryInstall}</p>
            <div className="dialog-actions">
              <button
                onClick={() =>
                  run(async () => {
                    const value = await bridge.invoke(
                      'downloadLibrary',
                      libraryInstall,
                    );
                    await importLibrary(value);
                    setLibraryInstall(null);
                  })
                }
              >
                {__ui('下载并安装')}
              </button>
              <button onClick={() => setLibraryInstall(null)}>
                {__ui('取消')}
              </button>
            </div>
          </section>
        </div>
      )}
      {videoDialog && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-label={__ui('嵌入网页 / 视频')}
            aria-modal="true"
          >
            <h2>{__ui('嵌入网页 / 视频')}</h2>
            <p>
              {__ui(
                '支持 HTTPS 网页、NAS 页面及 YouTube、Bilibili 视频。添加即表示允许加载该站点；打开已有文档时会重新询问。单击边缘选择、拖动或缩放，Delete 删除；双击中心操作网页或播放器。网站可能禁止嵌入，可在浏览器打开。仅专门适配的视频支持切换场景自动暂停。 ',
              )}
            </p>
            <label>
              {__ui('网页或视频地址 ')}
              <input
                aria-label={__ui('网页或视频地址')}
                value={videoURL}
                onChange={(e) => setVideoURL(e.target.value)}
                placeholder="https://www.bilibili.com/video/BV…"
              />
            </label>
            <p role="alert">{videoError}</p>
            <div className="dialog-actions">
              <button
                onClick={() =>
                  run(async () => {
                    if (!parseEmbed(videoURL)) {
                      setVideoError(
                        __ui('请输入有效的 HTTPS 地址，不能包含用户名或密码'),
                      );
                      return;
                    }
                    if (!api.current) return;
                    await approveOrigins([parseEmbed(videoURL).origin]);
                    const view = viewRect(api.current.getAppState());
                    const elements = restoreElements(
                      [
                        {
                          type: 'embeddable',
                          x: view.x + view.width / 2 - 320,
                          y: view.y + view.height / 2 - 180,
                          width: 640,
                          height: 360,
                          link: videoURL,
                          strokeColor: '#868e96',
                        },
                      ],
                      null,
                    );
                    api.current.updateScene({
                      elements: [
                        ...api.current.getSceneElementsIncludingDeleted(),
                        ...elements,
                      ],
                      appState: {
                        selectedElementIds: Object.fromEntries(
                          elements.map((e) => [e.id, true]),
                        ),
                        activeEmbeddable: null,
                      },
                      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                    });
                    api.current.setActiveTool({
                      type: 'selection',
                    });
                    setVideoDialog(false);
                  })
                }
              >
                {__ui('添加到画布 ')}
              </button>
              <button onClick={() => setVideoDialog(false)}>
                {__ui('取消')}
              </button>
            </div>
          </section>
        </div>
      )}
      {storageDialog && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>{__ui('工作区保存位置')}</h2>
            <p>
              {bridge.kind === 'web'
                ? __ui(
                    '自动保存到 NAS 服务器 SQLite 工作区。打开文件从浏览器选择；另存为下载文件或由浏览器文件窗口选择位置。浏览器不会透露本地完整路径。',
                  )
                : __ui(
                    '自动保存到本机 SQLite 工作区；另存为可选择完整白板文件的位置。',
                  )}
            </p>
            <p className="storage-path">{storageInfo?.database}</p>
            <p>
              {__ui('自动备份： ')}
              <span className="storage-path">{storageInfo?.backups}</span>
            </p>
            {storagePending ? (
              <>
                <p>{__ui('已完整迁移，原位置保留。请重启使用新工作区。')}</p>
                <button onClick={() => run(() => bridge.invoke('restart'))}>
                  {__ui('重启应用 ')}
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy || bridge.kind === 'web'}
                  onClick={() =>
                    run(async () => {
                      await manualSave();
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
                  {__ui('更改工作区位置 ')}
                </button>
                <button disabled={busy} onClick={() => setStorageDialog(false)}>
                  {__ui('关闭 ')}
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
                    ask(__ui('重命名'), form.node.title, async (title) => {
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
                  {__ui('重命名 ')}
                </button>
                <button onClick={() => move(form.node)}>{__ui('移动')}</button>
                <button
                  onClick={() =>
                    run(async () => {
                      await remove(form.node);
                      setForm(null);
                    })
                  }
                >
                  {__ui('移入回收站 ')}
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const value = form.value.trim();
                    if (!form.options && !value)
                      throw new Error(__ui('请输入名称'));
                    await form.submit(value);
                    setForm(null);
                  });
                }}
              >
                {form.options ? (
                  <select
                    value={form.value}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        value: e.target.value,
                      })
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
                      setForm({
                        ...form,
                        value: e.target.value,
                      })
                    }
                  />
                )}
                <button type="submit">{__ui('确定')}</button>
              </form>
            )}
            <button onClick={() => setForm(null)}>{__ui('取消')}</button>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(root).render(<App />);
