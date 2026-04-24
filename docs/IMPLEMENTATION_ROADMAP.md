# Linqsy Implementation Roadmap (v1)

## Purpose

This roadmap sequences delivery now that stack decisions are frozen in `STEERING.md`.

## Prerequisite

Before coding each meaningful item, complete workflow gates in `docs/steering/workflow.md`.

## Delivery Phases

### Phase 0: Workspace bootstrap

- create monorepo scaffolding for `apps/*` and `packages/*`
- install shared TypeScript, lint, and test tooling
- verify cross-package import path strategy

Exit:

- workspace builds and runs all app stubs

### Phase 1: Host startup core

- implement CLI command parsing (`start`, `doctor`, `version`)
- resolve config and defaults
- detect LAN IP and bind server
- auto-open browser and print session summary

Exit:

- running `linqsy start` launches a reachable waiting page

### Phase 2: Session and joinability

- implement session manager and join flows
- render waiting page with QR/URL/code
- implement presence updates over `ws`

Exit:

- second device joins over LAN and appears reliably

### Phase 3: Transfer room shell

- deliver room layout and key organisms
- connect presence, activity, and transfer lists
- implement connection-state and empty/loading/error states

Exit:

- room is navigable on desktop and mobile with stable state rendering

### Phase 4: Transfer pipeline

- implement streamed uploads
- persist transfer metadata and temp file mapping
- implement download endpoint and lifecycle events
- implement cancel and failure handling

Exit:

- host/client can exchange real files with correct status progression

### Phase 5: Reliability and cleanup

- startup stale cleanup and orphan cleanup
- session-end cleanup
- reconnect rehydration correctness
- error envelope consistency and recovery UX

Exit:

- cleanup and reconnect behavior are predictable and test-covered

### Phase 6: Release hardening

- responsive and motion polish
- CLI diagnostics hardening (`doctor`)
- baseline cross-browser and mobile QA
- packaging and docs for npm release

Exit:

- v1 definition of done in `STEERING.md` is satisfied

## Critical Path Rule

Do not pull post-v1 features into active milestones until the phase above is complete and demoable.
