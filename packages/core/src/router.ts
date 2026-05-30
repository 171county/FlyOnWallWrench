import type { HelpIntent, SourceKind, WorkspaceContext } from "./types.js";

export function classifyIntent(message: string): HelpIntent {
  const text = message.toLowerCase();

  if (/(crash|ctd|freeze|fatal|exception|stack trace|segfault)/.test(text)) return "crash_support";
  if (/(fps|stutter|bottleneck|lag|cpu|gpu|frame|performance)/.test(text)) return "performance_bottleneck";
  if (/(install|setup|load order|dependency|missing|won't load|wont load)/.test(text)) return "install_help";
  if (/(compatible|compatibility|conflict|breaks|works with)/.test(text)) return "compatibility_question";
  if (/(known issue|anyone else|others seeing|widespread)/.test(text)) return "known_issue_check";
  if (/(what are people saying|sentiment|mad about|complaining)/.test(text)) return "community_sentiment";
  if (/(ideas|feature requests|want from|wishlist|next update)/.test(text)) return "idea_pull";
  if (/(ask the community|push this idea|poll|rfc)/.test(text)) return "idea_push";
  if (/(draft|reply|respond)/.test(text)) return "reply_drafting";
  if (/(announcement|patch notes|post update)/.test(text)) return "announcement_drafting";
  if (/(triage|bug report|repro|issue)/.test(text)) return "triage";

  return "unknown";
}

export type SourceScope = {
  required: SourceKind[];
  optional: SourceKind[];
  avoided: SourceKind[];
};

const candidateByIntent: Record<HelpIntent, SourceScope> = {
  crash_support: {
    required: ["discord", "forum"],
    optional: ["steam_reviews", "reddit", "github_issues", "github_discussions"],
    avoided: ["youtube", "twitch"],
  },
  performance_bottleneck: {
    required: ["discord", "steam_reviews"],
    optional: ["reddit", "forum", "youtube", "github_issues"],
    avoided: [],
  },
  install_help: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_issues", "github_discussions"],
    avoided: ["twitch"],
  },
  compatibility_question: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_issues", "github_discussions", "steam_reviews"],
    avoided: [],
  },
  known_issue_check: {
    required: ["discord", "steam_reviews"],
    optional: ["reddit", "forum", "github_issues", "github_discussions"],
    avoided: [],
  },
  community_sentiment: {
    required: ["discord", "steam_reviews", "reddit"],
    optional: ["forum", "youtube", "twitch"],
    avoided: [],
  },
  idea_pull: {
    required: ["discord", "reddit", "steam_reviews"],
    optional: ["forum", "youtube", "github_discussions"],
    avoided: [],
  },
  idea_push: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_discussions"],
    avoided: [],
  },
  reply_drafting: {
    required: [],
    optional: ["discord", "reddit", "forum", "github_discussions", "youtube"],
    avoided: [],
  },
  announcement_drafting: {
    required: ["discord", "steam_news"],
    optional: ["reddit", "forum", "youtube"],
    avoided: [],
  },
  triage: {
    required: ["discord", "github_issues"],
    optional: ["forum", "reddit", "steam_reviews"],
    avoided: [],
  },
  unknown: {
    required: ["discord", "forum"],
    optional: ["reddit", "steam_reviews"],
    avoided: [],
  },
};

export function scopeSources(intent: HelpIntent, context: WorkspaceContext): SourceScope {
  const plan = candidateByIntent[intent];
  const connected = new Set(context.connectedSources.filter((s) => s.read).map((s) => s.source));
  const onlyConnected = (sources: SourceKind[]) => sources.filter((source) => connected.has(source));

  return {
    required: onlyConnected(plan.required),
    optional: onlyConnected(plan.optional),
    avoided: plan.avoided,
  };
}

export function selectSources(intent: HelpIntent, context: WorkspaceContext): SourceKind[] {
  const scope = scopeSources(intent, context);
  const selected = [...scope.required];

  for (const source of scope.optional) {
    if (selected.length >= 4) break;
    if (!selected.includes(source)) selected.push(source);
  }

  return selected;
}
