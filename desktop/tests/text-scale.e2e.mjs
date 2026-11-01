import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-text-scale-');
let app;
const read = (p) =>
  p.evaluate(async () => {
    const b = window.workspace;
    return (
      await b.invoke('read', await b.invoke('getSetting', 'activeDocument'))
    ).data;
  });
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
  await p.getByRole('button', { name: '自增球标', exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 450, y: 280 } });
  await p.keyboard.press('Escape');
  await expect.poll(async () => (await read(p)).elements.length).toBe(2);
  const initial = await read(p),
    text = initial.elements.find((e) => e.type === 'text'),
    circle = initial.elements.find((e) => e.type === 'ellipse');
  await p.evaluate(
    async ({ text, circle }) => {
      const b = window.workspace;
      await b.invoke('create', 'document', null, 'Large text', {
        elements: [
          {
            ...text,
            id: 'free-text',
            containerId: null,
            groupIds: [],
            boundElements: null,
            x: 350,
            y: 150,
            fontSize: 50,
            width: (text.width / text.fontSize) * 50,
            height: text.lineHeight * 50,
            text: '1',
            originalText: '1',
          },
        ],
        files: {},
        scenes: [],
        appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0 },
      });
      await b.invoke('create', 'document', null, 'Large circle', {
        elements: [
          { ...circle, x: 350, y: 160, width: 280, height: 280 },
          {
            ...text,
            x: 440,
            y: 220,
            fontSize: 100,
            width: text.width * 5,
            height: text.height * 5,
          },
        ],
        files: {},
        scenes: [],
        appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0 },
      });
    },
    { text, circle },
  );
  await p.reload();
  await p.getByText('Large text', { exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 370, y: 170 } });
  const range = p.getByRole('slider', { name: '字号比例', exact: true }),
    num = p.getByRole('spinbutton', { name: '字号比例数值', exact: true });
  await expect(range).toBeVisible();
  await expect(p.locator('[data-testid^="fontSize-"]')).toHaveCount(4);
  await range.fill('20');
  await range.press('Tab');
  await expect
    .poll(async () => (await read(p)).elements[0].fontSize)
    .toBeCloseTo(20, 1);
  await range.fill('80');
  await range.press('Tab');
  await expect
    .poll(async () => (await read(p)).elements[0].fontSize)
    .toBeCloseTo(80, 1);
  await num.focus();
  await num.press('Meta+A');
  await num.pressSequentially('65');
  await num.press('Tab');
  await expect
    .poll(async () => (await read(p)).elements[0].fontSize)
    .toBeCloseTo(65, 1);
  await p.screenshot({ path: 'test-results/r9-text-scale.png' });
  await p.keyboard.press('Escape');
  await p.keyboard.press('t');
  await p.locator('.canvas').dblclick({ position: { x: 540, y: 400 } });
  const editor = p.locator('textarea.excalidraw-wysiwyg');
  await expect(editor).toBeVisible();
  await editor.fill('Inherited');
  await editor.press('Escape');
  await expect
    .poll(
      async () =>
        (await read(p)).elements.filter((e) => e.type === 'text').length,
    )
    .toBe(2);
  expect(
    (await read(p)).elements.find((e) => e.text === 'Inherited').fontSize,
  ).toBeCloseTo(65, 1);
  await p.getByText('Large circle', { exact: true }).click();
  await p.locator('.canvas').click({ position: { x: 490, y: 170 } });
  await expect(range).toBeVisible();
  await range.fill('40');
  await range.press('Tab');
  await expect
    .poll(
      async () =>
        (await read(p)).elements.find((e) => e.type === 'text').fontSize,
    )
    .toBeLessThan(100);
  let d = await read(p),
    one = d.elements.find((e) => e.type === 'text').fontSize;
  await range.fill('80');
  await range.press('Tab');
  await expect
    .poll(
      async () =>
        (await read(p)).elements.find((e) => e.type === 'text').fontSize,
    )
    .toBeCloseTo(one * 2, 1);
  d = await read(p);
  expect(d.elements.find((e) => e.type === 'ellipse').width).toBeCloseTo(
    d.elements.find((e) => e.type === 'ellipse').height,
    5,
  );
  for (const theme of [
    'github',
    'reddit',
    'vscode',
    'notion',
    'wechat',
    'discord',
  ]) {
    await p.locator('select[aria-label="界面主题"]').selectOption(theme);
    await p.screenshot({ path: 'test-results/r9-text-' + theme + '.png' });
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS text ratio 10–100: native presets retained; free text proportional, numeric keyboard/Tab, new-text inheritance and bound-circle relative scaling',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
