chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "HELP_ME_SELECTED_TEXT") {
    // The extension only sends user-selected or visible page context after user action.
    sendResponse({ ok: true });
  }
});
