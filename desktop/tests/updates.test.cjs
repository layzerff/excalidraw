const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  {
    mkdtempSync,
    rmSync,
    readFileSync,
    writeFileSync,
    existsSync,
  } = require('node:fs'),
  { tmpdir } = require('node:os'),
  { createHash } = require('node:crypto');
const {
  Updates,
  compare,
  selectRelease,
  assetURL,
} = require('../electron/updates.cjs');
const bytes = Buffer.from('test-installer-fixture'),
  digest = createHash('sha256').update(bytes).digest('hex');
const release = (tag, pre = false) => ({
  tag_name: tag,
  prerelease: pre,
  assets: [
    {
      name: 'Local-Canvas-win-x64-Setup.exe',
      size: bytes.length,
      digest: 'sha256:' + digest,
      browser_download_url:
        'https://github.com/layzerff/excalidraw/releases/download/' +
        tag +
        '/Local-Canvas-win-x64-Setup.exe',
    },
  ],
});
test('release channels use semantic versions, architecture and no downgrade', () => {
  assert.ok(compare('0.4.2-preview.10', '0.4.2-preview.2') > 0);
  assert.ok(compare('0.4.2', '0.4.2-preview.10') > 0);
  assert.equal(
    selectRelease(
      [release('v1.0.0'), release('v2.0.0-beta.1', true)],
      '0.4.2',
      'stable',
      'win32',
      'x64',
      false,
    ).version,
    '1.0.0',
  );
  assert.equal(
    selectRelease(
      [release('v1.0.0'), release('v2.0.0-beta.1', true)],
      '0.4.2',
      'preview',
      'win32',
      'x64',
      false,
    ).version,
    '2.0.0-beta.1',
  );
  assert.equal(
    selectRelease(
      [release('v0.4.1')],
      '0.4.2',
      'stable',
      'win32',
      'x64',
      false,
    ),
    null,
  );
  assert.throws(() => assetURL('https://evil.example/setup.exe'));
});
test('updates stream only trusted assets, verify hash and recheck before installation', async () => {
  const directory = mkdtempSync(tmpdir() + '/canvas-update-');
  try {
    const updater = new Updates({
      directory,
      current: '0.4.2',
      platform: 'win32',
      arch: 'x64',
      fetcher: async (url) =>
        new Response(
          url.includes('api.github.com')
            ? JSON.stringify([release('v1.0.0')])
            : bytes,
        ),
    });
    assert.equal((await updater.check()).status, 'available');
    assert.equal((await updater.download()).status, 'downloaded');
    const target = updater.verifiedPath();
    assert.deepEqual(readFileSync(target), bytes);
    writeFileSync(target, 'tampered');
    assert.throws(() => updater.verifiedPath(), /已变更/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('checksum mismatch and untrusted redirects never create installable files', async () => {
  const directory = mkdtempSync(tmpdir() + '/canvas-update-');
  try {
    const updater = new Updates({
      directory,
      current: '0.4.2',
      platform: 'win32',
      arch: 'x64',
      fetcher: async (url) =>
        new Response(
          url.includes('api.github.com')
            ? JSON.stringify([release('v1.0.0')])
            : Buffer.from('bad'),
        ),
    });
    await updater.check();
    await assert.rejects(() => updater.download(), /校验失败/);
    assert.throws(() => updater.verifiedPath());
    const redir = new Updates({
      directory,
      current: '0.4.2',
      platform: 'win32',
      arch: 'x64',
      fetcher: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/file' },
        }),
    });
    assert.equal((await redir.check()).status, 'error');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('missing checksum refuses automatic download and user can cancel pending download', async () => {
  const directory = mkdtempSync(tmpdir() + '/canvas-update-');
  try {
    const r = release('v1.0.0');
    delete r.assets[0].digest;
    const noHash = new Updates({
      directory,
      current: '0.4.2',
      platform: 'win32',
      arch: 'x64',
      fetcher: async () => new Response(JSON.stringify([r])),
    });
    await noHash.check();
    await assert.rejects(() => noHash.download(), /缺少 SHA-256/);
    const u = new Updates({
      directory,
      current: '0.4.2',
      platform: 'win32',
      arch: 'x64',
      fetcher: async (url, options) =>
        url.includes('api.github.com')
          ? new Response(JSON.stringify([release('v1.0.0')]))
          : new Promise((resolve, reject) => {
              options.signal.addEventListener('abort', () =>
                reject(Error('aborted')),
              );
            }),
    });
    await u.check();
    const task = u.download();
    const rejection = assert.rejects(task, /下载已取消/);
    u.cancel();
    await rejection;
    assert.equal(u.info().status, 'available');
    assert.throws(() => u.verifiedPath());
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
