import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(tmpdir() + '/canvas-balloons-');
let app;
mkdirSync('test-results', { recursive: true });
const read = (page) =>
  page.evaluate(async () => {
    const b = window.workspace;
    return (
      await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
    ).data;
  });
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.locator('.excalidraw')).toBeVisible();
  const native = page
    .locator('label')
    .filter({ has: page.locator('[data-testid="toolbar-rectangle"]') })
    .locator('svg')
    .first();
  const video = page
    .getByRole('button', { name: '嵌入网页 / 视频', exact: true })
    .locator('svg');
  const number = page.getByRole('button', { name: '自增球标', exact: true });
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await page.getByRole('combobox', { name: '界面主题' }).selectOption(theme);
    const boxes = await Promise.all([
      native.boundingBox(),
      video.boundingBox(),
      number.locator('svg').boundingBox(),
    ]);
    const centers = boxes.map((b) => b.y + b.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(0.6);
    const fonts = await page
      .locator('.header-actions > button')
      .evaluateAll((bs) => bs.map((b) => getComputedStyle(b).fontSize));
    expect(new Set(fonts).size).toBe(1);
    const hs = await page
      .locator('.header-actions > button')
      .evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.6);
  }
  await page.getByRole('combobox', { name: '界面主题' }).selectOption('github');
  await number.click();
  await expect(number).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('spinbutton', { name: '下一球标编号' }),
  ).toHaveValue('1');
  await expect(
    page.getByRole('group', { name: '描边宽度', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '#e03131', exact: true }).click();
  const area = await page.locator('.canvas').boundingBox();
  for (const [x, y] of [
    [400, 240],
    [520, 240],
    [640, 240],
  ])
    await page.mouse.click(area.x + x, area.y + y);
  await expect
    .poll(async () =>
      (await read(page)).elements
        .filter((e) => e.type === 'text')
        .map((e) => e.text),
    )
    .toEqual(['1', '2', '3']);
  await page.getByRole('spinbutton', { name: '下一球标编号' }).fill('7');
  await page.mouse.click(area.x + 400, area.y + 360);
  await page.mouse.click(area.x + 520, area.y + 360);
  await expect
    .poll(async () =>
      (await read(page)).elements
        .filter((e) => e.type === 'text')
        .map((e) => e.text),
    )
    .toEqual(['1', '2', '3', '7', '8']);
  await expect(
    page.getByRole('spinbutton', { name: '下一球标编号' }),
  ).toHaveValue('9');
  const data = await read(page),
    circles = data.elements.filter((e) => e.type === 'ellipse'),
    texts = data.elements.filter((e) => e.type === 'text');
  expect(circles).toHaveLength(5);
  expect(texts).toHaveLength(5);
  for (const circle of circles) {
    expect(circle.strokeColor).toBe('#e03131');
    expect(circle.width).toBeCloseTo(circle.height);
    expect(circle.groupIds).toHaveLength(1);
    expect(circle.boundElements).toHaveLength(1);
    const label = texts.find((t) => t.containerId === circle.id);
    expect(label.groupIds).toEqual(circle.groupIds);
    expect(label.strokeColor).toBe(circle.strokeColor);
    expect(label.fontFamily).toBeGreaterThan(0);
  }
  await expect(
    page.getByRole('spinbutton', { name: '下一球标编号' }),
  ).toBeInViewport();
  await page.screenshot({ path: 'test-results/balloon-style-panel.png' });
  await page.keyboard.press('Escape');
  await expect(number).toHaveAttribute('aria-pressed', 'false');
  const count = (await read(page)).elements.length;
  await page.mouse.click(area.x + 680, area.y + 430);
  await page.waitForTimeout(600);
  expect((await read(page)).elements.length).toBe(count);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  await expect
    .poll(
      async () =>
        (await read(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(8);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z',
  );
  await expect
    .poll(
      async () =>
        (await read(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(10);
  await number.click();
  await expect(
    page.getByRole('spinbutton', { name: '下一球标编号' }),
  ).toHaveValue('9');
  await page.keyboard.press('Escape');
  await page.getByText('工作区管理', { exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  const centers = await page.locator('.settings-heading').evaluate((el) =>
    [...el.children].map((e) => {
      const b = e.getBoundingClientRect();
      return b.y + b.height / 2;
    }),
  );
  expect(Math.abs(centers[0] - centers[1])).toBeLessThan(0.6);
  await page.getByRole('button', { name: 'WebDAV 功能设置说明' }).click();
  await page.screenshot({ path: 'test-results/aligned-webdav.png' });
  await page
    .getByRole('dialog', { name: 'WebDAV 设置' })
    .screenshot({ path: 'test-results/aligned-webdav-dialog.png' });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await app.close();
  app = null;
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p = await app.firstWindow();
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await expect(p.getByRole('spinbutton', { name: '下一球标编号' })).toHaveValue(
    '9',
  );
  expect((await read(p)).elements.filter((e) => !e.isDeleted)).toHaveLength(10);
  expect(errors).toEqual([]);
  console.log(
    'PASS: six-theme toolbar/header alignment, WebDAV heading center, native styles, 1/2/3 then 7/8 placement, grouped bound labels, Escape, undo/redo, persisted counter',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
