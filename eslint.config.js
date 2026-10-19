import symbiotic from "@symbiotic/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(globalIgnores(["dist/", "package-lock.json"]), symbiotic, {
    files: ["**/*.ts", "**/*.js", "**/*.json"],
});
