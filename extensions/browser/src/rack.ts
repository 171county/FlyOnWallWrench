// Persisted "paired wrenches" — which of the user's wrenches FOTW² shows on the
// Rack. Stores only the chosen ids; pairing = the user opting a wrench in.
import { load, save } from "./store.js";

const KEY = "helpme.rack.v1";
let paired = new Set<string>(["fotw"]); // FOTW² is always the cockpit
const listeners = new Set<() => void>();

export async function hydrateRack(): Promise<void> {
  const saved = await load<string[]>(KEY, ["fotw", "mod", "def"]);
  paired = new Set(saved.length ? saved : ["fotw"]);
  paired.add("fotw");
}
export function isPaired(id: string): boolean { return paired.has(id); }
export function listPaired(): string[] { return [...paired]; }
export function togglePair(id: string): void {
  if (id === "fotw") return;            // cockpit can't be unpaired
  if (paired.has(id)) paired.delete(id); else paired.add(id);
  save(KEY, [...paired]); emit();
}
export function onRackChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
