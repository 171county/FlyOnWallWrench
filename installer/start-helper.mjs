#!/usr/bin/env node
// FOTW² helper launcher. Builds (if needed) and starts the local loopback
// bridge so the Rack can reach your wrenches. No secrets handled here.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const helperEntry = join(root, "packages", "helper", "dist", "index.js");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...opts });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
    p.on("error", reject);
  });
}

if (!existsSync(helperEntry)) {
  console.log("Building the helper (first run)…");
  await run("pnpm", ["--filter", "@fotw/helper", "build"]);
}
console.log("Starting FOTW² helper…\n");
await run("node", [helperEntry]);
