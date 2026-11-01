import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascadeScenes } from '../src/scenes.mjs';
import { resizedBalloon, balloonSkeleton } from '../src/balloons.mjs';
import { targetView } from '../src/navigation.mjs';
import { patchZoom } from '../scripts/zoom-patch.mjs';
test('linked scene cascades on member deletion and restores at its index on undo', () => {
  const a = { id: 'a', groupIds: ['g'] },
    b = { id: 'b', groupIds: ['g'] };
  const linked = { id: 's', binding: { elementIds: ['a'], groupIds: ['g'] } },
    fixed = { id: 'f' },
    archive = new Map();
  const deleted = cascadeScenes(
    [fixed, linked],
    [a, b],
    [a, { ...b, isDeleted: true }],
    archive,
  );
  assert.deepEqual(deleted.scenes, [fixed]);
  assert.equal(archive.size, 1);
  assert.deepEqual(
    cascadeScenes(
      deleted.scenes,
      [a, { ...b, isDeleted: true }],
      [a, b],
      archive,
    ).scenes,
    [fixed, linked],
  );
  assert.equal(archive.size, 0);
});
test('balloon resized diameter is inherited without propagating an oval', () => {
  const old = {
    id: 'a',
    type: 'ellipse',
    width: 56,
    height: 56,
    customData: { localCanvasBalloon: true },
  };
  const after = { ...old, width: 110, height: 90 };
  assert.equal(resizedBalloon([old], [after], {}), null);
  const size = resizedBalloon(
    [old],
    [after, { id: 't', type: 'text', containerId: 'a', fontSize: 30 }],
    { isResizing: true },
  );
  const next = balloonSkeleton({ x: 100, y: 100 }, {}, 4, size);
  assert.equal(next.width, 110);
  assert.equal(next.height, 110);
  assert.equal(next.label.fontSize, 30);
});
test('overview fits content wider than old 10 percent limit and stays positive', () => {
  const view = targetView(
    { x: -50000, y: 0, width: 100000, height: 1000 },
    1000,
    800,
  );
  assert.ok(view.zoom < 0.1 && view.zoom > 0);
  assert.ok(Math.abs((-50000 + 50000 + view.scrollX) * view.zoom - 500) < 1e-8);
});
test('locked upstream zoom adapter changes only min zoom and percentage precision', () => {
  const code = 'var LE=100,DE=.1,Js=.1,Ys=30,SE=300;';
  assert.equal(
    patchZoom(code, '@excalidraw/excalidraw/dist/prod/chunk-test.js'),
    'var LE=100,DE=.1,Js=.0005,Ys=30,SE=300;',
  );
  assert.equal(
    patchZoom(
      '(o.zoom.value*100).toFixed(0)',
      '@excalidraw/excalidraw/dist/prod/index.js',
    ),
    'Number((o.zoom.value*100).toFixed(2))',
  );
});
