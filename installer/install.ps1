# FOTW² — local setup (Windows PowerShell). Installs deps, builds, starts helper.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Installing dependencies..."; pnpm install
Write-Host "Building..."; pnpm -r build
Write-Host "Starting the FOTW2 helper (Ctrl+C to stop)..."
node packages/helper/dist/index.js
