import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("helpMe.askAboutSelection", () => askAboutSelection("answer_user")),
    vscode.commands.registerCommand("helpMe.explainCrashLog", () => askAboutSelection("developer_triage")),
    vscode.commands.registerCommand("helpMe.createIssueDraft", () => askAboutSelection("developer_triage", "Draft a triage issue from this evidence.")),
  );
}

async function askAboutSelection(mode: string, prefix?: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("Open a file and select text first.");
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) {
    vscode.window.showInformationMessage("Select the log, error, or code snippet you want to ask about.");
    return;
  }

  const config = vscode.workspace.getConfiguration("helpMe");
  const localAppUrl = config.get<string>("localAppUrl", "http://localhost:3000");
  const message = `${prefix ? `${prefix}\n\n` : ""}${selection}`;

  const output = vscode.window.createOutputChannel("Help Me Comms");
  output.show(true);
  output.appendLine("Sending selected text only. No files are edited or commands run.");

  try {
    const response = await fetch(`${localAppUrl}/api/community-help`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_message: message, mode }),
    });
    const json = await response.json();
    output.appendLine(JSON.stringify(json, null, 2));
  } catch (error) {
    output.appendLine(error instanceof Error ? error.message : String(error));
  }
}

export function deactivate() {}
