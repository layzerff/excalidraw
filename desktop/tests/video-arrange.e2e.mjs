import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const profile = mkdtempSync(tmpdir() + '/canvas-video-fix-');
mkdirSync('test-results', { recursive: true });
let app;
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
  });
  const wave = Buffer.alloc(44 + 8000 * 2 * 20);
  wave.write('RIFF');
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
  const html = `<meta charset="utf-8"><body style="background:#dde7f0"><h3>播放器交互测试（模拟视频站点）</h3><audio controls src="data:audio/wav;base64,${wave.toString('base64')}"></audio><button onclick="document.body.dataset.clicks=String(Number(document.body.dataset.clicks||0)+1);document.querySelector('audio').play().catch(e=>document.body.dataset.err=e.message)">播放</button><button onclick="document.querySelector('audio').pause()">暂停</button><input aria-label="进度" type="range" min="0" max="19" onchange="document.querySelector('audio').currentTime=this.value"></body>`;
  let releasePlayer;
  const playerReady = new Promise((resolve) => {
    releasePlayer = resolve;
  });
  await app
    .context()
    .route('https://www.youtube-nocookie.com/embed/**', async (r) => {
      await playerReady;
      await r.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
  await expect(page.locator('.excalidraw')).toBeVisible();
  const top = page
    .locator('.App-toolbar')
    .getByRole('button', { name: '嵌入网页 / 视频', exact: true });
  await expect(top).toBeVisible();
  await top.click();
  await page
    .getByRole('textbox', { name: '网页或视频地址' })
    .fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: '添加到画布', exact: true }).click();
  const iframe = page.locator('.video-embed iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toBeVisible();
  const saved = () =>
    page.evaluate(async () => {
      const b = window.workspace,
        id = await b.invoke('getSetting', 'activeDocument');
      return (await b.invoke('read', id)).data;
    });
  await expect.poll(async () => (await saved()).elements.length).toBe(1);
  let before = (await saved()).elements[0];
  let box = await iframe.boundingBox();
  // Native dragging on the element's edge (not player controls).
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 70, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved()).elements[0].x)
    .not.toBe(before.x);
  const moved = (await saved()).elements[0];
  box = await page
    .locator('.excalidraw__embeddable-container__inner')
    .boundingBox();
  // Bottom-right native resize handle belongs to the canvas, never the iframe.
  await page.mouse.move(box.x + box.width, box.y + box.height);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 50, box.y + box.height + 30, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved()).elements[0].width)
    .not.toBe(moved.width);
  box = await iframe.boundingBox();
  const panBefore = box.x;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 70, box.y + 55, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await expect
    .poll(async () => (await iframe.boundingBox()).x)
    .not.toBe(panBefore);
  box = await iframe.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  releasePlayer();
  const player = page.frameLocator('.video-embed iframe');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(() => player.locator('audio').evaluate((m) => m.paused))
    .toBe(false);
  await player.getByRole('slider', { name: '进度' }).fill('5');
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  expect(
    await player.locator('audio').evaluate((m) => m.currentTime),
  ).toBeGreaterThanOrEqual(5);
  await page.getByRole('button', { name: '返回画布编辑 · Esc' }).click();
  await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await page
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await page.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await page.waitForTimeout(1400);
  await expect(iframe).toBeVisible();
  box = await iframe.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const globalBox = await iframe.boundingBox(),
    size = await iframe.evaluate((f) => ({
      w: f.clientWidth,
      h: f.clientHeight,
    })),
    localBox = await player
      .getByRole('button', { name: '播放', exact: true })
      .evaluate((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
  await page.mouse.click(
    globalBox.x + ((localBox.x + localBox.w / 2) * globalBox.width) / size.w,
    globalBox.y + ((localBox.y + localBox.h / 2) * globalBox.height) / size.h,
  );
  await expect
    .poll(() => player.locator('audio').evaluate((m) => m.paused))
    .toBe(false);
  await player.getByRole('slider', { name: '进度' }).fill('8');
  expect(
    await player.locator('audio').evaluate((m) => m.currentTime),
  ).toBeGreaterThanOrEqual(8);
  await page.screenshot({
    path: 'test-results/video-native-presentation-fixture.png',
  });
  await page.getByRole('button', { name: '下一场景', exact: true }).click();
  await expect
    .poll(() => player.locator('audio').evaluate((m) => m.paused))
    .toBe(true);
  if (
    await page.getByRole('button', { name: '返回画布编辑 · Esc' }).isVisible()
  )
    await page.getByRole('button', { name: '返回画布编辑 · Esc' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.workspace')).not.toHaveClass(/presenting/);
  box = await iframe.boundingBox();
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.keyboard.press('Backspace');
  await expect(iframe).toHaveCount(0);
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  await expect(iframe).toHaveCount(1);
  console.log(
    'PASS video: immediate frame, native drag/resize/delete/undo, editor and presentation playback/seek, scene pause',
  );
  // Add a separate layout fixture by reusing a fully populated native element.
  const id = await page.evaluate(async () => {
    const b = window.workspace,
      active = await b.invoke('getSetting', 'activeDocument'),
      data = (await b.invoke('read', active)).data;
    const template = data.elements[0];
    const elements = [
      ['a', 40, 40, 80, 40],
      ['b', 260, 130, 120, 60],
      ['c', 500, 280, 60, 80],
    ].map(([id, x, y, width, height], index) => ({
      ...template,
      id,
      type: 'rectangle',
      link: null,
      x,
      y,
      width,
      height,
      angle: 0,
      groupIds: [],
      isDeleted: false,
      version: 1,
      versionNonce: index + 1,
      index: null,
    }));
    return b.invoke('create', 'document', null, '自动整理测试', {
      elements,
      scenes: [],
      files: {},
      appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    });
  });
  await page.reload();
  await expect(page.locator('.excalidraw')).toBeVisible();
  if (await page.getByRole('dialog', { name: '加载外部网页' }).isVisible())
    await page.getByRole('button', { name: '保持阻止' }).click();
  await page.getByText('自动整理测试', { exact: true }).click();
  await page.getByRole('button', { name: '自动整理', exact: true }).click();
  await page.getByRole('button', { name: '框选元素', exact: true }).click();
  const canvas = await page.locator('.canvas').boundingBox();
  await page.mouse.move(canvas.x + 10, canvas.y + 10);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 620, canvas.y + 410, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.getByText('已选择 3 个元素', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: '整理模式' })
    .selectOption('vertical');
  await page
    .getByRole('checkbox', { name: '整理后添加到演示列表（跟随所选元素）' })
    .check();
  await page.screenshot({ path: 'test-results/auto-arrange-dialog.png' });
  await page.getByRole('button', { name: '应用整理', exact: true }).click();
  await expect
    .poll(async () => {
      const d = await saved();
      return d.elements.every((e) => e.x === 40) && d.scenes.length === 1;
    })
    .toBe(true);
  const arranged = await saved();
  expect(arranged.elements.map((e) => e.y)).toEqual([40, 112, 204]);
  expect(arranged.scenes[0].binding.elementIds).toHaveLength(3);
  await page.screenshot({ path: 'test-results/auto-arrange.png' });
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 设置', exact: true }).click();
  await page.getByRole('button', { name: 'WebDAV 功能设置说明' }).click();
  await expect(page.getByRole('note')).toContainText('如何设置');
  await page.screenshot({ path: 'test-results/webdav-help.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS arrange: real rectangle selection, equal gaps, linked scene, WebDAV help, no runtime errors',
  );
} finally {
  if (app) await app.close();
  rmSync(profile, { recursive: true, force: true });
}
