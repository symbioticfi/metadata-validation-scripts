import { Address, Hex, isAddress, parseAbi, zeroAddress } from "viem";

import { createClient, getChain } from "./blockchain";
import protocols from "./config/merkle-protocols.json";

type TargetEntry = { protocol: string; ids: string[] };
// idIndex -1 reports the protocol entry itself.
type TargetError = { index: number; idIndex: number; message: string };

const rules: Record<string, { requiresIds: boolean; token?: string; requires?: string[] }> =
    protocols;
const conversions: Record<string, string> = protocols.tokens.conversions;

const eulerFactory = "0x29a56a1b8214D9Cf7c5561811750D5cBDb45CC8e" as Address;
const morphoVaultFactory = "0xA1D94F746dEfa1928926b84fB2596c06926C0405" as Address;
const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

const eulerAbi = parseAbi(["function isProxy(address) view returns (bool)"]);
const morphoVaultAbi = parseAbi(["function isVaultV2(address) view returns (bool)"]);
const morphoMarketAbi = parseAbi([
    "function market(bytes32) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
    "function idToMarketParams(bytes32) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
]);
const assetAbi = parseAbi(["function asset() view returns (address)"]);

const vaultProtocols = ["euler", "morpho_vaultv2", "lagoon", "ember"];

// Factory provenance does not distinguish active and deprecated EVaults.
async function activeEulerVaults(): Promise<Set<string>> {
    const response = await fetch("https://app.euler.finance/api/public/metadata?chainId=1", {
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error("Euler metadata unavailable");
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid Euler metadata");
    }

    const active = Object.values(data).flatMap((entry: unknown) => {
        if (!entry || typeof entry !== "object") {
            return [];
        }

        const vault = entry as Record<string, unknown>;

        return vault.type === "evk" &&
            vault.deprecated !== true &&
            typeof vault.address === "string" &&
            isAddress(vault.address, { strict: false })
            ? [vault.address.toLowerCase()]
            : [];
    });
    if (active.length === 0) {
        throw new Error("Empty Euler metadata");
    }

    return new Set(active);
}

// The NAV counts a position only in a token metadata lists: tokens.ids, a selected
// vault or a selected product token. Every token a selection touches must be listed.
export async function validateMerkleTargets(entries: TargetEntry[]): Promise<TargetError[]> {
    const listed = new Set(
        entries.flatMap(({ protocol, ids }) =>
            protocol === "tokens" || vaultProtocols.includes(protocol)
                ? ids.map((id) => id.toLowerCase())
                : (rules[protocol]?.token ?? []),
        ),
    );
    const unlisted = (tokens: string[]) =>
        tokens
            .map((token) => token.toLowerCase())
            .filter((token) => token !== zeroAddress && !listed.has(token))
            .map((token) => `touches ${token}, which metadata must list in tokens`)
            .join("; ");

    const selected = entries
        .flatMap((entry, index) =>
            entry.ids.map((id, idIndex) => ({ protocol: entry.protocol, id, index, idIndex })),
        )
        .filter(({ protocol }) => ["morpho_blue", ...vaultProtocols].includes(protocol));

    if (getChain().id !== 1) {
        return selected.map(({ index, idIndex }) => ({
            index,
            idIndex,
            message: "cannot verify this protocol target outside Ethereum mainnet",
        }));
    }

    // Product payouts and token conversions are fixed by configuration.
    const fixed = entries.flatMap(({ protocol, ids }, index) => [
        { index, idIndex: -1, message: unlisted(rules[protocol]?.requires ?? []) },
        ...(protocol === "tokens"
            ? ids.map((id, idIndex) => ({
                  index,
                  idIndex,
                  message: unlisted([conversions[id.toLowerCase()] ?? zeroAddress]),
              }))
            : []),
    ]);

    const eulerVaults = selected.some(({ protocol }) => protocol === "euler")
        ? await activeEulerVaults().catch(() => null)
        : null;
    const client = createClient();
    const results = await Promise.all(
        selected.map(async ({ protocol, id, index, idIndex }) => {
            try {
                let valid: boolean;
                switch (protocol) {
                    case "euler":
                        if (!eulerVaults) {
                            return {
                                index,
                                idIndex,
                                message: "could not verify active Euler vaults",
                            };
                        }

                        if (!eulerVaults.has(id.toLowerCase())) {
                            return { index, idIndex, message: "is not an active Euler EVault" };
                        }

                        valid = await client.readContract({
                            address: eulerFactory,
                            abi: eulerAbi,
                            functionName: "isProxy",
                            args: [id.toLowerCase() as Address],
                        });
                        break;
                    case "morpho_vaultv2":
                        valid = await client.readContract({
                            address: morphoVaultFactory,
                            abi: morphoVaultAbi,
                            functionName: "isVaultV2",
                            args: [id.toLowerCase() as Address],
                        });
                        break;
                    case "lagoon":
                    case "ember":
                        valid = (
                            protocol === "lagoon" ? protocols.lagoon : protocols.ember
                        ).allowedIds.includes(id.toLowerCase());
                        break;
                    default: {
                        const market = await client.readContract({
                            address: morphoBlue,
                            abi: morphoMarketAbi,
                            functionName: "market",
                            args: [id as Hex],
                        });
                        valid = market[4] > 0n;
                    }
                }

                if (!valid) {
                    return { index, idIndex, message: `is not a registered ${protocol} target` };
                }

                const touched =
                    protocol === "morpho_blue"
                        ? (
                              await client.readContract({
                                  address: morphoBlue,
                                  abi: morphoMarketAbi,
                                  functionName: "idToMarketParams",
                                  args: [id as Hex],
                              })
                          ).slice(0, 2)
                        : [
                              await client.readContract({
                                  address: id.toLowerCase() as Address,
                                  abi: assetAbi,
                                  functionName: "asset",
                              }),
                          ];

                return { index, idIndex, message: unlisted(touched as string[]) };
            } catch {
                return {
                    index,
                    idIndex,
                    message: `could not verify ${protocol} target on Ethereum mainnet`,
                };
            }
        }),
    );

    return [...fixed, ...results].filter(({ message }) => message !== "");
}
