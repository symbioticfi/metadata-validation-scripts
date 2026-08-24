import * as fs from "fs/promises";
import { read } from "image-js";
import * as path from "path";

import * as github from "./github";
import * as messages from "./messages";
import { Entity } from "./validate-fs";

export async function validateLogo({ logo: logoPath }: Entity) {
    if (!logoPath) {
        return;
    }

    const errors: string[] = [];
    let size: number;

    try {
        ({ size } = await fs.stat(logoPath));
    } catch {
        await github.addComment(messages.invalidLogo(logoPath, ["The image file could not be read"]));

        throw new Error("The logo file could not be read");
    }

    if (size > 1024 * 100) {
        errors.push("The image is too large. The maximum size is 100KB");
    }

    if (path.extname(logoPath) !== ".png") {
        errors.push("The image format should be PNG");
    } else {
        try {
            const image = await read(logoPath);

            if (image.width !== 256 || image.height !== 256) {
                errors.push(
                    `The image size must be 256x256 pixels. Current size is ${image.width}x${image.height}.`,
                );
            }
        } catch {
            errors.push("The image could not be decoded as a valid PNG");
        }
    }

    if (errors.length) {
        await github.addComment(messages.invalidLogo(logoPath, errors));

        throw new Error("The logo is invalid");
    }
}
