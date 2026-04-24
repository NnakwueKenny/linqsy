# Linqsy Master Steering

## Purpose

This file is the top-level source of truth for Linqsy implementation.
It freezes major decisions, defines document authority, and prevents unnecessary re-decisions during development.

## Frozen Baseline (v1)

- Product model: LAN-only, host-mediated transfer room
- Runtime: Node.js + TypeScript
- Server framework: Fastify (not NestJS, not Express, not raw Node `http`)
- Server design approach: pragmatic SOLID principles
- Realtime transport: `ws`
- Frontend: React + Vite + Tailwind CSS + Framer Motion
- Client state: Zustand
- Shared validation/contracts: Zod in `packages/shared`
- UI methodology: Atomic Design

## Source Of Truth Hierarchy

Use docs in this order:

1. `STEERING.md` (this file)
2. `docs/steering/product.md`
3. `docs/steering/engineering.md`
4. `docs/steering/backend.md`
5. `docs/steering/frontend.md`
6. `docs/steering/design-system.md`
7. `docs/steering/atomic-design.md`
8. `docs/steering/workflow.md`
9. `docs/steering/agents.md`
10. `implementation_plan.md` as original product context, not implementation authority

If there is a conflict, the higher item in this list wins.

## Monorepo Ownership

- `apps/cli`: CLI commands, startup orchestration, browser open behavior, terminal output
- `apps/server`: session lifecycle, transfer lifecycle, HTTP APIs, WebSocket events, storage cleanup
- `apps/web`: host/client UI, interaction state, realtime rendering
- `packages/shared`: schemas, DTOs, event contracts, constants
- `packages/ui`: UI primitives and reusable composed components

## Non-Negotiable Boundaries

- v1 is LAN-only
- v1 is host-mediated only
- clients never browse each other's file systems
- no accounts or cloud dependencies for v1
- cleanup is part of core behavior, not optional polish
- server is source of truth for shared room state

## Canonical v1 Interfaces

CLI commands:
`linqsy start`, `linqsy doctor`, `linqsy version`

Transfer statuses:
`queued`, `uploading`, `ready`, `downloading`, `completed`, `failed`, `cancelled`

HTTP routes:
- `GET /api/health`
- `GET /api/session/:code`
- `POST /api/session/:code/join`
- `POST /api/session/:code/leave`
- `POST /api/session/:code/end`
- `GET /api/session/:code/transfers`
- `POST /api/session/:code/transfers/upload`
- `GET /api/transfers/:transferId/download`
- `POST /api/transfers/:transferId/cancel`

Event families:
- client -> server: `device:*`, `session:*`, `transfer:*`
- server -> client: `session:*`, `device:*`, `transfer:*`

## Mandatory Workflow Gates

Before meaningful implementation starts:

1. Complete `docs/templates/feature-brief.md`
2. Open ADR if change hits any ADR trigger
3. Define acceptance criteria
4. Define test scope (unit, integration, QA checklist)

A task is blocked from coding if these are missing.

## ADR Triggers

Any change to the following requires an ADR:

- server framework
- realtime transport
- storage model
- state ownership model
- design-system foundation
- package boundaries
- major dependency additions that affect architecture

## v1 Definition Of Done

Linqsy v1 is done when:

- `linqsy start` consistently boots a working host session
- waiting page shows QR code, join URL, and session code
- at least one mobile client can join on LAN
- uploads and downloads work end-to-end
- transfer progress and status are visible in UI
- host can end session cleanly
- temporary files are cleaned up reliably

## Agent Rules To Reduce Context Switching

- Read steering docs in the defined order before implementation
- Do not reopen frozen decisions unless asked
- Use templates in `docs/templates/` for all scoped work
- Ask for clarification only when uncertainty changes architecture or behavior
- Record assumptions explicitly in the feature brief

## Legacy Notes

Older docs in `docs/` are retained for continuity but subordinate to `docs/steering/*`.

## Frozen Decisions

- Node.js + TypeScript + Fastify + `ws` is the backend baseline for v1
- Server architecture should follow SOLID principles without introducing unnecessary framework-like ceremony
- Atomic Design is mandatory for reusable UI construction
- Product scope is LAN-only host-mediated transfer

## Requires ADR

- Any deviation from the frozen decisions in this file
