import assert from "node:assert/strict";
import { test } from "node:test";

import { getVaultTokenAddress } from "../src/scripts/get-vault-token-address.ts";

const vaultAddress = "0x0000000000000000000000000000000000000001";
const collateralAddress = "0x0000000000000000000000000000000000000002";
const assetAddress = "0x0000000000000000000000000000000000000003";

const createClient = (successfulCalls) => ({
    multicall: async ({ allowFailure, contracts }) => {
        const results = contracts.map(({ functionName }) => {
            const result = successfulCalls[functionName];

            return result
                ? { result, status: "success" }
                : {
                      error: new Error(`${functionName} reverted`),
                      status: "failure",
                  };
        });

        if (!allowFailure && results.some(({ status }) => status === "failure")) {
            throw new Error("Multicall reverted");
        }

        return results;
    },
});

test("resolves a V1 vault through collateral()", async () => {
    const client = createClient({ collateral: collateralAddress });

    assert.equal(await getVaultTokenAddress(client, vaultAddress), collateralAddress);
});

test("resolves a V2 vault through asset()", async () => {
    const client = createClient({ asset: assetAddress });

    assert.equal(await getVaultTokenAddress(client, vaultAddress), assetAddress);
});

test("prefers collateral() when both token calls succeed", async () => {
    const client = createClient({
        asset: assetAddress,
        collateral: collateralAddress,
    });

    assert.equal(await getVaultTokenAddress(client, vaultAddress), collateralAddress);
});

test("returns undefined when neither vault token call succeeds", async () => {
    const client = createClient({});

    assert.equal(await getVaultTokenAddress(client, vaultAddress), undefined);
});
