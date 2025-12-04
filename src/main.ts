import { getInput, run as runAction } from "./scripts/github";
import { validateCollateral } from "./scripts/validate-collateral";
import { validateEntity } from "./scripts/validate-entity";
import { validateFs } from "./scripts/validate-fs.js";
import { validateLogo } from "./scripts/validate-logo.js";
import { validateMetadata } from "./scripts/validate-metadata.js";
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
        validateMetadata(entity),
        validateLogo(entity),
        validateCollateral(entity),
        validateRewards(entity),
    ]);

    const errors = result
        .map((r) => r && r.status === "rejected" && r.reason.message)
        .filter(Boolean);

    if (errors.length) {
        throw new Error(`Validation failed:\n${errors.map((e) => `- ${e}`).join("\n")}`);
    }
};

export const run = () => runAction(main);
