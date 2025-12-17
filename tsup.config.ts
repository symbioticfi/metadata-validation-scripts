import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    noExternal: [/.*/], // Bundle all dependencies
    target: "node24",
    clean: true,
    minify: true,
    treeshake: true,
    splitting: false,
});
