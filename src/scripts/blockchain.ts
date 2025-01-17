import { createPublicClient, http } from "viem";
import * as allChains from "viem/chains";

import * as github from "./github";

export const getChain = () => {
  const chainId = +github.getInput("chain-id", { required: true });
  const chain = Object.values(allChains).find(({ id }) => id === chainId);

  if (!chain) {
    throw new Error(`Chain with id ${chainId} is not supported`);
  }

  return chain;
};

export const createClient = () => {
  const rpcUrl = github.getInput("rpc-url") || undefined;

  return createPublicClient({ chain: getChain(), transport: http(rpcUrl) });
};
