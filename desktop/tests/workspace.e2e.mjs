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
  mkdirSync('test-results', { recursive: true });
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
  await page.getByRole('button', { name: '退出演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toHaveCount(0);
  await row('产品方案').click({ button: 'right' });
  await page
    .getByRole('combobox', { name: '移动到文件夹', exact: true })
    .selectOption({ label: '参考资料' });
  await expect(selected).toHaveCount(1);
  await expect(row('参考资料')).toHaveClass(/folder-selected/);
  await expect(row('项目设计')).not.toHaveClass(/folder-selected/);
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.folder-selected')).toHaveCount(1);
  await expect(page.locator('.folder-selected')).toContainText('参考资料');
  expect(errors).toEqual([]);
  console.log(
    'PASS: ancestor highlighting, stale-folder regression, nested indentation/guides, active-document move/restart, uniform presentation panel fonts, custom logo',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
