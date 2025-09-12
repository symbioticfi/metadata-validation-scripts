import fs from "fs";
import path from "path";

import * as github from "./github";
import * as messages from "./messages";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const allowedTypes = ["vaults", "operators", "networks", "tokens"] as const;
const allowedFiles = ["info.json", "logo.png"];

export type EntityType = (typeof allowedTypes)[number];
export type FsValidationResult = {
    metadata?: string;
    logo?: string;
    isDeleted?: boolean;
    entityId: string;
    entityType: EntityType;
};

const isValidEntity = (entityType: string): entityType is EntityType =>
    allowedTypes.includes(entityType as EntityType);

export async function validateFs(changedFiles: string[]): Promise<FsValidationResult> {
    const notAllowed = new Set<string>();
    const entityDirs = new Set<string>();

    for (const filePath of changedFiles) {
        const dir = path.dirname(filePath);
        const [type, address, fileName] = filePath.split(path.sep);

        const isValid =
            isValidEntity(type) && addressRegex.test(address) && allowedFiles.includes(fileName);

        if (isValid) {
            entityDirs.add(dir);
        } else {
            notAllowed.add(filePath);
        }
    }

    /**
     * Validate that there are only allowed changes
     */
    if (notAllowed.size) {
        await github.addComment(messages.notAllowedChanges([...notAllowed]));

        throw new Error(
            `The pull request includes changes outside the allowed directories:\n ${[
                ...notAllowed,
            ].join(", ")}`,
        );
    }

    /**
     * Validate that only one entity is changed per pull request
     */
    if (entityDirs.size > 1) {
        await github.addComment(messages.onlyOneEntityPerPr([...entityDirs]));

        throw new Error("Several entities are changed in one pull request");
    }

    const [entityDir] = entityDirs;
    const entityType = path.basename(path.dirname(entityDir)) as EntityType;
    const entityId = path.basename(entityDir);

    const existingFiles: string[] = await fs.promises.readdir(entityDir).catch(() => []);

    const entityDirExists = existingFiles.length > 0;
    const [metadataPath, logoPath] = allowedFiles.map((name) => {
        return existingFiles.includes(name) ? path.join(entityDir, name) : undefined;
    });

    const [isMetadataChanged, isLogoChanged] = allowedFiles.map((name) => {
        return changedFiles.some((file) => path.basename(file) === name);
    });

    /**
     * Validate that metadata present in the entity folder.
     */
    if (entityDirExists && !metadataPath) {
        await github.addComment(messages.noInfoJson(entityDir));

        throw new Error("`info.json` is not found in the entity folder");
    }

    const result: FsValidationResult = {
        entityId,
        entityType,
        isDeleted: !entityDirExists,
    };

    /**
     * Add metadata to result only if the file was changed and exists.
     */
    if (isMetadataChanged && metadataPath) {
        result.metadata = metadataPath;
    }

    /**
     * Add logo to result only if the file was changed and exists.
     */
    if (isLogoChanged && logoPath) {
        result.logo = logoPath;
    }

    return result;
}
