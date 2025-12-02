# Symbiotic Metadata Validator - AI Coding Instructions

## Project Overview

This is a GitHub Action that validates metadata changes in Symbiotic ecosystem repositories (vaults, operators, networks, tokens, curators). It enforces strict file structure, performs JSON schema validation, checks logos, and validates on-chain registry state via RPC calls.

**Critical architectural constraint**: The action is distributed as a bundled single-file Node.js application (`dist/index.js`) using `@vercel/ncc`. **Always run `npm run bundle` after code changes** and commit `dist/` to publish.

## Entity Structure & Validation Pipeline

The codebase validates entities organized as: `{entityType}/{address}/{info.json,logo.png}`

- **Entity types**:
    - On-chain (require registry validation): `vaults`, `operators`, `networks`, `tokens`
    - Off-chain (no registry check): `points`, `curators`
- **Identifier format**:
    - On-chain: Ethereum address `/^0x[a-fA-F0-9]{40}$/`
    - Off-chain: Kebab-case name `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- **Allowed files**: Only `info.json` and `logo.png` per entity (enforced in `validate-fs.ts`)

### Validation Flow (src/main.ts)

All validations run in **parallel** via `Promise.allSettled()` to collect all errors before failing:

1. **File System** (`validate-fs.ts`): Validates directory structure, ensures **one entity per PR** (critical constraint)
2. **Entity Registry** (`validate-entity.ts`): Checks on-chain registry using `isEntity()` contract call (skipped for off-chain entities: `points`, `curators`)
3. **Metadata Schema** (`validate-metadata.ts`): Validates `info.json` against type-specific schemas (`schemas/{entityType}.json` or fallback to `schemas/info.json`)
4. **Logo** (`validate-logo.ts`): Enforces 256x256 PNG, max 100KB
5. **Collateral** (`validate-collateral.ts`): For vaults only, validates collateral token exists in repo
6. **Rewards** (`validate-rewards.ts`): For vaults with `rewards` in metadata, validates contracts via `rewards-factory` registry

**Early exit**: Validation skips remaining steps if entity is deleted (`entity.isDeleted === true`).

## On-Chain Integration

**Blockchain client** (`src/scripts/blockchain.ts`):

- Uses `viem` for Ethereum interactions (not ethers)
- Chain determined by `chain-id` input, RPC from `rpc-url` or viem's default public RPCs
- Registry contracts accessed via action inputs: `vault-registry`, `operator-registry`, `network-registry`

**Contract interaction patterns**:

```typescript
// Registry validation (all registries)
const isEntity = await createClient().readContract({
    address: registryAddress as Address,
    abi: isEntityAbi,
    functionName: "isEntity",
    args: [entityAddress],
});

// Vault-specific: get collateral token
const collateral = await createClient().readContract({
    address: vaultAddress as Address,
    abi: collateralAbi,
    functionName: "collateral",
});

// Rewards validation: check vault association
const vault = await createClient().readContract({
    address: rewardsAddress as Address,
    abi: vaultAbi,
    functionName: "VAULT",
});
```

## Key Conventions

### Error Handling & User Feedback

- **All validation errors must post GitHub PR comments** via `github.addComment()` before throwing
- Use pre-formatted messages from `messages.ts` (includes contribution guidelines link)
- Schema errors use `json-source-map` to report **exact line numbers** via `github.addReview()` with inline comments
- Error pattern:
    ```typescript
    await github.addComment(messages.errorType(params));
    throw new Error("Human-readable error for CI logs");
    ```

### Input Handling

- GitHub Action inputs accessed via `getInput()` from `@actions/core`, defined in `action.yml`
- **Local development**: Use `INPUT_*` env vars in `.env` file, **preserve hyphens**: `INPUT_CHAIN-ID`, `INPUT_RPC-URL`
- **Files input**: Space-separated, not comma-separated: `inputFiles.split(" ")`

### Local Development Workflow

The local action run is configured to use the `metadata/` directory as the source of metadata files for testing. This directory contains mock files to validate the action behavior locally.

1. **Add test metadata files** to the `metadata/` directory following the standard structure:

    ```
    metadata/
      points/
        symbiotic/
          info.json
          logo.png
      vaults/
        0x2c082c4a1b9939087906cee2fe0e6780a84331d6/
          info.json
          logo.png
    ```

2. **Configure environment** by copying `.env.template` and setting required inputs:

    ```bash
    cp .env.template .env
    ```

    Edit `.env` to set the required inputs. **Files must be space-separated**.

    **Off-chain entities** (points/curators):

    ```bash
    INPUT_FILES="points/symbiotic/info.json points/symbiotic/logo.png"
    ```

    **On-chain entities** (vaults/operators/networks/tokens):

    ```bash
    INPUT_FILES="vaults/0xabc.../info.json vaults/0xabc.../logo.png"
    INPUT_CHAIN-ID="560048"  # Hoodi testnet, or "1" for mainnet
    INPUT_VAULT-REGISTRY="0x407a039d94948484d356efb765b3c74382a050b4"
    INPUT_OPERATOR-REGISTRY="0x6f75a4fff97326a00e52662d82ea4fde86a2c548"
    INPUT_NETWORK-REGISTRY="0x7d03b7343bf8d5cec7c0c27ece084a20113d15c9"
    ```

3. **Run the action** using the configured environment:

    ```bash
    npm run local-action
    ```

4. **Review results** in the console output. When `LOCAL_ACTION_RUN=true`, PR comments and reviews are logged to the console instead of being posted to GitHub.

### Build & Release Process

1. **Bundle the action** into a single distributable file:

    ```bash
    npm run bundle
    ```

2. **Commit and push** the bundled distribution:

    ```bash
    git status dist/
    git add dist/
    git commit -m "Bundle changes"
    git push origin <your-branch>
    ```

3. **Create a PR** with the bundled changes to merge into `main` (protected branch)

**Watch mode**: Use `npm run package:watch` during development for automatic rebundling

## Common Patterns

### Adding New Validation Step

1. Create validator: `src/scripts/validate-{feature}.ts`
2. Export async function signature: `async (entity: Entity) => Promise<void>`
3. Check if validation applies (e.g., `if (entity.entityType !== "vaults") return;`)
4. On error: call `github.addComment()` with message from `messages.ts`, then throw
5. Add message template to `messages.ts` with contribution guidelines
6. Import and add to `Promise.allSettled()` array in `main.ts` (line ~20)

### Adding New Entity Type

1. Add type to `allowedTypes` in `validate-fs.ts` (either `onChainTypes` or `offChainTypes`)
2. Create schema: `src/scripts/schemas/{entityType}.json` (optional, falls back to `info.json`)
3. Add registry metadata to `entityMetaMap` in `validate-entity.ts` (if on-chain)
4. Add action input for registry contract in `action.yml` (if on-chain)

### Schema Validation with Line Numbers

```typescript
import { parse } from "json-source-map";

const { data: metadata, pointers: lineMap } = parse(metadataContent);
// Validate metadata...
const line = lineMap[error.instancePath]?.value?.line || 1;

await github.addReview({
    body: "Schema validation failed",
    comments: errors.map(({ message, line }) => ({
        line: line + 1, // Convert 0-indexed to 1-indexed
        path: metadataPath,
        body: message,
    })),
});
```

## Architecture Decisions

**Why Promise.allSettled?** Collect all validation errors in one pass instead of failing fast, providing better UX for contributors.

**Why single dist file?** GitHub Actions require self-contained JavaScript. `@vercel/ncc` bundles TypeScript + dependencies into `dist/index.js`.

**Why viem over ethers?** Modern, tree-shakeable, better TypeScript support, built-in chain configs.

**Why json-source-map?** Enables precise error reporting at exact JSON line numbers for PR review comments.

**Why upstream-checkout-path?** Allows validating cross-references (e.g., vault collateral tokens) against both PR changes and existing repo state.

## Dependencies Reference

- **@actions/core, @actions/github**: GitHub Actions SDK for inputs, outputs, PR comments
- **viem**: Ethereum client with chain configs from `viem/chains`
- **ajv, ajv-formats**: JSON Schema validation with format validators (uri, date, etc.)
- **image-js**: Image processing for logo validation (size, dimensions, format)
- **json-source-map**: Maps JSON paths to source locations for error reporting
- **@vercel/ncc**: Bundles TypeScript + dependencies into single `dist/index.js`
- **@github/local-action**: Local GitHub Action runner for development
