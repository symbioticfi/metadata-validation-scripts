## Symbiotic Metadata Validator

A GitHub Action that validates metadata changes for Symbiotic ecosystem entities (vaults, operators, networks, tokens, adapters, merkle-adapters, curators, points). Enforces file structure, JSON schema compliance, logo requirements, and on-chain registry state validation via RPC calls.

The action is distributed as a bundled single-file Node.js application (`dist/index.cjs`) using `tsup`.

### Entities Metadata Structure

Entities are organized as: `{entityType}/{identifier}/{info.json,logo.png}`

**Entity types:**

- **Address-based**: `vaults`, `operators`, `networks`, `tokens`, `adapters`, `merkle-adapters`. All except `tokens` require registry validation.
- **Off-chain** (no registry check): `points`, `curators`

### Merkle Adapter Metadata

Use `merkle-adapters/<adapter-address>/info.json`. The identifier is the vault adapter address, whose `account()` holds strategy positions. The adapter must be registered in the configured `adapter-registry`. Each folder contains only `info.json`; logos are not allowed.

The JSON object contains a `protocols` array. Each entry has a lowercase portfolio protocol or product name and an `ids` array of vault, pool, market, or common-token identifiers. Use underscores between words and an empty `ids` array when no specific targets are needed:

```json
{
    "protocols": [
        { "protocol": "aa_falconxusdc", "ids": [] },
        { "protocol": "mglobal", "ids": [] },
        {
            "protocol": "morpho_vaultv2",
            "ids": [
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222"
            ]
        },
        {
            "protocol": "morpho_blue",
            "ids": ["0x1111111111111111111111111111111111111111111111111111111111111111"]
        },
        { "protocol": "aave_v3", "ids": ["0x3333333333333333333333333333333333333333"] },
        {
            "protocol": "euler",
            "ids": ["0x4444444444444444444444444444444444444444"],
            "subaccounts": [0, 1]
        },
        {
            "protocol": "tokens",
            "ids": [
                "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
            ]
        }
    ]
}
```

The vault/pool/market targets above are illustrative. Allowed portfolio names and ID requirements are defined in [`src/scripts/config/merkle-protocols.json`](src/scripts/config/merkle-protocols.json), which is bundled into the validator. Entries with `requiresIds: true` need at least one identifier: `idType: "address"` accepts 20-byte EVM addresses; `idType: "bytes32"` accepts 32-byte market IDs. Name-only entries require `ids: []`. Unknown names, repeated protocol declarations, duplicate IDs, and identifiers of the wrong type are rejected. Morpho Blue and Vault V2 each accept at most 16 IDs. Add new integrations to the allowlist before using their names in metadata.

Euler additionally requires a nonempty `subaccounts` array of unique integers from 0 through 255. Offset 0 means the adapter's exact onchain `account()`; offset `n` means `address(uint160(account()) ^ uint160(n))`, using XOR rather than replacing the last byte. Euler EVault IDs must be nonzero and unique ignoring hex case, and the number of EVault IDs multiplied by the number of offsets must be at most 48. Every pair covers both supply and debt. Other protocols reject `subaccounts`. Keep every market and subaccount with outstanding positions when strategy permissions change. The [Euler scope and preparation guide](docs/merkle-protocol-allowlist.md#euler-scope-and-offline-nav-preparation) describes the pending NAV consumer and the complete collector limit.

For `tokens`, list selected common-token addresses in `ids`, using a nonempty subset of cbBTC, DAI, LBTC, PAXG, PYUSD, SolvBTC, tBTC, tETH, uniBTC, USDC, USDe, USDS, USDT, WBTC, weETH, WETH, and wstETH. The validator checks membership in [`src/scripts/config/merkle-tokens.json`](src/scripts/config/merkle-tokens.json) for the action's `chain-id`, accepting either lowercase or mixed-case hex addresses. The initial token allowlist covers Ethereum mainnet (`1`); other chains need an explicit allowlist. Token symbols and arbitrary contracts are rejected.

The [protocol inventory](docs/merkle-protocol-allowlist.md) records 56 metadata names covering the reviewed NAV integrations and all 54 active RWA tokens through 48 product entries. Ember uses `{"protocol":"ember","ids":[]}` for PPLUS; 3F uses `{"protocol":"three_f","ids":[]}` and discovers newly created requests itself. Merkl rewards and the six Pareto receipts remain automatic accounting within the declared portfolio. The inventory records the pinned source revision and excluded products. `{ "protocols": [] }` has no portfolio declarations and excludes the configured Euler and Morpho scope in pending NAV PR 22. That consumer uses metadata only for Euler and Morpho market lists; other declarations are validated but do not alter its fixed Aave, wallet or RWA catalogue admission. Both `protocol` and `ids` are required in each entry; Euler alone also requires `subaccounts`, and other fields are rejected. Metadata describes retained valuation scope and does not grant Merkle permissions, attest quantities, or prove universal inventory completeness. The existing one-entity-per-PR rule applies.

The full-info workflow includes these entries under `"merkle-adapters"`, using the existing `{ "info": ... }` wrapper without a logo.

### Architecture

**Entry point**: `src/main.ts` orchestrates all validation steps in parallel

**Key modules**:

- [`src/scripts/validate-fs.ts`](src/scripts/validate-fs.ts) - File system structure validation
- [`src/scripts/validate-entity.ts`](src/scripts/validate-entity.ts) - On-chain registry checks
- [`src/scripts/validate-metadata.ts`](src/scripts/validate-metadata.ts) - JSON schema validation with line-number error reporting
- [`src/scripts/validate-logo.ts`](src/scripts/validate-logo.ts) - Image validation (256x256 PNG, <100KB)
- [`src/scripts/validate-collateral.ts`](src/scripts/validate-collateral.ts) - Vault collateral token validation
- [`src/scripts/validate-rewards.ts`](src/scripts/validate-rewards.ts) - Vault rewards contract validation
- [`src/scripts/blockchain.ts`](src/scripts/blockchain.ts) - Ethereum client (viem) for RPC calls
- [`src/scripts/github.ts`](src/scripts/github.ts) - PR comment and review posting
- [`src/scripts/messages.ts`](src/scripts/messages.ts) - Error message templates

**Technologies**: TypeScript, tsup (bundler), viem (Ethereum client), ajv (JSON schema), image-js (logo validation), json-source-map (error line numbers)

### Validation Pipeline

All validations run in parallel via `Promise.allSettled()` to collect all errors before failing:

1. **File System** - Validates directory structure, ensures one entity per PR
2. **Entity Registry** - Checks on-chain registry using `isEntity()` contract call (skipped for off-chain entities)
3. **Metadata Schema** - Validates `info.json` against type-specific schemas
4. **Logo** - Enforces 256x256 PNG, max 100KB
5. **Collateral** - For vaults only, validates collateral token exists in repo
6. **Rewards** - For vaults with rewards, validates contracts via rewards-factory registry

Validation skips remaining steps if entity is deleted.

### Inputs

- `files` (required): Comma/space-separated list of changed files to validate.
- `issue` (required): Issue/PR number to comment on (e.g., `${{ github.event.pull_request.number }}`).
- `token` (required): `GITHUB_TOKEN` for commenting.
- `vault-registry` (required): Vaults registry contract address.
- `operator-registry` (required): Operators registry contract address.
- `network-registry` (required): Networks registry contract address.
- `adapter-registry` (required): Adapter registry contract address for `adapters` and `merkle-adapters`.
- `chain-id` (required): Chain ID for on-chain validation.
- `rpc-url` (optional): RPC URL for on-chain validation.
- `upstream-checkout-path` (optional): Path to upstream repo checkout.
- `rewards-factory` (optional): Rewards factory contract address.

### Outputs

- `error`: Validation error message (empty if successful).

### Usage

Integrate into your workflow to validate metadata changes on pull requests:

```yaml
name: Validate metadata
on:
    pull_request:
        types: [opened, synchronize, reopened]

jobs:
    validate:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: write
        steps:
            - uses: actions/checkout@v4
                with:
                    fetch-depth: 0

            # Collect changed files (example using tj-actions/changed-files)
            - uses: tj-actions/changed-files@v45
                id: changes

            - name: Run validator
                uses: symbioticfi/metadata-validation-scripts@main
                with:
                    files: ${{ steps.changes.outputs.all_changed_files }}
                    issue: ${{ github.event.pull_request.number }}
                    token: ${{ secrets.GITHUB_TOKEN }}
                    chain-id: 1
                    rpc-url: ${{ secrets.RPC_URL }}
                    vault-registry: "0x..."
                    operator-registry: "0x..."
                    network-registry: "0x..."
                    rewards-factory: "0x..."
```

### Local Development

The `metadata/` directory contains test files for local validation.

1. **Add test metadata files** to `metadata/` following the standard structure:

    ```
    metadata/
      points/symbiotic/info.json
      vaults/0xabc.../info.json
    ```

2. **Configure environment**:

    ```bash
    cp .env.template .env
    ```

    Edit `.env` with required inputs (**files must be space-separated**):

    For off-chain entities:

    ```bash
    INPUT_FILES="points/symbiotic/info.json points/symbiotic/logo.png"
    ```

    For on-chain entities:

    ```bash
    INPUT_FILES="vaults/0xabc.../info.json vaults/0xabc.../logo.png"
    INPUT_CHAIN-ID="560048"  # Hoodi testnet
    INPUT_VAULT-REGISTRY="0x407a039d94948484d356efb765b3c74382a050b4"
    INPUT_OPERATOR-REGISTRY="0x6f75a4fff97326a00e52662d82ea4fde86a2c548"
    INPUT_NETWORK-REGISTRY="0x7d03b7343bf8d5cec7c0c27ece084a20113d15c9"
    ```

3. **Run the action**:
    ```bash
    npm run local-action
    ```

When `LOCAL_ACTION_RUN=true`, PR comments are logged to console instead of posting to GitHub.

**Watch mode**: Use `npm run package:watch` for automatic rebundling during development.

### Build and Release

1. **Bundle the action**:

    ```bash
    npm run bundle
    ```

2. **Commit and push** the bundled distribution:

    ```bash
    git add dist/
    git commit -m "Bundle changes"
    git push origin <your-branch>
    ```

3. **Create a PR** to merge into `main` (protected branch)

**Requirements**: Node.js 24+ (the action runtime is Node.js 24).

Run `npm ci` to install the locked dependencies. The project `.npmrc` directs the shared `@symbiotic` lint and formatting packages to their registry; public packages use npm's registry.

Use `npm run lint`, `npm run typecheck`, and `npm test` before committing. Type checking uses TypeScript 7 through the `@typescript/native` alias. The `typescript` dependency aliases Microsoft's TypeScript 6 compatibility package so ESLint and build tools can still use the compiler API. The `esbuild` and `undici` overrides keep the build and local runner on patched releases.
