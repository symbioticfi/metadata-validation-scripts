## Symbiotic Metadata Validator (GitHub Action)

Validates metadata changes in pull requests for Symbiotic metadata repositories. It checks file structure, JSON schemas, logos, rewards, collateral, and performs optional on-chain validations.

### What it validates

- File structure and presence of required assets (see [src/scripts/validate-fs.ts](src/scripts/validate-fs.ts))
- Metadata schema ([src/scripts/validate-metadata.ts](src/scripts/validate-metadata.ts), [src/scripts/schemas/info.json](src/scripts/schemas/info.json))
- Entity definitions ([src/scripts/validate-entity.ts](src/scripts/validate-entity.ts))
- Logos and image constraints ([src/scripts/validate-logo.ts](src/scripts/validate-logo.ts))
- Collateral config ([src/scripts/validate-collateral.ts](src/scripts/validate-collateral.ts))
- Rewards config ([src/scripts/validate-rewards.ts](src/scripts/validate-rewards.ts))
- On-chain registry checks via RPC ([src/scripts/blockchain.ts](src/scripts/blockchain.ts))
- GitHub issue/PR comments ([src/scripts/github.ts](src/scripts/github.ts))

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

### Usage (workflow example)

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

### Development and release

- Node.js 20+ is required.
- Build bundled action: `npm run bundle`
- Commit the generated `dist/` and push to `main` to publish the new version.

### Local development

- Copy [`.env.template`](.env.template) to `.env` and set required inputs to match your test case.
  - Use `INPUT_<name>` variables exactly as in [action.yml](action.yml) (keep hyphens, e.g., `INPUT_CHAIN-ID`).
- Run locally: `npm run local-action`
