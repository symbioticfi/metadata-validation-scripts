# Merkle portfolio allowlist

[`merkle-protocols.json`](../src/scripts/config/merkle-protocols.json) contains 47 metadata names: seven integrations requiring target IDs, 3F and Merkl, the `tokens` entry, and 37 named RWA products. The wire object requires `chains: [{chainId, protocols}]`, with a nonempty chain array, positive safe-integer chain IDs and a required protocols array per scope. Empty protocols arrays are permitted; duplicate chain IDs, extra scope fields and the old top-level protocols shape are rejected. Each protocol entry has `{protocol, ids}`; Euler additionally requires `subaccounts`. Protocol names cannot be repeated within one chain; separate chains may repeat names and IDs. `requiresIds` requires either a nonempty array or an empty array; `idType` is `address` (20 bytes), `bytes32` (32 bytes), `name` (exact lowercase name), or `none`.

The catalogue baseline for this inventory is the Merkle adapter NAV runtime at [`de7853f4`](https://github.com/symbioticfi/merkle-adapter-nav/commit/de7853f4), reviewed on 9 November 2026. The inventory excludes the mMEV and Abraxas routes removed from that revision. Unsupported Midas products are excluded alongside their obsolete redemption endpoints. The ordinary wallet-token inventory also retains the separately reviewed uniBTC/USDS admission. Sources:

- [Registered runtime readers](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/usecase/valuation/live.go).
- [Wallet token/pricing catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/client/prices/catalog.go).
- [Active RWA products and issuer bindings](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/client/rwa/catalog.go).
- [Protocol and deferred-asset scope](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/docs/supported-assets.md).

Both allowlists are imported into the validator bundle; validation makes no runtime config-file reads or catalogue HTTP requests. This action validates portfolio declarations and adapter factory membership. It does not grant execution permissions. All scopes receive schema and duplicate validation using their nested chain ID, including chain-specific token membership. The configured action `chain-id` must appear. Only its adapter factory membership and target declarations are checked through the configured RPC; Ethereum targets use canonical protocol contracts when those contracts expose membership. Other scopes receive no RPC identity attestation. Run the action under each chain configuration for that coverage; mainnet-only target checks reject active non-mainnet Euler, Morpho and Lagoon declarations.

## Integrations and target IDs

| Metadata name    | `idType`  | `ids` and runtime scope                                                                                                                                                                                                |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aave_v3`        | `name`    | Exact names `core`, `etherfi`, `lido`, `horizon` select the corresponding catalogued pools.                                                                                                                            |
| `aave_v4`        | `address` | Only the twelve user-position spoke addresses in `allowedIds`, ignoring hex case. Treasury and tokenization-only spokes are excluded.                                                                                  |
| `euler`          | `address` | Retained collateral and debt EVaults, paired with every declared XOR subaccount offset. At most 48 seed pairs; NAV also attests canonical factory membership and pinned ownership.                                     |
| `morpho_blue`    | `bytes32` | At most 16 market IDs. NAV validates immutable market parameters against each ID.                                                                                                                                      |
| `morpho_vaultv2` | `address` | At most 16 Vault V2 contracts; Vault V1 is excluded.                                                                                                                                                                   |
| `lagoon`         | `address` | Only the eight reviewed Ethereum vaults listed below; no subaccounts. The consumer requires a reviewed accounting profile. Omission makes no family read.                                                              |
| `three_f`        | `none`    | Empty array. Runtime enumerates factory requests from its fixed launch baseline, index 71, and reads owned PT/YT positions. Request addresses are discovered rather than supplied.                                     |
| `ember`          | `address` | 27 reviewed Ethereum vaults from the NAV catalogue, including held shares and owner withdrawal requests. Required nonempty IDs; membership/uniqueness ignore hex case; no subaccounts. `pplus` is not a protocol name. |
| `merkl`          | `none`    | Empty array. Selects reward discovery for declared wallet tokens and RWA products; omission skips the rewards API and collector.                                                                                       |
| `tokens`         | `address` | Nonempty subset of the chain-specific wallet catalogue below.                                                                                                                                                          |

Target-ID validation checks format and any explicit `allowedIds` membership. It also checks `EVaultFactory.isProxy` for Euler, `VaultV2Factory.isVaultV2` for Morpho V2, `Morpho.market(id).lastUpdate` for Blue markets. Failed or unreadable membership rejects the declaration. Ember has no published vault factory or registry, so its reviewed address list remains the provenance check. Aave deployment IDs use the reviewed catalogues. Reserve IDs, recipients, policies and execution permissions belong to execution configuration.

Sources: [Aave/Euler catalogue](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/client/lending/catalog.go), [Morpho configuration](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/nav/config.json), [3F reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/client/threef/threef.go), [Ember reader](https://github.com/symbioticfi/merkle-adapter-nav/blob/de7853f4/internal/client/ember/ember.go).

## Lagoon scope and accounting profile

A `lagoon` declaration selects each vault's account-owned held shares and complete request/claim lifecycle. Keep the vault selected while any entitlement remains outstanding, including settled unclaimed shares or net asset claims. Only the eight vault addresses below are allowed, ignoring hex case; subaccounts and an underlying asset field are forbidden. The generic `erc7540` protocol name is rejected.

Addresses come from metadata. Consumers derive the underlying using `asset()`, validate `share()` against the Lagoon own-share profile, and read share and asset decimals dynamically from pinned state. The vault address must be allowlisted; the underlying is read from the vault. The underlying must still have an admitted pricing route; unsupported or changed bindings fail closed. ERC165 alone does not establish fee, settlement or completeness semantics.

The Lagoon allowlist is exactly:

- `0xdae854d0896ad2fee335689a3f7b4a95fd1a3e46`
- `0xce0b790ae0d8cf91e01f3fb69025e14569b574f3`
- `0x03d1ec0d01b659b89a87eabb56e4af5cb6e14bfc`
- `0x28663161f9fa2963eb6102b88a741e195e974df6`
- `0x6a39fe461278376f61acbbb6759550e24a78a7b2`
- `0xd2386d8413c2ec4a761901da14c74a98ebe5054b`
- `0xcda323c2df692d989b24ba51d0acca924cf9a344`
- `0x78295b34d940c780c8c02a607fedf58242e7df2c`

The reviewed [Lagoon v0.6.0 implementation source](https://etherscan.io/address/0x6c77c47fb8168e22976c3b0338cb1769c952249f#code) uses epoch IDs, a zero-ID latest-request alias, synchronous cancellation refunds, and settlement-specific entry/exit fees. These rules belong to the Lagoon profile composed with shared ERC7540 acquisition and accounting. Paused or whitelist-suppressed max getters describe executability and cannot prove that economic entitlements are absent. The exact public version is an issuer-governance assertion, not proof of the active implementation slot. This catalogue adds no deployment row or account permission.

## Euler scope and NAV preparation

The adapter's `merkle-adapters/<adapter-address>/info.json` declares EVaults and account offsets together:

```json
{
    "chains": [
        {
            "chainId": 1,
            "protocols": [
                {
                    "protocol": "euler",
                    "ids": ["0x4444444444444444444444444444444444444444"],
                    "subaccounts": [0, 1]
                }
            ]
        }
    ]
}
```

The EVault above is illustrative. `subaccounts` is required only for Euler and is rejected on other entries. Its values are unique integers from 0 through 255. Offset 0 is the exact address returned by the adapter's pinned `account()` read; offset `n` is `address(uint160(account()) ^ uint160(n))`. This is XOR with the owner address, not replacement of its last byte. For example, an account ending in `0x7c` and offset 1 derive an account ending in `0x7d`. The metadata folder identifies the adapter, not this position-owning account. See the [official Euler derivation and ownership documentation](https://docs.euler.finance/build/evc/integration-guide/).

Euler IDs must be nonzero addresses and unique ignoring hex case. Every EVault is paired with every offset, and every pair must be checked for both supply and debt. Their product must be at most 48. Only declared account/vault pairs are acquired; enabled collateral links selected supplies without discovering omitted vaults. Both Morpho lists retain their separate limit of 16 IDs; their market IDs and vault addresses must also be nonzero and unique ignoring hex case.

List the full retained valuation scope, including markets and subaccounts that still hold shares or debt after permissions or strategy configuration change. A current permission list cannot establish that a removed position has settled. Omitting an Aave version, Euler, a Morpho entry or Ember explicitly excludes that integration from its configured scope; an empty `protocols` array excludes all these families. Ember omission skips its collector and ledger/queue discovery; generic idle balances remain required when PPLUS is the denomination. Metadata also selects ordinary wallet tokens, individual RWA products, 3F and Merkl. Omitted product declarations exclude standalone holdings and issuer requests, even if an outstanding position exists. A declared market includes its supported collateral and supplied assets with the issuer pricing dependencies needed to value them. These quote-only dependencies do not enable independent wallet or issuer-request discovery, and need no separate product entry. Metadata validation cannot prove that the declaration is complete for arbitrary assets. NAV still verifies canonical factory membership, EVC ownership and native quantities at its finalized block; an in-scope read or valuation failure fails the run.

NAV preparation fetches the exact metadata Git object on the host and copies the selected chain scope into the workflow configuration. Mainnet and Sepolia use separate deployment profiles and metadata repositories. From the NAV checkout:

```sh
CHAIN_ID=1 METADATA_COMMIT=FULL_40_HEX_SHA \
    python3 scripts/prepare_metadata_config.py \
    --base-config nav/config.json \
    --deployment /path/to/deployment.json \
    --adapter ADDRESS \
    --out /path/to/prepared-config.json
```

Use the reviewed chain-specific deployment profile, metadata commit and adapter address. There is no branch/latest fallback or implicit `.env` loading. Native and CRE consume the same prepared JSON without runtime metadata HTTP. Provenance does not attest quantities or prove inventory completeness. Source facts and entitlements remain checked at the pinned block.

## Wallet tokens

`tokens.ids` accepts exactly these 17 Ethereum mainnet addresses from [`merkle-tokens.json`](../src/scripts/config/merkle-tokens.json). Membership uses each enclosing scope's `chainId`, independently of the action chain. Matching accepts lowercase, checksum and uppercase hex spelling. Symbols are not IDs. Other chains require their own explicit token allowlist.

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

tETH, weETH and wstETH remain ordinary wallet tokens; they have no separate protocol entries. Aave's Ether.fi and Lido pools remain part of Aave. Admitting these named tokens does not admit arbitrary ERC-4626 vaults.

## RWA products

Each of these 37 names requires `ids: []`: canonical token and issuer contracts are fixed in the NAV catalogue. Separate products retain separate names even when their issuer or underlying currency is shared.

| Family              | Metadata names                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Midas (19)          | `carrytradeusdtryleverage`, `stockmarkettrbasistrade`, `mapollo`, `mbasis`, `mbtc`, `medge`, `mfone`, `mglo`, `mglobal`, `mhyper`, `mhyperbtc`, `mm1usd`, `mrox`, `mre7btc`, `mre7yield`, `msl`, `mtbill`, `msyrupusd`, `msyrupusdp` |
| Centrifuge (6)      | `acrdx`, `hyb`, `jaaa`, `jtrsy`, `dejaaa`, `dejtrsy`                                                                                                                                                                                 |
| Pareto (5)          | `aa_falconxusdc`, `aa_fasanara`, `aa_bastion`, `aa_adaptivefrontier`, `aa_rockawayx`                                                                                                                                                 |
| Hastra / Figure (3) | `prime`, `auto`, `wylds`                                                                                                                                                                                                             |
| OpenEden (2)        | `hybond`, `tbill`                                                                                                                                                                                                                    |
| Noon (2)            | `susn`, `usn`                                                                                                                                                                                                                        |

`mfone` means Midas mF-ONE and `mm1usd` means mM1-USD. OpenEden `tbill` is distinct from Midas `mtbill`. The NAV catalogue uses these same lowercase RWA product IDs directly, without case conversion.

PRIME/AUTO use the Hastra staking snapshot. Independently held wYLDS uses the separate Hastra yield snapshot, so `wylds` has its own entry. Likewise HYBOND/TBILL and sUSN/USN use independent snapshot lenses and product accounting.

Pareto BB tranches are not supported. The five auxiliary Pareto receipt tokens remain within their respective AA product accounting, covering all 46 RWA token rows without requiring receipt declarations:

| Pareto product   | Receipt token                                |
| ---------------- | -------------------------------------------- |
| FalconX          | `0x17e9ab2992dfecbe779a06a92a6cdb9fe6aeeef3` |
| Fasanara         | `0xc35d078092872ec1f2ae82bcd6f0b6b89f0850de` |
| Bastion          | `0x06975bb418effb0029fe278a6fa15b92bb97496f` |
| AdaptiveFrontier | `0xa30be796fb2babf9228359e86a041c14e29f86fc` |
| RockawayX        | `0x3fc0265e92eeafed0ccd9f8621764ce0981882ce` |

mMEV and Ethereum Abraxas are rejected because the current NAV runtime has no admitted reader for them. Pareto receipt tokens are accounted under their AA product and are not separate metadata entries. Metadata admission does not imply the issuer accepts new deposits. Payout currencies and pending mint/redemption rights are handled by the relevant product reader.

mFARM, mevBTC, mEVUSD, mHyperETH, mMEV and Abraxas are unsupported and rejected. USN and wYLDS remain native accounting/conversion dependencies rather than directly buyable Strategy products. [Midas transparency](https://midas.app/transparency), [Pareto deprecations](https://docs.pareto.credit/developers/addresses/product/credit-vaults).

## Rewards and excluded scope

Declare `{"protocol":"merkl","ids":[]}` to select reward accounting. Omission skips the reward API and on-chain discovery. The reader verifies proofs against the pinned distributor root and subtracts claimed amounts. It admits selected wallet tokens and RWA products; unsupported pricing, including MORPHO/EUL/rEUL, is skipped. `liquid_lane_connector`, `liquid_lane_redeem` and `cow_swap` remain excluded metadata names.

Generic ERC-4626 wallet discovery, Morpho Midnight, Morpho Vault V1 and Derive V3 are absent from the selected runtime. Named protocol readers retain their shared ERC-4626 accounting helpers; those helpers do not admit standalone vaults. Securitize is removed. The 14 deferred RWA tokens in the pinned NAV documentation are also outside the active reader and have no metadata entries here.

## Corrections from the previous inventory

- Added `ember`, OpenEden `tbill`, independent `wylds` and `usn`, plus the five additional Pareto AA tranches. The current catalog admits 19 Midas products.
- Changed `three_f` from required request addresses to empty IDs, matching automatic request discovery.
- Removed `erc4626`, `morpho_midnight` and `derive_v3`, which lack runtime discovery readers.
- Removed Securitize's `acred`, `buidl`, `hinc`, `stac`, `vbill`, and deferred products `beqty`, `decrdx`, `dusd`, `liusd13w`, `liusd4w`, `said`, `spkcc`, `sthusd`, `susd3`, `uscc`.
- Added wallet tokens cbBTC, DAI, PYUSD, tBTC and USDe. uniBTC and USDS remain admitted, with explicit NAV price routes added for both.
- Replaced research across divergent branches and planned integrations with the pinned runtime revision above. Target admission and the separate NAV configuration remain explicit boundaries.

Aave V3 and V4 declarations select runtime deployments. Omitting either version excludes it completely; present entries require nonempty IDs and forbid `subaccounts`. V3 names are case-sensitive; V4 membership and uniqueness ignore hex case. Reserve enumeration remains complete within each selected pool or spoke. New deployments require synchronized NAV catalogue and shared allowlist changes.

## Ember vault selection

Use `{"protocol":"ember","ids":["0xbc5d3722376d44f3bc316c6ea61c9bd553be8cbe"]}` to select PPLUS. The reviewed catalogue admits 27 Ethereum vaults through the existing generic Ember reader; arbitrary addresses remain rejected. All share the reviewed USDC-backed tokenized profile; underlying assets are still derived from each vault. Active parking lots, missing required getters, native-ETH variants and tokenless AtomicLiquidity remain excluded. Empty, null, omitted, malformed, zero, duplicate or unsupported IDs are rejected. Omit the entire entry for exclusion. Selected held shares, pending withdrawals, fees and required-read failures keep their existing accounting; no blacklist status is acquired.

`mglo` declares Ethereum mGLO (`0x1dd91a111606382b77a917633ed90feaf25e0f76`) as its own Midas product with `ids: []`. It is outside the ordinary wallet-token list. Held mGLO uses raw issuer NAV; standard claims retain the consumer's documented Midas escrow policy. Instant-redemption holdbacks are outside admitted accounting scope.

The Ember expansion was checked at finalized Ethereum block 26286110 against
Ember's [deployment manifest](https://github.com/ember-protocol/Ember-Vaults-EVM/blob/102ed27794cfc083de6cf28bdad1d80113eb8e21/deployments/mainnet-deployment.json)
and [official product API](https://vaults.api.prod.ember.so/api/v2/vaults).
The [pinned NAV vault review](https://github.com/symbioticfi/merkle-adapter-nav/blob/c691d44cfddb13ade97b8674f542cad0b6b41947/docs/ember-vaults.md) records addresses, implementation and exclusions.
