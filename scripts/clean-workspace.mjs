import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const rootDirectory = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const generatedDirectories = [
  'apps/cli/dist',
  'apps/server/dist',
  'apps/web/dist',
  'apps/web/node_modules/.vite',
  'packages/config/dist',
  'packages/shared/dist',
  'packages/ui/dist',
  '.release',
];

for (const relativeDirectory of generatedDirectories) {
  await rm(path.join(rootDirectory, relativeDirectory), {
    force: true,
    recursive: true,
  });
}
