# Phase 1 Session And Joinability Task

## Task Title

Implement the first real host-and-join session flow

## Linked Feature Brief

`docs/features/phase-1-session-and-joinability.md`

## Linked ADRs

none

## Change Summary

Replace the placeholder bootstrap page with a real waiting room, add join and membership APIs, connect WebSocket presence updates, and upgrade the CLI to create and announce a real session on startup.

## Touched Layers

- `apps/cli`
- `apps/server`
- `packages/shared`

## Contract Changes

- add session join and leave request schemas
- add session join response schema
- add session lifecycle HTTP endpoints
- wire session presence events into the waiting room and join pages

## Acceptance Criteria Covered

- CLI start command boots a real session and prints host and join URLs
- host page renders the session code and live device list
- join page accepts a device name and joins the session
- session state becomes `active` when a client joins and returns to `waiting` when clients leave
- host can end the session and new joins are rejected afterward

## Test Execution Plan

- `pnpm --filter @linqsy/server test`
- `pnpm typecheck`
- `pnpm build`
- manual smoke test with `pnpm dev:cli -- --no-open --port 4173`

## Completion Checklist

- implementation complete
- tests complete
- docs updated
- assumptions captured
- risks documented
