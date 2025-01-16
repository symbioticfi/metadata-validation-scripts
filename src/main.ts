import { run as runAction } from "./scripts/github";

import { validateMetadata } from "./scripts/validate-metadata.js";
import { run as validateLogo } from "./scripts/validate-logo.js";
import { validateFs } from "./scripts/validate-fs.js";
import { getInput } from "@actions/core";

const main = async () => {
  const inputFiles = getInput("files", {
    required: true,
    trimWhitespace: true,
  });

  const files = inputFiles.split(" ").filter(Boolean);
  const result = await validateFs(files);

  if (result.metadata) {
    await validateMetadata(result.metadata);
  }

  if (result.logo) {
    await validateLogo(result.logo);
  }
};

export const run = () => runAction(main);
