// Persisted user-defined sources (the "Add" tab). Each becomes its own feed tab.
import { load, save } from "./store.js";

export type CustomKind = "discourse" | "rss";
export type CustomSource = { id: string; label: string; type: CustomKind; url: string; color: string };

const KEY = "helpme.custom.v1";
let sources: CustomSource[] = [];
const listeners = new Set<() => void>();

export async function hydrateCustom(): Promise<void> {
  sources = await load<CustomSource[]>(KEY, []);
}
export function listCustom(): CustomSource[] { return sources; }
export function addCustom(input: Omit<CustomSource, "id">): CustomSource {
  const id = `custom_${input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;
  const src: CustomSource = { ...input, id };
  sources = [...sources, src];
  save(KEY, sources); emit();
  return src;
}
export function removeCustom(id: string): void {
  sources = sources.filter((s) => s.id !== id);
  save(KEY, sources); emit();
}
export function onCustomChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
