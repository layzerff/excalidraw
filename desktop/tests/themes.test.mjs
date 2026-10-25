import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeId, themeStyle, resetZoomView } from '../src/themes.mjs';
test('four complete themes with safe persisted-value fallback', () => {
  assert.deepEqual(Object.keys(THEMES), [
    'github',
    'reddit',
    'vscode',
    'notion',
  ]);
  for (const id of Object.keys(THEMES)) {
    const style = themeStyle(id);
    for (const key of Object.keys(THEMES.github.tokens))
      assert.ok(style[`--${key}`], `${id}:${key}`);
  }
  for (const input of ['unknown', null, undefined, '__proto__'])
    assert.equal(themeId(input), 'github');
  assert.equal(THEMES.vscode.dark, true);
});
test('middle-button reset returns exactly 100% and preserves scene center', () => {
  for (const zoom of [0.1, 0.5, 1, 2, 5]) {
    const state = {
        zoom: { value: zoom },
        width: 900,
        height: 600,
        scrollX: -350,
        scrollY: 120,
      },
      next = resetZoomView(state);
    assert.equal(next.zoom.value, 1);
    assert.ok(
      Math.abs(
        -next.scrollX +
          state.width / 2 -
          (-state.scrollX + state.width / (2 * zoom)),
      ) < 1e-8,
    );
    assert.ok(
      Math.abs(
        -next.scrollY +
          state.height / 2 -
          (-state.scrollY + state.height / (2 * zoom)),
      ) < 1e-8,
    );
  }
});
test('theme normal and selected foregrounds meet readable contrast', () => {
  const luminance = (hex) => {
    const rgb = hex
      .replace('#', '')
      .match(/../g)
      .map((value) => parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [id, { tokens }] of Object.entries(THEMES))
    for (const [a, b] of [
      ['text', 'surface'],
      ['strong', 'selected'],
      ['primary-text', 'primary'],
    ]) {
      const values = [luminance(tokens[a]), luminance(tokens[b])].sort(
        (a, b) => b - a,
      );
      assert.ok(
        (values[0] + 0.05) / (values[1] + 0.05) >= 4.5,
        `${id}:${a}/${b}`,
      );
    }
});
