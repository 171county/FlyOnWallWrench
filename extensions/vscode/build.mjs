import { build } from "esbuild";

// Bundle the extension host into a single CJS file with the Help Me brain
// (@help-me-comms/core + adapters) inlined. 'vscode' is provided at runtime.
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: "dist/extension.js",
  external: ["vscode"],
  logLevel: "info",
});
