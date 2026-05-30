import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

export type RedditReadConfig = {
  clientId: string;        // Reddit "script" app client id
  clientSecret: string;    // app secret
  subreddits: string[];    // configured communities to read
  userAgent?: string;
};

type RedditPost = {
  data: { id: string; title: string; selftext?: string; created_utc: number; ups?: number; num_comments?: number; permalink?: string };
};

// Read-only Reddit adapter. Uses app-only OAuth (client credentials) to read
// the configured subreddits. Returns normalized, redaction-flagged evidence;
// write is disabled. Public posting must route through the approval-safe path.
export class RedditReadAdapter implements CommsSourceAdapter {
  kind = "reddit" as const;
  capabilities: SourceCapabilities;
  private cfg: RedditReadConfig;
  private token: { value: string; expires: number } | null = null;

  constructor(cfg: RedditReadConfig) {
    this.cfg = { userAgent: "HelpMeComms/0.1", ...cfg };
    this.capabilities = {
      source: "reddit",
      read: true,
      write: "disabled",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      approvedSpaces: cfg.subreddits,
    };
  }

  private async auth(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded", "user-agent": this.cfg.userAgent! },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Reddit auth failed (${res.status})`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    return this.token.value;
  }

  private async searchSub(subreddit: string, query: string, limit: number): Promise<RedditPost[]> {
    const token = await this.auth();
    const q = encodeURIComponent(query);
    const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${q}&restrict_sr=1&sort=new&limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, "user-agent": this.cfg.userAgent! } });
    if (!res.ok) throw new Error(`Reddit read failed (${res.status}) for r/${subreddit}`);
    const data = (await res.json()) as { data?: { children?: RedditPost[] } };
    return data.data?.children ?? [];
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const all: EvidenceItem[] = [];
    for (const sub of this.cfg.subreddits) {
      let posts: RedditPost[] = [];
      try { posts = await this.searchSub(sub, request.query, Math.max(20, request.maxEvidence ?? 10)); } catch { continue; }
      for (const p of posts) {
        const d = p.data;
        const body = `${d.title} ${d.selftext ?? ""}`.trim();
        if (!body) continue;
        const lower = body.toLowerCase();
        const matched = terms.filter((t) => lower.includes(t));
        const ageDays = (Date.now() / 1000 - d.created_utc) / 86_400;
        all.push({
          id: `reddit_${d.id}`,
          source: "reddit",
          title: d.title.slice(0, 120),
          summary: body.slice(0, 280),
          sourceUrl: d.permalink ? `https://reddit.com${d.permalink}` : undefined,
          createdAt: new Date(d.created_utc * 1000).toISOString(),
          matchedTerms: matched,
          confidenceSignals: {
            semanticMatch: Math.min(1, matched.length / Math.max(1, terms.length)),
            exactTermMatch: matched.length ? 0.7 : 0.4,
            recency: Math.max(0, 1 - ageDays / 30),
            sourceTrust: 0.65,
            confirmationCount: d.ups ?? 0,
            sameVersionBonus: 0,
            resolvedBonus: /solved|fixed/i.test(body) ? 0.1 : 0,
            duplicatePenalty: 0,
            lowQualityPenalty: body.length < 12 ? 0.2 : 0,
          },
          redacted: true,
        });
      }
    }
    return all.slice(0, request.maxEvidence ?? 10);
  }

  async getThread(ref: SourceRef, _context: WorkspaceContext): Promise<ThreadContext> {
    // ref.externalId = subreddit; return recent matching posts as items.
    const posts = await this.searchSub(ref.externalId, "", 25).catch(() => []);
    return {
      ref,
      title: `r/${ref.externalId}`,
      redacted: true,
      items: posts.map((p) => ({
        id: `reddit_${p.data.id}`,
        source: "reddit" as const,
        authorRef: "redacted_author",
        authorRole: "unknown" as const,
        body: `${p.data.title} ${p.data.selftext ?? ""}`.trim(),
        createdAt: new Date(p.data.created_utc * 1000).toISOString(),
        url: p.data.permalink ? `https://reddit.com${p.data.permalink}` : undefined,
        visibility: "public" as const,
        permissions: { canQuote: true, canReply: false, canSummarize: true },
      })),
    };
  }
}

export function redditReadFromEnv(env: Record<string, string | undefined>): RedditReadAdapter | null {
  const clientId = env.HELP_ME_REDDIT_CLIENT_ID?.trim();
  const clientSecret = env.HELP_ME_REDDIT_CLIENT_SECRET?.trim();
  const subreddits = (env.HELP_ME_REDDIT_SUBREDDITS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!clientId || !clientSecret || subreddits.length === 0) return null;
  return new RedditReadAdapter({ clientId, clientSecret, subreddits });
}
