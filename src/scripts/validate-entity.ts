import { Address, createPublicClient, http } from "viem";
import * as allChains from "viem/chains";

import { getInput } from "./github";
import { FsValidationResult, EntityType } from "./validate-fs";

type ContractsMap = Partial<Record<EntityType, Address>>;

const chains = [allChains.holesky, allChains.mainnet];
const entityRegistryContracts: Record<number, ContractsMap> = {
  [allChains.holesky.id]: {
    vaults: "0x407a039d94948484d356efb765b3c74382a050b4",
    networks: "0x7d03b7343bf8d5cec7c0c27ece084a20113d15c9",
    operators: "0x6f75a4fff97326a00e52662d82ea4fde86a2c548",
  },

  [allChains.mainnet.id]: {
    vaults: "0xAEb6bdd95c502390db8f52c8909F703E9Af6a346",
    networks: "0xC773b1011461e7314CF05f97d95aa8e92C1Fd8aA",
    operators: "0xAd817a6Bc954F678451A71363f04150FDD81Af9F",
  },
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

export const validateEntity = async ({
  entityType,
  entityId,
}: FsValidationResult) => {
  const rpcUrl = getInput("rpc-url") || undefined;
  const chainId = +getInput("chain-id");
  const chain = chains.find(({ id }) => id === chainId) || allChains.holesky;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const entityAddress = entityId as Address;
  const contractAddress = entityRegistryContracts[chain.id][entityType];

  if (!contractAddress) {
    return;
  }

  const isEntity = await client.readContract({
    address: contractAddress,
    abi: isEntityAbi,
    functionName: "isEntity",
    args: [entityAddress],
  });

  if (!isEntity) {
    throw new Error(
      `Entity ${entityAddress} is not registered in ${entityType} on ${chain.name}`,
    );
  }
};
