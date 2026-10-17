const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

// Seal the final bundle before electron-builder creates distributable archives.
// Ad-hoc signing provides integrity, not Developer ID trust or notarization.
module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;
  const bundle = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', bundle], { stdio: 'inherit' });
};
