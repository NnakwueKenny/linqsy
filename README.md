# Linqsy

[![CI](https://github.com/NnakwueKenny/linqsy/actions/workflows/ci.yml/badge.svg)](https://github.com/NnakwueKenny/linqsy/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/linqsy)](https://www.npmjs.com/package/linqsy)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Linqsy is a LAN-first file sharing tool that starts from a CLI command and opens a polished browser experience for nearby devices on the same network.

The host runs a command, Linqsy starts a local Fastify + WebSocket server, opens the browser, and shows a joinable sharing surface. Other devices connect from their browsers with a QR code or join link. No client installation is required.

## Current status

`0.1.4` is the current CLI patch target on npm, following the initial `0.1.0` release.

What is already working:
- host startup from the CLI
- browser-served React + Tailwind UI
- QR/link-based joining on the same LAN
- one host plus one connected receiver
- file and folder sending
- automatic receive/download flow
- restart and shutdown from the browser

What is still being refined:
- reconnect grace periods
- final UI polish across every screen size
- deeper end-to-end smoke coverage after publish
- release automation for future versions

## Install

### Global install

```bash
npm install -g linqsy
pnpm add -g linqsy
yarn global add linqsy
```

### Run without installing globally

```bash
npx linqsy
pnpm dlx linqsy
yarn dlx linqsy
```

## Package links

- CLI: https://www.npmjs.com/package/linqsy
- Shared contracts: https://www.npmjs.com/package/@linqsy/shared
- Config: https://www.npmjs.com/package/@linqsy/config
- Server runtime: https://www.npmjs.com/package/@linqsy/server

## Stack

- Node.js
- TypeScript
- Fastify
- `ws`
- React
- Vite
- Tailwind CSS
- Framer Motion
- Zod
- pnpm workspaces

## Monorepo layout

```text
apps/
  cli/      CLI entrypoint and host runtime bootstrap
  server/   HTTP, WebSocket, session, and transfer runtime
  web/      React/Tailwind browser client
packages/
  config/   app metadata and configuration
  shared/   shared contracts and schemas
  ui/       reusable UI primitives
docs/
  steering/ product and engineering rules
  templates/ planning and delivery templates
  features/ historical implementation notes by phase
  tasks/     historical task notes by phase
scripts/
  clean-workspace.mjs
  copy-web-dist.mjs
  rewrite-relative-imports.mjs
```

## Local development

### Requirements

- Node.js 22+
- pnpm 10+

### Install

```bash
pnpm install
```

### Start the product locally

```bash
pnpm dev:cli
```

Useful variants:

```bash
pnpm dev:cli -- --no-open
pnpm dev:cli -- --port 4173 --code DEMO42 --name "Kene Mac"
pnpm dev:web
pnpm dev:server
```

### Quality checks

```bash
pnpm typecheck
pnpm --filter @linqsy/server test
pnpm build
pnpm release:check
```

### Packaging dry run

To inspect the exact tarballs that would be published:

```bash
pnpm --filter @linqsy/shared pack --pack-destination ../../.release
pnpm --filter @linqsy/config pack --pack-destination ../../.release
pnpm --filter @linqsy/server pack --pack-destination ../../.release
pnpm --filter linqsy pack --pack-destination ../../.release
```

### Clean generated output

```bash
pnpm clean
```

## Product flow

1. Run `linqsy start` or `pnpm dev:cli`.
2. Linqsy starts a local host session and opens the host page.
3. A second device scans the QR code or opens the join link.
4. Once connected, the centered drop zone becomes active.
5. Files or folders sent from either side are received automatically on the other side.

## Release notes

See [CHANGELOG.md](./CHANGELOG.md) for the published release notes.

## License

[MIT](./LICENSE)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Publishing

See [docs/PUBLISHING.md](./docs/PUBLISHING.md) for:
- GitHub preparation
- npm publishing order
- release checklist
