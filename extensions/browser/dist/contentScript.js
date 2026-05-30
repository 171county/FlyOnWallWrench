// src/contentScript.ts
function collectVisiblePageContext() {
  const selection = window.getSelection()?.toString() ?? "";
  const title = document.title;
  const url = location.href;
  const visibleText = document.body?.innerText?.slice(0, 6e3) ?? "";
  return {
    title,
    url,
    selection,
    visibleText: selection || visibleText
  };
}
function insertDraftIntoActiveElement(draft) {
  const active = document.activeElement;
  if (!active || !("value" in active)) return false;
  active.value = draft;
  active.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
export {
  collectVisiblePageContext,
  insertDraftIntoActiveElement
};
