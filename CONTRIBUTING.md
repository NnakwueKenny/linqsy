# Contributing to Linqsy

Thanks for contributing.

## Before you start

Read these source-of-truth docs first:

- [STEERING.md](./STEERING.md)
- [docs/steering/product.md](./docs/steering/product.md)
- [docs/steering/backend.md](./docs/steering/backend.md)
- [docs/steering/frontend.md](./docs/steering/frontend.md)
- [docs/steering/workflow.md](./docs/steering/workflow.md)
- [docs/steering/engineering.md](./docs/steering/engineering.md)

## Development setup

```bash
pnpm install
pnpm dev:cli
```

## Expected workflow

1. Start from a short feature brief for non-trivial work.
2. Keep contracts in `packages/shared` as the runtime boundary.
3. Prefer thin handlers, service-owned logic, and clear state ownership.
4. Run the relevant checks before considering work done.

## Checks

Use these as the normal baseline:

```bash
pnpm typecheck
pnpm --filter @linqsy/server test
pnpm build
```

For release-shape validation:

```bash
pnpm release:check
```

## Pull request guidance

- Keep changes scoped.
- Update docs when behavior or workflow changes.
- Call out tradeoffs and follow-up work clearly.
- Prefer simple, maintainable solutions over clever ones.

## Design expectations

- Keep the UI minimal and mature.
- Avoid dashboard clutter.
- Prefer one strong primary action over multiple competing panels.
- Mobile behavior is not optional; test it intentionally.

## Packaging expectations

- `apps/web` remains a private build target.
- `linqsy` is the intended end-user package.
- Internal publishable packages are:
  - `@linqsy/shared`
  - `@linqsy/config`
  - `@linqsy/server`
