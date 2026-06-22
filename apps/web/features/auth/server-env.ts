import { readEffectiveRuntimeEnv } from "@agent-space/db";

export function readServerEnvValue(name: string): string | undefined {
  const value = readEffectiveRuntimeEnv()[name]?.trim();
  return value || undefined;
}
