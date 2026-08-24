import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs/promises";
// @ts-expect-error - no types available
import { parse } from "json-source-map";

import * as github from "./github";
import * as messages from "./messages";
import { getSchema } from "./schemas";
import { Entity } from "./validate-fs";

type JsonSourceMap = Record<
    string,
    {
        value?: {
            line: number;
        };
    }
>;

const normalizeErrors = (error: ErrorObject, lineMap: JsonSourceMap) => {
    const { instancePath, message, params } = error;
    const allowedValues = params?.allowedValues ? `: ${params.allowedValues.join(", ")}` : "";
    const line = lineMap[instancePath]?.value?.line ?? 0;
    const capMessage = message ? message.charAt(0).toUpperCase() + message.slice(1) : "Invalid value";

    return {
        line: line + 1,
        message: `${capMessage}${allowedValues}`,
    };
};

export async function validateMetadata({ entityType, metadata: metadataPath }: Entity) {
    if (!metadataPath) {
        return;
    }

    const schema = getSchema(entityType);
    let metadataContent: string;

    try {
        metadataContent = await fs.readFile(metadataPath, "utf8");
    } catch (error) {
        await github.addComment(messages.unreadableInfoJson(metadataPath));

        throw new Error("The `info.json` file could not be read", { cause: error });
    }

    let metadata: unknown;
    let lineMap: JsonSourceMap;

    try {
        const parsed = parse(metadataContent) as {
            data: unknown;
            pointers: JsonSourceMap;
        };
        metadata = parsed.data;
        lineMap = parsed.pointers;
    } catch (error) {
        await github.addComment(messages.invalidInfoJson());

        throw new Error("The `info.json` file contains invalid JSON", { cause: error });
    }

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    const valid = ajv.validate(schema, metadata);
    if (valid) {
        return;
    }

    const errors =
        ajv.errors?.map((error: ErrorObject) => normalizeErrors(error, lineMap)).filter(Boolean) ||
        [];

    if (errors.length) {
        await github.addReview({
            body: messages.invalidInfoJson(),
            comments: errors.map(({ message, line }: { message: string; line: number }) => ({
                line,
                path: metadataPath,
                body: message,
            })),
        });
    }

    throw new Error("The `info.json` file is invalid");
}
