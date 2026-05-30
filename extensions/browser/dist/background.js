// src/background.ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => void 0);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "HELP_ME_SELECTED_TEXT") {
    sendResponse({ ok: true });
  }
});
