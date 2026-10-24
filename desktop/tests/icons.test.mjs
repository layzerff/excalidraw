import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('Windows icon contains six correctly indexed PNG sizes', () => {
  const ico = readFileSync('build/app-icon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 6);
  for (const [index, size] of [16, 32, 48, 64, 128, 256].entries()) {
    const entry = 6 + index * 16,
      offset = ico.readUInt32LE(entry + 12);
    assert.equal(ico[entry], size % 256);
    assert.equal(ico.toString('ascii', offset + 1, offset + 4), 'PNG');
    assert.equal(ico.readUInt32BE(offset + 16), size);
    assert.equal(ico.readUInt32BE(offset + 20), size);
  }
});
test('macOS icon includes retina and 1024px PNG resources', () => {
  const icon = readFileSync('build/app-icon.icns'),
    types = [];
  assert.equal(icon.toString('ascii', 0, 4), 'icns');
  assert.equal(icon.readUInt32BE(4), icon.length);
  for (let offset = 8; offset < icon.length;) {
    types.push(icon.toString('ascii', offset, offset + 4));
    assert.equal(icon.toString('ascii', offset + 9, offset + 12), 'PNG');
    offset += icon.readUInt32BE(offset + 4);
  }
  assert.ok(types.includes('ic10'));
  assert.ok(types.includes('ic11'));
  assert.ok(types.includes('ic12'));
});
