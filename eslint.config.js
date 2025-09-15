import symbiotic from "@symbiotic/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(globalIgnores(["dist/"]), symbiotic, {
    files: ["**/*.ts", "**/*.js", "**/*.json"],
});
