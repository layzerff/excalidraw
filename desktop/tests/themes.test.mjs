import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeId, themeStyle } from '../src/themes.mjs';
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
