async function askHelpMe(userMessage: string) {
  // Local app endpoint for demo. Production should respect workspace/provider/source settings.
  const response = await fetch("http://localhost:3000/api/community-help", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_message: userMessage, source_policy: "auto_scope_connected_sources" }),
  });
  return response.json();
}

document.getElementById("ask")?.addEventListener("click", async () => {
  const textarea = document.getElementById("question") as HTMLTextAreaElement;
  const result = document.getElementById("result") as HTMLPreElement;
  result.textContent = "Thinking...";
  try {
    const answer = await askHelpMe(textarea.value);
    result.textContent = JSON.stringify(answer, null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
  }
});
