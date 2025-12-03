## Symbiotic Metadata Validator

A GitHub Action that validates metadata changes for Symbiotic ecosystem entities (vaults, operators, networks, tokens, curators, points). Enforces file structure, JSON schema compliance, logo requirements, and on-chain registry state validation via RPC calls.

The action is distributed as a bundled single-file Node.js application (`dist/index.js`) using `tsup`.

### Entities Metadata Structure

Entities are organized as: `{entityType}/{identifier}/{info.json,logo.png}`

**Entity types:**

- **On-chain** (require registry validation): `vaults`, `operators`, `networks`, `tokens`
- **Off-chain** (no registry check): `points`, `curators`

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

**Requirements**: Node.js 22+
