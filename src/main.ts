import { validateMetadata } from "./scripts/validate-metadata";
import { run as validateLogo } from "./scripts/validate-logo";
import { validateFs } from "./scripts/validate-fs";

export async function run(): Promise<void> {
  const files = process.argv.slice(2);
  const result = await validateFs(files);
  
  if (result.metadata) {
    await validateMetadata(result.metadata);
  }
  
  if (result.logo) {
    await validateLogo(result.logo);
  }
}
