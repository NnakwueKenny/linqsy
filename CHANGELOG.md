# Changelog

## 0.1.5 - 2026-05-01

Live streaming transfer polish.

Highlights:
- improved CLI development startup around the web client build flow
- refined transfer streaming behavior for active uploads and downloads
- prepared the next npm patch release after 0.1.4

## 0.1.4 - 2026-04-30

Large transfer reliability patch.

Highlights:
- raised the streamed binary upload cap for LAN-sized transfers
- improved local upload/download stream buffering
- switched received downloads away from in-memory Blob assembly
- surfaced browser upload failures instead of silently swallowing them
- encoded transfer filename and folder-path headers for real-world filenames

## 0.1.3 - 2026-04-25

CLI symlink execution hotfix.

Highlights:
- fixed the direct-entry check so globally installed npm symlinks execute the CLI correctly
- restored `linqsy version`, `linqsy doctor`, and `linqsy start` through normal global installs
- aligned the CLI version output with the published patch release through `@linqsy/config`

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
