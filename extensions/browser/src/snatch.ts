// SnatchIt — a snip tool for the Ask view. The user drags a rectangle over the
// page; on release we crop the captured viewport to that box and hand back a
// PNG data URL that drops into the chat box as a deletable thumbnail.
//
// Flow:
//   1. inject a selection overlay into the active tab (runs in the page)
//   2. user drags a square; on mouseup it resolves the rect (CSS px)
//   3. capture the visible tab, crop to the rect (× devicePixelRatio) on a canvas
//   4. return the cropped data URL
// Capture needs host permission for the tab; we request the active origin on
// demand if it's missing. Nothing is uploaded — the snatch lives in the panel.

export type SnatchResult =
  | { ok: true; dataUrl: string; w: number; h: number }
  | { ok: false; reason: "cancelled" | "no_tab" | "no_permission" | "blocked" };

type Rect = { x: number; y: number; w: number; h: number; dpr: number } | null;

// Injected into the page: dim + crosshair, drag a box, resolve the rect.
function overlayPicker(): Promise<Rect> {
  return new Promise((resolve) => {
    const prev = document.getElementById("__fotw_snatch__");
    if (prev) prev.remove();
    const root = document.createElement("div");
    root.id = "__fotw_snatch__";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(7,10,17,.32);";
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;border:2px solid #2ee06a;background:rgba(46,224,106,.12);box-shadow:0 0 0 99999px rgba(7,10,17,.32);display:none;pointer-events:none;";
    const hint = document.createElement("div");
    hint.textContent = "SnatchIt — drag a box · Esc to cancel";
    hint.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);font:600 12px ui-sans-serif,system-ui;color:#eaf2ff;background:rgba(7,10,17,.8);border:1px solid rgba(46,224,106,.5);padding:6px 12px;border-radius:999px;pointer-events:none;";
    root.append(box, hint);
    document.body.appendChild(root);

    let sx = 0, sy = 0, dragging = false;
    const done = (r: Rect) => { root.remove(); window.removeEventListener("keydown", onKey); resolve(r); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(null); };
    window.addEventListener("keydown", onKey);

    root.addEventListener("mousedown", (e) => { dragging = true; sx = e.clientX; sy = e.clientY; box.style.display = "block"; });
    root.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px";
    });
    root.addEventListener("mouseup", (e) => {
      dragging = false;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      if (w < 6 || h < 6) return done(null);
      done({ x, y, w, h, dpr: window.devicePixelRatio || 1 });
    });
  });
}

async function ensureCapturePermission(tabUrl: string): Promise<boolean> {
  try {
    const origin = new URL(tabUrl).origin + "/*";
    const has = await new Promise<boolean>((r) => chrome.permissions.contains({ origins: [origin] }, (ok) => r(!!ok)));
    if (has) return true;
    return await new Promise<boolean>((r) => chrome.permissions.request({ origins: [origin] }, (ok) => r(!!ok)));
  } catch { return false; }
}

function cropDataUrl(fullDataUrl: string, rect: NonNullable<Rect>): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = rect.x * rect.dpr, sy = rect.y * rect.dpr, sw = rect.w * rect.dpr, sh = rect.h * rect.dpr;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height });
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = fullDataUrl;
  });
}

export async function snatch(): Promise<SnatchResult> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return { ok: false, reason: "no_tab" };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { ok: false, reason: "no_tab" };

  // Run the selection overlay in the page.
  let rect: Rect = null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: overlayPicker });
    rect = (res?.result as Rect) ?? null;
  } catch {
    return { ok: false, reason: "blocked" };
  }
  if (!rect) return { ok: false, reason: "cancelled" };

  // Capture needs host permission for this origin.
  if (!(await ensureCapturePermission(tab.url))) return { ok: false, reason: "no_permission" };

  try {
    const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const cropped = await cropDataUrl(fullDataUrl, rect);
    return { ok: true, ...cropped };
  } catch {
    return { ok: false, reason: "blocked" };
  }
}
