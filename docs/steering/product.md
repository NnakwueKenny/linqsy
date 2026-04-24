# Product Steering

## Objective

Linqsy v1 must provide fast, polished, LAN-only browser file sharing with zero client install.

## Target Experience

Host flow:

1. Run `linqsy start`
2. Browser opens waiting page
3. Waiting page shows QR, join URL, session code, live participant count
4. Clients join from same network
5. Room supports transfer, visibility, and clean completion

Client flow:

1. Join via QR or URL
2. Upload via picker or drag-and-drop
3. Track transfer states
4. Download received files

## v1 Scope

In scope:

- host-created transfer room
- LAN join and presence
- host-mediated upload and download
- transfer status, activity, and connection state UI
- session cleanup and crash-recovery cleanup

Out of scope:

- internet transfer
- cloud sync/storage
- accounts/auth system
- WebRTC transport
- remote filesystem browsing
- native desktop GUI
- persistent daemon mode by default

## Prioritization Rules

- Keep core transfer loop stable before adding optional features
- Prioritize reliability and clear UX over feature count
- Prefer decisions that reduce startup friction and support mobile browsers

## v1 Milestone Sequence

1. Workspace and app scaffolding
2. Host startup path
3. Waiting page and joinability
4. Presence and room shell
5. Upload/download lifecycle
6. Cleanup and resiliency
7. UX polish and packaging

## Acceptance Bar

v1 ships only when:

- host and mobile client can complete real transfers on LAN
- statuses are accurate through completion and failure
- session termination and cleanup are reliable
- UI is cohesive and usable on desktop and mobile

## Deferred Features

Post-v1 candidates:

- session PIN or advanced approvals
- resumable transfers
- folder transfer enhancements
- chat/notes and richer timeline
- internet relay and WebRTC modes

## Frozen Decisions

- v1 is host-mediated LAN transfer only
- v1 does not include cloud, accounts, or remote browsing

## Requires ADR

- Changing v1 scope boundaries or shipping non-goal features in v1
