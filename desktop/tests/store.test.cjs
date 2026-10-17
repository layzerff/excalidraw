const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store, blank } = require('../electron/store.cjs');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'local-canvas-test-'));
  const path = join(dir, 'workspace.sqlite');
  const store = new Store(path);
  t.after(() => {
    try {
      store.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, path };
}
test('save survives restart with images, viewport and ordered scenes', (t) => {
  const { store, path } = fixture(t),
    id = store.list()[0].id;
  const data = {
    ...blank(),
    elements: [{ id: 'shape', type: 'rectangle', x: 10, y: 20 }],
    files: { image: { dataURL: 'data:image/png;base64,aGVsbG8=' } },
    appState: { scrollX: -100, scrollY: 20, zoom: { value: 0.5 } },
    scenes: [
      {
        id: 'b',
        title: '细节',
        rect: { x: -100, y: 30, width: 300, height: 100 },
      },
      {
        id: 'a',
        title: '全景',
        rect: { x: 0, y: 0, width: 1000, height: 800 },
      },
    ],
  };
  assert.equal(store.save(id, data, 0), 1);
  store.setSetting('activeDocument', id);
  store.close();
  const reopened = new Store(path);
  assert.deepEqual(reopened.read(id).data, data);
  assert.equal(reopened.getSetting('activeDocument'), id);
  reopened.close();
});
test('stale save is rejected without losing newer document', (t) => {
  const { store } = fixture(t),
    id = store.list()[0].id;
  const a = { ...blank(), elements: [{ id: 'new' }] };
  store.save(id, a, 0);
  assert.throws(() => store.save(id, blank(), 0), /版本冲突/);
  assert.deepEqual(store.read(id).data, a);
});
test('folder moves reject cycles; trash is recoverable', (t) => {
  const { store } = fixture(t),
    a = store.create('folder', null, 'a'),
    b = store.create('folder', a, 'b'),
    d = store.create('document', b, 'd');
  assert.throws(() => store.move(a, b), /自身/);
  assert.throws(() => store.trash(b, true), /内容/);
  store.rename(d, 'renamed');
  store.move(d, a);
  store.trash(d, true);
  assert.throws(() => store.read(d), /不可用/);
  store.trash(d, false);
  assert.equal(store.read(d).title, 'renamed');
});
test('backup imports complete hierarchy and scenes without overwriting originals', (t) => {
  const { store } = fixture(t),
    f = store.create('folder', null, 'project'),
    data = {
      ...blank(),
      scenes: [
        {
          id: 'scene',
          title: 'Overview',
          rect: { x: 1, y: 2, width: 3, height: 4 },
        },
      ],
    },
    id = store.create('document', f, 'board', data);
  const before = store.list().length,
    backup = store.backup(),
    restored = store.restore(backup);
  assert.equal(store.list().length, before * 2 + 1);
  assert.deepEqual(store.read(id).data, data);
  const copyFolder = store
    .list()
    .find((n) => n.parent === restored && n.title === 'project');
  const copy = store.list().find((n) => n.parent === copyFolder.id);
  assert.notEqual(copy.id, id);
  assert.deepEqual(store.read(copy.id).data, data);
});
test('malformed backup and scene bounds leave database unchanged', (t) => {
  const { store } = fixture(t),
    before = store.backup();
  const broken = structuredClone(before);
  broken.nodes[0].parent = broken.nodes[0].id;
  assert.throws(() => store.restore(broken), /目录关系/);
  assert.deepEqual(store.backup().nodes, before.nodes);
  assert.throws(
    () =>
      store.save(
        before.nodes[0].id,
        {
          ...blank(),
          scenes: [
            {
              id: 's',
              title: 'bad',
              rect: { x: 0, y: 0, width: 0, height: 10 },
            },
          ],
        },
        0,
      ),
    /区域/,
  );
});
