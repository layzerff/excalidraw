import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const version = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version;
import { libraryItemIds } from './scripts/library-ids.mjs';
import { presentationStyles } from './scripts/presentation-styles.mjs';
import react from '@vitejs/plugin-react';
import { fineWheelZoomPlugin } from './scripts/wheel-zoom.mjs';
import { fillDensityPlugin } from './scripts/fill-density.mjs';
import { relativeBalloonPresets } from './scripts/balloon-presets.mjs';
import { textScalePlugin } from './scripts/text-scale.mjs';
import { extendedZoom } from './scripts/zoom-patch.mjs';
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      process.env.VITE_APP_VERSION || version,
    ),
  },
  plugins: [
    presentationStyles(),
    libraryItemIds(),
    extendedZoom(),
    relativeBalloonPresets(),
    textScalePlugin(),
    fillDensityPlugin(),
    fineWheelZoomPlugin(),
    react(),
  ],
  build: { chunkSizeWarningLimit: 4000 },
});
