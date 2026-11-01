import { fractionalHachureSource } from './hachure-fix.mjs';
export function fillDensityPlugin() {
  let applied = false;
  const scanners = new Set();
  return {
    name: 'local-canvas-fill-density',
    enforce: 'pre',
    transform(code, id) {
      const scanner = fractionalHachureSource(code, id);
      if (scanner) {
        scanners.add(id.includes('/hachure-fill/') ? 'scan' : 'bundle');
        return { code: scanner, map: null };
      }
      if (!id.includes('@excalidraw/excalidraw/dist/')) return;
      const pattern = /hachureGap:(\w+)\.strokeWidth\*4,/g;
      if (/\/prod\/chunk-/.test(id) && pattern.test(code)) {
        applied = true;
        return {
          code: code.replace(
            pattern,
            'hachureGap:Math.max(.5,$1.strokeWidth*4*100/(Math.min(200,Math.max(10,(Number.isFinite($1.customData?.localCanvasFillDensity)?$1.customData.localCanvasFillDensity:100))))),',
          ),
          map: null,
        };
      }
      if (
        /\/dev\/chunk-/.test(id) &&
        code.includes('hachureGap: element.strokeWidth * 4,')
      ) {
        applied = true;
        return {
          code: code.replace(
            'hachureGap: element.strokeWidth * 4,',
            'hachureGap: Math.max(.5,element.strokeWidth * 4 * 100 / Math.min(200,Math.max(10,element.customData?.localCanvasFillDensity || 100))),',
          ),
          map: null,
        };
      }
    },
    buildEnd(error) {
      if (!error && (!applied || scanners.size !== 2))
        throw Error('Excalidraw 0.18.1 fill density adapter did not match');
    },
  };
}
