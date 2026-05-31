// src/shaderBg.ts
var VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;
var FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

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

  vec3 deep  = vec3(0.020, 0.028, 0.045);  // gunmetal
  vec3 steel = vec3(0.30, 0.70, 1.00);     // steel cyan
  vec3 slate = vec3(0.40, 0.46, 0.70);     // slate blue
  vec3 amber = vec3(0.85, 0.55, 0.28);     // warm metal

  vec3 col = mix(deep, slate, clamp(f * 1.30, 0.0, 1.0));
  col = mix(col, steel, clamp(length(r) * 0.60, 0.0, 1.0));
  col = mix(col, amber, clamp(q.x * q.y * 1.10, 0.0, 1.0));   // subtle warmth
  col += steel * pow(f, 3.0) * 0.45;                          // cool cores
  col += vec3(0.16, 1.0, 0.50) * pow(f, 5.0) * 0.16;          // whisper of terminal green
  col *= smoothstep(1.25, 0.30, length(uv - 0.5));            // vignette
  col = mix(col * 0.5, col, 0.76);                            // keep it deep for contrast
  col += (hash(uv * (u_time + 1.0)) - 0.5) * 0.022;           // film grain

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
function initShaderBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    canvas.style.background = "#070a16";
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
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

// src/popup.ts
initShaderBackground("bg");
initParallax();
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
});
