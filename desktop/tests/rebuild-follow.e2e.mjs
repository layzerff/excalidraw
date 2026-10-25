import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(`${tmpdir()}/canvas-rebind-`);
let app;
async function launch() {
  app = await electron.launch({ executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined, args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()], env: { ...process.env, LOCAL_CANVAS_DATA: profile } });
  const page = await app.firstWindow();
  await expect(page.locator('.excalidraw')).toBeVisible();
  return page;
}
const read = (page) => page.evaluate(async () => {
  const b = window.workspace;
  return (await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))).data;
});
try {
  let page = await launch();
  await page.getByRole('button', { name: '添加当前视图为场景', exact: true }).click();
  await expect.poll(async () => (await read(page)).scenes.length).toBe(1);
  const original = (await read(page)).scenes[0];
  await page.locator('label').filter({ has: page.locator('[data-testid="toolbar-rectangle"]') }).click();
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.move(canvas.x + 300, canvas.y + 200);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 450, canvas.y + 320, { steps: 10 });
  await page.mouse.up();
  await page.locator('.scene').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: '重建跟随', exact: true }).click();
  await expect.poll(async () => (await read(page)).scenes[0]?.binding?.elementIds.length).toBe(1);
  const rebuilt = (await read(page)).scenes[0];
  expect(rebuilt.id).toBe(original.id);
  expect(rebuilt.title).toBe(original.title);
  await page.mouse.click(canvas.x + 700, canvas.y + 500);
  await page.locator('.scene').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: '重建跟随', exact: true }).click();
  await expect(page.locator('header')).toContainText('先在画布选中');
  expect((await read(page)).scenes[0]).toEqual(rebuilt);
  await page.locator('.scene').first().click({ button: 'right' });
  await page.locator('.scene-context-menu').screenshot({ path: 'test-results/scene-rebuild-menu.png', scale: 'css' });
  await app.close(); app = null;
  page = await launch();
  expect((await read(page)).scenes[0]).toEqual(rebuilt);
  console.log('PASS: rebuild binding, preserve title/id, no-selection protection, restart persistence');
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
