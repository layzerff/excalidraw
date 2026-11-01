import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { Store } = require('../electron/store.cjs');
const profile = mkdtempSync(tmpdir() + '/canvas-iteration4-');
const db = new Store(profile + '/workspace.sqlite');
db.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
db.close();
mkdirSync('test-results', { recursive: true });
let app;
const read = (p) =>
  p.evaluate(async () => {
    const b = window.workspace;
    return b.invoke('read', await b.invoke('getSetting', 'activeDocument'));
  });
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  let p = await app.firstWindow(),
    errors = [];
  p.on('pageerror', (e) => {
    errors.push(e.message);
    console.log('ERROR', e.message);
  });
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.getByRole('button', { name: '打开设置' }).click();
  await expect(
    p.getByRole('dialog', { name: '设置', exact: true }),
  ).toBeVisible();
  for (const theme of ['wechat', 'discord']) {
    await p.getByRole('combobox', { name: '设置界面主题' }).selectOption(theme);
    await expect(p.locator('.workspace')).toHaveAttribute('data-theme', theme);
    await p.screenshot({ path: `test-results/settings-${theme}.png` });
  }
  await p
    .getByRole('combobox', { name: '设置界面主题' })
    .selectOption('github');
  await expect(
    p.getByRole('checkbox', { name: /启动后自动检查更新/ }),
  ).not.toBeChecked();
  await expect(p.getByRole('combobox', { name: '更新渠道' })).toHaveValue(
    'stable',
  );
  await p.getByRole('combobox', { name: '更新渠道' }).selectOption('preview');
  await expect(p.getByRole('status')).toContainText('未发现比当前更新', {
    timeout: 30000,
  });
  await p.getByRole('button', { name: '关闭设置' }).click();
  const area = await p.locator('.canvas').boundingBox();
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.mouse.click(area.x + 400, area.y + 250);
  await p.keyboard.press('Escape');
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter((e) => e.type === 'ellipse')
          .length,
    )
    .toBe(1);
  const before = (await read(p)).data.elements.find(
    (e) => e.type === 'ellipse',
  );
  console.log('FIRST', before.width, before.customData);
  await p.mouse.click(area.x + 400, area.y + 250);
  await p.mouse.move(
    area.x + before.x + before.width + 4,
    area.y + before.y + before.height + 4,
  );
  await p.mouse.down();
  await p.mouse.move(
    area.x + before.x + before.width + 84,
    area.y + before.y + before.height + 64,
    { steps: 15 },
  );
  await p.mouse.up();
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.find((e) => e.id === before.id).width,
    )
    .not.toBe(before.width);
  const resized = (await read(p)).data.elements.find((e) => e.id === before.id);
  await expect.poll(async () => !!(await read(p)).data.balloonSize).toBe(true);
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.mouse.click(area.x + 650, area.y + 350);
  await p.keyboard.press('Escape');
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter((e) => e.type === 'ellipse')
          .length,
    )
    .toBe(2);
  const added = (await read(p)).data.elements
    .filter((e) => e.type === 'ellipse')
    .at(-1);
  expect(added.width).toBeCloseTo(resized.width, 1);
  expect(added.height).toBeCloseTo(resized.height, 1);
  await p.mouse.click(area.x + 650, area.y + 350);
  await p.getByRole('button', { name: '＋ 选择元素', exact: true }).click();
  await expect(p.locator('.scene')).toHaveCount(1);
  await p.mouse.click(area.x + 650, area.y + 350);
  await p.keyboard.press('Backspace');
  await expect(p.getByRole('dialog', { name: '跟随场景已删除' })).toBeVisible();
  await expect(p.locator('.scene')).toHaveCount(0);
  await p.getByRole('checkbox', { name: '以后不再提示' }).check();
  await p.getByRole('button', { name: '知道了', exact: true }).click();
  await p.mouse.click(area.x + 760, area.y + 420);
  await p.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  await expect(p.locator('.scene')).toHaveCount(1);
  await p.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z',
  );
  await expect(p.locator('.scene')).toHaveCount(0);
  await expect(p.getByRole('dialog', { name: '跟随场景已删除' })).toHaveCount(
    0,
  );
  const id = await p.evaluate(async () => {
    const b = window.workspace,
      d = (
        await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
      ).data,
      base = d.elements.find((e) => e.type === 'ellipse');
    const elements = [-50000, 50000].map((x, i) => ({
      ...base,
      id: 'far-' + i,
      type: 'rectangle',
      x,
      y: 0,
      width: 200,
      height: 100,
      isDeleted: false,
      groupIds: [],
      boundElements: null,
      customData: null,
      index: null,
    }));
    const data = {
      elements,
      files: {},
      appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0 },
      scenes: [
        {
          id: 'left',
          title: '左侧场景',
          rect: { x: -50500, y: -200, width: 1200, height: 700 },
        },
        {
          id: 'right',
          title: '右侧场景',
          rect: { x: 49500, y: -200, width: 1200, height: 700 },
        },
      ],
    };
    const id = await b.invoke(
      'create',
      'document',
      null,
      '全览与演示测试',
      data,
    );
    await b.invoke('setSetting', 'activeDocument', id);
    return id;
  });
  await p.reload();
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.waitForTimeout(800);
  const a = await p.locator('.canvas').boundingBox();
  const middle = async () =>
    p.mouse.click(a.x + a.width / 2, a.y + a.height / 2, {
      button: 'middle',
      clickCount: 2,
      delay: 80,
    });
  const revision = (await read(p)).revision;
  await middle();
  await expect(p.locator('.overview-hint')).toBeVisible();
  let zoom = parseFloat(await p.locator('.reset-zoom-button').innerText());
  expect(zoom).toBeLessThan(10);
  expect(zoom).toBeGreaterThan(0);
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, 5000);
  await p.keyboard.up('Control');
  await p.waitForTimeout(250);
  zoom = parseFloat(await p.locator('.reset-zoom-button').innerText());
  expect(zoom).toBeGreaterThan(0);
  expect(zoom).toBeLessThan(10);
  await p.screenshot({ path: 'test-results/overview-locate.png' });
  await middle();
  await expect(p.locator('.overview-hint')).toHaveCount(0);
  await expect(p.locator('.reset-zoom-button')).toHaveText('100%');
  await p.waitForTimeout(600);
  expect((await read(p)).revision).toBe(revision);
  await p.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    window.__inkNode = document.querySelector('.presentation-ink .excalidraw');
  });
  for (let i = 0; i < 3; i++) {
    await p.getByRole('button', { name: '下一场景', exact: true }).click();
    await p.waitForTimeout(650);
    expect(
      await p.evaluate(
        () =>
          window.__inkNode ===
          document.querySelector('.presentation-ink .excalidraw'),
      ),
    ).toBe(true);
    await p.getByRole('button', { name: '上一场景', exact: true }).click();
    await p.waitForTimeout(650);
    expect(
      await p.evaluate(
        () =>
          window.__inkNode ===
          document.querySelector('.presentation-ink .excalidraw'),
      ),
    ).toBe(true);
  }
  await p.getByRole('button', { name: '退出演示', exact: true }).click();
  await p.getByRole('button', { name: '打开设置' }).click();
  await expect(
    p.getByRole('checkbox', { name: '删除元素及其跟随场景后显示提示' }),
  ).not.toBeChecked();
  await p.getByRole('button', { name: '关闭设置' }).click();
  expect(errors).toEqual([]);
  console.log(
    'PASS: settings, WeChat/Discord, manual balloon resize inheritance, cascade notice/undo/redo, overview below 10%, pointer return zoom, view-only no saves, persistent ink instance during 6 scene transitions',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
