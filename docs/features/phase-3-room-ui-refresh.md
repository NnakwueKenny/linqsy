# Phase 3 Room UI Simplification

## Title

Phase 3 simplified room UI for two-device transfer flow

## User Outcome

Hosts and receivers experience a room UI that is calm, obvious, and focused on QR join, drag-and-drop sending, automatic receiving, and synchronized transfer feedback.

## Why Now

The core join and transfer loop now works, but the UI must match the actual product behavior. This phase removes unnecessary dashboard detail and reshapes the room into a simple two-device send/receive experience.

## In Scope

- redesign the current server-rendered host room UI around QR join and one drop surface
- redesign the current server-rendered receiver room UI around auto-receive and one drop surface
- add a real QR code to the host interface
- add synchronized transfer progress and speed feedback on both connected devices
- support choosing and uploading folders from the room UI
- add a theme toggle with a light default instead of a dark-only presentation
- upgrade the shared React preview app to reflect the simplified two-device flow
- refresh shared UI primitives to support the simpler visual direction

## Out Of Scope

- replacing the server-rendered room with the React app
- full client-side routing and data layer for the web app
- advanced animation systems beyond meaningful waiting-state and transfer-state motion

## Affected Layers

- `apps/server`
- `apps/web`
- `packages/ui`

## Contracts

- preserve existing API routes
- preserve room-script hooks needed for upload, join, transfer progress, and session updates

## State Ownership

- server remains authoritative for room state
- server remains authoritative for transfer progress and speed metrics seen on both devices
- React preview app remains a visual direction layer, not a second source of truth

## Acceptance Criteria

- the live room served by the CLI shows a real QR code on the host side
- the host and receiver UIs feel simple and uncluttered on desktop and mobile
- the room centers drag-and-drop sending instead of transfer-management chrome
- the receiver side communicates automatic receiving clearly
- both devices display the same transfer progress and speed state for active transfers
- multiple transfers are visible in a collapsible queue instead of stacked overlays
- the live room supports choosing a folder as well as individual files
- `apps/web` reflects the simplified two-device room experience
- shared UI primitives support the more restrained visual direction

## Test Plan

- workspace typecheck
- workspace build
- manual smoke test of the live host and join pages
- manual verification that the host page renders a scannable QR code
- manual verification that both devices reflect the same active transfer progress and speed
- manual verification that folder selection uploads multiple files from a chosen folder
- manual check of the Vite web preview

## Risks

- browser download behavior can differ slightly across platforms for automatic saving
- the React preview can drift from the live room if we do not keep the simplified flow aligned
- folder uploads through browser APIs can vary slightly across browsers, especially for drag-and-drop directories

## Frozen Assumptions Used

- light is the default theme, with a user-controlled dark alternative
- the room is intentionally a two-device experience: one sender and one receiver at a time
- automatic receiving is part of the intended product flow
