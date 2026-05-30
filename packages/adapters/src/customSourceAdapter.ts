import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

// A user-defined source: point it at any Discourse-compatible forum or an
// RSS/Atom feed and it becomes a read-only community source. This is what powers
// the side panel's "Add" tab — bring your own forum without code. Read-only.
export type CustomSourceKind = "discourse" | "rss";
export type CustomSourceConfig = {
  id: string;            // stable id, e.g. "myforum"
  label: string;         // display name
  type: CustomSourceKind;
  url: string;           // Discourse base URL, or RSS/Atom feed URL
};

type Item = { title: string; body: string; url?: string; createdAt?: string };

export class CustomSourceAdapter implements CommsSourceAdapter {
  kind = "forum" as const;            // normalized bucket; cfg.id keeps identity
  capabilities: SourceCapabilities;
  readonly cfg: CustomSourceConfig;

  constructor(cfg: CustomSourceConfig) {
    this.cfg = cfg;
    this.capabilities = {
      source: "forum",
      read: true,
      write: "disabled",
      supportsThreads: true,
      supportsSearch: this.cfg.type === "discourse",
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      approvedSpaces: [cfg.url],
    };
  }

  private async fetchDiscourse(query: string, limit: number): Promise<Item[]> {
    const base = this.cfg.url.replace(/\/+$/, "");
    // Discourse search.json when there's a query, latest.json otherwise.
    const url = query
      ? `${base}/search.json?q=${encodeURIComponent(query)}`
      : `${base}/latest.json`;
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "HelpMeComms/0.1" } });
    if (!res.ok) throw new Error(`Discourse read failed (${res.status}) for ${this.cfg.label}`);
    const data = (await res.json()) as { topics?: Array<{ title: string; slug?: string; id?: number; created_at?: string }>; topic_list?: { topics?: Array<{ title: string; slug?: string; id?: number; created_at?: string }> } };
    const topics = data.topics ?? data.topic_list?.topics ?? [];
    return topics.slice(0, limit).map((t) => ({
      title: t.title,
      body: t.title,
      url: t.slug && t.id ? `${base}/t/${t.slug}/${t.id}` : base,
      createdAt: t.created_at,
    }));
  }

  private async fetchRss(limit: number): Promise<Item[]> {
    const res = await fetch(this.cfg.url, { headers: { "user-agent": "HelpMeComms/0.1" } });
    if (!res.ok) throw new Error(`Feed read failed (${res.status}) for ${this.cfg.label}`);
    const xml = await res.text();
    const items: Item[] = [];
    // Minimal RSS/Atom parse — title + link + date, no deps.
    const blocks = xml.split(/<(?:item|entry)[ >]/i).slice(1);
    for (const b of blocks.slice(0, limit)) {
      const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(b)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? /<link[^>]*>([\s\S]*?)<\/link>/i.exec(b)?.[1] ?? "";
      const date = /<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i.exec(b)?.[1] ?? "";
      if (title) items.push({ title, body: title, url: link.trim(), createdAt: date.trim() || undefined });
    }
    return items;
  }

  private async fetchItems(query: string, limit: number): Promise<Item[]> {
    return this.cfg.type === "discourse" ? this.fetchDiscourse(query, limit) : this.fetchRss(limit);
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let items: Item[] = [];
    try { items = await this.fetchItems(request.query, Math.max(20, request.maxEvidence ?? 10)); } catch { return []; }
    const out: EvidenceItem[] = [];
    for (const it of items) {
      const lower = `${it.title} ${it.body}`.toLowerCase();
      const matched = terms.filter((t) => lower.includes(t));
      if (terms.length && matched.length === 0 && this.cfg.type === "rss") continue; // RSS we filter client-side
      const ageDays = it.createdAt ? (Date.now() - Date.parse(it.createdAt)) / 86_400_000 : 7;
      out.push({
        id: `${this.cfg.id}_${out.length}`,
        source: "forum",
        title: it.title.slice(0, 120),
        summary: it.body.slice(0, 280),
        sourceUrl: it.url,
        createdAt: it.createdAt,
        matchedTerms: matched,
        confidenceSignals: {
          semanticMatch: terms.length ? Math.min(1, matched.length / terms.length) : 0.5,
          exactTermMatch: matched.length ? 0.65 : 0.4,
          recency: Number.isFinite(ageDays) ? Math.max(0, 1 - ageDays / 30) : 0.5,
          sourceTrust: 0.6,
          confirmationCount: 0,
          sameVersionBonus: 0,
          resolvedBonus: 0,
          duplicatePenalty: 0,
          lowQualityPenalty: it.title.length < 12 ? 0.2 : 0,
        },
        redacted: true,
      });
    }
    return out.slice(0, request.maxEvidence ?? 10);
  }

  async getThread(ref: SourceRef, _context: WorkspaceContext): Promise<ThreadContext> {
    const items = await this.fetchItems("", 25).catch(() => []);
    return {
      ref,
      title: this.cfg.label,
      redacted: true,
      items: items.map((it, i) => ({
        id: `${this.cfg.id}_${i}`,
        source: "forum" as const,
        authorRef: "redacted_author",
        authorRole: "unknown" as const,
        body: it.title,
        createdAt: it.createdAt ?? new Date().toISOString(),
        url: it.url,
        visibility: "public" as const,
        permissions: { canQuote: true, canReply: false, canSummarize: true },
      })),
    };
  }
}
