import * as fs from "fs/promises";
import { Address, isAddress } from "viem";

import { createClient, getChain } from "./blockchain";
import * as github from "./github";
import * as messages from "./messages";
import { Entity } from "./validate-fs";

export type RewardsContract = {
    address: string;
    type: string;
};

export type MetadataWithRewards = {
    rewards?: RewardsContract[];
    [key: string]: unknown;
};

const isEntityAbi = [
    {
        inputs: [{ internalType: "address", name: "entity_", type: "address" }],
        name: "isEntity",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

const vaultAbi = [
    {
        inputs: [],
        name: "VAULT",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const validateRewards = async ({
    entityId: vaultAddress,
    metadata: metadataPath,
    entityType,
}: Entity) => {
    if (!metadataPath || entityType !== "vaults") {
        return;
    }

    const chain = getChain();
    const client = createClient();
    const rewardsFactory = github.getInput("rewards-factory", {
        required: false,
    });

    if (!rewardsFactory) {
        return;
    }

    let metadata: MetadataWithRewards;
    try {
        const metadataContent = await fs.readFile(metadataPath, "utf8");
        metadata = JSON.parse(metadataContent) as MetadataWithRewards;
    } catch (error) {
        await github.addComment(messages.invalidInfoJson());

        throw new Error("The `info.json` file contains invalid JSON", { cause: error });
    }

    if (!Array.isArray(metadata.rewards) || metadata.rewards.length === 0) {
        return;
    }

    for (const reward of metadata.rewards) {
        if (!reward || !isAddress(reward.address)) {
            await github.addComment(messages.invalidRewardsAddress(String(reward?.address)));

            throw new Error(`Rewards contract address \`${String(reward?.address)}\` is invalid`);
        }

        if (reward.type !== "defaultStakingRewardsV2") {
            await github.addComment(messages.invalidRewardsType(reward.address, reward.type));

            throw new Error(
                `Rewards contract \`${reward.address}\` has invalid type \`${reward.type}\`. Expected: defaultStakingRewardsV2`,
            );
        }

        const isEntity = await client.readContract({
            address: rewardsFactory as Address,
            abi: isEntityAbi,
            functionName: "isEntity",
            args: [reward.address as Address],
        });

        if (!isEntity) {
            await github.addComment(
                messages.rewardsNotFromFactory(reward.address, rewardsFactory, chain.name),
            );

            throw new Error(
                `Rewards contract \`${reward.address}\` is not deployed by the rewards factory \`${rewardsFactory}\` on ${chain.name} network`,
            );
        }

        const rewardsVault = await client.readContract({
            address: reward.address as Address,
            abi: vaultAbi,
            functionName: "VAULT",
        });

        if (rewardsVault.toLowerCase() !== vaultAddress.toLowerCase()) {
            await github.addComment(
                messages.rewardsVaultMismatch(reward.address, rewardsVault, vaultAddress),
            );

            throw new Error(
                `Rewards contract \`${reward.address}\` is associated with vault \`${rewardsVault}\`, but expected \`${vaultAddress}\``,
            );
        }
    }
};
