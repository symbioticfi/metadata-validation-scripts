import { validateMetadata } from "./scripts/validate-metadata.js";
import { run as validateLogo } from "./scripts/validate-logo.js";
import { validateFs } from "./scripts/validate-fs.js";

export async function run(): Promise<void> {
  const files = process.argv.slice(2);

  console.log("Validating files:", files);

  const result = await validateFs(files);

  if (result.metadata) {
    await validateMetadata(result.metadata);
  }

  if (result.logo) {
    await validateLogo(result.logo);
  }
}
