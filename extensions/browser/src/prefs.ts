// Persisted, non-sensitive UI preferences: which sources are selected as
// broadcast targets, and the last active tab. Loaded once at startup.
import { load, save } from "./store.js";

const KEY = "helpme.prefs.v1";
type Prefs = { targets?: string[]; lastTab?: string };
let prefs: Prefs = {};

export async function hydratePrefs(): Promise<void> {
  prefs = await load<Prefs>(KEY, {});
}
export function getTargets(fallback: string[]): string[] {
  return prefs.targets ?? fallback;
}
export function setTargets(targets: string[]): void {
  prefs = { ...prefs, targets };
  save(KEY, prefs);
}
export function getLastTab(): string | undefined {
  return prefs.lastTab;
}
export function setLastTab(lastTab: string): void {
  prefs = { ...prefs, lastTab };
  save(KEY, prefs);
}
