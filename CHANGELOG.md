# Changelog

## 0.1.2 - 2026-04-25

CLI bin path hotfix.

Highlights:
- removed the wrapper bin shim and pointed the package bin directly at the built CLI entry
- fixed local and installed command execution paths so `linqsy start` and `npx linqsy start` resolve more reliably
- aligned the CLI version output with the published patch release through `@linqsy/config`

## 0.1.1 - 2026-04-24

CLI packaging hotfix.

Highlights:
- fixed the published `linqsy` bin entry so `npx linqsy` runs under Node correctly
- aligned the CLI version output with the published patch release through `@linqsy/config`

## 0.1.0 - 2026-04-24

First public npm release.

Highlights:
- published `linqsy` CLI package
- published `@linqsy/shared`, `@linqsy/config`, and `@linqsy/server`
- browser-served React + Tailwind client
- QR/link-based LAN join flow
- one host plus one connected receiver
- file and folder sending
- automatic receive/download behavior
- restart and shutdown support from the browser
