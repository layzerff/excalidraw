import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-r8-ink-');
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
    .getByRole('button', { name: '添加当前视图为场景', exact: true })
    .click();
  await p.getByRole('button', { name: '▶ 演示', exact: true }).click();
  await p.waitForTimeout(650);
  await p.getByRole('button', { name: '临时画笔', exact: true }).click();
  const ink = p.locator('.presentation-ink');
  const style = ink.getByRole('group', { name: '线条风格', exact: true }),
    border = ink.getByRole('group', { name: '边框样式', exact: true });
  await expect(style).toBeVisible();
  await expect(border).toBeVisible();
  const options = style.locator('label');
  await expect(options).toHaveCount(3);
  await options.nth(2).click();
  await border.locator('label').nth(1).click();
  await p.mouse.move(500, 300);
  await p.mouse.down();
  await p.mouse.move(850, 500, { steps: 40 });
  await p.mouse.up();
  await expect(ink).toHaveAttribute('data-ink-count', '1');
  const pixels = async () =>
    ink.locator('canvas.static').evaluate((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let red = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] > 120 && d[i] > d[i + 1] * 1.3 && d[i + 3] > 30) red++;
      return red;
    });
  await expect.poll(pixels).toBeGreaterThan(100);
  await p.screenshot({ path: 'test-results/r8-presentation-styles.png' });
  await p.getByRole('button', { name: '退出演示', exact: true }).click();
  expect((await read(p)).data.elements).toHaveLength(0);
  expect(errors).toEqual([]);
  console.log(
    'PASS: native stroke-style and roughness controls render in presentation; styled temporary stroke produces actual pixels; original board stays unchanged',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
