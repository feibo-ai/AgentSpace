import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveAgentSpaceRuntimeConfig, resolveAttachmentRuntimeConfig } from "./deployment.ts";

test("deployment config reads repository root .env when started from apps/web", () => {
  const originalCwd = process.cwd();
  const tempRoot = mkdtempSync(join(tmpdir(), "agent-space-deployment-config-"));

  try {
    mkdirSync(join(tempRoot, "apps", "web"), { recursive: true });
    writeFileSync(join(tempRoot, "Target.md"), "# test\n");
    writeFileSync(
      join(tempRoot, ".env"),
      [
        "AGENT_SPACE_DEPLOYMENT_MODE=cloud",
        "NEON_DATABASE_URL=postgres://neon:secret@example.neon.tech/agent_space_test",
        "NEON_DATABASE_DIRECT_URL=postgres://neon-direct:secret@example.neon.tech/agent_space_test",
        "CLOUDFLARE_ACCOUNT_ID=account-123",
        "CLOUDFLARE_R2_BUCKET=agentspace",
        "CLOUDFLARE_R2_REGION=auto",
        "CLOUDFLARE_R2_ENDPOINT=https://account-123.r2.cloudflarestorage.com",
        "CLOUDFLARE_R2_ACCESS_KEY_ID=access-key",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret-key",
        "CLOUDFLARE_R2_FORCE_PATH_STYLE=true",
        "",
      ].join("\n"),
      "utf8",
    );

    process.chdir(join(tempRoot, "apps", "web"));

    const runtime = resolveAgentSpaceRuntimeConfig({});
    const attachments = resolveAttachmentRuntimeConfig({});

    assert.equal(runtime.deploymentMode, "cloud");
    assert.equal(runtime.databaseUrl, "postgres://neon:secret@example.neon.tech/agent_space_test");
    assert.equal(attachments.provider, "r2");
    assert.equal(attachments.r2?.bucket, "agentspace");
    assert.equal(attachments.r2?.endpoint, "https://account-123.r2.cloudflarestorage.com");
  } finally {
    process.chdir(originalCwd);
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("explicit env still overrides repository .env in tests", () => {
  const originalCwd = process.cwd();
  const tempRoot = mkdtempSync(join(tmpdir(), "agent-space-deployment-config-"));

  try {
    writeFileSync(join(tempRoot, "Target.md"), "# test\n");
    writeFileSync(
      join(tempRoot, ".env"),
      [
        "AGENT_SPACE_DEPLOYMENT_MODE=cloud",
        "NEON_DATABASE_URL=postgres://neon:secret@example.neon.tech/agent_space_test",
        "CLOUDFLARE_ACCOUNT_ID=account-123",
        "CLOUDFLARE_R2_BUCKET=agentspace",
        "CLOUDFLARE_R2_ACCESS_KEY_ID=access-key",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret-key",
        "",
      ].join("\n"),
      "utf8",
    );

    process.chdir(tempRoot);

    const attachments = resolveAttachmentRuntimeConfig({
      AGENT_SPACE_DEPLOYMENT_MODE: "self_hosted",
      SELF_HOSTED_DATABASE_URL: "postgres://self-hosted:secret@127.0.0.1:5432/agent_space_test",
      SELF_HOSTED_ATTACHMENT_LOCAL_ROOT: "/tmp/agent-space-local-attachments",
    });

    assert.equal(attachments.provider, "local");
    assert.equal(attachments.localRoot, "/tmp/agent-space-local-attachments");
  } finally {
    process.chdir(originalCwd);
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
