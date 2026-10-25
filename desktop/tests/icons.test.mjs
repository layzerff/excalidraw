import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
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
  assert.ok(types.includes('icp4'));
  assert.ok(types.includes('icp5'));
  assert.ok(types.includes('icp6'));
});
test('Mac platform icon has optical artwork bounds and transparent platform padding', () => {
  const png = readFileSync('build/app-icon-mac.png'),
    chunks = [];
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6); // RGBA8, non-interlaced.
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = 1024 * 4,
    rows = Buffer.alloc(stride * 1024);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < 1024; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? rows[y * stride + x - 4] : 0,
        b = y ? rows[(y - 1) * stride + x] : 0,
        c = y && x >= 4 ? rows[(y - 1) * stride + x - 4] : 0;
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][
        filter
      ];
      rows[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  const xs = [],
    ys = [];
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++)
      if (rows[y * stride + x * 4 + 3] > 8) {
        xs.push(x);
        ys.push(y);
      }
  const bounds = (values) =>
    values.reduce(
      ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
      [1024, -1],
    );
  for (const [min, max] of [bounds(xs), bounds(ys)]) {
    assert.ok(min >= 95 && min <= 104);
    assert.ok(max <= 928 && max >= 919);
    assert.ok(max - min >= 815 && max - min <= 833);
  }
  assert.equal(rows[3], 0);
  assert.equal(rows[stride * 1024 - 1], 0);
});
