const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store, blank } = require('../electron/store.cjs');
const { LibraryStore } = require('../electron/library-store.cjs');
test('global library migrates each document once, preserves folders, safely relocates, and does not resurrect removed assets', () => {
  const root = mkdtempSync(join(tmpdir(), 'library-store-'));
  const db = new Store(join(root, 'workspace.sqlite'));
  try {
    const a = db.create('document', null, 'A', {
        ...blank(),
        libraryItems: [{ id: 'asset', elements: [] }],
      }),
      b = db.create('document', null, 'B');
    const lib = new LibraryStore(db, root);
    assert.equal(lib.open(a).libraryItems.length, 1);
    lib.organize([{ id: 'folder', name: 'My assets', parent: null }], {
      asset: 'folder',
    });
    assert.equal(lib.open(b).libraryItems.length, 1);
    assert.equal(lib.read().assignments.asset, 'folder');
    const original = lib.info().file;
    lib.relocate(join(root, 'custom'));
    assert.equal(lib.info().folder, join(root, 'custom'));
    assert.equal(JSON.parse(readFileSync(original)).libraryItems.length, 1);
    assert.throws(() => lib.relocate(join(root, 'materials')), /已有/);
    const snapshot = db.backup();
    assert.equal(snapshot.materialLibrary.folders[0].name, 'My assets');
    lib.save([]);
    lib.organize([], {});
    lib.importSnapshot(snapshot.materialLibrary);
    assert.equal(lib.read().libraryItems.length, 1);
    assert.equal(lib.read().folders[0].name, 'My assets');
    assert.ok(lib.read().assignments.asset);
    assert.throws(
      () =>
        lib.importSnapshot({
          version: 1,
          libraryItems: [],
          folders: [{ id: 'cycle', name: 'bad', parent: 'cycle' }],
          assignments: {},
        }),
      /层级/,
    );
    lib.save([]);
    assert.equal(lib.open(a).libraryItems.length, 0);
    lib.importSnapshot({
      version: 1,
      libraryItems: [],
      folders: [{ id: 'empty', name: 'Empty', parent: null }],
      assignments: {},
    });
    assert.ok(lib.read().folders.some((f) => f.name === 'Empty'));
    assert.throws(
      () => lib.organize([{ id: 'cycle', name: 'bad', parent: 'cycle' }], {}),
      /层级/,
    );
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
