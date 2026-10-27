import { Address, Hex, parseAbi } from "viem";

import { createClient, getChain } from "./blockchain";

type TargetEntry = { protocol: string; ids: string[] };
type TargetError = { index: number; idIndex: number; message: string };

const eulerFactory = "0x29a56a1b8214D9Cf7c5561811750D5cBDb45CC8e" as Address;
const morphoVaultFactory = "0xA1D94F746dEfa1928926b84fB2596c06926C0405" as Address;
const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;
const lagoonFactory = "0x8D6f5479B14348186faE9BC7E636e947c260f9B1" as Address;

const eulerAbi = parseAbi(["function isProxy(address) view returns (bool)"]);
const morphoVaultAbi = parseAbi(["function isVaultV2(address) view returns (bool)"]);
const lagoonAbi = parseAbi(["function isInstance(address) view returns (bool)"]);
const morphoMarketAbi = parseAbi([
    "function market(bytes32) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
]);

// Only the canonical contracts can attest a target's protocol identity. Ember
// has no public factory, so its reviewed addresses remain schema allowlisted.
export async function validateMerkleTargets(entries: TargetEntry[]): Promise<TargetError[]> {
    const selected = entries
        .flatMap((entry, index) =>
            entry.ids.map((id, idIndex) => ({ protocol: entry.protocol, id, index, idIndex })),
        )
        .filter(({ protocol }) =>
            ["euler", "morpho_vaultv2", "morpho_blue", "lagoon"].includes(protocol),
        );
    if (selected.length === 0) {
        return [];
    }

    if (getChain().id !== 1) {
        return selected.map(({ index, idIndex }) => ({
            index,
            idIndex,
            message: "cannot verify this protocol target outside Ethereum mainnet",
        }));
    }

    const client = createClient();
    const results = await Promise.all(
        selected.map(async ({ protocol, id, index, idIndex }) => {
            try {
                let valid: boolean;
                switch (protocol) {
                    case "euler":
                        valid = await client.readContract({
                            address: eulerFactory,
                            abi: eulerAbi,
                            functionName: "isProxy",
                            args: [id as Address],
                        });
                        break;
                    case "morpho_vaultv2":
                        valid = await client.readContract({
                            address: morphoVaultFactory,
                            abi: morphoVaultAbi,
                            functionName: "isVaultV2",
                            args: [id as Address],
                        });
                        break;
                    case "lagoon":
                        valid = await client.readContract({
                            address: lagoonFactory,
                            abi: lagoonAbi,
                            functionName: "isInstance",
                            args: [id as Address],
                        });
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

                return valid
                    ? null
                    : { index, idIndex, message: `is not a registered ${protocol} target` };
            } catch {
                return {
                    index,
                    idIndex,
                    message: `could not verify ${protocol} target on Ethereum mainnet`,
                };
            }
        }),
    );

    return results.filter((result): result is TargetError => result !== null);
}
