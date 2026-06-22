import { readEffectiveRuntimeEnv } from "./repository-env.ts";

export interface PostgresConnectionInput {
  databaseUrl?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolvePostgresDatabaseUrl(input?: PostgresConnectionInput): string {
  const rawEnv = input?.env ?? process.env;
  const env = input?.env ? readEffectiveRuntimeEnv({ env: input.env, repositoryOverridesEnv: false }) : readEffectiveRuntimeEnv();
  const databaseUrl =
    input?.databaseUrl?.trim()
    || rawEnv.AGENT_SPACE_TEST_DATABASE_URL?.trim()
    || rawEnv.AGENT_SPACE_PG_TEST_URL?.trim()
    || env.AGENT_SPACE_TEST_DATABASE_URL?.trim()
    || env.AGENT_SPACE_PG_TEST_URL?.trim()
    || resolveEnvironmentDeploymentModeDatabaseUrl(rawEnv)
    || rawEnv.AGENT_SPACE_PG_URL?.trim()
    || rawEnv.DATABASE_URL?.trim()
    || resolveEnvironmentDeploymentModeDatabaseUrl(env)
    || env.AGENT_SPACE_PG_URL?.trim()
    || env.DATABASE_URL?.trim()
    || "";

  if (!databaseUrl) {
    throw new Error(
      "PostgreSQL database URL is required. Set AGENT_SPACE_DEPLOYMENT_MODE with SELF_HOSTED_DATABASE_URL or NEON_DATABASE_URL, "
      + "or define legacy AGENT_SPACE_PG_URL / DATABASE_URL.",
    );
  }

  assertSafeTestDatabaseUrl(databaseUrl, env);

  return databaseUrl;
}

export function resolvePostgresDirectDatabaseUrl(input?: PostgresConnectionInput): string | undefined {
  const rawEnv = input?.env ?? process.env;
  const env = input?.env ? readEffectiveRuntimeEnv({ env: input.env, repositoryOverridesEnv: false }) : readEffectiveRuntimeEnv();
  return (
    resolveEnvironmentDeploymentModeDirectDatabaseUrl(rawEnv)
    || rawEnv.DATABASE_DIRECT_URL?.trim()
    || resolveEnvironmentDeploymentModeDirectDatabaseUrl(env)
    || env.DATABASE_DIRECT_URL?.trim()
    || undefined
  );
}

export function redactPostgresDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return databaseUrl.replace(/:[^:@/]+@/, ":***@");
  }
}

function resolveEnvironmentDeploymentModeDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  const mode = resolveDeploymentMode(env, {});
  if (mode === "cloud") {
    return env.NEON_DATABASE_URL?.trim() || undefined;
  }
  if (mode === "self_hosted") {
    return env.SELF_HOSTED_DATABASE_URL?.trim() || undefined;
  }
  return undefined;
}

function resolveEnvironmentDeploymentModeDirectDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  const mode = resolveDeploymentMode(env, {});
  if (mode === "cloud") {
    return env.NEON_DATABASE_DIRECT_URL?.trim() || undefined;
  }
  if (mode === "self_hosted") {
    return env.SELF_HOSTED_DATABASE_DIRECT_URL?.trim() || undefined;
  }
  return undefined;
}

function resolveDeploymentMode(env: NodeJS.ProcessEnv, repositoryEnv: Record<string, string>): "cloud" | "self_hosted" | undefined {
  const rawMode = env.AGENT_SPACE_DEPLOYMENT_MODE?.trim() || repositoryEnv.AGENT_SPACE_DEPLOYMENT_MODE?.trim();
  if (rawMode === "cloud" || rawMode === "self_hosted") {
    return rawMode;
  }
  return undefined;
}

function assertSafeTestDatabaseUrl(databaseUrl: string, env: NodeJS.ProcessEnv): void {
  if (!isTestProcess(env) || env.AGENT_SPACE_ALLOW_PRODUCTION_TEST_DB === "1") {
    return;
  }

  if (looksLikeTestDatabaseUrl(databaseUrl) || looksLikeE2eNeonBranchUrl(databaseUrl, env)) {
    return;
  }

  throw new Error(
    "Refusing to use a non-test PostgreSQL database while running tests. "
    + "Set AGENT_SPACE_TEST_DATABASE_URL or AGENT_SPACE_PG_TEST_URL to an isolated test database, "
    + "or set AGENT_SPACE_ALLOW_PRODUCTION_TEST_DB=1 if this is intentional.",
  );
}

function isTestProcess(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.NODE_TEST_CONTEXT
    || env.AGENT_SPACE_E2E === "1"
    || env.VITEST
    || env.JEST_WORKER_ID
    || env.NODE_ENV === "test"
    || process.argv.some((arg) => arg === "--test" || arg.startsWith("--test-")),
  );
}

function looksLikeTestDatabaseUrl(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl);
    return /(^|[_-])(test|e2e|loadtest)([_-]|$)/i.test(parsed.pathname.replace(/^\//, ""));
  } catch {
    return /(^|[_-])(test|e2e|loadtest)([_-]|$)/i.test(databaseUrl);
  }
}

function looksLikeE2eNeonBranchUrl(databaseUrl: string, env: NodeJS.ProcessEnv): boolean {
  const branchId = env.AGENT_SPACE_E2E_NEON_BRANCH_ID?.trim();
  const branchName = env.AGENT_SPACE_E2E_NEON_BRANCH_NAME?.trim();
  if (!branchId || !branchName?.startsWith("e2e-")) {
    return false;
  }

  const expectedUrls = [
    env.AGENT_SPACE_E2E_DATABASE_URL,
    env.AGENT_SPACE_TEST_DATABASE_URL,
    env.AGENT_SPACE_PG_TEST_URL,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));

  return expectedUrls.some((expectedUrl) => sameDatabaseUrl(databaseUrl, expectedUrl));
}

function sameDatabaseUrl(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return leftUrl.toString() === rightUrl.toString();
  } catch {
    return left === right;
  }
}
