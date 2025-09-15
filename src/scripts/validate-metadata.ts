import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs/promises";
// @ts-expect-error - no types available
import { parse } from "json-source-map";

import * as github from "./github";
import * as messages from "./messages";
import metadataSchema from "./schemas/info.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeErrors = (error: ErrorObject, lineMap: any) => {
    const { instancePath, message, params } = error;
    const allowedValues = params?.allowedValues ? `: ${params.allowedValues.join(", ")}` : "";
    const line = lineMap[instancePath]?.value?.line || 1;
    const capMessage = message && message.charAt(0).toUpperCase() + message.slice(1);

    return {
        line: line + 1,
        message: `${capMessage}${allowedValues}`,
    };
};

export async function validateMetadata(metadataPath: string) {
    const metadataContent = await fs.readFile(metadataPath, "utf8");
    const { data: metadata, pointers: lineMap } = parse(metadataContent);

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    ajv.validate(metadataSchema, metadata);

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

        throw new Error("The `info.json` file is invalid");
    }
}
