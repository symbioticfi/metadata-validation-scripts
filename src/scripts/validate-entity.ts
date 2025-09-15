import { Address } from "viem";

import { createClient, getChain } from "./blockchain";
import * as github from "./github";
import * as messages from "./messages";
import { EntityType, FsValidationResult } from "./validate-fs";

type EntityMeta = {
    contract: string;
    label: string;
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

const entityMetaMap: Partial<Record<EntityType, EntityMeta>> = {
    vaults: {
        label: "Vault",
        contract: github.getInput("vault-registry", { required: true }),
    },

    networks: {
        label: "Network",
        contract: github.getInput("network-registry", { required: true }),
    },

    operators: {
        label: "Operator",
        contract: github.getInput("operator-registry", { required: true }),
    },
};

export const validateEntity = async ({ entityType, entityId }: FsValidationResult) => {
    const chain = getChain();
    const client = createClient();
    const entityAddress = entityId as Address;
    const entityMeta = entityMetaMap[entityType];

    if (!entityMeta) {
        return;
    }

    const isEntity = await client.readContract({
        address: entityMeta.contract as Address,
        abi: isEntityAbi,
        functionName: "isEntity",
        args: [entityAddress],
    });

    if (!isEntity) {
        await github.addComment(
            messages.notRegisteredEntity(
                entityMeta.label,
                entityId,
                chain.name,
                entityMeta.contract,
            ),
        );

        throw new Error(
            `${entityMeta.label} \`${entityAddress}\` is not registered in ${entityMeta.label.toLowerCase()} registry on ${chain.name} network (registry address: \`${entityMeta.contract}\`)`,
        );
    }
};
