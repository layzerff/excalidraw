import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/excalidraw-assets', { recursive: true });
cpSync(
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
  'dist/excalidraw-assets/fonts',
  { recursive: true },
);
cpSync('../LICENSE', 'dist/EXCALIDRAW-LICENSE.txt');
cpSync('THIRD-PARTY-NOTICES.md', 'dist/THIRD-PARTY-NOTICES.md');
