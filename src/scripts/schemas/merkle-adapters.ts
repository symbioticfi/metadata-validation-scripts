import protocols from "../config/merkle-protocols.json";
import tokens from "../config/merkle-tokens.json";
import schema from "./merkle-adapters.json";

const entry = schema.properties.protocols.items;
const tokensByChain: Record<string, Record<string, string>> = tokens;
// Decimal strings avoid JSON number precision loss for native account IDs.
const maxUint256 = (2n ** 256n - 1n).toString();
const boundedDecimal = maxUint256.split("").flatMap((digit, index) => {
    const minimum = index === 0 ? 1 : 0;

    return Number(digit) > minimum
        ? [
              `${maxUint256.slice(0, index)}[${minimum}-${Number(digit) - 1}][0-9]{${maxUint256.length - index - 1}}`,
          ]
        : [];
});
const uint256Pattern = `^(?:0|[1-9][0-9]{0,76}|${[...boundedDecimal, maxUint256].join("|")})$`;

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
                          ...("maxIds" in rule ? { maxItems: rule.maxIds } : {}),
                          ...("allowedIds" in rule ? { maxItems: rule.allowedIds.length } : {}),
                          items:
                              protocol === "tokens"
                                  ? tokenSchema
                                  : "allowedIds" in rule
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
                                                  : "^0x(?!0{40}$)[a-fA-F0-9]{40}$",
                                      },
                      }
                    : { type: "array", maxItems: 0 },
                subaccounts: protocol === "euler" ? entry.properties.subaccounts : false,
                accountNumbers:
                    protocol === "dolomite"
                        ? {
                              ...entry.properties.accountNumbers,
                              items: { type: "string", pattern: uint256Pattern },
                          }
                        : false,
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
                : protocol === "dolomite"
                  ? { required: ["accountNumbers"] }
                  : {}),
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
