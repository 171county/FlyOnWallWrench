import { mockWorkspaceContext } from "@help-me-comms/core";

export async function POST() {
  return Response.json(mockWorkspaceContext);
}
