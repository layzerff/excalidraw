// Mechanical format conversion only: the approved raster design is not redrawn.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const directory = 'build/app-icon.iconset';
mkdirSync(directory, { recursive: true });
execFileSync('swift', [
  '-module-cache-path',
  '/private/tmp/local-canvas-icon-modules',
  'scripts/mac-icon.swift',
  'build/app-icon.png',
  'build/app-icon-mac.png',
]);
for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
  const name =
    size === 1024 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`;
  execFileSync('sips', [
    '-z',
    String(size),
    String(size),
    'build/app-icon-mac.png',
    '--out',
    `${directory}/${name}`,
  ]);
}
for (const size of [16, 32, 128, 256]) {
  execFileSync('sips', [
    '-z',
    String(size * 2),
    String(size * 2),
    'build/app-icon-mac.png',
    '--out',
    `${directory}/icon_${size}x${size}@2x.png`,
  ]);
}
const chunks = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
].map(([type, size]) => {
  const name =
    size === 1024 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`;
  const png = readFileSync(`${directory}/${name}`),
    header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(8 + png.length, 4);
  return Buffer.concat([header, png]);
});
const icns = Buffer.alloc(8);
icns.write('icns');
icns.writeUInt32BE(
  8 + chunks.reduce((total, chunk) => total + chunk.length, 0),
  4,
);
writeFileSync('build/app-icon.icns', Buffer.concat([icns, ...chunks]));
const sizes = [16, 32, 48, 64, 128, 256];
const images = sizes.map((size) => {
  const path = `${directory}/windows-${size}.png`;
  execFileSync('sips', [
    '-z',
    String(size),
    String(size),
    'build/app-icon.png',
    '--out',
    path,
  ]);
  return readFileSync(path);
});
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] % 256;
  header[entry + 1] = sizes[index] % 256;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
writeFileSync('build/app-icon.ico', Buffer.concat([header, ...images]));
