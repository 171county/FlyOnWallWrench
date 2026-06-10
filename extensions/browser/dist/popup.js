// src/shaderBg.ts
var DEFAULT_PALETTE = {
  deep: [0.02, 0.028, 0.045],
  c1: [0.3, 0.7, 1],
  c2: [0.4, 0.46, 0.7],
  c3: [0.85, 0.55, 0.28],
  glow: [0.16, 1, 0.5]
};
var VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;
var FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_deep;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_glow;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  p *= 1.6;
  float t = u_time * 0.045;

  // domain warp
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 1.5 * q + vec2(1.7, 9.2) + 0.5 * t),
                fbm(p + 1.5 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p + 1.6 * r);

  vec3 col = mix(u_deep, u_c2, clamp(f * 1.30, 0.0, 1.0));
  col = mix(col, u_c1, clamp(length(r) * 0.60, 0.0, 1.0));
  col = mix(col, u_c3, clamp(q.x * q.y * 1.10, 0.0, 1.0));   // subtle warmth
  col += u_c1 * pow(f, 3.0) * 0.45;                          // bright cores
  col += u_glow * pow(f, 5.0) * 0.16;                        // whisper highlight
  col *= smoothstep(1.25, 0.30, length(uv - 0.5));           // vignette
  col = mix(col * 0.5, col, 0.76);                           // keep it deep for contrast
  col += (hash(uv * (u_time + 1.0)) - 0.5) * 0.022;          // film grain

  gl_FragColor = vec4(col, 1.0);
}
`;
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}
var palette = DEFAULT_PALETTE;
var uploadPalette = null;
var fallbackCanvas = null;
function setShaderPalette(next) {
  palette = next;
  uploadPalette?.();
  if (fallbackCanvas) {
    const [r, g, b] = next.deep;
    fallbackCanvas.style.background = `rgb(${Math.round(r * 255 + 4)}, ${Math.round(g * 255 + 4)}, ${Math.round(b * 255 + 10)})`;
  }
}
function initShaderBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    fallbackCanvas = canvas;
    setShaderPalette(palette);
    return;
  }
  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!prog || !vs || !fs) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uDeep = gl.getUniformLocation(prog, "u_deep");
  const uC1 = gl.getUniformLocation(prog, "u_c1");
  const uC2 = gl.getUniformLocation(prog, "u_c2");
  const uC3 = gl.getUniformLocation(prog, "u_c3");
  const uGlow = gl.getUniformLocation(prog, "u_glow");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  uploadPalette = () => {
    gl.uniform3fv(uDeep, palette.deep);
    gl.uniform3fv(uC1, palette.c1);
    gl.uniform3fv(uC2, palette.c2);
    gl.uniform3fv(uC3, palette.c3);
    gl.uniform3fv(uGlow, palette.glow);
  };
  uploadPalette();
  function resize() {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener("resize", resize);
  const start = performance.now();
  function frame() {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1e3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// src/spatial.ts
function initParallax() {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener("pointermove", (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener("pointerleave", () => {
    tx = 0;
    ty = 0;
  });
  const loop = () => {
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.05;
    stage.style.setProperty("--ry", (cx * 2).toFixed(2) + "deg");
    stage.style.setProperty("--rx", (-cy * 2).toFixed(2) + "deg");
    root.style.setProperty("--px", (cx * -6).toFixed(1) + "px");
    root.style.setProperty("--py", (cy * -6).toFixed(1) + "px");
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// src/store.ts
var mem = {};
var hasChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;
async function load(key, fallback) {
  if (!hasChrome) return key in mem ? mem[key] : fallback;
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res?.[key] ?? fallback));
  });
}

// src/themes.ts
var BODY_SANS = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
var MONO = `"Cascadia Code", Consolas, "JetBrains Mono", "Fira Code", ui-monospace, monospace`;
function vars(v) {
  return {
    "--bg": v.bg,
    "--ink": v.ink,
    "--muted": v.muted,
    "--faint": v.faint,
    "--cyan": v.c1,
    "--cyan-rgb": v.c1rgb,
    "--violet": v.c2,
    "--violet-rgb": v.c2rgb,
    "--magenta": v.c3,
    "--magenta-rgb": v.c3rgb,
    "--lime": v.lime,
    "--lime-rgb": v.limergb,
    "--amber": v.amber,
    "--amber-rgb": v.amberrgb,
    "--grad": v.grad,
    "--grad-soft": v.gradSoft,
    "--font-body": v.fontBody ?? BODY_SANS,
    "--font-display": v.fontDisplay ?? (v.fontBody ?? BODY_SANS),
    "--font-mono": MONO,
    "--radius": v.radius ?? "20px"
  };
}
var THEMES = [
  {
    id: "garage",
    label: "Night Garage",
    tagline: "Gunmetal, steel & copper \u2014 the workshop after hours",
    chips: ["#38e8ff", "#e0964a", "#7d88c8"],
    vars: vars({
      bg: "#05060c",
      ink: "#eaf2ff",
      muted: "#9aa6c4",
      faint: "#6b7799",
      c1: "#38e8ff",
      c1rgb: "56,232,255",
      c2: "#8b5cff",
      c2rgb: "139,92,255",
      c3: "#ff4d9d",
      c3rgb: "255,77,157",
      lime: "#b6ff5a",
      limergb: "182,255,90",
      amber: "#ffc14d",
      amberrgb: "255,193,77",
      grad: "linear-gradient(135deg, #38e8ff 0%, #8b5cff 48%, #ff4d9d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(56,232,255,.22), rgba(139,92,255,.22) 50%, rgba(255,77,157,.22))"
    }),
    shader: { deep: [0.02, 0.028, 0.045], c1: [0.3, 0.7, 1], c2: [0.4, 0.46, 0.7], c3: [0.85, 0.55, 0.28], glow: [0.16, 1, 0.5] }
  },
  {
    id: "synthwave",
    label: "Speedrun Synthwave",
    tagline: "Hot magenta on midnight violet \u2014 arcade leaderboard energy",
    chips: ["#ff2d95", "#2de2ff", "#ff9e2d"],
    vars: vars({
      bg: "#0a0414",
      ink: "#fdeaff",
      muted: "#b48fd6",
      faint: "#7d5fa3",
      c1: "#ff2d95",
      c1rgb: "255,45,149",
      c2: "#9b4dff",
      c2rgb: "155,77,255",
      c3: "#2de2ff",
      c3rgb: "45,226,255",
      lime: "#ffe14d",
      limergb: "255,225,77",
      amber: "#ff9e2d",
      amberrgb: "255,158,45",
      grad: "linear-gradient(135deg, #ff2d95 0%, #9b4dff 48%, #2de2ff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(255,45,149,.24), rgba(155,77,255,.22) 50%, rgba(45,226,255,.22))",
      fontDisplay: `"Avenir Next", Futura, "Segoe UI", ${BODY_SANS}`,
      radius: "16px"
    }),
    shader: { deep: [0.04, 0.012, 0.08], c1: [1, 0.18, 0.58], c2: [0.55, 0.28, 0.95], c3: [0.18, 0.85, 1], glow: [1, 0.62, 0.18] }
  },
  {
    id: "crt",
    label: "CRT Phosphor",
    tagline: "Green glass terminal \u2014 patch notes by candlelight",
    chips: ["#2ee06a", "#ffc14d", "#d8ffe8"],
    vars: vars({
      bg: "#020a05",
      ink: "#d8ffe8",
      muted: "#7fc89a",
      faint: "#4e8a66",
      c1: "#2ee06a",
      c1rgb: "46,224,106",
      c2: "#27b3a4",
      c2rgb: "39,179,164",
      c3: "#ffc14d",
      c3rgb: "255,193,77",
      lime: "#b6ff5a",
      limergb: "182,255,90",
      amber: "#ffc14d",
      amberrgb: "255,193,77",
      grad: "linear-gradient(135deg, #2ee06a 0%, #27b3a4 55%, #ffc14d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(46,224,106,.22), rgba(39,179,164,.20) 50%, rgba(255,193,77,.18))",
      fontBody: MONO,
      fontDisplay: MONO,
      radius: "10px"
    }),
    shader: { deep: [6e-3, 0.024, 0.013], c1: [0.12, 0.62, 0.3], c2: [0.1, 0.4, 0.32], c3: [0.6, 0.5, 0.18], glow: [0.45, 0.95, 0.35] }
  },
  {
    id: "grimoire",
    label: "Arcane Grimoire",
    tagline: "Ink, gold leaf & ember \u2014 RPG spellbook in the dark",
    chips: ["#e8b34a", "#9d6bff", "#ff6b4a"],
    vars: vars({
      bg: "#130a1e",
      ink: "#f3e9d6",
      muted: "#bba27f",
      faint: "#82704f",
      c1: "#e8b34a",
      c1rgb: "232,179,74",
      c2: "#9d6bff",
      c2rgb: "157,107,255",
      c3: "#ff6b4a",
      c3rgb: "255,107,74",
      lime: "#9fe06a",
      limergb: "159,224,106",
      amber: "#e8b34a",
      amberrgb: "232,179,74",
      grad: "linear-gradient(135deg, #e8b34a 0%, #ff6b4a 48%, #9d6bff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(232,179,74,.22), rgba(255,107,74,.20) 50%, rgba(157,107,255,.22))",
      fontDisplay: `Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif`,
      radius: "14px"
    }),
    shader: { deep: [0.055, 0.028, 0.085], c1: [0.9, 0.66, 0.25], c2: [0.5, 0.34, 0.85], c3: [0.95, 0.4, 0.25], glow: [1, 0.85, 0.45] }
  },
  {
    id: "frostbyte",
    label: "Frostbyte",
    tagline: "Aurora over arctic glass \u2014 survival-crafting calm",
    chips: ["#7adfff", "#2ee0c8", "#8b9cff"],
    vars: vars({
      bg: "#04101c",
      ink: "#eaf7ff",
      muted: "#92b4cc",
      faint: "#5e7e96",
      c1: "#7adfff",
      c1rgb: "122,223,255",
      c2: "#8b9cff",
      c2rgb: "139,156,255",
      c3: "#2ee0c8",
      c3rgb: "46,224,200",
      lime: "#bfffe0",
      limergb: "191,255,224",
      amber: "#ffd98a",
      amberrgb: "255,217,138",
      grad: "linear-gradient(135deg, #7adfff 0%, #2ee0c8 48%, #8b9cff 100%)",
      gradSoft: "linear-gradient(135deg, rgba(122,223,255,.22), rgba(46,224,200,.20) 50%, rgba(139,156,255,.22))",
      radius: "24px"
    }),
    shader: { deep: [0.012, 0.045, 0.075], c1: [0.45, 0.85, 1], c2: [0.5, 0.6, 1], c3: [0.2, 0.9, 0.78], glow: [0.75, 1, 0.9] }
  },
  {
    id: "redline",
    label: "Redline Carbon",
    tagline: "Racing red on carbon fiber \u2014 pit-crew urgency",
    chips: ["#ff3b30", "#ff8a3c", "#c9d1d9"],
    vars: vars({
      bg: "#0c0507",
      ink: "#ffeede",
      muted: "#c49a8a",
      faint: "#8a655a",
      c1: "#ff3b30",
      c1rgb: "255,59,48",
      c2: "#ff8a3c",
      c2rgb: "255,138,60",
      c3: "#ffc14d",
      c3rgb: "255,193,77",
      lime: "#7de08a",
      limergb: "125,224,138",
      amber: "#ff8a3c",
      amberrgb: "255,138,60",
      grad: "linear-gradient(135deg, #ff3b30 0%, #ff8a3c 52%, #ffc14d 100%)",
      gradSoft: "linear-gradient(135deg, rgba(255,59,48,.22), rgba(255,138,60,.20) 50%, rgba(255,193,77,.18))",
      fontDisplay: `"Segoe UI Black", "Arial Black", "Avenir Next Heavy", ${BODY_SANS}`,
      radius: "12px"
    }),
    shader: { deep: [0.06, 0.018, 0.022], c1: [1, 0.28, 0.2], c2: [0.75, 0.3, 0.18], c3: [1, 0.62, 0.25], glow: [1, 0.8, 0.35] }
  }
];
var THEME_KEY = "helpme.theme.v1";
function themeById(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
function applyTheme(id) {
  const theme = themeById(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  setShaderPalette(theme.shader);
}
async function hydrateTheme() {
  const id = await load(THEME_KEY, "garage");
  applyTheme(id);
  return id;
}

// src/popup.ts
initShaderBackground("bg");
initParallax();
hydrateTheme();
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function collectPageContext() {
  const tab = await getActiveTab();
  if (!tab.id) throw new Error("No active tab");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.title,
      url: location.href,
      selection: window.getSelection()?.toString() ?? "",
      visibleText: (window.getSelection()?.toString() || document.body?.innerText || "").slice(0, 6e3)
    })
  });
  return result;
}
function toast(message) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = message;
  t.classList.add("show");
  window.setTimeout(() => t.classList.remove("show"), 2600);
}
document.getElementById("ask-selection")?.addEventListener("click", async () => {
  try {
    const context = await collectPageContext();
    await chrome.storage.session.set({ helpMeDraftContext: { ...context, mode: "selection" } });
    toast(context?.selection ? "Selection captured \u2726" : "No selection \u2014 grabbed visible page");
  } catch {
    toast("Couldn't read this page");
  }
});
document.getElementById("ask-page")?.addEventListener("click", async () => {
  try {
    const context = await collectPageContext();
    await chrome.storage.session.set({ helpMeDraftContext: { ...context, mode: "visible_page" } });
    toast("Visible page captured \u2726");
  } catch {
    toast("Couldn't read this page");
  }
});
document.getElementById("open-sidepanel")?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});
