import React, { useEffect, useState } from 'react';
export function WebdavSettings({ bridge, close, beforeTransfer, restored }) {
  const [value, setValue] = useState({
    url: '',
    username: '',
    password: '',
    allowHttp: false,
  });
  const [pending, setPending] = useState(true),
    [message, setMessage] = useState(''),
    [saved, setSaved] = useState(false);
  const [filename, setFilename] = useState(''),
    [confirm, setConfirm] = useState(false);
  const perform = async (fn) => {
    setPending(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    perform(async () => {
      const info = await bridge.invoke('webdavInfo');
      if (info) {
        setValue({ ...info, password: '' });
        setSaved(true);
      }
    });
  }, []);
  const field = (key, next) => {
    setValue((v) => ({ ...v, [key]: next }));
    setSaved(false);
    setConfirm(false);
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-label="WebDAV 设置"
        aria-modal="true"
      >
        <h2>WebDAV 设置</h2>
        <p>
          手动备份与恢复。不会自动同步或覆盖本机工作区；恢复内容导入新文件夹。请填写已存在的远程目录。
        </p>
        <label>
          服务器目录 URL
          <input
            aria-label="WebDAV 地址"
            placeholder="https://nas.example.com/dav/canvas/"
            value={value.url}
            onChange={(e) => field('url', e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          用户名
          <input
            aria-label="WebDAV 用户名"
            value={value.username}
            onChange={(e) => field('username', e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          密码
          <input
            aria-label="WebDAV 密码"
            type="password"
            autoComplete="off"
            placeholder={value.hasPassword ? '已保存，留空保留原密码' : ''}
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
          允许 HTTP（账号和备份将明文传输，仅用于可信网络）
        </label>
        <div className="dialog-actions">
          <button
            disabled={pending}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavSave', value);
                setValue((v) => ({ ...v, password: '', hasPassword: true }));
                setSaved(true);
                setMessage('连接设置已加密保存');
              })
            }
          >
            保存设置
          </button>
          <button
            disabled={pending || !saved}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavTest');
                setMessage('连接成功（已验证目录访问；写入权限由上传验证）');
              })
            }
          >
            测试连接
          </button>
          <button
            disabled={pending || !saved}
            onClick={() =>
              perform(async () => {
                beforeTransfer();
                const name = await bridge.invoke('webdavBackup');
                setFilename(name);
                setMessage(`备份上传成功：${name}`);
              })
            }
          >
            上传工作区备份
          </button>
        </div>
        <hr />
        <label>
          恢复远程备份文件名
          <input
            aria-label="远程备份文件名"
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
          下载会读取上述连接的文件，验证格式后导入本机。大于 200 MB
          的备份暂不支持。
        </p>
        {confirm ? (
          <div className="dialog-actions">
            <button
              disabled={pending}
              onClick={() =>
                perform(async () => {
                  beforeTransfer();
                  await bridge.invoke('webdavRestore', filename);
                  await restored();
                  setConfirm(false);
                  setMessage('已恢复到新的文件夹');
                })
              }
            >
              确认下载并导入
            </button>
            <button disabled={pending} onClick={() => setConfirm(false)}>
              取消恢复
            </button>
          </div>
        ) : (
          <button
            disabled={pending || !saved || !filename}
            onClick={() => setConfirm(true)}
          >
            恢复指定备份
          </button>
        )}
        <p role="status">{pending ? '处理中…' : message}</p>
        <div className="dialog-actions">
          <button
            disabled={pending}
            onClick={() =>
              perform(async () => {
                await bridge.invoke('webdavForget');
                setSaved(false);
                setValue((v) => ({ ...v, password: '', hasPassword: false }));
                setMessage('已移除本机连接设置');
              })
            }
          >
            移除连接
          </button>
          <button disabled={pending} onClick={close}>
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}
