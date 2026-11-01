import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewView, fineWheelZoom } from '../src/navigation.mjs';
import { balloonSkeleton, circularBalloons } from '../src/balloons.mjs';
import { onlineLibraryIndex } from '../src/online-library-search.mjs';
test('overview continuously fits the complete scene below ten percent and below the wheel floor', () => {
  for (const extent of [9428, 1e8, 1e12]) {
    const bounds = [-extent / 2, -3000, extent / 2, 5000];
    const view = overviewView(bounds, 970, 800);
    assert.ok(view.zoom.value > 0);
    assert.ok(view.zoom.value < 0.1);
    for (const [x, y] of [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ]) {
      assert.ok((x + view.scrollX) * view.zoom.value >= -1e-6);
      assert.ok((x + view.scrollX) * view.zoom.value <= 970 + 1e-6);
      assert.ok((y + view.scrollY) * view.zoom.value >= -1e-6);
      assert.ok((y + view.scrollY) * view.zoom.value <= 800 + 1e-6);
    }
    const next = fineWheelZoom(view.zoom.value, -120, 0, 5);
    assert.ok(Math.abs(next / view.zoom.value - 1.05) < 1e-9);
  }
});
test('balloons use a diameter instead of inheriting an oval and accommodate native labels', () => {
  const shape = balloonSkeleton({ x: 0, y: 0 }, {}, 123, {
    width: 160,
    height: 80,
    fontSize: 28,
  });
  assert.equal(shape.width, shape.height);
  const old = {
    id: 'circle',
    type: 'ellipse',
    customData: { localCanvasBalloon: true },
    x: 0,
    y: 0,
    width: 80,
    height: 40,
  };
  const label = {
    id: 'label',
    type: 'text',
    containerId: 'circle',
    x: 0,
    y: 0,
    width: 100,
    height: 30,
  };
  const normal = { ...old, id: 'ordinary', customData: {} };
  const fixed = circularBalloons([old, label, normal]);
  assert.equal(fixed[0].width, fixed[0].height);
  assert.ok(fixed[0].width > 100);
  assert.equal(fixed[2], normal);
  assert.equal(fixed[1].x + 50, 40);
  assert.equal(fixed[1].y + 15, 20);
});
test('online search covers asset titles, tags and text independently of package titles and caches the index', async () => {
  let downloads = 0;
  const bridge = {
    invoke: async (operation, source) => {
      if (operation === 'libraryCatalog')
        return [
          { source: 'one', name: 'General icons' },
          { source: 'two', name: 'Other package' },
        ];
      downloads++;
      return source === 'one'
        ? {
            libraryItems: [
              {
                id: 'a',
                elements: [
                  {
                    type: 'text',
                    text: '阀门',
                    customData: {
                      localCanvasLibrary: { name: 'Valve', tags: ['管道'] },
                    },
                  },
                ],
              },
            ],
          }
        : { library: [[{ id: 'shape', type: 'text', text: 'Server' }]] };
    },
  };
  const index = onlineLibraryIndex(bridge);
  let state;
  await index.search('gd', (next) => (state = next));
  assert.equal(state.results.length, 1);
  assert.equal(state.results[0].source, 'one');
  assert.equal(state.working, false);
  await index.search('server', (next) => (state = next));
  assert.equal(state.results.length, 1);
  assert.equal(state.results[0].source, 'two');
  assert.equal(downloads, 2);
  assert.ok((await index.item(state.results[0])).elements.length);
  assert.equal(downloads, 2);
});
