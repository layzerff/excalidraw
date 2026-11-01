import { translate as __ui } from './i18n.mjs';
import React, { useEffect, useState } from 'react';
export function WebdavSettings({
  bridge,
  close,
  beforeTransfer,
  restored,
  onStatus,
}) {
  const [value, setValue] = useState({
    url: '',
    username: '',
    password: '',
    allowHttp: false,
  });
  const [pending, setPending] = useState(true),
    [message, setMessage] = useState(''),
    [saved, setSaved] = useState(false);
  const [help, setHelp] = useState(false);
  const [filename, setFilename] = useState(''),
    [confirm, setConfirm] = useState(false);
  const perform = async (fn, action = false) => {
    if (action) onStatus?.('transferring');
    setPending(true);
    setMessage('');
    try {
      await fn();
      if (action) onStatus?.(typeof action === 'string' ? action : 'success');
    } catch (e) {
      setMessage(e.message);
      if (action) onStatus?.('error');
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    perform(async () => {
      const info = await bridge.invoke('webdavInfo');
      if (info) {
        setValue({
          ...info,
          password: '',
        });
        setSaved(true);
      }
    });
  }, []);
  const field = (key, next) => {
    setValue((v) => ({
      ...v,
      [key]: next,
    }));
    setSaved(false);
    setConfirm(false);
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-label={__ui('WebDAV 设置')}
        aria-modal="true"
      >
        <h2 className="settings-heading">
          <span>{__ui('WebDAV 设置')}</span>
          <button
            className="help-badge"
            aria-label={__ui('WebDAV 功能设置说明')}
            aria-expanded={help}
            onClick={() => setHelp(!help)}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6m0 3v1" />
            </svg>
          </button>
        </h2>
        {help && (
          <aside className="help-bubble" role="note">
            <strong>{__ui('如何设置 WebDAV')}</strong>
            <ol>
              <li>
                {__ui(
                  '在 NAS 开启 WebDAV 服务，创建专用账号和备份文件夹，授予读写权限。 ',
                )}
              </li>
              <li>
                {__ui(
                  '填写目录完整 URL（包括端口和文件夹路径），如 https://nas.example.com:5006/canvas/，优先使用有效 HTTPS 证书。 ',
                )}
              </li>
              <li>
                {__ui(
                  '填写账号密码，保存并测试连接，再上传工作区备份。测试检查读取，上传验证写权限。 ',
                )}
              </li>
              <li>
                {__ui(
                  '恢复时输入上传得到的完整 JSON 文件名。内容会导入新文件夹，现有白板保留。 ',
                )}
              </li>
            </ol>
            <p>
              {__ui(
                '这是手动备份，不是双向自动同步。密码不包含在导出的备份中。401/403 请核查账号和权限，404 请核查路径。 ',
              )}
            </p>
          </aside>
        )}
        <p>
          {__ui(
            '手动备份与恢复。不会自动同步或覆盖本机工作区；恢复内容导入新文件夹。请填写已存在的远程目录。 ',
          )}
        </p>
        <label>
          {__ui('服务器目录 URL ')}
          <input
            aria-label={__ui('WebDAV 地址')}
            placeholder="https://nas.example.com/dav/canvas/"
            value={value.url}
            onChange={(e) => field('url', e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          {__ui('用户名 ')}
          <input
            aria-label={__ui('WebDAV 用户名')}
            value={value.username}
            onChange={(e) => field('username', e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          {__ui('密码 ')}
          <input
            aria-label={__ui('WebDAV 密码')}
            type="password"
            autoComplete="off"
            placeholder={
              value.hasPassword ? __ui('已保存，留空保留原密码') : ''
            }
            value={value.password}
            onChange={(e) => field('password', e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="dav-http">
          <input
            type="checkbox"
            checked={value.allowHttp}
            onChange={(e) => field('allowHttp', e.target.checked)}
            disabled={pending}
          />{' '}
          {__ui('允许 HTTP（账号和备份将明文传输，仅用于可信网络） ')}
        </label>
        <div className="dialog-actions">
          <button
            disabled={pending}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavSave', value);
                setValue((v) => ({
                  ...v,
                  password: '',
                  hasPassword: true,
                }));
                setSaved(true);
                setMessage(
                  bridge.kind === 'web'
                    ? __ui('连接设置已在 NAS 加密保存')
                    : __ui('连接设置已加密保存'),
                );
              }, 'configured')
            }
          >
            {__ui('保存设置 ')}
          </button>
          <button
            disabled={pending || !saved}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavTest');
                setMessage(
                  __ui('连接成功（已验证目录访问；写入权限由上传验证）'),
                );
              }, true)
            }
          >
            {__ui('测试连接 ')}
          </button>
          <button
            disabled={pending || !saved}
            onClick={() =>
              perform(async () => {
                await beforeTransfer();
                const name = await bridge.invoke('webdavBackup');
                setFilename(name);
                setMessage('' + __ui('备份上传成功：') + name);
              }, true)
            }
          >
            {__ui('上传工作区备份 ')}
          </button>
        </div>
        <hr />
        <label>
          {__ui('恢复远程备份文件名 ')}
          <input
            aria-label={__ui('远程备份文件名')}
            value={filename}
            onChange={(e) => {
              setFilename(e.target.value);
              setConfirm(false);
            }}
            placeholder="local-canvas-… .json"
            disabled={pending}
          />
        </label>
        <p>
          {__ui(
            '下载会读取上述连接的文件，验证格式后导入本机。大于 200 MB 的备份暂不支持。 ',
          )}
        </p>
        {confirm ? (
          <div className="dialog-actions">
            <button
              disabled={pending}
              onClick={() =>
                perform(async () => {
                  await beforeTransfer();
                  await bridge.invoke('webdavRestore', filename);
                  await restored();
                  setConfirm(false);
                  setMessage(__ui('已恢复到新的文件夹'));
                }, true)
              }
            >
              {__ui('确认下载并导入 ')}
            </button>
            <button disabled={pending} onClick={() => setConfirm(false)}>
              {__ui('取消恢复 ')}
            </button>
          </div>
        ) : (
          <button
            disabled={pending || !saved || !filename}
            onClick={() => setConfirm(true)}
          >
            {__ui('恢复指定备份 ')}
          </button>
        )}
        <p role="status">{pending ? __ui('处理中…') : message}</p>
        <div className="dialog-actions">
          <button
            disabled={pending}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavForget');
                setSaved(false);
                setValue((v) => ({
                  ...v,
                  password: '',
                  hasPassword: false,
                }));
                setMessage(__ui('已移除本机连接设置'));
                onStatus?.('unconfigured');
              }, 'unconfigured')
            }
          >
            {__ui('移除连接 ')}
          </button>
          <button disabled={pending} onClick={close}>
            {__ui('关闭 ')}
          </button>
        </div>
      </section>
    </div>
  );
}
