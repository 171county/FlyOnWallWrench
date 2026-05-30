import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

export type DiscordReadConfig = {
  botToken: string;            // provided by the user; never stored by the MCP
  approvedChannelIds: string[]; // only these channels are ever read
  apiBase?: string;            // default: https://discord.com/api/v10
};

type RawMessage = {
  id: string;
  content: string;
  timestamp: string;
  author?: { username?: string; bot?: boolean };
};

const API = "https://discord.com/api/v10";

// Read-only Discord adapter. Reads ONLY the approved channels, returns
// normalized + redaction-flagged evidence, and never writes (write disabled).
// Public posting, if ever added, must route through the approval-safe action
// path — not this adapter.
export class DiscordReadAdapter implements CommsSourceAdapter {
  kind = "discord" as const;
  capabilities: SourceCapabilities;
  private cfg: DiscordReadConfig;

  constructor(cfg: DiscordReadConfig) {
    this.cfg = { apiBase: API, ...cfg };
    this.capabilities = {
      source: "discord",
      read: true,
      write: "disabled", // read-only by design; approvals live in the client layer
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: true,
      supportsUserOwnedRetention: false,
      approvedSpaces: cfg.approvedChannelIds,
    };
  }

  private headers() {
    return { authorization: `Bot ${this.cfg.botToken}`, "user-agent": "HelpMeCommsBot (flyonwallwrench, 0.1)" };
  }

  private async fetchChannel(channelId: string, limit: number): Promise<RawMessage[]> {
    const res = await fetch(`${this.cfg.apiBase}/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Discord read failed (${res.status}) for channel ${channelId}`);
    return (await res.json()) as RawMessage[];
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const perChannel = Math.max(20, request.maxEvidence ?? 10);
    const all: EvidenceItem[] = [];

    for (const channelId of this.cfg.approvedChannelIds) {
      let messages: RawMessage[] = [];
      try {
        messages = await this.fetchChannel(channelId, perChannel);
      } catch {
        continue; // skip a channel we can't read rather than failing the whole search
      }
      for (const m of messages) {
        if (m.author?.bot) continue;
        const body = (m.content ?? "").trim();
        if (!body) continue;
        const lower = body.toLowerCase();
        const matched = terms.filter((t) => lower.includes(t));
        if (terms.length && matched.length === 0) continue;

        const ageDays = (Date.now() - Date.parse(m.timestamp)) / 86_400_000;
        all.push({
          id: `discord_${m.id}`,
          source: "discord",
          title: `#${channelId}`,
          summary: body.slice(0, 280),
          createdAt: m.timestamp,
          matchedTerms: matched,
          confidenceSignals: {
            semanticMatch: Math.min(1, matched.length / Math.max(1, terms.length)),
            exactTermMatch: matched.length ? 0.7 : 0.3,
            recency: Math.max(0, 1 - ageDays / 14),
            sourceTrust: 0.7,
            confirmationCount: 0, // correlation is computed across items by the ranker/UI
            sameVersionBonus: 0,
            resolvedBonus: 0,
            duplicatePenalty: 0,
            lowQualityPenalty: body.length < 12 ? 0.2 : 0,
          },
          redacted: true, // bodies are treated as untrusted, ephemeral evidence
        });
      }
    }
    return all.slice(0, request.maxEvidence ?? 10);
  }

  async getThread(ref: SourceRef, _context: WorkspaceContext): Promise<ThreadContext> {
    const channelId = ref.externalId;
    if (!this.cfg.approvedChannelIds.includes(channelId)) {
      return { ref, title: "Channel not approved", items: [], redacted: true };
    }
    const messages = await this.fetchChannel(channelId, 50);
    return {
      ref,
      title: `#${channelId}`,
      redacted: true,
      items: messages
        .filter((m) => !m.author?.bot && (m.content ?? "").trim())
        .map((m) => ({
          id: `discord_${m.id}`,
          source: "discord" as const,
          threadId: channelId,
          authorRef: "redacted_author",
          authorRole: "unknown" as const,
          body: m.content,
          createdAt: m.timestamp,
          visibility: "approved_channel" as const,
          permissions: { canQuote: true, canReply: false, canSummarize: true },
        })),
    };
  }
}

// Build from environment when credentials exist; otherwise return null so the
// caller falls back to the safe mock adapter. Token/IDs are read at call time
// and never persisted by this package.
export function discordReadFromEnv(env: Record<string, string | undefined>): DiscordReadAdapter | null {
  const botToken = env.HELP_ME_DISCORD_BOT_TOKEN?.trim();
  const ids = (env.HELP_ME_DISCORD_CHANNEL_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!botToken || ids.length === 0) return null;
  return new DiscordReadAdapter({ botToken, approvedChannelIds: ids });
}
