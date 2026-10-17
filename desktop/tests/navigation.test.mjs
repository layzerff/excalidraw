import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  viewRect,
  targetView,
  interpolate,
  normalizeRect,
} from '../src/navigation.mjs';
test('view rectangle handles pan and zoom', () =>
  assert.deepEqual(
    viewRect({
      scrollX: -200,
      scrollY: 50,
      width: 1000,
      height: 600,
      zoom: { value: 0.5 },
    }),
    { x: 200, y: -50, width: 2000, height: 1200 },
  ));
test('target centers the selected region within the canvas', () => {
  const r = { x: -1000, y: 500, width: 2000, height: 1000 };
  const v = targetView(r, 1000, 800);
  assert.ok(v.zoom < 0.5);
  assert.ok(Math.abs((r.x + r.width / 2 + v.scrollX) * v.zoom - 500) < 1e-9);
  assert.ok(Math.abs((r.y + r.height / 2 + v.scrollY) * v.zoom - 400) < 1e-9);
});
test('animation endpoints are exact and zoom remains positive', () => {
  const a = { zoom: 0.1, scrollX: -1000, scrollY: 1000 },
    b = { zoom: 10, scrollX: 300, scrollY: 400 };
  for (let t = 0; t <= 1; t += 0.1) assert.ok(interpolate(a, b, t).zoom > 0);
  assert.equal(interpolate(a, b, 0).scrollX, a.scrollX);
  assert.equal(interpolate(a, b, 1).scrollY, b.scrollY);
});
test('selection normalizes reverse-direction drag', () =>
  assert.deepEqual(normalizeRect({ x: 100, y: 200 }, { x: -50, y: 10 }), {
    x: -50,
    y: 10,
    width: 150,
    height: 190,
  }));
