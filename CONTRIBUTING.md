# Contributing Guide

Thank you for contributing! This guide covers the development workflow.

## Prerequisites

- **Node.js** 24+ (see `.nvmrc`)
- **pnpm** as the package manager

```bash
nvm use
pnpm install
```

## Development Workflow

### 1. Create a Branch

Start by creating a new branch from `main` using the task ID pattern:

```bash
git checkout main && git pull
git checkout -b TASK-ID-branch-name
```

Example:

```bash
git checkout -b DEV-123-add-new-validation
```

### 2. Make Your Changes

Linting and formatting (ESLint + Prettier) run automatically on commit via lint-staged and husky pre-commit hooks for `*.{js,ts,json,md}` files.

You can also run the linter manually:

```bash
pnpm run lint
```

### 3. Test Locally

There is no automated test suite. Test changes by running the action locally.

**Add test metadata files** to `metadata/` following the entity structure:

```
metadata/
  points/symbiotic/info.json
  points/symbiotic/logo.png
  vaults/0xabc.../info.json
  vaults/0xabc.../logo.png
```

**Configure environment:**

```bash
cp .env.template .env
```

Edit `.env` with the required inputs. Files must be **space-separated**.

For off-chain entities (points/curators):

```
INPUT_FILES="points/symbiotic/info.json points/symbiotic/logo.png"
```

For on-chain entities (vaults/operators/networks/tokens/adapters):

```
INPUT_FILES="vaults/0xabc.../info.json vaults/0xabc.../logo.png"
INPUT_CHAIN-ID="560048"
INPUT_VAULT-REGISTRY="0x407a039d94948484d356efb765b3c74382a050b4"
INPUT_OPERATOR-REGISTRY="0x6f75a4fff97326a00e52662d82ea4fde86a2c548"
INPUT_NETWORK-REGISTRY="0x7d03b7343bf8d5cec7c0c27ece084a20113d15c9"
INPUT_ADAPTER-REGISTRY="0xF33339BD72A512777E0FbF5817003E47A4a9ab66"
```

> **Note:** Preserve hyphens in `INPUT_*` variable names (e.g., `INPUT_CHAIN-ID`, not `INPUT_CHAIN_ID`). When `LOCAL_ACTION_RUN=true`, PR comments/reviews are logged to the console instead of posting to GitHub.

**Run the action:**

```bash
pnpm run local-action
```

Use **watch mode** for auto-rebundling during development:

```bash
pnpm run package:watch
```

### 4. Bundle for Distribution

The `dist/` directory **must be committed** — GitHub Actions runs the bundled file directly.

```bash
pnpm run bundle
git add dist/
```

### 5. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/) with the task ID as the scope:

```
<type>(<task-id>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`

Examples:

```bash
git commit -m "feat(DEV-123): Add adapter registry validation"
git commit -m "fix(DEV-456): Correct points metadata schema"
```

### 6. Open a Pull Request

Push your branch and open a PR targeting `main` with the task ID in the title:

```
DEV-123 Add adapter registry validation
```

## Pull Request Checklist

- [ ] Lint passes (`pnpm run lint`)
- [ ] Tested locally with `pnpm run local-action`
- [ ] Bundled distribution is up to date (`pnpm run bundle`, `dist/` committed)
- [ ] Commit messages follow Conventional Commits with task ID scope
- [ ] Documentation updated (if applicable)
