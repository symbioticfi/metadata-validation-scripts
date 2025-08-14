import { run as runAction, getInput } from "./scripts/github";

import { validateMetadata } from "./scripts/validate-metadata.js";
import { validateLogo } from "./scripts/validate-logo.js";
import { validateFs } from "./scripts/validate-fs.js";
import { validateEntity } from "./scripts/validate-entity";
import { validateCollateral } from "./scripts/validate-collateral";
import { validateRewards } from "./scripts/validate-rewards";

const main = async () => {
  const inputFiles = getInput("files", {
    required: true,
    trimWhitespace: true,
  });

  const files = inputFiles.split(" ").filter(Boolean);
  const entity = await validateFs(files);

  /**
   * Skip the rest of the validation if the entity is deleted
   */
  if (entity.isDeleted) {
    return;
  }

  const result = await Promise.allSettled([
    validateEntity(entity),
    entity.metadata && validateMetadata(entity.metadata),
    entity.logo && validateLogo(entity.logo),
    entity.entityType === "vaults" && validateCollateral(entity.entityId),
    entity.entityType === "vaults" &&
      entity.metadata &&
      validateRewards(entity.metadata, entity.entityId),
  ]);

  const errors = result
    .map((r) => r && r.status === "rejected" && r.reason.message)
    .filter(Boolean);

  if (errors.length) {
    throw new Error(
      `Validation failed:\n${errors.map((e) => `- ${e}`).join("\n")}`,
    );
  }
};

export const run = () => runAction(main);
