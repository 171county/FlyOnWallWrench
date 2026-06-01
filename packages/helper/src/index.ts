#!/usr/bin/env node
// FOTW² local helper entrypoint. Starts the loopback bridge and prints the
// token the extension needs. Token can be pinned via FOTW_HELPER_TOKEN so the
// installer can wire it once.
import { createHelper } from "./server.js";

const port = Number(process.env.FOTW_HELPER_PORT ?? 7717);
const token = process.env.FOTW_HELPER_TOKEN || undefined;

const helper = createHelper({ port, token });
helper.listen().then(({ port, token }) => {
  // eslint-disable-next-line no-console
  console.log(`FOTW² helper listening on http://127.0.0.1:${port}`);
  console.log(`token: ${token}`);
  console.log(`paste this token into FOTW² → Settings → Local helper to connect the Rack to your wrenches.`);
});
