import { _electron as electron, expect } from '@playwright/test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'canvas-041-'));
mkdirSync('test-results', { recursive: true });
let app;
async function launch() {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [resolve('.')],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.excalidraw')).toBeVisible();
  return page;
}
async function stored(page) {
  return page.evaluate(async () => {
    const b = window.workspace;
    return b.invoke('read', await b.invoke('getSetting', 'activeDocument'));
  });
}
try {
  let page = await launch();
  await page.evaluate(async () => {
    const b = window.workspace;
    const rectangle = (id, x, y) => ({
      id,
      type: 'rectangle',
      x,
      y,
      width: 300,
      height: 200,
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
    const id = await b.invoke('create', 'document', null, '本地 0.4.1 验证', {
      elements: [rectangle('left', 0, 0), rectangle('far', 2400, 1400)],
      files: {},
      appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      scenes: Array.from({ length: 5 }, (_, i) => ({
        id: `scene-${i}`,
        title: `页 ${i + 1}`,
        rect: { x: i * 600, y: 0, width: 800, height: 600 },
      })),
    });
    await b.invoke('setSetting', 'activeDocument', id);
  });
  await app.close();
  app = null;
  page = await launch();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForTimeout(700); // Let restored editor defaults settle before the revision baseline.
  const original = await stored(page);
  const box = await page.locator('.canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.6, {
    button: 'middle',
    clickCount: 2,
    delay: 80,
  });
  await page.waitForTimeout(700);
  expect((await stored(page)).revision).toBe(original.revision);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const fitted = await stored(page),
    state = fitted.data.appState;
  expect(state.zoom.value).toBeLessThan(0.5);
  for (const element of fitted.data.elements) {
    expect(
      (element.x + state.scrollX) * state.zoom.value,
    ).toBeGreaterThanOrEqual(0);
    expect(
      (element.y + state.scrollY) * state.zoom.value,
    ).toBeGreaterThanOrEqual(0);
    expect(
      (element.x + element.width + state.scrollX) * state.zoom.value,
    ).toBeLessThanOrEqual(box.width);
    expect(
      (element.y + element.height + state.scrollY) * state.zoom.value,
    ).toBeLessThanOrEqual(box.height);
  }
  await page.screenshot({ path: 'test-results/fit-all-041.png' });
  await page.locator('.scene-target').nth(0).click();
  await page
    .locator('.scene-target')
    .nth(2)
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.scene[data-selected="true"]')).toHaveCount(3);
  await page.locator('.scene').nth(1).click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: '删除已选场景（3）', exact: true })
    .click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('删除 3 个场景');
  await expect(page.locator('.scene')).toHaveCount(5);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.scene')).toHaveCount(5);
  await page.locator('.scene').nth(1).click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: '删除已选场景（3）', exact: true })
    .click();
  await dialog.screenshot({
    path: 'test-results/scenes-delete-confirm-041.png',
  });
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.locator('.scene')).toHaveCount(2);
  await expect
    .poll(async () => (await stored(page)).data.scenes.map((s) => s.id))
    .toEqual(['scene-3', 'scene-4']);
  expect((await stored(page)).data.elements).toEqual(original.data.elements);
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '图层', exact: true }).click();
  await page.locator('.scene-target').last().click();
  await page
    .locator('.scene-target')
    .first()
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.scene[data-selected="true"]')).toHaveCount(2);
  await page.locator('.scene').first().click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: '删除已选场景（2）', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.presentation-controls')).toBeVisible();
  await page.locator('.scene').first().click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: '删除已选场景（2）', exact: true })
    .click();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toHaveCount(0);
  await expect(page.locator('.scene')).toHaveCount(0);
  expect((await stored(page)).data.elements).toEqual(original.data.elements);

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d'),
      data = ctx.createImageData(canvas.width, canvas.height);
    let value = 42;
    for (let i = 0; i < data.data.length; i += 4) {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      data.data[i] = value & 255;
      data.data[i + 1] = (value >>> 8) & 255;
      data.data[i + 2] = (value >>> 16) & 255;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  });
  expect(png.length).toBeGreaterThan(4_000_000);
  const tempRoot = await app.evaluate(({ app }) => app.getPath('temp'));
  const before = readdirSync(tempRoot).filter((n) =>
    n.startsWith('local-canvas-pdf-'),
  );
  for (const count of [1, 2]) {
    const file = join(profile, `large-${count}.pdf`);
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    expect(
      await page.evaluate(
        async ({ png, count }) =>
          window.workspace.invoke(
            'exportPDF',
            '大图 PDF',
            Array(count).fill(png),
          ),
        { png, count },
      ),
    ).toBe(true);
    expect(readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-');
    // Keep copies for PDF page-count/render inspection after the isolated profile is removed.
    copyFileSync(file, resolve(`test-results/large-${count}-041.pdf`));
  }
  const bad = join(profile, 'bad.pdf');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, bad);
  const failure = await page.evaluate(async () => {
    try {
      await window.workspace.invoke('exportPDF', 'bad', [
        'data:image/png;base64,YmFk',
      ]);
      return '';
    } catch (e) {
      return e.message;
    }
  });
  expect(failure).not.toBe('');
  expect(existsSync(bad)).toBe(false);
  const after = readdirSync(tempRoot).filter((n) =>
    n.startsWith('local-canvas-pdf-'),
  );
  expect(after.sort()).toEqual(before.sort());
  expect(errors).toEqual([]);
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.scene')).toHaveCount(0);
  expect((await stored(page)).data.elements).toEqual(original.data.elements);
  console.log(
    'PASS: fit all distant elements without autosave; Shift selection, cancellation, confirmed batch deletion in editing/fullscreen and restart; large single/two-page PDF and failed-image cleanup',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
