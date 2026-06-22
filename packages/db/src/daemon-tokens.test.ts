import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { before, beforeEach } from "node:test";
import {
  createDaemonApiTokenSync,
  listDaemonApiTokensSync,
  revokeDaemonApiTokenSync,
  validateDaemonApiTokenSync,
} from "./index.ts";
import { getDatabase } from "./database.ts";

const originalCwd = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "agent-space-db-daemon-tokens-"));

before(() => {
  writeFileSync(join(tempRoot, "Target.md"), "# test\n");
  mkdirSync(join(tempRoot, "data"), { recursive: true });
  process.chdir(tempRoot);
});

beforeEach(() => {
  const db = getDatabase();
  db.exec("DELETE FROM daemon_api_token");
});

test("daemon api tokens can be created, validated, and revoked", () => {
  const created = createDaemonApiTokenSync({
    workspaceId: "default",
    label: "remote-build-box",
    createdBy: "Tianyu",
  });

  assert.ok(created.token.startsWith("adt_"));
  assert.equal(listDaemonApiTokensSync().length, 1);

  const validated = validateDaemonApiTokenSync(created.token);
  assert.equal(validated?.id, created.id);
  assert.equal(validated?.workspaceId, "default");
  assert.ok(validated?.lastUsedAt);

  const revoked = revokeDaemonApiTokenSync(created.id);
  assert.equal(revoked.status, "revoked");
  assert.equal(validateDaemonApiTokenSync(created.token), null);
});

test.after(() => {
  process.chdir(originalCwd);
});
