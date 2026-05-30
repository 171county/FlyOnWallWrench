import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

export type SteamReadConfig = {
  appIds: string[];        // Steam app IDs whose reviews we read
  apiBase?: string;        // default: https://store.steampowered.com
};

type SteamReview = {
  recommendationid: string;
  review: string;
  timestamp_created: number;
  voted_up: boolean;
  votes_up?: number;
};

const BASE = "https://store.steampowered.com";

// Read-only Steam reviews adapter. The appreviews endpoint is PUBLIC (no token),
// so this needs only the app IDs you care about. Returns normalized,
// redaction-flagged evidence; write is disabled by design.
export class SteamReadAdapter implements CommsSourceAdapter {
  kind = "steam_reviews" as const;
  capabilities: SourceCapabilities;
  private cfg: SteamReadConfig;

  constructor(cfg: SteamReadConfig) {
    this.cfg = { apiBase: BASE, ...cfg };
    this.capabilities = {
      source: "steam_reviews",
      read: true,
      write: "disabled",
      supportsThreads: false,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      approvedSpaces: cfg.appIds,
    };
  }

  private async fetchReviews(appId: string, num: number): Promise<SteamReview[]> {
    const url = `${this.cfg.apiBase}/appreviews/${appId}?json=1&filter=recent&language=english&purchase_type=all&num_per_page=${Math.min(num, 100)}`;
    const res = await fetch(url, { headers: { "user-agent": "HelpMeComms/0.1" } });
    if (!res.ok) throw new Error(`Steam reviews read failed (${res.status}) for app ${appId}`);
    const data = (await res.json()) as { success?: number; reviews?: SteamReview[] };
    return data.reviews ?? [];
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const per = Math.max(40, request.maxEvidence ?? 10);
    const all: EvidenceItem[] = [];

    for (const appId of this.cfg.appIds) {
      let reviews: SteamReview[] = [];
      try { reviews = await this.fetchReviews(appId, per); } catch { continue; }
      for (const r of reviews) {
        const body = (r.review ?? "").trim();
        if (!body) continue;
        const lower = body.toLowerCase();
        const matched = terms.filter((t) => lower.includes(t));
        if (terms.length && matched.length === 0) continue;

        const ageDays = (Date.now() / 1000 - r.timestamp_created) / 86_400;
        all.push({
          id: `steam_${r.recommendationid}`,
          source: "steam_reviews",
          title: `App ${appId} review`,
          summary: body.slice(0, 280),
          createdAt: new Date(r.timestamp_created * 1000).toISOString(),
          matchedTerms: matched,
          confidenceSignals: {
            semanticMatch: Math.min(1, matched.length / Math.max(1, terms.length)),
            exactTermMatch: matched.length ? 0.7 : 0.3,
            recency: Math.max(0, 1 - ageDays / 30),
            sourceTrust: 0.6,
            confirmationCount: r.votes_up ?? 0,
            sameVersionBonus: 0,
            resolvedBonus: r.voted_up ? 0.05 : 0,
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
    // Steam reviews aren't threaded; return recent reviews for the app as items.
    const appId = ref.externalId;
    const reviews = await this.fetchReviews(appId, 25);
    return {
      ref,
      title: `App ${appId} reviews`,
      redacted: true,
      items: reviews.filter((r) => (r.review ?? "").trim()).map((r) => ({
        id: `steam_${r.recommendationid}`,
        source: "steam_reviews" as const,
        authorRef: "redacted_author",
        authorRole: "player" as const,
        body: r.review,
        createdAt: new Date(r.timestamp_created * 1000).toISOString(),
        visibility: "public" as const,
        permissions: { canQuote: true, canReply: false, canSummarize: true },
      })),
    };
  }
}

export function steamReadFromEnv(env: Record<string, string | undefined>): SteamReadAdapter | null {
  const appIds = (env.HELP_ME_STEAM_APP_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (appIds.length === 0) return null;
  return new SteamReadAdapter({ appIds });
}
