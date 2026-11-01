// RoughJS 4.6.4 / hachure-fill 0.5.2 assume an integer gap when scanning at
// one-pixel steps. Density introduces fractional gaps. Draw when the scan
// crosses the next spacing interval instead of testing exact divisibility.
// Integer gaps retain the original scanline positions.
export function fractionalHachureSource(code, id) {
  if (id.includes('/hachure-fill/bin/hachure.js')) {
    const original = '(iteration % gap === 0)';
    if (!code.includes(original))
      throw Error('hachure-fill 0.5.2 scanner did not match');
    return code.replace(
      original,
      '(Math.floor(iteration / gap) !== Math.floor((iteration - 1) / gap))',
    );
  }
  if (id.includes('/roughjs/bundled/rough.esm.js')) {
    const original = 'c%s==0';
    if (!code.includes(original))
      throw Error('RoughJS 4.6.4 bundled scanner did not match');
    return code.replace(original, 'Math.floor(c/s)!==Math.floor((c-1)/s)');
  }
}
