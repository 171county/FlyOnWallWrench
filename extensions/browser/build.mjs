import { build } from "esbuild";

// Bundle each extension entry point. Bundling lets the side panel import the
// Help Me brain (@help-me-comms/core + adapters) directly — no localhost server.
await build({
  entryPoints: ["src/sidepanel.ts", "src/popup.ts", "src/background.ts", "src/contentScript.ts"],
  bundle: true,
  format: "esm",
  target: "es2022",
  outdir: "dist",
  logLevel: "info",
});
