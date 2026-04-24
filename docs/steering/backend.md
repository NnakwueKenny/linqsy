# Backend Steering

## Stack And Framework

- Runtime: Node.js + TypeScript
- HTTP framework: Fastify
- Realtime transport: `ws`

This backend is explicitly not NestJS and not Express for v1.

## Architecture Layers

Use this server structure:

- `routes/`: Fastify route registration only
- `handlers/`: request parsing, validation handoff, response mapping
- `services/`: business logic and orchestration
- `stores/`: state/data access abstraction
- `realtime/`: WebSocket server, event emitters, connection registry
- `storage/`: upload/download file IO and cleanup
- `plugins/`: Fastify plugins and cross-cutting hooks
- `lib/`: pure utilities

Rules:

- Handlers stay thin
- Services contain business decisions
- Stores do not contain transport logic
- Realtime does not mutate core state directly without service layer

## SOLID Application

Apply SOLID principles to backend design in a practical way:

- Single Responsibility: each module should have one clear reason to change
- Open/Closed: add new behavior by composing new services, handlers, or adapters instead of bloating existing modules
- Liskov Substitution: interchangeable implementations must honor the same contract and failure expectations
- Interface Segregation: define small ports for storage, realtime publishing, config access, clocks, and ID generation when needed
- Dependency Inversion: services should depend on contracts/ports and receive infrastructure collaborators rather than reaching directly into concrete implementations

Examples for this codebase:

- session services should depend on a session store contract, not a specific storage implementation
- transfer services should depend on storage and event-publisher contracts, not raw filesystem or socket instances
- handlers should depend on service entrypoints, not storage or transport internals

Guardrail:

- do not force class-heavy architecture or artificial interface layers where a simple module boundary is sufficient

## HTTP API Conventions

- Validate request and response with shared Zod schemas
- Routes remain resource-oriented and explicit
- Keep session routes under `/api/session/:code/*`
- Keep transfer routes under `/api/transfers/:transferId/*`
- Return standard error envelope on failure

## WebSocket Conventions

- Event names use `domain:action`
- Client emits intent events
- Server emits authoritative state updates
- On reconnect, client must rehydrate from HTTP before trusting incremental events

## State Ownership

Server owns:

- session lifecycle
- device membership
- transfer lifecycle
- cleanup lifecycle

Client may present optimistic upload progress, but final state remains server-owned.

## Transfer Lifecycle

Transfer states are fixed for v1:

- `queued`
- `uploading`
- `ready`
- `downloading`
- `completed`
- `failed`
- `cancelled`

Transitions must be explicit and test-covered.

## Storage And Cleanup

Storage rules:

- keep temporary files in app-owned directory only
- use session-scoped directories
- keep metadata and physical file paths linked by transfer ID

Cleanup rules:

- remove stale session data on startup
- remove session data when host ends session
- clean orphaned temp files from crash scenarios

## Security Baseline (v1)

- random session code required
- LAN-only assumption for threat model
- no remote browsing of host filesystem
- no write operations outside app storage root
- host may terminate session at any time

## Performance And Reliability Rules

- stream uploads and downloads, do not fully buffer large files in memory
- track connection and transfer state transitions with structured logs
- guard against duplicate join and duplicate transfer events

## Frozen Decisions

- Fastify + `ws` is the v1 backend baseline
- Service layer owns business state transitions
- Cleanup is required core behavior
- Backend design should follow SOLID principles pragmatically

## Requires ADR

- Changing HTTP framework or realtime transport
- Changing transfer lifecycle state model
- Changing temp storage strategy outside app-owned directories
