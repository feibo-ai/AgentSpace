import { loadRepositoryEnvIntoProcess } from "@agent-space/db";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "edge") {
    loadRepositoryEnvIntoProcess({
      override: process.env.AGENT_SPACE_REPOSITORY_ENV_OVERRIDE !== "0",
    });
  }
}
