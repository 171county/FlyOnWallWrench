import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const denyPatterns = [
  /api[_-]?key\s*[:=]/i,
  /password\s*[:=]/i,
  /refresh[_-]?token\s*[:=]/i,
  /-----BEGIN .*PRIVATE KEY-----/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
];

const ignored = new Set(["node_modules", "dist", ".next", ".git"]);
let failures = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|mjs|json|md|yaml|yml|env|txt)$/.test(name)) check(path);
  }
}

function check(path) {
  const text = readFileSync(path, "utf8");
  for (const pattern of denyPatterns) {
    if (pattern.test(text)) {
      console.error(`Potential sensitive fixture in ${path}: ${pattern}`);
      failures++;
    }
  }
}

walk(root);
if (failures > 0) process.exit(1);
console.log("No obvious sensitive fixtures found.");
