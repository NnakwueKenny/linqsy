# Phase 0 Workspace Bootstrap Task

## Task Title

Create the initial Linqsy monorepo scaffold

## Linked Feature Brief

`docs/features/phase-0-workspace-bootstrap.md`

## Linked ADRs

none

## Change Summary

Introduce the first runnable workspace slice with root config, shared packages, a Fastify health server, a CLI bootstrap, and a placeholder React/Vite web app.

## Touched Layers

- `apps/cli`
- `apps/server`
- `apps/web`
- `packages/shared`
- `packages/ui`
- `packages/config`

## Contract Changes

- add health response schema
- add error envelope schema
- add initial event-name constants

## Acceptance Criteria Covered

- workspace structure exists
- CLI starts the server scaffold
- health endpoint responds
- web package is scaffolded

## Test Execution Plan

- `pnpm install`
- `pnpm typecheck`
- `pnpm --filter @linqsy/cli exec tsx src/main.ts doctor`

## Completion Checklist

- implementation complete
- tests complete
- docs updated
- assumptions captured
- risks documented
