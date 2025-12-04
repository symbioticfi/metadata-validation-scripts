import fs from "fs/promises";
import * as path from "path";
import { Address } from "viem";

import { createClient, getChain } from "./blockchain";
import * as github from "./github";
import * as messages from "./messages";
import { Entity } from "./validate-fs";

const collateralAbi = [
    {
        inputs: [],
        name: "collateral",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const validateCollateral = async ({ entityType, entityId: vaultAddress }: Entity) => {
    if (entityType !== "vaults") {
        return;
    }

    const chain = getChain();
    const client = createClient();
    const upstreamDir = github.getInput("upstream-checkout-path", {
        required: false,
    });

    const tokenAddress = await client.readContract({
        address: vaultAddress as Address,
        abi: collateralAbi,
        functionName: "collateral",
    });

    if (!tokenAddress) {
        await github.addComment(messages.invalidVault(vaultAddress, chain.name));

        throw new Error(
            `Contract \`${vaultAddress}\` is not a valid Vault on ${chain.name} network.`,
        );
    }

    const tokensDir = upstreamDir ? path.join(upstreamDir, "tokens") : "tokens";
    const dirItems = await fs.readdir(tokensDir);
    const tokenInfoExists = dirItems.some(
        (item) => item.toLowerCase() === tokenAddress.toLowerCase(),
    );

    if (!tokenInfoExists) {
        await github.addComment(messages.noVaultTokenInfo(tokenAddress));

        throw new Error(
            `Information for the vault collateral \`${tokenAddress}\` is not found in the repository.`,
        );
    }
};
