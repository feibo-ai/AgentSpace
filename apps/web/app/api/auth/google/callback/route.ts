import { NextResponse } from "next/server";
import { reportGoogleAuthCallbackIssue } from "@/features/auth/auth-monitoring";
import { buildWorkspacePath } from "@/features/auth/workspace-paths";
import { acceptWorkspaceInvitationForUser } from "@/features/auth/workspace-invitations";
import { createSessionForGoogleLogin } from "@/features/auth/server-auth";
import { exchangeGoogleCodeForProfile, readGoogleOAuthConfig, verifyGoogleOAuthCallbackState } from "@/features/auth/google-oauth";
import { joinWorkspaceByCodeForUser } from "@/features/auth/workspace-join-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const { appUrl } = readGoogleOAuthConfig();
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const error = url.searchParams.get("error")?.trim();

  if (error) {
    reportGoogleAuthCallbackIssue({
      code: error,
      phase: "provider_redirect",
    });
    return NextResponse.redirect(buildPublicAppUrl(`/auth/error?code=${encodeURIComponent(error)}`, appUrl));
  }
  if (!code || !state) {
    reportGoogleAuthCallbackIssue({
      code: "auth.google_exchange_failed",
      phase: "missing_params",
      details: `code=${Boolean(code)} state=${Boolean(state)}`,
    });
    return NextResponse.redirect(buildPublicAppUrl("/auth/error?code=auth.google_exchange_failed", appUrl));
  }

  let invitationToken: string | undefined;
  let joinCode: string | undefined;
  try {
    const verifiedState = await verifyGoogleOAuthCallbackState(state);
    invitationToken = verifiedState.invitationToken;
    joinCode = verifiedState.joinCode;
    const profile = await exchangeGoogleCodeForProfile({
      code,
      expectedNonce: verifiedState.nonce,
    });
    const currentUser = await createSessionForGoogleLogin({
      providerSubject: profile.sub,
      email: profile.email,
      emailVerified: profile.emailVerified,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      invitationToken: verifiedState.invitationToken,
      joinCode: verifiedState.joinCode,
    });

    if (verifiedState.invitationToken) {
      const accepted = await acceptWorkspaceInvitationForUser({
        token: verifiedState.invitationToken,
        userId: currentUser.id,
        actorDisplayName: currentUser.displayName,
      });
      return NextResponse.redirect(buildPublicAppUrl(buildWorkspacePath(accepted.workspaceSlug, "/im"), appUrl));
    }

    if (verifiedState.joinCode) {
      const joined = await joinWorkspaceByCodeForUser({
        joinCode: verifiedState.joinCode,
        userId: currentUser.id,
        actorDisplayName: currentUser.displayName,
      });
      return NextResponse.redirect(buildPublicAppUrl(joined.redirectPath, appUrl));
    }

    return NextResponse.redirect(buildPublicAppUrl("/", appUrl));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "auth.google_exchange_failed";
    if (message === "auth.google_account_link_required") {
      const target = invitationToken
        ? `/auth/link/google?invitationToken=${encodeURIComponent(invitationToken)}`
        : "/auth/link/google";
      return NextResponse.redirect(buildPublicAppUrl(target, appUrl));
    }
    if (message === "auth.google_profile_setup_required") {
      return NextResponse.redirect(buildPublicAppUrl("/auth/setup/google", appUrl));
    }
    reportGoogleAuthCallbackIssue({
      code: message,
      phase: "callback",
      invitationToken,
      joinCode,
      details: callbackError instanceof Error ? callbackError.stack : String(callbackError),
    });
    const target = invitationToken
      ? `/invite/${encodeURIComponent(invitationToken)}?authError=${encodeURIComponent(message)}`
      : joinCode
        ? `/?joinCode=${encodeURIComponent(joinCode)}&authError=${encodeURIComponent(message)}`
      : `/auth/error?code=${encodeURIComponent(message)}`;
    return NextResponse.redirect(buildPublicAppUrl(target, appUrl));
  }
}

function buildPublicAppUrl(path: string, appUrl: string): URL {
  return new URL(path, appUrl.endsWith("/") ? appUrl : `${appUrl}/`);
}
