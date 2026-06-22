import { readRuntimeAppOperationSync, startRuntimeAppOperationSync } from "@agent-space/db";
import { requireDaemonAuth } from "../../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ operationId: string }> },
): Promise<Response> {
  const auth = requireDaemonAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const { operationId } = await context.params;
  const operation = readRuntimeAppOperationSync(operationId, auth.workspaceId);
  if (!operation) {
    return Response.json({ error: `Runtime app operation "${operationId}" does not exist.` }, { status: 404 });
  }

  const started = startRuntimeAppOperationSync(operationId, auth.workspaceId);
  return Response.json({
    operation: {
      id: started.id,
      status: started.status,
      startedAt: started.startedAt,
    },
  });
}
