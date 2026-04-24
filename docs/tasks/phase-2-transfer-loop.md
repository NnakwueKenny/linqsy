# Phase 2 Transfer Loop Task

## Task Title

Implement the first real host-mediated file transfer loop

## Linked Feature Brief

`docs/features/phase-2-transfer-loop.md`

## Linked ADRs

none

## Change Summary

Add a storage-backed transfer service, binary upload and download routes, transfer cancellation, and transfer-list UI on the host and join pages so a live room can move real files.

## Touched Layers

- `apps/server`
- `apps/cli`
- `packages/shared`

## Contract Changes

- add transfer upload header schema
- add transfer cancel request schema
- add transfer response and transfer list response schemas
- add session transfer-list route
- add transfer upload, download, and cancel routes

## Acceptance Criteria Covered

- a joined room can upload a file into the current session
- transfer metadata appears in the room UI and session API
- a ready transfer can be downloaded through the transfer route
- the transfer lifecycle advances through upload and download states
- host or sender can cancel an in-room transfer
- ending the session cleans up transfer files for that session

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
