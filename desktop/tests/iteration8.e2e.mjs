import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Store, blank } = createRequire(import.meta.url)(
  '../electron/store.cjs',
);
const profile = mkdtempSync('/tmp/canvas-r8-');
const db = new Store(profile + '/workspace.sqlite');
const shape = {
  id: 'one',
  type: 'rectangle',
  x: -4600,
  y: -1300,
  width: 1000,
  height: 700,
  angle: 0,
  strokeColor: '#1971c2',
  backgroundColor: '#a5d8ff',
  fillStyle: 'cross-hatch',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  seed: 22,
  version: 1,
  versionNonce: 22,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
};
const data = {
  ...blank(),
  elements: [
    shape,
    {
      ...shape,
      id: 'two',
      x: 4500,
      y: 4700,
      width: 300,
      height: 180,
      type: 'ellipse',
    },
  ],
};
const id = db.create('document', null, 'Overview regression', data),
  tinyId = db.create('document', null, 'Huge extent', {
    ...data,
    elements: [shape, { ...shape, id: 'far', x: 1e12, y: 1e12 }],
  });
db.setSetting('activeDocument', id);
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
const saveView = async (p) => {
  await p.getByRole('button', { name: '保存', exact: true }).click();
  return (await read(p)).data.appState;
};
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
  const overview = async () => {
    const c = p.locator('.canvas canvas.interactive');
    await c.click({
      button: 'middle',
      position: { x: 450, y: 300 },
      clickCount: 2,
      delay: 100,
    });
  };
  await overview();
  const fitted = await saveView(p);
  expect(fitted.zoom.value).toBeGreaterThan(0.03);
  expect(fitted.zoom.value).toBeLessThan(0.1);
  await p.screenshot({ path: 'test-results/r8-overview.png' });
  await p
    .locator('.file-row')
    .filter({ hasText: 'Huge extent' })
    .count()
    .then(() => {});
  await p.getByText('Huge extent', { exact: true }).click();
  await overview();
  let before = await saveView(p);
  expect(before.zoom.value).toBeLessThan(0.0005);
  await p
    .locator('.canvas canvas.interactive')
    .hover({ position: { x: 450, y: 300 } });
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, -120);
  await p.keyboard.up('Control');
  await p.waitForTimeout(100);
  let after = await saveView(p);
  expect(after.zoom.value / before.zoom.value).toBeGreaterThan(1);
  expect(after.zoom.value / before.zoom.value).toBeLessThan(1.15);
  await p.getByRole('button', { name: '打开设置', exact: true }).click();
  await p.getByLabel('滚轮缩放步长', { exact: true }).selectOption('50');
  await p.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(
    p.getByRole('status').filter({ hasText: '设置已保存' }),
  ).toContainText('设置已保存');
  await p.getByRole('button', { name: '关闭设置', exact: true }).click();
  before = await saveView(p);
  await p
    .locator('.canvas canvas.interactive')
    .hover({ position: { x: 450, y: 300 } });
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, -120);
  await p.keyboard.up('Control');
  await p.waitForTimeout(100);
  after = await saveView(p);
  expect(after.zoom.value / before.zoom.value).toBeGreaterThan(1.3);
  expect(after.zoom.value / before.zoom.value).toBeLessThan(1.8);
  await p.getByText('Overview regression', { exact: true }).click();
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 500, y: 350 } });
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter(
          (e) => e.customData?.localCanvasBalloon,
        ).length,
    )
    .toBeGreaterThan(0);
  const balloon = (await read(p)).data.elements.find(
    (e) => e.type === 'ellipse' && e.customData?.localCanvasBalloon,
  );
  expect(balloon.width).toBeCloseTo(balloon.height, 6);
  await p.getByTestId('main-menu-trigger').click();
  const github = p.getByRole('link', { name: 'GitHub', exact: true });
  await expect(github.locator('svg')).toHaveCount(1);
  await p.screenshot({ path: 'test-results/r8-github-menu.png' });
  await p.keyboard.press('Escape');
  expect(errors).toEqual([]);
  console.log(
    'PASS: overview below ten percent and extreme scene bounds; relative follow-up wheel zoom; settings save and actual step changes; circular numbered balloons; GitHub menu icon',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
