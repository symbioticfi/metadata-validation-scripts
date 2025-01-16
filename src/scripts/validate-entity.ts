import { Address, createPublicClient, http } from "viem";
import * as allChains from "viem/chains";

import * as github from "./github";
import * as messages from "./messages";

import { FsValidationResult, EntityType } from "./validate-fs";

type EntityMeta = {
  contract: string;
  label: string;
};

const chains = [allChains.holesky, allChains.mainnet];
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

export const validateEntity = async ({
  entityType,
  entityId,
}: FsValidationResult) => {
  const rpcUrl = github.getInput("rpc-url") || undefined;
  const chainId = +github.getInput("chain-id", { required: true });
  const chain = chains.find(({ id }) => id === chainId);

  if (!chain) {
    throw new Error(`Chain with id ${chainId} is not supported`);
  }

  const client = createPublicClient({ chain, transport: http(rpcUrl) });
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
      `${entityMeta.label} (\`${entityAddress}\`) is not registered on ${chain.name} (\`${entityMeta.contract}\`)`,
    );
  }
};
