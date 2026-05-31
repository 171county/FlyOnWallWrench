// Per-site page readers. These run INSIDE the page (via chrome.scripting) using
// the user's own logged-in session — we read the rendered DOM the user can
// already see. No tokens, no API keys, nothing stored. Each returns plain
// message objects. Selectors are best-effort and resilient to partial matches;
// sites redesign, so these are kept simple and forgiving.
//
// IMPORTANT: this is a string-injected function body (Manifest V3 executeScript),
// so it must be self-contained — no imports, no outside refs.

export type ScrapedMsg = { author: string; body: string; ago: string };

// The function below is serialized and run in the page. Keep it dependency-free.
export function pageScrapeFn(site: string): ScrapedMsg[] {
  const txt = (el: Element | null | undefined) => (el?.textContent || "").trim();
  const clip = (s: string, n = 280) => s.replace(/\s+/g, " ").trim().slice(0, n);
  const out: ScrapedMsg[] = [];
  const push = (author: string, body: string, ago = "") => {
    body = clip(body);
    if (body && body.length > 1) out.push({ author: author || "user", body, ago });
  };

  try {
    if (site === "discord") {
      // Discord web: message list items carry data-list-item-id^="chat-messages".
      const items = document.querySelectorAll('[id^="chat-messages-"], [data-list-item-id^="chat-messages"]');
      let lastAuthor = "";
      items.forEach((it) => {
        const a = it.querySelector('[class*="username"]');
        const author = txt(a) || lastAuthor;
        if (txt(a)) lastAuthor = author;
        const content = it.querySelector('[id^="message-content-"], [class*="messageContent"]');
        push(author, txt(content));
      });
    } else if (site === "reddit") {
      // Reddit (new): posts as <shreddit-post>; comments carry slot="comment".
      document.querySelectorAll("shreddit-post").forEach((p) => {
        const title = p.getAttribute("post-title") || txt(p.querySelector('[slot="title"]'));
        const author = p.getAttribute("author") || "redditor";
        push(author, title);
      });
      document.querySelectorAll('[slot="comment"], [data-testid="comment"]').forEach((c) => {
        push("redditor", txt(c));
      });
    } else if (site === "steam") {
      // Steam community: reviews and discussion posts.
      document.querySelectorAll(".apphub_Card, .commentthread_comment, .forum_op, .topic_message").forEach((card) => {
        const author = txt(card.querySelector(".apphub_CardContentAuthorName, .commentthread_author_link, .forum_op_author")) || "player";
        const body = txt(card.querySelector(".apphub_CardTextContent, .commentthread_comment_text, .content, .forum_op_text"));
        push(author, body);
      });
    } else if (site === "github") {
      // GitHub issue / discussion: the OP body + each comment.
      document.querySelectorAll(".js-comment-body, .markdown-body, .comment-body").forEach((c) => {
        push("contributor", txt(c));
      });
      const t = txt(document.querySelector(".js-issue-title, .markdown-title, bdi.js-issue-title"));
      if (t) out.unshift({ author: "issue", body: clip(t), ago: "" });
    } else {
      // Generic fallback: grab visible paragraphs.
      document.querySelectorAll("article p, .post p, main p").forEach((p) => push("page", txt(p)));
    }
  } catch {
    // never throw inside the page
  }

  // De-dupe and cap.
  const seen = new Set<string>();
  return out.filter((m) => { const k = m.body.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 25);
}

// Map our source kinds to (a) the scrape key and (b) URL match for "are you on it?"
export const SITE_INFO: Record<string, { scrapeKey: string; match: RegExp; origin: string; label: string }> = {
  discord: { scrapeKey: "discord", match: /(^|\.)discord\.com$/, origin: "https://discord.com/*", label: "Discord" },
  reddit: { scrapeKey: "reddit", match: /(^|\.)reddit\.com$/, origin: "https://*.reddit.com/*", label: "Reddit" },
  steam_reviews: { scrapeKey: "steam", match: /(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$/, origin: "https://*.steamcommunity.com/*", label: "Steam" },
  github_issues: { scrapeKey: "github", match: /(^|\.)github\.com$/, origin: "https://github.com/*", label: "GitHub" },
};
