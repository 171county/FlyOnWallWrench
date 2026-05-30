// Approval queue for the side panel, persisted via chrome.storage so drafts
// survive panel reloads. Drafts (replies, polls, known issues, broadcasts) land
// here and wait for explicit user approval. Nothing is ever auto-posted;
// "approve" only marks intent — the client layer would do the real post.
import { load, save } from "./store.js";

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

const KEY = "helpme.queue.v1";
let items: QueueItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;
let ready = false;

export async function hydrate(): Promise<void> {
  items = await load<QueueItem[]>(KEY, []);
  ready = true;
  emit();
}
function persist() { save(KEY, items); }

export function enqueue(input: Omit<QueueItem, "id" | "createdAt" | "status">): QueueItem {
  const item: QueueItem = { ...input, id: `q_${Date.now()}_${seq++}`, createdAt: Date.now(), status: "queued" };
  items.unshift(item);
  persist(); emit();
  return item;
}
export function setStatus(id: string, status: QueueStatus): void {
  const it = items.find((i) => i.id === id);
  if (it) { it.status = status; persist(); emit(); }
}
export function updateBody(id: string, body: string): void {
  const it = items.find((i) => i.id === id);
  if (it) { it.body = body; persist(); emit(); }
}
export function remove(id: string): void {
  items = items.filter((i) => i.id !== id);
  persist(); emit();
}
export function clearResolved(): void {
  items = items.filter((i) => i.status === "queued");
  persist(); emit();
}
export function list(): QueueItem[] { return items; }
export function pendingCount(): number { return items.filter((i) => i.status === "queued").length; }
export function isReady(): boolean { return ready; }
export function onChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
