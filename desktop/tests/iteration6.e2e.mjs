import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { Store } = require('../electron/store.cjs');
const profile = mkdtempSync('/tmp/canvas-r6-'),
  db = new Store(profile + '/workspace.sqlite');
db.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
db.close();
mkdirSync('test-results', { recursive: true });
let app;
const colors = async (p) =>
  p.locator('.canvas canvas.interactive').evaluate((c) => {
    const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] > 80 && a[i + 1] > 30 && a[i + 2] < 40 && a[i + 3] > 30) n++;
    return n;
  });
const read = (p) =>
  p.evaluate(async () =>
    window.workspace.invoke(
      'read',
      await window.workspace.invoke('getSetting', 'activeDocument'),
    ),
  );
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p = await app.firstWindow(),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p
    .locator('label')
    .filter({ has: p.getByTestId('toolbar-text') })
    .click();
  await p.locator('.canvas').click({ position: { x: 500, y: 250 } });
  await p.keyboard.insertText('中文拼音\n重庆方案\nCanvas canvas');
  await p.keyboard.press('Escape');
  await expect.poll(async () => (await read(p)).data.elements.length).toBe(1);
  await p.waitForTimeout(800);
  const before = await read(p);
  const search = p.getByRole('searchbox', { name: '搜索画布文字' });
  await search.fill('zw');
  await expect(p.locator('.workspace-search-results mark')).toHaveText('中文');
  await expect.poll(() => colors(p)).toBeGreaterThan(100);
  await p.locator('.workspace-search-results button').click();
  await expect(p.locator('.workspace-search-results button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await search.fill('chongqing');
  await expect(p.locator('.workspace-search-results mark')).toHaveText('重庆');
  await search.fill('cq');
  await expect(p.locator('.workspace-search-results mark')).toHaveText('重庆');
  await search.fill('zhongw');
  await expect(p.locator('.workspace-search-results mark')).toHaveText('中文');
  await search.fill('canvas');
  await expect(p.locator('.workspace-search-results mark')).toHaveCount(2);
  await expect.poll(() => colors(p)).toBeGreaterThan(100);
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await p.getByRole('button', { name: '打开设置' }).click();
    await p.getByRole('combobox', { name: '设置界面主题' }).selectOption(theme);
    await p.getByRole('button', { name: '关闭设置' }).click();
    await search.fill('zw');
    await expect.poll(() => colors(p)).toBeGreaterThan(100);
    await p.screenshot({ path: `test-results/r6-search-${theme}.png` });
  }
  await search.fill('');
  await expect.poll(() => colors(p)).toBe(0);
  await p.waitForTimeout(700);
  const after = await read(p);
  expect(after.revision).toBe(before.revision);
  expect(after.data.appState.searchMatches).toBeUndefined();
  // Retain current view on right-click, and suppress context menu only in overview.
  const box = await p.locator('.canvas').boundingBox();
  await p.mouse.click(box.x + 500, box.y + 350, {
    button: 'middle',
    clickCount: 2,
  });
  await expect(p.locator('.overview-hint')).toBeVisible();
  const zoomBefore = await p.locator('.reset-zoom-button').textContent();
  const rectBefore = await p
    .locator('.canvas canvas.interactive')
    .boundingBox();
  await p.mouse.click(box.x + 500, box.y + 350, { button: 'right' });
  await expect(p.locator('.overview-hint')).toBeHidden();
  expect(await p.locator('.reset-zoom-button').textContent()).toBe(zoomBefore);
  await expect(p.getByTestId('toolbar-selection')).toBeChecked();
  await expect(p.locator('.context-menu')).toHaveCount(0);
  expect(await p.locator('.canvas canvas.interactive').boundingBox()).toEqual(
    rectBefore,
  );
  await p.waitForTimeout(600);
  expect((await read(p)).revision).toBe(before.revision);
  await p.mouse.click(box.x + 500, box.y + 350, { button: 'right' });
  await expect(p.locator('.context-menu')).toBeVisible();
  await p.keyboard.press('Escape');
  expect(errors).toEqual([]);
  console.log(
    'PASS: literal/full-pinyin/initials/mixed matching, substring and native canvas highlights in six themes, selection navigation, clear highlights without saves, overview right-click retains view and suppresses only that context menu',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
