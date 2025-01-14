import { validateMetadata } from "./scripts/validate-metadata.js";
import { run as validateLogo } from "./scripts/validate-logo.js";
import { validateFs } from "./scripts/validate-fs.js";

export async function run(): Promise<void> {
  const script = process.argv[2];

  switch (script) {
    case "validate-metadata":
      await validateMetadata(process.argv[3]);
      break;
    case "validate-logo":
      await validateLogo(process.argv[3]);
      break;
    case "validate-fs":
      await validateFs(process.argv.slice(3));
      break;
    default:
      console.error("Unknown script:", script);
      process.exit(1);
  }
}
