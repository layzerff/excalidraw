import { _electron as electron, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(tmpdir() + '/canvas-dav-');
let app;
const files = new Map();
const server = createServer(async (req, res) => {
  if (
    req.headers.authorization !==
    'Basic ' + Buffer.from('test:password').toString('base64')
  ) {
    res.writeHead(401);
    res.end();
    return;
  }
  if (req.method === 'PROPFIND') {
    res.writeHead(207, { 'Content-Type': 'application/xml' });
    res.end(
      '<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>',
    );
    return;
  }
  if (req.method === 'PUT') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    files.set(req.url, Buffer.concat(chunks));
    res.writeHead(201);
    res.end();
    return;
  }
  const value = files.get(req.url);
  res.writeHead(value ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(value || '');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  app = await electron.launch({
    args: [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.excalidraw')).toBeVisible();
  await page.getByText('工作区管理', { exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'WebDAV 地址' })
    .fill(`http://127.0.0.1:${server.address().port}/backup/`);
  await page.getByRole('textbox', { name: 'WebDAV 用户名' }).fill('test');
  await page.getByRole('textbox', { name: 'WebDAV 密码' }).fill('password');
  await page.getByRole('checkbox', {name:/允许 HTTP/}).check();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('连接设置已加密保存');
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('连接成功');
  await page
    .getByRole('button', { name: '上传工作区备份', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('备份上传成功');
  expect(files.size).toBe(1);
  const bundle = JSON.parse([...files.values()][0]);
  expect(bundle.format).toBe('local-canvas-workspace');
  expect(bundle.settings.some((s) => s.key.startsWith('webdav'))).toBe(false);
  expect(JSON.stringify(bundle)).not.toContain('password');
  const before = await page.evaluate(() => window.workspace.invoke('list'));
  await page.getByRole('button', { name: '恢复指定备份', exact: true }).click();
  await page
    .getByRole('button', { name: '确认下载并导入', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('已恢复到新的文件夹');
  const after = await page.evaluate(() => window.workspace.invoke('list'));
  expect(after.length).toBeGreaterThan(before.length);
  expect(after.some((n) => n.id === before[0].id)).toBe(true);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.workspace.invoke('getSetting', 'webdavSecret'),
    ),
  ).toBe(null);
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'WebDAV 密码' })).toHaveValue(
    '',
  );
  await expect(page.getByRole('button', { name: '测试连接' })).toBeEnabled();
  await page.getByRole('button', { name: '移除连接', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('已移除本机连接设置');
  console.log(
    'PASS: encrypted credential settings, real local WebDAV PROPFIND/PUT/GET, credentials excluded from backup, confirmed additive restore, secret inaccessible via generic IPC, forget settings',
  );
} finally {
  if (app) await app.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(profile, { recursive: true, force: true });
}
