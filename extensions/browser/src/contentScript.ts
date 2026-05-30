export function collectVisiblePageContext() {
  const selection = window.getSelection()?.toString() ?? "";
  const title = document.title;
  const url = location.href;
  const visibleText = document.body?.innerText?.slice(0, 6000) ?? "";

  return {
    title,
    url,
    selection,
    visibleText: selection || visibleText,
  };
}

export function insertDraftIntoActiveElement(draft: string) {
  const active = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
  if (!active || !("value" in active)) return false;

  active.value = draft;
  active.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
