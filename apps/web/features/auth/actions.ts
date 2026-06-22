"use server";

import { redirect } from "next/navigation";
import { readWorkspaceSync } from "@agent-space/db";
import { tryRecordWorkspaceAuditEventSync } from "@agent-space/services";
import {
  clearCurrentSession,
  completePendingGoogleRegistration,
  confirmGoogleAccountLink,
  createSessionForLogin,
  createSessionForRegistration,
} from "@/features/auth/server-auth";
import { acceptWorkspaceInvitationForUser } from "@/features/auth/workspace-invitations";
import { requireCurrentWorkspaceContext } from "@/features/auth/server-workspace";
import { writeWorkspaceSelectionCookie } from "@/features/auth/workspace-selection";
import { joinWorkspaceByCodeForUser } from "@/features/auth/workspace-join-codes";

export type AuthActionResult =
  | { ok: true; redirectPath?: string }
  | { ok: false; error: string };

export type GoogleRegistrationActionResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string };

export async function registerAction(formData: FormData): Promise<AuthActionResult> {
  try {
    const currentUser = await createSessionForRegistration({
      displayName: getRequiredValue(formData, "displayName"),
      email: getRequiredValue(formData, "email"),
      password: getRequiredValue(formData, "password"),
    });
    const invitationToken = getOptionalValue(formData, "invitationToken");
    if (invitationToken) {
      await acceptWorkspaceInvitationForUser({
        token: invitationToken,
        userId: currentUser.id,
        actorDisplayName: currentUser.displayName,
      });
    }

    const joinResult = await joinWorkspaceFromAuthFormIfPresent(formData, currentUser);
    return { ok: true, redirectPath: joinResult?.redirectPath };
  } catch (error) {
    return toAuthActionFailure(error);
  }
}

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  try {
    const currentUser = await createSessionForLogin({
      email: getRequiredValue(formData, "email"),
      password: getRequiredValue(formData, "password"),
    });
    const invitationToken = getOptionalValue(formData, "invitationToken");
    if (invitationToken) {
      await acceptWorkspaceInvitationForUser({
        token: invitationToken,
        userId: currentUser.id,
        actorDisplayName: currentUser.displayName,
      });
    }

    const joinResult = await joinWorkspaceFromAuthFormIfPresent(formData, currentUser);
    return { ok: true, redirectPath: joinResult?.redirectPath };
  } catch (error) {
    return toAuthActionFailure(error);
  }
}

export async function confirmGoogleAccountLinkAction(formData: FormData): Promise<AuthActionResult> {
  try {
    const result = await confirmGoogleAccountLink({
      password: getRequiredValue(formData, "password"),
    });

    return { ok: true, redirectPath: result.redirectPath };
  } catch (error) {
    return toAuthActionFailure(error);
  }
}

export async function completeGoogleRegistrationAction(
  formData: FormData,
): Promise<GoogleRegistrationActionResult> {
  try {
    const result = await completePendingGoogleRegistration({
      displayName: getRequiredValue(formData, "displayName"),
      workspaceName: getRequiredValue(formData, "workspaceName"),
    });

    return {
      ok: true,
      redirectPath: result.redirectPath,
    };
  } catch (error) {
    return toAuthActionFailure(error);
  }
}

export async function logoutAction(): Promise<{ ok: true }> {
  await clearCurrentSession();
  return { ok: true };
}

export async function logoutAndRedirectAction(): Promise<void> {
  await clearCurrentSession();
  redirect("/");
}

export async function switchWorkspaceAction(workspaceId: string): Promise<{ ok: true }> {
  const workspaceContext = await requireCurrentWorkspaceContext();
  const trimmedWorkspaceIdentifier = workspaceId.trim();
  if (!trimmedWorkspaceIdentifier) {
    throw new Error("Missing workspace id.");
  }

  const workspace = readWorkspaceSync(trimmedWorkspaceIdentifier);
  const hasMembership = workspaceContext.memberships.some((membership) => membership.workspaceId === workspace?.id);
  if (!workspace || !hasMembership) {
    throw new Error("Forbidden.");
  }

  await writeWorkspaceSelectionCookie(workspace.slug);
  tryRecordWorkspaceAuditEventSync({
    workspaceId: workspace.id,
    title: "Workspace switched",
    note: `${workspaceContext.currentUser.displayName} switched into workspace "${workspace.name}".`,
    code: "workspace.switched",
    data: {
      actorType: "session_user",
      resourceType: "workspace",
      resourceId: workspace.id,
    },
  });
  return { ok: true };
}

export async function joinWorkspaceByCodeAction(joinCode: string): Promise<{
  ok: true;
  workspaceSlug: string;
  alreadyMember: boolean;
}> {
  const workspaceContext = await requireCurrentWorkspaceContext();
  const result = await joinWorkspaceByCodeForUser({
    joinCode,
    userId: workspaceContext.currentUser.id,
    actorDisplayName: workspaceContext.currentUser.displayName,
    auditWorkspaceId: workspaceContext.currentWorkspace.id,
  });
  return { ok: true, workspaceSlug: result.workspaceSlug, alreadyMember: result.alreadyMember };
}

async function joinWorkspaceFromAuthFormIfPresent(
  formData: FormData,
  currentUser: { id: string; displayName: string },
): Promise<{ redirectPath: string } | undefined> {
  const joinCode = getOptionalValue(formData, "workspaceJoinCode");
  if (!joinCode) {
    return undefined;
  }

  return joinWorkspaceByCodeForUser({
    joinCode,
    userId: currentUser.id,
    actorDisplayName: currentUser.displayName,
  });
}

function getRequiredValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form value "${key}".`);
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toAuthActionFailure(error: unknown): { ok: false; error: string } {
  if (error instanceof Error && isClientSafeAuthError(error.message)) {
    return { ok: false, error: error.message };
  }

  throw error;
}

function isClientSafeAuthError(message: string): boolean {
  return (
    message.startsWith("auth.") ||
    message.startsWith("workspace.invitation.") ||
    message.startsWith("workspace.join_code.") ||
    message.startsWith("Missing form value ")
  );
}
