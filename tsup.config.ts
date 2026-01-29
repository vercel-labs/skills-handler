import { defineConfig } from "tsup";

export default defineConfig([
  // Main library
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    shims: true,
  },
  // CLI
  {
    entry: { cli: "src/cli/index.ts" },
    outDir: "dist/cli",
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
