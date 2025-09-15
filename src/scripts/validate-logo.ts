import * as fs from "fs/promises";
import { read } from "image-js";
import * as path from "path";

import * as github from "./github";
import * as messages from "./messages";

export async function validateLogo(logoPath: string) {
    const errors: string[] = [];
    const { size } = await fs.stat(logoPath);

    if (size > 1024 * 1024) {
        errors.push("The image is too large. The maximum size is 1MB");
    }

    if (path.extname(logoPath) !== ".png") {
        errors.push("The image format should be PNG");
    } else {
        const image = await read(logoPath);

        // if (!image.alpha) {
        //   errors.push("The image background should be transparent");
        // }

        if (image.width != 256 || image.height != 256) {
            errors.push(
                `The image size must be 256x256 pixels. Current size is ${image.width}x${image.height}.`,
            );
        }
    }

    if (errors.length) {
        await github.addComment(messages.invalidLogo(logoPath, errors));

        throw new Error("The logo is invalid");
    }
}
