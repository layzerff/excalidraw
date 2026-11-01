import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const { Store } = createRequire(import.meta.url)('../electron/store.cjs');
const profile = mkdtempSync('/tmp/canvas-r7-drawing-');
const densities = {
  rectangle: 50,
  ellipse: 75,
  diamond: 125,
  line: 150,
  freedraw: 175,
};
const store = new Store(profile + '/workspace.sqlite');
store.setSetting(
  'appPreferences',
  JSON.stringify({ autoCheckUpdates: false, fillDensityDefaults: densities }),
);
store.close();
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
  const draw = async (type, start, end) => {
    await p
      .locator('label')
      .filter({ has: p.getByTestId('toolbar-' + type) })
      .click();
    const a = await p.locator('.canvas').boundingBox();
    await p.mouse.move(a.x + start[0], a.y + start[1]);
    await p.mouse.down();
    await p.mouse.move(a.x + end[0], a.y + end[1], { steps: 20 });
    await p.mouse.up();
  };
  await draw('rectangle', [350, 220], [540, 390]);
  await p.getByRole('button', { name: '#ffc9c9', exact: true }).click();
  await p.getByTestId('fill-cross-hatch').click();
  const slider = p.getByRole('slider', { name: '填充密度', exact: true });
  await slider.fill('50');
  await slider.evaluate((e) => e.blur());
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements[0]?.customData?.localCanvasFillDensity,
    )
    .toBe(50);
  await p.locator('.canvas').click({ position: { x: 850, y: 650 } });
  for (const [index, type] of [
    'rectangle',
    'ellipse',
    'diamond',
    'line',
    'freedraw',
  ].entries()) {
    await draw(
      type,
      [350 + ((index + 1) % 3) * 220, 220 + Math.floor((index + 1) / 3) * 220],
      [510 + ((index + 1) % 3) * 220, 340 + Math.floor((index + 1) / 3) * 220],
    );
    await expect
      .poll(
        async () =>
          (await read(p)).data.elements.filter((e) => !e.isDeleted).length,
      )
      .toBe(index + 2);
    await expect
      .poll(async () => (await read(p)).data.elements.at(-1)?.width)
      .toBeGreaterThan(120);
    await expect
      .poll(async () => (await read(p)).data.elements.at(-1)?.height)
      .toBeGreaterThan(85);
    await expect
      .poll(
        async () =>
          (await read(p)).data.elements.at(-1)?.customData
            ?.localCanvasFillDensity ?? 100,
      )
      .toBe(densities[type]);
    const e = (await read(p)).data.elements.at(-1);
    expect(e.type).toBe(type);
    expect(e.width).toBeGreaterThan(120);
    expect(e.height).toBeGreaterThan(85);
    expect(e.customData?.localCanvasFillDensity ?? 100).toBe(densities[type]);
    if (['rectangle', 'ellipse', 'diamond'].includes(type)) {
      await p.getByRole('button', { name: '#ffc9c9', exact: true }).click();
      await p.getByTestId('fill-cross-hatch').click();
      const fill = p.getByRole('slider', { name: '填充密度', exact: true });
      for (const density of [190, densities[type]]) {
        await fill.fill(String(density));
        await fill.evaluate((n) => n.blur());
        await expect
          .poll(
            async () =>
              (await read(p)).data.elements.find((n) => n.id === e.id)
                ?.customData?.localCanvasFillDensity,
          )
          .toBe(density);
        const updated = (await read(p)).data.elements.find(
          (n) => n.id === e.id,
        );
        expect(updated.fillStyle).toBe('cross-hatch');
        expect(updated.width).toBe(e.width);
        expect(updated.height).toBe(e.height);
      }
    }
  }
  // Density inheritance must preserve native draw undo/redo.
  await p.getByTestId('button-undo').click();
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(5);
  await p.getByTestId('button-redo').click();
  await expect
    .poll(
      async () =>
        (await read(p)).data.elements.filter((e) => !e.isDeleted).length,
    )
    .toBe(6);
  await p.getByTestId('toolbar-selection').locator('..').click();
  await p.locator('.canvas').click({ position: { x: 440, y: 300 } });
  const canvas = await p.locator('.canvas').boundingBox();
  const original = (await read(p)).data.elements[0];
  await p.mouse.move(canvas.x + 540, canvas.y + 390);
  await p.mouse.down();
  await p.mouse.move(canvas.x + 590, canvas.y + 420, { steps: 12 });
  await p.mouse.up();
  await expect
    .poll(async () => (await read(p)).data.elements[0]?.width)
    .toBeGreaterThan(original.width + 35);
  const before = (await read(p)).data.elements.map((e) => ({
    id: e.id,
    width: e.width,
    height: e.height,
    fillStyle: e.fillStyle,
  }));
  await p.screenshot({ path: 'test-results/r7-new-drawing-density.png' });
  // Restart exercises pre-existing document shapes, not just current gesture objects.
  await app.close();
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p2 = await app.firstWindow();
  p2.on('pageerror', (e) => errors.push(e.message));
  await expect(p2.locator('.excalidraw')).toBeVisible();
  await p2.getByTestId('toolbar-selection').locator('..').click();
  await p2.locator('.canvas').click({ position: { x: 430, y: 280 } });
  const range = p2.getByRole('slider', { name: '填充密度', exact: true });
  await expect(range).toBeVisible();
  await p2.getByTestId('fill-cross-hatch').click();
  for (const density of [150, 25, 175, 70]) {
    await range.fill(String(density));
    await range.evaluate((e) => e.blur());
    await expect
      .poll(
        async () =>
          (await read(p2)).data.elements.filter(
            (e) => e.customData?.localCanvasFillDensity === density,
          ).length,
      )
      .toBeGreaterThan(0);
    // Assert actual static-canvas ink, not just fillStyle metadata or export.
    await expect
      .poll(async () =>
        p2.locator('.canvas canvas.static').evaluate((canvas) => {
          const scale = canvas.width / canvas.getBoundingClientRect().width,
            w = Math.round(100 * scale),
            h = w;
          const data = canvas
            .getContext('2d')
            .getImageData(
              Math.round(390 * scale),
              Math.round(250 * scale),
              w,
              h,
            ).data;
          const red = (x, y) => {
            if (x < 0 || y < 0 || x >= w || y >= h) return false;
            const i = (y * w + x) * 4;
            return (
              data[i] > 200 &&
              data[i] - data[i + 1] > 20 &&
              data[i + 1] > 140 &&
              data[i + 3] > 50
            );
          };
          let count = 0,
            positive = 0,
            negative = 0;
          for (let y = 5; y < h - 5; y++)
            for (let x = 5; x < w - 5; x++)
              if (red(x, y)) {
                count++;
                let pos = false,
                  neg = false;
                for (let d = -1; d <= 1; d++)
                  for (let z = -1; z <= 1; z++) {
                    pos ||= red(x + 4 + d, y + 4 + z);
                    neg ||= red(x + 4 + d, y - 4 + z);
                  }
                if (pos) positive++;
                if (neg) negative++;
              }
          return Math.min(count / 4, positive, negative);
        }),
      )
      .toBeGreaterThan(60);
    const current = (await read(p2)).data.elements;
    for (const original of before) {
      const e = current.find((e) => e.id === original.id);
      expect(e.width).toBe(original.width);
      expect(e.height).toBe(original.height);
    }
    expect(
      current
        .filter(
          (e) =>
            e.type === 'rectangle' ||
            e.type === 'ellipse' ||
            e.type === 'diamond',
        )
        .every((e) => e.fillStyle === 'cross-hatch'),
    ).toBe(true);
  }
  await p2.screenshot({ path: 'test-results/r7-existing-cross-density.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: non-default density then rectangle/ellipse/diamond/line/freedraw retain geometry; restart-existing shapes keep dimensions and cross-hatch across repeated density changes',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
