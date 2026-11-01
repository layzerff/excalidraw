const root = document.getElementById('root');
// Set the absolute file URL before the editor registers its font faces.
root.ownerDocument.defaultView.EXCALIDRAW_ASSET_PATH = new URL(
  './excalidraw-assets/',
  root.ownerDocument.baseURI,
).href;
if (!root.ownerDocument.defaultView.workspace) {
  const { createWebBridge } = await import('./web-bridge.mjs');
  root.ownerDocument.defaultView.workspace = createWebBridge(
    root.ownerDocument.defaultView,
  );
}
await import('./main.jsx');
