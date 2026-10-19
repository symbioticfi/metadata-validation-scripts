import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs/promises";
// @ts-expect-error - no types available
import { parse } from "json-source-map";

import * as github from "./github";
import * as messages from "./messages";
import { getSchema } from "./schemas";
import { Entity } from "./validate-fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeErrors = (error: ErrorObject, lineMap: any) => {
    const { instancePath, message, params } = error;
    const propertyName = error.propertyName ?? params.propertyName ?? params.additionalProperty;
    const allowedValues = params?.allowedValues ? `: ${params.allowedValues.join(", ")}` : "";
    const propertyPath =
        typeof propertyName === "string"
            ? `${instancePath}/${propertyName.replace(/~/g, "~0").replace(/\//g, "~1")}`
            : undefined;
    const line =
        (propertyPath ? lineMap[propertyPath]?.key?.line : undefined) ??
        lineMap[instancePath]?.value?.line ??
        0;
    const capMessage = message && message.charAt(0).toUpperCase() + message.slice(1);

    return {
        line: line + 1,
        message: `${capMessage}${allowedValues}`,
    };
};

export async function validateMetadata({ entityType, metadata: metadataPath }: Entity) {
    if (!metadataPath) {
        return;
    }

    const schema = getSchema(
        entityType,
        entityType === "merkle-adapters"
            ? +github.getInput("chain-id", { required: true })
            : undefined,
    );
    const metadataContent = await fs.readFile(metadataPath, "utf8");
    let parsed: ReturnType<typeof parse>;

    try {
        parsed = parse(metadataContent);
    } catch {
        await github.addComment(messages.invalidInfoJson());

        throw new Error("The `info.json` file is not valid JSON");
    }

    const { data: metadata, pointers: lineMap } = parsed;

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    const schemaValid = ajv.validate(schema, metadata);
    const validationErrors: ErrorObject[] = [...(ajv.errors ?? [])];

    if (schemaValid && entityType === "merkle-adapters") {
        const { protocols } = metadata as { protocols: { protocol: string; ids: string[] }[] };
        const seenProtocols = new Set<string>();
        for (const [index, entry] of protocols.entries()) {
            if (seenProtocols.has(entry.protocol)) {
                validationErrors.push({
                    keyword: "uniqueProtocol",
                    instancePath: `/protocols/${index}/protocol`,
                    schemaPath: "",
                    params: {},
                    message: "must not repeat a portfolio protocol",
                });
            }

            seenProtocols.add(entry.protocol);

            if (["aave_v4", "euler", "morpho_blue", "morpho_vaultv2"].includes(entry.protocol)) {
                const seenIds = new Set<string>();
                for (const [idIndex, id] of entry.ids.entries()) {
                    const normalized = id.toLowerCase();
                    if (seenIds.has(normalized)) {
                        validationErrors.push({
                            keyword: "uniqueMarketId",
                            instancePath: `/protocols/${index}/ids/${idIndex}`,
                            schemaPath: "",
                            params: {},
                            message: "must not repeat a market identifier ignoring hex case",
                        });
                    }

                    seenIds.add(normalized);
                }
            }
        }
    }

    const errors = validationErrors.map((error) => normalizeErrors(error, lineMap));

    if (errors.length) {
        await github.addReview({
            body: messages.invalidInfoJson(),
            comments: errors.map(({ message, line }: { message: string; line: number }) => ({
                line,
                path: metadataPath,
                body: message,
            })),
        });

        throw new Error("The `info.json` file is invalid");
    }
}
