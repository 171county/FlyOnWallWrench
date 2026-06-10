// The FOTW² theme engine. Every theme is a complete personality — palette,
// gradient, typography, and the WebGL aurora's color field — applied through
// CSS custom properties so the whole cockpit (popup + side panel) reskins
// live, no rebuild. Game-genre flavored on purpose: this is a tool for people
// who make and mod games.
import { load, save } from "./store.js";
import { setShaderPalette, type ShaderPalette } from "./shaderBg.js";

export type Theme = {
  id: string;
  label: string;
  tagline: string;
  vars: Record<string, string>;
  shader: ShaderPalette;
  /** swatch colors for the theme picker */
  chips: [string, string, string];
};

const BODY_SANS = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
const MONO = `"Cascadia Code", Consolas, "JetBrains Mono", "Fira Code", ui-monospace, monospace`;

// helper: build the var block shared shape
function vars(v: {
  bg: string; ink: string; muted: string; faint: string;
  c1: string; c1rgb: string; c2: string; c2rgb: string; c3: string; c3rgb: string;
  lime: string; limergb: string; amber: string; amberrgb: string;
  grad: string; gradSoft: string;
  fontBody?: string; fontDisplay?: string; radius?: string;
}): Record<string, string> {
  return {
    "--bg": v.bg, "--ink": v.ink, "--muted": v.muted, "--faint": v.faint,
    "--cyan": v.c1, "--cyan-rgb": v.c1rgb,
    "--violet": v.c2, "--violet-rgb": v.c2rgb,
    "--magenta": v.c3, "--magenta-rgb": v.c3rgb,
    "--lime": v.lime, "--lime-rgb": v.limergb,
    "--amber": v.amber, "--amber-rgb": v.amberrgb,
    "--grad": v.grad, "--grad-soft": v.gradSoft,
    "--font-body": v.fontBody ?? BODY_SANS,
    "--font-display": v.fontDisplay ?? (v.fontBody ?? BODY_SANS),
    "--font-mono": MONO,
    "--radius": v.radius ?? "20px",
  };
}

export const THEMES: Theme[] = [
  {
    id: "garage",
    label: "Night Garage",
    tagline: "Gunmetal, steel & copper — the workshop after hours",
    chips: ["#38e8ff", "#e0964a", "#7d88c8"],
    vars: vars({
      bg: "#05060c", ink: "#eaf2ff", muted: "#9aa6c4", faint: "#6b7799",
      c1: "#38e8ff", c1rgb: "56,232,255",
      c2: "#8b5cff", c2rgb: "139,92,255",
      c3: "#ff4d9d", c3rgb: "255,77,157",
      lime: "#b6ff5a", limergb: "182,255,90",
      amber: "#ffc14d", amberrgb: "255,193,77",
      grad: "linear-gradient(135deg, #38e8ff 0%, #8b5cff 48%, #ff4d9d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(56,232,255,.22), rgba(139,92,255,.22) 50%, rgba(255,77,157,.22))",
    }),
    shader: { deep: [0.020, 0.028, 0.045], c1: [0.30, 0.70, 1.00], c2: [0.40, 0.46, 0.70], c3: [0.85, 0.55, 0.28], glow: [0.16, 1.0, 0.50] },
  },
  {
    id: "synthwave",
    label: "Speedrun Synthwave",
    tagline: "Hot magenta on midnight violet — arcade leaderboard energy",
    chips: ["#ff2d95", "#2de2ff", "#ff9e2d"],
    vars: vars({
      bg: "#0a0414", ink: "#fdeaff", muted: "#b48fd6", faint: "#7d5fa3",
      c1: "#ff2d95", c1rgb: "255,45,149",
      c2: "#9b4dff", c2rgb: "155,77,255",
      c3: "#2de2ff", c3rgb: "45,226,255",
      lime: "#ffe14d", limergb: "255,225,77",
      amber: "#ff9e2d", amberrgb: "255,158,45",
      grad: "linear-gradient(135deg, #ff2d95 0%, #9b4dff 48%, #2de2ff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(255,45,149,.24), rgba(155,77,255,.22) 50%, rgba(45,226,255,.22))",
      fontDisplay: `"Avenir Next", Futura, "Segoe UI", ${BODY_SANS}`,
      radius: "16px",
    }),
    shader: { deep: [0.040, 0.012, 0.080], c1: [1.00, 0.18, 0.58], c2: [0.55, 0.28, 0.95], c3: [0.18, 0.85, 1.00], glow: [1.0, 0.62, 0.18] },
  },
  {
    id: "crt",
    label: "CRT Phosphor",
    tagline: "Green glass terminal — patch notes by candlelight",
    chips: ["#2ee06a", "#ffc14d", "#d8ffe8"],
    vars: vars({
      bg: "#020a05", ink: "#d8ffe8", muted: "#7fc89a", faint: "#4e8a66",
      c1: "#2ee06a", c1rgb: "46,224,106",
      c2: "#27b3a4", c2rgb: "39,179,164",
      c3: "#ffc14d", c3rgb: "255,193,77",
      lime: "#b6ff5a", limergb: "182,255,90",
      amber: "#ffc14d", amberrgb: "255,193,77",
      grad: "linear-gradient(135deg, #2ee06a 0%, #27b3a4 55%, #ffc14d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(46,224,106,.22), rgba(39,179,164,.20) 50%, rgba(255,193,77,.18))",
      fontBody: MONO,
      fontDisplay: MONO,
      radius: "10px",
    }),
    shader: { deep: [0.006, 0.024, 0.013], c1: [0.12, 0.62, 0.30], c2: [0.10, 0.40, 0.32], c3: [0.60, 0.50, 0.18], glow: [0.45, 0.95, 0.35] },
  },
  {
    id: "grimoire",
    label: "Arcane Grimoire",
    tagline: "Ink, gold leaf & ember — RPG spellbook in the dark",
    chips: ["#e8b34a", "#9d6bff", "#ff6b4a"],
    vars: vars({
      bg: "#130a1e", ink: "#f3e9d6", muted: "#bba27f", faint: "#82704f",
      c1: "#e8b34a", c1rgb: "232,179,74",
      c2: "#9d6bff", c2rgb: "157,107,255",
      c3: "#ff6b4a", c3rgb: "255,107,74",
      lime: "#9fe06a", limergb: "159,224,106",
      amber: "#e8b34a", amberrgb: "232,179,74",
      grad: "linear-gradient(135deg, #e8b34a 0%, #ff6b4a 48%, #9d6bff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(232,179,74,.22), rgba(255,107,74,.20) 50%, rgba(157,107,255,.22))",
      fontDisplay: `Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif`,
      radius: "14px",
    }),
    shader: { deep: [0.055, 0.028, 0.085], c1: [0.90, 0.66, 0.25], c2: [0.50, 0.34, 0.85], c3: [0.95, 0.40, 0.25], glow: [1.0, 0.85, 0.45] },
  },
  {
    id: "frostbyte",
    label: "Frostbyte",
    tagline: "Aurora over arctic glass — survival-crafting calm",
    chips: ["#7adfff", "#2ee0c8", "#8b9cff"],
    vars: vars({
      bg: "#04101c", ink: "#eaf7ff", muted: "#92b4cc", faint: "#5e7e96",
      c1: "#7adfff", c1rgb: "122,223,255",
      c2: "#8b9cff", c2rgb: "139,156,255",
      c3: "#2ee0c8", c3rgb: "46,224,200",
      lime: "#bfffe0", limergb: "191,255,224",
      amber: "#ffd98a", amberrgb: "255,217,138",
      grad: "linear-gradient(135deg, #7adfff 0%, #2ee0c8 48%, #8b9cff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(122,223,255,.22), rgba(46,224,200,.20) 50%, rgba(139,156,255,.22))",
      radius: "24px",
    }),
    shader: { deep: [0.012, 0.045, 0.075], c1: [0.45, 0.85, 1.00], c2: [0.50, 0.60, 1.00], c3: [0.20, 0.90, 0.78], glow: [0.75, 1.0, 0.90] },
  },
  {
    id: "redline",
    label: "Redline Carbon",
    tagline: "Racing red on carbon fiber — pit-crew urgency",
    chips: ["#ff3b30", "#ff8a3c", "#c9d1d9"],
    vars: vars({
      bg: "#0c0507", ink: "#ffeede", muted: "#c49a8a", faint: "#8a655a",
      c1: "#ff3b30", c1rgb: "255,59,48",
      c2: "#ff8a3c", c2rgb: "255,138,60",
      c3: "#ffc14d", c3rgb: "255,193,77",
      lime: "#7de08a", limergb: "125,224,138",
      amber: "#ff8a3c", amberrgb: "255,138,60",
      grad: "linear-gradient(135deg, #ff3b30 0%, #ff8a3c 52%, #ffc14d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(255,59,48,.22), rgba(255,138,60,.20) 50%, rgba(255,193,77,.18))",
      fontDisplay: `"Segoe UI Black", "Arial Black", "Avenir Next Heavy", ${BODY_SANS}`,
      radius: "12px",
    }),
    shader: { deep: [0.060, 0.018, 0.022], c1: [1.00, 0.28, 0.20], c2: [0.75, 0.30, 0.18], c3: [1.00, 0.62, 0.25], glow: [1.0, 0.80, 0.35] },
  },
];

const THEME_KEY = "helpme.theme.v1";

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/** Paint a theme onto the document and the shader. */
export function applyTheme(id: string): void {
  const theme = themeById(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  setShaderPalette(theme.shader);
}

/** Load + apply the saved theme (popup and panel both call this at boot). */
export async function hydrateTheme(): Promise<string> {
  const id = await load<string>(THEME_KEY, "garage");
  applyTheme(id);
  return id;
}

/** Persist + apply a newly picked theme. */
export function setTheme(id: string): void {
  save(THEME_KEY, id);
  applyTheme(id);
}
