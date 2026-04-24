# Engineering Steering

## Monorepo Shape

Expected workspace layout:

- `apps/cli`
- `apps/server`
- `apps/web`
- `packages/shared`
- `packages/ui`
- `packages/config`

## Ownership Rules

- CLI owns startup orchestration, not business state
- Server owns session/transfer authority
- Web owns presentation and local interaction state
- Shared owns runtime schemas and contracts
- UI package owns reusable component primitives and composition blocks

## Coding Conventions

- TypeScript strict mode required
- Prefer explicit named exports
- No `any` unless documented with reason
- Keep functions small and behavior-focused
- Avoid hidden side effects in utility functions
- Apply SOLID principles to server-side module design pragmatically, not ceremonially

Naming rules:

- files: `kebab-case.ts` or `kebab-case.tsx`
- types/interfaces/classes: `PascalCase`
- functions/variables: `camelCase`
- constants and env keys: `UPPER_SNAKE_CASE`
- event names: `domain:action` (for example `transfer:progress`)

## Contract-First Rule

Implementation order:

1. define schema/contracts in `packages/shared`
2. implement server behavior against shared schemas
3. implement client behavior using the same schemas

Never duplicate payload shapes independently in server and web code.

## Configuration Rules

- All configuration keys must have a schema
- Precedence order:
1. CLI flags
2. env vars
3. config file
4. defaults
- config resolution happens in one place, consumed by apps

## Error And Logging Rules

Use a standard error envelope:

- `code`
- `message`
- optional `details`
- optional `requestId`

Logging rules:

- structured logs only
- no sensitive data in logs
- include stable identifiers (`sessionId`, `transferId`, `deviceId`) when available

## Dependency Policy

- Add packages only when they remove meaningful complexity
- Prefer mature, maintained dependencies
- Architecture-impacting dependencies require ADR
- Do not add overlapping libraries with the same responsibility

## Testing Policy

Minimum requirements:

- unit tests for core utilities, schemas, and lifecycle transitions
- integration tests for startup, join, upload, download, and cleanup
- manual QA checklist for mobile join and transfer behavior

## Documentation Policy

Every meaningful feature change must update:

- feature brief
- impacted steering docs when behavior rules change
- QA checklist when test coverage changes

## Server Design Rule

The backend should follow SOLID principles as a default design constraint:

- Single Responsibility: keep handlers, services, stores, realtime modules, and storage modules narrowly focused
- Open/Closed: extend behavior through composition, new modules, and focused interfaces instead of expanding god objects
- Liskov Substitution: abstractions must preserve behavior expectations across implementations
- Interface Segregation: prefer small, purpose-built contracts over broad multi-purpose interfaces
- Dependency Inversion: core services depend on ports/contracts, not concrete infrastructure details, where that separation improves testability and swapability

Practical guardrail:

- do not introduce abstractions, classes, or interfaces unless they clarify ownership, improve testability, or reduce coupling in a real way

## Frozen Decisions

- Contract-first development is mandatory
- Shared schemas in `packages/shared` are the runtime boundary
- Standard error envelope is required across server APIs
- Pragmatic SOLID is required for server-side module design

## Requires ADR

- Changing monorepo ownership boundaries
- Relaxing strict typing or schema-first validation strategy
