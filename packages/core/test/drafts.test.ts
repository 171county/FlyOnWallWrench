import { describe, expect, it } from "vitest";
import { composeDraft, suggestedDraftsFor } from "../src/drafts.js";

describe("composeDraft", () => {
  it("uses distinct, on-platform voice per source", () => {
    const discord = composeDraft({ kind: "reply", source: "discord", topic: "boss crash" });
    const forum = composeDraft({ kind: "reply", source: "forum", topic: "boss crash" });
    expect(discord.body).toMatch(/load order/i);          // asks for load order
    expect(discord.body).toMatch(/[a-z]/);                 // casual lowercase opener
    expect(forum.body).toMatch(/\*\*Re:/);                 // structured/markdown
    expect(discord.body).not.toEqual(forum.body);
    expect(discord.requiresApproval).toBe(true);
  });

  it("known_issue reflects prevalence and carries a title", () => {
    const wide = composeDraft({ kind: "known_issue", source: "forum", topic: "boss crash", prevalence: 0.8 });
    const narrow = composeDraft({ kind: "known_issue", source: "forum", topic: "boss crash", prevalence: 0.1 });
    expect(wide.title).toMatch(/known issue/i);
    expect(wide.body).toMatch(/widespread/i);
    expect(narrow.body).toMatch(/investigation/i);
  });

  it("folds evidence into the body when provided", () => {
    const d = composeDraft({
      kind: "reply", source: "reddit", topic: "boss crash",
      evidence: [{ id: "1", source: "discord", title: "t", summary: "disable the texture mod", matchedTerms: [], confidenceSignals: { semanticMatch: 1, exactTermMatch: 1, recency: 1, sourceTrust: 1, confirmationCount: 5, sameVersionBonus: 0, resolvedBonus: 0, duplicatePenalty: 0, lowQualityPenalty: 0 }, redacted: true }],
    });
    expect(d.body).toMatch(/disable the texture mod/);
  });

  it("maps draft kinds to action types and suggests by intent", () => {
    expect(composeDraft({ kind: "poll", source: "discord", topic: "x" }).actionType).toBe("poll");
    expect(suggestedDraftsFor("crash_support")).toContain("known_issue");
    expect(suggestedDraftsFor("community_sentiment")).toContain("poll");
  });
});
