import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    noExternal: [/.*/], // Bundle all dependencies
    target: "node24",
    clean: true,
    minify: true,
    treeshake: true,
    outExtension: () => ({
        js: ".js", // Output as .js instead of .cjs for GitHub Actions compatibility
    }),
});
