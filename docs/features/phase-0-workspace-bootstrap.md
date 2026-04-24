# Phase 0 Workspace Bootstrap

## Title

Phase 0 workspace bootstrap

## User Outcome

Engineers can start building Linqsy in a real monorepo instead of a docs-only repository.

## Why Now

This is the first implementation slice in the v1 critical path and unblocks all CLI, server, shared-contract, and web work.

## In Scope

- root workspace configuration
- app and package scaffolding
- initial shared schema package
- initial config package
- initial server and CLI bootstrap
- initial web placeholder app

## Out Of Scope

- full transfer room implementation
- complete join/session flow
- production styling polish
- release packaging

## Affected Layers

- `apps/cli`
- `apps/server`
- `apps/web`
- `packages/shared`
- `packages/ui`
- `packages/config`

## Contracts

- add initial `Session`, `Device`, `Transfer`, and error schemas
- add `GET /api/health`
- add initial WebSocket scaffold path at `/ws`

## State Ownership

- server owns health and realtime scaffold state
- web owns local placeholder UI state only

## Acceptance Criteria

- workspace has real app/package structure
- CLI can boot the initial Fastify server
- server exposes `GET /api/health`
- root route renders a placeholder landing page
- web package exists with React/Vite/Tailwind scaffold

## Test Plan

- install workspace dependencies
- typecheck all packages
- run CLI bootstrap and confirm health endpoint

## Risks

- dependency installation may require network access
- Vite/Tailwind scaffold may need follow-up adjustment once full UI work begins

## Frozen Assumptions Used

- Fastify + `ws` is the server baseline
- Atomic Design starts with minimal UI primitives in `packages/ui`
