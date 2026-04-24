# Phase 3 Room UI Simplification Task

## Task Title

Raise the visual quality of the live room and web preview

## Linked Feature Brief

`docs/features/phase-3-room-ui-refresh.md`

## Linked ADRs

none

## Change Summary

Simplify the shared visual primitives, replace the placeholder React preview with a two-device transfer-room concept, add the real host QR code, synchronize progress and speed across both devices, enable folder upload, and restyle the live host/join room pages around drag-and-drop plus automatic receiving.

## Touched Layers

- `apps/server`
- `apps/web`
- `packages/ui`

## Contract Changes

- no breaking API changes
- preserve room-script hooks needed for join, upload, transfer progress, and session updates

## Acceptance Criteria Covered

- the live room served by the CLI shows a real QR code on the host side
- the host and receiver UIs feel simple and uncluttered on desktop and mobile
- the room centers drag-and-drop sending instead of transfer-management chrome
- the receiver side communicates automatic receiving clearly
- both devices show the same active transfer progress and speed state
- multiple transfers appear in a collapsible queue instead of piling up visually
- the room supports choosing folders as well as files
- `apps/web` reflects the simplified two-device room experience
- shared UI primitives support the more restrained visual direction

## Test Execution Plan

- `pnpm typecheck`
- `pnpm build`
- manual smoke test with `pnpm dev:cli -- --no-open --port 4173`
- manual check with `pnpm dev:web`

## Completion Checklist

- implementation complete
- tests complete
- docs updated
- assumptions captured
- risks documented
