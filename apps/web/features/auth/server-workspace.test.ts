import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspaceMembershipSync,
  createWorkspaceSync,
  getDatabase,
  listUserWorkspacesSync,
} from "@agent-space/db";
import type { AuthUser } from "./server-auth";
import {
  resolveCurrentWorkspaceContextForUserSync,
  resolveWorkspaceAccessForIdentifierSync,
} from "./server-workspace-resolver";

const originalCwd = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "agent-space-server-workspace-"));

beforeAll(() => {
  writeFileSync(join(tempRoot, "Target.md"), "# test\n");
  mkdirSync(join(tempRoot, "data"), { recursive: true });
  process.chdir(tempRoot);
});

beforeEach(() => {
  const db = getDatabase();
  db.exec("DELETE FROM workspace_membership");
  db.exec("DELETE FROM workspace");
  db.exec("DELETE FROM users");
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe("server workspace context", () => {
  it("bootstraps an owned workspace for users without memberships", () => {
    const user: AuthUser = {
      id: "user-1",
      organizationName: "Northstar Labs",
      displayName: "Tianyu",
      role: "Founder",
      email: "tianyu@example.com",
    };
    seedUser(user);

    const context = resolveCurrentWorkspaceContextForUserSync(user);

    expect(context.currentWorkspace.id).not.toBe("default");
    expect(context.currentWorkspace.slug).not.toBe("default");
    expect(context.currentWorkspace.name).toBe("Tianyu's personal workspace");
    expect(context.currentMembership.workspaceId).toBe(context.currentWorkspace.id);
    expect(context.currentMembership.role).toBe("owner");
    expect(listUserWorkspacesSync(user.id)).toHaveLength(1);
  });

  it("prefers existing user memberships instead of forcing default workspace", () => {
    const user: AuthUser = {
      id: "user-2",
      organizationName: "Northstar Labs",
      displayName: "Alex",
      role: "Member",
      email: "alex@example.com",
    };
    seedUser(user);

    const workspace = createWorkspaceSync({
      id: "workspace-alex",
      slug: "workspace-alex",
      name: "Alex Workspace",
      createdBy: user.id,
    });
    createWorkspaceMembershipSync({
      workspaceId: workspace.id,
      userId: user.id,
      role: "member",
    });

    const context = resolveCurrentWorkspaceContextForUserSync(user);

    expect(context.currentWorkspace.id).toBe("workspace-alex");
    expect(context.currentMembership.workspaceId).toBe("workspace-alex");
    expect(listUserWorkspacesSync(user.id)).toHaveLength(1);
    expect(listUserWorkspacesSync(user.id)[0]?.workspaceId).toBe("workspace-alex");
  });

  it("uses the selected workspace when it belongs to the user", () => {
    const user: AuthUser = {
      id: "user-3",
      organizationName: "Northstar Labs",
      displayName: "Mina",
      role: "Owner",
      email: "mina@example.com",
    };
    seedUser(user);

    createWorkspaceSync({
      id: "workspace-alpha",
      slug: "workspace-alpha",
      name: "Alpha Workspace",
      createdBy: user.id,
    });
    createWorkspaceSync({
      id: "workspace-2",
      slug: "beta-team",
      name: "Beta Workspace",
      createdBy: user.id,
    });
    createWorkspaceMembershipSync({
      workspaceId: "workspace-alpha",
      userId: user.id,
      role: "owner",
    });
    createWorkspaceMembershipSync({
      workspaceId: "workspace-2",
      userId: user.id,
      role: "admin",
    });

    const context = resolveCurrentWorkspaceContextForUserSync(user, "beta-team");

    expect(context.currentWorkspace.id).toBe("workspace-2");
    expect(context.currentWorkspace.slug).toBe("beta-team");
    expect(context.currentMembership.workspaceId).toBe("workspace-2");
    expect(context.workspaces.map((workspace) => workspace.id)).toEqual(["workspace-2", "workspace-alpha"]);
  });

  it("falls back to the next recent workspace when the latest selection is unavailable", () => {
    const user: AuthUser = {
      id: "user-3b",
      organizationName: "Northstar Labs",
      displayName: "Mina",
      role: "Owner",
      email: "mina-2@example.com",
    };
    seedUser(user);

    createWorkspaceSync({
      id: "workspace-alpha-2",
      slug: "workspace-alpha-2",
      name: "Alpha Workspace",
      createdBy: user.id,
    });
    createWorkspaceSync({
      id: "workspace-beta-2",
      slug: "beta-team-2",
      name: "Beta Workspace",
      createdBy: user.id,
    });
    createWorkspaceMembershipSync({
      workspaceId: "workspace-alpha-2",
      userId: user.id,
      role: "owner",
    });
    createWorkspaceMembershipSync({
      workspaceId: "workspace-beta-2",
      userId: user.id,
      role: "admin",
    });

    const context = resolveCurrentWorkspaceContextForUserSync(user, [
      "missing-workspace",
      "beta-team-2",
      "workspace-alpha-2",
    ]);

    expect(context.currentWorkspace.id).toBe("workspace-beta-2");
    expect(context.currentWorkspace.slug).toBe("beta-team-2");
    expect(context.currentMembership.workspaceId).toBe("workspace-beta-2");
    expect(context.workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace-beta-2",
      "workspace-alpha-2",
    ]);
  });

  it("returns not_found when the requested workspace does not exist", () => {
    const user: AuthUser = {
      id: "user-4",
      organizationName: "Northstar Labs",
      displayName: "Mina",
      role: "Owner",
      email: "mina@example.com",
    };
    seedUser(user);

    const resolution = resolveWorkspaceAccessForIdentifierSync(user, "missing-workspace");

    expect(resolution.status).toBe("not_found");
  });

  it("returns forbidden when the user does not belong to the requested workspace", () => {
    const user: AuthUser = {
      id: "user-5",
      organizationName: "Northstar Labs",
      displayName: "Mina",
      role: "Owner",
      email: "mina@example.com",
    };
    seedUser(user);

    createWorkspaceSync({
      id: "workspace-allowed",
      slug: "workspace-allowed",
      name: "Allowed Workspace",
      createdBy: user.id,
    });
    createWorkspaceSync({
      id: "workspace-locked",
      slug: "workspace-locked",
      name: "Locked Workspace",
      createdBy: "other-user",
    });
    createWorkspaceMembershipSync({
      workspaceId: "workspace-allowed",
      userId: user.id,
      role: "owner",
    });

    const resolution = resolveWorkspaceAccessForIdentifierSync(user, "workspace-locked");

    expect(resolution.status).toBe("forbidden");
    if (resolution.status === "forbidden") {
      expect(resolution.workspaces.map((workspace) => workspace.id)).toEqual(["workspace-allowed"]);
    }
  });
});

function seedUser(user: AuthUser): void {
  const now = new Date().toISOString();
  getDatabase().prepare(
    `INSERT INTO users (id, display_name, avatar_url, primary_email, created_at, updated_at, last_login_at)
     VALUES (?, ?, NULL, ?, ?, ?, NULL)`,
  ).run(user.id, user.displayName, user.email, now, now);
}
