// Version-locked build adapter for the official 0.18.1 bundle. Keep its license
// and all other behavior; fail loudly if upstream changes these constant sites.
export function patchZoom(code, id) {
  if (!id.includes('@excalidraw/excalidraw/dist/')) return null;
  if (
    id.includes('/prod/chunk-') &&
    code.includes('var LE=100,DE=.1,Js=.1,Ys=30,SE=300;')
  )
    return code.replace(
      'var LE=100,DE=.1,Js=.1,Ys=30,SE=300;',
      'var LE=100,DE=.1,Js=.0005,Ys=30,SE=300;',
    );
  if (id.includes('/dev/chunk-') && code.includes('var MIN_ZOOM = 0.1;'))
    return code.replace('var MIN_ZOOM = 0.1;', 'var MIN_ZOOM = 0.0005;');
  if (/\/prod\/index.js$/.test(id))
    return code.replace(
      /\((\w+)\.zoom\.value\*100\)\.toFixed\(0\)/g,
      'Number(($1.zoom.value*100).toFixed(2))',
    );
  if (/\/dev\/index.js$/.test(id))
    return code.replace(
      '(appState.zoom.value * 100).toFixed(0)',
      'Number((appState.zoom.value * 100).toFixed(2))',
    );
  return null;
}
export function extendedZoom() {
  let range = false,
    label = false;
  return {
    name: 'local-canvas-extended-zoom',
    enforce: 'pre',
    transform(code, id) {
      const next = patchZoom(code, id);
      if (next && next !== code) {
        if (code.includes('MIN_ZOOM = 0.1;') || code.includes('Js=.1,Ys=30'))
          range = true;
        else label = true;
        return { code: next, map: null };
      }
    },
    buildEnd(error) {
      if (!error && (!range || !label))
        throw new Error(
          'Excalidraw 0.18.1 缩放适配未命中，请核查依赖与补丁后再构建',
        );
    },
  };
}
