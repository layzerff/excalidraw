import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url),
  { startServer } = require('../web/server.cjs');
test('NAS authentication, CSRF, persistence, backup and stale revisions', async () => {
  const directory = mkdtempSync(tmpdir() + '/canvas-web-test-');
  let server, davServer;
  const options = {
    directory,
    username: 'tester',
    password: 'test-password-123456',
    port: 0,
  };
  const auth =
    'Basic ' +
    Buffer.from(options.username + ':' + options.password).toString('base64');
  try {
    server = startServer(options);
    await once(server, 'listening');
    let base = `http://127.0.0.1:${server.address().port}`;
    const call = async (action, ...args) => {
      const r = await fetch(base + '/api/workspace', {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          'X-Local-Canvas': '1',
        },
        body: JSON.stringify({ action, args }),
      });
      const body = await r.json();
      return { status: r.status, ...body };
    };
    assert.equal((await fetch(base)).status, 401);
    assert.equal(
      (await fetch(base, { headers: { Authorization: auth } })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + '/api/workspace', {
          method: 'POST',
          headers: {
            Authorization: auth,
            'Content-Type': 'application/json',
            'X-Local-Canvas': '1',
            Origin: 'https://evil.example',
          },
          body: '{}',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + '/../electron/store.cjs', {
          headers: { Authorization: auth },
        })
      ).status,
      404,
    );
    let rows = (await call('list')).value;
    const id = rows[0].id;
    const data = (await call('read', id)).value.data;
    data.scenes = [
      {
        id: 's1',
        title: '场景',
        rect: { x: 0, y: 0, width: 100, height: 100 },
      },
    ];
    assert.equal((await call('save', id, data, 0)).value, 1);
    assert.equal((await call('save', id, data, 0)).status, 400);
    const bundle = (await call('backup')).value;
    assert.equal(bundle.format, 'local-canvas-workspace');
    await call('restore', bundle);
    assert.equal((await call('list')).value.length, 3);
    let uploaded;
    davServer = createServer(async (req, res) => {
      if (
        req.headers.authorization !==
        'Basic ' + Buffer.from('u:secret').toString('base64')
      ) {
        res.writeHead(401);
        res.end();
        return;
      }
      if (req.method === 'PROPFIND') {
        res.writeHead(207, { 'Content-Type': 'application/xml' });
        res.end(
          '<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>',
        );
        return;
      }
      if (req.method === 'PUT') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        uploaded = Buffer.concat(chunks);
        res.writeHead(201);
        res.end();
        return;
      }
      res.writeHead(uploaded ? 200 : 404, {
        'Content-Type': 'application/json',
      });
      res.end(uploaded || '');
    });
    davServer.listen(0, '127.0.0.1');
    await once(davServer, 'listening');
    await call('webdavSave', {
      url: `http://127.0.0.1:${davServer.address().port}/dav/`,
      allowHttp: true,
      username: 'u',
      password: 'secret',
    });
    assert.equal((await call('webdavInfo')).value.hasPassword, true);
    assert.equal((await call('webdavTest')).status, 200);
    assert.equal((await call('getSetting', 'webdavSecret')).value, null);
    assert.equal(
      (await call('backup')).value.settings.some((s) =>
        s.key.startsWith('webdav'),
      ),
      false,
    );
    const remoteName = (await call('webdavBackup')).value;
    assert.equal(JSON.parse(uploaded).format, 'local-canvas-workspace');
    assert.equal(
      JSON.parse(uploaded).settings.some((s) => s.key.startsWith('webdav')),
      false,
    );
    assert.equal((await call('webdavRestore', remoteName)).status, 200);
    await new Promise((resolve) => server.close(resolve));
    server = null;
    assert.ok(
      readdirSync(directory + '/backups').some((f) => f.endsWith('.json')),
    );
    server = startServer(options);
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await call('read', id)).value.data.scenes[0].title, '场景');
    assert.equal((await call('webdavInfo')).value.hasPassword, true);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (davServer) await new Promise((resolve) => davServer.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
