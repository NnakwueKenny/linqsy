# Linqsy

Linqsy is a LAN-first file sharing tool that starts from a CLI command and opens a polished browser experience for nearby devices on the same network.

The host runs a command, Linqsy starts a local Fastify + WebSocket server, opens the browser, and shows a joinable sharing surface. Other devices connect from their browsers with a QR code or join link. No client installation is required.

## Current status

Linqsy is in active development.

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
- package-manager release flow
- public repository hygiene before the first release

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

## Open-source notes

This repository is being prepared for public release, but one important legal step is still outstanding:

- choose a project license and add a `LICENSE` file before publishing publicly

Until that is done, the code should not be treated as fully open-source in the legal sense.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Publishing

See [docs/PUBLISHING.md](./docs/PUBLISHING.md) for:
- GitHub preparation
- npm publishing order
- release checklist
