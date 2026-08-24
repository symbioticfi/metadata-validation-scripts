import { Address } from "viem";

import { createClient, getChain } from "./blockchain";
import * as github from "./github";
import * as messages from "./messages";
import { Entity, EntityType } from "./validate-fs";

type EntityMeta = {
    registryInput: string;
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
        registryInput: "vault-registry",
    },
    networks: {
        label: "Network",
        registryInput: "network-registry",
    },
    operators: {
        label: "Operator",
        registryInput: "operator-registry",
    },
    adapters: {
        label: "Adapter",
        registryInput: "adapter-registry",
    },
};

export const validateEntity = async ({ entityType, entityId }: Entity) => {
    const entityAddress = entityId as Address;
    const entityMeta = entityMetaMap[entityType];

    if (!entityMeta) {
        return;
    }

    const chain = getChain();
    const client = createClient();
    const registryContract = github.getInput(entityMeta.registryInput, { required: true });
    const isEntity = await client.readContract({
        address: registryContract as Address,
        abi: isEntityAbi,
        functionName: "isEntity",
        args: [entityAddress],
    });

    if (!isEntity) {
        await github.addComment(
            messages.notRegisteredEntity(
                entityMeta.label,
                entityAddress,
                chain.name,
                registryContract,
            ),
        );

        throw new Error(
            `${entityMeta.label} \`${entityAddress}\` is not registered in ${entityMeta.label.toLowerCase()} registry on ${chain.name} network (registry address: \`${registryContract}\`)`,
        );
    }
};
