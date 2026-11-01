import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balloonNumber, balloonSkeleton } from '../src/balloons.mjs';
test('balloon validates manual starts', () => {
  assert.equal(balloonNumber('3'), 3);
  for (const v of ['', 0, -1, 1.5, NaN, 1000000])
    assert.throws(() => balloonNumber(v));
});
test('balloon inherits native font/style and centers at click', () => {
  const s = balloonSkeleton(
    { x: 200, y: 100 },
    {
      currentItemFontFamily: 1,
      currentItemFontSize: 28,
      currentItemStrokeColor: '#e03131',
      currentItemStrokeWidth: 4,
      currentItemOpacity: 70,
    },
    31,
  );
  assert.equal(s.x + s.width / 2, 200);
  assert.equal(s.y + s.height / 2, 100);
  assert.equal(s.width, s.height);
  assert.equal(s.label.fontFamily, 1);
  assert.equal(s.label.text, '31');
  assert.equal(s.strokeWidth, 4);
  assert.equal(s.opacity, 70);
});
