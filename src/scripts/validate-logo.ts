import { Image } from "image-js";
import * as path from "path";
import * as fs from "fs/promises";

import * as github from "./github.js";
import * as messages from "./messages.js";

export async function run(logoPath: string) {
  const errors: string[] = [];
  const { size } = await fs.stat(logoPath);

  if (size > 1024 * 1024) {
    errors.push("The image is too large. The maximum size is 1MB");
  }

  if (path.extname(logoPath) !== ".png") {
    errors.push("The image format should be PNG");
  } else {
    const image = await Image.load(logoPath);

    // if (!image.alpha) {
    //   errors.push("The image background should be transparent");
    // }

    if (image.width != 256 || image.height != 256) {
      errors.push("The image size must be 256x256 pixels");
    }
  }

  if (errors.length) {
    await github.addComment(messages.invalidLogo(logoPath, errors));

    throw new Error("The logo is invalid");
  }
}
