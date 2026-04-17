# Architecture

This document describes the internal architecture of the Symbiotic Metadata Validator — a GitHub Action that validates metadata changes (entity directories containing `info.json` and `logo.png`) in Symbiotic ecosystem repositories.

The action is distributed as a single bundled file (`dist/index.cjs`) built with `tsup`, as required by GitHub Actions.

## Source Structure

```
src/
├── index.ts                    # GitHub Action entry point (sets up inputs, calls main)
├── main.ts                     # Orchestrator — runs the validation pipeline
└── scripts/
    ├── blockchain.ts           # Ethereum client via viem
    ├── github.ts               # PR commenting and inline review posting
    ├── messages.ts             # Error message templates
    ├── schemas/                # JSON schemas (bundled at compile time)
    │   ├── index.ts            # Schema registry — maps entity types to schemas
    │   ├── info.json           # Default schema
    │   ├── adapters.json       # Adapter-specific schema
    │   ├── curators.json       # Curator-specific schema
    │   └── points.json         # Points-specific schema
    ├── validate-fs.ts          # Directory structure validation
    ├── validate-entity.ts      # On-chain registry checks
    ├── validate-metadata.ts    # JSON schema validation with line-level errors
    ├── validate-logo.ts        # Image format and size validation
    ├── validate-collateral.ts  # Vault collateral token validation
    └── validate-rewards.ts     # Vault rewards contract validation
```

## Entity Model

Entities live in the repository as `{entityType}/{identifier}/` directories, each containing `info.json` and optionally `logo.png`. No other files are allowed.

**On-chain entities** (`vaults`, `operators`, `networks`, `tokens`, `adapters`) use Ethereum addresses as identifiers and require registry validation against on-chain contracts.

**Off-chain entities** (`points`, `curators`) use kebab-case names and skip registry checks.

A PR must modify exactly one entity.

## Validation Pipeline

`main.ts` orchestrates validation in two phases:

**Phase 1 — Sequential:**

1. **File system validation** (`validate-fs.ts`) — enforces directory structure, allowed file names, identifier format, and one-entity-per-PR constraint. If the entity is deleted, the pipeline exits early.

**Phase 2 — Parallel via `Promise.allSettled()`:**

2. **Entity registry** (`validate-entity.ts`) — calls `isEntity()` on the appropriate registry contract (skipped for off-chain types)
3. **Metadata schema** (`validate-metadata.ts`) — validates `info.json` against the type-specific JSON schema
4. **Logo** (`validate-logo.ts`) — checks 256×256 PNG, max 100KB
5. **Collateral** (`validate-collateral.ts`) — vaults only; verifies collateral token exists in the repo
6. **Rewards** (`validate-rewards.ts`) — vaults with rewards; validates via rewards-factory registry

`Promise.allSettled()` is used intentionally to collect all errors in a single run rather than failing on the first one.

## On-Chain Integration

Blockchain interactions use `viem` (chosen over ethers for tree-shaking and TypeScript ergonomics). The chain and RPC endpoint are configured via action inputs (`chain-id`, `rpc-url`). Registry contract addresses are also action inputs.

Key contract calls: `isEntity()` on all registries, `collateral()` on vaults, `VAULT()` on rewards factories.

## Error Reporting

All validation errors are reported as PR comments or inline review comments before throwing:

- **Structural and entity errors** — posted via `github.addComment()` using templates from `messages.ts`
- **Schema errors** — posted as inline review comments via `github.addReview()`, with exact line numbers from `json-source-map`

The consistent pattern is: post the comment, then throw.

## Bundling

JSON schemas are imported via `resolveJsonModule` and bundled at compile time — there is no runtime file I/O. `tsup` produces a single `dist/index.cjs` that is committed to the repository as GitHub Actions require self-contained JavaScript.

## Extension Patterns

**Adding a validation step:**

1. Create `src/scripts/validate-{name}.ts` exporting an async function that receives the entity
2. Guard by entity type if applicable
3. Add error templates to `messages.ts`
4. On failure: call `github.addComment()` then throw
5. Add the function to the `Promise.allSettled()` array in `main.ts`

**Adding an entity type:**

1. Add the type to `onChainTypes` or `offChainTypes` in `validate-fs.ts`
2. Optionally create a schema in `src/scripts/schemas/` and register it in `schemas/index.ts`
3. For on-chain types: add registry metadata to `entityMetaMap` in `validate-entity.ts` and add the registry address as an action input in `action.yml`
