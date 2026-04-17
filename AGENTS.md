# AI Agent Guidelines

## Required Reading

Read the project documentation before making changes:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Project structure, validation pipeline, design decisions, extension patterns
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development workflow, local testing, build & release

## Key Rules

- **Package manager**: npm only (NOT pnpm or yarn)
- **Ethereum library**: `viem` only (NOT ethers)
- **Error pattern**: Always call `github.addComment()` before throwing errors
- **Schemas**: Bundled at compile time via `resolveJsonModule` — never loaded at runtime
- **All dependencies** must be bundleable into a single `dist/index.cjs` file

## Validation

MANDATORY before completing any task — run in order:

1. **Lint**: `npm run lint` (must pass)
2. **Bundle**: `npm run bundle` (must succeed)
3. **Local Testing**: Test both passing and failing scenarios with `npm run local-action`
