import "@testing-library/jest-dom/vitest";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const explicitTestDatabaseUrl =
  process.env.AGENT_SPACE_TEST_DATABASE_URL?.trim()
  || process.env.AGENT_SPACE_PG_TEST_URL?.trim();

if (explicitTestDatabaseUrl) {
  if (!looksLikeTestDatabaseUrl(explicitTestDatabaseUrl) && !looksLikeE2eNeonBranchUrl(explicitTestDatabaseUrl)) {
    throw new Error(
      "Refusing to run web tests against an explicit database URL that is not marked as test/e2e. "
      + "Use a database name containing test/e2e, or use the Playwright Neon branch setup.",
    );
  }
  process.env.AGENT_SPACE_PG_URL = explicitTestDatabaseUrl;
  process.env.DATABASE_URL = explicitTestDatabaseUrl;
} else if (process.env.AGENT_SPACE_ALLOW_PRODUCTION_TEST_DB !== "1") {
  const databaseUrl = resolveConfiguredDatabaseUrl();
  if (databaseUrl && !looksLikeTestDatabaseUrl(databaseUrl)) {
    throw new Error(
      "Refusing to run web tests against the configured application database. "
      + "Set AGENT_SPACE_TEST_DATABASE_URL to an isolated PostgreSQL test database, "
      + "or set AGENT_SPACE_ALLOW_PRODUCTION_TEST_DB=1 if this is intentional.",
    );
  }
}

function resolveConfiguredDatabaseUrl(): string | undefined {
  const fromEnv = resolveDeploymentModeDatabaseUrl(process.env)
    || process.env.AGENT_SPACE_PG_URL?.trim()
    || process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const envFilePath = resolve(process.cwd(), "..", "..", ".env");
  if (!existsSync(envFilePath)) {
    return undefined;
  }

  const parsed = parseDotEnv(readFileSync(envFilePath, "utf8"));
  return resolveDeploymentModeDatabaseUrl(parsed)
    || parsed.AGENT_SPACE_PG_URL?.trim()
    || parsed.DATABASE_URL?.trim()
    || undefined;
}

function looksLikeTestDatabaseUrl(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl);
    return /(^|[_-])(test|e2e|loadtest)([_-]|$)/i.test(parsed.pathname.replace(/^\//, ""));
  } catch {
    return /(^|[_-])(test|e2e|loadtest)([_-]|$)/i.test(databaseUrl);
  }
}

function looksLikeE2eNeonBranchUrl(databaseUrl: string): boolean {
  const branchId = process.env.AGENT_SPACE_E2E_NEON_BRANCH_ID?.trim();
  const branchName = process.env.AGENT_SPACE_E2E_NEON_BRANCH_NAME?.trim();
  if (!branchId || !branchName?.startsWith("e2e-")) {
    return false;
  }
  const expectedUrls = [
    process.env.AGENT_SPACE_E2E_DATABASE_URL,
    process.env.AGENT_SPACE_TEST_DATABASE_URL,
    process.env.AGENT_SPACE_PG_TEST_URL,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return expectedUrls.some((expectedUrl) => sameDatabaseUrl(databaseUrl, expectedUrl));
}

function resolveDeploymentModeDatabaseUrl(env: Record<string, string | undefined>): string | undefined {
  const mode = env.AGENT_SPACE_DEPLOYMENT_MODE?.trim();
  if (mode === "cloud") {
    return env.NEON_DATABASE_URL?.trim() || undefined;
  }
  if (mode === "self_hosted") {
    return env.SELF_HOSTED_DATABASE_URL?.trim() || undefined;
  }
  return undefined;
}

function sameDatabaseUrl(left: string, right: string): boolean {
  try {
    return new URL(left).toString() === new URL(right).toString();
  } catch {
    return left === right;
  }
}

function parseDotEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).replace(/^export\s+/, "").trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
