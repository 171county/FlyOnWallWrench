import { initShaderBackground } from "./shaderBg";
import { initParallax } from "./spatial";

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
      visibleText: (window.getSelection()?.toString() || document.body?.innerText || "").slice(0, 6000),
    }),
  });

  return result;
}

function toast(message: string) {
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
    toast(context?.selection ? "Selection captured ✦" : "No selection — grabbed visible page");
  } catch {
    toast("Couldn't read this page");
  }
});

document.getElementById("ask-page")?.addEventListener("click", async () => {
  try {
    const context = await collectPageContext();
    await chrome.storage.session.set({ helpMeDraftContext: { ...context, mode: "visible_page" } });
    toast("Visible page captured ✦");
  } catch {
    toast("Couldn't read this page");
  }
});

document.getElementById("open-sidepanel")?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
  window.close(); // dismiss the popup once the side panel is open
});
