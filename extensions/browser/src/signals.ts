// Client-side correlation store. Clicking "+ me too" on a feed message, or
// reacting to a topic, records a local confirmation. Ask folds these into the
// prevalence/confidence read so the feed and the broadcast talk to each other.
// In-memory only (no sensitive content persisted) — demo-scoped.

export type Signal = { topic: string; source: string; at: number };

const signals: Signal[] = [];
const listeners = new Set<(n: number) => void>();

// Crude topic key: lowercase keywords, good enough to cluster "boss crash" etc.
export function topicKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)).slice(0, 6).sort().join(" ");
}
const STOP = new Set(["this","that","with","just","like","else","crash","crashing","anyone","after","when","where","still","game","mods","mod","help","what","there","here","your","have","does","didnt","cant","wont"]);

export function addSignal(text: string, source: string): number {
  signals.push({ topic: topicKey(text), source, at: Date.now() });
  const total = signals.length;
  listeners.forEach((fn) => fn(total));
  return total;
}

// How many local confirmations overlap with this query's topic.
export function localConfirmations(query: string): { count: number; sources: string[] } {
  const key = new Set(topicKey(query).split(" ").filter(Boolean));
  const hits = signals.filter((s) => {
    const words = s.topic.split(" ");
    return words.some((w) => key.has(w));
  });
  return { count: hits.length, sources: [...new Set(hits.map((h) => h.source))] };
}

export function totalSignals(): number {
  return signals.length;
}

export function onSignal(fn: (n: number) => void): void {
  listeners.add(fn);
}
