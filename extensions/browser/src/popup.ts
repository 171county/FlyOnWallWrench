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

document.getElementById("ask-selection")?.addEventListener("click", async () => {
  const context = await collectPageContext();
  await chrome.storage.session.set({ helpMeDraftContext: { ...context, mode: "selection" } });
});

document.getElementById("ask-page")?.addEventListener("click", async () => {
  const context = await collectPageContext();
  await chrome.storage.session.set({ helpMeDraftContext: { ...context, mode: "visible_page" } });
});

document.getElementById("open-sidepanel")?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
});
