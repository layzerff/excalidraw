import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(tmpdir() + '/canvas-media-');
let app;
async function launch() {
  app = await electron.launch({
    args: [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p = await app.firstWindow();
  await expect(p.locator('.excalidraw')).toBeVisible();
  return p;
}
try {
  let page = await launch();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER', m.text());
  });
  page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(async () => {
    const b = window.workspace;
    await b.invoke('create', 'document', null, '白板10');
    await b.invoke('create', 'document', null, '白板2');
    await b.invoke(
      'create',
      'folder',
      null,
      '这是一个非常非常非常非常非常长的目录名称应该省略而不是挤压图标',
    );
  });
  await app.close();
  app = null;
  page = await launch();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER', m.text());
  });
  page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()));
  await page.getByRole('combobox', { name: '目录排序' }).selectOption('name');
  const names = await page.locator('.tree .node-name').allTextContents();
  expect(names.indexOf('白板2')).toBeLessThan(names.indexOf('白板10'));
  const long = page.locator('.node-title').filter({ hasText: '这是一个非常' });
  expect(
    await long
      .locator('svg')
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(12);
  expect(
    await long
      .locator('.node-name')
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.getByRole('combobox', { name: '目录排序' }).selectOption('custom');
  const rows = page.locator('.tree .tree-row');
  const before = await rows.locator('.node-name').allTextContents();
  const parentBefore = await page.evaluate(async () =>
    Object.fromEntries(
      (await window.workspace.invoke('list')).map((n) => [n.id, n.parent]),
    ),
  );
  const first = await rows.first().boundingBox(),
    last = await rows.last().boundingBox();
  await page.mouse.move(first.x + 80, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + 80, last.y + last.height - 2, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(() => page.locator('.tree .node-name').allTextContents())
    .not.toEqual(before);
  expect(
    await page.evaluate(async () =>
      Object.fromEntries(
        (await window.workspace.invoke('list')).map((n) => [n.id, n.parent]),
      ),
    ),
  ).toEqual(parentBefore);
  expect(await page.locator('.tree .node-name').allTextContents()).toEqual([
    ...before.slice(1),
    before[0],
  ]);
  await page
    .locator('.files')
    .screenshot({ path: 'test-results/directory-sorting.png' });
  await page.locator('.canvas .main-menu-trigger').click();
  await page.getByText('嵌入网页视频', { exact: true }).click();
  await page
    .getByRole('textbox', { name: '视频地址' })
    .fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: '添加到画布', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '▶ 操作 YouTube 视频' }),
  ).toBeVisible();
  await expect(page.locator('.video-card iframe')).toHaveCount(0);
  // A deterministic provider stand-in checks iframe interaction in both modes;
  // it does not claim real provider playback availability.
  const wave = Buffer.alloc(44 + 8000 * 2 * 15);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24);
  wave.writeUInt32LE(16000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(wave.length - 44, 40);
  const html = `<meta charset="utf-8"><body style="color:white"><audio id="media" src="data:audio/wav;base64,${wave.toString('base64')}" controls></audio><button onclick="document.getElementById('media').play();document.querySelector('output').textContent='播放'">播放</button><button onclick="document.getElementById('media').pause();document.querySelector('output').textContent='暂停'">暂停</button><input aria-label="进度" type="range" min="0" max="14" onchange="document.getElementById('media').currentTime=this.value"><output>就绪</output></body>`;
  await app
    .context()
    .route('https://www.youtube-nocookie.com/embed/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
    );
  await page.getByRole('button', { name: '▶ 操作 YouTube 视频' }).click();
  const player = page.frameLocator('.video-card iframe');
  await player
    .getByRole('button', { name: '播放', exact: true })
    .click({ timeout: 5000 });
  await expect(player.locator('output')).toHaveText('播放');
  await player.getByRole('slider', { name: '进度' }).fill('6');
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(player.locator('output')).toHaveText('暂停');
  await page.getByRole('button', { name: '停止 / 返回画布' }).click();
  await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await expect(page.locator('.workspace')).toHaveClass(/presenting/);
  // Fullscreen resizes the canvas and animates to the first scene.
  await page.waitForTimeout(750);
  await page.getByRole('button', { name: '▶ 操作 YouTube 视频' }).click();
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await player.getByRole('slider', { name: '进度' }).fill('3');
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(player.locator('output')).toHaveText('暂停');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(() => player.locator('audio').evaluate((media) => media.paused))
    .toBe(false);
  const time = await player
    .locator('audio')
    .evaluate((media) => media.currentTime);
  await page.getByRole('button', { name: '下一场景', exact: true }).click();
  await expect
    .poll(() => player.locator('audio').evaluate((media) => media.paused))
    .toBe(true);
  const pausedTime = await player
    .locator('audio')
    .evaluate((media) => media.currentTime);
  expect(pausedTime).toBeGreaterThanOrEqual(time);
  expect(pausedTime - time).toBeLessThan(1);
  await page.getByRole('button', { name: '上一场景', exact: true }).click();
  // Navigation intentionally pauses the player; resume after its 0.5s animation.
  await page.waitForTimeout(650);
  await page
    .getByRole('combobox', { name: '自动演示停留时间' })
    .selectOption('1000');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(() => player.locator('audio').evaluate((media) => media.paused))
    .toBe(false);
  await page.getByRole('button', { name: '自动演示', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '下一场景', exact: true }),
  ).toBeDisabled({ timeout: 5000 });
  await expect
    .poll(() => player.locator('audio').evaluate((media) => media.paused))
    .toBe(true);
  expect(
    await player.locator('body').evaluate(() => typeof window.workspace),
  ).toBe('undefined');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({
    path: 'test-results/video-presentation-fixture.png',
  });
  await page.getByRole('button', { name: '停止 / 返回画布' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.workspace')).not.toHaveClass(/presenting/);
  await page.getByText('工作区管理', { exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'WebDAV 设置' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '上传工作区备份' }),
  ).toBeDisabled();
  await page.screenshot({ path: 'test-results/webdav-settings.png' });
  await page
    .getByRole('dialog', { name: 'WebDAV 设置' })
    .screenshot({ path: 'test-results/webdav-dialog.png' });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await app.close();
  app = null;
  page = await launch();
  await expect(page.getByRole('combobox', { name: '目录排序' })).toHaveValue(
    'custom',
  );
  await expect(
    page.getByRole('button', { name: '▶ 操作 YouTube 视频' }),
  ).toBeVisible();
  console.log(
    'PASS: name/custom sorting, real pointer reorder, fixed tree icons, video embedding/persistence and fixture controls in editor/presentation, WebDAV entry',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
