# Phase 1 Session And Joinability

## Title

Phase 1 session bootstrap and joinable waiting room

## User Outcome

A host can start a Linqsy room, share a join URL or session code on the LAN, and see connected devices appear in the waiting room in real time.

## Why Now

This is the first end-to-end product slice after workspace bootstrap. It turns Linqsy from a scaffold into a usable host-and-join flow and establishes the state model needed before transfer work begins.

## In Scope

- bootstrap a real session when the CLI starts
- render a host waiting room at `/`
- render a client join page at `/join/:code`
- expose session lookup and membership routes
- broadcast presence updates over WebSocket
- allow the host to end the session

## Out Of Scope

- file upload and download
- transfer queue UI
- QR code generation
- persistent storage beyond in-memory session state
- release packaging

## Affected Layers

- `apps/cli`
- `apps/server`
- `packages/shared`

## Contracts

- add join and leave request schemas
- add join response schema
- add `GET /api/session/:code`
- add `POST /api/session/:code/join`
- add `POST /api/session/:code/leave`
- add `POST /api/session/:code/end`
- use `session:state`, `device:joined`, `device:left`, and `session:ended` events for room presence

## State Ownership

- server owns session code, session state, and device membership
- browser pages only reflect authoritative session state from HTTP and WebSocket updates

## Acceptance Criteria

- CLI start command boots a real session and prints host and join URLs
- host page renders the session code and live device list
- join page accepts a device name and joins the session
- session state becomes `active` when a client joins and returns to `waiting` when clients leave
- host can end the session and new joins are rejected afterward

## Test Plan

- integration tests for session lookup, join, leave, and end routes
- workspace typecheck and build
- manual smoke test of CLI startup and host/join pages

## Risks

- presence state is currently in-memory only, so restarting the process resets the room
- server-rendered pages are intentionally lightweight and will likely be replaced by the fuller web app later

## Frozen Assumptions Used

- session state remains server-owned
- Fastify + `ws` remains the baseline transport for this slice
- in-memory session storage is acceptable before transfer persistence work begins
