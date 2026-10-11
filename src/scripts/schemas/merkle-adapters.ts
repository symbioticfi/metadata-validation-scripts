import protocols from "../config/merkle-protocols.json";
import tokens from "../config/merkle-tokens.json";
import schema from "./merkle-adapters.json";

const entry = schema.properties.protocols.items;
const tokensByChain: Record<string, Record<string, string>> = tokens;

/** Compile the allowlist into the bundled schema, without runtime config file reads. */
export default function getMerkleAdapterSchema(chainId?: number) {
    const tokenAddresses = Object.values(tokensByChain[String(chainId)] ?? {});
    const tokenSchema = tokenAddresses.length
        ? {
              type: "string",
              pattern: `^0x(?:${tokenAddresses
                  .map((address) =>
                      address
                          .slice(2)
                          .replace(
                              /[a-f]/g,
                              (character) => `[${character}${character.toUpperCase()}]`,
                          ),
                  )
                  .join("|")})$`,
          }
        : false;

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
                          items:
                              protocol === "tokens"
                                  ? tokenSchema
                                  : {
                                        type: "string",
                                        pattern:
                                            rule.idType === "bytes32"
                                                ? "^0x[a-fA-F0-9]{64}$"
                                                : "^0x[a-fA-F0-9]{40}$",
                                    },
                      }
                    : { type: "array", maxItems: 0 },
            },
        },
    }));

    return {
        ...schema,
        properties: {
            protocols: {
                ...schema.properties.protocols,
                items: {
                    ...entry,
                    properties: {
                        ...entry.properties,
                        protocol: { ...entry.properties.protocol, enum: Object.keys(protocols) },
                    },
                    allOf: idRules,
                },
            },
        },
    };
}
