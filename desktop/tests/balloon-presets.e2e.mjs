import {balloonPresetSize} from '../src/balloons.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-balloon-preset-');
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
  const p = await app.firstWindow();
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 450, y: 280 } });
  await p.keyboard.press('Escape');
  await expect.poll(async () => (await read(p)).data.elements.length).toBe(2);
  const value = await read(p),
    circle = value.data.elements.find((e) => e.type === 'ellipse'),
    text = value.data.elements.find((e) => e.type === 'text');
  // Open an actual large-balloon fixture through the workspace, keeping native bindings.
  const id = await p.evaluate(
    async ({ circle, text }) => {
      const b = window.workspace;
      const size = 5;
      const el = {
        ...circle,
        x: 350,
        y: 180,
        width: circle.width * size,
        height: circle.height * size,
      };
      const tx = {
        ...text,
        x: 350 + (circle.width * size) / 2 - (text.width * size) / 2,
        y: 180 + (circle.height * size) / 2 - (text.height * size) / 2,
        width: text.width * size,
        height: text.height * size,
        fontSize: text.fontSize * size,
      };
      return b.invoke('create', 'document', null, '球标字号测试', {
        elements: [el, tx],
        files: {},
        scenes: [],
        appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0 },
      });
    },
    { circle, text },
  );
  await p.reload();
  await p.getByText('球标字号测试', { exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 490, y: 190 } });
  let last = 0;
  for (const [index,grade] of ['small', 'medium', 'large', 'veryLarge'].entries()) {
    const current=(await read(p)).data;const expected=balloonPresetSize(current.elements,current.elements.find(e=>e.type==='text'),[16,20,28,36][index]);
    await p
      .locator('label')
      .filter({ has: p.getByTestId('fontSize-' + grade) })
      .click();
    await expect
      .poll(async () => {
        const d = (await read(p)).data;
        return d.elements.find((e) => e.type === 'text').fontSize;
      })
      .toBe(expected);
    const d = (await read(p)).data;
    const n = d.elements.find((e) => e.type === 'text');
    expect(n.fontSize).toBeGreaterThan(36);
    expect(n.fontSize).toBeGreaterThan(last);
    expect(d.balloonSize.fontSize).toBe(n.fontSize);
    last = n.fontSize;
  }
  await p.screenshot({ path: 'test-results/r6-balloon-presets.png' });
  const before = (await read(p)).data.elements.find(
    (e) => e.type === 'ellipse',
  );
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 720, y: 520 } });
  await p.keyboard.press('Escape');
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter((e) => e.type === 'ellipse')
          .length,
    )
    .toBe(2);
  const d = (await read(p)).data;
  expect(d.elements.filter((e) => e.type === 'text').at(-1).fontSize).toBe(
    last,
  );
  expect(d.elements.filter((e) => e.type === 'ellipse').at(-1).width).toBe(
    before.width,
  );
  console.log(
    'PASS: resized balloon S/M/L/XL use relative native font metrics, sizes remain >36, saved inheritance and next balloon match',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
