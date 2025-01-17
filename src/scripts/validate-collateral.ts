import { Address } from "viem";
import { createClient, getChain } from "./blockchain";
import fs from "fs/promises";

import * as github from "./github";
import * as messages from "./messages";

const collateralAbi = [
  {
    inputs: [],
    name: "collateral",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const validateCollateral = async (vaultAddress: string) => {
  const chain = getChain();
  const client = createClient();

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

  const dirItems = await fs.readdir("tokens");
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
