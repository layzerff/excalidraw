import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fractionalHachureSource } from '../scripts/hachure-fix.mjs';
const source = readFileSync('node_modules/hachure-fill/bin/hachure.js', 'utf8');
const patched = await import(
  'data:text/javascript,' +
    encodeURIComponent(
      fractionalHachureSource(
        source,
        '/node_modules/hachure-fill/bin/hachure.js',
      ),
    )
);
const original = await import('hachure-fill');
const polygon = () => [
  [0, 0],
  [220, 0],
  [220, 170],
  [0, 170],
];
test('fractional density gaps never blank or remove either crossed direction', () => {
  for (let density = 10; density <= 200; density++) {
    const gap = (8 * 100) / density;
    for (const angle of [-45, 45]) {
      const lines = patched.hachureLines([polygon()], gap, angle, 1);
      assert.ok(
        lines.length >= 3,
        `density ${density}, angle ${angle}: ${lines.length} lines`,
      );
      if (density >= 100)
        assert.ok(lines.length >= 30, `dense hatching vanished at ${density}`);
    }
  }
});
test('integer default gaps keep the exact native scan geometry', () => {
  for (const gap of [2, 4, 8, 12, 16])
    for (const angle of [-45, 0, 45])
      assert.deepEqual(
        patched.hachureLines([polygon()], gap, angle, 1),
        original.hachureLines([polygon()], gap, angle, 1),
      );
});
test('bundled RoughJS generates both hatch directions for every seed at fractional gaps', async () => {
  const text = readFileSync(
    'node_modules/roughjs/bundled/rough.esm.js',
    'utf8',
  );
  const { default: rough } = await import(
    'data:text/javascript,' +
      encodeURIComponent(
        fractionalHachureSource(
          text,
          '/node_modules/roughjs/bundled/rough.esm.js',
        ),
      )
  );
  for (const density of [35, 70, 75, 95, 125, 150, 175, 190])
    for (let seed = 1; seed <= 20; seed++) {
      const generated = rough
        .generator()
        .rectangle(0, 0, 220, 170, {
          seed,
          roughness: 1,
          fill: '#ffc9c9',
          fillStyle: 'cross-hatch',
          hachureGap: (8 * 100) / density,
        });
      const ops = generated.sets.find((s) => s.type === 'fillSketch').ops;
      const directions = new Set();
      let start;
      for (const op of ops) {
        if (op.op === 'move') start = op.data;
        else if (start && op.op === 'bcurveTo') {
          const dx = op.data[4] - start[0],
            dy = op.data[5] - start[1];
          if (Math.abs(dx) > 10 && Math.abs(dy) > 10)
            directions.add(Math.sign(dx * dy));
        }
      }
      assert.ok(
        directions.has(-1) && directions.has(1),
        `one hatch direction missing: density ${density}, seed ${seed}`,
      );
    }
});
