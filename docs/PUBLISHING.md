# Publishing Linqsy

This document covers two separate release surfaces:

- GitHub repository release readiness
- npm package publishing readiness

## Current release shape

Intended public packages:

- `linqsy`
- `@linqsy/shared`
- `@linqsy/config`
- `@linqsy/server`

Private workspace packages:

- `@linqsy/web`
- `@linqsy/ui`

The CLI package is the user-facing install target. The internal packages support the runtime structure used by the CLI.

## Before any public release

Complete these first:

1. Add a real `LICENSE` file.
2. Create the GitHub repository.
3. Push the repo and verify the default branch.
4. Run `pnpm release:check`.
5. Verify the host/client transfer loop manually on two devices.
6. Confirm npm publishing access and 2FA or token readiness.

## Local release check

```bash
pnpm release:check
```

That script:
- clears generated output
- runs typechecking
- runs server tests
- rebuilds the workspace

## GitHub preparation

If the workspace is not already a Git repository, start with:

```bash
git init -b main
git add .
git commit -m "Prepare Linqsy for open-source release"
```

Then connect to a remote and push:

```bash
git remote add origin <your-github-repo-url>
git push origin main
```

Official GitHub docs:
- https://docs.github.com/en/get-started/git-basics/about-remote-repositories
- https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository

## npm publishing order

Because the CLI package depends on internal published packages, publish in this order:

1. `@linqsy/shared`
2. `@linqsy/config`
3. `@linqsy/server`
4. `linqsy`

## Package-by-package publishing

Confirm npm access first:

```bash
npm whoami
```

From each scoped package directory:

```bash
pnpm publish --access public
```

For the unscoped CLI package:

```bash
pnpm publish
```

If you prefer to publish from the workspace root, use filtered commands in the same order:

```bash
pnpm --filter @linqsy/shared publish --access public
pnpm --filter @linqsy/config publish --access public
pnpm --filter @linqsy/server publish --access public
pnpm --filter linqsy publish
```

## Packaging dry run

Before publishing, create local tarballs and inspect them:

```bash
pnpm --filter @linqsy/shared pack --pack-destination ../../.release
pnpm --filter @linqsy/config pack --pack-destination ../../.release
pnpm --filter @linqsy/server pack --pack-destination ../../.release
pnpm --filter linqsy pack --pack-destination ../../.release
```

## Important publishing notes

- `@linqsy/server` now packages the built web client inside its build output.
- Run a clean build before publishing.
- Verify versions are aligned before every release.
- npm publishing for public packages requires either account 2FA or a publish-capable token.
- Do not publish until the license question is settled.

## Recommended first public version

Suggested first version:

- `0.1.0`

That communicates an early but usable public release better than `0.0.0`.

## Official npm docs

- https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
- https://docs.npmjs.com/cli/v11/commands/npm-publish
