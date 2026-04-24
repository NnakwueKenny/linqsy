# Linqsy — Product & Implementation Plan

## 1. Overview

Linqsy is a LAN-only browser-based file transfer tool started from a CLI command on a host machine.

The host runs a command in the terminal, a local service starts, and the browser opens automatically to a polished session page showing a QR code, join link, and connection status. Other devices on the same local network can join from their browsers without installing an app.

Once connected, every participant can send files from their own device using the native file picker or drag-and-drop. Participants do not browse one another’s file systems. The host coordinates the session and routes transfers.

---

## 2. Product Goals

### Primary goals
- Fast local file transfer over the same network
- Beautiful browser interface on both host and client devices
- Zero client installation
- Simple CLI-based host startup
- Cross-platform host support
- Reliable file transfer with clean progress and status updates

### Non-goals for initial release
- Internet-based transfer
- Cloud sync or file storage
- Account system
- WebRTC peer-to-peer transport
- Remote file system browsing
- Persistent background daemon by default
- Native desktop app UI

---

## 3. Core Product Model

Linqsy is a **host-mediated transfer room**.

- The host starts the session
- The host exposes a local HTTP/WebSocket service on the LAN
- Clients join using a QR code or LAN URL
- Any connected participant can send files
- Recipients download files through the session UI
- Temporary transfer files are stored on the host during the session

This is not a remote file explorer. It is a session-based transfer system.

---

## 4. User Experience

### 4.1 Host flow
1. User installs Linqsy on a host computer
2. User runs `linqsy start`
3. Linqsy starts a local server and detects LAN IP
4. Linqsy opens the default browser automatically
5. Host waiting page displays:
   - QR code
   - Join link
   - Session code
   - Connected devices count
   - Optional session name
6. Clients join from other devices on the same network
7. Host and clients enter the main transfer room

### 4.2 Client flow
1. Client scans QR code or opens join link
2. Client enters the transfer room in the browser
3. Client can:
   - select files from native file picker
   - drag and drop files
   - view transfer history
   - download received files

### 4.3 Main transfer room
Every connected device sees a clean shared UI with:
- session header
- device presence list
- send files button
- drag-and-drop area
- incoming transfers
- outgoing transfers
- activity feed
- connection state

---

## 5. Suggested Stack

### Primary Distribution Model (v1)
- Node.js CLI package (npm-first)
- Global install (`npm install -g linqsy`) and `npx linqsy` support

### Host runtime / backend
- Node.js
- TypeScript
- Fastify or Express
- WebSocket (`ws` or Socket.IO)

### Frontend
- React
- Vite
- Tailwind CSS
- Framer Motion

### Shared packages
- Shared TypeScript contracts and schemas
- Zod for validation

### Workspace tooling
- pnpm workspace
- Turbo or simple workspace scripts

### Host runtime / backend
- Node.js
- TypeScript
- Fastify or Express
- WebSocket (`ws` or Socket.IO)

### Frontend
- React
- Vite
- Tailwind CSS
- Framer Motion

### Shared packages
- Shared TypeScript contracts and schemas
- Zod for validation

### Workspace tooling
- pnpm workspace
- Turbo or simple workspace scripts

---

## 6. Architecture

### 6.1 High-level architecture

```text
Host CLI
  -> starts local Node server
  -> opens browser automatically
  -> serves web UI + APIs + WebSocket

Host Browser UI <-> Host Server <-> Client Browser UI(s)
```

### 6.2 Core responsibilities

#### CLI
- Start server
- Pick port
- Detect LAN IP
- Open browser
- Print session info in terminal

#### Server
- Session lifecycle
- Device management
- File upload handling
- File download handling
- Temporary file storage
- WebSocket event broadcasting
- Session cleanup

#### Web UI
- Waiting screen
- Transfer room
- Upload interactions
- Download interactions
- Transfer status and activity

---

## 7. Monorepo Structure

```text
linqsy/
  apps/
    cli/
    server/
    web/
  packages/
    shared/
    ui/
    config/
  docs/
  scripts/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

### 7.1 `apps/cli`
Responsibilities:
- expose `linqsy` command
- implement `linqsy start`
- start local server
- auto-open browser
- print QR or link in terminal if needed

### 7.2 `apps/server`
Responsibilities:
- session management
- device connections
- transfer APIs
- WebSocket server
- temp file management
- cleanup

### 7.3 `apps/web`
Responsibilities:
- host waiting page
- client join screen
- transfer room UI
- transfer cards
- activity feed
- responsive layout

### 7.4 `packages/shared`
Contains:
- event names
- DTOs
- enums
- API response types
- schemas

### 7.5 `packages/ui`
Contains:
- reusable React UI components
- buttons
- cards
- progress bars
- layout components
- modals
- toasts

---

## 8. CLI Design

### 8.1 Commands

#### `linqsy start`
Starts a new transfer session.

Suggested flags:
- `--port <number>`
- `--host <host>`
- `--name <session-name>`
- `--no-open`
- `--code <session-code>`
- `--approval <on|off>`

#### `linqsy doctor`
Checks:
- local Node runtime assumptions
- browser open capability
- network interface detection
- port binding

#### `linqsy version`
Prints current version.

### 8.2 CLI behavior
When `linqsy start` runs:
1. validate config
2. pick port
3. detect LAN IP
4. generate session ID and code
5. start server
6. open browser to local host UI
7. print terminal summary:
   - session code
   - local URL
   - LAN URL
   - status

---

## 9. Session and Device Model

### 9.1 Session
```ts
type Session = {
  id: string
  code: string
  name?: string
  hostDeviceId: string
  createdAt: number
  expiresAt?: number
  status: 'waiting' | 'active' | 'ended'
  devices: Device[]
  transfers: Transfer[]
}
```

### 9.2 Device
```ts
type Device = {
  id: string
  name: string
  role: 'host' | 'client'
  userAgent: string
  connectedAt: number
  isOnline: boolean
  socketId?: string
}
```

### 9.3 Transfer
```ts
type Transfer = {
  id: string
  sessionId: string
  senderDeviceId: string
  filename: string
  size: number
  mimeType: string
  createdAt: number
  status: 'queued' | 'uploading' | 'ready' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  tempPath: string
  recipients?: string[]
}
```

---

## 10. API Plan

### 10.1 HTTP routes

#### Health
- `GET /api/health`

#### Session
- `GET /api/session/:code`
- `POST /api/session/:code/join`
- `POST /api/session/:code/leave`
- `POST /api/session/:code/end`

#### Transfers
- `POST /api/session/:code/transfers/upload`
- `GET /api/transfers/:transferId/download`
- `POST /api/transfers/:transferId/cancel`
- `GET /api/session/:code/transfers`

#### Device
- `GET /api/session/:code/devices`

### 10.2 Sample join payload
```json
{
  "deviceName": "Kene's iPhone"
}
```

---

## 11. WebSocket Event Plan

### 11.1 Client -> server
- `device:hello`
- `session:join`
- `session:leave`
- `transfer:create`
- `transfer:cancel`
- `transfer:downloaded`

### 11.2 Server -> client
- `session:state`
- `device:joined`
- `device:left`
- `transfer:created`
- `transfer:progress`
- `transfer:ready`
- `transfer:completed`
- `transfer:failed`
- `session:ended`

### 11.3 Notes
- shared event contracts should live in `packages/shared`
- server remains source of truth
- clients should rehydrate from `/api/session/:code` on reconnect

---

## 12. File Transfer Strategy

### 12.1 v1 transfer path
1. Sender selects files locally
2. Browser uploads file(s) to host server
3. Host stores files temporarily
4. Recipient sees transfer card in UI
5. Recipient downloads file via host server
6. Host cleans up later

### 12.2 Upload implementation
- multipart upload or streamed upload
- track progress client-side and server-side
- support multiple file selection

### 12.3 Download implementation
- standard HTTP download endpoint
- browser handles file saving
- optionally zip multiple files later

### 12.4 Temporary storage
Suggested path:
```text
~/.linqsy/sessions/<session-id>/uploads/
```
Or use OS temp storage with metadata persisted under Linqsy config directory.

### 12.5 Cleanup rules
- remove stale sessions on startup
- remove completed transfer temp files after expiry window
- remove session directory on session end
- remove orphaned temp data after crash recovery detection

---

## 13. UI / Design Plan

### 13.1 Design goals
- sleek
- premium
- uncluttered
- mobile-friendly
- touch-friendly
- visually modern

### 13.2 Visual direction
- dark-first theme
- subtle gradients
- rounded corners
- soft shadows
- glass-style layering where useful
- tasteful motion and transitions

### 13.3 Core screens

#### A. Host waiting screen
Contains:
- logo mark
- session title
- QR code card
- join URL
- session code
- copy button
- connected devices counter
- animated waiting state

#### B. Transfer room
Contains:
- top header
- send files CTA
- drag and drop zone
- transfer list
- activity feed
- presence list
- status bar

#### C. Session ended screen
Contains:
- ended message
- restart option for host
- close action for clients

### 13.4 Required UI components
- AppShell
- SessionHeader
- QRCard
- WaitingCard
- PresenceList
- DeviceBadge
- SendFilesButton
- Dropzone
- TransferCard
- TransferList
- ActivityFeed
- ToastProvider
- SessionEndedModal

---

## 14. State Management Plan

### 14.1 Local client state
Recommended tool:
- Zustand

State slices:
- session
- current device
- connected devices
- transfers
- websocket status
- UI toasts

### 14.2 Source of truth
Server owns:
- session state
- device membership
- transfer lifecycle
- cleanup state

Client owns:
- local interaction state
- upload progress UI
- temporary notifications

---

## 15. Security and Permissions

### 15.1 v1 baseline
- random session code
- LAN-only usage assumption
- host can end session anytime
- no remote file browsing
- no filesystem write access outside app temp storage
- optional approval for device join
- optional approval for incoming transfers

### 15.2 Additional safety controls for later
- PIN-protected join
- device approval list
- session expiry timer
- per-device permissions
- receive-only mode
- host-only transfer mode

---

## 16. Config and Local Data

Suggested local app directory:

```text
~/.linqsy/
  config.json
  sessions/
  logs/
```

### 16.1 Config example
```json
{
  "defaultPort": 4173,
  "autoOpenBrowser": true,
  "deviceName": "Kene's Mac",
  "requireApproval": false,
  "cleanupHours": 12
}
```

---

## 17. Development Milestones

### Milestone 1 — Project bootstrap
- create monorepo
- workspace scripts
- TypeScript configs
- shared package
- React app scaffold
- server scaffold
- CLI scaffold

### Milestone 2 — Session startup
- implement `linqsy start`
- detect LAN IP
- pick port
- generate session code
- open browser
- expose waiting page

### Milestone 3 — Join flow
- join route
- session rehydration
- device registration
- device presence updates
- waiting room UI updates

### Milestone 4 — Transfer room
- room shell UI
- send files button
- drag-and-drop
- transfer cards
- activity feed

### Milestone 5 — File transfers
- upload endpoint
- temp file storage
- progress updates
- download endpoint
- completion states
- cancellation handling

### Milestone 6 — Polish
- loading states
- error handling
- reconnect handling
- session end UX
- mobile responsiveness
- beautiful animations

### Milestone 7 — Packaging and release
- npm package setup
- bin command setup
- GitHub release workflow
- docs
- install guide

---

## 18. Testing Plan

### 18.1 Unit tests
Test:
- session code generation
- LAN IP detection helpers
- transfer metadata generation
- cleanup logic
- schema validation

### 18.2 Integration tests
Test:
- session creation
- client join
- file upload
- transfer broadcast
- file download
- session end cleanup

### 18.3 Manual QA matrix
Test on:
- macOS host + iPhone client
- macOS host + Android client
- Windows host + Android client
- Linux host + mobile browser client

Test browsers:
- Chrome
- Edge
- Safari
- mobile Safari
- Chrome on Android

---

## 19. Packaging and Distribution Plan

### 19.1 v1 Distribution Strategy (Node-first)

Linqsy will ship first as a Node CLI package.

Primary install methods:

```bash
npm install -g linqsy
linqsy start
```

Optional zero-install usage:

```bash
npx linqsy start
```

### 19.2 npm Package Setup

`package.json` should expose CLI via `bin`:

```json
{
  "name": "linqsy",
  "bin": {
    "linqsy": "./dist/cli.js"
  }
}
```

Requirements:
- CLI entry file must include Node shebang (`#!/usr/bin/env node`)
- Build step outputs compiled JS to `dist/`
- Ensure executable permissions are preserved

### 19.3 Advantages of Node-first approach

- Fastest path to shipping
- Matches CLI-first UX
- No OS-specific packaging overhead
- Works across macOS, Windows, Linux
- Easy updates via npm
- Ideal for developer and early adopter audience

### 19.4 Tradeoffs

- Requires Node.js installed on host machine
- Not ideal for non-technical users initially

### 19.5 Future Distribution Phases

#### Phase B — Native Package Managers
- Homebrew (macOS)
- WinGet (Windows)
- Linux packages (deb/rpm)

#### Phase C — Native Wrapper / Binary
- Bundle Node runtime into single executable (e.g., pkg, nexe)
- Provide downloadable binary installers
- Optional system tray / menu bar companion

#### Phase D — Full Desktop Experience
- Native app wrapper (optional)
- Background daemon mode
- Auto-start options

## 20. Roadmap Beyond v1
 Roadmap Beyond v1

These are features to consider later, but not ship in initial release.

### 20.1 Near-term post-v1
- send entire folders where browser supports it
- custom device names
- transfer retry
- multiple concurrent recipients
- session PIN
- host approval toggle
- transfer history within session
- resumable uploads for large files

### 20.2 Mid-term
- clipboard text transfer
- image preview before download
- audio/video preview
- session chat or notes
- richer activity timeline
- QR code shown in terminal as ASCII fallback
- custom themes
- receive-only room mode
- sender targeting specific recipient(s)

### 20.3 Advanced future features
- WebRTC transport option
- direct browser-to-browser mode
- optional encrypted payloads
- internet relay mode with TURN/server fallback
- native tray/menu-bar companion
- persistent daemon mode
- file explorer mode for approved folders
- collaborative room features
- transfer resume after reconnect
- multiple host rooms on one device

### 20.4 Enterprise / team features
- audit logs
- signed links
- temporary auth policies
- role-based room permissions
- managed deployment for teams
- organization branding

---

## 21. Product Principles

Linqsy should always feel:
- simple before clever
- beautiful before crowded
- fast before feature-heavy
- local-first before cloud-first
- easy to start before deeply configurable

Every future feature should be evaluated against those principles.

---

## 22. Suggested Initial Backlog

### Epic 1 — Foundation
- repo bootstrap
- workspace setup
- linting
- formatting
- TypeScript config
- shared contracts package

### Epic 2 — CLI
- command parser
- start command
- open browser
- config loading

### Epic 3 — Server
- session manager
- device manager
- transfer manager
- HTTP routes
- WebSocket server

### Epic 4 — Frontend
- waiting page
- room page
- transfer components
- activity feed
- presence UI

### Epic 5 — Transfers
- uploads
- downloads
- temp storage
- cleanup
- progress events

### Epic 6 — Polish
- mobile UX
- errors
- animations
- branding
- final pass

---

## 23. Prompt Seed for IDE Agent

```text
Build a monorepo for a LAN-only browser-based file transfer tool named Linqsy.

Stack:
- Node.js + TypeScript
- Fastify or Express backend
- WebSocket for realtime events
- React + Vite + Tailwind frontend
- pnpm workspace
- shared TypeScript contracts between apps

Behavior:
- Host runs `linqsy start`
- CLI starts a local LAN server and auto-opens the browser
- Host waiting page shows QR code, join link, session code, and connected devices count
- Other devices on the same network join from the browser with no install
- All connected devices can send files using file picker or drag-and-drop
- Devices do not browse each other’s file systems
- Files are uploaded to the host service and made available to recipient devices
- Show transfer progress, connection state, activity feed, and session state
- Host can end session at any time
- Temp files must be cleaned up automatically

Create:
1. Monorepo structure with apps/cli, apps/server, apps/web, packages/shared, packages/ui
2. CLI boot flow with `linqsy start`
3. LAN IP detection and port selection
4. Session creation and join flow
5. QR code generation
6. Shared API and websocket contracts
7. Upload and download endpoints
8. Transfer lifecycle state handling
9. Responsive polished UI
10. Temp storage and cleanup
11. Baseline tests

Do not implement for v1:
- internet-based transfer
- cloud storage
- accounts
- WebRTC
- remote file browsing
- native desktop app UI
```

---

## 24. Definition of Done for v1

Linqsy v1 is done when:
- `linqsy start` works reliably on at least one host OS
- browser opens automatically
- waiting page renders correctly
- client joins from mobile browser on same network
- file upload works from host and client
- file download works for recipients
- progress and status are visible
- session can be ended cleanly
- temp files are cleaned up
- UI feels polished and cohesive

---

## 25. Notes on Naming

`Linqsy` is the working product name for now.

Before public release, validate:
- npm package name availability
- GitHub org/repo naming
- domain options
- package-manager naming collisions

If conflicts are significant, preserve Linqsy internally as codename and publish under a distinct public brand later.
