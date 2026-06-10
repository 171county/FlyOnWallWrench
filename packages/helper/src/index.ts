#!/usr/bin/env node
// FOTW² local helper entrypoint. Starts the loopback bridge and prints the
// token the extension needs. Token can be pinned via FOTW_HELPER_TOKEN so the
// installer can wire it once. Real wrenches are configured via a JSON file
// ($FOTW_HELPER_WRENCHES or ~/.fotw/wrenches.json); everything else stays in
// demo mode. See configs/examples/helper.wrenches.json.
import { createHelper } from "./server.js";
import { loadRegistry } from "./wrenchRegistry.js";

const port = Number(process.env.FOTW_HELPER_PORT ?? 7717);
const token = process.env.FOTW_HELPER_TOKEN || undefined;

const { registry, configPath, configError } = loadRegistry();
const helper = createHelper({ port, token, registry });
helper.listen().then(({ port, token }) => {
  /* eslint-disable no-console */
  console.log(`FOTW² helper listening on http://127.0.0.1:${port}`);
  console.log(`token: ${token}`);
  if (configError) {
    console.log(`⚠ wrench config at ${configPath} could not be parsed (${configError}) — all wrenches in demo mode.`);
  } else if (configPath) {
    const live = registry.filter((e) => e.mode === "mcp").map((e) => e.id);
    console.log(
      live.length
        ? `wrenches live via ${configPath}: ${live.join(", ")} (others demo)`
        : `wrench config loaded from ${configPath} — no mcp entries yet, all demo.`,
    );
  } else {
    console.log("no wrench config found — all wrenches in demo mode. To go live, create ~/.fotw/wrenches.json (see configs/examples/helper.wrenches.json).");
  }
  console.log("paste the token into FOTW² → Settings → Local helper to connect the Rack to your wrenches.");
});
