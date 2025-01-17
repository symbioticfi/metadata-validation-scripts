import { Address } from "viem";
import { createClient, getChain } from "./blockchain";
import path from "path";
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

  const tokenInfoExists = await fs
    .stat(path.join("tokens", tokenAddress))
    .then((stats) => stats.isDirectory())
    .catch(() => false);

  console.log(`Vault collateral`, {
    vaultAddress,
    tokenAddress,
    tokenPath: path.join("tokens", tokenAddress),
    tokenInfoExists,
  });

  if (!tokenInfoExists) {
    await github.addComment(messages.noVaultTokenInfo(tokenAddress));

    throw new Error(
      `Information for the vault collateral \`${tokenAddress}\` is not found in the repository.`,
    );
  }
};
