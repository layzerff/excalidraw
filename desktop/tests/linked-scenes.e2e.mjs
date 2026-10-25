import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'canvas-linked-scenes-'));
let app;
async function launch() {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [resolve('.')],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow();
  page.on('pageerror', error => console.log('PAGE_ERROR', error.message));
  try { await expect(page.locator('.excalidraw')).toBeVisible({timeout:30000}); }
  catch (error) {console.log('LAUNCH_BODY',await page.locator('body').innerText());throw error;}
  return page;
}
const read = (page) =>
  page.evaluate(async () => {
    const b = window.workspace;
    return (
      await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
    ).data;
  });
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
try {
  let page = await launch();
  await page.evaluate(async () => {
    const b = window.workspace;
    const rect = (id, x, y) => ({
      id,
      type: 'rectangle',
      x,
      y,
      width: 100,
      height: 80,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 42,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    });
    const id = await b.invoke('create', 'document', null, '元素跟随测试', {
      elements: [rect('a', 350, 200), rect('b', 550, 350)],
      appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      files: {},
      scenes: [],
    });
    await b.invoke('setSetting', 'activeDocument', id);
    const folder = await b.invoke('create', 'folder', null, '待清空文件夹');
    const deleted = await b.invoke('create', 'document', folder, '待清空白板');
    await b.invoke('trash', deleted, true);
    await b.invoke('trash', folder, true);
  });
  await app.close();
  app = null;
  page = await launch();
  await page.waitForTimeout(700);
  const area = await page
    .getByRole('button', { name: '＋ 框选区域', exact: true })
    .boundingBox();
  const selection = await page
    .getByRole('button', { name: '＋ 选择元素', exact: true })
    .boundingBox();
  const view = await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .boundingBox();
  expect(area.y).toBe(selection.y);
  expect(view.y).toBeGreaterThan(area.y + area.height);
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.click(canvas.x + 400, canvas.y + 240);
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.press(`${mod}+g`);
  await page.getByRole('button', { name: '＋ 选择元素', exact: true }).click();
  await expect(page.locator('.scene-binding')).toHaveCount(1);
  await expect.poll(async () => (await read(page)).scenes.length).toBe(1);
  let data = await read(page),
    before = data.scenes[0];
  expect(before.binding.elementIds.sort()).toEqual(['a', 'b']);
  expect(before.binding.groupIds).toHaveLength(1);
  await page.mouse.move(canvas.x + 600, canvas.y + 390);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 700, canvas.y + 440, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(async () => (await read(page)).scenes[0].rect.x)
    .toBeCloseTo(before.rect.x + 100, 0);
  await expect
    .poll(async () => (await read(page)).scenes[0].rect.y)
    .toBeCloseTo(before.rect.y + 50, 0);
  const moved = (await read(page)).scenes[0];
  await page.keyboard.press(`${mod}+z`);
  await expect
    .poll(async () => (await read(page)).scenes[0].rect.x)
    .toBeCloseTo(before.rect.x, 0);
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect
    .poll(async () => (await read(page)).scenes[0].rect.x)
    .toBeCloseTo(moved.rect.x, 0);
  await page.keyboard.press('Delete');
  await expect
    .poll(
      async () =>
        (await read(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(0);
  expect((await read(page)).scenes[0].rect).toEqual(moved.rect);
  await page.keyboard.press(`${mod}+z`);
  await expect
    .poll(
      async () =>
        (await read(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(2);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/linked-scenes-041.png' });
  await page.locator('.workspace-tools summary').click();
  await page.getByRole('button', { name: '回收站', exact: true }).click();
  await page.getByRole('button', { name: '清空回收站', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', { name: '确认清空回收站' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '取消清空', exact: true }).click();
  await expect(page.locator('.modal p').filter({hasText:'待清空白板'})).toBeVisible();
  await page.getByRole('button', { name: '清空回收站', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '确认清空回收站' })
    .screenshot({ path: 'test-results/empty-trash-041.png' });
  await page.getByRole('button', { name: '确认永久清空', exact: true }).click();
  await expect(page.getByText('回收站为空。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.scene-binding')).toHaveCount(1);
  expect((await read(page)).scenes[0].binding).toEqual(moved.binding);
  expect(
    await page.evaluate(async () =>
      (await window.workspace.invoke('list')).filter((n) => n.deleted),
    ),
  ).toEqual([]);
  console.log(
    'PASS: three scene controls; native grouping/move/undo/delete-undo follows scene; restart; empty-trash cancellation, atomic confirmation and persistence',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
