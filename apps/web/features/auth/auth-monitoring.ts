import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SYSTEM_WORKSPACE_ID = "__system__";

export function reportGoogleAuthCallbackIssue(input: {
  code: string;
  phase: "provider_redirect" | "missing_params" | "callback";
  invitationToken?: string;
  joinCode?: string;
  details?: string;
}): void {
  const payload = {
    code: input.code,
    phase: input.phase,
    invitationTokenPresent: Boolean(input.invitationToken),
    joinCodePresent: Boolean(input.joinCode),
    details: input.details,
    happenedAt: new Date().toISOString(),
  };

  console.error("[auth.google.callback_issue]", JSON.stringify(payload));
  try {
    const monitoringFilePath = getGoogleAuthMonitoringFilePath();
    mkdirSync(dirname(monitoringFilePath), { recursive: true });
    appendFileSync(monitoringFilePath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // Best-effort monitoring should never block auth callbacks.
  }
}

function getGoogleAuthMonitoringFilePath(): string {
  return join(resolveRepositoryRoot(), "data", "workspaces", SYSTEM_WORKSPACE_ID, "auth", "google-callback-issues.jsonl");
}

function resolveRepositoryRoot(): string {
  const candidates = [
    process.env.AGENT_SPACE_REPOSITORY_ROOT,
    /*turbopackIgnore: true*/ process.cwd(),
    join(/*turbopackIgnore: true*/ process.cwd(), ".."),
    join(/*turbopackIgnore: true*/ process.cwd(), "..", ".."),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (existsSync(/*turbopackIgnore: true*/ join(resolved, "Target.md"))) {
      return resolved;
    }
  }

  return /*turbopackIgnore: true*/ process.cwd();
}
