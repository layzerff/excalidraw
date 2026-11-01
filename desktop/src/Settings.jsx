import { translate as __ui } from './i18n.mjs';
import React, { useEffect, useState } from 'react';
import { THEMES } from './themes.mjs';
export function Settings({
  bridge,
  close,
  theme,
  setTheme,
  preferences,
  setPreferences,
  openStorage,
  openDav,
  resetBalloon,
  saveBeforeInstall,
  onUpdate,
}) {
  const [info, setInfo] = useState(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [saveError, setSaveError] = useState('');
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await bridge.invoke(
        'setSetting',
        'appPreferences',
        JSON.stringify(preferences),
      );
      await bridge.invoke('setSetting', 'uiTheme', theme);
      setSaved(true);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const perform = async (fn) => {
    setPending(true);
    setError('');
    try {
      const next = await fn();
      setInfo(next);
      if (next?.candidate) onUpdate?.(next.candidate.version);
      else if (next?.status === 'latest') onUpdate?.(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    if (bridge.kind !== 'web') {
      perform(() => bridge.invoke('updateInfo'));
      const timer = setInterval(
        () =>
          bridge
            .invoke('updateInfo')
            .then(setInfo)
            .catch(() => {}),
        1000,
      );
      return () => clearInterval(timer);
    }
  }, []);
  const pref = (key, value) =>
    setPreferences({
      ...preferences,
      [key]: value,
    });
  const status = {
    idle: __ui('尚未检查'),
    checking: __ui('正在检查…'),
    available: __ui('发现新版本'),
    latest: __ui('未发现比当前更新的所选渠道版本'),
    downloading: __ui('正在下载…'),
    downloaded: __ui('下载和校验完成'),
    error: __ui('更新失败'),
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal app-settings"
        role="dialog"
        aria-label={__ui('设置')}
        aria-modal="true"
      >
        <h2>{__ui('设置')}</h2>
        <label>
          {__ui('界面语言')}
          <select
            aria-label={__ui('界面语言')}
            value={preferences.language || 'zh-CN'}
            onChange={(e) => pref('language', e.target.value)}
          >
            <option value="zh-CN">{__ui('简体中文')}</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {__ui('界面主题 ')}
          <select
            aria-label={__ui('设置界面主题')}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            {Object.entries(THEMES).map(([id, t]) => (
              <option key={id} value={id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="dav-http">
          <input
            type="checkbox"
            checked={preferences.reduceMotion}
            onChange={(e) => pref('reduceMotion', e.target.checked)}
          />
          {__ui('减少场景切换动画 ')}
        </label>
        <label className="dav-http">
          <input
            type="checkbox"
            checked={preferences.startReadOnly}
            onChange={(e) => pref('startReadOnly', e.target.checked)}
          />
          {__ui('打开白板时默认只读 ')}
        </label>
        <label className="dav-http">
          <input
            type="checkbox"
            checked={!preferences.skipCascadeNotice}
            onChange={(e) => pref('skipCascadeNotice', !e.target.checked)}
          />
          {__ui('删除元素及其跟随场景后显示提示 ')}
        </label>
        <label>
          {__ui('滚轮缩放步长')}
          <select
            aria-label={__ui('滚轮缩放步长')}
            value={preferences.wheelZoomStep || 5}
            onChange={(e) => pref('wheelZoomStep', Number(e.target.value))}
          >
            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
        <p>
          {__ui(
            'Ctrl/Cmd + 滚轮或触控板捏合时生效；不改变缩放按钮。设置即时生效并自动保存。',
          )}
        </p>
        <p>
          {__ui(
            '双击中键全览并切到抓手；再次双击中键恢复编辑比例，右键保留当前视图并继续编辑。 ',
          )}
        </p>
        <div className="dialog-actions">
          <button onClick={openStorage}>{__ui('工作区保存位置')}</button>
          <button onClick={openDav}>{__ui('WebDAV 设置')}</button>
          <button onClick={resetBalloon}>{__ui('重置球标尺寸')}</button>
        </div>
        <hr />
        <h3>{__ui('软件更新')}</h3>
        {bridge.kind === 'web' ? (
          <p>
            {__ui(
              '网页版由 NAS 管理员替换部署包并重新构建容器；浏览器不会自动修改 NAS 程序文件。 ',
            )}
          </p>
        ) : (
          <>
            <p>
              {__ui('当前版本：')}
              {info?.current || __ui('读取中…')}
              <br />
              {__ui('来源： ')}
              <a
                href="https://github.com/layzerff/excalidraw/releases"
                onClick={(e) => {
                  e.preventDefault();
                  bridge.invoke('openReleases');
                }}
              >
                {__ui('本项目 GitHub Releases ')}
              </a>
            </p>
            <label>
              {__ui('更新渠道 ')}
              <select
                aria-label={__ui('更新渠道')}
                value={preferences.updateChannel}
                onChange={(e) => {
                  pref('updateChannel', e.target.value);
                  perform(() => bridge.invoke('checkUpdates', e.target.value));
                }}
              >
                <option value="stable">{__ui('正式版')}</option>
                <option value="preview">{__ui('正式版和测试版')}</option>
              </select>
            </label>
            <label className="dav-http">
              <input
                type="checkbox"
                checked={preferences.autoCheckUpdates}
                onChange={(e) => pref('autoCheckUpdates', e.target.checked)}
              />
              {__ui('启动后自动检查更新（之后每 6 小时检查） ')}
            </label>
            <label className="dav-http">
              <input
                type="checkbox"
                checked={preferences.autoDownloadUpdates}
                onChange={(e) => pref('autoDownloadUpdates', e.target.checked)}
              />
              {__ui('发现新版本后自动下载并校验 ')}
            </label>
            <p role="status">
              {status[info?.status] || ''}
              {info?.candidate && ` · ${info.candidate.version}`}
              {info?.status === 'downloading' &&
                ` · ${Math.round(info.received / 1024 / 1024)} MB`}
            </p>
            {(error || info?.error) && (
              <p role="alert">{error || info.error}</p>
            )}
            {info?.candidate && (
              <p>
                {info.candidate.asset
                  ? __ui('适用于本设备的安装包已找到。')
                  : __ui('该发布没有适合本设备的安装包。')}
              </p>
            )}
            <div className="dialog-actions">
              <button
                disabled={pending || info?.status === 'downloading'}
                onClick={() =>
                  perform(() =>
                    bridge.invoke('checkUpdates', preferences.updateChannel),
                  )
                }
              >
                {__ui('检查更新 ')}
              </button>
              <button
                disabled={
                  pending ||
                  !info?.candidate?.asset ||
                  info?.status === 'downloading'
                }
                onClick={() => perform(() => bridge.invoke('downloadUpdate'))}
              >
                {__ui('下载并校验 ')}
              </button>
              {info?.status === 'downloading' && (
                <button onClick={() => bridge.invoke('cancelUpdateDownload')}>
                  {__ui('取消下载 ')}
                </button>
              )}
              <button
                disabled={pending || info?.status !== 'downloaded'}
                onClick={() =>
                  perform(async () => {
                    await saveBeforeInstall();
                    await bridge.invoke('installUpdate');
                    return bridge.invoke('updateInfo');
                  })
                }
              >
                {info?.platform === 'win32' && !info?.portable
                  ? __ui('启动安装')
                  : __ui('打开已校验的安装包')}
              </button>
              <button onClick={() => bridge.invoke('openReleases')}>
                {__ui('查看全部发布 ')}
              </button>
            </div>
            <p>
              {__ui(
                '安装前保存工作区。当前 Mac 包尚无 Developer ID 签名，下载后需手动替换应用；Windows 安装版可启动安装程序，免安装版需手动替换。不会自动降级或在编辑中退出。 ',
              )}
            </p>
            {info?.candidate?.notes && (
              <details>
                <summary>{__ui('更新说明')}</summary>
                <pre>{info.candidate.notes}</pre>
              </details>
            )}
          </>
        )}
        {saveError && <p role="alert">{saveError}</p>}
        <div className="dialog-actions">
          {saved && <span role="status">{__ui('设置已保存')}</span>}
          <button disabled={saving} onClick={save}>
            {__ui('保存设置')}
          </button>
          <button onClick={close}>{__ui('关闭设置')}</button>
        </div>
      </section>
    </div>
  );
}
