import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'canvas-appearance-'));
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
try {
  let page = await launch();
  await page.evaluate(async () => {
    const b = window.workspace;
    const parent = await b.invoke('create', 'folder', null, '主题预览');
    const child = await b.invoke('create', 'folder', parent, '场景设计');
    const id = await b.invoke('create', 'document', child, '主题白板');
    await b.invoke('setSetting', 'activeDocument', id);
  });
  await app.close();
  app = null;
  page = await launch();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const data = () =>
    page.evaluate(async () => {
      const b = window.workspace;
      return b.invoke('read', await b.invoke('getSetting', 'activeDocument'));
    });
  await page
    .locator('label')
    .filter({ has: page.locator('[data-testid="toolbar-rectangle"]') })
    .click();
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.move(canvas.x + 260, canvas.y + 200);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 460, canvas.y + 350, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await data()).data.elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(1);
  await page.waitForTimeout(650);
  const original = (await data()).data;
  mkdirSync('test-results', { recursive: true });
  const palette = await page
    .locator('.theme-picker svg')
    .evaluate((element) => element.outerHTML);
  for (const theme of ['github', 'reddit', 'vscode', 'notion']) {
    await page
      .getByRole('combobox', { name: '界面主题', exact: true })
      .selectOption(theme);
    await expect(page.locator('.workspace')).toHaveAttribute(
      'data-theme',
      theme,
    );
    await expect(page.locator('.root [data-ui-icon="home"]')).toHaveAttribute(
      'data-icon-theme',
      theme,
    );
    await expect(page.locator('.theme-picker svg')).toHaveAttribute(
      'width',
      '20',
    );
    expect(
      await page
        .locator('.theme-picker svg')
        .evaluate((element) => element.outerHTML),
    ).toBe(palette);
    const controls = await Promise.all(
      [
        page.getByRole('button', { name: '文件信息', exact: true }),
        page.getByRole('button', { name: '画布只读', exact: true }),
        page.getByRole('combobox', { name: '界面主题', exact: true }),
      ].map((element) => element.boundingBox()),
    );
    expect(
      Math.max(...controls.map((box) => box.y + box.height / 2)) -
        Math.min(...controls.map((box) => box.y + box.height / 2)),
    ).toBeLessThanOrEqual(1);
    await expect(
      page.locator('[data-ui-icon="folder"]').first(),
    ).toHaveAttribute('data-icon-theme', theme);
    await expect(page.locator('.node-title').first()).toHaveCSS(
      'font-size',
      '13px',
    );
    const highlight = await page.locator('.tree-row.active').evaluate((row) => {
      const style = row.ownerDocument.defaultView.getComputedStyle(row);
      const sample = row.ownerDocument.createElement('span');
      sample.style.backgroundColor = 'var(--tree-selected)';
      row.append(sample);
      const expected = row.ownerDocument.defaultView.getComputedStyle(sample)
        .backgroundColor;
      sample.remove();
      return { actual: style.backgroundColor, expected };
    });
    expect(highlight.actual).toBe(highlight.expected);
    await page.waitForTimeout(650);
    expect((await data()).data).toEqual(original);
    await page.screenshot({ path: `test-results/theme-${theme}.png` });
    await page
      .getByRole('button', { name: '主题白板 操作', exact: true })
      .click();
    await page
      .locator('.file-menu')
      .screenshot({ path: `test-results/theme-${theme}-menu.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '隐藏文件栏', exact: true }).click();
    await expect(page.locator('.files')).toBeHidden();
    await page.getByRole('button', { name: '隐藏场景', exact: true }).click();
    await expect(page.locator('.scenes')).toBeHidden();
    await page.getByRole('button', { name: '显示文件栏', exact: true }).click();
    await expect(page.locator('.files')).toBeVisible();
    await page.getByRole('button', { name: '显示场景', exact: true }).click();
  }
  await page
    .getByRole('combobox', { name: '界面主题', exact: true })
    .selectOption('github');
  await page
    .locator('.canvas')
    .getByRole('button', { name: '缩小', exact: true })
    .click();
  const originalRevision = (await data()).revision;
  const center = await page.locator('.canvas').boundingBox();
  await page.mouse.click(
    center.x + center.width / 2,
    center.y + center.height / 2,
    { button: 'middle', clickCount: 2, delay: 80 },
  );
  await expect(page.locator('.canvas .reset-zoom-button')).toContainText(
    '100%',
  );
  await page.waitForTimeout(650);
  expect((await data()).revision).toBe(originalRevision);
  await page.locator('.canvas .main-menu-trigger').click();
  const menu = page.locator('.canvas .dropdown-menu-container');
  await expect(menu).toBeVisible();
  await expect(menu).not.toContainText(
    /保存到|导出图片|Excalidraw links|Follow us|Discord/,
  );
  await expect(
    menu.getByRole('link', { name: 'GitHub', exact: true }),
  ).toHaveAttribute('href', 'https://github.com/layzerff/excalidraw');
  await menu.screenshot({ path: 'test-results/canvas-menu.png' });
  await menu.getByText('帮助', { exact: true }).click();
  await expect(page.locator('.HelpDialog')).toBeVisible();
  await expect(page.locator('.HelpDialog__header')).toBeHidden();
  const macKeys = await page.locator('.HelpDialog kbd').allTextContents();
  expect(macKeys.join(' ')).toMatch(/Cmd|⌘/);
  await page
    .locator('.HelpDialog')
    .screenshot({ path: 'test-results/help-mac.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.HelpDialog')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: '界面主题', exact: true })
    .selectOption('vscode');
  await page.getByRole('button', { name: '隐藏文件栏', exact: true }).click();
  await app.close();
  app = null;
  page = await launch();
  await expect(
    page.getByRole('combobox', { name: '界面主题', exact: true }),
  ).toHaveValue('vscode');
  await expect(page.locator('.files')).toBeHidden();
  await page.getByRole('button', { name: '显示文件栏', exact: true }).click();
  await app
    .context()
    .addInitScript(() =>
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' }),
    );
  await page.reload();
  await expect(page.locator('.excalidraw')).toBeVisible();
  await page.locator('.canvas .main-menu-trigger').click();
  await page
    .locator('.canvas .dropdown-menu-container')
    .getByText('帮助', { exact: true })
    .click();
  await expect(page.locator('.HelpDialog')).toBeVisible();
  const winKeys = await page.locator('.HelpDialog kbd').allTextContents();
  expect(winKeys.join(' ')).toMatch(/Ctrl/);
  expect(winKeys.join(' ')).not.toMatch(/⌘/);
  await page
    .locator('.HelpDialog')
    .screenshot({ path: 'test-results/help-windows-simulated.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: four themes without document mutations, independent sidebars, middle-double-click 100%, custom menu, hidden help links, Mac and simulated Win32 shortcut labels, persisted appearance',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
