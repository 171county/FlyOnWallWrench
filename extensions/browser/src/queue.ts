// In-memory approval queue for the side panel. Drafts (replies, polls, known
// issues, broadcasts) land here and wait for explicit user approval. Nothing is
// ever auto-posted; "approve" only marks intent — the client layer would do the
// real post. Demo-scoped, no sensitive content persisted beyond the session.

export type QueueStatus = "queued" | "approved" | "rejected";
export type QueueItem = {
  id: string;
  actionType: string;    // reply | poll | known_issue | faq | announcement ...
  source: string;        // target source kind
  title?: string;
  body: string;
  createdAt: number;
  status: QueueStatus;
};

const items: QueueItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

export function enqueue(input: Omit<QueueItem, "id" | "createdAt" | "status">): QueueItem {
  const item: QueueItem = { ...input, id: `q_${Date.now()}_${seq++}`, createdAt: Date.now(), status: "queued" };
  items.unshift(item);
  emit();
  return item;
}
export function setStatus(id: string, status: QueueStatus): void {
  const it = items.find((i) => i.id === id);
  if (it) { it.status = status; emit(); }
}
export function updateBody(id: string, body: string): void {
  const it = items.find((i) => i.id === id);
  if (it) { it.body = body; emit(); }
}
export function list(): QueueItem[] { return items; }
export function pendingCount(): number { return items.filter((i) => i.status === "queued").length; }
export function onChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
