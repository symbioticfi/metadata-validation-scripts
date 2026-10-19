# Merkle portfolio allowlist

[`merkle-protocols.json`](../src/scripts/config/merkle-protocols.json) contains 56 metadata names: five integrations requiring target IDs, two integrations with fixed bindings, the `tokens` entry, and 48 named RWA products. Each entry has `{protocol, ids}`; Euler additionally requires `subaccounts`. Protocol names cannot be repeated. `requiresIds` requires either a nonempty array or an empty array; `idType` is `address` (20 bytes), `bytes32` (32 bytes), or `none`.

This inventory is synchronized with the Merkle adapter NAV runtime at [`eeeaf0a8295e0c99eee89172d8a1a07f41c49efd`](https://github.com/symbioticfi/merkle-adapter-nav/commit/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd), reviewed on 19 October 2026. This includes the uniBTC/USDS pricing addition on top of merged master. Sources:

- [Registered runtime readers](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/usecase/valuation/live.go).
- [Wallet token/pricing catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/client/prices/catalog.go).
- [Active RWA products and issuer bindings](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/client/rwa/catalog.go).
- [Protocol and deferred-asset scope](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/docs/supported-assets.md).

Both allowlists are imported into the validator bundle; validation makes no runtime config-file reads or catalogue HTTP requests. This action validates portfolio declarations and adapter registration. It does not grant execution permissions or verify protocol targets on-chain. The Euler account scope and offline metadata consumption described below are coordinated with [pending NAV PR 22](https://github.com/symbioticfi/merkle-adapter-nav/pull/22). These changes extend the reviewed source revision above; they do not imply that either PR is merged or deployed.

## Integrations and target IDs

| Metadata name    | `idType`  | `ids` and runtime scope                                                                                                                                                            |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aave_v3`        | `address` | Pool contracts. Runtime covers the catalogued Ethereum/Core, Ether.fi, Lido and Horizon pools.                                                                                     |
| `aave_v4`        | `address` | Spoke contracts. Runtime covers twelve catalogued user-position spokes, excluding treasury and tokenization-only spokes.                                                           |
| `euler`          | `address` | Retained collateral and debt EVaults, paired with every declared XOR subaccount offset. At most 48 seed pairs; NAV also attests canonical factory membership and pinned ownership. |
| `morpho_blue`    | `bytes32` | At most 16 market IDs. NAV validates immutable market parameters against each ID.                                                                                                  |
| `morpho_vaultv2` | `address` | At most 16 Vault V2 contracts; Vault V1 is excluded.                                                                                                                               |
| `three_f`        | `none`    | Empty array. Runtime enumerates factory requests from its fixed launch baseline, index 71, and reads owned PT/YT positions. Request addresses are discovered rather than supplied. |
| `ember`          | `none`    | Empty array. Canonical PPLUS vault `0xbc5d3722376d44f3bc316c6ea61c9bd553be8cbe`, including held shares and owner withdrawal requests. `pplus` is not a protocol name.              |
| `tokens`         | `address` | Nonempty subset of the chain-specific wallet catalogue below.                                                                                                                      |

Target-ID validation checks format, not deployed contract identity or membership in NAV's fixed Aave catalogue. In pending NAV PR 22, Euler and Morpho universes come from the embedded metadata snapshot prepared below. Reserve IDs, recipients, policies and execution permissions belong to execution configuration.

Sources: [Aave/Euler catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/client/lending/catalog.go), [Morpho configuration](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/nav/config.json), [3F reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/client/threef/threef.go), [Ember reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/internal/client/ember/ember.go).

## Euler scope and offline NAV preparation

The adapter's `merkle-adapters/<adapter-address>/info.json` declares EVaults and account offsets together:

```json
{
    "protocols": [
        {
            "protocol": "euler",
            "ids": ["0x4444444444444444444444444444444444444444"],
            "subaccounts": [0, 1]
        }
    ]
}
```

The EVault above is illustrative. `subaccounts` is required only for Euler and is rejected on other entries. Its values are unique integers from 0 through 255. Offset 0 is the exact address returned by the adapter's pinned `account()` read; offset `n` is `address(uint160(account()) ^ uint160(n))`. This is XOR with the owner address, not replacement of its last byte. For example, an account ending in `0x7c` and offset 1 derive an account ending in `0x7d`. The metadata folder identifies the adapter, not this position-owning account. See the [official Euler derivation and ownership documentation](https://docs.euler.finance/build/evc/integration-guide/).

Euler IDs must be nonzero addresses and unique ignoring hex case. Every EVault is paired with every offset, and every pair must be checked for both supply and debt. Their product must be at most 48. Additional recognized enabled collateral also consumes the NAV collector's 48-pair limit; overflow fails the entire run. Both Morpho lists retain their separate limit of 16 IDs.

List the full retained valuation scope, including markets and subaccounts that still hold shares or debt after permissions or strategy configuration change. A current permission list cannot establish that a removed position has settled. Omitting Euler or a Morpho entry explicitly excludes that integration from its configured scope; an empty `protocols` array excludes both. Pending NAV PR 22 uses metadata only for these dynamic market lists: other declarations are validated but do not alter its fixed Aave, wallet or RWA catalogue admission. Metadata validation cannot prove that the declaration is complete for arbitrary assets. NAV still verifies canonical factory membership, EVC ownership and native quantities at its finalized block; an in-scope read or valuation failure fails the run.

Pending NAV PR 22 prepares a trusted operator configuration offline from a local metadata Git repository. From the NAV checkout, use:

```sh
python3 scripts/prepare_metadata_config.py \
    --base-config nav/config.json \
    --metadata-repo /path/to/metadata-mainnet \
    --metadata-commit <full-40-hex-commit> \
    --adapter <adapter-address> \
    --out /path/to/prepared-config.json
```

Replace the angle-bracket values before running the command. Preparation reads the committed Git object for that adapter's exact `info.json`, rather than uncommitted working files or a mutable `latest/full-info.json` release. It embeds `metadata` with `repository`, `commit`, `adapter`, `chainId` and `protocols`, bound to the configured adapter. NAV uses this embedded Euler and Morpho scope without runtime GitHub or metadata HTTP requests. The pinned commit records provenance; it does not attest onchain amounts or prove inventory completeness. No production adapter dataset is supplied here: a contributor must provide the actual retained scope in the metadata repository.

## Wallet tokens

`tokens.ids` accepts exactly these 17 Ethereum mainnet addresses from [`merkle-tokens.json`](../src/scripts/config/merkle-tokens.json). Matching accepts lowercase, checksum and uppercase hex spelling. Symbols are not IDs. Other chains require their own explicit token allowlist.

| Token   | Ethereum address                             |
| ------- | -------------------------------------------- |
| cbBTC   | `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf` |
| DAI     | `0x6b175474e89094c44da98b954eedeac495271d0f` |
| LBTC    | `0x8236a87084f8b84306f72007f36f2618a5634494` |
| PAXG    | `0x45804880de22913dafe09f4980848ece6ecbaf78` |
| PYUSD   | `0x6c3ea9036406852006290770bedfcaba0e23a0e8` |
| SolvBTC | `0x7a56e1c57c7475ccf742a1832b028f0456652f97` |
| tBTC    | `0x18084fba666a33d37592fa2633fd49a74dd93a88` |
| tETH    | `0xd11c452fc99cf405034ee446803b6f6c1f6d5ed8` |
| uniBTC  | `0x004e9c3ef86bc1ca1f0bb5c7662861ee93350568` |
| USDC    | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |
| USDe    | `0x4c9edd5852cd905f086c759e8383e09bff1e68b3` |
| USDS    | `0xdc035d45d973e3ec169d2276ddab16f1e407384f` |
| USDT    | `0xdac17f958d2ee523a2206206994597c13d831ec7` |
| WBTC    | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` |
| weETH   | `0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee` |
| WETH    | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` |
| wstETH  | `0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0` |

uniBTC uses the reviewed Chainlink uniBTC/BTC exchange rate multiplied by BTC/USD. USDS uses the reviewed Chainlink USDS/USD feed. These follow the normal NAV round and freshness checks; neither token relies on assumed parity. Both remain ordinary tokens, including supported Merkl rewards.

weETH and wstETH remain tokens; there are no EtherFi or Lido protocol entries. Aave's Ether.fi and Lido pools remain part of Aave. tETH and weETH use the runtime's reviewed holdings conversion routes.

## RWA products

Each of these 48 names requires `ids: []`: canonical token and issuer contracts are fixed in the NAV catalogue. Separate products retain separate names even when their issuer or underlying currency is shared.

| Family              | Metadata names                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Midas (23)          | `carrytradeusdtryleverage`, `stockmarkettrbasistrade`, `mapollo`, `mbasis`, `mbtc`, `medge`, `mevusd`, `mfarm`, `mfone`, `mglobal`, `mhyper`, `mhyperbtc`, `mhypereth`, `mm1usd`, `mmev`, `mrox`, `mre7btc`, `mre7yield`, `msl`, `mtbill`, `mevbtc`, `msyrupusd`, `msyrupusdp` |
| Centrifuge (6)      | `acrdx`, `hyb`, `jaaa`, `jtrsy`, `dejaaa`, `dejtrsy`                                                                                                                                                                                                                           |
| Pareto (12)         | `aa_falconxusdc`, `bb_falconxusdc`, `aa_fasanara`, `bb_fasanara`, `aa_bastion`, `bb_bastion`, `aa_adaptivefrontier`, `bb_adaptivefrontier`, `aa_rockawayx`, `bb_rockawayx`, `aa_abraxas`, `bb_abraxas`                                                                         |
| Hastra / Figure (3) | `prime`, `auto`, `wylds`                                                                                                                                                                                                                                                       |
| OpenEden (2)        | `hybond`, `tbill`                                                                                                                                                                                                                                                              |
| Noon (2)            | `susn`, `usn`                                                                                                                                                                                                                                                                  |

`mfone` means Midas mF-ONE and `mm1usd` means mM1-USD. OpenEden `tbill` is distinct from Midas `mtbill`. The existing `aa_falconxusdc` spelling is retained for NAV's `AA_FalconX`; `bb_falconxusdc` follows the same convention for `BB_FalconX`. Other Pareto names are the lowercase NAV catalogue symbols.

PRIME/AUTO use the Hastra staking snapshot. Independently held wYLDS uses the separate Hastra yield snapshot, so `wylds` has its own entry. Likewise HYBOND/TBILL and sUSN/USN use independent snapshot lenses and product accounting.

The six auxiliary Pareto receipt tokens remain within their respective AA/BB product accounting, covering all 54 active RWA token rows without requiring receipt declarations:

| Pareto product   | Receipt token                                |
| ---------------- | -------------------------------------------- |
| FalconX          | `0x17e9ab2992dfecbe779a06a92a6cdb9fe6aeeef3` |
| Fasanara         | `0xc35d078092872ec1f2ae82bcd6f0b6b89f0850de` |
| Bastion          | `0x06975bb418effb0029fe278a6fa15b92bb97496f` |
| AdaptiveFrontier | `0xa30be796fb2babf9228359e86a041c14e29f86fc` |
| RockawayX        | `0x3fc0265e92eeafed0ccd9f8621764ce0981882ce` |
| Abraxas          | `0xe7e13f902ea13e6eaaa4ed9a2de5898436d12cbf` |

Abraxas includes deprecated outstanding rights. Metadata admission does not imply the issuer accepts new deposits. Payout currencies and pending mint/redemption rights are handled by the relevant product reader.

## Rewards and excluded scope

Merkl is automatic shared reward accounting, rather than a separate portfolio position declaration. Its reader verifies proofs against the pinned distributor root and subtracts claimed amounts. It admits tokens supported by the wallet or active RWA valuers; unsupported pricing, including MORPHO/EUL/rEUL, is skipped. USDC rewards remain admitted, including when USDC is the vault denomination. `merkl`, `liquid_lane_connector`, `liquid_lane_redeem` and `cow_swap` remain excluded metadata names. See [reward scope](https://github.com/symbioticfi/merkle-adapter-nav/blob/eeeaf0a8295e0c99eee89172d8a1a07f41c49efd/docs/reward-coverage.md).

Generic ERC-4626 wallet discovery, Morpho Midnight, Morpho Vault V1 and Derive V3 are absent from the selected runtime. An internal wrapper conversion routine does not admit arbitrary vaults. Securitize is removed. The 14 deferred RWA tokens in the pinned NAV documentation are also outside the active reader and have no metadata entries here.

## Corrections from the previous inventory

- Added `ember`, OpenEden `tbill`, independent `wylds` and `usn`, plus the eleven missing Pareto AA/BB tranches. All 23 Midas products already matched.
- Changed `three_f` from required request addresses to empty IDs, matching automatic request discovery.
- Removed `erc4626`, `morpho_midnight` and `derive_v3`, which lack runtime discovery readers.
- Removed Securitize's `acred`, `buidl`, `hinc`, `stac`, `vbill`, and deferred products `beqty`, `decrdx`, `dusd`, `liusd13w`, `liusd4w`, `said`, `spkcc`, `sthusd`, `susd3`, `uscc`.
- Added wallet tokens cbBTC, DAI, PYUSD, tBTC and USDe. uniBTC and USDS remain admitted, with explicit NAV price routes added for both.
- Replaced research across divergent branches and planned integrations with the pinned runtime revision above. Format-only target checks and the separate NAV configuration remain explicit boundaries.
