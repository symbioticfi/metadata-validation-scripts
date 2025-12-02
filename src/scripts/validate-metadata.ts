import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs/promises";
// @ts-expect-error - no types available
import { parse } from "json-source-map";
import * as path from "path";
import { fileURLToPath } from "url";

import * as github from "./github";
import * as messages from "./messages";
import { Entity } from "./validate-fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultSchemaFile = "info.json";
const schemasDir = path.join(__dirname, "schemas");
const readSchema = async (entityType: Entity["entityType"]) => {
    const schemaFiles = await fs.readdir(schemasDir);
    const schema = schemaFiles.includes(`${entityType}.json`)
        ? `${entityType}.json`
        : defaultSchemaFile;

    const schemaContent = await fs.readFile(path.join(schemasDir, schema), "utf8");

    return JSON.parse(schemaContent);
};

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

export async function validateMetadata({ entityType, metadata: metadataPath }: Entity) {
    if (!metadataPath) {
        return;
    }

    const schema = await readSchema(entityType);
    const metadataContent = await fs.readFile(metadataPath, "utf8");
    const { data: metadata, pointers: lineMap } = parse(metadataContent);

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    ajv.validate(schema, metadata);

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
