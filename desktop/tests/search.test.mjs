import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchText,
  searchElements,
  highlightParts,
  nativeSearchMatches,
} from '../src/search.mjs';
test('literal occurrences, case-insensitive English and UTF-16 spans', () => {
  assert.deepEqual(matchText('Canvas canvas', 'CANVAS').ranges, [
    [0, 6],
    [7, 13],
  ]);
  assert.deepEqual(matchText('🙂中文拼音', 'zw').ranges, [[2, 4]]);
  assert.equal(matchText('删除文字', 'none'), null);
  assert.equal(matchText('中文', ' '), null);
});
test('Chinese full pinyin, initials, mixed spelling, spaces and contextual polyphones', () => {
  for (const q of ['zhongwen', 'zw', 'zhongw', 'zhōng wén'])
    assert.deepEqual(matchText('中文拼音', q).ranges, [[0, 2]]);
  assert.deepEqual(matchText('重庆方案', 'chongqing').ranges, [[0, 2]]);
  assert.deepEqual(matchText('重庆方案', 'cq').ranges, [[0, 2]]);
  assert.deepEqual(matchText('界面设计', 'jmsj').ranges, [[0, 4]]);
  assert.equal(matchText('中文', 'english'), null);
});
test('literal results precede pinyin; deleted/non-text elements are omitted', () => {
  const es = [
    { id: 'a', type: 'text', text: '中文' },
    { id: 'b', type: 'text', text: 'zw components' },
    { id: 'c', type: 'text', text: '中文', isDeleted: true },
    { id: 'd', type: 'rectangle', text: 'zw' },
  ];
  assert.deepEqual(
    searchElements(es, 'zw').map((r) => r.element.id),
    ['b', 'a'],
  );
  assert.deepEqual(highlightParts('中文拼音', [[0, 2]]), [
    { text: '中文', highlight: true },
    { text: '拼音', highlight: false },
  ]);
});
test('native highlight geometry spans lines, alignment and focus without mutating elements', () => {
  const e = {
    id: 'a',
    type: 'text',
    text: 'ab ab\n中文',
    fontSize: 20,
    lineHeight: 1.25,
    width: 100,
    height: 50,
    textAlign: 'center',
  };
  const original = JSON.stringify(e),
    measure = (text) => text.length * 10;
  const result = nativeSearchMatches(
    [
      {
        element: e,
        ranges: [
          [0, 2],
          [3, 5],
          [6, 8],
        ],
      },
    ],
    'a',
    measure,
  );
  assert.deepEqual(result, [
    {
      id: 'a',
      focus: true,
      matchedLines: [
        { offsetX: 25, offsetY: 0, width: 20, height: 25 },
        { offsetX: 55, offsetY: 0, width: 20, height: 25 },
        { offsetX: 40, offsetY: 25, width: 20, height: 25 },
      ],
    },
  ]);
  assert.equal(JSON.stringify(e), original);
  assert.deepEqual(nativeSearchMatches([], null, measure), []);
});

import {
  balloonPresetSize,
  balloonPresetValue,
  restyledBalloon,
} from '../src/balloons.mjs';
test('balloon presets scale to resized shape while ordinary text retains native sizes', () => {
  const circle = {
      id: 'c',
      type: 'ellipse',
      width: 300,
      height: 300,
      customData: { localCanvasBalloon: true },
    },
    label = {
      id: 'n',
      type: 'text',
      containerId: 'c',
      text: '15',
      fontSize: 80,
      width: 90,
      lineHeight: 1.25,
    };
  const values = [16, 20, 28, 36].map((n) =>
    balloonPresetSize([circle, label], label, n),
  );
  assert.equal(
    values.every((v) => v > 36),
    true,
  );
  assert.equal(
    values.every((v, i) => i === 0 || v > values[i - 1]),
    true,
  );
  assert.equal(
    balloonPresetSize([circle], { ...label, containerId: null }, 20),
    20,
  );
  const resized = { ...circle, width: 600, height: 600 };
  assert.ok(balloonPresetSize([resized, label], label, 20) > values[1] * 1.9);
  assert.equal(
    balloonPresetValue([circle], {
      ...label,
      fontSize: values[1],
      width: (90 * values[1]) / 80,
    }),
    20,
  );
  const changed = { ...label, fontSize: values[1] };
  assert.equal(
    restyledBalloon([circle, label], [circle, changed], {
      selectedElementIds: { c: true },
    }).fontSize,
    values[1],
  );
  assert.equal(
    restyledBalloon([circle, label], [circle, changed], {
      selectedElementIds: {},
    }),
    null,
  );
});
import {
  libraryMetadata,
  searchLibrary,
  renameLibraryItem,
} from '../src/library-search.mjs';
import { fillGap, densityOf } from '../src/fill-density.mjs';
test('library names, user tags and internal text are searchable without searching canvas', () => {
  const item = {
    id: 'lib',
    name: '流程图',
    elements: [
      { id: 'rect', type: 'rectangle', version: 1 },
      { type: 'text', text: '开始' },
    ],
  };
  assert.equal(searchLibrary([item], 'liucheng').length, 1);
  assert.equal(searchLibrary([item], '开始').length, 1);
  const named = renameLibraryItem(item, '阀门', '机械, 管道');
  assert.deepEqual(libraryMetadata(named).tags, ['机械', '管道']);
  assert.equal(searchLibrary([named], 'jx').length, 1);
  assert.equal(named.elements[0].customData.localCanvasLibrary.name, '阀门');
  assert.equal(item.elements[0].customData, undefined);
});
test('fill density controls native hatch spacing without changing stroke width', () => {
  assert.equal(fillGap(2, 100), 8);
  assert.equal(fillGap(2, 50), 16);
  assert.equal(fillGap(2, 200), 4);
  assert.equal(densityOf({}), 100);
  assert.equal(
    densityOf({ customData: { localCanvasFillDensity: 1000 } }),
    200,
  );
});
import { fineWheelZoom } from '../src/navigation.mjs';
test('wheel zoom is proportional, bounded and fine even at overview scales', () => {
  for (const zoom of [1, 0.1, 0.01, 0.001]) {
    const next = fineWheelZoom(zoom, 120);
    assert.ok(next < zoom && next > zoom * 0.93);
    assert.ok(Math.abs(next / zoom - fineWheelZoom(1, 120)) < 1e-10);
  }
  assert.equal(fineWheelZoom(0.0005, 10000), 0.0005);
  assert.ok(fineWheelZoom(0.0005, -120) < 0.00054);
  assert.equal(fineWheelZoom(30, -10000), 30);
  assert.ok(fineWheelZoom(1, 1) > fineWheelZoom(1, 120));
});

test('zoom step settings use five percent increments proportionally', () => {
  for (const step of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    assert.ok(
      Math.abs(fineWheelZoom(1, -120, 0, step) - (1 + step / 100)) < 1e-10,
    );
    assert.ok(
      Math.abs(fineWheelZoom(1, 120, 0, step) * (1 + step / 100) - 1) < 1e-10,
    );
  }
});

test('wrapped text matches retain visual line offsets', () => {
  assert.deepEqual(matchText('中\n文', 'zw').ranges, [[0, 3]]);
  assert.deepEqual(matchText('中\n文', '中文').ranges, [[0, 3]]);
});
