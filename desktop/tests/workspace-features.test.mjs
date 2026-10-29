import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sortNodes } from '../src/tree.mjs';
import { parseVideo, allowVideoRequest } from '../src/videos.mjs';
const require = createRequire(import.meta.url);
const { Store } = require('../electron/store.cjs');
const { DatabaseSync } = require('node:sqlite');
const dav = require('../electron/webdav.cjs');
test('legacy database migration, stable custom order, creation time, moves and backup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-order-'));
  const path = join(dir, 'workspace.sqlite');
  let s;
  try {
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE nodes(id TEXT PRIMARY KEY,parent TEXT,kind TEXT,title TEXT,data TEXT,revision INTEGER DEFAULT 0,deleted INTEGER DEFAULT 0,updated INTEGER); INSERT INTO nodes VALUES('old',NULL,'folder','旧目录',NULL,0,0,123)",
    );
    db.close();
    s = new Store(path);
    assert.equal(s.node('old').created, 123);
    const a = s.create('document', 'old', '白板10'),
      b = s.create('document', 'old', '白板2');
    s.reorder('old', [b, a]);
    assert.deepEqual(
      sortNodes(
        s.list().filter((n) => n.parent === 'old'),
        'custom',
      ).map((n) => n.id),
      [b, a],
    );
    assert.deepEqual(
      sortNodes(
        s.list().filter((n) => n.parent === 'old'),
        'name',
      ).map((n) => n.id),
      [b, a],
    );
    const created = s.node(a).created;
    s.rename(a, '新名称');
    s.move(a, null);
    assert.equal(s.node(a).created, created);
    assert.throws(() => s.reorder(null, [a, a]));
    s.setSetting('webdavSecret', 'encrypted-secret');
    s.setSetting('webdavConfig', 'private-endpoint');
    const backup = s.backup();
    assert.ok(!JSON.stringify(backup).includes('encrypted-secret'));
    assert.ok(!backup.settings.some((v) => v.key.startsWith('webdav')));
    const root = s.restore(backup);
    const restored = s
      .list()
      .find((n) => n.parent === root && n.title === '新名称');
    assert.equal(restored.created, created);
    assert.equal(restored.position, s.node(a).position);
    s.close();
    s = new Store(path);
    assert.equal(s.node(b).created > 0, true);
  } finally {
    s?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('video URLs normalized without executable or untrusted hosts', () => {
  assert.equal(parseVideo('https://youtu.be/M7lc1UVf-VE').provider, 'YouTube');
  assert.equal(
    parseVideo('https://www.bilibili.com/video/BV1B7411m7LV/?p=2').provider,
    'Bilibili',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'http://youtu.be/M7lc1UVf-VE',
    'https://b23.tv/abc',
    'https://evil.test/player.html',
  ])
    assert.equal(parseVideo(url), null);
  assert.equal(
    allowVideoRequest({
      url: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
      resourceType: 'subFrame',
    }),
    true,
  );
  assert.equal(
    allowVideoRequest({ url: 'https://example.com', resourceType: 'subFrame' }),
    false,
  );
  assert.equal(
    allowVideoRequest({
      url: 'https://www.youtube.com/s/script.js',
      resourceType: 'script',
      frame: { url: 'file:///app' },
    }),
    false,
  );
  assert.equal(
    allowVideoRequest({
      url: 'https://video.googlevideo.com/video',
      resourceType: 'media',
      frame: { url: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE' },
    }),
    true,
  );
  assert.equal(
    allowVideoRequest({
      url: 'https://www.youtube.com',
      resourceType: 'mainFrame',
    }),
    false,
  );
});
test('WebDAV explicit HTTP opt-in, credentials, no-overwrite and redirect protection', async () => {
  assert.throws(() =>
    dav.config({ url: 'http://nas.local/dav', username: 'u' }),
  );
  assert.throws(() =>
    dav.config({ url: 'https://u:p@nas.local/dav', username: 'u' }),
  );
  const config = { url: 'https://nas.local/dav/', username: 'u' };
  let call;
  const fetcher = async (url, options) => {
    call = { url: String(url), options };
    return new Response('{}', { status: 201 });
  };
  await dav.request(
    config,
    'p',
    'PUT',
    'local-canvas-test.json',
    '{}',
    fetcher,
  );
  assert.equal(call.url, 'https://nas.local/dav/local-canvas-test.json');
  assert.equal(call.options.redirect, 'error');
  assert.equal(call.options.headers['If-None-Match'], '*');
  assert.equal(call.options.headers.Authorization, 'Basic dTpw');
  await assert.rejects(
    dav.request(config, 'p', 'GET', '../secret', null, fetcher),
  );
  await assert.rejects(
    dav.request(
      config,
      'p',
      'PROPFIND',
      '',
      null,
      async () => new Response('', { status: 401 }),
    ),
    /401/,
  );
  assert.deepEqual(
    await dav.request(
      config,
      'p',
      'GET',
      'local-canvas-test.json',
      null,
      async () => new Response('{"version":1}'),
    ),
    { version: 1 },
  );
});
