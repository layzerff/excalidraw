// Version-locked DOM identity only; native insertion, rendering and selection stay intact.
export function libraryItemIds() {
  let applied = false;
  return {
    name: 'local-library-item-ids',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/@excalidraw\/excalidraw\/dist\/prod\/index.js$/.test(id)) return;
      const from = 'return OS("div",{className:rw("library-unit",';
      if (!code.includes(from)) return;
      applied = true;
      return {
        code: code.replace(
          from,
          'return OS("div",{"data-library-id":e,className:rw("library-unit",',
        ),
        map: null,
      };
    },
    buildEnd(error) {
      if (!error && !applied)
        throw Error('Excalidraw 0.18.1 library identity adapter did not match');
    },
  };
}
