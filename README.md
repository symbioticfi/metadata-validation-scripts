# Symbiotic Metadata Validator

A GitHub Action that validates metadata changes in [Symbiotic](https://symbiotic.fi/) ecosystem repositories.

## Tech Stack

- [TypeScript 5](https://www.typescriptlang.org/) — Type safety
- [tsup](https://tsup.egoist.dev/) — Bundler (produces single `dist/index.cjs`)
- [viem](https://viem.sh/) — Ethereum client for on-chain validation
- [ajv](https://ajv.js.org/) — JSON Schema validation
- [image-js](https://image-js.github.io/image-js/) — Logo validation
- [json-source-map](https://github.com/nicola-nicola/json-source-map) — Error line number reporting

## Prerequisites

- **Node.js** — see `.nvmrc` for the required version
- **pnpm** — package manager

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.template .env

# Run the action locally
pnpm run local-action
```

## Available Scripts

- `pnpm run bundle` — Bundle the action for distribution
- `pnpm run lint` — Run ESLint
- `pnpm run local-action` — Run the action locally
- `pnpm run package:watch` — Watch mode for auto-rebundling

## Usage

Add the action to your workflow to validate metadata changes on pull requests:

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
                  adapter-registry: "0x..."
                  rewards-factory: "0x..."
```

### Inputs

| Name                     | Required | Description                         |
| ------------------------ | -------- | ----------------------------------- |
| `files`                  | Yes      | List of files to validate           |
| `issue`                  | Yes      | PR number to comment on             |
| `token`                  | Yes      | `GITHUB_TOKEN` for commenting       |
| `vault-registry`         | Yes      | Vaults registry contract address    |
| `operator-registry`      | Yes      | Operators registry contract address |
| `network-registry`       | Yes      | Networks registry contract address  |
| `adapter-registry`       | Yes      | Adapter registry contract address   |
| `chain-id`               | Yes      | Blockchain chain ID                 |
| `rpc-url`                | No       | RPC URL for on-chain validation     |
| `upstream-checkout-path` | No       | Path to upstream repo checkout      |
| `rewards-factory`        | No       | Rewards factory contract address    |

### Outputs

| Name    | Description                                    |
| ------- | ---------------------------------------------- |
| `error` | Validation error message (empty if successful) |

## Documentation

- [Architecture](./ARCHITECTURE.md) — High-level architecture and key concepts
- [Contributing](./CONTRIBUTING.md) — Development workflow and standards
