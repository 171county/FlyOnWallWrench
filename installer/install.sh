#!/usr/bin/env bash
# FOTW² — local setup (macOS/Linux). Installs deps, builds, starts the helper.
set -e
cd "$(dirname "$0")/.."
echo "▶ Installing dependencies…"; pnpm install
echo "▶ Building…"; pnpm -r build
echo "▶ Starting the FOTW² helper (Ctrl+C to stop)…"
node packages/helper/dist/index.js
