import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';


const [sourceDirectory, targetDirectory] = process.argv.slice(2);

if (!sourceDirectory || !targetDirectory) {
  console.error('Usage: node copy-web-dist.mjs <sourceDir> <targetDir>');
  process.exit(1);
}

const resolvedSource = path.resolve(process.cwd(), sourceDirectory);
const resolvedTarget = path.resolve(process.cwd(), targetDirectory);

await rm(resolvedTarget, {
  force: true,
  recursive: true,
});

await mkdir(path.dirname(resolvedTarget), {
  recursive: true,
});

await cp(resolvedSource, resolvedTarget, {
  recursive: true,
});
