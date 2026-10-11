# Merkle portfolio allowlist

[`merkle-protocols.json`](../src/scripts/config/merkle-protocols.json) contains 59 portfolio metadata names: nine protocol integrations, the special `tokens` entry, and 49 named products. Each metadata entry is `{protocol, ids}`. `requiresIds` determines whether `ids` must contain at least one identifier or must be empty; `idType` selects `address` (20 bytes), `bytes32` (32 bytes), or `none`.

The validator imports both this config and [`merkle-tokens.json`](../src/scripts/config/merkle-tokens.json) into its bundle. The inventory covers current and planned portfolio integrations found in contract helpers, Curator branches, redemption contracts, and NAV catalogs. Admission does not establish deployment, issuer enrollment, execution permissions, available liquidity, or complete NAV coverage.

## Protocols requiring IDs

| Metadata name     | `idType`  | What to put in `ids`                                                      | Source boundary                                                                                   |
| ----------------- | --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `aave_v3`         | `address` | Pool contracts                                                            | Curator supply/borrow permissions; liquidity and health helpers                                   |
| `aave_v4`         | `address` | Spoke contracts                                                           | Contract liquidity helper and NAV reader; no served Curator V4 compiler in the researched catalog |
| `erc4626`         | `address` | Vault contracts                                                           | Generic Curator vault permission, including vaults without a dedicated metadata name              |
| `euler`           | `address` | Collateral and debt EVaults used by the strategy                          | Curator vault/borrowing permissions and health helper                                             |
| `morpho_blue`     | `bytes32` | Market IDs                                                                | Curator `morpho_market` permission and health helper                                              |
| `morpho_midnight` | `bytes32` | Market IDs                                                                | Maturity-aware health helper; no served Curator compiler in the researched catalog                |
| `morpho_vaultv2`  | `address` | Vault V2 contracts                                                        | Curator ERC-4626 permission, dedicated liquidity helper, and NAV reader                           |
| `three_f`         | `address` | 3F request contracts identifying the PT/YT positions                      | Curator mint/burn permission; policy and factory bindings remain in execution configuration       |
| `tokens`          | `address` | Selected common-token contract addresses from the chain's local allowlist | Exact allowlist membership is validated in addition to address format                             |

List every selected portfolio target. For Blue and Midnight, use market IDs rather than the protocol deployment address. Morpho Vault V1 can be described through `erc4626`; it has no dedicated NAV reader in the researched scope. Reserve IDs, recipients, policies, and execution bounds remain in execution configuration.

`derive_v3` requires `ids: []`: the configured Derive deployment discovers individually owned subaccounts and beneficial vault shares. Numeric subaccount/vault API IDs remain in the Derive execution configuration.

## Common tokens

The `tokens` entry declares a nonempty subset of the nine allowed token addresses. Symbols such as `"usdc"` are not valid IDs. Matching accepts lowercase, checksum, and uppercase hex spelling. Allowlist membership is scoped by the action's `chain-id`; the initial allowlist covers Ethereum mainnet (`1`). A `tokens` entry on another chain is rejected until that chain has an explicit local allowlist.

| Token  | Ethereum address                             | Address source                                                                                                                                          |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LBTC   | `0x8236a87084f8b84306f72007f36f2618a5634494` | [Lombard contracts](https://docs.lombard.finance/learn/transparency/smart-contracts)                                                                    |
| WBTC   | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | [NAV wallet catalog](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/internal/client/prices/catalog.go) |
| uniBTC | `0x004e9c3ef86bc1ca1f0bb5c7662861ee93350568` | [Bedrock contracts](https://docs.bedrock.technology/security/smart-contracts/unibtc)                                                                    |
| weETH  | `0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee` | [NAV product catalog](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/internal/client/rwa/catalog.go)   |
| WETH   | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` | [NAV wallet catalog](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/internal/client/prices/catalog.go) |
| wstETH | `0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0` | [NAV wallet catalog](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/internal/client/prices/catalog.go) |
| USDT   | `0xdac17f958d2ee523a2206206994597c13d831ec7` | [Tether contracts](https://tether.to/en/supported-protocols/)                                                                                           |
| USDS   | `0xdc035d45d973e3ec169d2276ddab16f1e407384f` | [Sky contracts](https://developers.skyeco.com/guides/skylink/usds-ethereum-solana-bridge/)                                                              |
| USDC   | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | [Circle contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses)                                                                   |

## Named products requiring empty arrays

These names identify canonical products in the researched Ethereum catalog. Their token and issuer bindings do not need to be repeated in each adapter's metadata. Each requires `ids: []`.

| Family              | Allowlisted names                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Midas (23)          | `carrytradeusdtryleverage`, `stockmarkettrbasistrade`, `mapollo`, `mbasis`, `mbtc`, `medge`, `mevusd`, `mfarm`, `mfone`, `mglobal`, `mhyper`, `mhyperbtc`, `mhypereth`, `mm1usd`, `mmev`, `mrox`, `mre7btc`, `mre7yield`, `msl`, `mtbill`, `mevbtc`, `msyrupusd`, `msyrupusdp` |
| Centrifuge (7)      | `acrdx`, `hyb`, `jaaa`, `jtrsy`, `decrdx`, `dejaaa`, `dejtrsy`                                                                                                                                                                                                                 |
| Pareto (1)          | `aa_falconxusdc`                                                                                                                                                                                                                                                               |
| Hastra / Figure (2) | `prime`, `auto`                                                                                                                                                                                                                                                                |
| OpenEden (1)        | `hybond`                                                                                                                                                                                                                                                                       |
| Securitize (5)      | `hinc`, `stac`, `vbill`, `acred`, `buidl`                                                                                                                                                                                                                                      |
| Makina (1)          | `dusd`                                                                                                                                                                                                                                                                         |
| Spiko (1)           | `spkcc`                                                                                                                                                                                                                                                                        |
| Superstate (1)      | `uscc`                                                                                                                                                                                                                                                                         |
| 3Jane (1)           | `susd3`                                                                                                                                                                                                                                                                        |
| GAIB (1)            | `said`                                                                                                                                                                                                                                                                         |
| Noon (1)            | `susn`                                                                                                                                                                                                                                                                         |
| Theo (1)            | `sthusd`                                                                                                                                                                                                                                                                       |
| InfiniFi (2)        | `liusd4w`, `liusd13w`                                                                                                                                                                                                                                                          |
| Backed / DigiFT (1) | `beqty`                                                                                                                                                                                                                                                                        |

Names use lowercase contract/catalog symbols. `mfone` corresponds to `mF-ONE`, `mm1usd` to `mM1-USD`, and `aa_falconxusdc` to the adapters/NAV `AA_FalconX` product displayed as `AA_FalconXUSDC` in Curator. Alternate spellings are not aliases in validation.

Portfolio simplification:

- `wylds` is covered by `prime`/`auto`, whose Figure redemption path includes held wYLDS and its requests; it has no separate entry.
- `usd3` is covered by `susd3`, whose redemption path includes held USD3 and subsequent USDC; it has no separate entry.
- `weeth` and `wsteth` appear only as addresses under `tokens`.
- Payout currencies `AID`, `USN`, `thUSD`, and `iUSD`, plus the auxiliary `ParetoReceipt`, remain part of their product accounting rather than separate metadata entries.
- Centrifuge share classes, Midas products, and InfiniFi lock terms retain separate names because they have separate product/contract bindings. A shared underlying currency or issuer does not make one product encompass another.
- `liquid_lane_connector`, `liquid_lane_redeem`, `cow_swap`, and `merkl` are execution/reward plumbing rather than separate portfolio entries and are rejected as protocol names.

The 49 named products are the original 49 redemption-account products minus `usd3`, `weeth`, and `wsteth`, plus supplementary products `hybond`, `hinc`, and `buidl`.

Coverage differs by product. Selected issuer routes appear in Curator; other names come from redemption contracts or NAV catalogs. Securitize redemption discovery/pricing remains unresolved. `beqty` is a planned name: its issuer exit is blocked/unproven in the recorded fork matrix and its NAV lacks approved USD pricing. Allowlist admission does not enable a strategy.

No dedicated Pendle, Uniswap, Curve, Balancer, or AMM liquidity-provision route appears in the researched Merkle compiler catalog. Generic `manage()` capability does not establish dedicated integrations for them.

## Research sources

Reviewed on 11 October 2026 using the local sibling repositories. Links pin the source revisions:

- **Adapters, `2b9868f1d06ce61adadc94a489a2938ef3b6f285`:** [automation integration boundaries](https://github.com/symbioticfi/adapters/blob/2b9868f1d06ce61adadc94a489a2938ef3b6f285/docs/MERKLE-AUTOMATION-STRATEGIES.md), [redemption matrix](https://github.com/symbioticfi/adapters/blob/2b9868f1d06ce61adadc94a489a2938ef3b6f285/docs/RECIPE-REDEMPTIONS.md), [redemption-account contracts](https://github.com/symbioticfi/adapters/tree/2b9868f1d06ce61adadc94a489a2938ef3b6f285/src/contracts/ll-adapter/tokens-to-redeem), and [liquidity/health interfaces](https://github.com/symbioticfi/adapters/tree/2b9868f1d06ce61adadc94a489a2938ef3b6f285/src/interfaces/merkle-adapter/automations).
- **Curator frontend, `NO-TASK-merkle-adapter` at `8846071a67b6bdaeb7e26bb080f0e7dc64fa8890`:** [portfolio/RWA catalog](https://github.com/symbioticfi/curator-frontend/blob/8846071a67b6bdaeb7e26bb080f0e7dc64fa8890/src/shared/api/chain-queries/merkle-portfolio/catalog.ts) and [issuer route names](https://github.com/symbioticfi/curator-frontend/blob/8846071a67b6bdaeb7e26bb080f0e7dc64fa8890/src/shared/lib/merkle-tree/rwaCatalog.ts).
- **Curator frontend, `NO-TASK-merkle-hybrid-improve` at `e2d98bb2a64fd92ea75f8c1d878ec22c7781d4b5`:** [permission catalog fixture](https://github.com/symbioticfi/curator-frontend/blob/e2d98bb2a64fd92ea75f8c1d878ec22c7781d4b5/src/shared/api/http-queries/merkle-permissions/__fixtures__/catalog.json).
- **Curator backend, `NO-TASK-merkle-rewrite` at `bc1a9bb6b09b48b165b66b7fbc1f65d3176dc9e4`:** [permission type inventory](https://github.com/symbioticfi/curator-backend/blob/bc1a9bb6b09b48b165b66b7fbc1f65d3176dc9e4/src/domains/merkle/catalog/index.ts), [issuer routes](https://github.com/symbioticfi/curator-backend/blob/bc1a9bb6b09b48b165b66b7fbc1f65d3176dc9e4/src/domains/merkle/catalog/types/rwa-routes.ts), and [Derive target/ID semantics](https://github.com/symbioticfi/curator-backend/blob/bc1a9bb6b09b48b165b66b7fbc1f65d3176dc9e4/src/domains/merkle/catalog/types/derive.ts).
- **Merkle adapter NAV (`chainlink-nav` checkout), `NO-TASK-derive-v3-nav` at `1ac3d19b6411ea77ab4771069bd1c8184687b1ca`:** [58-token catalog and protocol readers](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/docs/supported-assets.md), [pinned 49-product redemption manifest](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/internal/client/rwa/testdata/tokens-to-redeem.json), and [Derive discovery](https://github.com/symbioticfi/merkle-adapter-nav/blob/1ac3d19b6411ea77ab4771069bd1c8184687b1ca/docs/derive-v3.md).
