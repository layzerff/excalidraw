import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  CaptureUpdateAction,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
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
ownerWindow.EXCALIDRAW_ASSET_PATH = './excalidraw-assets/';
const bridge = ownerWindow.workspace;
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
  const switchDoc = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      flush();
      stop();
      setSelecting(null);
      setSelection(null);
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
      if (e.key === 'Escape') {
        stop();
        setSelecting(null);
        setSelection(null);
      }
    };
    const periodic = ownerWindow.setInterval(() => {
      try {
        flush();
      } catch {}
    }, 2000);
    ownerWindow.addEventListener('beforeunload', close);
    ownerWindow.addEventListener('keydown', key);
    return () => {
      ownerWindow.clearInterval(periodic);
      ownerWindow.removeEventListener('beforeunload', close);
      ownerWindow.removeEventListener('keydown', key);
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
      frame.current = t < 1 ? ownerWindow.requestAnimationFrame(animate) : null;
    };
    frame.current = ownerWindow.requestAnimationFrame(animate);
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
    <div className="workspace">
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
          <div className="actions">
            <button
              disabled={!doc}
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
              disabled={!doc}
              title="标准格式不含自定义场景"
              onClick={() =>
                run(() =>
                  bridge.invoke(
                    'exportDocument',
                    doc.id,
                    active.current.data,
                    true,
                  ),
                )
              }
            >
              导出 .excalidraw
            </button>
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
                if (active.current?.id !== doc.id) return;
                const data = JSON.parse(
                  serializeAsJSON(elements, appState, files, 'local'),
                );
                data.appState = {
                  ...data.appState,
                  scrollX: appState.scrollX,
                  scrollY: appState.scrollY,
                  zoom: appState.zoom,
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
                if (rect.width > 1 && rect.height > 1) addScene(rect);
              }}
              onPointerCancel={() => {
                start.current = null;
                setSelection(null);
              }}
            >
              <div className="selection-tip">拖出场景区域 · Esc 取消</div>
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
        <div className="section-title">
          场景 <span>{scenes.length}</span>
        </div>
        <p className="hint">为同一张白板保存不同区域，点击场景平滑导航。</p>
        <div className="scene-create">
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
            <option value={1200}>1.2 秒</option>
            <option value={2200}>2.2 秒</option>
            <option value={3500}>3.5 秒</option>
            <option value={5000}>5 秒</option>
          </select>
        </label>
        <div className="scene-list">
          {scenes.map((s, i) => (
            <article
              className="scene"
              key={s.id}
              draggable
              onDragStart={(e) => {
                drag.current = s.id;
                e.dataTransfer.setData('text/plain', s.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const source = scenes.find((x) => x.id === drag.current);
                if (!source || source.id === s.id) return;
                const next = scenes.filter((x) => x.id !== source.id);
                next.splice(
                  next.findIndex((x) => x.id === s.id),
                  0,
                  source,
                );
                updateScenes(next);
                drag.current = null;
              }}
            >
              <button className="scene-target" onClick={() => navigate(s)}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{s.title}</strong>
                <small>
                  {Math.round(s.rect.width)} × {Math.round(s.rect.height)}
                </small>
              </button>
              <div className="scene-tools">
                <button
                  onClick={() =>
                    ask('场景标题', s.title, (title) =>
                      updateScenes(
                        scenes.map((x) =>
                          x.id === s.id ? { ...x, title } : x,
                        ),
                      ),
                    )
                  }
                >
                  改名
                </button>
                <button
                  onClick={() => {
                    stop();
                    setSelecting(s.id);
                  }}
                >
                  重框
                </button>
                <button
                  title="上移"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...scenes];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    updateScenes(next);
                  }}
                >
                  ↑
                </button>
                <button
                  title="删除场景"
                  onClick={() =>
                    updateScenes(scenes.filter((x) => x.id !== s.id))
                  }
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
        <small className="hint">
          拖拽排序。滚动、点击画布或按 Esc 可打断导航。
        </small>
      </aside>
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
