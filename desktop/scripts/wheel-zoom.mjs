import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../src/navigation.mjs', import.meta.url));
export function fineWheelZoomPlugin() {
  let applied = false;
  return {
    name: 'local-canvas-fine-wheel-zoom',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/@excalidraw\/excalidraw\/dist\/prod\/index.js$/.test(id)) return;
      const old =
        'let i=Math.sign(n),a=Fn*100,l=Math.abs(n),s=n;l>a&&(s=a*i);let c=this.state.zoom.value-s/100;c+=Math.log10(Math.max(1,this.state.zoom.value))*-i*Math.min(1,l/20),';
      if (!code.includes(old)) return;
      if (!code.includes('nextZoom:Ao(c)'))
        throw Error('Wheel normalized zoom adapter did not match');
      applied = true;
      return {
        code:
          `import {fineWheelZoom as __fineWheelZoom} from ${JSON.stringify(source)};\n` +
          code
            .replace(
              old,
              'let c=__fineWheelZoom(this.state.zoom.value,n,t.deltaMode,this.excalidrawContainerRef.current?.ownerDocument.documentElement.dataset.wheelZoomStep);',
            )
            .replace('nextZoom:Ao(c)', 'nextZoom:c<.0005||c>30?c:Ao(c)'),
        map: null,
      };
    },
    buildEnd(error) {
      if (!error && !applied)
        throw Error('Excalidraw 0.18.1 wheel zoom adapter did not match');
    },
  };
}
