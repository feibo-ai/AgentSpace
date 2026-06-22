import {
  listUserWorkspacesSync,
  readWorkspaceByJoinCodeSync,
  upsertWorkspaceMembershipSync,
} from "@agent-space/db";
import { addHumanMemberSync, tryRecordWorkspaceAuditEventSync } from "@agent-space/services";
import { buildWorkspacePath } from "./workspace-paths";
import { writeWorkspaceSelectionCookie } from "./workspace-selection";

export interface WorkspaceJoinCodeResult {
  alreadyMember: boolean;
  workspaceSlug: string;
  redirectPath: string;
}

export async function joinWorkspaceByCodeForUser(input: {
  joinCode: string;
  userId: string;
  actorDisplayName: string;
  auditWorkspaceId?: string;
}): Promise<WorkspaceJoinCodeResult> {
  const normalizedJoinCode = normalizeWorkspaceJoinCode(input.joinCode);
  if (!normalizedJoinCode) {
    throw new Error("workspace.join_code.missing");
  }

  const workspace = readWorkspaceByJoinCodeSync(normalizedJoinCode);
  if (!workspace) {
    if (input.auditWorkspaceId) {
      tryRecordWorkspaceAuditEventSync({
        workspaceId: input.auditWorkspaceId,
        title: "Workspace join code failed",
        note: `${input.actorDisplayName} entered an invalid workspace join code.`,
        code: "workspace.join_code_join_failed",
        data: {
          actorType: "session_user",
          resourceType: "workspace",
        },
      });
    }
    throw new Error("workspace.join_code.invalid");
  }

  const alreadyMember = listUserWorkspacesSync(input.userId).some(
    (membership) => membership.workspaceId === workspace.id,
  );
  if (!alreadyMember) {
    const membership = upsertWorkspaceMembershipSync({
      workspaceId: workspace.id,
      userId: input.userId,
      role: "member",
      invitedBy: "join_code",
    });
    addHumanMemberSync({
      name: input.actorDisplayName,
      role: membership.role,
    }, workspace.id);
    tryRecordWorkspaceAuditEventSync({
      workspaceId: workspace.id,
      title: "Workspace joined by code",
      note: `${input.actorDisplayName} joined workspace "${workspace.name}" with a join code.`,
      code: "workspace.join_code_joined",
      data: {
        actorType: "session_user",
        resourceType: "workspace_member",
        resourceId: membership.id,
        targetUserId: input.userId,
        targetRole: "member",
      },
    });
  }

  await writeWorkspaceSelectionCookie(workspace.slug);
  return {
    alreadyMember,
    workspaceSlug: workspace.slug,
    redirectPath: buildWorkspacePath(workspace.slug, "/im"),
  };
}

export function normalizeWorkspaceJoinCode(joinCode: string): string {
  return joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
