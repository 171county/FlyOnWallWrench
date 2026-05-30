import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

export type GithubReadConfig = {
  token?: string;          // optional PAT (raises rate limit; needed for private repos)
  repos: string[];         // "owner/repo" entries to read issues from
  apiBase?: string;        // default https://api.github.com
};

type GhIssue = {
  number: number;
  title: string;
  body?: string;
  created_at: string;
  comments?: number;
  reactions?: { total_count?: number };
  html_url?: string;
  state?: string;
  pull_request?: unknown;  // present on PRs; we skip those
};

const API = "https://api.github.com";

// Read-only GitHub adapter: treats Issues (and their volume of comments/reactions
// as confirmations) as a community communication surface for open-source mods,
// loaders, and tools. Token is OPTIONAL (public repos work unauthenticated, just
// rate-limited). Write disabled; token never persisted by this package.
export class GithubReadAdapter implements CommsSourceAdapter {
  kind = "github_issues" as const;
  capabilities: SourceCapabilities;
  private cfg: GithubReadConfig;

  constructor(cfg: GithubReadConfig) {
    this.cfg = { apiBase: API, ...cfg };
    this.capabilities = {
      source: "github_issues",
      read: true,
      write: "disabled",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: !!cfg.token,
      supportsUserOwnedRetention: false,
      approvedSpaces: cfg.repos,
    };
  }

  private headers() {
    const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "HelpMeComms/0.1" };
    if (this.cfg.token) h.authorization = `Bearer ${this.cfg.token}`;
    return h;
  }

  private async searchRepo(repo: string, query: string, limit: number): Promise<GhIssue[]> {
    // Use the search API so we get relevance against the query terms.
    const q = encodeURIComponent(`repo:${repo} is:issue ${query}`.trim());
    const url = `${this.cfg.apiBase}/search/issues?q=${q}&sort=updated&order=desc&per_page=${Math.min(limit, 50)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub read failed (${res.status}) for ${repo}`);
    const data = (await res.json()) as { items?: GhIssue[] };
    return data.items ?? [];
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const all: EvidenceItem[] = [];
    for (const repo of this.cfg.repos) {
      let issues: GhIssue[] = [];
      try { issues = await this.searchRepo(repo, request.query, Math.max(20, request.maxEvidence ?? 10)); } catch { continue; }
      for (const it of issues) {
        if (it.pull_request) continue; // issues only, not PRs
        const body = `${it.title} ${it.body ?? ""}`.trim();
        if (!body) continue;
        const lower = body.toLowerCase();
        const matched = terms.filter((t) => lower.includes(t));
        const ageDays = (Date.now() - Date.parse(it.created_at)) / 86_400_000;
        const confirmations = (it.comments ?? 0) + (it.reactions?.total_count ?? 0);
        all.push({
          id: `github_${repo}_${it.number}`,
          source: "github_issues",
          title: it.title.slice(0, 120),
          summary: body.slice(0, 280),
          sourceUrl: it.html_url,
          createdAt: it.created_at,
          matchedTerms: matched,
          confidenceSignals: {
            semanticMatch: Math.min(1, matched.length / Math.max(1, terms.length)),
            exactTermMatch: matched.length ? 0.7 : 0.45,
            recency: Math.max(0, 1 - ageDays / 60),
            sourceTrust: 0.8,                          // issues are high-signal
            confirmationCount: confirmations,
            sameVersionBonus: 0,
            resolvedBonus: it.state === "closed" ? 0.1 : 0,
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
    // ref.externalId = "owner/repo#number"
    const m = /^(.+?)#(\d+)$/.exec(ref.externalId);
    if (!m) return { ref, title: "Invalid issue ref", items: [], redacted: true };
    const [, repo, num] = m;
    const res = await fetch(`${this.cfg.apiBase}/repos/${repo}/issues/${num}`, { headers: this.headers() });
    if (!res.ok) return { ref, title: `Issue ${ref.externalId}`, items: [], redacted: true };
    const it = (await res.json()) as GhIssue;
    return {
      ref,
      title: it.title,
      sourceUrl: it.html_url,
      redacted: true,
      items: [{
        id: `github_${repo}_${it.number}`,
        source: "github_issues" as const,
        authorRef: "redacted_author",
        authorRole: "developer" as const,
        body: `${it.title}\n\n${it.body ?? ""}`.trim(),
        createdAt: it.created_at,
        url: it.html_url,
        visibility: "public" as const,
        permissions: { canQuote: true, canReply: false, canSummarize: true },
      }],
    };
  }
}

export function githubReadFromEnv(env: Record<string, string | undefined>): GithubReadAdapter | null {
  const repos = (env.HELP_ME_GITHUB_REPOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (repos.length === 0) return null;
  return new GithubReadAdapter({ repos, token: env.HELP_ME_GITHUB_TOKEN?.trim() || undefined });
}
