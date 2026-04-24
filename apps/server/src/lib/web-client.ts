import { existsSync, } from 'node:fs';
import { readFile, } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, } from 'node:url';
import type { WebPageBootstrap, } from '@linqsy/shared';


type LoadedWebAsset = {
  content: Buffer;
  contentType: string;
};

const MIME_TYPES = new Map<string, string>([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

let cachedIndexHtml: string | null = null;
let cachedDistDirectory: string | null = null;

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function findWorkspaceRoot(startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  while (true) {
    if (existsSync(path.join(currentDirectory, 'pnpm-workspace.yaml'))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

function resolveWebDistDirectory(): string {
  if (cachedDistDirectory) {
    return cachedDistDirectory;
  }

  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoots = new Set<string>();

  const cwdWorkspaceRoot = findWorkspaceRoot(process.cwd());
  const moduleWorkspaceRoot = findWorkspaceRoot(moduleDirectory);

  if (cwdWorkspaceRoot) {
    workspaceRoots.add(cwdWorkspaceRoot);
  }

  if (moduleWorkspaceRoot) {
    workspaceRoots.add(moduleWorkspaceRoot);
  }

  const candidates = Array.from(workspaceRoots).flatMap((workspaceRoot) => [
    path.join(workspaceRoot, 'apps/web/dist'),
    path.join(workspaceRoot, 'dist/apps/web'),
  ]);

  candidates.unshift(
    path.resolve(moduleDirectory, '../../web'),
    path.resolve(moduleDirectory, '../web'),
  );

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'index.html'))) {
      cachedDistDirectory = candidate;
      return candidate;
    }
  }

  throw new Error(
    `Linqsy web build was not found. Checked: ${candidates.join(', ') || 'no workspace roots found'}. Run "pnpm --filter @linqsy/web build" or "pnpm build" first.`,
  );
}

function resolveSafePath(root: string, relativePath: string): string | null {
  const normalizedPath = relativePath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(root, normalizedPath);
  const relativeFromRoot = path.relative(root, resolvedPath);

  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null;
  }

  return resolvedPath;
}

function getContentType(filePath: string): string {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

async function readIndexHtml(): Promise<string> {
  if (cachedIndexHtml) {
    return cachedIndexHtml;
  }

  const distDirectory = resolveWebDistDirectory();
  cachedIndexHtml = await readFile(path.join(distDirectory, 'index.html'), 'utf8');
  return cachedIndexHtml;
}

export async function renderWebClientDocument(bootstrap: WebPageBootstrap): Promise<string> {
  const html = await readIndexHtml();
  const bootstrapScript =
    `<script>window.__LINQSY_BOOTSTRAP__=${safeJson(bootstrap)};</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${bootstrapScript}</head>`);
  }

  return `${bootstrapScript}${html}`;
}

export async function loadWebAsset(relativePath: string): Promise<LoadedWebAsset | null> {
  const distDirectory = resolveWebDistDirectory();
  const resolvedPath = resolveSafePath(distDirectory, relativePath);

  if (!resolvedPath || !existsSync(resolvedPath)) {
    return null;
  }

  return {
    content: await readFile(resolvedPath),
    contentType: getContentType(resolvedPath),
  };
}
