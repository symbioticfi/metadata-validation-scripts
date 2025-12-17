import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    noExternal: [/.*/], // Bundle all dependencies
    target: "node24",
    clean: true,
    minify: true,
    treeshake: true,
    splitting: false,
});
