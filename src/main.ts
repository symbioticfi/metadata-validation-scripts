import { run as runAction, getInput } from "./scripts/github";

import { validateMetadata } from "./scripts/validate-metadata.js";
import { validateLogo } from "./scripts/validate-logo.js";
import { validateFs } from "./scripts/validate-fs.js";
import { validateEntity } from "./scripts/validate-entity";

const main = async () => {
  const inputFiles = getInput("files", {
    required: true,
    trimWhitespace: true,
  });

  const files = inputFiles.split(" ").filter(Boolean);
  const result = await validateFs(files);

  await validateEntity(result);

  if (result.metadata) {
    await validateMetadata(result.metadata);
  }

  if (result.logo) {
    await validateLogo(result.logo);
  }
};

export const run = () => runAction(main);
