import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../src/TextScale.jsx', import.meta.url));
export function textScalePlugin() {
  let applied = false;
  return {
    name: 'local-canvas-text-scale',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@excalidraw/excalidraw/dist/prod/index.js')) return;
      const action =
        'perform:(e,o,t,r)=>zp(e,o,r,n=>__balloonPresetSize(e,n,t),t)';
      const panel = 'onChange:n=>t(n)})]})}),Up=';
      if (!code.includes(action) || !code.includes(panel))
        throw Error(
          'Text scale native action/panel did not match Excalidraw 0.18.1',
        );
      applied = true;
      return {
        code:
          `import {TextScale as __TextScale,performTextScale as __performTextScale} from ${JSON.stringify(source)};\n` +
          code
            .replace(
              action,
              'perform:(e,o,t,r)=>t?.localCanvasTextScale?__performTextScale(e,o,t,r,zp,q):zp(e,o,r,n=>__balloonPresetSize(e,n,t),t)',
            )
            .replace(
              panel,
              'onChange:n=>t(n)}),ae(__TextScale,{elements:e,appState:o,updateData:t})]})}),Up=',
            ),
        map: null,
      };
    },
    buildEnd(error) {
      if (!error && !applied) throw Error('Text scale adapter was not applied');
    },
  };
}
