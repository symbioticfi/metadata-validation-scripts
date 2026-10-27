# Symbiotic Metadata Validator - AI Coding Instructions

## Project Overview

This is a GitHub Action that validates metadata changes in Symbiotic ecosystem repositories (vaults, operators, networks, tokens, curators, adapters). It enforces strict file structure, performs JSON schema validation, checks logos, and validates on-chain registry state via RPC calls.

**Critical architectural constraint**: The action is distributed as a bundled single-file Node.js application (`dist/index.cjs`) using `tsup`.

## Entity Structure & Validation Pipeline

The codebase validates entities organized as: `{entityType}/{address}/{info.json,logo.png}`

- **Entity types**:
    - On-chain (require registry validation): `vaults`, `operators`, `networks`, `tokens`, `adapters`, `merkle-adapters`
    - Off-chain (no registry check): `points`, `curators`
- **Identifier format**:
    - On-chain: Ethereum address `/^0x[a-fA-F0-9]{40}$/`
    - Off-chain: Kebab-case name `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- **Allowed files**: Only `info.json` and `logo.png` per entity (enforced in `validate-fs.ts`). `merkle-adapters` folders contain only a regular `info.json` file; logos and other files are rejected.
- **Merkle adapter metadata**: `merkle-adapters/{adapterAddress}/info.json` requires a nonempty `chains` array of strict `{chainId, protocols}` scopes. Chain IDs are positive safe integers and unique; each protocols array is required and may be empty. The old top-level protocols shape is rejected. Each protocol entry is a `{protocol, ids}` object. Protocol/ID uniqueness is scoped to each chain. Allowed portfolio names, `requiresIds`, and `idType` come from `src/scripts/config/merkle-protocols.json`, imported at compile time. Entries requiring IDs must contain at least one identifier of the configured type (20-byte EVM address, bytes32 market ID or allowed deployment name); name-only entries require an empty array. The `tokens` entry additionally validates IDs against `src/scripts/config/merkle-tokens.json` for the enclosing scope's `chainId`, accepting hex case variations; initially only Ethereum mainnet is allowlisted. 3F requires empty IDs because its factory binding is fixed. Ember requires a nonempty address list containing only the 27 reviewed Ethereum vaults in `merkle-protocols.json`, with hex-case-insensitive membership/uniqueness and no subaccounts. Omission excludes the Ember protocol collector and ledger/queue discovery; generic idle balances still apply when PPLUS is the denomination. Other Ember vaults are unsupported until reviewed and added to the address list, since Ember publishes no vault factory. Lagoon uses 1–16 unique nonzero factory-registered vault addresses in `lagoon.ids`, ignoring hex case, without subaccounts or asset overrides. Consumers derive the underlying asset and decimals on-chain and validate the Lagoon own-share profile; no static vault or USDC restriction applies. Every scope is schema validated. The configured action chain must be present, and only that scope receives target RPC validation; other scopes are never queried through this chain's RPC. Euler, Morpho V2, Morpho Blue and Lagoon target identities in the active mainnet scope are verified against their canonical factories or market storage. Inactive scopes receive no target membership attestation. The generic `erc7540` protocol name is rejected. All active RWA products, including TBILL, wYLDS and USN, have entries; Pareto receipts remain part of their tranche accounting. Merkl rewards use an explicit `merkl` entry with empty IDs. Execution plumbing has no separate portfolio entry. Declared markets include required asset-pricing dependencies without separate product entries; standalone wallet balances and issuer requests remain explicitly selected. Keep the allowlists aligned with the pinned NAV runtime rather than planned or deferred readers. Registration uses the existing `adapter-registry` input. Research sources and coverage limits are recorded in `docs/merkle-protocol-allowlist.md`.

### Validation Flow (src/main.ts)

All validations run in **parallel** via `Promise.allSettled()` to collect all errors before failing:

1. **File System** (`validate-fs.ts`): Validates directory structure, ensures **one entity per PR** (critical constraint)
2. **Entity Registry** (`validate-entity.ts`): Checks on-chain registry using `isEntity()` contract call (skipped for off-chain entities: `points`, `curators`)
3. **Metadata Schema** (`validate-metadata.ts`): Validates `info.json` against type-specific schemas imported from `schemas/index.ts` (bundled at compile time)
4. **Logo** (`validate-logo.ts`): Enforces 256x256 PNG, max 100KB
5. **Collateral** (`validate-collateral.ts`): For vaults only, validates collateral token exists in repo
6. **Rewards** (`validate-rewards.ts`): For vaults with `rewards` in metadata, validates contracts via `rewards-factory` registry

**Early exit**: Validation skips remaining steps if entity is deleted (`entity.isDeleted === true`).

## On-Chain Integration

**Blockchain client** (`src/scripts/blockchain.ts`):

- Uses `viem` for Ethereum interactions (not ethers)
- Chain determined by `chain-id` input, RPC from `rpc-url` or viem's default public RPCs
- Registry contracts accessed via action inputs: `vault-registry`, `operator-registry`, `network-registry`, `adapter-registry`

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
    INPUT_ADAPTER-REGISTRY="0xF33339BD72A512777E0FbF5817003E47A4a9ab66"
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
3. Import schema in `src/scripts/schemas/index.ts` and add to `schemaMap` if it differs from default
4. Add registry metadata to `entityMetaMap` in `validate-entity.ts` (if on-chain)
5. Add action input for registry contract in `action.yml` (if on-chain)

### Schema Validation with Line Numbers

Schemas are bundled at compile time via `src/scripts/schemas/index.ts`:

```typescript
import { getSchema } from "./schemas";
import { parse } from "json-source-map";

const schema = getSchema(entityType); // Returns bundled JSON schema
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

**Why single dist file?** GitHub Actions require self-contained JavaScript. `tsup` bundles TypeScript + dependencies into `dist/index.cjs`.

**Why viem over ethers?** Modern, tree-shakeable, better TypeScript support, built-in chain configs.

**Why json-source-map?** Enables precise error reporting at exact JSON line numbers for PR review comments.

**Why upstream-checkout-path?** Allows validating cross-references (e.g., vault collateral tokens) against both PR changes and existing repo state.

**Why bundle schemas?** JSON schemas are imported and bundled at compile time via TypeScript's `resolveJsonModule`, eliminating runtime file I/O and ensuring the `dist/index.cjs` bundle is completely self-contained.

## Dependencies Reference

- **@actions/core, @actions/github**: GitHub Actions SDK for inputs, outputs, PR comments
- **viem**: Ethereum client with chain configs from `viem/chains`
- **ajv, ajv-formats**: JSON Schema validation with format validators (uri, date, etc.)
- **image-js**: Image processing for logo validation (size, dimensions, format)
- **json-source-map**: Maps JSON paths to source locations for error reporting
- **tsup**: Bundles TypeScript + dependencies into single `dist/index.cjs`
- **@github/local-action**: Local GitHub Action runner for development
