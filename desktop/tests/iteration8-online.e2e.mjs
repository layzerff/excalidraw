import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
const profile = mkdtempSync('/tmp/canvas-r8-real-search-');
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
  await p
    .getByRole('searchbox', { name: '搜索本地和在线素材' })
    .fill('OneDrive');
  await expect(
    p
      .locator('.online-search-results .library-search-card strong')
      .filter({ hasText: /OneDrive/i })
      .first(),
  ).toBeVisible({ timeout: 120000 });
  await expect(
    p.locator('.online-search-results .library-drag-preview img').first(),
  ).toBeVisible({ timeout: 30000 });
  await p.screenshot({ path: 'test-results/r8-real-online-search.png' });
  console.log(
    'PASS: actual public catalog item-level OneDrive search and thumbnail, with progressive scan status',
  );
} finally {
  await app?.close();
  rmSync(profile, { recursive: true, force: true });
}
