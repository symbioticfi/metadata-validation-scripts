import type { Address, PublicClient } from "viem";

const collateralAbi = [
    {
        inputs: [],
        name: "collateral",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

const assetAbi = [
    {
        inputs: [],
        name: "asset",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

type MulticallClient = Pick<PublicClient, "multicall">;

export const getVaultTokenAddress = async (
    client: MulticallClient,
    vaultAddress: Address,
): Promise<Address | undefined> => {
    const [collateral, asset] = await client.multicall({
        allowFailure: true,
        contracts: [
            {
                address: vaultAddress,
                abi: collateralAbi,
                functionName: "collateral",
            },
            {
                address: vaultAddress,
                abi: assetAbi,
                functionName: "asset",
            },
        ] as const,
    });

    if (collateral.status === "success") {
        return collateral.result;
    }

    if (asset.status === "success") {
        return asset.result;
    }

    return undefined;
};
