import protocols from "../config/merkle-protocols.json";
import tokens from "../config/merkle-tokens.json";
import schema from "./merkle-adapters.json";

const scope = schema.properties.chains.items;
const entry = scope.properties.protocols.items;
const tokensByChain: Record<string, Record<string, string>> = tokens;

/** Compile the allowlist into the bundled schema, without runtime config file reads. */
export default function getMerkleAdapterSchema() {
    const idRules = Object.entries(protocols).map(([protocol, rule]) => ({
        if: {
            type: "object",
            properties: { protocol: { const: protocol } },
            required: ["protocol"],
        },
        then: {
            type: "object",
            properties: {
                ids: rule.requiresIds
                    ? {
                          type: "array",
                          minItems: 1,
                          ...(protocol === "euler" ? { maxItems: 48 } : {}),
                          ...("allowedIds" in rule ? { maxItems: rule.allowedIds.length } : {}),
                          ...(["morpho_blue", "morpho_vaultv2", "lagoon"].includes(protocol)
                              ? { maxItems: 16 }
                              : {}),
                          items:
                              "allowedIds" in rule
                                  ? rule.idType === "name"
                                      ? { type: "string", enum: rule.allowedIds }
                                      : {
                                            type: "string",
                                            pattern: `^0x(?:${rule.allowedIds.map((address) => address.slice(2).replace(/[a-f]/g, (character) => `[${character}${character.toUpperCase()}]`)).join("|")})$`,
                                        }
                                  : {
                                        type: "string",
                                        pattern:
                                            rule.idType === "bytes32"
                                                ? "^0x(?!0{64}$)[a-fA-F0-9]{64}$"
                                                : protocol === "euler" ||
                                                    protocol === "morpho_vaultv2" ||
                                                    protocol === "lagoon"
                                                  ? "^0x(?!0{40}$)[a-fA-F0-9]{40}$"
                                                  : "^0x[a-fA-F0-9]{40}$",
                                    },
                      }
                    : { type: "array", maxItems: 0 },
                subaccounts: protocol === "euler" ? entry.properties.subaccounts : false,
            },
            ...(protocol === "euler"
                ? {
                      required: ["subaccounts"],
                      // With N markets, at most floor(48 / N) accounts fit the collector.
                      allOf: Array.from({ length: 47 }, (_, index) => {
                          const markets = index + 2;

                          return {
                              if: {
                                  properties: { ids: { type: "array", minItems: markets } },
                              },
                              then: {
                                  properties: {
                                      subaccounts: {
                                          type: "array",
                                          maxItems: Math.floor(48 / markets),
                                      },
                                  },
                              },
                          };
                      }),
                  }
                : {}),
        },
    }));

    return {
        ...schema,
        properties: {
            chains: {
                ...schema.properties.chains,
                items: {
                    ...scope,
                    properties: {
                        ...scope.properties,
                        protocols: {
                            ...scope.properties.protocols,
                            items: {
                                ...entry,
                                properties: {
                                    ...entry.properties,
                                    protocol: {
                                        ...entry.properties.protocol,
                                        enum: Object.keys(protocols),
                                    },
                                },
                                allOf: idRules,
                            },
                        },
                    },
                    allOf: [...Object.entries(tokensByChain), [undefined, {}] as const].map(
                        ([chainId, addresses]) => ({
                            if: {
                                properties: {
                                    chainId: chainId
                                        ? { const: Number(chainId) }
                                        : { not: { enum: Object.keys(tokensByChain).map(Number) } },
                                },
                            },
                            then: {
                                properties: {
                                    protocols: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            if: { properties: { protocol: { const: "tokens" } } },
                                            then: {
                                                properties: {
                                                    ids: {
                                                        type: "array",
                                                        items: chainId
                                                            ? {
                                                                  type: "string",
                                                                  pattern: `^0x(?:${Object.values(
                                                                      addresses,
                                                                  )
                                                                      .map((address) =>
                                                                          address
                                                                              .slice(2)
                                                                              .replace(
                                                                                  /[a-f]/g,
                                                                                  (character) =>
                                                                                      `[${character}${character.toUpperCase()}]`,
                                                                              ),
                                                                      )
                                                                      .join("|")})$`,
                                                              }
                                                            : false,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        }),
                    ),
                },
            },
        },
    };
}
