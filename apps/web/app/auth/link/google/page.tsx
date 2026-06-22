import { redirect } from "next/navigation";
import { GoogleLinkAccountScreen } from "@/features/auth/google-link-account-screen";
import { readPendingGoogleLinkHandoff } from "@/features/auth/google-link-handoff";
import { readWorkspaceInvitationDetailsSync } from "@/features/auth/workspace-invitations";

export const dynamic = "force-dynamic";

export default async function GoogleLinkAccountPage() {
  const handoff = await readPendingGoogleLinkHandoff();
  if (!handoff) {
    redirect("/auth/error?code=auth.google_link_expired");
  }

  const invitation = handoff.invitationToken
    ? readWorkspaceInvitationDetailsSync(handoff.invitationToken, { includeInactive: true })
    : null;

  return (
    <GoogleLinkAccountScreen
      email={handoff.email}
      invitation={invitation
        ? {
            workspaceName: invitation.workspaceName,
            role: invitation.role,
          }
        : undefined}
    />
  );
}
