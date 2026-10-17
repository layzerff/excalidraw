import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const sections = [
  '# Third-party notices\n\nGenerated from the locked dependency tree. Upstream Excalidraw is MIT licensed. Electron distributions also include LICENSE and LICENSES.chromium.html.\n',
];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev || !existsSync(path)) continue;
  const p = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  sections.push(
    `## ${p.name}@${p.version}\nLicense: ${JSON.stringify(p.license || p.licenses || 'See package source')}\nSource: ${typeof p.repository === 'object' ? p.repository.url : p.repository || p.homepage || ''}\n`,
  );
  const files = readdirSync(path).filter((n) =>
    /^(licen[cs]e|copying|notice)([.-]|$)/i.test(n),
  );
  for (const file of files) {
    try {
      sections.push(
        `### ${file}\n\n${readFileSync(join(path, file), 'utf8')}\n`,
      );
    } catch {}
  }
  if (!files.length)
    sections.push(
      'License text not shipped at package root; consult the source link above.\n',
    );
}
writeFileSync('THIRD-PARTY-NOTICES.md', sections.join('\n'));
