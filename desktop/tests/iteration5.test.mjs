import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmbed, embedOrigins, allowEmbedRequest } from '../src/embeds.mjs';
import { setLanguage, translate } from '../src/i18n.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  LibraryLink,
  sourceURL,
  downloadLibrary,
} = require('../electron/libraries.cjs');
test('generic HTTPS embeds reject executable, local, credentials, and insecure schemes', () => {
  for (const s of [
    'http://nas.local/',
    'file:///tmp/secret',
    'javascript:alert(1)',
    'https://user:pw@nas.local',
    'data:text/html,hi',
    'not a url',
  ])
    assert.equal(parseEmbed(s), null);
  assert.equal(
    parseEmbed('https://nas.local:5001/page').origin,
    'https://nas.local:5001',
  );
  assert.equal(parseEmbed('https://youtu.be/M7lc1UVf-VE').kind, 'video');
  assert.deepEqual(
    embedOrigins([
      { type: 'embeddable', link: 'https://nas.local/a' },
      { type: 'embeddable', link: 'https://nas.local/b' },
      { type: 'embeddable', link: 'https://other.local', isDeleted: true },
    ]),
    ['https://nas.local'],
  );
});
test('desktop networking requires consent and prevents remote file access and main navigation', () => {
  const approved = new Set(['https://nas.local']);
  assert.equal(
    allowEmbedRequest(
      { url: 'https://nas.local/a', resourceType: 'subFrame' },
      new Set(),
    ),
    false,
  );
  assert.equal(
    allowEmbedRequest(
      { url: 'https://nas.local/a', resourceType: 'subFrame' },
      approved,
    ),
    true,
  );
  const frame = {
    url: 'https://nas.local/a',
    parent: { url: 'file:///app/index.html' },
  };
  assert.equal(
    allowEmbedRequest(
      { url: 'https://cdn.example/a.js', resourceType: 'script', frame },
      approved,
    ),
    true,
  );
  assert.equal(
    allowEmbedRequest(
      { url: 'https://cdn.example/a.js', resourceType: 'script', frame },
      new Set(),
    ),
    false,
  );
  for (const url of [
    'file:///private/secret',
    'http://nas.local/x',
    'https://example.com',
  ])
    assert.equal(
      allowEmbedRequest({ url, resourceType: 'mainFrame', frame }, approved),
      false,
    );
  assert.equal(
    allowEmbedRequest(
      { url: 'file:///private/secret', resourceType: 'subFrame', frame },
      approved,
    ),
    false,
  );
  assert.equal(
    allowEmbedRequest(
      {
        url: 'https://example.com',
        resourceType: 'fetch',
        frame: { url: 'file:///app/index.html' },
      },
      approved,
    ),
    false,
  );
});
test('library callback needs current catalog token and trusted source', () => {
  const l = new LibraryLink(),
    catalog = new URL(l.catalog()),
    token = catalog.searchParams.get('token');
  const source =
    'https://libraries.excalidraw.com/libraries/example/test.excalidrawlib';
  assert.equal(
    l.receive(
      'localcanvas://library#' +
        new URLSearchParams({ addLibrary: source, token: 'bad' }),
    ),
    false,
  );
  assert.equal(
    l.receive(
      'localcanvas://library#' +
        new URLSearchParams({ addLibrary: source, token }),
    ),
    true,
  );
  assert.equal(l.take(), source);
  assert.equal(l.take(), null);
  for (const s of [
    'file:///tmp/a.excalidrawlib',
    'https://libraries.excalidraw.com.evil/x.excalidrawlib',
    'https://raw.githubusercontent.com/evil/repo/x.excalidrawlib',
    'https://libraries.excalidraw.com/libraries/a.html',
  ])
    assert.equal(sourceURL(s), null);
});
test('library downloads reject cross-host redirects and malformed JSON structures', async () => {
  const source = 'https://libraries.excalidraw.com/libraries/a.excalidrawlib';
  await assert.rejects(
    downloadLibrary(
      source,
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://evil.example/a.excalidrawlib' },
        }),
    ),
    /重定向/,
  );
  await assert.rejects(
    downloadLibrary(source, async () => new Response('{}')),
    /有效/,
  );
  assert.deepEqual(
    await downloadLibrary(
      source,
      async () =>
        new Response(
          JSON.stringify({
            type: 'excalidrawlib',
            version: 2,
            libraryItems: [],
          }),
        ),
    ),
    { type: 'excalidrawlib', version: 2, libraryItems: [] },
  );
});
test('UI language switches shell labels without translating arbitrary document content', () => {
  setLanguage('en');
  assert.equal(translate('打开文件…'), 'Open file…');
  assert.equal(translate('选择是否加载'), 'Choose whether to load');
  assert.equal(translate('My custom 中文 board'), 'My custom 中文 board');
  setLanguage('zh-CN');
  assert.equal(translate('打开文件…'), '打开文件…');
});
