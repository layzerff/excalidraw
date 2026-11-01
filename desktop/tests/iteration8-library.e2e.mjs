import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Store, blank } = createRequire(import.meta.url)(
  '../electron/store.cjs',
);
const profile = mkdtempSync('/tmp/canvas-r8-library-');
const shape = {
  id: 'rect',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  angle: 0,
  strokeColor: '#1971c2',
  backgroundColor: '#a5d8ff',
  fillStyle: 'cross-hatch',
  strokeWidth: 1,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  seed: 123,
  version: 1,
  versionNonce: 123,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
};
const db = new Store(profile + '/workspace.sqlite');
const id = db.create('document', null, 'Library regression', {
  ...blank(),
  libraryItems: [
    {
      id: 'local-valve',
      name: 'OneDrive 本地副本',
      status: 'published',
      created: 1,
      elements: [shape],
    },
  ],
});
db.setSetting('activeDocument', id);
db.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
db.close();
let app;
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  await app.evaluate((_args, shape) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (value) => {
      const url = String(value);
      if (url === 'https://libraries.excalidraw.com/libraries.json')
        return new Response(
          JSON.stringify([
            { name: 'Generic Set', source: 'test/generic.excalidrawlib' },
            {
              name: 'Microsoft 365 icons',
              source: 'test/office.excalidrawlib',
            },
          ]),
        );
      if (url.endsWith('/test/generic.excalidrawlib'))
        return new Response(
          JSON.stringify({
            type: 'excalidrawlib',
            version: 2,
            libraryItems: [
              {
                id: 'cloud',
                name: 'OneDrive',
                elements: [{ ...shape, id: 'cloud-shape' }],
              },
            ],
          }),
        );
      if (url.endsWith('/test/office.excalidrawlib'))
        return new Response(
          JSON.stringify({
            type: 'excalidrawlib',
            version: 2,
            libraryItems: Array.from({ length: 60 }, (_, index) => ({
              id: 'office-' + index,
              name: 'Office ' + index,
              elements: [{ ...shape, id: 'office-shape-' + index }],
            })),
          }),
        );
      return original(value);
    };
  }, shape);
  const p = await app.firstWindow(),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.locator('.default-sidebar-trigger').click();
  const input = p.getByRole('searchbox', { name: '搜索本地和在线素材' });
  await input.fill('OneDrive');
  await expect(
    p.locator('.local-library-results .library-search-card strong'),
  ).toHaveText('OneDrive 本地副本');
  await expect(
    p.locator('.online-search-results .library-search-card strong'),
  ).toHaveText('OneDrive');
  await expect(p.locator('.online-library-package-heading')).toContainText(
    'Generic Set',
  );
  const focus = await input.evaluate((e) => ({
    inner: getComputedStyle(e).outlineStyle,
    outer: getComputedStyle(e.closest('.workspace-search-field')).outlineWidth,
  }));
  expect(focus.inner).toBe('none');
  expect(focus.outer).toBe('2px');
  await p.screenshot({ path: 'test-results/r9-library-search.png' });
  const beforeInsert = await p.evaluate(async () => {
    const b = window.workspace;
    return (
      await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
    ).data.elements.length;
  });
  await p
    .locator('.local-library-results .library-drag-preview')
    .first()
    .click();
  await expect
    .poll(() =>
      p.evaluate(async () => {
        const b = window.workspace;
        return (
          await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
        ).data.elements.length;
      }),
    )
    .toBe(beforeInsert + 1);
  const root = p.locator('.local-library-results > .library-root-heading');
  await root.click({ button: 'right' });
  await p
    .getByRole('menuitem', { name: '新建素材文件夹', exact: true })
    .click();
  await p
    .getByRole('textbox', { name: '素材文件夹名称', exact: true })
    .fill('My assets');
  await p
    .locator('form.library-dialog')
    .getByRole('button', { name: '保存', exact: true })
    .click();
  await p
    .locator('.local-library-results .library-search-card')
    .first()
    .click({ button: 'right' });
  const target = p.getByLabel('素材目标文件夹', { exact: true });
  await expect(
    target.locator('option').filter({ hasText: 'My assets' }),
  ).toHaveCount(1);
  await target.selectOption({ label: 'My assets' });
  await p.getByRole('menuitem', { name: '确认移动', exact: true }).click();
  const folder = p
    .locator('.local-library-folder')
    .filter({ has: p.getByRole('button', { name: /My assets/ }) });
  await expect(folder.locator('.library-search-card')).toHaveCount(1);
  await root.click();
  await expect(
    p.locator('.local-library-results .library-search-card'),
  ).toBeHidden();
  await root.click();
  const relocated = profile + '/selected-materials';
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, relocated);
  await p.getByRole('button', { name: '素材保存位置', exact: true }).click();
  const dialog = p.getByRole('dialog', { name: '素材保存位置', exact: true });
  await expect(dialog).toContainText('materials');
  await dialog
    .getByRole('button', { name: '更改素材保存位置', exact: true })
    .click();
  await expect(dialog).toContainText('selected-materials');
  const location = await p.evaluate(() =>
    window.workspace.invoke('libraryStorageInfo'),
  );
  expect(location.folder).toBe(relocated);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await input.fill('');
  await p
    .getByRole('button', { name: 'Excalidraw 在线素材库', exact: false })
    .click();
  await p
    .getByRole('button', { name: 'Microsoft 365 icons', exact: false })
    .click();
  await expect(
    p.locator('.online-library-catalog .library-drag-preview'),
  ).toHaveCount(60);
  const resizer = p.getByRole('separator', { name: '素材栏宽度', exact: true }),
    side = p.locator('.default-sidebar');
  const before = await side.boundingBox(),
    r = await resizer.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + 100);
  await p.mouse.down();
  await p.mouse.move(r.x - 310, r.y + 100, { steps: 20 });
  await p.mouse.up();
  await expect
    .poll(async () => (await side.boundingBox()).width)
    .toBeGreaterThan(before.width + 200);
  const preview = p
    .locator('.online-library-catalog .library-drag-preview')
    .first();
  const large = (await preview.boundingBox()).width;
  await preview.hover();
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, 120);
  await p.keyboard.up('Control');
  await expect
    .poll(async () => (await preview.boundingBox()).width)
    .toBeLessThan(large);
  for (let i = 0; i < 10; i++) {
    await p.keyboard.down('Control');
    await p.mouse.wheel(0, 120);
    await p.keyboard.up('Control');
  }
  expect((await preview.boundingBox()).width).toBeGreaterThanOrEqual(47);
  await expect(p.getByLabel('素材排列列数', { exact: true })).toHaveCount(0);
  const grid = p
    .locator('.online-library-package')
    .filter({ hasText: 'Microsoft 365 icons' })
    .locator('.library-search-grid');
  const dimensions = await grid.evaluate((e) => ({
    right: e.getBoundingClientRect().right,
    edge: e.closest('.default-sidebar').getBoundingClientRect().right,
    overflow: e.scrollWidth - e.clientWidth,
  }));
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.edge);
  expect(dimensions.overflow).toBeLessThanOrEqual(1);
  const tracks = await grid.evaluate(
    (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length,
  );
  expect(tracks).toBeGreaterThanOrEqual(5);
  const body = p.locator('.library-menu-items-container__items');
  const heading = p.getByRole('button', {
    name: 'Microsoft 365 icons',
    exact: false,
  });
  await body.evaluate((e) => (e.scrollTop = 500));
  const hb = await heading.boundingBox(),
    bb = await body.boundingBox();
  expect(hb.y).toBeGreaterThanOrEqual(bb.y);
  expect(hb.y).toBeLessThan(bb.y + 80);
  await p.screenshot({ path: 'test-results/r9-library-sticky.png' });
  await heading.click();
  await expect(grid).toHaveCount(0);
  await body.evaluate((e) => (e.scrollTop = 0));
  const link = p.getByRole('button', { name: '打开网页素材库', exact: false });
  expect(
    await link.evaluate(
      (e) =>
        !!e.parentElement.classList.contains(
          'library-menu-items-container__items',
        ),
    ),
  ).toBe(true);
  expect(await link.evaluate((e) => getComputedStyle(e).textAlign)).toBe(
    'left',
  );
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await p.locator('select[aria-label="界面主题"]').selectOption(theme);
    await p.screenshot({ path: 'test-results/r9-library-' + theme + '.png' });
  }
  await p.reload();
  await p.locator('.default-sidebar-trigger').click();
  await expect(p.getByLabel('素材排列列数', { exact: true })).toHaveCount(0);
  expect(
    (await p.locator('.default-sidebar').boundingBox()).width,
  ).toBeGreaterThan(500);
  await expect(p.getByRole('button', { name: /My assets/ })).toBeVisible();
  expect(
    (await p.evaluate(() => window.workspace.invoke('libraryStorageInfo')))
      .folder,
  ).toBe(relocated);
  expect(errors).toEqual([]);
  console.log(
    'PASS: folder creation, item move, collapsible roots and safe storage relocation/reload; unified search finds individual online item name absent from package title; local/online grouping; outer focus; resizing, matrix, sticky package heading, hierarchy, root-level link, six themes and persistence',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
