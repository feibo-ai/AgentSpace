import { readWorkspaceSnapshotSync } from "@agent-space/services";
import { writeData, type OutputFormat } from "../lib/format.ts";

export function runImCommand(subcommand: string | undefined, format: OutputFormat): number {
  const snapshot = readWorkspaceSnapshotSync();

  if (subcommand === "channels") {
    writeData(format, snapshot.channels);
    return 0;
  }

  if (subcommand === "feed") {
    writeData(format, snapshot.messages);
    return 0;
  }

  console.error("Usage: agent-space im channels [--json]");
  console.error("   or: agent-space im feed [--json]");
  return 1;
}
