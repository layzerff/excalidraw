import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeElements } from '../src/arrange.mjs';
const bounds = (es) => [
  Math.min(...es.map((e) => e.x)),
  Math.min(...es.map((e) => e.y)),
  Math.max(...es.map((e) => e.x + e.width)),
  Math.max(...es.map((e) => e.y + e.height)),
];
const rectangle = (id, x, y, w = 40, h = 20, extra = {}) => ({
  id,
  type: 'rectangle',
  x,
  y,
  width: w,
  height: h,
  ...extra,
});
test('vertical/horizontal layout has equal edge gaps, unselected elements untouched', () => {
  const es = [
    rectangle('a', 10, 10),
    rectangle('b', 100, 100, 60, 35),
    rectangle('c', 300, 200),
    rectangle('other', 0, 0),
  ];
  for (const mode of ['vertical', 'horizontal']) {
    const { moves } = arrangeElements(es, ['a', 'b', 'c'], mode, 24, bounds);
    const sorted = es.slice(0, 3).map((e) => ({ ...e, ...moves.get(e.id) }));
    assert.equal(moves.has('other'), false);
    for (let i = 1; i < 3; i++)
      assert.equal(
        mode === 'vertical'
          ? sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height)
          : sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width),
        24,
      );
  }
});
test('grid preserves whole groups, bound labels and frame children', () => {
  const es = [
    rectangle('g1', 0, 0, 40, 20, { groupIds: ['g'] }),
    rectangle('g2', 50, 0, 40, 20, { groupIds: ['g'] }),
    rectangle('box', 200, 200),
    rectangle('label', 210, 205, 10, 10, { type: 'text', containerId: 'box' }),
    rectangle('frame', 500, 500, 100, 100, { type: 'frame' }),
    rectangle('child', 520, 530, 20, 20, { frameId: 'frame' }),
  ];
  const { moves, unitCount } = arrangeElements(
    es,
    ['g1', 'box', 'frame'],
    'grid',
    32,
    bounds,
  );
  assert.equal(unitCount, 3);
  assert.equal(moves.size, 6);
  assert.equal(moves.get('g2').x - moves.get('g1').x, 50);
  assert.equal(moves.get('label').y - moves.get('box').y, 5);
  assert.equal(moves.get('child').x - moves.get('frame').x, 20);
});
test('invalid layout inputs do not produce any mutation', () => {
  assert.throws(() => arrangeElements([], [], 'grid', 32, bounds), /请先/);
  assert.throws(() => arrangeElements([], [], 'grid', NaN, bounds), /间距/);
  assert.throws(() => arrangeElements([], [], 'unknown', 20, bounds), /模式/);
});
