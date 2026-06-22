import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabase,
  listUserWorkspacesSync,
  readWorkspaceStateRecordSync,
  readWorkspaceSync,
} from "@agent-space/db";
import { createOwnedWorkspaceForUserSync } from "./user-workspaces";

const originalCwd = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "agent-space-user-workspaces-"));

beforeAll(() => {
  writeFileSync(join(tempRoot, "Target.md"), "# test\n");
  mkdirSync(join(tempRoot, "data"), { recursive: true });
  process.chdir(tempRoot);
});

beforeEach(() => {
  const db = getDatabase();
  db.exec("DELETE FROM workspace_membership");
  db.exec("DELETE FROM workspace");
  db.exec("DELETE FROM workspace_snapshot");
  db.exec("DELETE FROM users");
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe("owned workspace bootstrap", () => {
  it("creates a personal workspace, owner membership, and workspace state", () => {
    seedUser({ id: "user-1", displayName: "Mina" });

    const { workspace, membership } = createOwnedWorkspaceForUserSync({
      userId: "user-1",
      displayName: "Mina",
    });

    expect(workspace.id).not.toBe("default");
    expect(workspace.slug).not.toBe("default");
    expect(workspace.name).toBe("Mina's personal workspace");
    expect(membership.workspaceId).toBe(workspace.id);
    expect(membership.role).toBe("owner");
    expect(listUserWorkspacesSync("user-1")).toHaveLength(1);
    expect(readWorkspaceSync(workspace.id)?.id).toBe(workspace.id);

    const state = readWorkspaceStateRecordSync(workspace.id);
    expect(state?.organizationName).toBe("Mina's personal workspace");
    expect(state?.humanMembers[0]?.name).toBe("Mina");
    expect(state?.humanMembers[0]?.role).toBe("Owner");
    expect(state?.channels).toEqual([]);
  });

  it("falls back to a generic personal workspace name when display name is empty", () => {
    seedUser({ id: "user-2", displayName: "" });

    const { workspace } = createOwnedWorkspaceForUserSync({
      userId: "user-2",
      displayName: "   ",
    });

    expect(workspace.name).toBe("Personal workspace");
    expect(workspace.slug).toMatch(/^personal-workspace-/);
  });
});

function seedUser(input: { id: string; displayName: string }): void {
  const now = new Date().toISOString();
  getDatabase().prepare(
    `INSERT INTO users (id, display_name, avatar_url, primary_email, created_at, updated_at, last_login_at)
     VALUES (?, ?, NULL, NULL, ?, ?, NULL)`,
  ).run(input.id, input.displayName, now, now);
}
