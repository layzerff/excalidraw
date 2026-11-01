import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(tmpdir() + '/canvas-media-');
let app;
async function launch() {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p = await app.firstWindow();
  await expect(p.locator('.excalidraw')).toBeVisible();
  return p;
}
try {
  let page = await launch();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER', m.text());
  });
  page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(async () => {
    const b = window.workspace;
    await b.invoke('create', 'document', null, '白板10');
    await b.invoke('create', 'document', null, '白板2');
    await b.invoke(
      'create',
      'folder',
      null,
      '这是一个非常非常非常非常非常长的目录名称应该省略而不是挤压图标',
    );
  });
  await app.close();
  app = null;
  page = await launch();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER', m.text());
  });
  page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()));
  await page.getByRole('combobox', { name: '目录排序' }).selectOption('name');
  const names = await page.locator('.tree .node-name').allTextContents();
  expect(names.indexOf('白板2')).toBeLessThan(names.indexOf('白板10'));
  const long = page.locator('.node-title').filter({ hasText: '这是一个非常' });
  expect(
    await long
      .locator('svg')
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(12);
  expect(
    await long
      .locator('.node-name')
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.getByRole('combobox', { name: '目录排序' }).selectOption('custom');
  const rows = page.locator('.tree .tree-row');
  const before = await rows.locator('.node-name').allTextContents();
  const parentBefore = await page.evaluate(async () =>
    Object.fromEntries(
      (await window.workspace.invoke('list')).map((n) => [n.id, n.parent]),
    ),
  );
  const first = await rows.first().boundingBox(),
    last = await rows.last().boundingBox();
  await page.mouse.move(first.x + 80, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + 80, last.y + last.height - 2, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(() => page.locator('.tree .node-name').allTextContents())
    .not.toEqual(before);
  expect(
    await page.evaluate(async () =>
      Object.fromEntries(
        (await window.workspace.invoke('list')).map((n) => [n.id, n.parent]),
      ),
    ),
  ).toEqual(parentBefore);
  expect(await page.locator('.tree .node-name').allTextContents()).toEqual([
    ...before.slice(1),
    before[0],
  ]);
  await page
    .locator('.files')
    .screenshot({ path: 'test-results/directory-sorting.png' });
  await page.locator('.canvas .main-menu-trigger').click();
  await page.getByText('嵌入网页 / 视频', { exact: true }).click();
  await page
    .getByRole('textbox', { name: '网页或视频地址' })
    .fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: '添加到画布', exact: true }).click();
  await expect(page.locator('.video-embed iframe')).toHaveCount(1);
  // Native video editing and playback are covered by video-arrange.e2e.mjs.
  await page.getByText('工作区管理', { exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'WebDAV 设置' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '上传工作区备份' }),
  ).toBeDisabled();
  await page.screenshot({ path: 'test-results/webdav-settings.png' });
  await page
    .getByRole('dialog', { name: 'WebDAV 设置' })
    .screenshot({ path: 'test-results/webdav-dialog.png' });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await app.close();
  app = null;
  page = await launch();
  await expect(page.getByRole('combobox', { name: '目录排序' })).toHaveValue(
    'custom',
  );
  await expect(page.locator('.video-embed iframe')).toBeVisible();
  console.log(
    'PASS: name/custom sorting, real pointer reorder, fixed tree icons, native video persistence and WebDAV entry',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
