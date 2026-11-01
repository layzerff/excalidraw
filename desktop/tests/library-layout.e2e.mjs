import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Store, blank } = createRequire(import.meta.url)(
  '../electron/store.cjs',
);
const profile = mkdtempSync('/tmp/canvas-r7-library-ui-');
const store = new Store(profile + '/workspace.sqlite');
const shape = {
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 120,
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
const libraryItems = ['one', 'two', 'three'].map((n, i) => ({
  id: 'asset-' + n,
  status: 'published',
  created: 1,
  elements: [{ ...shape, id: 'shape-' + n, seed: 123 + i }],
}));
const id = store.create('document', null, 'Library QA', {
  ...blank(),
  libraryItems,
});
store.setSetting('activeDocument', id);
store.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
store.close();
let app;
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
  await p.locator('.default-sidebar-trigger').click();
  await expect(
    p.getByRole('button', { name: '关闭素材库', exact: true }),
  ).toBeVisible();
  await expect(
    p.locator('.default-sidebar .sidebar__header__buttons'),
  ).toBeHidden();
  await expect(
    p.locator('.library-menu-dropdown-container--in-heading'),
  ).toBeHidden();
  await expect(p.locator('.library-unit[data-library-id]')).toHaveCount(3);
  await p
    .locator('.canvas canvas.interactive')
    .click({ position: { x: 450, y: 300 } });
  await expect(
    p.getByRole('searchbox', { name: '搜索本地和在线素材' }),
  ).toBeVisible();
  for (const key of ['one', 'two']) {
    const item = p.locator(
      '.library-unit[data-library-id="asset-' + key + '"]',
    );
    await item.hover();
    await item.getByRole('checkbox').click();
  }
  const item = p.locator('.library-unit[data-library-id="asset-one"]');
  const box = await item.boundingBox();
  await item.click({ button: 'right', position: { x: 40, y: 30 } });
  const menu = p.getByRole('menu', { name: '素材操作' });
  await expect(menu).toContainText('2 项已选');
  const mb = await menu.boundingBox();
  expect(Math.abs(mb.x - (box.x + 40))).toBeLessThan(3);
  expect(Math.abs(mb.y - (box.y + 30))).toBeLessThan(3);
  await p.screenshot({ path: 'test-results/r7-library-context.png' });
  await p.getByRole('menuitem', { name: '删除所选素材', exact: true }).click();
  await p
    .getByRole('dialog', { name: '删除素材' })
    .getByRole('button', { name: '取消', exact: true })
    .click();
  await expect(p.locator('.library-unit[data-library-id]')).toHaveCount(3);
  await item.click({ button: 'right' });
  await p.getByRole('menuitem', { name: '删除所选素材', exact: true }).click();
  await p
    .getByRole('dialog', { name: '删除素材' })
    .getByRole('button', { name: '确定删除', exact: true })
    .click();
  await expect(p.locator('.library-unit[data-library-id]')).toHaveCount(1);
  const actions = await p
    .locator('.local-library-actions button')
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const b = n.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      }),
    );
  expect(actions.length).toBe(2);
  expect(actions[0].y).toBe(actions[1].y);
  expect(actions[0].w).toBeCloseTo(actions[1].w, 0);
  expect(actions[0].h).toBe(actions[1].h);
  const external = p.getByRole('button', {
    name: '打开网页素材库',
    exact: false,
  });
  await expect(external).toBeVisible();
  expect(
    await external.evaluate((e) =>
      e.parentElement.classList.contains('library-menu-items-container__items'),
    ),
  ).toBe(true);
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await p.locator('select[aria-label="界面主题"]').selectOption(theme);
    await p.screenshot({ path: 'test-results/r7-library-' + theme + '.png' });
  }
  await p.getByRole('button', { name: '关闭素材库', exact: true }).click();
  await expect(
    p.getByRole('searchbox', { name: '搜索本地和在线素材' }),
  ).toHaveCount(0);
  await p.getByRole('button', { name: '打开设置', exact: true }).click();
  await p.getByLabel('滚轮缩放步长', { exact: true }).selectOption('15');
  await p.getByRole('button', { name: '关闭设置', exact: true }).click();
  await p.reload();
  await p.getByRole('button', { name: '打开设置', exact: true }).click();
  await expect(p.getByLabel('滚轮缩放步长', { exact: true })).toHaveValue('15');
  expect(errors).toEqual([]);
  console.log(
    'PASS: library manual close, no canvas auto-close, native multiselection context menu at cursor, delete confirmation, equal action layout, external link placement, six themes and zoom setting restart persistence',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
