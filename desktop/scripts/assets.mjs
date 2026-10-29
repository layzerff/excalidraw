import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/excalidraw-assets', { recursive: true });
cpSync(
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
  'dist/excalidraw-assets/fonts',
  { recursive: true },
);
cpSync('../LICENSE', 'dist/EXCALIDRAW-LICENSE.txt');
cpSync('build/app-icon.png', 'dist/app-icon.png');
cpSync('THIRD-PARTY-NOTICES.md', 'dist/THIRD-PARTY-NOTICES.md');
cpSync('src/videos.mjs', 'dist/videos.mjs');
