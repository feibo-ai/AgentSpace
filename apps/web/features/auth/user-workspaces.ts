import {
  createWorkspaceMembershipSync,
  createWorkspaceSync,
  type StoredWorkspaceMembershipRecord,
  type StoredWorkspaceRecord,
} from "@agent-space/db";
import { createDefaultWorkspaceState } from "@agent-space/domain/workspace";
import { writeWorkspaceStateSync } from "@agent-space/services";

export interface OwnedWorkspaceBootstrapInput {
  userId: string;
  displayName: string;
  workspaceName?: string;
}

export interface OwnedWorkspaceBootstrapResult {
  workspace: StoredWorkspaceRecord;
  membership: StoredWorkspaceMembershipRecord;
}

export function createOwnedWorkspaceForUserSync(
  input: OwnedWorkspaceBootstrapInput,
): OwnedWorkspaceBootstrapResult {
  const workspaceName = input.workspaceName?.trim() || resolveOwnedWorkspaceName(input.displayName);
  const workspace = createWorkspaceSync({
    name: workspaceName,
    createdBy: input.userId,
  });
  const membership = createWorkspaceMembershipSync({
    workspaceId: workspace.id,
    userId: input.userId,
    role: "owner",
  });

  const initialState = createDefaultWorkspaceState();
  initialState.organizationName = workspace.name;
  initialState.humanMembers = [{ name: input.displayName, role: "Owner" }];
  initialState.channels = [];
  writeWorkspaceStateSync(initialState, workspace.id);

  return {
    workspace,
    membership,
  };
}

export function resolveOwnedWorkspaceName(displayName: string): string {
  const normalizedDisplayName = displayName.trim();
  if (normalizedDisplayName.length > 0) {
    return `${normalizedDisplayName}'s personal workspace`;
  }

  return "Personal workspace";
}
