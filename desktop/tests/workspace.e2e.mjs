import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'canvas-workspace-'));
let app;
const errors = [];
async function launch() {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [resolve('.')],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('.excalidraw')).toBeVisible();
  return page;
}
try {
  let page = await launch();
  await page.evaluate(async () => {
    const bridge =
      document.getElementById('root').ownerDocument.defaultView.workspace;
    const parent = await bridge.invoke('create', 'folder', null, '项目设计');
    const child = await bridge.invoke('create', 'folder', parent, '方案讨论');
    const other = await bridge.invoke('create', 'folder', null, '参考资料');
    const otherDoc = await bridge.invoke(
      'create',
      'document',
      other,
      '参考白板',
    );
    const data = {
      elements: [],
      files: {},
      appState: {},
      scenes: [
        {
          id: 'first',
          title: '首页',
          rect: { x: 0, y: 0, width: 800, height: 600 },
        },
        {
          id: 'second',
          title: '方案详情',
          rect: { x: 1000, y: 0, width: 800, height: 600 },
        },
      ],
    };
    const id = await bridge.invoke(
      'create',
      'document',
      child,
      '产品方案',
      data,
    );
    await bridge.invoke('setSetting', 'activeDocument', id);
    return otherDoc;
  });
  await app.close();
  app = null;
  page = await launch();
  const row = (name) =>
    page
      .locator('.tree-row')
      .filter({ has: page.locator('.node-title', { hasText: name }) });
  const selected = page.locator('.folder-selected');
  await expect(selected).toHaveCount(2);
  await expect(row('项目设计')).toHaveClass(/folder-selected/);
  await expect(row('方案讨论')).toHaveClass(/folder-selected/);
  await expect(row('产品方案')).toHaveAttribute('data-depth', '2');
  expect(
    await row('产品方案').evaluate(
      (node) => getComputedStyle(node).paddingLeft,
    ),
  ).toBe('64px');
  await expect(row('产品方案').locator('.tree-guide')).toHaveCount(2);
  await row('参考资料').locator('.node-title').click();
  await row('产品方案').locator('.node-title').click();
  await expect(row('参考资料')).not.toHaveClass(/folder-selected/);
  await expect(selected).toHaveCount(2);
  await row('参考白板').locator('.node-title').click();
  await expect(selected).toHaveCount(1);
  await expect(row('参考资料')).toHaveClass(/folder-selected/);
  await expect(row('项目设计')).not.toHaveClass(/folder-selected/);
  await row('产品方案').locator('.node-title').click();
  await expect(selected).toHaveCount(2);
  expect(
    await page
      .locator('.logo')
      .evaluate((image) => image.complete && image.naturalWidth === 1024),
  ).toBe(true);
  expect(
    await page.locator('.logo').evaluate((image) => {
      const canvas = image.ownerDocument.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1],
      ].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
    }),
  ).toEqual([0, 0, 0, 0]);
  mkdirSync('test-results', { recursive: true });
  await row('项目设计')
    .getByRole('button', { name: '项目设计 操作', exact: true })
    .press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  expect((await page.locator('.file-menu').boundingBox()).x).toBeGreaterThan(
    50,
  );
  await expect(page.locator('.file-menu input, .file-menu select')).toHaveCount(
    0,
  );
  await expect(page.locator('.file-menu hr')).toHaveCount(2);
  await expect(
    page.getByRole('menuitem', { name: '移入回收站', exact: true }),
  ).toHaveClass(/danger-action/);
  await page
    .locator('.file-menu')
    .screenshot({ path: 'test-results/menu-actions.png' });
  await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '文件名称', exact: true }),
  ).toBeFocused();
  await expect(page.locator('.file-menu [role="menuitem"]')).toHaveCount(0);
  await page
    .getByRole('textbox', { name: '文件名称', exact: true })
    .fill('项目设计新版');
  await page
    .locator('.file-menu')
    .screenshot({ path: 'test-results/menu-rename.png' });
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(row('项目设计新版')).toBeVisible();
  await row('项目设计新版').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '移入回收站', exact: true }).click();
  await expect(page.locator('.menu-confirm')).toContainText(
    '磁盘上的关联文件不会被删除',
  );
  await page.getByRole('button', { name: '移入回收站', exact: true }).click();
  await expect(page.locator('.menu-error')).toBeVisible(); // Non-empty folder is protected.
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(row('项目设计新版')).toBeVisible();
  await row('参考资料').click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: '新建白板', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: '移入回收站', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('menuitem', { name: '新建白板', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.file-menu')).toHaveCount(0);
  await expect(page.locator('.root svg path')).toHaveAttribute(
    'stroke-width',
    '2.5',
  );
  await expect(
    row('项目设计').locator('.folder-toggle svg path'),
  ).toHaveAttribute('stroke-width', '3');
  await page
    .locator('label')
    .filter({ has: page.locator('[data-testid="toolbar-rectangle"]') })
    .click();
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.move(canvas.x + 250, canvas.y + 250);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 430, canvas.y + 360, { steps: 10 });
  await page.mouse.up();
  const documentData = () =>
    page.evaluate(async () => {
      const b = window.workspace;
      return (
        await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
      ).data;
    });
  await expect
    .poll(
      async () =>
        (await documentData()).elements.filter((element) => !element.isDeleted)
          .length,
    )
    .toBe(1);
  const original = (await documentData()).elements;
  await page.getByRole('button', { name: '画布只读', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '解除只读', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/readonly-current.png' });
  await page.mouse.move(canvas.x + 300, canvas.y + 300);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 500, canvas.y + 400, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(650);
  expect((await documentData()).elements).toEqual(original);
  await page.getByRole('button', { name: '解除只读', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '画布只读', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'test-results/workspace-021.png' });
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toBeVisible();
  await page.waitForTimeout(1200);
  expect(
    await page
      .locator('.presentation-controls')
      .evaluate((panel) =>
        [
          ...panel.querySelectorAll('button, label, select, option, span'),
        ].every((node) => getComputedStyle(node).fontSize === '14px'),
      ),
  ).toBe(true);
  await page.getByRole('button', { name: '图层', exact: true }).click();
  expect(
    await page
      .locator('.scenes')
      .evaluate((panel) =>
        [
          ...panel.querySelectorAll(
            'button, strong, small, input, .section-title',
          ),
        ].every((node) => getComputedStyle(node).fontSize === '14px'),
      ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/presentation-021.png' });
  await page.getByRole('button', { name: '图层', exact: true }).click();
  const loop = page.getByRole('button', { name: '循环演示', exact: true });
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await loop.click();
  await page.screenshot({ path: 'test-results/presentation-loop.png' });
  await page.getByLabel('自动演示停留时间').selectOption('1000');
  await page.getByRole('button', { name: '自动演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toContainText('2 / 2', {
    timeout: 6000,
  });
  await expect(page.locator('.presentation-controls')).toContainText('1 / 2', {
    timeout: 6000,
  });
  await expect(
    page.getByRole('button', { name: '暂停自动演示', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await loop.click();
  await expect(page.locator('.presentation-controls')).toContainText('2 / 2', {
    timeout: 6000,
  });
  await expect(
    page.getByRole('button', { name: '自动演示', exact: true }),
  ).toBeVisible();
  await loop.click(); // Persist the preference, not the playing state.
  await page.getByRole('button', { name: '退出演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toHaveCount(0);
  await row('产品方案').click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: '移动到文件夹', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: '移动到文件夹', exact: true })
    .selectOption({ label: '参考资料' });
  await expect(page.locator('.folder-selected')).toHaveCount(2); // Choice alone never moves.
  await page
    .locator('.file-menu')
    .screenshot({ path: 'test-results/menu-move.png' });
  await page.getByRole('button', { name: '移动到此处', exact: true }).click();
  await expect(selected).toHaveCount(1);
  await expect(row('参考资料')).toHaveClass(/folder-selected/);
  await expect(row('项目设计')).not.toHaveClass(/folder-selected/);
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.folder-selected')).toHaveCount(1);
  await expect(page.locator('.folder-selected')).toContainText('参考资料');
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '循环演示', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '自动演示', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'PASS: ancestor highlighting, indentation/guides, move/restart, uniform fonts, transparent logo corners, read-only drag/delete protection, automatic loop wrap/stop and persisted preference',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
