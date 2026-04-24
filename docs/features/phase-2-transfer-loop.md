# Phase 2 Transfer Loop

## Title

Phase 2 upload, download, and cancel flow inside the live room

## User Outcome

A host or joined device can upload a file into the room, everyone in the session can see the transfer appear live, and participants can download or cancel transfers without leaving the room.

## Why Now

The waiting room is already live. The next critical path step is making the room actually useful by enabling the core host-mediated transfer loop before we invest in deeper UI polish or packaging.

## In Scope

- session-scoped transfer storage in app-owned temp directories
- transfer service and storage layer on the server
- upload route for binary file transfer into a session
- download route for streaming files back out
- cancel route for sender or host
- transfer list UI on both host and join pages
- realtime session updates when transfers change state

## Out Of Scope

- resumable transfers
- chunked multipart uploads
- background retry queues
- persistent storage across process restarts
- QR-code based join flows

## Affected Layers

- `apps/server`
- `apps/cli`
- `packages/shared`

## Contracts

- add transfer upload header schema
- add transfer cancel request schema
- add `GET /api/session/:code/transfers`
- add `POST /api/session/:code/transfers/upload`
- add `GET /api/transfers/:transferId/download`
- add `POST /api/transfers/:transferId/cancel`
- add transfer response and transfer list response schemas

## State Ownership

- server owns transfer metadata, lifecycle state, and temporary file storage
- room pages render authoritative transfer state from HTTP and WebSocket updates

## Acceptance Criteria

- a joined room can upload a file into the current session
- transfer metadata appears in the room UI and session API
- a ready transfer can be downloaded through the transfer route
- the transfer lifecycle advances through upload and download states
- host or sender can cancel an in-room transfer
- ending the session cleans up transfer files for that session

## Test Plan

- integration tests for upload, download, and cancel routes
- workspace typecheck and build
- manual smoke test of host upload and client download on the local network

## Risks

- server-rendered pages are still lightweight and may need a richer web-client replacement later
- current transfer authorization is session-based rather than strongly identity-bound across reconnects
- local temp storage is intentionally ephemeral for this phase

## Frozen Assumptions Used

- transfer storage stays inside an app-owned temp directory
- binary uploads use raw request streaming rather than multipart dependencies
- server remains the source of truth for transfer lifecycle changes
