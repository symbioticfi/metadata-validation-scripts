import protocols from "../config/merkle-protocols.json";
import schema from "./merkle-adapters.json";

const entry = schema.properties.protocols.items;

/** Compile the allowlist into the bundled schema, without runtime config file reads. */
const addressRules = Object.entries(protocols).map(([protocol, rule]) => ({
    if: { type: "object", properties: { protocol: { const: protocol } }, required: ["protocol"] },
    then: {
        type: "object",
        properties: {
            addresses: rule.requiresAddresses
                ? {
                      type: "array",
                      minItems: 1,
                      items: {
                          type: "string",
                          pattern:
                              rule.addressType === "bytes32"
                                  ? "^0x[a-fA-F0-9]{64}$"
                                  : "^0x[a-fA-F0-9]{40}$",
                      },
                  }
                : { type: "array", maxItems: 0 },
        },
    },
}));

export default {
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
                allOf: addressRules,
            },
        },
    },
};
