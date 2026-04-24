#!/usr/bin/env node

import { dirname, extname, join, resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';


const roots = process.argv.slice(2);

if (roots.length === 0) {
  console.error('Usage: node scripts/rewrite-relative-imports.mjs <dist-dir> [...]');
  process.exit(1);
}

const supportedSuffixes = ['.js', '.mjs', '.cjs', '.d.ts', '.d.mts', '.d.cts'];
const specifierPattern = /(from\s*["']|import\s*["']|import\s*\(\s*["']|require\s*\(\s*["'])(\.\.?\/[^"'`]+)(["'])/g;

function isSupportedFile(filePath) {
  return supportedSuffixes.some((suffix) => filePath.endsWith(suffix));
}

function walkFiles(rootPath) {
  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(nextPath));
      continue;
    }

    if (entry.isFile() && isSupportedFile(nextPath)) {
      files.push(nextPath);
    }
  }

  return files;
}

function splitSpecifier(specifier) {
  const match = /^([^?#]*)(.*)$/.exec(specifier);

  return {
    pathPart: match?.[1] ?? specifier,
    suffix: match?.[2] ?? '',
  };
}

function resolveExtensionlessSpecifier(filePath, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }

  const { pathPart, suffix } = splitSpecifier(specifier);

  if (extname(pathPart)) {
    return specifier;
  }

  const resolvedPath = resolve(dirname(filePath), pathPart);

  for (const candidateExtension of ['.js', '.mjs', '.cjs']) {
    if (existsSync(`${resolvedPath}${candidateExtension}`)) {
      return `${pathPart}${candidateExtension}${suffix}`;
    }
  }

  for (const indexFile of ['index.js', 'index.mjs', 'index.cjs']) {
    if (existsSync(join(resolvedPath, indexFile))) {
      return `${pathPart}/${indexFile}${suffix}`;
    }
  }

  return specifier;
}

function rewriteFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let rewriteCount = 0;

  const rewritten = original.replace(specifierPattern, (match, prefix, specifier, suffix) => {
    const updatedSpecifier = resolveExtensionlessSpecifier(filePath, specifier);

    if (updatedSpecifier === specifier) {
      return match;
    }

    rewriteCount += 1;
    return `${prefix}${updatedSpecifier}${suffix}`;
  });

  if (rewriteCount > 0) {
    writeFileSync(filePath, rewritten);
  }

  return rewriteCount;
}

let updatedFiles = 0;
let updatedSpecifiers = 0;

for (const root of roots) {
  const absoluteRoot = resolve(root);

  if (!existsSync(absoluteRoot)) {
    continue;
  }

  for (const filePath of walkFiles(absoluteRoot)) {
    const rewriteCount = rewriteFile(filePath);

    if (rewriteCount === 0) {
      continue;
    }

    updatedFiles += 1;
    updatedSpecifiers += rewriteCount;
  }
}

console.log(
  `Rewrote ${updatedSpecifiers} relative import${updatedSpecifiers === 1 ? '' : 's'} across ${updatedFiles} emitted file${updatedFiles === 1 ? '' : 's'}.`,
);