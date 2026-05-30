const SECRET_PATTERNS: RegExp[] = [
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^\s'"`]+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /\b[A-Za-z0-9_\-]{32,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
];

export function redactSensitiveText(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED_SECRET]");
  }
  return output;
}

export function shouldRejectFilePath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".env") ||
    lower.includes("/.env") ||
    lower.includes("\\.env") ||
    lower.includes("secret") ||
    lower.includes("credential") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  );
}

export function privacyNotice(retention: "ephemeral" | "user_owned"): string {
  return retention === "ephemeral"
    ? "Scoped evidence was used for this task and should be discarded by MCP-owned storage after the response."
    : "Workspace is configured for user-owned retention; MCP-owned storage should still avoid sensitive bodies.";
}
