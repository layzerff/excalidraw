import { _electron as electron, expect } from '@playwright/test';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = mkdtempSync(join(tmpdir(), 'local-canvas-e2e-'));
mkdirSync('test-results', { recursive: true });
let app;
const errors = [];
async function launch() {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [resolve('.')],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30000 });
  return page;
}
async function data(page) {
  return page.evaluate(async () => {
    const b =
      document.getElementById('root').ownerDocument.defaultView.workspace;
    const id = await b.invoke('getSetting', 'activeDocument');
    return (await b.invoke('read', id)).data;
  });
}
async function storedDocument(page) {
  return page.evaluate(async () => {
    const b =
      document.getElementById('root').ownerDocument.defaultView.workspace;
    return b.invoke('read', await b.invoke('getSetting', 'activeDocument'));
  });
}
async function exportClick(page, name) {
  if (!(await page.getByRole('dialog', { name: '导出选项' }).isVisible()))
    await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: '关闭导出', exact: true }).click();
}
async function dragScene(page, source, target, bottom = false) {
  const from = await source.boundingBox(),
    to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 60, to.y + (bottom ? to.height - 3 : 2), {
    steps: 15,
  });
  await page.waitForTimeout(100);
  await page.mouse.up();
}
try {
  let page = await launch();
  console.log(
    'LAUNCHED',
    await app.evaluate(() => ({
      electron: process.versions.electron,
      sqlite: process.versions.sqlite,
    })),
  );
  const fonts = await page.evaluate(async () => {
    const result = {};
    for (const family of ['Excalifont', 'Virgil', 'Xiaolai']) {
      const faces = await document.fonts.load(
        `32px ${family}`,
        family === 'Xiaolai' ? '中文手写' : 'ABCabc',
      );
      result[family] =
        faces.length > 0 && faces.every((f) => f.status === 'loaded');
    }
    return result;
  });
  expect(fonts).toEqual({ Excalifont: true, Virgil: true, Xiaolai: true });
  await expect(
    page.getByRole('button', { name: '＋ 白板', exact: true }),
  ).toHaveCount(0);
  const saveBox = await page
    .getByRole('button', { name: '保存', exact: true })
    .boundingBox();
  const saveAsBox = await page
    .getByRole('button', { name: '另存为', exact: true })
    .boundingBox();
  expect(saveAsBox.y).toBe(saveBox.y);
  await expect(
    page
      .locator('.files > .actions')
      .getByRole('button', { name: '保存', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator('.scenes').getByRole('button', { name: '保存', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.scenes .duration select')).toHaveCount(0);
  await page.getByRole('button', { name: '保存当前视图', exact: true }).click();
  await expect(page.locator('.scene')).toHaveCount(1);
  await page.getByRole('button', { name: '＋ 框选区域', exact: true }).click();
  const box = await page.locator('.selection-layer').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 450, box.y + 350, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.scene')).toHaveCount(2);
  await expect(
    page.locator('.scenes').getByRole('button', { name: '导入素材库' }),
  ).toHaveCount(0);
  await page.locator('.scene').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '改名', exact: true }).click();
  await page.getByLabel('场景标题', { exact: true }).fill('局部细节');
  await page.getByLabel('场景标题', { exact: true }).press('Enter');
  await expect(page.locator('.modal')).toHaveCount(0);
  await page.locator('.scene').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '上移', exact: true }).click();
  await expect(page.locator('.scene').first()).toContainText('局部细节');
  await page.locator('.scene-target').first().dblclick();
  await page.getByLabel('场景标题', { exact: true }).fill('取消的名字');
  await page.getByLabel('场景标题', { exact: true }).press('Escape');
  await expect(page.locator('.scene').first()).toContainText('局部细节');
  await dragScene(
    page,
    page.locator('.drag-handle').first(),
    page.locator('.scene').last(),
    true,
  );
  await expect(page.locator('.scene').last()).toContainText('局部细节');
  await dragScene(
    page,
    page.locator('.drag-handle').last(),
    page.locator('.scene').first(),
  );
  await expect(page.locator('.scene').first()).toContainText('局部细节');
  // Exercise the upstream rectangle tool and native undo/redo using real pointer input.
  await page.locator('.canvas').click({ position: { x: 80, y: 150 } });
  await page
    .locator('label')
    .filter({ has: page.locator('[data-testid="toolbar-rectangle"]') })
    .click();
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.move(canvas.x + 450, canvas.y + 250);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 650, canvas.y + 400, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await data(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(1);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  await expect
    .poll(
      async () =>
        (await data(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(0);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z',
  );
  await expect
    .poll(
      async () =>
        (await data(page)).elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(1);
  const beforeNavigation = await storedDocument(page);
  const zoomButton = page
    .locator('.canvas')
    .getByRole('button', { name: '重置缩放', exact: true });
  const initialZoom = await zoomButton.innerText();
  await page.locator('.scene-target').first().click();
  await expect(zoomButton).not.toHaveText(initialZoom);
  await page.keyboard.press('Escape');
  // Confirm cancellation stops updates, rather than merely accepting the Escape key.
  await expect(page.locator('.save-state')).toHaveText('已保存到本机');
  const stopped = await zoomButton.innerText();
  await page.waitForTimeout(600);
  expect(await zoomButton.innerText()).toEqual(stopped);
  expect((await storedDocument(page)).revision).toBe(beforeNavigation.revision);
  await page.locator('.scene-target').last().click();
  await page.waitForTimeout(750);
  await page.locator('.canvas').hover({ position: { x: 500, y: 300 } });
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(750);
  expect((await storedDocument(page)).revision).toBe(beforeNavigation.revision);
  expect((await data(page)).appState).toEqual(beforeNavigation.data.appState);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+s' : 'Control+s',
  );
  await expect
    .poll(async () => (await storedDocument(page)).revision)
    .toBeGreaterThan(beforeNavigation.revision);
  expect((await data(page)).appState).not.toEqual(
    beforeNavigation.data.appState,
  );
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const manuallySaved = await storedDocument(page);
  await page.locator('.canvas').hover({ position: { x: 500, y: 300 } });
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(650);
  expect((await storedDocument(page)).revision).toBe(manuallySaved.revision);
  await page
    .locator('.canvas')
    .getByRole('button', { name: '#e03131', exact: true })
    .click();
  await expect
    .poll(async () => (await data(page)).elements[0].strokeColor)
    .toBe('#e03131');
  expect((await data(page)).appState).toEqual(manuallySaved.data.appState);
  await page.getByRole('button', { name: '隐藏场景', exact: true }).click();
  await expect(page.locator('.scene-panel-toggle')).toHaveCount(1);
  await expect(page.locator('.scenes')).toBeHidden();
  await page.getByRole('button', { name: '显示场景', exact: true }).click();
  await expect(page.locator('.scenes')).toBeVisible();
  await expect(page.locator('header .scene-panel-toggle')).toHaveCount(0);
  const originalElements = (await data(page)).elements;
  await page
    .getByRole('button', { name: '▧ 我的第一张白板', exact: true })
    .click();
  await page
    .getByRole('button', { name: '▧ 我的第一张白板', exact: true })
    .click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toBeVisible();
  expect(
    await page
      .locator('.presentation-controls')
      .evaluate((panel) =>
        [...panel.querySelectorAll('button, label, select, span')].every(
          (node) => getComputedStyle(node).fontSize === '14px',
        ),
      ),
  ).toBe(true);
  await page.waitForTimeout(1200); // macOS native fullscreen transition.
  await expect(page.locator('.presentation-controls')).toContainText('1 / 2');
  await page.getByRole('button', { name: '图层', exact: true }).click();
  await expect(page.locator('.scenes')).toBeVisible();
  await page.locator('.scene').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: '改名', exact: true }).click();
  await page.getByLabel('场景标题', { exact: true }).press('Enter');
  await page.getByRole('button', { name: '图层', exact: true }).click();
  await page.getByRole('button', { name: '图层', exact: true }).click();
  await dragScene(
    page,
    page.locator('.drag-handle').first(),
    page.locator('.scene').last(),
    true,
  );
  await expect(page.locator('.scene').last()).toContainText('局部细节');
  await dragScene(
    page,
    page.locator('.drag-handle').last(),
    page.locator('.scene').first(),
  );
  await expect(page.locator('.scene').first()).toContainText('局部细节');
  await page.screenshot({ path: 'test-results/layers-current.png' });
  await page.getByRole('button', { name: '图层', exact: true }).click();
  for (const speed of ['500', '1000', '1500', '2000'])
    await page.getByLabel('演示移动时长').selectOption(speed);
  await page.getByLabel('演示移动时长').selectOption('500');
  await expect(page.getByLabel('自动演示停留时间')).toHaveValue('3000');
  await page.getByLabel('自动演示停留时间').selectOption('1000');
  await page.getByRole('button', { name: '自动演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toContainText('2 / 2', {
    timeout: 7000,
  });
  await expect(
    page.getByRole('button', { name: '自动演示', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '上一场景', exact: true }).click();
  // Wait for the page transition and the new native editor's history baseline.
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '临时画笔', exact: true }).click();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(650, 400, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.presentation-ink')).toHaveAttribute(
    'data-ink-count',
    '1',
  );
  await page.waitForTimeout(150);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  await expect(page.locator('.presentation-ink')).toHaveAttribute(
    'data-ink-count',
    '0',
  );
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z',
  );
  await expect(page.locator('.presentation-ink')).toHaveAttribute(
    'data-ink-count',
    '1',
  );
  await expect(
    page
      .locator('.presentation-ink')
      .getByRole('group', { name: '描边宽度', exact: true }),
  ).toBeVisible();
  await page
    .locator('.presentation-ink')
    .getByRole('button', { name: '#1971c2', exact: true })
    .click();
  await page.screenshot({ path: 'test-results/presentation.png' });
  await page.getByRole('button', { name: '下一场景', exact: true }).click();
  await expect(page.locator('.presentation-ink')).toHaveAttribute(
    'data-ink-count',
    '0',
  );
  await page.getByRole('button', { name: '退出演示', exact: true }).click();
  await expect(page.locator('.presentation-controls')).toHaveCount(0);
  expect((await data(page)).elements).toEqual(originalElements);
  const lib = join(profile, 'sample.excalidrawlib');
  writeFileSync(
    lib,
    JSON.stringify({
      type: 'excalidrawlib',
      version: 2,
      libraryItems: [
        {
          id: 'local-test-library',
          status: 'unpublished',
          created: 1,
          elements: originalElements,
        },
      ],
    }),
  );
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, lib);
  const dropLibrary = () =>
    page.locator('.canvas > .excalidraw').evaluate(
      (element, json) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([json], 'sample.excalidrawlib', {
            type: 'application/vnd.excalidrawlib+json',
          }),
        );
        element.dispatchEvent(
          new DragEvent('drop', { bubbles: true, dataTransfer: transfer }),
        );
      },
      readFileSync(lib, 'utf8'),
    );
  await dropLibrary();
  await expect
    .poll(async () => (await data(page)).libraryItems?.length || 0)
    .toBe(1);
  await dropLibrary();
  await expect
    .poll(async () => (await data(page)).libraryItems?.length || 0)
    .toBe(1);
  const pdf = join(profile, 'scenes.pdf');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, pdf);
  await exportClick(page, '场景 PDF');
  await expect
    .poll(() => {
      try {
        return readFileSync(pdf).subarray(0, 5).toString();
      } catch {
        return '';
      }
    })
    .toBe('%PDF-');
  copyFileSync(pdf, 'test-results/scenes.pdf');
  await page.locator('.root').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '新建白板', exact: true }).click();
  await page.locator('.modal input').fill('第二张白板');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.locator('header strong')).toHaveText('第二张白板');
  await page
    .getByRole('button', { name: '▧ 我的第一张白板', exact: true })
    .click();
  await expect(page.locator('.scene')).toHaveCount(2);
  const exported = join(profile, 'document.canvas.json'),
    native = join(profile, 'document.excalidraw'),
    backup = join(profile, 'backup.json');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, exported);
  await exportClick(page, '导出完整文档');
  await expect
    .poll(() => {
      try {
        return JSON.parse(readFileSync(exported, 'utf8')).data.scenes.length;
      } catch {
        return 0;
      }
    })
    .toBe(2);
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, native);
  await exportClick(page, '导出 .excalidraw');
  await expect
    .poll(() => {
      try {
        return JSON.parse(readFileSync(native, 'utf8')).type;
      } catch {
        return '';
      }
    })
    .toBe('excalidraw');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, backup);
  await page.locator('.workspace-tools summary').click();
  await page.getByRole('button', { name: '备份工作区', exact: true }).click();
  await expect
    .poll(() => {
      try {
        return JSON.parse(readFileSync(backup, 'utf8')).format;
      } catch {
        return '';
      }
    })
    .toBe('local-canvas-workspace');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, backup);
  await page.getByRole('button', { name: '恢复备份', exact: true }).click();
  await expect(
    page.locator('.node-title').filter({ hasText: '恢复' }),
  ).toHaveCount(1);
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, exported);
  await page.getByRole('button', { name: '导入文档', exact: true }).click();
  await expect(
    page.locator('.node-title').filter({ hasText: '我的第一张白板' }),
  ).toHaveCount(3);
  await expect(page.locator('.scene')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/desktop.png' });
  // Close immediately with a newly queued scene: beforeunload must flush it.
  await page.getByRole('button', { name: '保存当前视图', exact: true }).click();
  await expect(page.locator('.scene')).toHaveCount(3);
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.scene')).toHaveCount(3);
  await expect(page.locator('.scene').first()).toContainText('局部细节');
  expect((await data(page)).libraryItems).toHaveLength(1);
  expect((await data(page)).elements.filter((e) => !e.isDeleted)).toHaveLength(
    1,
  );
  expect(errors).toEqual([]);
  await page.locator('.root').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '新建白板', exact: true }).click();
  await page.locator('.modal input').fill('字体与场景演示');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.locator('header select')).toHaveCount(0);
  await page
    .locator('label')
    .filter({ has: page.locator('[data-testid="toolbar-text"]') })
    .click();
  const textCanvas = await page.locator('.canvas').boundingBox();
  await page.mouse.click(textCanvas.x + 400, textCanvas.y + 180);
  await expect(page.locator('textarea')).toBeVisible();
  await page.locator('textarea').fill('ABCabc 中文手写');
  await expect(page.locator('textarea')).toHaveValue('ABCabc 中文手写');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect
    .poll(
      async () =>
        (await data(page)).elements.filter(
          (e) => e.type === 'text' && !e.isDeleted,
        ).length,
    )
    .toBe(1);
  await page.getByRole('button', { name: '保存当前视图', exact: true }).click();
  await page.getByRole('button', { name: '保存当前视图', exact: true }).click();
  await page.screenshot({ path: 'test-results/desktop-current.png' });
  const textPDF = join(profile, 'text.pdf');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, textPDF);
  await exportClick(page, '导出 PDF');
  await expect
    .poll(() => {
      try {
        return readFileSync(textPDF).subarray(0, 5).toString();
      } catch {
        return '';
      }
    })
    .toBe('%PDF-');
  copyFileSync(textPDF, 'test-results/text.pdf');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '框选导出区域', exact: true }).click();
  const regionBox = await page.locator('.selection-layer').boundingBox();
  await page.mouse.move(regionBox.x + 380, regionBox.y + 150);
  await page.mouse.down();
  await page.mouse.move(regionBox.x + 650, regionBox.y + 230, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: '导出选项' })).toContainText(
    '已框选区域',
  );
  await expect(page.locator('.scene')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/export-current.png' });
  const png = join(profile, 'region.png');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, png);
  await exportClick(page, '导出 PNG');
  await expect
    .poll(() => {
      try {
        return readFileSync(png).readUInt32BE(16);
      } catch {
        return 0;
      }
    })
    .toBe(540);
  expect(readFileSync(png).readUInt32BE(20)).toBe(160);
  copyFileSync(png, 'test-results/region.png');
  const svg = join(profile, 'region.svg');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, svg);
  await exportClick(page, '导出 SVG');
  await expect
    .poll(() => {
      try {
        return readFileSync(svg, 'utf8').includes('<svg');
      } catch {
        return false;
      }
    })
    .toBe(true);
  const croppedPDF = join(profile, 'region.pdf');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, croppedPDF);
  await exportClick(page, '导出 PDF');
  await expect
    .poll(() => {
      try {
        return readFileSync(croppedPDF).subarray(0, 5).toString();
      } catch {
        return '';
      }
    })
    .toBe('%PDF-');
  copyFileSync(croppedPDF, 'test-results/region.pdf');
  const saveAs = join(profile, 'save-as.canvas.json');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, saveAs);
  await page.getByRole('button', { name: '另存为', exact: true }).click();
  await expect
    .poll(() => {
      try {
        return JSON.parse(readFileSync(saveAs, 'utf8')).data.scenes.length;
      } catch {
        return 0;
      }
    })
    .toBe(2);
  await page.getByRole('button', { name: '文件信息', exact: true }).click();
  await expect(page.locator('.modal')).toContainText(saveAs);
  await page
    .locator('.modal')
    .getByRole('button', { name: '关闭', exact: true })
    .click();
  const sourceBefore = readFileSync(saveAs, 'utf8');
  writeFileSync(saveAs, `${sourceBefore}\n`);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('原文件已在外部修改');
  expect(readFileSync(saveAs, 'utf8')).toBe(`${sourceBefore}\n`);
  writeFileSync(saveAs, sourceBefore);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.save-state')).toHaveText('已保存到原文件');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, saveAs);
  await page.getByRole('button', { name: '打开文件…', exact: true }).click();
  await expect(page.locator('.scene')).toHaveCount(2);
  await page.locator('.root').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '新建文件夹', exact: true }).click();
  await page.locator('.modal input').fill('项目资料');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  const project = page.locator('.folder-row').filter({ hasText: '项目资料' });
  await expect(project.locator('.folder-icon')).toBeVisible();
  expect(
    await project
      .locator('.node-title')
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe('650');
  await project.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '新建文件夹', exact: true }).click();
  await page.locator('.modal input').fill('子资料');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  const subfolder = page.locator('.folder-row').filter({ hasText: '子资料' });
  await subfolder.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '新建白板', exact: true }).click();
  await page.locator('.modal input').fill('文件管理回归');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  const managed = page.locator('.tree-row').filter({ hasText: '文件管理回归' });
  await expect(managed).toBeVisible();
  await expect(page.locator('.folder-selected')).toHaveCount(2);
  const unrelated = page
    .locator('.folder-row')
    .filter({ hasText: '恢复 ' })
    .first();
  await unrelated.locator('.node-title').click();
  await managed.locator('.node-title').click();
  await expect(project).toHaveClass(/folder-selected/);
  await expect(subfolder).toHaveClass(/folder-selected/);
  await expect(unrelated).not.toHaveClass(/folder-selected/);
  await expect(managed).toHaveAttribute('data-depth', '2');
  expect(
    await managed.evaluate((node) => getComputedStyle(node).paddingLeft),
  ).toBe('64px');
  await expect(managed.locator('.tree-guide')).toHaveCount(2);
  await managed.click({ button: 'right' });
  await page
    .getByRole('combobox', { name: '移动到文件夹', exact: true })
    .selectOption('');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('.folder-selected')).toHaveCount(0);
  await managed.dragTo(project);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const nodes = await window.workspace.invoke('list');
        return (
          nodes.find((n) => n.title === '文件管理回归').parent ===
          nodes.find((n) => n.title === '项目资料').id
        );
      }),
    )
    .toBe(true);
  await managed.dragTo(page.locator('.root'));
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          (await window.workspace.invoke('list')).find(
            (n) => n.title === '文件管理回归',
          ).parent,
      ),
    )
    .toBe(null);
  const separator = page.getByRole('separator', {
    name: '左侧栏宽度',
    exact: true,
  });
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '250');
  await separator.press('ArrowLeft');
  await page
    .locator('.node-title')
    .filter({ hasText: '字体与场景演示' })
    .click();
  await expect(page.locator('.scene')).toHaveCount(2);
  const displayRow = page
    .locator('.tree-row')
    .filter({ hasText: '字体与场景演示' });
  await displayRow.click({ button: 'right' });
  await page
    .getByRole('combobox', { name: '移动到文件夹', exact: true })
    .selectOption({ label: '项目资料 / 子资料' });
  await expect(page.locator('.folder-selected')).toHaveCount(2);
  expect(
    await page
      .locator('.logo')
      .evaluate((image) => image.complete && image.naturalWidth === 1024),
  ).toBe(true);
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.screenshot({ path: 'test-results/files-current.png' });
  const relocated = join(profile, 'relocated');
  mkdirSync(relocated);
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, relocated);
  if (!(await page.locator('.workspace-tools').getAttribute('open')))
    await page.locator('.workspace-tools').evaluate((element) => {
      element.open = true;
    });
  await page.getByRole('button', { name: '保存位置', exact: true }).click();
  await expect(page.locator('.storage-path').first()).toContainText(profile);
  await page
    .getByRole('button', { name: '更改工作区位置', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '重启应用', exact: true }),
  ).toBeVisible();
  await app.close();
  app = null;
  page = await launch();
  await expect(page.locator('.scene')).toHaveCount(2);
  expect(
    (await data(page)).elements.filter(
      (e) => e.type === 'text' && !e.isDeleted,
    ),
  ).toHaveLength(1);
  await page.locator('.workspace-tools').evaluate((element) => {
    element.open = true;
  });
  await page.getByRole('button', { name: '保存位置', exact: true }).click();
  await expect(page.locator('.storage-path').first()).toContainText(relocated);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  console.log(
    'PASS: real Electron drawing, undo/redo, region selection, title, order, interrupted animation, document switching, file export/import, backup/restore, close-time flush, restart persistence',
  );
} catch (e) {
  if (app) {
    const p = await app.firstWindow();
    await p.screenshot({ path: 'test-results/failure.png' });
    console.log('ERRORS', errors);
    console.log('BODY', (await p.locator('body').innerText()).slice(-5000));
    console.log('DATA', JSON.stringify(await data(p)).slice(0, 2000));
  }
  throw e;
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
