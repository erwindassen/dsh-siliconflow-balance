#!/usr/bin/env node
/**
 * Wrap the tsdown client bundle in the DSH module-loader contract:
 *
 *   window.__ModuleLoader__.load({
 *     id: "<package name>",
 *     factory: (require) => { var module = { exports: {} }; …; return module.exports },
 *   })
 *
 * `require` is supplied by the loader's frozen platform-module table and resolves
 * `react` / `react/jsx-runtime`. See docs/design.md §2.2.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundlePath = join(root, 'lib', 'client.js');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

let body = await readFile(bundlePath, 'utf8');
body = body.replace(/\/\/# sourceMappingURL=.*$/m, '').trimEnd();

const indented = body
  .split('\n')
  .map((line) => (line.length > 0 ? `    ${line}` : line))
  .join('\n');

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageJson.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${indented}
    return module.exports;
  },
});
`;

await writeFile(bundlePath, wrapped);
console.log(`wrapped ${bundlePath} for ${packageJson.name}`);
