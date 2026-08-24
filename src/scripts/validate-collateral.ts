import fs from "fs/promises";
import * as path from "path";
import { Address } from "viem";

import { createClient, getChain } from "./blockchain";
import { getVaultTokenAddress } from "./get-vault-token-address";
import * as github from "./github";
import * as messages from "./messages";
import { Entity } from "./validate-fs";

export const validateCollateral = async ({ entityType, entityId: vaultAddress }: Entity) => {
    if (entityType !== "vaults") {
        return;
    }

    const chain = getChain();
    const client = createClient();
    const upstreamDir = github.getInput("upstream-checkout-path", {
        required: false,
    });

    let tokenAddress: Address | undefined;
    try {
        tokenAddress = await getVaultTokenAddress(client, vaultAddress as Address);
    } catch (error) {
        await github.addComment(messages.invalidVault(vaultAddress, chain.name));

        throw new Error(`Failed to read vault collateral for \`${vaultAddress}\``, { cause: error });
    }

    if (!tokenAddress) {
        await github.addComment(messages.invalidVault(vaultAddress, chain.name));

        throw new Error(
            `Contract \`${vaultAddress}\` is not a valid Vault on ${chain.name} network.`,
        );
    }

    const tokensDir = upstreamDir ? path.join(upstreamDir, "tokens") : "tokens";
    let dirItems: string[];
    try {
        dirItems = await fs.readdir(tokensDir);
    } catch (error) {
        await github.addComment(messages.noVaultTokenInfo(tokenAddress));

        throw new Error(`Unable to read the token metadata directory \`${tokensDir}\``, {
            cause: error,
        });
    }

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
