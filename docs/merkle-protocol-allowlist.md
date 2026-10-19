# Merkle portfolio allowlist

[`merkle-protocols.json`](../src/scripts/config/merkle-protocols.json) contains 57 metadata names: six integrations requiring target IDs, one integration with a fixed binding, the `tokens` entry, and 49 named RWA products. Each entry has `{protocol, ids}`; Euler additionally requires `subaccounts`. Protocol names cannot be repeated. `requiresIds` requires either a nonempty array or an empty array; `idType` is `address` (20 bytes), `bytes32` (32 bytes), `name` (exact lowercase name), or `none`.

The catalogue baseline for this inventory is the Merkle adapter NAV runtime at [`8d2f071764ff0dcbc83081578aae7eee29a97658`](https://github.com/symbioticfi/merkle-adapter-nav/commit/8d2f071764ff0dcbc83081578aae7eee29a97658), reviewed on 19 October 2026. The mGLO source bindings are pinned to this commit. The ordinary wallet-token inventory also retains the separately reviewed uniBTC/USDS admission. Sources:

- [Registered runtime readers](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/usecase/valuation/live.go).
- [Wallet token/pricing catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/client/prices/catalog.go).
- [Active RWA products and issuer bindings](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/client/rwa/catalog.go).
- [Protocol and deferred-asset scope](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/docs/supported-assets.md).

Both allowlists are imported into the validator bundle; validation makes no runtime config-file reads or catalogue HTTP requests. This action validates portfolio declarations and adapter registration. It does not grant execution permissions or verify protocol targets on-chain. The Aave and Ember selection semantics, Euler account scope and metadata consumption described below are coordinated with [pending NAV PR 22](https://github.com/symbioticfi/merkle-adapter-nav/pull/22). These changes extend the reviewed source revision above; they do not imply that either PR is merged or deployed.

## Integrations and target IDs

| Metadata name    | `idType`  | `ids` and runtime scope                                                                                                                                                                                                                              |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aave_v3`        | `name`    | Exact names `core`, `etherfi`, `lido`, `horizon` select the corresponding catalogued pools.                                                                                                                                                          |
| `aave_v4`        | `address` | Only the twelve user-position spoke addresses in `allowedIds`, ignoring hex case. Treasury and tokenization-only spokes are excluded.                                                                                                                |
| `euler`          | `address` | Retained collateral and debt EVaults, paired with every declared XOR subaccount offset. At most 48 seed pairs; NAV also attests canonical factory membership and pinned ownership.                                                                   |
| `morpho_blue`    | `bytes32` | At most 16 market IDs. NAV validates immutable market parameters against each ID.                                                                                                                                                                    |
| `morpho_vaultv2` | `address` | At most 16 Vault V2 contracts; Vault V1 is excluded.                                                                                                                                                                                                 |
| `three_f`        | `none`    | Empty array. Runtime enumerates factory requests from its fixed launch baseline, index 71, and reads owned PT/YT positions. Request addresses are discovered rather than supplied.                                                                   |
| `ember`          | `address` | Only canonical Ethereum PPLUS vault `0xbc5d3722376d44f3bc316c6ea61c9bd553be8cbe`, including held shares and owner withdrawal requests. Required nonempty IDs; membership/uniqueness ignore hex case; no subaccounts. `pplus` is not a protocol name. |
| `tokens`         | `address` | Nonempty subset of the chain-specific wallet catalogue below.                                                                                                                                                                                        |

Target-ID validation checks format and any explicit `allowedIds` membership; it does not attest deployed contract identity. In pending NAV PR 22, Aave, Euler, Morpho and Ember scopes come from the embedded metadata snapshot prepared below. Reserve IDs, recipients, policies and execution permissions belong to execution configuration.

Sources: [Aave/Euler catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/client/lending/catalog.go), [Morpho configuration](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/nav/config.json), [3F reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/client/threef/threef.go), [Ember reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/internal/client/ember/ember.go).

## Euler scope and NAV preparation

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

Euler IDs must be nonzero addresses and unique ignoring hex case. Every EVault is paired with every offset, and every pair must be checked for both supply and debt. Their product must be at most 48. Additional recognized enabled collateral also consumes the NAV collector's 48-pair limit; overflow fails the entire run. Both Morpho lists retain their separate limit of 16 IDs; their market IDs and vault addresses must also be nonzero and unique ignoring hex case.

List the full retained valuation scope, including markets and subaccounts that still hold shares or debt after permissions or strategy configuration change. A current permission list cannot establish that a removed position has settled. Omitting an Aave version, Euler, a Morpho entry or Ember explicitly excludes that integration from its configured scope; an empty `protocols` array excludes all these families. Ember omission skips its collector and ledger/queue discovery; generic idle balances remain required when PPLUS is the denomination. Pending NAV PR 22 uses metadata for these deployment lists: other declarations are validated but do not alter wallet or RWA catalogue admission. Metadata validation cannot prove that the declaration is complete for arbitrary assets. NAV still verifies canonical factory membership, EVC ownership and native quantities at its finalized block; an in-scope read or valuation failure fails the run.

Pending NAV PR 22 prepares a trusted operator configuration on the host. Required environment variables select the chain and exact metadata commit. `CHAIN_ID` maps to hardcoded canonical repositories: `1` selects [`symbioticfi/metadata-mainnet`](https://github.com/symbioticfi/metadata-mainnet), and `560048` maps to [`symbioticfi/metadata-hoodi`](https://github.com/symbioticfi/metadata-hoodi). Preparation and runtime currently accept only `CHAIN_ID=1` because the admitted readers are mainnet-only; the Hoodi mapping does not enable that chain. From the NAV checkout, use:

```sh
CHAIN_ID=1 METADATA_COMMIT=FULL_40_HEX_SHA \
    python3 scripts/prepare_metadata_config.py \
    --base-config nav/config.json \
    --adapter ADDRESS \
    --out /path/to/prepared-config.json
```

Replace `FULL_40_HEX_SHA` with the full 40-hex commit ID and `ADDRESS` with the adapter address before running the command. Preparation requires network access: it fetches that exact commit from the selected canonical repository into a temporary host Git store and reads the committed object for the adapter's exact `info.json`. There is no latest fallback. It generates a deterministic configuration containing `metadata` with `repository`, `commit`, `adapter`, `chainId` and `protocols`, bound to the configured adapter. Both native CLI and CRE consume this generated snapshot without runtime GitHub or metadata HTTP requests. The pinned commit records provenance; it does not attest onchain amounts or prove inventory completeness. No production adapter dataset is supplied here: a contributor must provide the actual retained scope in the metadata repository.

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

Each of these 49 names requires `ids: []`: canonical token and issuer contracts are fixed in the NAV catalogue. Separate products retain separate names even when their issuer or underlying currency is shared.

| Family              | Metadata names                                                                                                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Midas (24)          | `carrytradeusdtryleverage`, `stockmarkettrbasistrade`, `mapollo`, `mbasis`, `mbtc`, `medge`, `mevusd`, `mfarm`, `mfone`, `mglo`, `mglobal`, `mhyper`, `mhyperbtc`, `mhypereth`, `mm1usd`, `mmev`, `mrox`, `mre7btc`, `mre7yield`, `msl`, `mtbill`, `mevbtc`, `msyrupusd`, `msyrupusdp` |
| Centrifuge (6)      | `acrdx`, `hyb`, `jaaa`, `jtrsy`, `dejaaa`, `dejtrsy`                                                                                                                                                                                                                                   |
| Pareto (12)         | `aa_falconxusdc`, `bb_falconxusdc`, `aa_fasanara`, `bb_fasanara`, `aa_bastion`, `bb_bastion`, `aa_adaptivefrontier`, `bb_adaptivefrontier`, `aa_rockawayx`, `bb_rockawayx`, `aa_abraxas`, `bb_abraxas`                                                                                 |
| Hastra / Figure (3) | `prime`, `auto`, `wylds`                                                                                                                                                                                                                                                               |
| OpenEden (2)        | `hybond`, `tbill`                                                                                                                                                                                                                                                                      |
| Noon (2)            | `susn`, `usn`                                                                                                                                                                                                                                                                          |

`mfone` means Midas mF-ONE and `mm1usd` means mM1-USD. OpenEden `tbill` is distinct from Midas `mtbill`. The existing `aa_falconxusdc` spelling is retained for NAV's `AA_FalconX`; `bb_falconxusdc` follows the same convention for `BB_FalconX`. Other Pareto names are the lowercase NAV catalogue symbols.

PRIME/AUTO use the Hastra staking snapshot. Independently held wYLDS uses the separate Hastra yield snapshot, so `wylds` has its own entry. Likewise HYBOND/TBILL and sUSN/USN use independent snapshot lenses and product accounting.

The six auxiliary Pareto receipt tokens remain within their respective AA/BB product accounting, covering all 55 active RWA token rows without requiring receipt declarations:

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

Merkl is automatic shared reward accounting, rather than a separate portfolio position declaration. Its reader verifies proofs against the pinned distributor root and subtracts claimed amounts. It admits tokens supported by the wallet or active RWA valuers; unsupported pricing, including MORPHO/EUL/rEUL, is skipped. USDC rewards remain admitted, including when USDC is the vault denomination. `merkl`, `liquid_lane_connector`, `liquid_lane_redeem` and `cow_swap` remain excluded metadata names. See [reward scope](https://github.com/symbioticfi/merkle-adapter-nav/blob/8d2f071764ff0dcbc83081578aae7eee29a97658/docs/reward-coverage.md).

Generic ERC-4626 wallet discovery, Morpho Midnight, Morpho Vault V1 and Derive V3 are absent from the selected runtime. An internal wrapper conversion routine does not admit arbitrary vaults. Securitize is removed. The 14 deferred RWA tokens in the pinned NAV documentation are also outside the active reader and have no metadata entries here.

## Corrections from the previous inventory

- Added `ember`, OpenEden `tbill`, independent `wylds` and `usn`, plus the eleven missing Pareto AA/BB tranches. All 23 Midas products already matched.
- Changed `three_f` from required request addresses to empty IDs, matching automatic request discovery.
- Removed `erc4626`, `morpho_midnight` and `derive_v3`, which lack runtime discovery readers.
- Removed Securitize's `acred`, `buidl`, `hinc`, `stac`, `vbill`, and deferred products `beqty`, `decrdx`, `dusd`, `liusd13w`, `liusd4w`, `said`, `spkcc`, `sthusd`, `susd3`, `uscc`.
- Added wallet tokens cbBTC, DAI, PYUSD, tBTC and USDe. uniBTC and USDS remain admitted, with explicit NAV price routes added for both.
- Replaced research across divergent branches and planned integrations with the pinned runtime revision above. Target admission and the separate NAV configuration remain explicit boundaries.

Aave V3 and V4 declarations select runtime deployments. Omitting either version excludes it completely; present entries require nonempty IDs and forbid `subaccounts`. V3 names are case-sensitive; V4 membership and uniqueness ignore hex case. Reserve enumeration remains complete within each selected pool or spoke. New deployments require synchronized NAV catalogue and shared allowlist changes.

## Ember vault selection

Use `{"protocol":"ember","ids":["0xbc5d3722376d44f3bc316c6ea61c9bd553be8cbe"]}` to select PPLUS. This singleton admission selects the existing NAV reader; it does not enable generic Ember-vault accounting. Empty, null, omitted, malformed, zero, duplicate or unsupported IDs are rejected. Omit the entire entry for exclusion. Selected held shares, pending withdrawals, fees and required-read failures keep their existing accounting; no blacklist status is acquired.

`mglo` declares Ethereum mGLO (`0x1dd91a111606382b77a917633ed90feaf25e0f76`) as its own Midas product with `ids: []`. It is outside the ordinary wallet-token list. Held mGLO uses raw issuer NAV; standard claims retain the consumer's documented Midas escrow policy. Instant-redemption holdbacks are outside admitted accounting scope.
