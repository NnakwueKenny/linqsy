# Atomic Design Steering

## Purpose

Atomic Design is required for reusable UI architecture and consistent scaling.

## Layers

- Atoms: smallest reusable primitives (button, badge, icon button, input shell, progress primitive)
- Molecules: combinations of atoms with one small job (join link field, device chip row, transfer meta row)
- Organisms: feature sections with meaningful composition (QR card, transfer list, presence panel, activity feed)
- Templates: page scaffolds without fixed data content
- Pages: fully bound route-level implementations

## Ownership Rules

- Atoms and molecules live in `packages/ui`
- Organisms may live in `packages/ui` if cross-page reusable, otherwise in feature module
- Templates and pages live in `apps/web`

## Behavior Rules By Layer

- Atoms: no product business logic
- Molecules: minimal UI behavior only
- Organisms: can orchestrate feature UI state but not own canonical session state
- Templates: structural composition only
- Pages: data wiring, route params, and side-effect orchestration

## Promotion Rules

Promote a component upward when:

- it is reused by at least two independent features
- it has stable props and token usage
- extracting it reduces duplication without leaking feature-specific logic

Do not promote prematurely.

## Prop And API Rules

- Prefer explicit props over config blobs
- Use composition slots for flexible content
- Keep variant count controlled
- Avoid boolean-prop explosion for styling permutations

## Naming And File Rules

- atoms: `atom-<name>.tsx` or `<name>.tsx` within `atoms/`
- molecules: `<domain>-<name>.tsx`
- organisms: `<feature>-<section>.tsx`
- templates: `<context>-template.tsx`
- pages: `<route>-page.tsx`

## Testing Rules

- Atoms: visual and interaction unit tests
- Molecules: behavior and prop contract tests
- Organisms/pages: integration-level behavior tests

## Frozen Decisions

- Atomic Design is mandatory for reusable UI composition
- Business logic does not belong in atoms

## Requires ADR

- Replacing Atomic Design with a different component architecture model
