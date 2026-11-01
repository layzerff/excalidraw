import { chromium, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
const require = createRequire(import.meta.url),
  { startServer } = require(
    process.env.LOCAL_CANVAS_WEB_SERVER || '../web/server.cjs',
  );
const directory = mkdtempSync(tmpdir() + '/canvas-web-browser-');
let browser, server;
try {
  server = startServer({
    directory,
    username: 'tester',
    password: 'test-password-123456',
    port: 0,
  });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    httpCredentials: { username: 'tester', password: 'test-password-123456' },
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('.excalidraw')).toBeVisible();
  await expect(
    page
      .locator('.App-toolbar')
      .getByRole('button', { name: '嵌入网页 / 视频' }),
  ).toBeVisible();
  const area = await page.locator('.canvas').boundingBox();
  await page
    .locator('label')
    .filter({ has: page.locator('[data-testid=toolbar-rectangle]') })
    .click();
  await page.mouse.move(area.x + 340, area.y + 240);
  await page.mouse.down();
  await page.mouse.move(area.x + 490, area.y + 340, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const b = window.workspace;
        return (
          await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
        ).data.elements.length;
      }),
    )
    .toBe(1);
  await expect(page.locator('.save-state')).toHaveText('已保存到 NAS 工作区');
  await page.reload();
  await expect(page.locator('.excalidraw')).toBeVisible();
  const read = () =>
    page.evaluate(async () => {
      const b = window.workspace;
      return b.invoke('read', await b.invoke('getSetting', 'activeDocument'));
    });
  expect((await read()).data.elements).toHaveLength(1);
  await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('已保存到 NAS 工作区');
  // Fallback download path, independent of OS file picker (including plain LAN HTTP).
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '另存为', exact: true }).click();
  const file = await download;
  const dest = directory + '/roundtrip.canvas.json';
  await file.saveAs(dest);
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '打开文件…', exact: true }).click();
  await (await choosing).setFiles(dest);
  await expect
    .poll(async () => {
      const b = await page.evaluate(() => window.workspace.invoke('list'));
      return b.filter((n) => n.kind === 'document').length;
    })
    .toBe(2);
  expect((await read()).data.scenes).toHaveLength(1);
  await page.getByText('工作区管理', { exact: true }).click();
  const backupEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份工作区', exact: true }).click();
  const backup = await backupEvent;
  expect(backup.suggestedFilename()).toMatch(/^local-canvas-backup/);
  await page.screenshot({ path: 'test-results/nas-web.png' });
  await page
    .locator('.files')
    .screenshot({ path: 'test-results/nas-sidebar.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS browser: server SQLite save/reload, toolbar video entry, manual view save, document download/open with scenes, workspace backup',
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
  rmSync(directory, { recursive: true, force: true });
}
