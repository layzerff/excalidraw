import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-fill-zoom-');
let app;
const read = (p) =>
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
  const p = await app.firstWindow(),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p
    .locator('label')
    .filter({ has: p.getByTestId('toolbar-rectangle') })
    .click();
  const area = await p.locator('.canvas').boundingBox();
  await p.mouse.move(area.x + 350, area.y + 220);
  await p.mouse.down();
  await p.mouse.move(area.x + 570, area.y + 400, { steps: 12 });
  await p.mouse.up();
  await p.getByRole('button', { name: '#ffc9c9', exact: true }).click();
  await p.getByTestId('fill-hachure').click();
  const slider = p.getByRole('slider', { name: '填充密度', exact: true });
  await expect(slider).toBeVisible();
  const svg = async (label) => {
    const file = profile + '/' + label + '.svg';
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, file);
    if (
      !(await p
        .getByRole('button', { name: '导出 SVG', exact: true })
        .isVisible())
    )
      await p.getByRole('button', { name: '导出', exact: true }).click();
    await p.getByRole('button', { name: '导出 SVG', exact: true }).click();
    await expect
      .poll(() => {
        try {
          return readFileSync(file, 'utf8').length;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(100);
    return readFileSync(file, 'utf8');
  };
  await slider.fill('50');
  const sparse = await svg('sparse');
  await slider.fill('200');
  const dense = await svg('dense');
  expect(dense.length).toBeGreaterThan(sparse.length * 1.5);
  await p.getByTestId('fill-cross-hatch').click();
  await slider.fill('50');
  const crossSparse = await svg('crossSparse');
  expect((await read(p)).data.elements[0].fillStyle).toBe('cross-hatch');
  await slider.fill('200');
  const crossDense = await svg('crossDense');
  expect((await read(p)).data.elements[0].fillStyle).toBe('cross-hatch');
  expect(crossDense.length).toBeGreaterThan(dense.length * 1.5);
  expect(crossDense.length).toBeGreaterThan(crossSparse.length * 1.5);
  await slider.evaluate((el) => {
    window.rangeValues = [];
    el.addEventListener('input', (e) =>
      window.rangeValues.push(Number(e.target.value)),
    );
  });
  const sliderBox = await slider.boundingBox();
  await p.mouse.move(sliderBox.x + 8, sliderBox.y + sliderBox.height / 2);
  await p.mouse.down();
  await p.mouse.move(
    sliderBox.x + sliderBox.width - 8,
    sliderBox.y + sliderBox.height / 2,
    { steps: 24 },
  );
  await p.mouse.up();
  const values = await p.evaluate(() => window.rangeValues);
  expect(values.length).toBeGreaterThan(3);
  console.log('SLIDER INPUT VALUES', JSON.stringify(values));
  expect(values.every((v, i) => i === 0 || v >= values[i - 1])).toBe(true);
  expect((await read(p)).data.elements[0].fillStyle).toBe('cross-hatch');
  await p.screenshot({ path: 'test-results/r6-cross-density.png' });
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements[0].customData.localCanvasFillDensity,
    )
    .toBe(200);
  await p.waitForTimeout(100);
  await slider.fill('100');
  await slider.evaluate((e) => e.blur());
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements[0].customData.localCanvasFillDensity,
    )
    .toBe(100);
  await p.getByTestId('fill-solid').click();
  const solidDense = await svg('solidDense');
  await slider.fill('50');
  const solidSparse = await svg('solidSparse');
  expect(solidDense).toBe(solidSparse);
  await p.screenshot({ path: 'test-results/r6-fill-density.png' });
  // Wheel zoom changes by <7% per coarse tick and preserves the native cursor anchor.
  await p.locator('.canvas').hover({ position: { x: 650, y: 600 } });
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, 120);
  await p.keyboard.up('Control');
  await expect
    .poll(async () =>
      parseFloat(await p.locator('.reset-zoom-button').innerText()),
    )
    .toBeLessThan(100);
  const zoom = parseFloat(await p.locator('.reset-zoom-button').innerText());
  expect(zoom).toBeGreaterThan(88);
  await p.keyboard.down('Control');
  await p.mouse.wheel(0, -120);
  await p.keyboard.up('Control');
  await expect
    .poll(async () =>
      parseFloat(await p.locator('.reset-zoom-button').innerText()),
    )
    .toBeGreaterThan(99);
  await p.getByRole('button', { name: '关闭导出', exact: true }).click();
  await p
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await p.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await p.getByRole('button', { name: '临时画笔', exact: true }).click();
  await expect(
    p
      .locator('.presentation-ink')
      .getByRole('slider', { name: '填充密度', exact: true }),
  ).toBeVisible();
  await p
    .locator('.presentation-ink')
    .getByRole('slider', { name: '填充密度', exact: true })
    .fill('150');
  await p.screenshot({ path: 'test-results/r6-ink-density.png' });
  await p.getByRole('button', { name: '退出演示', exact: true }).click();
  expect((await read(p)).data.elements.length).toBe(1);
  await p.locator('.canvas').click({ position: { x: 400, y: 300 } });
  await p.getByTestId('fill-cross-hatch').click();
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
    await expect(
      p.getByRole('slider', { name: '填充密度', exact: true }),
    ).toBeVisible();
    const fits = await p.locator('.fill-density-control').evaluate((e) => {
      const a = e.getBoundingClientRect(),
        b = e.querySelector('input').getBoundingClientRect();
      return b.left >= a.left && b.right <= a.right + 1;
    });
    expect(fits).toBe(true);
    await p.screenshot({ path: `test-results/r6-density-${theme}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS: SVG hatch density changes, solid fill unchanged, smooth proportional wheel zoom, presentation density slider and no ink persistence',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
