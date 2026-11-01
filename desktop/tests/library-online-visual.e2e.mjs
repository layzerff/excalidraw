import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-r7-online-visual-');
let app;
try {
  app = await electron.launch({
    executablePath: process.env.LOCAL_CANVAS_EXECUTABLE || undefined,
    args: process.env.LOCAL_CANVAS_EXECUTABLE ? [] : [process.cwd()],
    env: { ...process.env, LOCAL_CANVAS_DATA: profile },
  });
  const p = await app.firstWindow();
  await expect(p.locator('.excalidraw')).toBeVisible();
  await p.locator('.default-sidebar-trigger').click();
  await p.getByRole('button', { name: /Excalidraw 在线素材库/ }).click();
  await p
    .getByRole('button', { name: 'R Icons', exact: true })
    .click({ timeout: 35000 });
  await expect(
    p.locator('.online-library-catalog .library-drag-preview img').first(),
  ).toBeVisible({ timeout: 35000 });
  await p.screenshot({ path: 'test-results/r7-real-online-library.png' });
  console.log(
    'PASS: real official R Icons package thumbnails in updated library layout',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
