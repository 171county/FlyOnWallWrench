// Persisted user settings (Settings tab): live-feed speed, theme, data controls.
import { load, save } from "./store.js";

const KEY = "helpme.settings.v1";
export type Settings = { trickleMs: number; trickle: boolean; theme: string };
const DEFAULTS: Settings = { trickleMs: 4500, trickle: true, theme: "garage" };
let settings: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

export async function hydrateSettings(): Promise<void> {
  settings = { ...DEFAULTS, ...(await load<Partial<Settings>>(KEY, {})) };
}
export function getSettings(): Settings { return settings; }
export function setSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  save(KEY, settings); emit();
}
export function onSettingsChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
