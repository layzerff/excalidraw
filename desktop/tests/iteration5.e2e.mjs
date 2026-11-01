import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { Store } = require('../electron/store.cjs');
const profile = mkdtempSync('/tmp/canvas-r5-'),
  db = new Store(profile + '/workspace.sqlite');
db.setSetting('appPreferences', JSON.stringify({ autoCheckUpdates: false }));
db.close();
let app, p;
const errors = [];
mkdirSync('test-results', { recursive: true });
const read = () =>
  p.evaluate(async () =>
    window.workspace.invoke(
      'read',
      await window.workspace.invoke('getSetting', 'activeDocument'),
    ),
  );
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  p = await app.firstWindow();
  p.on('pageerror', (e) => errors.push(e.message));
  await expect(p.locator('.excalidraw')).toBeVisible();
  await expect(p.locator('.workspace-tools')).not.toContainText('WebDAV');
  await expect(
    p.getByRole('searchbox', { name: '搜索画布文字' }),
  ).toBeVisible();
  await p
    .locator('label')
    .filter({ has: p.getByTestId('toolbar-text') })
    .click();
  await p.locator('.canvas').click({ position: { x: 500, y: 600 } });
  await p.keyboard.type('Find me text');
  await p.keyboard.press('Escape');
  await p.getByRole('searchbox', { name: '搜索画布文字' }).fill('Find me');
  await expect(p.locator('.workspace-search-results')).toContainText(
    'Find me text',
  );
  await p.locator('.workspace-search-results button').click();
  await p.getByRole('searchbox', { name: '搜索画布文字' }).fill('');

  await p.getByRole('button', { name: '连接状态', exact: true }).click();
  await expect(
    p.getByRole('button', { name: '立即同步（上传备份）' }),
  ).toBeDisabled();
  await expect(p.locator('.connection-popover')).toContainText('WebDAV 未配置');
  await p.locator('.files .section-title').click({ position: { x: 5, y: 5 } });
  await p.getByRole('button', { name: '打开设置' }).click();
  await p.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await expect(
    p.getByRole('dialog', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole('searchbox', { name: 'Search canvas text' }),
  ).toBeVisible();
  await expect(
    p.getByRole('button', { name: 'Embed web / video', exact: true }),
  ).toBeVisible();
  await p.screenshot({ path: 'test-results/r5-settings-en.png' });
  await p.getByRole('button', { name: 'Close settings' }).click();
  await p.reload();
  await expect(
    p.getByRole('searchbox', { name: 'Search canvas text' }),
  ).toBeVisible();
  await p.getByRole('button', { name: 'Open settings' }).click();
  await p
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('zh-CN');
  await p.getByRole('button', { name: '关闭设置' }).click();
  // Drag native selection tool and persist its visual order without switching tools.
  const toolbar = p.locator('.App-toolbar .Stack_horizontal');
  await p.getByRole('button', { name: '调整工具栏顺序', exact: true }).click();
  const a = await toolbar.locator('[data-local-tool="embed"]').boundingBox(),
    b = await toolbar
      .locator('[data-local-tool="toolbar-selection"]')
      .boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await p.mouse.up();
  await p.getByRole('button', { name: '调整工具栏顺序', exact: true }).click();
  const order = JSON.parse(
    await p.evaluate(() =>
      window.workspace.invoke('getSetting', 'toolbarOrder'),
    ),
  );
  expect(order.indexOf('embed')).toBeLessThan(
    order.indexOf('toolbar-selection'),
  );
  await p.reload();
  await expect(toolbar.locator('[data-local-tool="embed"]')).toBeVisible();
  expect(
    (await toolbar.locator('[data-local-tool="embed"]').boundingBox()).x,
  ).toBeLessThan(
    (
      await toolbar
        .locator('[data-local-tool="toolbar-selection"]')
        .boundingBox()
    ).x,
  );
  // HTTPS pages are a native editable embeddable, plus a working browser escape route.
  let requested = 0;
  await p.route('https://embed.example/**', async (route) => {
    requested++;
    await route.fulfill({
      contentType: 'text/html',
      body: '<html><body><button>Demo webpage</button><script>try{window.parent.workspace;window.parentAccessible=true;}catch{window.parentAccessible=false;}</script></body></html>',
    });
  });
  await p.getByRole('button', { name: '嵌入网页 / 视频', exact: true }).click();
  await p
    .getByRole('textbox', { name: '网页或视频地址' })
    .fill('https://embed.example/demo');
  await p.getByRole('button', { name: '添加到画布' }).click();
  await expect(
    p.locator('iframe[title="https://embed.example"]'),
  ).toBeVisible();
  await expect.poll(() => requested).toBeGreaterThan(0);
  const remote = p
    .frames()
    .find((f) => f.url().startsWith('https://embed.example/'));
  expect(
    await remote.evaluate(() => ({
      bridge: typeof window.workspace,
      parent: window.parentAccessible,
    })),
  ).toEqual({ bridge: 'undefined', parent: false });
  await expect(
    p.locator('iframe[title="https://embed.example"]'),
  ).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-presentation');
  await p.getByRole('button', { name: '嵌入网页 / 视频', exact: true }).click();
  await p
    .getByRole('textbox', { name: '网页或视频地址' })
    .fill('http://embed.example');
  await p.getByRole('button', { name: '添加到画布' }).click();
  await expect(p.getByRole('alert')).toContainText('HTTPS');
  await p.getByRole('button', { name: '取消', exact: true }).click();
  // Both manual save shortcuts must commit a new revision and capture viewport.
  const before = await read();
  await p.locator('.canvas').hover({ position: { x: 500, y: 650 } });
  await p.mouse.wheel(0, 300);
  await p.waitForTimeout(120);
  await p.keyboard.press('Control+s');
  await expect
    .poll(async () => (await read()).revision)
    .toBeGreaterThan(before.revision);
  const ctrl = await read();
  await p.locator('.canvas').hover({ position: { x: 500, y: 650 } });
  await p.mouse.wheel(0, 300);
  await p.waitForTimeout(120);
  await p.keyboard.press('Meta+s');
  await expect
    .poll(async () => (await read()).revision)
    .toBeGreaterThan(ctrl.revision);
  // Reload never loads the remote frame until consent is explicitly accepted.
  requested = 0;
  await p.reload();
  await expect(p.getByRole('dialog', { name: '加载外部网页' })).toBeVisible();
  expect(requested).toBe(0);
  await expect(p.locator('iframe[title="https://embed.example"]')).toHaveCount(
    0,
  );
  await p.getByRole('button', { name: '保持阻止' }).click();
  await p.waitForTimeout(500);
  expect(requested).toBe(0);
  const area = await p.locator('.canvas').boundingBox();
  await p.mouse.click(area.x + 500, area.y + 300, {
    button: 'middle',
    clickCount: 2,
  });
  await p.waitForTimeout(600);
  await p
    .locator('label')
    .filter({ has: p.getByTestId('toolbar-selection') })
    .click();
  const placeholder = await p.locator('.embed-placeholder').boundingBox();
  await p.mouse.dblclick(
    placeholder.x + placeholder.width / 2,
    placeholder.y + placeholder.height / 2,
  );
  await p.getByRole('button', { name: '选择是否加载' }).click();
  await p.getByRole('button', { name: '允许加载' }).click();
  await expect.poll(() => requested).toBeGreaterThan(0);
  // Native library panel offers external browse and local import, without search tab.
  await p.locator('.default-sidebar-trigger').click();
  await expect(p.getByRole('button', { name: '浏览在线素材库' })).toBeVisible();
  await expect(p.getByRole('button', { name: '导入素材库文件' })).toBeVisible();
  await expect(p.locator('[role=tab][id$="-trigger-search"]')).toBeHidden();
  await app.evaluate(({ shell }) => {
    shell.openExternal = async (value) => {
      globalThis.openedLibraryURL = value;
    };
  });
  await p.getByRole('button', { name: '浏览在线素材库' }).click();
  const catalog = await app.evaluate(() => globalThis.openedLibraryURL);
  expect(new URL(catalog).hostname).toBe('libraries.excalidraw.com');
  const token = new URL(catalog).searchParams.get('token');
  const callback =
    'localcanvas://library#' +
    new URLSearchParams({
      addLibrary:
        'https://libraries.excalidraw.com/libraries/example/demo.excalidrawlib',
      token,
    });
  await app.evaluate(
    ({ app }, value) => app.emit('open-url', { preventDefault() {} }, value),
    callback,
  );
  await expect(p.getByRole('dialog', { name: '安装素材库' })).toBeVisible();
  await p.getByRole('button', { name: '取消', exact: true }).click();
  if (!(await p.getByRole('button', { name: '导入素材库文件' }).isVisible()))
    await p.locator('.default-sidebar-trigger').click();
  const library = {
    type: 'excalidrawlib',
    version: 2,
    libraryItems: [
      {
        id: 'sample',
        status: 'unpublished',
        created: 1,
        elements: [
          {
            id: 'rectlib',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 80,
            height: 50,
            angle: 0,
            strokeColor: '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'hachure',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            index: null,
            roundness: null,
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false,
          },
        ],
      },
    ],
  };
  const file = profile + '/sample.excalidrawlib';
  writeFileSync(file, JSON.stringify(library));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await p.getByRole('button', { name: '导入素材库文件' }).click();
  await expect
    .poll(async () => (await read()).data.libraryItems?.length || 0)
    .toBe(1);
  await p.screenshot({ path: 'test-results/r5-library.png' });
  // All six themes keep common controls aligned.
  await p.getByTestId('sidebar-close').click();
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await p.getByRole('button', { name: '打开设置' }).click();
    await p.getByRole('combobox', { name: '设置界面主题' }).selectOption(theme);
    await p.getByRole('button', { name: '关闭设置' }).click();
    const rows = await p.locator('.files').evaluate((e) => {
      const selectors = [
        '.actions button',
        '.open-document',
        '.workspace-search-field',
        '.root',
      ];
      return selectors.map((s) => {
        const r = e.querySelector(s).getBoundingClientRect();
        return { y: r.y, h: r.height };
      });
    });
    expect(rows.map((r) => r.h)).toEqual([30, 30, 30, 30]);
    expect(rows[1].y - rows[0].y - 30).toBe(6);
    expect(rows[2].y - rows[1].y - 30).toBe(6);
    expect(rows[3].y - rows[2].y - 30).toBe(8);
    const sizes = await toolbar.locator('.ToolIcon__icon').evaluateAll((es) =>
      es
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { y: r.y + r.height / 2, h: r.height };
        }),
    );
    expect(
      Math.max(...sizes.map((x) => x.y)) - Math.min(...sizes.map((x) => x.y)),
    ).toBeLessThan(2);
    await p.screenshot({ path: `test-results/r5-${theme}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS: language persistence, network menu, toolbar reorder/restart, HTTPS consent/sandbox, invalid URL, Cmd+S/Ctrl+S, library import/persistence, six-theme alignment',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
