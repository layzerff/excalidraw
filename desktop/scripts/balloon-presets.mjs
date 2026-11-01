import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../src/balloons.mjs', import.meta.url));
// Keep native text metrics, binding, history and mixed-selection behavior. Adapt
// only balloon sizes in the locked official 0.18.1 font-preset action.
export function patchBalloonPresets(code, id) {
  if (!id.includes('@excalidraw/excalidraw/dist/')) return null;
  if (/\/prod\/index.js$/.test(id)) {
    const action =
      'name:"changeFontSize",label:"labels.fontSize",trackEvent:!1,perform:(e,o,t,r)=>zp(e,o,r,()=>t,t)';
    if (!code.includes(action)) return null;
    const next = code
      .replace(
        action,
        'name:"changeFontSize",label:"labels.fontSize",trackEvent:!1,perform:(e,o,t,r)=>zp(e,o,r,n=>__balloonPresetSize(e,n,t),t)',
      )
      .replace(
        'value:gt(e,o,n=>{if(Y(n))return n.fontSize;let i=ue(n,r.scene.getNonDeletedElementsMap());return i?i.fontSize:null}',
        'value:gt(e,o,n=>{if(Y(n))return __balloonPresetValue(e,n);let i=ue(n,r.scene.getNonDeletedElementsMap());return i?__balloonPresetValue(e,i):null}',
      );
    if (!next.includes('return __balloonPresetValue(e,n)'))
      throw Error('Balloon preset panel adapter did not match');
    return (
      `import {balloonPresetSize as __balloonPresetSize,balloonPresetValue as __balloonPresetValue} from ${JSON.stringify(source)};\n` +
      next
    );
  }
  if (/\/dev\/index.js$/.test(id)) {
    const action =
      'perform: (elements, appState, value, app) => changeFontSize(elements, appState, app, () => value, value)';
    if (!code.includes(action)) return null;
    return (
      `import {balloonPresetSize as __balloonPresetSize} from ${JSON.stringify(source)};\n` +
      code.replace(
        action,
        'perform: (elements, appState, value, app) => changeFontSize(elements, appState, app, element => __balloonPresetSize(elements, element, value), value)',
      )
    );
  }
  return null;
}
export function relativeBalloonPresets() {
  let applied = false;
  return {
    name: 'local-canvas-balloon-presets',
    enforce: 'pre',
    transform(code, id) {
      const next = patchBalloonPresets(code, id);
      if (next) {
        applied = true;
        return { code: next, map: null };
      }
    },
    buildEnd(error) {
      if (!error && !applied)
        throw Error('Excalidraw 0.18.1 balloon preset adapter did not match');
    },
  };
}
