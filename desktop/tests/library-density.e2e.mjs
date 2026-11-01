import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { Store } = require('../electron/store.cjs');
const profile = mkdtempSync('/tmp/canvas-library-density-');
const db = new Store(profile + '/workspace.sqlite');
db.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
db.close();
let app;
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
    .filter({ has: p.getByTestId('toolbar-rectangle') })
    .click();
  await p
    .locator('label')
    .filter({ has: p.getByTestId('backgroundColor-#ffc9c9') })
    .count()
    .then(() => {});
  // Use native color input and fill panel; density slider belongs to that same panel.
  await p
    .getByRole('button', { name: /背景/ })
    .count()
    .then(() => {});
  const area = await p.locator('.canvas').boundingBox();
  await p.mouse.move(area.x + 350, area.y + 220);
  await p.mouse.down();
  await p.mouse.move(area.x + 570, area.y + 400, { steps: 8 });
  await p.mouse.up();
  await expect.poll(async () => (await read(p)).data.elements.length).toBe(1);
  // Fill controls are conditional on a nontransparent native background.
  const bg = p.getByRole('button', { name: '#ffc9c9', exact: true });
  await bg.click();
  await expect(
    p.getByRole('slider', { name: '填充密度', exact: true }),
  ).toBeVisible();
  await p.getByRole('slider', { name: '填充密度', exact: true }).fill('50');
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements[0].customData?.localCanvasFillDensity,
    )
    .toBe(50);
  const shape = (await read(p)).data.elements[0];
  await app.evaluate((_args, shape) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (value) => {
      const u = String(value);
      if (u === 'https://libraries.excalidraw.com/libraries.json')
        return new Response(
          JSON.stringify([
            {
              name: '测试素材包',
              source: 'test/demo.excalidrawlib',
              description: 'Demo package',
              authors: [{ name: 'Tester' }],
            },
          ]),
        );
      if (
        u ===
        'https://libraries.excalidraw.com/libraries/test/demo.excalidrawlib'
      )
        return new Response(
          JSON.stringify({
            type: 'excalidrawlib',
            version: 1,
            library: [
              [{ ...shape, id: 'library-rect', groupIds: [], customData: {} }],
            ],
          }),
        );
      return original(value);
    };
  }, shape);
  await p.locator('.default-sidebar-trigger').click();
  await expect(
    p.getByRole('searchbox', { name: '搜索本地和在线素材' }),
  ).toBeVisible();
  await p.getByRole('button', { name: /Excalidraw 在线素材库/ }).click();
  await p.getByRole('button', { name: /测试素材包/ }).click();
  await expect(
    p.locator('.online-library-catalog .library-drag-preview'),
  ).toHaveCount(1);
  await expect(
    p.locator('.online-library-catalog .library-drag-preview img'),
  ).toBeVisible();
  await p
    .locator('.online-library-catalog .library-drag-preview')
    .dragTo(p.locator('.canvas canvas.interactive'), {
      targetPosition: { x: 400, y: 500 },
    });
  await expect.poll(async () => (await read(p)).data.elements.length).toBe(2);
  if (
    !(await p
      .getByRole('button', { name: '保存素材', exact: true })
      .isVisible())
  )
    await p.locator('.default-sidebar-trigger').click();
  await p.getByRole('button', { name: '保存素材', exact: true }).click();
  await expect
    .poll(async () => (await read(p)).data.libraryItems?.length)
    .toBe(1);
  if (
    !(await p
      .getByRole('searchbox', { name: '搜索本地和在线素材' })
      .isVisible())
  )
    await p.locator('.default-sidebar-trigger').click();
  await p
    .locator('.local-library-actions')
    .getByRole('button', { name: '名称与标签' })
    .click();
  await p
    .locator('.local-library-results .library-search-card')
    .getByRole('button', { name: '名称与标签' })
    .click();
  await p.getByRole('textbox', { name: '素材名称', exact: true }).fill('阀门');
  await p
    .getByRole('textbox', { name: '素材标签', exact: true })
    .fill('机械, 管道');
  await p
    .locator('.library-meta-editor')
    .getByRole('button', { name: '保存', exact: true })
    .click();
  await p.getByRole('searchbox', { name: '搜索本地和在线素材' }).fill('jx');
  await expect(
    p.locator('.local-library-results .library-search-card strong'),
  ).toHaveText('阀门');
  await p.screenshot({ path: 'test-results/r6-online-library.png' });
  await p.reload();
  await p.locator('.default-sidebar-trigger').click();
  await p.getByRole('searchbox', { name: '搜索本地和在线素材' }).fill('阀门');
  await expect(
    p.locator('.local-library-results .library-search-card strong'),
  ).toHaveText('阀门');
  expect(errors).toEqual([]);
  console.log(
    'PASS: density persisted on shape, online catalog expansion + v1 thumbnails + native drag/drop, offline save, name/tags search and restart',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
