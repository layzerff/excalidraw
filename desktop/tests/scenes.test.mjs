import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneRange, selectedBinding, followScenes } from '../src/scenes.mjs';
test('Shift scene selection follows visible order in both directions and after reordering', () => {
  const scenes = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  assert.deepEqual(sceneRange(scenes, 'a', 'c'), ['a', 'b', 'c']);
  assert.deepEqual(sceneRange(scenes, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(
    sceneRange([scenes[2], scenes[0], scenes[3], scenes[1]], 'c', 'd'),
    ['c', 'a', 'd'],
  );
  assert.deepEqual(sceneRange(scenes, null, 'b'), ['b']);
  assert.deepEqual(sceneRange(scenes, 'deleted', 'b'), ['b']);
  assert.deepEqual(sceneRange(scenes, 'a', 'deleted'), []);
});
test('element scenes follow IDs and changing group membership, preserve last bounds on delete and resume on undo', () => {
  const bounds = (elements) => [
    Math.min(...elements.map((e) => e.x)),
    Math.min(...elements.map((e) => e.y)),
    Math.max(...elements.map((e) => e.x + e.width)),
    Math.max(...elements.map((e) => e.y + e.height)),
  ];
  const a = { id: 'a', x: 10, y: 20, width: 100, height: 50, groupIds: ['g'] };
  const b = { id: 'b', x: 200, y: 30, width: 40, height: 40, groupIds: ['g'] };
  const binding = selectedBinding(
    [a, b, { ...b, id: 'dead', isDeleted: true }],
    { selectedGroupIds: { g: true }, selectedElementIds: {} },
  );
  assert.deepEqual(binding, { elementIds: ['a', 'b'], groupIds: ['g'] });
  const scenes = [
    { id: 'linked', binding, rect: { x: 0, y: 0, width: 1, height: 1 } },
    { id: 'fixed', rect: { x: 0, y: 0, width: 50, height: 50 } },
  ];
  const next = followScenes(scenes, [a, b], bounds);
  assert.deepEqual(next[0].rect, { x: -14, y: -4, width: 278, height: 98 });
  assert.equal(next[1], scenes[1]);
  assert.equal(followScenes(next, [a, b], bounds), next);
  const moved = followScenes(
    next,
    [
      { ...a, x: 1010 },
      { ...b, x: 1200 },
      { ...b, id: 'new', x: 1400 },
    ],
    bounds,
  );
  assert.deepEqual(moved[0].rect, { x: 986, y: -4, width: 478, height: 98 });
  assert.equal(followScenes(moved, [], bounds), moved);
  assert.deepEqual(followScenes(moved, [a, b], bounds)[0].rect, next[0].rect);
  assert.deepEqual(
    selectedBinding([a, b], { selectedElementIds: { a: true } }),
    { elementIds: ['a'], groupIds: [] },
  );
});
